import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import LearningPage from '@/pages/learning/index.vue';
import {
  requestConnector,
  testLocalConnector,
  callLocalConnector,
  learningClientPlatform,
  WEIXIN_CONNECTOR_ORIGIN
} from '@/services/learning/local-connector.js';
import {
  testMaterialConnector,
  parseConnectedMaterial,
  deleteConnectedMaterial,
  chooseWeixinMaterialFile,
  readWeixinMaterialFile
} from '@/services/learning/material-connector.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const connection = {
  endpoint: 'https://connector.invalid/chat',
  allowedOrigins: ['https://connector.invalid'],
  token: 'TEST_ONLY_native_connector_token_32_chars',
  consent: true,
  model: 'isolated-model'
};
const materialConnection = { ...connection, endpoint: 'https://connector.invalid/parse' };
const options = { platform: 'weixin' };
const fileId = 'a'.repeat(64);
const stat =
  (size = 4, lastModifiedTime = 100) =>
  (o) =>
    o.success({ stats: { size, lastModifiedTime, isFile: () => true } });
let requests;
function setupRuntime({ SDKVersion = '3.2.2', platform = 'ios', chunked = true } = {}) {
  requests = [];
  const runtime = {
    getAppBaseInfo: () => ({ SDKVersion }),
    getDeviceInfo: () => ({ platform }),
    canIUse: () => chunked,
    requirePrivacyAuthorize: vi.fn((o) => o.success({})),
    chooseMessageFile: vi.fn(),
    getFileSystemManager: vi.fn(),
    request: vi.fn((input) => {
      const hooks = {};
      const task = {
        abort: vi.fn(),
        onHeadersReceived: (fn) => {
          hooks.headers = fn;
        },
        onChunkReceived: (fn) => {
          hooks.chunks = fn;
        }
      };
      requests.push({ input, task, hooks });
      return task;
    })
  };
  vi.stubGlobal('wx', runtime);
  return runtime;
}
function respond(index, data, statusCode = 200, split = 7) {
  const r = requests[index],
    bytes = new TextEncoder().encode(JSON.stringify(data));
  r.hooks.headers({ header: { 'Content-Type': 'application/json' }, statusCode });
  for (let i = 0; i < bytes.length; i += split) r.hooks.chunks({ data: bytes.slice(i, i + split).buffer });
  r.input.success({ statusCode, data: new ArrayBuffer(0) });
}
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  setupRuntime();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('微信连接器保留鉴权/授权/重定向/容量/生命周期合同', () => {
  it.each([
    ['3.2.1', 'ios', true],
    ['3.2.2', 'windows', true],
    ['3.2.2', 'mac', true],
    ['3.2.2', 'ios', false],
    ['bad', 'ios', true]
  ])('SDK=%s、平台=%s缺受保护传输时不发送令牌或请求', async (SDKVersion, platform, chunked) => {
    const wx = setupRuntime({ SDKVersion, platform, chunked });
    await expect(testLocalConnector(connection, options)).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
    expect(wx.request).not.toHaveBeenCalled();
  });
  it('H5/App选择不被微信客户端可用性冒充；App不静默用fetch', async () => {
    expect(learningClientPlatform()).toBe('weixin');
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(testMaterialConnector(materialConnection, { platform: 'app' })).rejects.toMatchObject({
      code: 'PLATFORM_UNSUPPORTED'
    });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
  it('明确目标/访问令牌/共享授权不合法时零请求；操作路径不能伪造', async () => {
    for (const patch of [{ consent: false }, { token: 'short' }, { allowedOrigins: ['https://other.invalid'] }])
      await expect(testLocalConnector({ ...connection, ...patch }, options)).rejects.toThrow();
    await expect(
      requestConnector(connection, new URL('https://connector.invalid/arbitrary'), options)
    ).rejects.toMatchObject({ code: 'ENDPOINT_INVALID' });
    expect(requests).toHaveLength(0);
  });
  it('健康仅鉴权/能力，不调用模型；UTF8分块，固定Origin与禁止重定向保持', async () => {
    const p = testLocalConnector(connection, options);
    expect(requests[0].input).toMatchObject({
      url: 'https://connector.invalid/health',
      method: 'GET',
      redirect: 'manual',
      enableChunked: true,
      header: { Origin: WEIXIN_CONNECTOR_ORIGIN, Authorization: `Bearer ${connection.token}` }
    });
    respond(
      0,
      {
        success: true,
        data: {
          models: ['isolated-model'],
          capabilities: { text: true, tools: false },
          upstreamReachability: 'not_tested',
          name: '中文健康检查'
        }
      },
      200,
      1
    );
    expect((await p).upstreamReachability).toBe('not_tested');
    expect(requests).toHaveLength(1);
  });
  it('文本响应即使带工具或自封核验也只能成为本地文本，不执行工具或扣平台额度', async () => {
    const p = callLocalConnector(
      connection,
      {
        requestId: 'same-id',
        requestBinding: 'cloud-only-binding',
        learningContext: { owner: 'must-not-leave-device', goal: '合成目标', unknown: 'not-in-contract' },
        shareConsent: true,
        messages: [{ role: 'user', content: '仅合成任务' }]
      },
      options
    );
    expect(JSON.parse(requests[0].input.data)).toMatchObject({ requestId: 'same-id', modelId: 'isolated-model' });
    expect(JSON.parse(requests[0].input.data)).not.toHaveProperty('requestBinding');
    expect(JSON.parse(requests[0].input.data).learningContext).toEqual({ goal: '合成目标' });
    respond(0, {
      success: true,
      data: { message: '中文合成回应', tools: [{ name: 'learning.submit' }], question: { verified: true } }
    });
    expect(await p).toMatchObject({
      success: true,
      data: { message: '中文合成回应', tools: [], question: null, model: 'isolated-model', source: 'local' }
    });
  });
  it('3xx和Location响应头立即拒绝且中止，不发第二请求', async () => {
    const p = testLocalConnector(connection, options),
      rejected = expect(p).rejects.toMatchObject({ code: 'REDIRECT_FORBIDDEN' });
    requests[0].hooks.headers({ statusCode: 302, header: { Location: 'https://other.invalid/receive-token' } });
    await rejected;
    expect(requests[0].task.abort).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
  });
  it('缺失原生响应接口、无头重定向或正文未完整结束时拒绝并中止', async () => {
    const abort = vi.fn();
    wx.request.mockReturnValueOnce({ abort });
    await expect(testLocalConnector(connection, options)).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
    expect(abort).toHaveBeenCalledOnce();
    let p = testLocalConnector(connection, options),
      rejected = expect(p).rejects.toMatchObject({ code: 'REDIRECT_FORBIDDEN' });
    requests[0].input.success({ statusCode: 307, data: new ArrayBuffer(0) });
    await rejected;
    p = testLocalConnector(connection, options);
    rejected = expect(p).rejects.toMatchObject({ code: 'INCOMPLETE_STREAM' });
    requests[1].hooks.chunks({ data: new Uint8Array([0xe4]).buffer });
    requests[1].input.success({ statusCode: 200, data: new ArrayBuffer(0) });
    await rejected;
  });
  it('声明或实际超限响应均中止；无头的UTF8攻击不能被替换为成功正文', async () => {
    let p = testLocalConnector(connection, options);
    let rejected = expect(p).rejects.toMatchObject({ code: 'RESPONSE_LIMIT' });
    requests[0].hooks.headers({ header: { 'Content-Length': '100001' }, statusCode: 200 });
    await rejected;
    expect(requests[0].task.abort).toHaveBeenCalledOnce();
    p = testLocalConnector(connection, options);
    rejected = expect(p).rejects.toMatchObject({ code: 'RESPONSE_LIMIT' });
    requests[1].hooks.chunks({ data: new ArrayBuffer(100001) });
    await rejected;
    p = testLocalConnector(connection, options);
    rejected = expect(p).rejects.toMatchObject({ code: 'INVALID_ENCODING' });
    requests[2].hooks.chunks({ data: new Uint8Array([0xc0, 0x80]).buffer });
    await rejected;
  });
  it('取消前零请求，取消中中止任务；迟到success不改变结果', async () => {
    const early = new AbortController();
    early.abort();
    await expect(testLocalConnector(connection, { ...options, signal: early.signal })).rejects.toMatchObject({
      code: 'CANCELLED'
    });
    expect(requests).toHaveLength(0);
    const c = new AbortController(),
      p = testLocalConnector(connection, { ...options, signal: c.signal }),
      rejected = expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
    c.abort();
    await rejected;
    requests[0].input.success({ statusCode: 200, data: new TextEncoder().encode('{}').buffer });
    expect(requests[0].task.abort).toHaveBeenCalledOnce();
  });
  it('原生正文停滞达到原5000ms健康预算即中止，不自动重试', async () => {
    vi.useFakeTimers();
    const p = testLocalConnector(connection, options),
      rejected = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    requests[0].hooks.headers({ statusCode: 200, header: {} });
    await vi.advanceTimersByTimeAsync(5001);
    await rejected;
    expect(requests[0].task.abort).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
  });
  it('资料分段/原件目标/识别许可/原件删除均用同一原生受限通道', async () => {
    const health = testMaterialConnector(materialConnection, options);
    respond(0, { success: true, data: { version: 'isolated-parser', pdfText: true } });
    expect((await health).pdfText).toBe(true);
    const batches = [],
      p = parseConnectedMaterial(
        materialConnection,
        { size: 4, name: 'sample.pdf', contentBase64: 'dGVzdA==', allowRecognition: false },
        { ...options, onBatch: (m) => batches.push(m) }
      );
    expect(JSON.parse(requests[1].input.data).allowOCR).toBe(false);
    respond(1, {
      success: true,
      data: {
        scope: 'private',
        id: fileId,
        totalPages: 1,
        nextPage: null,
        original: { connectorFileId: fileId },
        segments: [{ id: 'page1', content: '合成资料' }]
      }
    });
    const parsed = await p;
    expect(batches).toHaveLength(1);
    expect(parsed.results[0].original.connectorOrigin).toBe('https://connector.invalid');
    const deleted = deleteConnectedMaterial(
      materialConnection,
      { fileId, connectorOrigin: 'https://connector.invalid' },
      options
    );
    respond(2, { success: true, data: { deleted: true, fileId } });
    expect((await deleted).deleted).toBe(true);
    await expect(
      deleteConnectedMaterial(materialConnection, { fileId, connectorOrigin: 'https://other.invalid' }, options)
    ).rejects.toMatchObject({ code: 'TARGET_MISMATCH' });
    expect(requests).toHaveLength(3);
  });
  it('真实Store账户切换取消资料请求，迟到合成片段不能写入新账户', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'first-owner');
    const store = useConversationLearningStore();
    store.materialConnection = { ...materialConnection };
    const p = store.importFile({ size: 4, name: 'sample.pdf', contentBase64: 'dGVzdA==' }),
      rejected = expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
    uni.setStorageSync('EXAM_USER_ID', 'second-owner');
    store.refresh();
    await rejected;
    respond(0, {
      success: true,
      data: { scope: 'private', segments: [{ id: 'page1', content: '旧账户片段' }], totalPages: 1 }
    });
    expect(store.state.materials).toHaveLength(0);
    expect(store.materialConnection).toBeNull();
    store.$dispose();
  });
});
describe('微信Store的完整文本发送', () => {
  it('投影到既有本地合同，成功后才记推理状态；账户标识未外发', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'native-model-owner');
    const store = useConversationLearningStore();
    store.start('理解概念');
    store.localConnection = { ...connection, status: 'connector_verified' };
    store.selectedMode = 'local';
    store.sharingAllowed = true;
    const p = store.send('请解释一种独立学习方法');
    await flushPromises();
    expect(requests).toHaveLength(1);
    const payload = JSON.parse(requests[0].input.data);
    expect(Object.keys(payload).sort()).toEqual([
      'learningContext',
      'messages',
      'modelId',
      'requestId',
      'shareConsent'
    ]);
    expect(payload.learningContext).not.toHaveProperty('owner');
    expect(store.localConnection.status).toBe('connector_verified');
    respond(0, { success: true, data: { message: '先独立作答，再对照依据。' } });
    await p;
    expect(store.localConnection.status).toBe('model_verified');
    expect(store.active.messages.at(-1).content).toBe('先独立作答，再对照依据。');
    expect(store.state.attempts).toHaveLength(0);
    store.$dispose();
  });
});
describe('微信文件权限与逐次发送许可', () => {
  it('对话页复用真实隐私弹窗，同意有匹配buttonId；离开拒绝待决授权', async () => {
    let authorize, currentResolve;
    wx.onNeedPrivacyAuthorization = vi.fn((fn) => {
      authorize = fn;
    });
    wx.offNeedPrivacyAuthorization = vi.fn();
    const wrapper = mount(LearningPage, {
      global: {
        stubs: {
          LearningShell: { template: '<div><slot /></div>' },
          WdPopup: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          BaseIcon: true,
          LearningOverview: true,
          NumberLine: true
        }
      }
    });
    expect(wrapper.findComponent(PrivacyPopup).exists()).toBe(true);
    currentResolve = vi.fn();
    authorize(currentResolve);
    await flushPromises();
    expect(wrapper.find('#agree-btn').attributes('open-type')).toBe('agreePrivacyAuthorization');
    await wrapper.find('#agree-btn').trigger('agreeprivacyauthorization');
    expect(currentResolve).toHaveBeenCalledWith({ buttonId: 'agree-btn', event: 'agree' });
    currentResolve = vi.fn();
    authorize(currentResolve);
    await flushPromises();
    wrapper.unmount();
    expect(currentResolve).toHaveBeenCalledWith({ buttonId: 'reject-btn', event: 'disagree' });
    expect(wx.offNeedPrivacyAuthorization).toHaveBeenCalledWith(authorize);
    expect(requests).toHaveLength(0);
  });
  it('先微信隐私授权与选择，未发送确认前不读文件；许可后只读选定有界字节', async () => {
    const wx = globalThis.wx;
    wx.chooseMessageFile.mockImplementation((o) =>
      o.success({ tempFiles: [{ name: 'test.pdf', path: 'wxfile://synthetic', size: 4 }] })
    );
    const read = vi.fn((o) => o.success({ data: 'dGVzdA==' }));
    wx.getFileSystemManager.mockReturnValue({ readFile: read, stat: stat() });
    const file = await chooseWeixinMaterialFile();
    expect(wx.requirePrivacyAuthorize).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    await expect(readWeixinMaterialFile(file)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(await readWeixinMaterialFile(file, { consent: true })).toEqual({
      name: 'test.pdf',
      size: 4,
      contentBase64: 'dGVzdA=='
    });
    expect(read.mock.calls[0][0]).toMatchObject({
      filePath: 'wxfile://synthetic',
      encoding: 'base64',
      position: 0,
      length: 4
    });
    expect(requests).toHaveLength(0);
  });
  it('隐私拒绝、超大文件、选择/读取中归属改变及编码变化均不发送', async () => {
    const wx = globalThis.wx;
    wx.requirePrivacyAuthorize.mockImplementation((o) => o.fail({}));
    await expect(chooseWeixinMaterialFile()).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(wx.chooseMessageFile).not.toHaveBeenCalled();
    wx.requirePrivacyAuthorize.mockImplementation((o) => o.success({}));
    wx.chooseMessageFile.mockImplementation((o) =>
      o.success({ tempFiles: [{ name: 'large.pdf', path: 'wxfile://large', size: 10485761 }] })
    );
    await expect(chooseWeixinMaterialFile()).rejects.toMatchObject({ code: 'FILE_LIMIT' });
    let owner = 'a';
    wx.chooseMessageFile.mockImplementation((o) => {
      owner = 'b';
      o.success({ tempFiles: [{ name: 'test.pdf', path: 'wxfile://synthetic', size: 4 }] });
    });
    const current = () => {
      if (owner !== 'a') throw Object.assign(new Error('归属已变化'), { code: 'OWNER_MISMATCH' });
    };
    await expect(chooseWeixinMaterialFile(current)).rejects.toMatchObject({ code: 'OWNER_MISMATCH' });
    owner = 'a';
    wx.getFileSystemManager.mockReturnValue({
      stat: stat(),
      readFile: (o) => {
        owner = 'b';
        o.success({ data: 'dGVzdA==' });
      }
    });
    await expect(
      readWeixinMaterialFile(
        { size: 4, path: 'wxfile://synthetic', name: 'test.pdf' },
        { consent: true, assertCurrent: current }
      )
    ).rejects.toMatchObject({ code: 'OWNER_MISMATCH' });
    wx.getFileSystemManager.mockReturnValue({ readFile: (o) => o.success({ data: 'broken' }), stat: stat() });
    await expect(
      readWeixinMaterialFile({ size: 4, path: 'wxfile://synthetic', name: 'test.pdf' }, { consent: true })
    ).rejects.toMatchObject({ code: 'FILE_CHANGED' });
    expect(requests).toHaveLength(0);
  });
  it('大小变化在读取前拒绝，同长编码和读取中修改也不能成为已许可文件', async () => {
    const file = { size: 4, path: 'wxfile://synthetic', name: 'test.pdf' },
      read = vi.fn((o) => o.success({ data: 'dGVzdA==' }));
    wx.getFileSystemManager.mockReturnValue({ readFile: read, stat: stat(5) });
    await expect(readWeixinMaterialFile(file, { consent: true })).rejects.toMatchObject({ code: 'FILE_CHANGED' });
    expect(read).not.toHaveBeenCalled();
    wx.getFileSystemManager.mockReturnValue({ readFile: (o) => o.success({ data: 'dGVzdGU=' }), stat: stat() });
    await expect(readWeixinMaterialFile(file, { consent: true })).rejects.toMatchObject({ code: 'FILE_CHANGED' });
    wx.getFileSystemManager.mockReturnValue({
      readFile: read,
      stat: vi.fn().mockImplementationOnce(stat()).mockImplementationOnce(stat(4, 101))
    });
    await expect(readWeixinMaterialFile(file, { consent: true })).rejects.toMatchObject({ code: 'FILE_CHANGED' });
    expect(requests).toHaveLength(0);
  });
});
