const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
];

export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);
    const originBase = env.ORIGIN_BASE_URL || 'http://101.43.41.96';
    const originUrl = new URL(originBase);

    if (incomingUrl.pathname === '/__edge-health') {
      return Response.json({
        status: 'ok',
        service: 'exam-master-origin-proxy',
        origin: originUrl.origin
      });
    }

    originUrl.pathname = incomingUrl.pathname;
    originUrl.search = incomingUrl.search;

    if (incomingUrl.pathname === '/__origin-check') {
      originUrl.pathname = '/health-check';
      originUrl.search = '';
    }

    const headers = new Headers(request.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      headers.delete(header);
    }
    for (const header of [...headers.keys()]) {
      if (header.toLowerCase().startsWith('cf-')) {
        headers.delete(header);
      }
    }
    headers.delete('X-Real-IP');
    headers.delete('X-Forwarded-For');
    headers.set('Host', env.ORIGIN_HOST || originUrl.host);
    headers.set('X-Forwarded-Host', incomingUrl.hostname);
    headers.set('X-Forwarded-Proto', originUrl.protocol.replace(':', ''));

    const init = {
      method: request.method,
      headers,
      redirect: 'manual'
    };

    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
    }

    const originRequest = new Request(originUrl.toString(), init);
    const response = await fetch(originRequest);
    if (incomingUrl.pathname === '/__origin-check') {
      return Response.json({
        target: originUrl.toString(),
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        server: response.headers.get('server'),
        location: response.headers.get('location'),
        body: await response.text()
      });
    }

    const responseHeaders = new Headers(response.headers);
    for (const header of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(header);
    }
    const location = responseHeaders.get('Location');
    if (location) {
      const rewrittenLocation = location
        .replaceAll('https://nf98ia8qnt.sealosbja.site', incomingUrl.origin)
        .replaceAll('https://exam.245334.xyz', incomingUrl.origin);
      responseHeaders.set('Location', rewrittenLocation);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  }
};
