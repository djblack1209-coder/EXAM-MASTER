import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  testLocalConnector,
  callLocalConnector,
  requestConnector,
  learningClientPlatform
} from '@/services/learning/local-connector.js';
import { appConnectorSupported, APP_CONNECTOR_PLUGIN } from '@/services/learning/app-connector.js';
import {
  testMaterialConnector,
  parseConnectedMaterial,
  deleteConnectedMaterial
} from '@/services/learning/material-connector.js';

const connection = {
  endpoint: 'https://connector.invalid/chat',
  allowedOrigins: ['https://connector.invalid'],
  token: 'TEST_ONLY_APP_CONNECTOR_TOKEN_32_CHARS',
  consent: true,
  model: 'isolated-model'
};
let bridge;
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.stubGlobal('plus', { os: { name: 'Android' } });
  bridge = {
    getCapabilities: () => ({
      contract: 'wenli-app-connector-v1',
      redirect: 'reject',
      responseLimit: 'bytes',
      utf8: 'strict',
      tls: 'system',
      cancel: true
    }),
    request: vi.fn((input, callback) => {
      const body = JSON.stringify({
        success: true,
        data: { models: ['isolated-model'], capabilities: { text: true }, upstreamReachability: 'not_tested' }
      });
      callback({ id: input.id, status: 200, body, receivedBytes: new TextEncoder().encode(body).byteLength });
    }),
    cancel: vi.fn()
  };
  uni.requireNativePlugin = vi.fn(() => bridge);
});
afterEach(() => {
  delete uni.requireNativePlugin;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('App专用原生连接器入口', () => {
  it.each(['load', 'capabilities', 'request', 'json'])('原生%s失败不暴露桥异常或正文中的凭据', async (kind) => {
    const marker = 'SYNTHETIC_PRIVATE_ERROR_DO_NOT_EXPOSE';
    if (kind === 'load')
      uni.requireNativePlugin.mockImplementation(() => {
        throw new Error(marker);
      });
    if (kind === 'capabilities')
      bridge.getCapabilities = () => {
        throw new Error(marker);
      };
    if (kind === 'request')
      bridge.request.mockImplementation(() => {
        throw new Error(marker);
      });
    if (kind === 'json')
      bridge.request.mockImplementation((input, done) =>
        done({ id: input.id, status: 200, body: marker, receivedBytes: marker.length })
      );
    const error = await testLocalConnector(connection, { platform: 'app' }).catch((e) => e);
    expect(error.code).toBe(
      ['load', 'capabilities'].includes(kind)
        ? 'PLATFORM_UNSUPPORTED'
        : kind === 'json'
          ? 'INVALID_RESPONSE'
          : 'CONNECTION_FAILED'
    );
    expect(error.message).not.toContain(marker);
    if (['load', 'capabilities'].includes(kind)) expect(bridge.request).not.toHaveBeenCalled();
  });
  it('已装受保护原生模块时真实调用其健康方法，不能静默回退fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect((await testLocalConnector(connection, { platform: 'app' })).upstreamReachability).toBe('not_tested');
    expect(bridge.request).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['contract', 'redirect', 'responseLimit', 'utf8', 'tls', 'cancel'])(
    '%s保护合同缺失必须零请求',
    async (field) => {
      const caps = bridge.getCapabilities();
      delete caps[field];
      bridge.getCapabilities = () => caps;
      expect(appConnectorSupported()).toBe(false);
      await expect(testLocalConnector(connection, { platform: 'app' })).rejects.toMatchObject({
        code: 'PLATFORM_UNSUPPORTED'
      });
      expect(bridge.request).not.toHaveBeenCalled();
    }
  );
  it('App平台与模块缺失拒绝，不由fetch/uni.request替代', async () => {
    expect(learningClientPlatform()).toBe('app');
    expect(appConnectorSupported()).toBe(true);
    expect(uni.requireNativePlugin).toHaveBeenCalledWith(APP_CONNECTOR_PLUGIN);
    uni.requireNativePlugin.mockReturnValue(null);
    await expect(testLocalConnector(connection, { platform: 'app' })).rejects.toMatchObject({
      code: 'PLATFORM_UNSUPPORTED'
    });
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it('保留原目标、访问令牌和逐次授权校验，桥接仅固定字段', async () => {
    for (const patch of [{ consent: false }, { token: 'short' }, { allowedOrigins: ['https://other.invalid'] }])
      await expect(testLocalConnector({ ...connection, ...patch }, { platform: 'app' })).rejects.toThrow();
    await expect(
      requestConnector(connection, new URL('https://connector.invalid/other'), { platform: 'app' })
    ).rejects.toMatchObject({ code: 'ENDPOINT_INVALID' });
    expect(bridge.request).not.toHaveBeenCalled();
    await testLocalConnector(connection, { platform: 'app' });
    const arg = bridge.request.mock.calls[0][0];
    expect(arg).toMatchObject({
      url: 'https://connector.invalid/health',
      method: 'GET',
      consent: true,
      timeout: 5000,
      limit: 100000
    });
    expect(Object.keys(arg).sort()).toEqual([
      'allowedOrigins',
      'consent',
      'id',
      'limit',
      'method',
      'timeout',
      'token',
      'url'
    ]);
  });
  it.each([
    [{ status: 302 }, 'REDIRECT_FORBIDDEN'],
    [{ code: 'REDIRECT_FORBIDDEN' }, 'REDIRECT_FORBIDDEN'],
    [{ id: 'other' }, 'INVALID_RESPONSE'],
    [{ receivedBytes: 9999999 }, 'RESPONSE_LIMIT'],
    [{ receivedBytes: 1 }, 'INVALID_RESPONSE'],
    [{ body: '\ud800', receivedBytes: 3 }, 'INVALID_ENCODING'],
    [{ status: 0 }, 'INVALID_RESPONSE'],
    [{ code: 'unknown' }, 'CONNECTION_FAILED']
  ])('拒绝异常原生响应%j并仅取消本请求', async (patch, code) => {
    bridge.request.mockImplementation((input, callback) => {
      const body = '{}';
      callback({ id: input.id, status: 200, body, receivedBytes: 2, ...patch });
    });
    await expect(testLocalConnector(connection, { platform: 'app' })).rejects.toMatchObject({ code });
    expect(bridge.cancel).toHaveBeenCalledOnce();
    expect(bridge.request).toHaveBeenCalledOnce();
  });
  it('原生不合法JSON拒绝，错误正文/令牌不保存为学习事实', async () => {
    bridge.request.mockImplementation((input, callback) =>
      callback({ id: input.id, status: 200, body: 'x', receivedBytes: 1 })
    );
    await expect(testLocalConnector(connection, { platform: 'app' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE'
    });
  });
  it('预先取消零请求；在途取消中止对应原生任务且迟到结果无效', async () => {
    const early = new AbortController();
    early.abort();
    await expect(testLocalConnector(connection, { platform: 'app', signal: early.signal })).rejects.toMatchObject({
      code: 'CANCELLED'
    });
    expect(bridge.request).not.toHaveBeenCalled();
    const pending = new AbortController();
    let done, input;
    bridge.request.mockImplementation((i, callback) => {
      input = i;
      done = callback;
    });
    const result = testLocalConnector(connection, { platform: 'app', signal: pending.signal });
    const rejected = expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    pending.abort();
    await rejected;
    done({ id: input.id, status: 200, body: '{}', receivedBytes: 2 });
    expect(bridge.cancel).toHaveBeenCalledWith(input.id);
  });
  it('客户端硬超时取消原生请求，没有重试或云回退', async () => {
    vi.useFakeTimers();
    bridge.request.mockImplementation(() => {});
    const p = testLocalConnector(connection, { platform: 'app' });
    const reject = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5000);
    await reject;
    expect(bridge.request).toHaveBeenCalledOnce();
    expect(bridge.cancel).toHaveBeenCalledOnce();
  });
  it('原生文本保留当前型号和背景投影，不能自封核验或执行工具', async () => {
    bridge.request.mockImplementation((input, callback) => {
      const body = JSON.stringify({
        success: true,
        data: { message: '中文与🙂合成回应', tools: [{ name: 'learning.submit' }], question: { verified: true } }
      });
      callback({ id: input.id, status: 200, body, receivedBytes: new TextEncoder().encode(body).byteLength });
    });
    const result = await callLocalConnector(
      connection,
      {
        requestId: 'same-business-id',
        requestBinding: 'must-not-leave',
        learningContext: { goal: '合成目标', owner: 'private-owner', unknown: 'omit' },
        shareConsent: true,
        messages: [{ role: 'user', content: '合成文本' }]
      },
      { platform: 'app' }
    );
    expect(result.data).toMatchObject({ tools: [], question: null, source: 'local', model: 'isolated-model' });
    const body = JSON.parse(bridge.request.mock.calls[0][0].body);
    expect(body.requestId).toBe('same-business-id');
    expect(body.learningContext).toEqual({ goal: '合成目标' });
    expect(body.requestBinding).toBeUndefined();
  });
  it('资料健康、继续已有原件解析及确认删除沿同一原生传输，不新增文件权限', async () => {
    const material = { ...connection, endpoint: 'https://connector.invalid/parse' },
      fileId = 'a'.repeat(64);
    bridge.request.mockImplementation((input, callback) => {
      const data = input.url.endsWith('/health')
        ? { version: 'fixture' }
        : input.url.endsWith('/delete')
          ? { deleted: true, fileId }
          : {
              id: fileId,
              scope: 'private',
              segments: [],
              original: { connectorFileId: fileId },
              totalPages: 1,
              nextPage: null
            };
      const body = JSON.stringify({ success: true, data });
      callback({ id: input.id, status: 200, body, receivedBytes: new TextEncoder().encode(body).byteLength });
    });
    expect((await testMaterialConnector(material, { platform: 'app' })).version).toBe('fixture');
    const parsed = await parseConnectedMaterial(
      material,
      { fileId, name: '合成.pdf', size: 10, allowRecognition: false },
      { platform: 'app' }
    );
    expect(parsed.results[0].recognitionAllowed).toBe(false);
    expect(
      (
        await deleteConnectedMaterial(
          material,
          { fileId, connectorOrigin: 'https://connector.invalid' },
          { platform: 'app' }
        )
      ).deleted
    ).toBe(true);
    expect(bridge.request.mock.calls.map(([i]) => new URL(i.url).pathname)).toEqual(['/health', '/parse', '/delete']);
  });
  it('实际Store沿App宿主发送投影，成功回复才记模型状态且不执行工具/判分', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'synthetic-app-owner');
    const store = useConversationLearningStore();
    store.start('合成学习');
    store.localConnection = { ...connection, status: 'connector_verified' };
    store.selectedMode = 'local';
    store.sharingAllowed = true;
    bridge.request.mockImplementation((input, done) => {
      const body = JSON.stringify({
        success: true,
        data: { message: '合成App文本回复', tools: [{ name: 'learning.submit' }], question: { verified: true } }
      });
      done({ id: input.id, status: 200, body, receivedBytes: new TextEncoder().encode(body).byteLength });
    });
    try {
      await store.send('合成问题');
      expect(bridge.request).toHaveBeenCalledOnce();
      const payload = JSON.parse(bridge.request.mock.calls[0][0].body);
      expect(payload.learningContext).not.toHaveProperty('owner');
      expect(payload).not.toHaveProperty('requestBinding');
      expect(store.localConnection.status).toBe('model_verified');
      expect(store.active.messages.at(-1).content).toBe('合成App文本回复');
      expect(store.state.attempts).toHaveLength(0);
      expect(store.state.questions).toHaveLength(0);
    } finally {
      store.$dispose();
    }
  });
});
