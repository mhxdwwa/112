/**
 * Cloudflare Worker - Image Relay for MathLab Photo Upload
 * Service Worker format (non-module)
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api/pair - Generate pairing code
    if (path === '/api/pair' && request.method === 'POST') {
      const code = generateCode();
      // Store empty placeholder with 30 min TTL
      await IMAGE_KV.put(`pair:${code}`, '', { expirationTtl: 1800 });
      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/upload - Upload image
    if (path === '/api/upload' && request.method === 'POST') {
      const { code, image } = await request.json();
      
      if (!code || !image) {
        return new Response(JSON.stringify({ error: 'Missing code or image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify pairing code exists
      const existing = await IMAGE_KV.get(`pair:${code}`);
      if (existing === null) {
        return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store image with 30 min TTL
      await IMAGE_KV.put(`pair:${code}`, image, { expirationTtl: 1800 });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/check/:code - Check for image
    if (path.startsWith('/api/check/') && request.method === 'GET') {
      const code = path.split('/api/check/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const image = await IMAGE_KV.get(`pair:${code}`);
      
      if (image === null || image === '') {
        return new Response(JSON.stringify({ hasImage: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ hasImage: true, image }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

      await IMAGE_KV.delete(`pair:${code}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate random 6-character pairing code (alphanumeric uppercase)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
