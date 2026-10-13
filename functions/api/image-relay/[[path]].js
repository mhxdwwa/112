/**
 * Image Relay API for MathLab Photo Upload
 * Cloudflare Pages Function - runs on wscls.cn domain
 * 
 * Endpoints:
 * POST /api/image-relay/pair - Generate pairing code
 * POST /api/image-relay/upload - Upload image
 * GET /api/image-relay/check/:code - Check for image
 * DELETE /api/image-relay/clear/:code - Clear image
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/image-relay', '');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate pairing code
    if (path === '/pair' && request.method === 'POST') {
      const code = generateCode();
      await env.IMAGE_KV.put(`pair:${code}`, '', { expirationTtl: 1800 });
      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upload image
    if (path === '/upload' && request.method === 'POST') {
      const { code, image } = await request.json();
      
      if (!code || !image) {
        return new Response(JSON.stringify({ error: 'Missing code or image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const existing = await env.IMAGE_KV.get(`pair:${code}`);
      if (existing === null) {
        return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.IMAGE_KV.put(`pair:${code}`, image, { expirationTtl: 1800 });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for image
    if (path.startsWith('/check/') && request.method === 'GET') {
      const code = path.split('/check/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const image = await env.IMAGE_KV.get(`pair:${code}`);
      
      if (image === null || image === '') {
        return new Response(JSON.stringify({ hasImage: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ hasImage: true, image }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Clear image
    if (path.startsWith('/clear/') && request.method === 'DELETE') {
      const code = path.split('/clear/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.IMAGE_KV.delete(`pair:${code}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate 6-digit numeric pairing code
function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}
