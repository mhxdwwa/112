/**
 * Cloudflare Worker - Image Relay Service (ES Module format)
 * Route: wscls.cn/api/image-relay/*
 * 
 * Two-key design for fast polling:
 * - pair:{code} = pairing code existence (empty string)
 * - img:{code} = image binary data
 * - flag:{code} = tiny notification flag (JSON with size+type)
 * 
 * Polling only reads the tiny flag (~50 bytes), not the image.
 * Also supports WebSocket for real-time notifications.
 */

// In-memory map of pairing codes to WebSocket connections
const wsConnections = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Strip the /api/image-relay prefix (route pattern: wscls.cn/api/image-relay/*)
    let path = url.pathname.replace('/api/image-relay', '');
    if (!path || path === '') path = '/';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // WebSocket upgrade for real-time notifications
      if (path === '/ws' && request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(request);
      }

      // POST /pair - Generate pairing code
      if (path === '/pair' && request.method === 'POST') {
        const code = generateCode();
        await env.IMAGE_KV.put(`pair:${code}`, '', { expirationTtl: 1800 });
        return new Response(JSON.stringify({ code }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /upload?code=X - Upload image binary + set flag
      if (path === '/upload' && request.method === 'POST') {
        const code = url.searchParams.get('code');
        
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const existing = await env.IMAGE_KV.get(`pair:${code}`, { type: 'text' });
        if (existing === null) {
          return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const contentType = request.headers.get('Content-Type') || 'image/jpeg';
        const imageBuffer = await request.arrayBuffer();
        
        // Store image binary
        await env.IMAGE_KV.put(`img:${code}`, imageBuffer, { 
          expirationTtl: 1800,
          metadata: { contentType }
        });
        
        // Set tiny flag (just a few bytes) - polling reads this, NOT the image
        const flag = JSON.stringify({ 
          ready: true, 
          size: imageBuffer.byteLength, 
          type: contentType,
          ts: Date.now()
        });
        await env.IMAGE_KV.put(`flag:${code}`, flag, { expirationTtl: 1800 });
        
        // Notify PC via WebSocket if connected
        const wsPair = wsConnections.get(code);
        if (wsPair && wsPair.ws.readyState === 1) {
          try {
            wsPair.ws.send(JSON.stringify({
              type: 'image_ready',
              code: code,
              size: imageBuffer.byteLength,
              contentType: contentType
            }));
          } catch (err) {}
        }
        
        return new Response(JSON.stringify({ success: true, size: imageBuffer.byteLength }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /check/:code - Check flag only (FAST - reads ~50 bytes, not the image)
      if (path.startsWith('/check/') && request.method === 'GET') {
        const code = path.split('/check/')[1];
        
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const flag = await env.IMAGE_KV.get(`flag:${code}`, { type: 'text' });
        
        if (!flag) {
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        return new Response(flag, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // GET /download/:code - Download image binary
      if (path.startsWith('/download/') && request.method === 'GET') {
        const code = path.split('/download/')[1];
        
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { value, metadata } = await env.IMAGE_KV.getWithMetadata(`img:${code}`, { type: 'arrayBuffer' });
        
        if (!value || value.byteLength === 0) {
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        const contentType = metadata?.contentType || 'image/jpeg';

        return new Response(value, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Length': value.byteLength.toString(),
            'Cache-Control': 'no-cache'
          }
        });
      }

      // DELETE /clear/:code - Clear image + flag
      if (path.startsWith('/clear/') && request.method === 'DELETE') {
        const code = path.split('/clear/')[1];
        
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await Promise.all([
          env.IMAGE_KV.delete(`img:${code}`),
          env.IMAGE_KV.delete(`flag:${code}`)
        ]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /vod-proxy?url=xxx - Proxy video API requests (CORS bypass)
      if (path === '/vod-proxy' && request.method === 'GET') {
        const targetUrl = url.searchParams.get('url');
        
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Only allow known video API domains
        const allowedDomains = [
          'api.juliang.live',
          'api.zuidapi.com',
          'caiji.xgzyapi.com',
          'mujiziyuan00.com',
          'ffzy5.tv',
          'cj.lziapi.com',
          'cj.ffzyapi.com',
          'www.hongniuzy2.com',
          'bfzyapi.com',
          'okzyapi.com',
        ];
        
        let targetHost;
        try {
          targetHost = new URL(targetUrl).host;
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const isAllowed = allowedDomains.some(domain => targetHost === domain || targetHost.endsWith('.' + domain));
        if (!isAllowed) {
          return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          });
          
          const data = await response.text();
          return new Response(data, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Fetch failed: ' + err.message }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // GET /m3u8-proxy?url=xxx - Proxy and filter M3U8 streams (remove ad segments)
      if (path === '/m3u8-proxy' && request.method === 'GET') {
        const targetUrl = url.searchParams.get('url');
        const origin = url.searchParams.get('origin') || '';
        
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Fetch the original m3u8
          const m3u8Response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': origin || new URL(targetUrl).origin,
            },
          });
          
          let m3u8Content = await m3u8Response.text();
          
          // Check if it's a master playlist (contains multiple quality levels)
          if (m3u8Content.includes('#EXT-X-STREAM-INF')) {
            // Rewrite master playlist URLs to go through our proxy
            const baseUrl = new URL(targetUrl);
            m3u8Content = m3u8Content.replace(/^(https?:\/\/[^\r\n]+|[^#\r\n][^\r\n]*\.m3u8[^\r\n]*)/gm, (match) => {
              let absoluteUrl;
              if (match.startsWith('http')) {
                absoluteUrl = match;
              } else {
                // Relative URL - resolve against base
                absoluteUrl = new URL(match, baseUrl).href;
              }
              return `/api/image-relay/m3u8-proxy?url=${encodeURIComponent(absoluteUrl)}&origin=${encodeURIComponent(origin || baseUrl.origin)}`;
            });
            
            return new Response(m3u8Content, {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
          
          // Filter ad segments from media playlist
          m3u8Content = filterM3u8Ads(m3u8Content, targetUrl, origin);
          
          return new Response(m3u8Content, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'public, max-age=60',
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Fetch failed: ' + err.message }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // GET /ts-proxy?url=xxx&origin=xxx - Proxy TS segment requests
      if (path === '/ts-proxy' && request.method === 'GET') {
        const targetUrl = url.searchParams.get('url');
        const origin = url.searchParams.get('origin') || '';
        
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const tsResponse = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': origin || new URL(targetUrl).origin,
              'Range': request.headers.get('Range') || '',
            },
          });
          
          return new Response(tsResponse.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'video/mp2t',
              'Cache-Control': 'public, max-age=86400',
              'Accept-Ranges': 'bytes',
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Fetch failed: ' + err.message }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

function handleWebSocket(request) {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  server.accept();
  let pairCode = null;

  server.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'register' && msg.code) {
        pairCode = msg.code;
        wsConnections.set(pairCode, { ws: server });
        server.send(JSON.stringify({ type: 'registered', code: pairCode }));
      }
    } catch (err) {}
  });

  server.addEventListener('close', () => {
    if (pairCode) wsConnections.delete(pairCode);
  });

  server.addEventListener('error', () => {
    if (pairCode) wsConnections.delete(pairCode);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

/**
 * Filter ad segments from M3U8 content
 * Removes segments between DISCONTINUITY markers and segments with suspicious durations
 */
function filterM3u8Ads(m3u8Content, baseUrl, origin) {
  const lines = m3u8Content.split('\n');
  const output = [];
  const base = new URL(baseUrl);
  
  // Suspicious ad durations (in seconds) - common ad lengths
  const AD_DURATIONS = [5, 10, 15, 20, 30];
  
  let inAdBlock = false;
  let skipUntilNextSegment = false;
  let lastDuration = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Handle DISCONTINUITY markers (often used to insert ads)
    if (line === '#EXT-X-DISCONTINUITY') {
      // Check if next segment looks like an ad
      let nextDuration = 0;
      let nextUrl = '';
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (lines[j].startsWith('#EXTINF:')) {
          nextDuration = parseFloat(lines[j].split(':')[1]);
        } else if (!lines[j].startsWith('#') && lines[j].length > 0) {
          nextUrl = lines[j];
          break;
        }
      }
      
      // If next segment has suspicious duration, skip until next DISCONTINUITY or end
      if (AD_DURATIONS.includes(Math.round(nextDuration)) || nextDuration < 3) {
        inAdBlock = true;
        continue; // Skip the DISCONTINUITY marker itself
      }
    }
    
    // Handle end of ad block
    if (inAdBlock && line === '#EXT-X-DISCONTINUITY') {
      inAdBlock = false;
      continue;
    }
    
    // Skip lines in ad block
    if (inAdBlock) {
      continue;
    }
    
    // Check for suspicious segment duration
    if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1]);
      lastDuration = duration;
      
      // Skip segments with very short or ad-like durations
      if (duration < 3 || AD_DURATIONS.includes(Math.round(duration))) {
        skipUntilNextSegment = true;
        continue;
      }
    }
    
    // Skip TS segment URL if we're in skip mode
    if (skipUntilNextSegment) {
      if (!line.startsWith('#') && line.length > 0) {
        skipUntilNextSegment = false;
        continue;
      }
    }
    
    // Rewrite TS segment URLs to go through our proxy
    if (!line.startsWith('#') && line.length > 0 && (line.includes('.ts') || line.includes('.m3u8'))) {
      let absoluteUrl;
      if (line.startsWith('http')) {
        absoluteUrl = line;
      } else {
        // Relative URL - resolve against base
        absoluteUrl = new URL(line, base).href;
      }
      
      // Rewrite to use our TS proxy
      const proxyUrl = `/api/image-relay/ts-proxy?url=${encodeURIComponent(absoluteUrl)}&origin=${encodeURIComponent(origin || base.origin)}`;
      output.push(proxyUrl);
      continue;
    }
    
    // Rewrite EXT-X-MAP (initialization segment) URLs
    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const uri = uriMatch[1];
        let absoluteUrl;
        if (uri.startsWith('http')) {
          absoluteUrl = uri;
        } else {
          absoluteUrl = new URL(uri, base).href;
        }
        const proxyUrl = `/api/image-relay/ts-proxy?url=${encodeURIComponent(absoluteUrl)}&origin=${encodeURIComponent(origin || base.origin)}`;
        output.push(line.replace(uri, proxyUrl));
        continue;
      }
    }
    
    // Keep all other lines as-is
    output.push(line);
  }
  
  return output.join('\n');
}
