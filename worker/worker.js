/**
 * Cloudflare Worker - Image Relay with WebSocket Real-time Notifications
 * 
 * Architecture:
 * - PC connects via WebSocket for instant notifications
 * - Phone uploads via HTTP POST
 * - Worker notifies PC immediately via WebSocket (no polling delay!)
 * - Images stored in KV
 */

// In-memory map of pairing codes to WebSocket connections
const wsConnections = new Map();

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // WebSocket upgrade for PC real-time notifications
    if (path === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request);
    }

    // POST /api/pair - Generate pairing code
    if (path === '/api/pair' && request.method === 'POST') {
      const code = generateCode();
      await IMAGE_KV.put(`pair:${code}`, '', { expirationTtl: 1800 });
      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/upload?code=XXXXX - Upload image
    if (path === '/api/upload' && request.method === 'POST') {
      const code = url.searchParams.get('code');
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const existing = await IMAGE_KV.get(`pair:${code}`, { type: 'text' });
      if (existing === null) {
        return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contentType = request.headers.get('Content-Type') || 'image/jpeg';
      const imageBuffer = await request.arrayBuffer();
      
      // Store image binary
      await IMAGE_KV.put(`img:${code}`, imageBuffer, { 
        expirationTtl: 1800,
        metadata: { contentType }
      });
      
      // Notify PC via WebSocket immediately!
      const wsPair = wsConnections.get(code);
      if (wsPair && wsPair.ws.readyState === 1) { // 1 = OPEN
        try {
          wsPair.ws.send(JSON.stringify({
            type: 'image_ready',
            code: code,
            size: imageBuffer.byteLength,
            contentType: contentType
          }));
          console.log(`[Upload] Notified PC via WebSocket for code ${code}`);
        } catch (err) {
          console.error('[Upload] WebSocket send failed:', err);
        }
      } else {
        console.log(`[Upload] No WebSocket connection for code ${code}, PC will fallback poll`);
      }
      
      return new Response(JSON.stringify({ success: true, size: imageBuffer.byteLength }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/download/:code - Download image binary
    if (path.startsWith('/api/download/') && request.method === 'GET') {
      const code = path.split('/api/download/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { value, metadata } = await IMAGE_KV.getWithMetadata(`img:${code}`, { type: 'arrayBuffer' });
      
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

    // DELETE /api/clear/:code - Clear image
    if (path.startsWith('/api/clear/') && request.method === 'DELETE') {
      const code = path.split('/api/clear/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await IMAGE_KV.delete(`img:${code}`);
      
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

function handleWebSocket(request) {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  // Accept the WebSocket
  server.accept();

  let pairCode = null;

  server.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'register' && msg.code) {
        pairCode = msg.code;
        wsConnections.set(pairCode, { ws: server });
        console.log(`[WebSocket] PC registered for code ${pairCode}`);
        
        // Send confirmation
        server.send(JSON.stringify({ type: 'registered', code: pairCode }));
      }
    } catch (err) {
      console.error('[WebSocket] Message error:', err);
    }
  });

  server.addEventListener('close', () => {
    if (pairCode) {
      wsConnections.delete(pairCode);
      console.log(`[WebSocket] PC disconnected for code ${pairCode}`);
    }
  });

  server.addEventListener('error', (err) => {
    console.error('[WebSocket] Error:', err);
    if (pairCode) {
      wsConnections.delete(pairCode);
    }
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
