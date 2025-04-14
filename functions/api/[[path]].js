const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-zA-Z0-9_]+)/i;

const ipRequestCounter = new Map();
const TOKEN_REQUEST_COUNTER = new Map();
const MAX_REQUESTS_PER_MINUTE = 60;
const MAX_REQUESTS_PER_TOKEN = 100;
const RESET_INTERVAL = 60000;

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    
    if (request.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }
    
    if (!URL_PATH_REGEX.test(path)) {
        return new Response('Not Found', { 
            status: 404,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
    
    const match = path.match(URL_PATH_REGEX);
    const botToken = match?.groups?.bot_token || '';
    
    if (await isRateLimited(clientIP, botToken)) {
        return new Response(JSON.stringify({ 
            ok: false, 
            error: 'Too many requests. Please try again later.' 
        }), {
            status: 429,
            headers: getCorsHeaders({
                'Content-Type': 'application/json',
                'Retry-After': '60'
            })
        });
    }
    
    try {
        const newUrl = new URL(request.url);
        newUrl.hostname = 'api.telegram.org';
        newUrl.pathname = path;
        
        const requestHeaders = new Headers(request.headers);
        sanitizeHeaders(requestHeaders);
        
        const requestBody = request.method !== 'GET' && request.method !== 'HEAD' 
            ? await request.clone().arrayBuffer() 
            : undefined;
        
        const newRequest = new Request(newUrl.toString(), {
            method: request.method,
            headers: requestHeaders,
            body: requestBody,
            redirect: 'follow'
        });
        
        const response = await fetch(newRequest, {
            cf: {
                cacheTtl: 300,
                cacheEverything: false
            }
        });
        
        if (!response.ok) {
            return await handleErrorResponse(response);
        }
        
        const responseHeaders = new Headers(response.headers);
        const responseBody = await response.arrayBuffer();
        
        return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: getCorsHeaders(responseHeaders)
        });
    } catch (error) {
        return handleProxyError();
    }
}

function sanitizeHeaders(headers) {
    const forbiddenHeaders = [
        'cf-connecting-ip',
        'cf-ipcountry',
        'cf-ray',
        'cf-visitor',
        'x-forwarded-for',
        'x-real-ip',
        'x-forwarded-proto'
    ];
    
    forbiddenHeaders.forEach(header => {
        headers.delete(header);
    });
    
    return headers;
}

function getCorsHeaders(headers = new Headers()) {
    const corsHeaders = new Headers(headers);
    corsHeaders.set('Access-Control-Allow-Origin', '*');
    corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    corsHeaders.set('Access-Control-Max-Age', '86400');
    
    return corsHeaders;
}

function handleCorsPreflightRequest() {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders()
    });
}

function handleProxyError() {
    return new Response(JSON.stringify({ 
        ok: false, 
        error: 'There was an error processing your request.' 
    }), {
        status: 500,
        headers: getCorsHeaders({
            'Content-Type': 'application/json'
        })
    });
}

async function handleErrorResponse(response) {
    const contentType = response.headers.get('content-type');
    let body;
    
    if (contentType && contentType.includes('application/json')) {
        body = await response.json();
    } else {
        body = {
            ok: false,
            error: `API Error (${response.status}): ${response.statusText}`
        };
    }
    
    return new Response(JSON.stringify(body), {
        status: response.status,
        headers: getCorsHeaders({
            'Content-Type': 'application/json'
        })
    });
}

async function isRateLimited(clientIP, botToken) {
    incrementRequestCount(ipRequestCounter, clientIP);
    incrementRequestCount(TOKEN_REQUEST_COUNTER, botToken);
    
    const ipRequests = ipRequestCounter.get(clientIP) || 0;
    const tokenRequests = TOKEN_REQUEST_COUNTER.get(botToken) || 0;
    
    setupResetInterval();
    
    return ipRequests > MAX_REQUESTS_PER_MINUTE || 
           tokenRequests > MAX_REQUESTS_PER_TOKEN;
}

function incrementRequestCount(counter, key) {
    const currentCount = counter.get(key) || 0;
    counter.set(key, currentCount + 1);
}

let resetIntervalId = null;
function setupResetInterval() {
    if (resetIntervalId === null) {
        resetIntervalId = setInterval(() => {
            ipRequestCounter.clear();
            TOKEN_REQUEST_COUNTER.clear();
        }, RESET_INTERVAL);
    }
}