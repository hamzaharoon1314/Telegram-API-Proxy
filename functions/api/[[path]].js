const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-z]+)/i;

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
  
    if (URL_PATH_REGEX.test(path)) {
        const newUrl = new URL(request.url);
        newUrl.hostname = 'api.telegram.org';
        newUrl.pathname = path;
        const newRequest = new Request(newUrl.toString(), request);
        const response = await fetch(newRequest);
        return response;
    }
  
    return new Response('Not Found', { status: 404 });
}
