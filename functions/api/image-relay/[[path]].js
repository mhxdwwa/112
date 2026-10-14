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

    // Upload image (binary)
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

      // Get content type from request
      const contentType = request.headers.get('Content-Type') || 'image/webp';
      
      // Store binary image directly (much faster than base64)
      const imageBuffer = await request.arrayBuffer();
      
      // Store image binary with metadata
      await env.IMAGE_KV.put(`pair:${code}`, imageBuffer, { 
        expirationTtl: 1800,
        metadata: { contentType: contentType }
      });
      
      return new Response(JSON.stringify({ success: true, size: imageBuffer.byteLength }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for image (returns binary or 204)
    if (path.startsWith('/check/') && request.method === 'GET') {
      const code = path.split('/check/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get image as ArrayBuffer
      const imageBuffer = await env.IMAGE_KV.get(`pair:${code}`, { type: 'arrayBuffer' });
      
      if (imageBuffer === null) {
        // No image - return 204 No Content
        return new Response(null, { 
          status: 204,
          headers: corsHeaders 
        });
      }

      // Check if it's empty placeholder
      if (imageBuffer.byteLength === 0) {
        return new Response(null, { 
          status: 204,
          headers: corsHeaders 
        });
      }

      // Get metadata for content type
      const { value, metadata } = await env.IMAGE_KV.getWithMetadata(`pair:${code}`, { type: 'arrayBuffer' });
      const contentType = metadata?.contentType || 'image/webp';

      // Return binary image directly (much faster than JSON with base64)
      return new Response(value, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': value.byteLength.toString(),
          'Cache-Control': 'no-cache'
        }
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
