const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-zA-Z0-9_]+)/i;

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    
    if (URL_PATH_REGEX.test(path)) {
        try {
            const newUrl = new URL(request.url);
            newUrl.hostname = 'api.telegram.org';
            newUrl.pathname = path;
            
            const newRequest = new Request(newUrl.toString(), {
                method: request.method,
                headers: request.headers,
                body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
                redirect: 'follow'
            });
            
            const response = await fetch(newRequest);
            
            const newResponse = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
            
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
            
            return newResponse;
        } catch (error) {
            return new Response(JSON.stringify({ ok: false, error: 'Proxy error' }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
    
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            }
        });
    }
    
    return new Response('Not Found', { 
        status: 404,
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}
