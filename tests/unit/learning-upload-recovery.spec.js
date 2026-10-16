import { observeLearningDialogs } from '../setup.js';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  parseConnectedMaterial,
  requestUploadRecovery,
  testMaterialConnector
} from '@/services/learning/material-connector.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  createPendingUploadJournal,
  pendingUploadJournal,
  UPLOAD_PENDING_KEY,
  MAX_PENDING_UPLOADS
} from '@/services/learning/pending-upload-journal.js';
import { storageService } from '@/services/storageService.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { mount, flushPromises } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
const storageId = 'b'.repeat(32);
const origin = 'http://127.0.0.1:8765';
const connection = () => ({
  endpoint: origin + '/parse',
  allowedOrigins: [origin],
  consent: true,
  token: 'TEST_ONLY_UPLOAD_RECOVERY_TOKEN_32',
  capabilities: { uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId } }
});
const input = { name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' };
let store;
beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'synthetic-upload-owner');
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.materialConnection = connection();
});
afterEach(() => {
  store.$dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('正文发送前先持久登记并向解析器登记，登记失败零正文发送', async () => {
  const recorded = vi.fn();
  const transport = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ success: false }) });
  vi.stubGlobal('fetch', transport);
  await expect(
    parseConnectedMaterial(connection(), input, {
      platform: 'h5',
      uploadId: 'upload_test_12345678',
      onUploadIntent: recorded
    })
  ).rejects.toThrow();
  expect(recorded).toHaveBeenCalledOnce();
  expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({
    action: 'prepare-upload',
    requestId: 'upload_test_12345678',
    storageId,
    size: 4
  });
  expect(transport).toHaveBeenCalledOnce();
});
it('首批回执丢失后Store保留无正文待办，刷新可再次读取', async () => {
  const transport = vi
    .fn()
    .mockImplementationOnce(async (_url, options) => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            contract: 'wenli-upload-v1',
            requestId: JSON.parse(options.body).requestId,
            state: 'prepared',
            size: 4
          }
        })
    }))
    .mockRejectedValueOnce(new Error('ISOLATED_LOST_RESPONSE'));
  vi.stubGlobal('fetch', transport);
  await expect(store.importFile(input)).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(2);
  expect(JSON.parse(transport.mock.calls[1][1].body).contentBase64).toBe(input.contentBase64);
  expect(store.pendingUploads).toHaveLength(1);
  store.refresh();
  expect(store.pendingUploads).toHaveLength(1);
  expect(JSON.stringify(store.pendingUploads)).not.toContain('dGVzdA');
  expect(JSON.stringify(store.pendingUploads)).not.toContain(connection().token);
});
it('旧连接器不冒充可恢复能力，原解析路径继续', async () => {
  const transport = vi.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        success: true,
        data: {
          id: 'one',
          fingerprint: 'one',
          scope: 'private',
          segments: [{ id: 'one', content: '候选' }],
          totalPages: 1,
          nextPage: null
        }
      })
  });
  vi.stubGlobal('fetch', transport);
  const legacy = { ...connection(), capabilities: {} };
  await parseConnectedMaterial(legacy, input, { platform: 'h5' });
  expect(transport).toHaveBeenCalledOnce();
  expect(JSON.parse(transport.mock.calls[0][1].body)).not.toHaveProperty('requestId');
});
const uploadEntry = (id = 'upload_test_12345678') => ({
  id,
  connectorOrigin: origin,
  storageId,
  size: 4,
  recognitionAllowed: false,
  recognitionEngine: 'tesseract'
});
const response = (data) => ({ ok: true, text: async () => JSON.stringify({ success: true, data }) });
const receipt = (state, extra = {}, id = 'upload_test_12345678') =>
  response({ contract: 'wenli-upload-v1', requestId: id, state, size: 4, ...extra });
const parsed = () => ({
  id: 'a'.repeat(64),
  fingerprint: 'a'.repeat(64),
  name: '恢复的私人原件',
  kind: 'pdf',
  scope: 'private',
  original: { connectorFileId: 'a'.repeat(64) },
  segments: [{ id: 'page-1', page: 1, content: 'TEST_ONLY_PRIVATE_CANDIDATE' }],
  totalPages: 1,
  nextPage: null
});
function register(entry = uploadEntry()) {
  pendingUploadJournal.add(entry, store.state.owner);
  store.refresh();
  return entry;
}
function localJournal() {
  let data = null,
    owner = 'one';
  const write = vi.fn(),
    save = vi.fn((_key, value) => {
      data = structuredClone(value);
      return true;
    });
  const journal = createPendingUploadJournal({ get: () => structuredClone(data), save }, () => owner, write);
  return { journal, save, write, get: () => structuredClone(data), set: (v) => (data = v), owner: (v) => (owner = v) };
}
it.each([
  { size: 0 },
  { storageId: 'bad' },
  { id: '../outside' },
  { connectorOrigin: 'invalid' },
  { recognitionAllowed: 'true' }
])('无效待办%s在写入前拒绝，不覆盖已有登记', (change) => {
  const { journal, save, get } = localJournal();
  journal.add(uploadEntry(), 'one');
  const before = get();
  expect(() => journal.add({ ...uploadEntry('upload_invalid_12345678'), ...change }, 'one')).toThrow();
  expect(get()).toEqual(before);
  expect(save).toHaveBeenCalledOnce();
});
it('本机待办只保留七个定位字段，读取副本修改不影响登记', () => {
  const { journal, get } = localJournal();
  journal.add(
    {
      ...uploadEntry(),
      token: 'FORBIDDEN',
      name: 'PRIVATE_NAME',
      contentBase64: 'PRIVATE_BODY',
      handle: 'PRIVATE_URI'
    },
    'one'
  );
  const entries = journal.list();
  entries[0].size = 999;
  expect(Object.keys(journal.list()[0])).toHaveLength(7);
  expect(JSON.stringify(get())).not.toMatch(/FORBIDDEN|PRIVATE_NAME|PRIVATE_BODY|PRIVATE_URI/);
  expect(journal.list()[0].size).toBe(4);
});
it('本机待办有上限，未确认登记不会被静默驱逐', () => {
  const { journal } = localJournal();
  for (let n = 0; n < MAX_PENDING_UPLOADS; n++)
    journal.add(uploadEntry(`upload_budget_${n.toString().padStart(8, '0')}`), 'one');
  expect(() => journal.add(uploadEntry('upload_overflow_12345678'), 'one')).toThrow('上限');
  expect(journal.list()[0].id).toBe('upload_budget_00000000');
});
it('跨账户或写租约失效不写待办，保存失败也不得宣称登记完成', () => {
  const { journal, write, save, get } = localJournal();
  expect(() => journal.add(uploadEntry(), 'other')).toThrow('账户');
  expect(save).not.toHaveBeenCalled();
  write.mockImplementationOnce(() => {
    throw new Error('真实写租约阻塞');
  });
  expect(() => journal.add(uploadEntry(), 'one')).toThrow('租约');
  expect(get()).toBeNull();
  save.mockReturnValueOnce(false);
  expect(() => journal.add(uploadEntry(), 'one')).toThrow('保存失败');
});
it('损坏持久待办拒绝覆盖', () => {
  const { journal, set, save } = localJournal();
  set({ owner: 'one', contract: 'wrong', entries: [] });
  expect(() => journal.add(uploadEntry(), 'one')).toThrow('不合法');
  expect(save).not.toHaveBeenCalled();
});
it('本机登记失败在任何HTTP和正文发送前停止', async () => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  const original = storageService.save.bind(storageService);
  const save = vi.spyOn(storageService, 'save');
  save.mockImplementation((key, ...args) => (key === UPLOAD_PENDING_KEY ? false : original(key, ...args)));
  await expect(store.importFile(input)).rejects.toThrow('保存失败');
  expect(transport).not.toHaveBeenCalled();
});
it('登记回执等待时撤销记录许可，旧正文零发送且待办保留', async () => {
  let resolve, requestId;
  const transport = vi.fn((_url, opts) => {
    requestId = JSON.parse(opts.body).requestId;
    return new Promise((r) => (resolve = r));
  });
  vi.stubGlobal('fetch', transport);
  const promise = store.importFile(input),
    rejected = expect(promise).rejects.toThrow();
  await flushPromises();
  learningRepository.deleteData();
  resolve(receipt('prepared', {}, requestId));
  await rejected;
  expect(transport).toHaveBeenCalledOnce();
  expect(pendingUploadJournal.list()).toHaveLength(1);
});
it('核对不存在不清待办；明确关闭并核实回执才清理且无正文', async () => {
  register();
  const transport = vi
    .fn()
    .mockResolvedValueOnce(receipt('absent'))
    .mockResolvedValueOnce(receipt('absent'))
    .mockResolvedValueOnce(receipt('closed', { originalDeleted: true }));
  vi.stubGlobal('fetch', transport);
  expect((await store.inspectUpload(uploadEntry().id, true)).state).toBe('absent');
  expect(store.pendingUploads).toHaveLength(1);
  await store.closeUpload(uploadEntry().id, true);
  expect(store.pendingUploads).toHaveLength(0);
  expect(transport.mock.calls.map((c) => JSON.parse(c[1].body).action)).toEqual([
    'upload-receipt',
    'upload-receipt',
    'close-upload'
  ]);
  expect(transport.mock.calls.every((c) => !JSON.parse(c[1].body).contentBase64)).toBe(true);
});
it('只以原fileId恢复，沿登记识别许可，保存学习事实后清理待办', async () => {
  register();
  const transport = vi
    .fn()
    .mockResolvedValueOnce(receipt('stored', { fileId: 'a'.repeat(64) }))
    .mockResolvedValueOnce(response(parsed()));
  vi.stubGlobal('fetch', transport);
  await store.recoverUpload(uploadEntry().id, true);
  const body = JSON.parse(transport.mock.calls[1][1].body);
  expect(body).toMatchObject({ fileId: 'a'.repeat(64), storageId, allowOCR: false });
  expect(body).not.toHaveProperty('contentBase64');
  expect(body).not.toHaveProperty('requestId');
  expect(store.state.materials).toHaveLength(1);
  expect(store.pendingUploads).toHaveLength(0);
  expect(store.summary.first.denominator).toBe(0);
  expect(store.exportData()).not.toContain('wenli-upload-journal-v1');
});
it('事实保存失败保留可定位待办，之后核对已关联资料也不重复恢复', async () => {
  register();
  const transport = vi
    .fn()
    .mockResolvedValueOnce(receipt('stored', { fileId: 'a'.repeat(64) }))
    .mockResolvedValueOnce(response(parsed()));
  vi.stubGlobal('fetch', transport);
  vi.spyOn(learningRepository, 'commit').mockImplementationOnce(() => {
    throw new Error('ISOLATED_FACT_WRITE_FAILED');
  });
  await expect(store.recoverUpload(uploadEntry().id, true)).rejects.toThrow('FACT_WRITE');
  expect(store.pendingUploads).toHaveLength(1);
  expect(store.state.materials).toHaveLength(0);
  store.commit('material.add', {
    material: { ...parsed(), original: { connectorFileId: 'a'.repeat(64), connectorOrigin: origin } }
  });
  transport.mockResolvedValueOnce(receipt('stored', { fileId: 'a'.repeat(64) }));
  expect((await store.recoverUpload(uploadEntry().id, true)).state).toBe('linked');
  expect(store.pendingUploads).toHaveLength(0);
  expect(store.state.materials).toHaveLength(1);
  expect(transport).toHaveBeenCalledTimes(3);
});
it('已关联资料禁止待办快捷删除，共享原件关闭如实报告保留', async () => {
  register();
  store.commit('material.add', {
    material: { ...parsed(), original: { connectorFileId: 'a'.repeat(64), connectorOrigin: origin } }
  });
  const transport = vi.fn().mockResolvedValueOnce(receipt('stored', { fileId: 'a'.repeat(64) }));
  vi.stubGlobal('fetch', transport);
  await expect(store.closeUpload(uploadEntry().id, true)).rejects.toThrow('删除范围');
  expect(transport).toHaveBeenCalledOnce();
  expect(store.pendingUploads).toHaveLength(1);
  const second = uploadEntry('upload_second_12345678');
  register(second);
  transport
    .mockResolvedValueOnce(receipt('stored', { fileId: 'c'.repeat(64) }, second.id))
    .mockResolvedValueOnce(receipt('closed', { originalDeleted: false, sharedOriginalRetained: true }, second.id));
  expect((await store.closeUpload(second.id, true)).sharedOriginalRetained).toBe(true);
  expect(store.state.materials).toHaveLength(1);
});
it.each([{ storageId: 'c'.repeat(32) }, { contract: 'unknown' }, { available: false }])(
  '存储或能力%s变化拒绝待办核对，零HTTP且保留原登记',
  async (change) => {
    register();
    store.materialConnection.capabilities.uploadRecovery = {
      ...store.materialConnection.capabilities.uploadRecovery,
      ...change
    };
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(store.inspectUpload(uploadEntry().id, true)).rejects.toThrow('原登记存储');
    expect(transport).not.toHaveBeenCalled();
    expect(store.pendingUploads).toHaveLength(1);
  }
);
it.each([
  { requestId: 'upload_wrong_12345678' },
  { state: 'stored', fileId: undefined },
  { state: 'closed', originalDeleted: 'true' },
  { size: 999 }
])('不匹配或畸形回执%s不能确认关闭', async (change) => {
  const transport = vi.fn().mockResolvedValue(receipt('closed', { originalDeleted: true, ...change }));
  vi.stubGlobal('fetch', transport);
  await expect(
    requestUploadRecovery(connection(), 'close-upload', uploadEntry(), { platform: 'h5' })
  ).rejects.toThrow();
});
it('清除本机学习事实保留定位待办，刷新不自动查询/恢复或携带令牌', () => {
  register();
  store.importText('TEST_ONLY_PRIVATE_TEXT');
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  store.deleteData();
  store.refresh();
  expect(store.state.materials).toHaveLength(0);
  expect(store.pendingUploads).toHaveLength(1);
  expect(transport).not.toHaveBeenCalled();
  expect(store.exportData()).not.toContain(uploadEntry().id);
});
it('健康能力仅接收严格恢复合同与存储身份', async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      response({ version: 'v1', uploadRecovery: { available: true, contract: 'unknown', storageId } })
    )
    .mockResolvedValueOnce(
      response({ version: 'v1', uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId } })
    );
  vi.stubGlobal('fetch', transport);
  expect((await testMaterialConnector(connection(), { platform: 'h5' })).uploadRecovery.available).toBe(false);
  expect((await testMaterialConnector(connection(), { platform: 'h5' })).uploadRecovery.available).toBe(true);
});
it('实际页面核对需逐次确认，取消或确认前上下文变化不执行请求', async () => {
  register();
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  let modal;
  const wrapper = mount(LearningPage, {
    global: {
      stubs: {
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' },
        'scroll-view': { template: '<div><slot /></div>' },
        LearningOverview: { template: '<aside />' }
      }
    }
  });
  observeLearningDialogs(wrapper, (state) => {
    modal = state;
  });
  try {
    await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '导入记录')
      .trigger('tap');
    const button = wrapper.findAll('button').find((b) => b.text().trim() === '核对原件状态');
    await button.trigger('tap');
    modal.success({ confirm: false });
    await flushPromises();
    expect(transport).not.toHaveBeenCalled();
    await button.trigger('tap');
    store.materialConnection.token = 'CHANGED_TEST_ONLY_TOKEN_32_chars';
    modal.success({ confirm: true });
    await flushPromises();
    expect(transport).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('授权已变化');
    expect(store.pendingUploads).toHaveLength(1);
  } finally {
    wrapper.unmount();
  }
});
it('明确恢复开始时清除上一动作的取消提示，成功后只显示当前恢复结果', async () => {
  register();
  vi.spyOn(store, 'checkMaterialConnection').mockRejectedValueOnce(
    Object.assign(new Error('上一请求已取消'), { code: 'CANCELLED' })
  );
  const recover = vi.spyOn(store, 'recoverUpload').mockResolvedValue({ state: 'restored' });
  let dialog;
  const wrapper = mount(LearningPage);
  const stop = observeLearningDialogs(wrapper, (state) => {
    dialog = state;
  });
  const button = (name) => wrapper.findAll('button').find((b) => b.text().trim() === name);
  try {
    await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
    await button('解析设置').trigger('tap');
    await button('授权并连接').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('上一请求已取消');
    await button('导入记录').trigger('tap');
    await button('恢复已收原件').trigger('tap');
    dialog.success({ confirm: true });
    await flushPromises();
    expect(recover).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('已从解析器原件恢复私人资料');
    expect(wrapper.text()).not.toContain('上一请求已取消');
  } finally {
    stop();
    wrapper.unmount();
  }
});
