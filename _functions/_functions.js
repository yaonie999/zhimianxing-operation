export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  
  // 只代理 /api/* 路径
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  const TARGET_HOST = 'zhimianxing-operation-api.onrender.com';
  const targetPath = url.pathname.replace('/api/', '/api/');
  const targetUrl = `https://${TARGET_HOST}${targetPath}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  }
  headers.set('Host', TARGET_HOST);
  headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) 
        ? await request.text() 
        : undefined,
    });

    const body = await response.text();
    const newHeaders = new Headers();
    newHeaders.set('Content-Type', 'application/json');
    newHeaders.set('Access-Control-Allow-Origin', url.origin);
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
    newHeaders.set('Access-Control-Max-Age', '86400');
    // 保留原始响应头
    for (const [key, value] of response.headers) {
      if (!['content-type', 'access-control-allow-origin', 'access-control-allow-methods', 
           'access-control-allow-headers', 'access-control-allow-credentials', 
           'access-control-max-age', 'content-length'].includes(key.toLowerCase())) {
        newHeaders.set(key, value);
      }
    }

    return new Response(body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 503, msg: '服务暂时不可用，请稍后重试' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}