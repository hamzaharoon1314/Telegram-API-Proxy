const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-zA-Z0-9_]+)/i;

const RATE_LIMITS = {
  windowMs: 60000,
  maxRequests: 30,
  ipCache: new Map(),
};

function isRateLimited(request) {
  const now = Date.now();
  const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
  
  const ipData = RATE_LIMITS.ipCache.get(clientIP) || { 
    count: 0, 
    resetTime: now + RATE_LIMITS.windowMs 
  };
  
  if (now > ipData.resetTime) {
    ipData.count = 1;
    ipData.resetTime = now + RATE_LIMITS.windowMs;
  } else {
    ipData.count++;
  }
  
  RATE_LIMITS.ipCache.set(clientIP, ipData);
  
  if (ipData.count > RATE_LIMITS.maxRequests) {
    return true;
  }
  
  return false;
}

async function sanitizeRequest(request) {
  const url = new URL(request.url);
  
  const cleanHeaders = new Headers();
  const allowedHeaders = [
    'content-type',
    'user-agent',
    'accept',
    'accept-encoding',
    'content-length'
  ];
  
  for (const header of allowedHeaders) {
    if (request.headers.has(header)) {
      cleanHeaders.set(header, request.headers.get(header));
    }
  }
  
  return new Request(url.toString(), {
    method: request.method,
    headers: cleanHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
    redirect: 'follow'
  });
}

function addCorsHeaders(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
  newHeaders.set('Access-Control-Max-Age', '86400');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

function createCorsOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers', 'Content-Type',
      'Access-Control-Max-Age', '86400'
    }
  });
}

function createErrorResponse(status, message) {
  return new Response(
    JSON.stringify({ 
      ok: false, 
      error: message || 'Proxy error'
    }), 
    {
      status: status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

export async function onRequest(context) {
  const { request } = context;
  
  try {
    if (request.method === 'OPTIONS') {
      return createCorsOptionsResponse();
    }
    
    if (isRateLimited(request)) {
      return createErrorResponse(429, 'Too Many Requests');
    }
    
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    
    if (!URL_PATH_REGEX.test(path)) {
      return createErrorResponse(404, 'Not Found');
    }
    
    const newUrl = new URL('https://api.telegram.org');
    newUrl.pathname = path;
    
    url.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });
    
    const cleanRequest = await sanitizeRequest(request);
    const newRequest = new Request(newUrl.toString(), {
      method: cleanRequest.method,
      headers: cleanRequest.headers,
      body: cleanRequest.body,
      redirect: 'follow'
    });
    
    const response = await fetch(newRequest, {
      cf: {
        cacheEverything: false,
        cacheTtl: 60,
        minify: {
          javascript: true,
          css: true,
          html: true
        }
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return createErrorResponse(
        response.status, 
        `Telegram API Error: ${response.status} ${response.statusText}`
      );
    }
    
    return addCorsHeaders(response);
  } catch (error) {
    return createErrorResponse(500, 'Internal proxy error');
  }
}