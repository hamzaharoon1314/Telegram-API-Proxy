//Anonymous
const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-z]+)/i;

async function handleTelegramRequest(request) {
    const url = new URL(request.url);
    url.hostname = 'api.telegram.org';
    const newRequest = new Request(url.toString(), request);
    const response = await fetch(newRequest);
    return response;
}

function handleRootRequest() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Telegram API Gateway</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a1a;
            color: #ffffff;
        }

        .container {
            text-align: center;
            padding: 2.5rem;
            background: #2d2d2d;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 90%;
            margin: 20px;
            border: 1px solid #3d3d3d;
        }

        h1 {
            color: #61dafb;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .status-badge {
            background: #2ecc71;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 50px;
            display: inline-block;
            margin-bottom: 1.5rem;
            font-weight: 500;
        }

        p {
            color: #dadada;
            line-height: 1.6;
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
        }

        .instruction {
            background: #363636;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            text-align: left;
            border-left: 4px solid #61dafb;
        }

        .creator-info {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #3d3d3d;
            font-size: 0.9rem;
            color: #888;
        }

        .creator-info a {
            color: #61dafb;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .creator-info a:hover {
            color: #ffffff;
            text-decoration: underline;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .container {
            animation: fadeIn 0.6s ease-out;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Secure Telegram API Gateway</h1>
        <div class="status-badge">System Online</div>
        <div class="instruction">
            <p>✨ Welcome to your secure Telegram API proxy service. This gateway is fully operational and ready to process your API requests securely and efficiently.</p>
        </div>
        <p>Simply replace the standard Telegram API URL with this worker's URL in your requests to begin using the service.</p>
        <div class="creator-info">
            Engineered by: <a href="https://t.me/BourseXtreme" target="_blank">BourseXtreme</a> (Anonymous)
        </div>
    </div>
</body>
</html>
    `;
    return new Response(html, {
        headers: {
            'content-type': 'text/html'
        },
    });
}

async function handle404Request() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Path Not Found</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a1a;
            color: #ffffff;
        }

        .container {
            text-align: center;
            padding: 2.5rem;
            background: #2d2d2d;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 90%;
            margin: 20px;
            border: 1px solid #3d3d3d;
        }

        h1 {
            color: #ff6b6b;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .error-code {
            background: #ff6b6b;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 50px;
            display: inline-block;
            margin-bottom: 1.5rem;
            font-weight: 500;
        }

        p {
            color: #dadada;
            line-height: 1.6;
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
        }

        .instruction {
            background: #363636;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            text-align: left;
            border-left: 4px solid #ff6b6b;
        }

        .creator-info {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #3d3d3d;
            font-size: 0.9rem;
            color: #888;
        }

        .creator-info a {
            color: #61dafb;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .creator-info a:hover {
            color: #ffffff;
            text-decoration: underline;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .container {
            animation: fadeIn 0.6s ease-out;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404 Error</h1>
        <div class="error-code">Path Not Found</div>
        <div class="instruction">
            <p>⚠️ The requested path could not be found. Please verify your request format and consult the Telegram API documentation for the correct endpoint structure.</p>
        </div>
        <p>Need help? Make sure you're using the correct API method and bot token format.</p>
        <div class="creator-info">
            Engineered by: <a href="https://t.me/BourseXtreme" target="_blank">BourseXtreme</a> (Anonymous)
        </div>
    </div>
</body>
</html>
    `;
    return new Response(html, {
        status: 404,
        headers: {
            'content-type': 'text/html'
        },
    });
}

async function handleRequest(request) {
    const { pathname } = new URL(request.url);
    
    if (URL_PATH_REGEX.test(pathname)) {
        return await handleTelegramRequest(request);
    }
    
    if (pathname === '/') {
        return handleRootRequest();
    }
    
    return handle404Request();
}

addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
});