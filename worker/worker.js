/**
 * Cloudflare Worker - Image Relay for MathLab Photo Upload
 * Two-key design for fast polling:
 * - img:{code} = image binary data
 * - flag:{code} = tiny notification flag (JSON)
 * 
 * Polling reads only the tiny flag (~50 bytes), not the image.
 */

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
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api/pair - Generate pairing code
    if (path === '/api/pair' && request.method === 'POST') {
      const code = generateCode();
      await IMAGE_KV.put(`pair:${code}`, '', { expirationTtl: 1800 });
      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/upload?code=XXXXX - Upload image (binary body) + set flag
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

      const contentType = request.headers.get('Content-Type') || 'image/webp';
      const imageBuffer = await request.arrayBuffer();
      
      // Store image binary
      await IMAGE_KV.put(`img:${code}`, imageBuffer, { 
        expirationTtl: 1800,
        metadata: { contentType }
      });
      
      // Set tiny flag for fast polling
      const flag = JSON.stringify({ 
        ready: true, 
        size: imageBuffer.byteLength, 
        type: contentType,
        ts: Date.now()
      });
      await IMAGE_KV.put(`flag:${code}`, flag, { expirationTtl: 1800 });
      
      return new Response(JSON.stringify({ success: true, size: imageBuffer.byteLength }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/check/:code - Check flag only (FAST!)
    if (path.startsWith('/api/check/') && request.method === 'GET') {
      const code = path.split('/api/check/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const flag = await IMAGE_KV.get(`flag:${code}`, { type: 'text' });
      
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

      const contentType = metadata?.contentType || 'image/webp';

      return new Response(value, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': value.byteLength.toString(),
          'Cache-Control': 'no-cache'
        }
      });
    }

    // DELETE /api/clear/:code - Clear image + flag
    if (path.startsWith('/api/clear/') && request.method === 'DELETE') {
      const code = path.split('/api/clear/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await Promise.all([
        IMAGE_KV.delete(`img:${code}`),
        IMAGE_KV.delete(`flag:${code}`)
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

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}
