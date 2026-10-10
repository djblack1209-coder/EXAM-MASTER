// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLocalModelConnector, validateModelTarget } from '../../scripts/build/local-model-connector.mjs';
import { readConnectorResponse } from '@/services/learning/local-connector.js';
const servers = [];
const token = 'TEST_ONLY_local_connector_32chars_minimum';
const origin = 'http://127.0.0.1:4215';
async function listen(server) {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
afterEach(async () => {
  for (const server of servers.splice(0))
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
});
const input = (id = 'request-1') => ({
  requestId: id,
  modelId: 'isolated-model',
  shareConsent: true,
  messages: [{ role: 'user', content: '仅隔离 HTTP 验证' }],
  learningContext: {
    goal: '合成任务',
    task: { track: 'junior', stage: '初中', edition: null },
    capabilities: { evaluation: 'pending_reference', officialScore: 'verified', secret: 'UNTRUSTED_CAPABILITY_SECRET' }
  }
});
const request = (base, body = input(), headers = {}) =>
  fetch(`${base}/chat`, {
    method: 'POST',
    headers: { origin, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
describe('真实本机 HTTP 连接器与隔离上游', () => {
  it('桌面来源须精确授权，拒绝 null、其他自定义来源且仍要求令牌', async () => {
    const target = 'http://127.0.0.1:11434/v1/chat/completions';
    const connector = createLocalModelConnector({
      token,
      target,
      models: ['isolated-model'],
      allowedOrigins: ['tauri://localhost']
    });
    const base = await listen(connector);
    const health = (source, authorization = `Bearer ${token}`) =>
      fetch(`${base}/health`, {
        headers: { origin: source, authorization }
      });
    expect((await health('tauri://localhost')).status).toBe(200);
    for (const source of ['null', 'tauri://evil', 'tauri://localhost/', origin])
      expect((await health(source)).status).toBe(403);
    expect((await health('tauri://localhost', 'Bearer wrong')).status).toBe(401);
    for (const source of ['null', 'tauri://evil', 'file://localhost'])
      expect(() =>
        createLocalModelConnector({ token, target, models: ['isolated-model'], allowedOrigins: [source] })
      ).toThrow();
  });
  it('精确私网目标，不接纳公网、域名、元数据、用户名、查询或重定向入口', () => {
    expect(validateModelTarget('http://127.0.0.1:11434/v1/chat/completions').hostname).toBe('127.0.0.1');
    for (const raw of [
      'https://example.com/v1/chat/completions',
      'http://localhost/v1/chat/completions',
      'http://169.254.169.254/v1/chat/completions',
      'http://8.8.8.8/v1/chat/completions',
      'http://user@127.0.0.1/v1/chat/completions',
      'http://127.0.0.1/v1/chat/completions?endpoint=x'
    ])
      expect(() => validateModelTarget(raw)).toThrow();
  });
  it('鉴权/CORS/模型白名单/预算/幂等生效，实际 HTTP 仅调用隔离上游一次，不发连接器密钥', async () => {
    const received = [];
    let calls = 0;
    const upstream = await listen(
      createServer(async (req, res) => {
        let text = '';
        for await (const chunk of req) text += chunk;
        calls++;
        received.push({ headers: req.headers, payload: JSON.parse(text) });
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            choices: [{ message: { content: '隔离上游响应，非 AI 质量证据。' } }],
            usage: { prompt_tokens: 9, completion_tokens: 5 }
          })
        );
      })
    );
    const base = await listen(
      createLocalModelConnector({
        token,
        target: upstream + '/v1/chat/completions',
        models: ['isolated-model'],
        allowedOrigins: [origin],
        maxCalls: 1
      })
    );
    expect((await request(base, input(), { authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await request(base, input(), { origin: 'https://untrusted.invalid' })).status).toBe(403);
    expect((await request(base, { ...input(), modelId: 'not-allowed' })).status).toBe(403);
    expect((await request(base, { ...input(), endpoint: 'http://169.254.169.254' })).status).toBe(422);
    const health = await (
      await fetch(base + '/health', { headers: { origin, authorization: `Bearer ${token}` } })
    ).json();
    expect(health.data.capabilities).toMatchObject({ text: true, tools: false, vision: false });
    const [a, b] = await Promise.all([request(base), request(base)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await a.json()).data.platformQuotaCharged).toBe(0);
    expect(calls).toBe(1);
    expect(received[0].headers.authorization).toBeUndefined();
    expect(received[0].payload).toMatchObject({ model: 'isolated-model', stream: false, max_tokens: 512 });
    const background = received[0].payload.messages[0].content;
    expect(background).toContain('learning-task-v1');
    expect(background).toContain('unverified');
    expect(background).not.toContain('UNTRUSTED_CAPABILITY_SECRET');
    expect((await request(base, { ...input(), messages: [{ role: 'user', content: '变更' }] })).status).toBe(409);
    expect((await request(base, input('another'))).status).toBe(429);
    expect(calls).toBe(1);
  });
  it('失败/超时不伪造成功，重试同 ID 不再推理；前端对大响应边读边取消', async () => {
    const transport = vi.fn(
      async (_url, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
        })
    );
    const base = await listen(
      createLocalModelConnector({
        token,
        target: 'http://127.0.0.1:11434/v1/chat/completions',
        models: ['isolated-model'],
        allowedOrigins: [origin],
        timeoutMs: 30,
        transport
      })
    );
    expect((await request(base)).status).toBe(499);
    expect((await request(base)).status).toBe(499);
    expect(transport).toHaveBeenCalledOnce();
    const cancel = vi.fn();
    const reader = {
      read: vi.fn().mockResolvedValue({ done: false, value: new Uint8Array(100001) }),
      cancel,
      releaseLock: vi.fn()
    };
    await expect(readConnectorResponse({ body: { getReader: () => reader } })).rejects.toThrow('输出过长');
    expect(cancel).toHaveBeenCalledOnce();
  });
});
