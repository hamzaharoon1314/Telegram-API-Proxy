const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-zA-Z0-9_]+)/i;

const RATE_LIMITS = {
    IP: { max: 100, window: 60000 },
    TOKEN: { max: 200, window: 60000 },
    GLOBAL: { max: 5000, window: 60000 }
};

const requestCounters = {
    ip: new Map(),
    token: new Map(),
    global: { count: 0, resetTime: Date.now() + RATE_LIMITS.GLOBAL.window }
};

const tokenValidationCache = new Map();
const CACHE_TTL = 300000;

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const MAX_BODY_SIZE = 50 * 1024 * 1024;
const ALLOWED_COUNTRIES = ['PK'];
const BLOCKED_COUNTRIES = [];
const ALLOWED_USER_AGENTS = /telegram|bot|curl|postman|httpie/i;

const CACHE_CONFIGS = {
    getChatMember: { ttl: 300, edge: true },
    getMe: { ttl: 3600, edge: true },
    getUpdates: { ttl: 0, edge: false },
    sendMessage: { ttl: 0, edge: false }
};

let requestStats = {
    total: 0,
    errors: 0,
    rateLimited: 0,
    lastReset: Date.now()
};

export async function onRequest(context) {
    const { request, env } = context;
    
    try {
        cleanupExpiredData();
        
        const securityCheck = await performSecurityChecks(request, env);
        if (securityCheck.blocked) {
            return createErrorResponse(securityCheck.reason, securityCheck.status);
        }

        if (request.method === 'OPTIONS') {
            return handleCorsPreflightRequest();
        }

        const requestInfo = await parseRequest(request);
        if (!requestInfo.valid) {
            return createErrorResponse('Invalid request format', 400);
        }

        const rateLimitResult = await checkRateLimit(requestInfo.clientIP, requestInfo.botToken);
        if (rateLimitResult.limited) {
            requestStats.rateLimited++;
            return createRateLimitResponse(rateLimitResult.retryAfter);
        }

        const tokenValid = await validateBotToken(requestInfo.botToken, env);
        if (!tokenValid) {
            return createErrorResponse('Invalid bot token', 401);
        }

        const response = await proxyToTelegram(request, requestInfo);
        
        requestStats.total++;
        if (!response.ok && response.status >= 400) {
            requestStats.errors++;
        }

        return response;

    } catch (error) {
        console.error('Proxy error:', error);
        requestStats.errors++;
        return handleProxyError(error);
    }
}

function cleanupExpiredData() {
    const now = Date.now();
    
    for (const [token, data] of tokenValidationCache.entries()) {
        if (now >= data.expires) {
            tokenValidationCache.delete(token);
        }
    }
    
    if (now - requestStats.lastReset > 3600000) {
        requestStats = {
            total: 0,
            errors: 0,
            rateLimited: 0,
            lastReset: now
        };
    }
}

async function performSecurityChecks(request, env) {
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const country = request.headers.get('cf-ipcountry');

    if (!ALLOWED_METHODS.includes(request.method)) {
        return { blocked: true, reason: 'Method not allowed', status: 405 };
    }

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
        return { blocked: true, reason: 'Request too large', status: 413 };
    }

    if (ALLOWED_COUNTRIES.length > 0) {
        if (!ALLOWED_COUNTRIES.includes(country)) {
            return { blocked: true, reason: 'Geographic restriction', status: 403, country: country };
        }
    } else if (BLOCKED_COUNTRIES.length > 0) {
        if (BLOCKED_COUNTRIES.includes(country)) {
            return { blocked: true, reason: 'Geographic restriction', status: 403, country: country };
        }
    }

    if (!ALLOWED_USER_AGENTS.test(userAgent) && userAgent.length < 10) {
        return { blocked: true, reason: 'Invalid user agent', status: 403 };
    }

    const url = new URL(request.url);
    if (url.pathname.includes('..') || url.pathname.includes('<script>')) {
        return { blocked: true, reason: 'Malicious request detected', status: 400 };
    }

    return { blocked: false };
}

async function parseRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const clientIP = getClientIP(request);
    
    if (!URL_PATH_REGEX.test(path)) {
        return { valid: false };
    }
    
    const match = path.match(URL_PATH_REGEX);
    const botToken = match?.groups?.bot_token || '';
    const apiMethod = match?.groups?.api_method || '';
    
    return {
        valid: true,
        clientIP,
        botToken,
        apiMethod,
        path,
        url
    };
}

function getClientIP(request) {
    return request.headers.get('cf-connecting-ip') || 
           request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
           request.headers.get('x-real-ip') || 
           'unknown';
}

async function checkRateLimit(clientIP, botToken) {
    const now = Date.now();
    
    cleanupCounters(now);
    
    if (requestCounters.global.count >= RATE_LIMITS.GLOBAL.max) {
        const retryAfter = Math.ceil((requestCounters.global.resetTime - now) / 1000);
        return { limited: true, retryAfter };
    }
    
    const ipKey = `ip_${clientIP}`;
    const ipCount = getCounterValue(requestCounters.ip, ipKey, now);
    if (ipCount >= RATE_LIMITS.IP.max) {
        return { limited: true, retryAfter: 60 };
    }
    
    const tokenKey = `token_${botToken}`;
    const tokenCount = getCounterValue(requestCounters.token, tokenKey, now);
    if (tokenCount >= RATE_LIMITS.TOKEN.max) {
        return { limited: true, retryAfter: 60 };
    }
    
    incrementCounter(requestCounters.ip, ipKey, now);
    incrementCounter(requestCounters.token, tokenKey, now);
    requestCounters.global.count++;
    
    return { limited: false };
}

function cleanupCounters(now) {
    if (now >= requestCounters.global.resetTime) {
        requestCounters.global.count = 0;
        requestCounters.global.resetTime = now + RATE_LIMITS.GLOBAL.window;
    }
    
    for (const [key, data] of requestCounters.ip.entries()) {
        if (now >= data.resetTime) {
            requestCounters.ip.delete(key);
        }
    }
    
    for (const [key, data] of requestCounters.token.entries()) {
        if (now >= data.resetTime) {
            requestCounters.token.delete(key);
        }
    }
}

function getCounterValue(counterMap, key, now) {
    const data = counterMap.get(key);
    if (!data || now >= data.resetTime) {
        return 0;
    }
    return data.count;
}

function incrementCounter(counterMap, key, now) {
    const existing = counterMap.get(key);
    if (!existing || now >= existing.resetTime) {
        counterMap.set(key, {
            count: 1,
            resetTime: now + RATE_LIMITS.IP.window
        });
    } else {
        existing.count++;
    }
}

async function validateBotToken(token, env) {
    const cached = tokenValidationCache.get(token);
    if (cached && Date.now() < cached.expires) {
        return cached.valid;
    }
    
    try {
        if (!token || token.length < 40 || !token.includes(':')) {
            tokenValidationCache.set(token, { valid: false, expires: Date.now() + CACHE_TTL });
            return false;
        }
        
        tokenValidationCache.set(token, { valid: true, expires: Date.now() + CACHE_TTL });
        return true;
        
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
}

async function proxyToTelegram(request, requestInfo) {
    const { botToken, apiMethod, path } = requestInfo;
    
    const newUrl = new URL(request.url);
    newUrl.hostname = 'api.telegram.org';
    newUrl.pathname = path;
    
    const requestHeaders = new Headers(request.headers);
    sanitizeHeaders(requestHeaders);
    
    requestHeaders.set('Connection', 'keep-alive');
    requestHeaders.set('User-Agent', 'Cloudflare-Worker-Proxy/1.0');
    
    let requestBody;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            requestBody = await request.arrayBuffer();
        } catch (error) {
            throw new Error('Failed to read request body');
        }
    }
    
    const newRequest = new Request(newUrl.toString(), {
        method: request.method,
        headers: requestHeaders,
        body: requestBody,
        redirect: 'follow'
    });
    
    const cacheConfig = CACHE_CONFIGS[apiMethod] || { ttl: 0, edge: false };
    
    const response = await fetch(newRequest, {
        cf: {
            cacheTtl: cacheConfig.ttl,
            cacheEverything: cacheConfig.edge,
            polish: 'off',
            minify: {
                javascript: false,
                css: false,
                html: false
            }
        }
    });
    
    if (!response.ok) {
        return await handleErrorResponse(response);
    }
    
    const responseHeaders = new Headers(response.headers);
    addSecurityHeaders(responseHeaders);
    
    const responseBody = await response.arrayBuffer();
    
    return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: getCorsHeaders(responseHeaders)
    });
}

function sanitizeHeaders(headers) {
    const forbiddenHeaders = [
        'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
        'x-forwarded-for', 'x-real-ip', 'x-forwarded-proto',
        'host', 'origin', 'referer'
    ];
    
    forbiddenHeaders.forEach(header => headers.delete(header));
    
    for (const [key] of headers) {
        if (key.toLowerCase().startsWith('cf-') || key.toLowerCase().startsWith('x-')) {
            headers.delete(key);
        }
    }
    
    return headers;
}

function addSecurityHeaders(headers) {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Content-Security-Policy', "default-src 'none'");
}

function getCorsHeaders(headers = new Headers()) {
    const corsHeaders = new Headers(headers);
    corsHeaders.set('Access-Control-Allow-Origin', '*');
    corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    corsHeaders.set('Access-Control-Expose-Headers', 'X-RateLimit-Remaining, X-RateLimit-Reset');
    corsHeaders.set('Access-Control-Max-Age', '86400');
    
    return corsHeaders;
}

function handleCorsPreflightRequest() {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders()
    });
}

function createErrorResponse(message, status = 400) {
    return new Response(JSON.stringify({ 
        ok: false, 
        error: message,
        timestamp: new Date().toISOString()
    }), {
        status,
        headers: getCorsHeaders({
            'Content-Type': 'application/json'
        })
    });
}

function createRateLimitResponse(retryAfter) {
    const headers = getCorsHeaders({
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + (retryAfter * 1000)).toString()
    });
    
    return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Rate limit exceeded. Please try again later.',
        retry_after: retryAfter,
        timestamp: new Date().toISOString()
    }), {
        status: 429,
        headers
    });
}

async function handleErrorResponse(response) {
    const contentType = response.headers.get('content-type');
    let body;
    
    try {
        if (contentType && contentType.includes('application/json')) {
            body = await response.json();
        } else {
            const text = await response.text();
            body = {
                ok: false,
                error: `API Error (${response.status}): ${response.statusText}`,
                details: text
            };
        }
    } catch (error) {
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

function handleProxyError(error) {
    const errorMessage = error.message || 'Unknown error occurred';
    
    return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Proxy service temporarily unavailable',
        details: errorMessage,
        timestamp: new Date().toISOString()
    }), {
        status: 500,
        headers: getCorsHeaders({
            'Content-Type': 'application/json'
        })
    });
}
