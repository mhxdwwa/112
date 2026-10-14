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
