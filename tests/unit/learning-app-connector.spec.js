import { captureSession } from '@/services/auth-storage.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  testLocalConnector,
  callLocalConnector,
  requestConnector,
  learningClientPlatform
} from '@/services/learning/local-connector.js';
import {
  appConnectorSupported,
  APP_CONNECTOR_PLUGIN,
  appLearningStreamSupported,
  appMaterialParseSupported,
  streamAppConnector
} from '@/services/learning/app-connector.js';
import config from '@/config/index.js';
import { learningStreamPlatform, generateLearningTurnStream } from '@/services/learning/learning-stream.js';
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
it('long material requests require the new native capability and remain limited to POST /parse', async () => {
  const call = (route = '/parse', method = 'POST', timeout = 100000) =>
    requestConnector(connection, new URL('https://connector.invalid' + route), {
      platform: 'app',
      method,
      timeout,
      body: '{}',
      limit: 10000
    });
  expect(appMaterialParseSupported()).toBe(false);
  await expect(call()).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  expect(bridge.request).not.toHaveBeenCalled();
  const caps = bridge.getCapabilities();
  bridge.getCapabilities = () => ({
    ...caps,
    materialParse: { contract: 'yozi-material-parse-v1', timeoutMs: 100000 }
  });
  expect(appMaterialParseSupported()).toBe(true);
  await call();
  expect(bridge.request.mock.calls[0][0].timeout).toBe(100000);
  for (const args of [['/chat'], ['/delete'], ['/health'], ['/parse', 'GET'], ['/parse', 'POST', 100001]])
    await expect(call(...args)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(bridge.request).toHaveBeenCalledTimes(1);
});
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

function enableStream() {
  const caps = bridge.getCapabilities();
  bridge.getCapabilities = () => ({
    ...caps,
    stream: {
      contract: 'wenli-app-stream-v1',
      chunks: 'base64',
      sequence: true,
      maxBytes: 2097152,
      maxChunks: 256,
      timeoutMs: 45000
    }
  });
  bridge.stream = vi.fn();
}
function nativeEvents(
  input,
  done,
  text,
  { complete = true, type = 'text/event-stream', status = 200, chunkSize = 7 } = {}
) {
  let sequence = 1,
    receivedBytes = 0;
  const emit = (value) => done({ id: input.id, sequence: sequence++, receivedBytes, ...value });
  emit({ kind: 'headers', status, contentType: type });
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const part = bytes.slice(i, i + chunkSize);
    receivedBytes += part.length;
    emit({ kind: 'chunk', data: Buffer.from(part).toString('base64') });
  }
  if (complete) emit({ kind: 'complete' });
}
const streamFrame = (event, id, data) => `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
function teachingFrames(body, { model = 'explicit', binding = body.requestBinding, complete = true } = {}) {
  return (
    streamFrame('start', 1, { version: 1, requestId: body.requestId, modelId: body.modelId, model }) +
    streamFrame('preview', 2, { text: '合成中文🙂，尚未执行工具', provisional: true }) +
    (complete
      ? streamFrame('result', 3, {
          success: true,
          data: {
            requestId: body.requestId,
            modelId: body.modelId,
            requestBinding: binding,
            model,
            message: '最终合成说明',
            tools: []
          }
        })
      : '')
  );
}
describe('App分块保护合同与教学完成边界', () => {
  beforeEach(enableStream);
  const url = 'https://connector.invalid/proxy-ai-stream';
  const call = (options = {}, patch = {}, address = url) =>
    streamAppConnector({ ...connection, ...patch }, address, { body: '{}', ...options });
  it.each(['contract', 'chunks', 'sequence', 'maxBytes', 'maxChunks', 'timeoutMs', 'method'])(
    '缺%s流式保护项零请求，App不能借用H5能力',
    async (field) => {
      const caps = bridge.getCapabilities();
      if (field === 'method') delete bridge.stream;
      else delete caps.stream[field];
      bridge.getCapabilities = () => caps;
      expect(appLearningStreamSupported()).toBe(false);
      expect(learningStreamPlatform()).toBe('unsupported');
      await expect(call()).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
      expect(bridge.request).not.toHaveBeenCalled();
      if (bridge.stream) expect(bridge.stream).not.toHaveBeenCalled();
    }
  );
  it('二进制桥分块有序且无WebView解码依赖，完成前不resolve', async () => {
    vi.stubGlobal('atob', undefined);
    vi.stubGlobal('TextDecoder', undefined);
    const bytes = [],
      heads = [];
    let input,
      done,
      resolved = false;
    bridge.stream.mockImplementation((i, cb) => {
      input = i;
      done = cb;
    });
    const promise = call({ onHeaders: (h) => heads.push(h), onChunk: (part) => bytes.push(...part) });
    promise.then(() => {
      resolved = true;
    });
    expect(learningStreamPlatform()).toBe('app');
    nativeEvents(input, done, '合成中文🙂\n连续  空格', { complete: false });
    await Promise.resolve();
    expect(resolved).toBe(false);
    const expected = new TextEncoder().encode('合成中文🙂\n连续  空格');
    expect(bytes).toEqual([...expected]);
    done({ id: input.id, kind: 'complete', sequence: 2 + Math.ceil(expected.length / 7), receivedBytes: bytes.length });
    expect(await promise).toMatchObject({ status: 200, receivedBytes: expected.length });
    expect(heads).toEqual([{ status: 200, contentType: 'text/event-stream' }]);
    expect(bridge.stream.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url,
      body: '{}',
      consent: true,
      timeout: 45000,
      limit: 2097152,
      allowedOrigins: connection.allowedOrigins
    });
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it.each([
    [{ consent: 1 }, {}, url, 'CONSENT_REQUIRED'],
    [{ consent: false }, {}, url, 'CONSENT_REQUIRED'],
    [{ token: 'short' }, {}, url, 'AUTH_REQUIRED'],
    [{ token: 'x'.repeat(32) + '\n' }, {}, url, 'AUTH_REQUIRED'],
    [{ allowedOrigins: [] }, {}, url, 'ENDPOINT_INVALID'],
    [{}, {}, url + '?x=1', 'ENDPOINT_INVALID'],
    [{}, {}, 'https://user@connector.invalid/proxy-ai-stream', 'ENDPOINT_INVALID'],
    [{}, {}, 'https://connector.invalid/chat', 'ENDPOINT_INVALID'],
    [{}, { timeout: 45001 }, url, 'INVALID_INPUT'],
    [{}, { limit: true }, url, 'INVALID_INPUT'],
    [{}, { body: '\ud800' }, url, 'INVALID_ENCODING']
  ])('授权/目标/预算%j在传输前拒绝', async (patch, options, address, code) => {
    await expect(call(options, patch, address)).rejects.toMatchObject({ code });
    expect(bridge.stream).not.toHaveBeenCalled();
  });
  it.each([
    ['id', 'INVALID_RESPONSE'],
    ['sequence', 'INVALID_RESPONSE'],
    ['redirect', 'REDIRECT_FORBIDDEN'],
    ['before-header', 'INVALID_RESPONSE'],
    ['duplicate-header', 'INVALID_RESPONSE'],
    ['base64', 'INVALID_RESPONSE'],
    ['padding', 'INVALID_RESPONSE'],
    ['counter', 'INVALID_RESPONSE'],
    ['complete-counter', 'INVALID_RESPONSE'],
    ['large-chunk', 'RESPONSE_LIMIT'],
    ['many-chunks', 'RESPONSE_LIMIT'],
    ['total-limit', 'RESPONSE_LIMIT'],
    ['kind', 'INVALID_RESPONSE'],
    ['unknown-error', 'CONNECTION_FAILED']
  ])('拒绝%s原生回执并只取消当前任务', async (kind, code) => {
    bridge.stream.mockImplementation((input, done) => {
      const header = {
        id: input.id,
        kind: 'headers',
        sequence: 1,
        receivedBytes: 0,
        status: 200,
        contentType: 'text/event-stream'
      };
      if (kind === 'id') return done({ ...header, id: 'wrong' });
      if (kind === 'sequence') return done({ ...header, sequence: 2 });
      if (kind === 'redirect') return done({ ...header, status: 302 });
      if (kind === 'before-header') return done({ ...header, kind: 'chunk', data: 'YQ==', receivedBytes: 1 });
      done(header);
      if (kind === 'duplicate-header') return done({ ...header, sequence: 2 });
      if (kind === 'complete-counter') return done({ ...header, sequence: 2, kind: 'complete', receivedBytes: 1 });
      if (kind === 'unknown-error') return done({ id: input.id, code: 'SYNTHETIC_PRIVATE_ERROR' });
      if (kind === 'kind') return done({ ...header, sequence: 2, kind: 'arbitrary' });
      if (kind === 'many-chunks') {
        for (let i = 1; i <= 257; i++)
          done({ id: input.id, kind: 'chunk', sequence: i + 1, data: 'YQ==', receivedBytes: i });
        return;
      }
      const bytes = kind === 'large-chunk' ? 8193 : kind === 'total-limit' ? 3 : 1;
      done({
        id: input.id,
        kind: 'chunk',
        sequence: 2,
        data: kind === 'base64' ? '!!==' : kind === 'padding' ? 'AB==' : Buffer.alloc(bytes, 97).toString('base64'),
        receivedBytes: kind === 'counter' ? 9 : bytes
      });
    });
    await expect(call(kind === 'total-limit' ? { limit: 2 } : {})).rejects.toMatchObject({ code });
    expect(bridge.cancel).toHaveBeenCalledOnce();
    expect(bridge.stream).toHaveBeenCalledOnce();
  });
  it.each(['cancel', 'timeout'])('%s后忽略所有迟到块和完成，零回退', async (reason) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetch = vi.spyOn(globalThis, 'fetch'),
      request = vi.spyOn(uni, 'request');
    let input, done;
    bridge.stream.mockImplementation((i, cb) => {
      input = i;
      done = cb;
    });
    const onChunk = vi.fn();
    const promise = call({ timeout: 20, signal: controller.signal, onChunk });
    const rejected = expect(promise).rejects.toMatchObject({ code: reason === 'cancel' ? 'CANCELLED' : 'TIMEOUT' });
    if (reason === 'cancel') controller.abort();
    else await vi.advanceTimersByTimeAsync(20);
    await rejected;
    nativeEvents(input, done, '迟到🙂');
    expect(onChunk).not.toHaveBeenCalled();
    expect(bridge.cancel).toHaveBeenCalledWith(input.id);
    expect(fetch).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it('预先取消零请求，原生异常不暴露凭据', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(call({ signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(bridge.stream).not.toHaveBeenCalled();
    bridge.stream.mockImplementation(() => {
      throw new Error(connection.token);
    });
    const error = await call().catch((e) => e);
    expect(error.code).toBe('CONNECTION_FAILED');
    expect(error.message).not.toContain(connection.token);
  });
  it('事件循环迟到的原生完成也不能绕过客户端期限', async () => {
    vi.useFakeTimers();
    let input, done;
    bridge.stream.mockImplementation((i, callback) => {
      input = i;
      done = callback;
    });
    const p = call({ timeout: 20 });
    const rejected = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    vi.setSystemTime(Date.now() + 21);
    nativeEvents(input, done, '迟到完成');
    await rejected;
    expect(bridge.cancel).toHaveBeenCalledOnce();
  });
  it('32次长中文预览仍沿原2MiB预算完成，不被短JSON错误预算截断', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'stream-app-owner');
    uni.setStorageSync('EXAM_TOKEN', connection.token);
    const previous = config.api.baseUrl;
    config.api.baseUrl = 'https://connector.invalid';
    const body = {
      requestId: 'long-synthetic-request',
      requestBinding: 'long-synthetic-binding',
      modelId: 'fixture',
      learningContext: { owner: 'stream-app-owner' },
      shareConsent: true
    };
    const preview = vi.fn();
    const value = '文'.repeat(7998) + '🙂';
    const frames =
      streamFrame('start', 1, { version: 1, requestId: body.requestId, modelId: body.modelId, model: 'explicit' }) +
      Array.from({ length: 32 }, (_, i) => streamFrame('preview', i + 2, { text: value, provisional: true })).join('') +
      streamFrame('result', 34, {
        success: true,
        data: {
          requestId: body.requestId,
          requestBinding: body.requestBinding,
          modelId: body.modelId,
          model: 'explicit',
          message: value,
          tools: []
        }
      });
    expect(new TextEncoder().encode(frames).length).toBeGreaterThan(100000);
    bridge.stream.mockImplementation((input, done) => nativeEvents(input, done, frames, { chunkSize: 8192 }));
    try {
      const result = await generateLearningTurnStream(body, {
        session: captureSession(),
        platform: 'app',
        expectedModel: 'explicit',
        onPreview: preview
      });
      expect(result.success).toBe(true);
      expect(result.data.message).toBe(value);
      expect(preview).toHaveBeenCalledTimes(32);
      expect(bridge.cancel).not.toHaveBeenCalled();
    } finally {
      config.api.baseUrl = previous;
    }
  });
  it.each(['complete', 'incomplete', 'encoding', 'wrong-model', 'wrong-binding', 'json-error', 'json-success'])(
    '原生%s教学链路沿共用SSE/模型绑定验证',
    async (kind) => {
      uni.setStorageSync('EXAM_USER_ID', 'stream-app-owner');
      uni.setStorageSync('EXAM_TOKEN', connection.token);
      const previous = config.api.baseUrl;
      config.api.baseUrl = 'https://connector.invalid';
      const body = {
        requestId: 'synthetic-request',
        requestBinding: 'synthetic-binding',
        modelId: 'fixture',
        learningContext: { owner: 'stream-app-owner' },
        shareConsent: true
      };
      const preview = vi.fn();
      bridge.stream.mockImplementation((input, done) => {
        const text =
          kind === 'encoding'
            ? Uint8Array.from([0xc3, 0x28])
            : kind.startsWith('json-')
              ? JSON.stringify({ success: kind === 'json-success', message: '合成拒绝' })
              : teachingFrames(body, {
                  complete: kind !== 'incomplete',
                  model: kind === 'wrong-model' ? 'other' : 'explicit',
                  binding: kind === 'wrong-binding' ? 'other' : body.requestBinding
                });
        nativeEvents(input, done, text, {
          type: kind.startsWith('json-') ? 'application/json' : 'text/event-stream',
          status: kind === 'json-error' ? 403 : 200
        });
      });
      try {
        const result = await generateLearningTurnStream(body, {
          session: captureSession(),
          platform: 'app',
          expectedModel: 'explicit',
          onPreview: preview
        });
        expect(result.success).toBe(kind === 'complete');
        if (kind === 'complete') {
          expect(preview).toHaveBeenCalledWith('合成中文🙂，尚未执行工具');
          expect(result.data.message).toBe('最终合成说明');
        } else if (kind !== 'json-error')
          expect(result.error).toBe(
            kind === 'encoding'
              ? 'INVALID_ENCODING'
              : kind === 'incomplete'
                ? 'INCOMPLETE_STREAM'
                : kind === 'json-success'
                  ? 'STREAM_TRANSPORT_UNAVAILABLE'
                  : 'CONTEXT_CHANGED'
          );
        expect(bridge.request).not.toHaveBeenCalled();
      } finally {
        config.api.baseUrl = previous;
      }
    }
  );
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
