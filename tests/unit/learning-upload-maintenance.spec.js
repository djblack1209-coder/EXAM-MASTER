import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { pendingUploadJournal } from '@/services/learning/pending-upload-journal.js';
import * as materialService from '@/services/learning/material-connector.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { storageService } from '@/services/storageService.js';
import { UPLOAD_PENDING_KEY } from '@/services/learning/pending-upload-journal.js';
import { mount, flushPromises } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn() }));
const owner = 'synthetic-maintenance-owner',
  origin = 'http://127.0.0.1:8765',
  storageId = 'b'.repeat(32),
  generation = 'c'.repeat(32),
  fingerprint = 'd'.repeat(64);
const connection = () => ({
  endpoint: origin + '/parse',
  allowedOrigins: [origin],
  token: 'TEST_ONLY_MAINTENANCE_TOKEN_32_chars',
  consent: true,
  capabilities: {
    uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId },
    uploadMaintenance: { available: true, contract: 'wenli-upload-maintenance-v1', generation }
  }
});
const entry = () => ({
  id: 'upload_test_12345678',
  connectorOrigin: origin,
  storageId,
  size: 4,
  recognitionAllowed: false,
  recognitionEngine: 'tesseract'
});
const response = (data) => ({ ok: true, text: async () => JSON.stringify({ success: true, data }) });
const preview = () => ({
  contract: 'wenli-upload-maintenance-v1',
  storageId,
  generation,
  previewFingerprint: fingerprint,
  closedCount: 2,
  openCount: 1,
  maxReceipts: 512,
  originalsDeleted: 0,
  pending: false
});
let store;
beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', owner);
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.materialConnection = connection();
  pendingUploadJournal.add(entry(), owner);
  store.refresh();
});
afterEach(() => {
  store.$dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('无需远端可导出定位预览，明确确认后只移除本机待办而不宣称远端删除', () => {
  store.materialConnection = null;
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  const pending = store.previewPendingRemoval(entry().id);
  expect(pending.entry).toMatchObject(entry());
  expect(() => store.forgetPendingUpload(pending, false)).toThrow('确认');
  expect(store.pendingUploads).toHaveLength(1);
  expect(store.forgetPendingUpload(pending, true)).toMatchObject({ localRemoved: true, originalStatus: 'unverified' });
  expect(transport).not.toHaveBeenCalled();
  expect(store.pendingUploads).toHaveLength(0);
});
it('维护预览只取登记元信息，原始正文和令牌不写预览', async () => {
  const transport = vi.fn().mockResolvedValue(response(preview()));
  vi.stubGlobal('fetch', transport);
  const value = await store.previewUploadMaintenance(true);
  expect(value.closedCount).toBe(2);
  expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ action: 'preview-upload-maintenance', storageId });
  expect(JSON.stringify(value)).not.toContain(connection().token);
});
it('健康返回仅接受严格维护合同和代次', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      response({
        version: 'v1',
        uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId },
        uploadMaintenance: { available: true, contract: 'wenli-upload-maintenance-v1', generation }
      })
    )
  );
  expect(
    (await materialService.testMaterialConnector(connection(), { platform: 'h5' })).uploadMaintenance
  ).toMatchObject({ available: true, generation });
});
it('退休登记如实标原件未核验，不把它当已删除而清待办', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      response({
        contract: 'wenli-upload-v1',
        requestId: entry().id,
        state: 'retired',
        originalStatus: 'unverified',
        uploadBlocked: true
      })
    )
  );
  expect((await store.inspectUpload(entry().id, true)).state).toBe('retired');
  expect(store.pendingUploads).toHaveLength(1);
});
function locator(value = store.previewPendingRemoval(entry().id)) {
  return JSON.stringify({ format: 'wenli-upload-locator-v1', owner: value.owner, entry: value.entry });
}
function completion(value, extra = {}) {
  return {
    contract: 'wenli-upload-maintenance-v1',
    storageId,
    requestId: value.operationId,
    fromGeneration: value.fromGeneration || value.generation,
    generation: 'e'.repeat(32),
    state: 'completed',
    removedCount: value.pending ? value.plannedCount : value.closedCount,
    originalsDeleted: 0,
    ...extra
  };
}
it('导出后明确移除、重新导入同账户定位，时间与旧权限保留且零HTTP', () => {
  const p = store.previewPendingRemoval(entry().id),
    content = locator(p),
    transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  store.forgetPendingUpload(p, true);
  expect(() => store.restorePendingLocator(content, false)).toThrow('确认');
  expect(store.pendingUploads).toHaveLength(0);
  expect(store.restorePendingLocator(content, true).restored).toBe(true);
  expect(store.pendingUploads[0]).toEqual(p.entry);
  expect(store.restorePendingLocator(content, true).alreadyPresent).toBe(true);
  expect(transport).not.toHaveBeenCalled();
});
it.each(['owner', 'extraRoot', 'extraEntry', 'invalidOrigin', 'invalidTime', 'size', 'rawBody'])(
  '畸形或跨账户定位%s不落库也不发请求',
  (kind) => {
    const value = JSON.parse(locator());
    store.forgetPendingUpload(store.previewPendingRemoval(entry().id), true);
    if (kind === 'owner') value.owner = 'other';
    if (kind === 'extraRoot') value.token = 'FORBIDDEN';
    if (kind === 'extraEntry') value.entry.path = '/PRIVATE';
    if (kind === 'invalidOrigin') value.entry.connectorOrigin = 'invalid';
    if (kind === 'invalidTime') value.entry.createdAt = -1;
    if (kind === 'size') value.entry.size = 0;
    if (kind === 'rawBody') value.entry.contentBase64 = 'FORBIDDEN';
    const before = storageService.get(UPLOAD_PENDING_KEY),
      transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    expect(() => store.restorePendingLocator(JSON.stringify(value), true)).toThrow();
    expect(storageService.get(UPLOAD_PENDING_KEY)).toEqual(before);
    expect(store.pendingUploads).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();
  }
);
it('同编号定位冲突不能覆盖当前待办', () => {
  const value = JSON.parse(locator());
  value.entry.size = 5;
  expect(() => store.restorePendingLocator(JSON.stringify(value), true)).toThrow('信息不同');
  expect(store.pendingUploads[0].size).toBe(4);
});
it('账户或记录生命周期变化拒绝旧移除预览', () => {
  let p = store.previewPendingRemoval(entry().id);
  learningRepository.deleteData();
  expect(() => store.forgetPendingUpload(p, true)).toThrow('已变化');
  expect(pendingUploadJournal.list()).toHaveLength(1);
  p = store.previewPendingRemoval(entry().id);
  uni.setStorageSync('EXAM_USER_ID', 'synthetic-other-owner');
  store.refresh();
  expect(() => store.forgetPendingUpload(p, true)).toThrow('已变化');
  uni.setStorageSync('EXAM_USER_ID', owner);
  store.refresh();
  expect(store.pendingUploads).toHaveLength(1);
});
it('定位预览可只读；实际移除和恢复仍需已有写租约', () => {
  const lease = vi.spyOn(learningRepository, 'assertWriteAccess').mockImplementation(() => {
    throw new Error('TEST_ONLY_OTHER_WINDOW');
  });
  const p = store.previewPendingRemoval(entry().id);
  expect(lease).not.toHaveBeenCalled();
  expect(() => store.forgetPendingUpload(p, true)).toThrow('OTHER_WINDOW');
  expect(store.pendingUploads).toHaveLength(1);
});
it('待办内容在确认前改变，旧预览不得清新定位', () => {
  const p = store.previewPendingRemoval(entry().id),
    journal = storageService.get(UPLOAD_PENDING_KEY);
  journal.entries[0].size = 5;
  storageService.save(UPLOAD_PENDING_KEY, journal, true);
  store.refresh();
  expect(() => store.forgetPendingUpload(p, true)).toThrow('已变化');
  expect(store.pendingUploads[0].size).toBe(5);
});
it('无明确维护许可或能力，零HTTP', async () => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  await expect(store.previewUploadMaintenance(false)).rejects.toThrow('确认');
  store.materialConnection.capabilities.uploadMaintenance.available = false;
  await expect(store.previewUploadMaintenance(true)).rejects.toThrow('未开放');
  expect(transport).not.toHaveBeenCalled();
});
it.each([{ contract: 'unknown' }, { generation: 'bad' }, { available: 'true' }])(
  '坏维护能力%s不能成为可用健康能力',
  async (change) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          version: 'v1',
          uploadRecovery: { available: true, contract: 'wenli-upload-v1', storageId },
          uploadMaintenance: { available: true, contract: 'wenli-upload-maintenance-v1', generation, ...change }
        })
      )
    );
    expect(
      (await materialService.testMaterialConnector(connection(), { platform: 'h5' })).uploadMaintenance.available
    ).toBe(false);
  }
);
it('维护预览丢弃额外敏感字段，关闭登记计数结构不合法也不得执行', async () => {
  const transport = vi
    .fn()
    .mockResolvedValueOnce(response({ ...preview(), token: 'FORBIDDEN', name: 'PRIVATE_NAME' }))
    .mockResolvedValueOnce(response({ ...preview(), closedCount: 513 }));
  vi.stubGlobal('fetch', transport);
  const p = await store.previewUploadMaintenance(true);
  expect(JSON.stringify(p)).not.toMatch(/FORBIDDEN|PRIVATE_NAME/);
  await expect(store.previewUploadMaintenance(true)).rejects.toThrow('结构不合法');
  expect(transport).toHaveBeenCalledTimes(2);
});
it('代次或令牌换回原值仍拒绝旧维护预览，零整理请求', async () => {
  const transport = vi.fn().mockResolvedValue(response(preview()));
  vi.stubGlobal('fetch', transport);
  const p = await store.previewUploadMaintenance(true);
  store.materialConnection.token = 'CHANGED_TEST_ONLY_TOKEN_32_chars';
  store.materialConnection.token = connection().token;
  await expect(store.compactUploadReceipts(p, true)).rejects.toThrow('已变化');
  expect(transport).toHaveBeenCalledOnce();
});
it('丢失整理回执后保留同动作编号，明确重试不改变私人事实或重复登记', async () => {
  const transport = vi.fn().mockResolvedValueOnce(response(preview()));
  vi.stubGlobal('fetch', transport);
  const p = await store.previewUploadMaintenance(true),
    before = store.exportData();
  transport.mockRejectedValueOnce(new Error('TEST_ONLY_LOST_MAINTENANCE_REPLY'));
  await expect(store.compactUploadReceipts(p, true)).rejects.toThrow();
  expect(store.materialConnection.capabilities.uploadMaintenance.generation).toBe(generation);
  transport.mockResolvedValueOnce(response(completion(p)));
  await store.compactUploadReceipts(p, true);
  expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual(JSON.parse(transport.mock.calls[2][1].body));
  expect(store.materialConnection.capabilities.uploadMaintenance.generation).toBe('e'.repeat(32));
  expect(store.exportData()).toBe(before);
  expect(store.pendingUploads).toHaveLength(1);
});
it.each([
  { storageId: 'f'.repeat(32) },
  { requestId: 'maintenance_wrong_12345678' },
  { removedCount: 9 },
  { originalsDeleted: 1 },
  { generation },
  { state: 'pending' }
])('不匹配整理回执%s不宣称完成也不更新授权代次', async (change) => {
  const transport = vi.fn().mockResolvedValueOnce(response(preview()));
  vi.stubGlobal('fetch', transport);
  const p = await store.previewUploadMaintenance(true);
  transport.mockResolvedValueOnce(response(completion(p, change)));
  await expect(store.compactUploadReceipts(p, true)).rejects.toThrow();
  expect(store.materialConnection.capabilities.uploadMaintenance.generation).toBe(generation);
  expect(store.pendingUploads).toHaveLength(1);
});
it('从持久未完成计划预览取得原动作编号，沿原计划恢复整理', async () => {
  const current = 'e'.repeat(32),
    transport = vi.fn().mockResolvedValueOnce(
      response({
        ...preview(),
        generation: current,
        pending: true,
        requestId: 'maintenance_persisted_12345678',
        fromGeneration: generation,
        plannedCount: 3,
        closedCount: 1
      })
    );
  vi.stubGlobal('fetch', transport);
  const p = await store.previewUploadMaintenance(true);
  expect(p.operationId).toBe('maintenance_persisted_12345678');
  expect(store.materialConnection.capabilities.uploadMaintenance.generation).toBe(current);
  transport.mockResolvedValueOnce(response(completion(p, { generation: current })));
  await store.compactUploadReceipts(p, true);
  expect(JSON.parse(transport.mock.calls[1][1].body)).toMatchObject({
    requestId: p.operationId,
    generation,
    previewFingerprint: fingerprint
  });
});
it('健康代次用于新导入编号，仍先登记再正文', async () => {
  const transport = vi
    .fn()
    .mockImplementationOnce(async (_url, options) =>
      response({
        contract: 'wenli-upload-v1',
        requestId: JSON.parse(options.body).requestId,
        state: 'prepared',
        size: 4
      })
    )
    .mockRejectedValueOnce(new Error('TEST_ONLY_LOST_REPLY'));
  vi.stubGlobal('fetch', transport);
  await expect(store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' })).rejects.toThrow();
  expect(JSON.parse(transport.mock.calls[0][1].body).requestId).toMatch(new RegExp('^upload_' + generation + '_'));
  expect(transport).toHaveBeenCalledTimes(2);
});
function mountPage() {
  return mount(LearningPage, {
    global: {
      stubs: {
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' },
        'scroll-view': { template: '<div><slot /></div>' },
        LearningOverview: { template: '<aside />' }
      }
    }
  });
}
const findButton = (wrapper, name) => wrapper.findAll('button').find((b) => b.text().trim() === name);
it('实际页面要求定位移除勾选和再次确认，取消保留、确认只移本机', async () => {
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  let modal;
  vi.spyOn(uni, 'showModal').mockImplementation((o) => (modal = o));
  const wrapper = mountPage();
  try {
    await findButton(wrapper, '导入与校对资料').trigger('tap');
    await findButton(wrapper, '导出定位与移除待办').trigger('tap');
    await flushPromises();
    expect(JSON.parse(wrapper.find('[aria-label="待办定位 JSON"]').element.value).entry.id).toBe(entry().id);
    expect(findButton(wrapper, '确认仅移除本机待办').attributes('disabled')).toBeDefined();
    const acknowledgement = wrapper.find('[data-test="locator-removal-ack"]');
    await acknowledgement.trigger('change', { detail: { value: ['saved'] } });
    expect(findButton(wrapper, '确认仅移除本机待办').attributes('disabled')).toBeUndefined();
    await acknowledgement.trigger('change', { detail: { value: [] } });
    expect(findButton(wrapper, '确认仅移除本机待办').attributes('disabled')).toBeDefined();
    await acknowledgement.trigger('change', { detail: { value: ['saved'] } });
    await findButton(wrapper, '确认仅移除本机待办').trigger('tap');
    modal.success({ confirm: false });
    await flushPromises();
    expect(store.pendingUploads).toHaveLength(1);
    await findButton(wrapper, '确认仅移除本机待办').trigger('tap');
    modal.success({ confirm: true });
    await flushPromises();
    expect(store.pendingUploads).toHaveLength(0);
    expect(wrapper.text()).toContain('远端原件未核验');
    expect(transport).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
  }
});
it('实际页面维护取消零整理，批准才沿当前预览执行', async () => {
  let modal;
  vi.spyOn(uni, 'showModal').mockImplementation((o) => (modal = o));
  const transport = vi.fn().mockResolvedValue(response(preview()));
  vi.stubGlobal('fetch', transport);
  const wrapper = mountPage();
  try {
    await findButton(wrapper, '导入与校对资料').trigger('tap');
    await findButton(wrapper, '预览登记整理').trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('已关闭 2 项');
    await findButton(wrapper, '确认整理已关闭登记').trigger('tap');
    modal.success({ confirm: false });
    await flushPromises();
    expect(transport).toHaveBeenCalledOnce();
    await findButton(wrapper, '确认整理已关闭登记').trigger('tap');
    const body = JSON.parse(transport.mock.calls[0][1].body);
    expect(body.action).toBe('preview-upload-maintenance');
    transport.mockImplementationOnce(async (_url, o) => {
      const sent = JSON.parse(o.body);
      return response(completion({ operationId: sent.requestId, generation, closedCount: 2 }));
    });
    modal.success({ confirm: true });
    await flushPromises();
    expect(wrapper.text()).toContain('已核实整理 2 项');
    expect(store.pendingUploads).toHaveLength(1);
  } finally {
    wrapper.unmount();
  }
});
it('账户切换清空页面定位文本与移除预览', async () => {
  const wrapper = mountPage();
  try {
    await findButton(wrapper, '导入与校对资料').trigger('tap');
    await findButton(wrapper, '导出定位与移除待办').trigger('tap');
    await flushPromises();
    uni.setStorageSync('EXAM_USER_ID', 'synthetic-other');
    store.refresh();
    await flushPromises();
    expect(wrapper.find('[data-test="pending-upload-removal"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain(entry().id);
  } finally {
    wrapper.unmount();
  }
});
it('不可用的记录生命周期不能以空上下文确认移除或恢复定位', () => {
  const p = store.previewPendingRemoval(entry().id),
    content = locator(p);
  storageService.save('conversation_learning_v1_lifecycle', { owner, contract: 'wrong', generation: '12345678' }, true);
  expect(store.recordContext()).toBeNull();
  expect(() => store.previewPendingRemoval(entry().id)).toThrow('撤销标记');
  expect(() => store.restorePendingLocator(content, true)).toThrow('撤销标记');
  storageService.remove('conversation_learning_v1_lifecycle', true);
  vi.spyOn(learningRepository, 'lifecycleContext').mockImplementation(() => {
    throw new Error('TEST_ONLY_CONTEXT_UNAVAILABLE');
  });
  expect(() => store.previewPendingRemoval(entry().id)).toThrow('不可用');
  expect(() => store.forgetPendingUpload({ ...p, context: null }, true)).toThrow();
  expect(() => store.restorePendingLocator(content, true)).toThrow('不可用');
  expect(pendingUploadJournal.list()).toHaveLength(1);
});
