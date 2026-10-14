/**
 * Image Relay API for MathLab Photo Upload
 * Cloudflare Pages Function - runs on wscls.cn domain
 * 
 * Two-key design for fast polling:
 * - pair:{code} = pairing code existence (empty string)
 * - img:{code} = image binary data
 * - flag:{code} = tiny notification flag (JSON with size+type)
 * 
 * Polling only reads the tiny flag (~50 bytes), not the image.
 * 
 * Endpoints:
 * POST /api/image-relay/pair - Generate pairing code
 * POST /api/image-relay/upload?code=X - Upload image binary
 * GET /api/image-relay/check/:code - Check flag only (fast!)
 * GET /api/image-relay/download/:code - Download image binary
 * DELETE /api/image-relay/clear/:code - Clear image + flag
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

    // Upload image (binary) + set flag
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

      const contentType = request.headers.get('Content-Type') || 'image/webp';
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
      
      return new Response(JSON.stringify({ success: true, size: imageBuffer.byteLength }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check flag only (FAST - reads ~50 bytes, not the image)
    if (path.startsWith('/check/') && request.method === 'GET') {
      const code = path.split('/check/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Read only the tiny flag
      const flag = await env.IMAGE_KV.get(`flag:${code}`, { type: 'text' });
      
      if (!flag) {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Return flag info (small JSON, very fast)
      return new Response(flag, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Download image binary (called once after check detects new image)
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

    // Clear image + flag
    if (path.startsWith('/clear/') && request.method === 'DELETE') {
      const code = path.split('/clear/')[1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete both image and flag
      await Promise.all([
        env.IMAGE_KV.delete(`img:${code}`),
        env.IMAGE_KV.delete(`flag:${code}`)
      ]);
      
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
