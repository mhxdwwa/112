/**
 * VOD API Proxy - CORS bypass for video source APIs
 * Cloudflare Pages Function - runs on wscls.cn/api/vod-proxy
 * 
 * Proxies requests to video API sources, adding CORS headers
 * so the frontend can fetch data from third-party APIs.
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    'subocaiji.com',
    'hhzyapi.com',
    'jszyapi.com',
    'jyzyapi.com',
    'duanjutiantang.com',
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
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Proxy request failed: ' + e.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
