/**
 * Cloudflare Worker — 海外 API 代理网关
 *
 * 部署到 Cloudflare Workers，为大陆服务器代理被墙的海外 API：
 *   https://your-worker.your-domain.workers.dev/groq/v1/chat/completions
 *   → https://api.groq.com/openai/v1/chat/completions
 *
 * 路由格式: /{provider}/{path}
 *
 * 零影响用户的 VPS 代理节点 — 完全独立的 CF 基础设施
 * 免费额度: 100,000 requests/day
 */

// 供应商路由映射
const PROVIDER_ROUTES = {
  // LLM Providers
  groq:        { target: 'https://api.groq.com',                               pathPrefix: '' },
  gemini:      { target: 'https://generativelanguage.googleapis.com',           pathPrefix: '' },
  openrouter:  { target: 'https://openrouter.ai',                              pathPrefix: '' },
  nvidia:      { target: 'https://integrate.api.nvidia.com',                    pathPrefix: '' },
  mistral:     { target: 'https://api.mistral.ai',                             pathPrefix: '' },
  cohere:      { target: 'https://api.cohere.com',                             pathPrefix: '' },
  manus:       { target: 'https://api.manus.im',                               pathPrefix: '' },
  huggingface: { target: 'https://api-inference.huggingface.co',               pathPrefix: '' },
  // 多媒体/工具服务
  fal:         { target: 'https://fal.run',                                     pathPrefix: '' },
  deepgram:    { target: 'https://api.deepgram.com',                           pathPrefix: '' },
  mem0:        { target: 'https://api.mem0.ai',                                pathPrefix: '' },
  cloudconvert:{ target: 'https://api.cloudconvert.com',                       pathPrefix: '' },
  // 搜索
  serpapi:     { target: 'https://serpapi.com',                                 pathPrefix: '' },
  brave:       { target: 'https://api.search.brave.com',                       pathPrefix: '' },
  // 邮件 (通过 HTTP API，非 SMTP)
  // Gmail SMTP 需要另外处理 — 建议改用国内邮件服务或 SendGrid HTTP API
};

// 认证 token — 防止被滥用
const TOKEN_PLACEHOLDER

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Auth',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'exam-master-api-proxy',
        providers: Object.keys(PROVIDER_ROUTES),
        timestamp: new Date().toISOString(),
      });
    }

    // 验证代理认证
    const proxyAuth = request.headers.get('X-Proxy-Auth') || env.WORKER_AUTH_TOKEN;
    const expectedToken = env.WORKER_AUTH_TOKEN || AUTH_TOKEN;
    if (expectedToken !== '%%WORKER_AUTH_TOKEN%%' && proxyAuth !== expectedToken) {
      return Response.json({ error: 'Unauthorized proxy request' }, { status: 401 });
    }

    // 解析路由: /{provider}/{rest-of-path}
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 1) {
      return Response.json({ error: 'Missing provider in path. Use /{provider}/{path}' }, { status: 400 });
    }

    const providerName = pathParts[0].toLowerCase();
    const route = PROVIDER_ROUTES[providerName];

    if (!route) {
      return Response.json({
        error: `Unknown provider: ${providerName}`,
        available: Object.keys(PROVIDER_ROUTES),
      }, { status: 404 });
    }

    // 构建目标 URL
    const restPath = '/' + pathParts.slice(1).join('/');
    const targetUrl = route.target + route.pathPrefix + restPath + url.search;

    // 转发请求 — 保持原始 headers (包括 Authorization)
    const headers = new Headers(request.headers);
    headers.delete('X-Proxy-Auth'); // 不转发代理认证
    headers.set('Host', new URL(route.target).host);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.body,
        // 支持流式响应 (SSE)
        ...(request.headers.get('Accept') === 'text/event-stream' ? {} : {}),
      });

      // 构建响应 — 透传所有 headers
      const respHeaders = new Headers(response.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('X-Proxy-Provider', providerName);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return Response.json({
        error: `Proxy error for ${providerName}`,
        message: err.message,
        target: targetUrl,
      }, { status: 502 });
    }
  },
};
