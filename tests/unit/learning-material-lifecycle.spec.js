import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
const hooks = vi.hoisted(() => ({ show: null, hide: null }));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (fn) => {
    hooks.show = fn;
  },
  onHide: (fn) => {
    hooks.hide = fn;
  },
  onLoad: vi.fn()
}));
const connection = () => ({
  endpoint: 'http://127.0.0.1:8765/parse',
  allowedOrigins: ['http://127.0.0.1:8765'],
  token: 'TEST_ONLY_LIFECYCLE_MATERIAL_TOKEN_32',
  consent: true
});
let wrapper, store, backup, picker, modal, reader, readers, readData, chooseFile, privacy, stat, appBridge;
beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'synthetic-file-lifecycle-owner');
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.start('备份中的原记录');
  backup = store.exportData();
  store.deleteData();
  store.start('本次文件动作');
  store.materialConnection = connection();
  picker = null;
  modal = null;
  reader = null;
  readers = [];
  chooseFile = null;
  privacy = null;
  readData = null;
  vi.spyOn(uni, 'showModal').mockImplementation((o) => {
    modal = o;
  });
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
    if (this.type === 'file') picker = this;
  });
  vi.stubGlobal(
    'FileReader',
    class {
      constructor() {
        this.abort = vi.fn();
        this.readAsDataURL = vi.fn();
        readers.push(this);
        reader = this;
      }
    }
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  store.$dispose();
  delete uni.requireNativePlugin;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function page(platform = 'h5') {
  if (platform === 'app') {
    vi.stubGlobal('plus', { os: { name: 'Android' } });
    appBridge = {
      getCapabilities: () => ({
        contract: 'wenli-app-connector-v1',
        redirect: 'reject',
        responseLimit: 'bytes',
        utf8: 'strict',
        tls: 'system',
        cancel: true,
        file: {
          contract: 'wenli-app-file-v1',
          selection: 'system',
          read: 'after_consent',
          handles: 'ephemeral',
          maxBytes: 10485760,
          boundedRead: true,
          cancel: true
        }
      }),
      chooseMaterialFile: vi.fn((o, done) =>
        done({
          id: o.id,
          file: {
            handle: 'file_01234567-0123-4567-89ab-0123456789ab',
            name: 'synthetic.pdf',
            size: 4
          }
        })
      ),
      readMaterialFile: vi.fn(),
      releaseMaterialFile: vi.fn(),
      cancelFileOperation: vi.fn(),
      request: vi.fn(),
      cancel: vi.fn()
    };
    uni.requireNativePlugin = vi.fn(() => appBridge);
    store.materialConnection = {
      ...connection(),
      endpoint: 'https://connector.invalid/parse',
      allowedOrigins: ['https://connector.invalid']
    };
  }
  if (platform === 'weixin') {
    stat = vi.fn((o) => o.success({ stats: { size: 4, lastModifiedTime: 1, isFile: () => true } }));
    vi.stubGlobal('wx', {
      getAppBaseInfo: () => ({ SDKVersion: '3.2.2' }),
      getDeviceInfo: () => ({ platform: 'ios' }),
      canIUse: () => true,
      requirePrivacyAuthorize: vi.fn((o) => {
        privacy = o;
      }),
      chooseMessageFile: vi.fn((o) => {
        chooseFile = o;
      }),
      getFileSystemManager: () => ({
        stat,
        readFile: vi.fn((o) => {
          readData = o;
        })
      }),
      request: vi.fn()
    });
    store.materialConnection = {
      ...connection(),
      endpoint: 'https://connector.invalid/parse',
      allowedOrigins: ['https://connector.invalid']
    };
  }
  wrapper = mount(LearningPage);
  await wrapper
    .findAll('button')
    .find((w) => w.text().trim() === '导入与校对资料')
    .trigger('tap');
}
const choose = () =>
  wrapper
    .findAll('button')
    .find((w) => w.text().trim() === '选择 PDF / 作答图片')
    .trigger('tap');
function selected() {
  Object.defineProperty(picker, 'files', { value: [new File(['test'], 'synthetic.pdf')] });
  picker.onchange();
}
function mutate(kind) {
  if (kind === 'delete') store.deleteData();
  else if (kind === 'restore') {
    const p = store.previewRestore(backup);
    const r = store.restoreData(backup, p);
    expect(r.imported).toBeGreaterThan(0);
  } else if (kind === 'token') store.materialConnection.token = 'TEST_ONLY_NEW_LIFECYCLE_TOKEN_32';
  else if (kind === 'connection') {
    const before = store.materialConnection;
    store.materialConnection = null;
    store.materialConnection = before;
  } else if (kind === 'token-cycle') {
    const original = store.materialConnection.token;
    store.materialConnection.token = 'TEST_ONLY_INTERMEDIATE_TOKEN_32';
    store.materialConnection.token = original;
  } else if (kind === 'origins') store.materialConnection.allowedOrigins.push('https://another.invalid');
  else if (kind === 'target') store.materialConnection.endpoint = 'http://127.0.0.1:8766/parse';
  else if (kind === 'consent') store.materialConnection.consent = false;
  else if (kind === 'hide') {
    hooks.hide();
    hooks.show();
  } else if (kind === 'unmount') {
    wrapper.unmount();
    wrapper = null;
  }
}
async function completeWeixinChoice() {
  privacy.success({});
  await flushPromises();
  chooseFile.success({ tempFiles: [{ path: 'wxfile://synthetic', name: 'synthetic.pdf', size: 4 }] });
  await flushPromises();
}
describe('H5/微信文件动作绑定真实记录生命周期', () => {
  it.each(['delete', 'restore'])('H5选择中%s后迟到元信息不进入确认', async (kind) => {
    await page();
    const imported = vi.spyOn(store, 'importFile');
    await choose();
    mutate(kind);
    await flushPromises();
    selected();
    await flushPromises();
    expect(modal).toBeNull();
    expect(readers).toHaveLength(0);
    expect(imported).not.toHaveBeenCalled();
  });
  it.each([
    'delete',
    'restore',
    'token',
    'token-cycle',
    'connection',
    'origins',
    'target',
    'consent',
    'hide',
    'unmount'
  ])('H5确认中%s后不读取正文', async (kind) => {
    await page();
    const imported = vi.spyOn(store, 'importFile');
    await choose();
    selected();
    const old = modal;
    mutate(kind);
    await flushPromises();
    old.success({ confirm: true });
    await flushPromises();
    expect(readers).toHaveLength(0);
    expect(imported).not.toHaveBeenCalled();
  });
  it.each([
    'delete',
    'restore',
    'token',
    'token-cycle',
    'connection',
    'origins',
    'target',
    'consent',
    'hide',
    'unmount'
  ])('H5读取中%s中止，迟到正文零导入', async (kind) => {
    await page();
    const imported = vi.spyOn(store, 'importFile');
    await choose();
    selected();
    modal.success({ confirm: true });
    const active = reader;
    expect(active.readAsDataURL).toHaveBeenCalledOnce();
    mutate(kind);
    await flushPromises();
    active.result = 'data:application/pdf;base64,dGVzdA==';
    active.onload();
    await flushPromises();
    expect(active.abort).toHaveBeenCalledOnce();
    expect(imported).not.toHaveBeenCalled();
  });
  it('H5普通学习记录更新不撤销许可，确认后只导入一次', async () => {
    await page();
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    await choose();
    selected();
    store.commit('profile.set', {
      field: 'foundation',
      value: '普通学习观察',
      source: 'self_report',
      scope: '当前任务'
    });
    modal.success({ confirm: true });
    reader.result = 'data:application/pdf;base64,dGVzdA==';
    reader.onload();
    await flushPromises();
    expect(imported).toHaveBeenCalledOnce();
    expect(imported).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'synthetic.pdf', contentBase64: 'dGVzdA==', allowRecognition: false })
    );
  });
  it.each(['delete', 'restore'])('微信隐私许可中%s后零选择/读取', async (kind) => {
    await page('weixin');
    const imported = vi.spyOn(store, 'importFile');
    await choose();
    mutate(kind);
    privacy.success({});
    await flushPromises();
    expect(globalThis.wx.chooseMessageFile).not.toHaveBeenCalled();
    expect(readData).toBeNull();
    expect(imported).not.toHaveBeenCalled();
  });
  it.each(['delete', 'restore'])('微信选择中%s后不确认/读取', async (kind) => {
    await page('weixin');
    await choose();
    privacy.success({});
    await flushPromises();
    mutate(kind);
    chooseFile.success({ tempFiles: [{ path: 'wxfile://synthetic', name: 'synthetic.pdf', size: 4 }] });
    await flushPromises();
    expect(modal).toBeNull();
    expect(readData).toBeNull();
  });
  it.each(['delete', 'restore', 'token', 'token-cycle', 'connection', 'origins'])(
    '微信确认中%s后零文件读取',
    async (kind) => {
      await page('weixin');
      await choose();
      await completeWeixinChoice();
      const old = modal;
      mutate(kind);
      old.success({ confirm: true });
      await flushPromises();
      expect(readData).toBeNull();
    }
  );
  it.each(['delete', 'restore', 'token', 'token-cycle', 'connection', 'origins', 'hide'])(
    '微信SDK读取中%s后丢弃迟到正文，不二次检查/导入',
    async (kind) => {
      await page('weixin');
      const imported = vi.spyOn(store, 'importFile');
      await choose();
      await completeWeixinChoice();
      modal.success({ confirm: true });
      await flushPromises();
      expect(readData).not.toBeNull();
      mutate(kind);
      await flushPromises();
      readData.success({ data: 'dGVzdA==' });
      await flushPromises();
      expect(stat).toHaveBeenCalledOnce();
      expect(imported).not.toHaveBeenCalled();
      expect(globalThis.wx.request).not.toHaveBeenCalled();
    }
  );
});
function health() {
  return { version: 'isolated-parser', pdfText: true, pagePreview: true };
}
describe('Store资料授权身份与异步回执', () => {
  it.each(['delete', 'restore', 'token', 'token-cycle', 'connection', 'origins'])(
    '健康检查中%s后不采用旧能力',
    async (kind) => {
      let resolve;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise((r) => {
              resolve = r;
            })
        )
      );
      const pending = store.checkMaterialConnection();
      const rejected = expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
      mutate(kind);
      resolve({ ok: true, text: async () => JSON.stringify({ success: true, data: health() }) });
      await rejected;
      expect(store.materialConnection.status).not.toBe('connector_verified');
    }
  );
  it.each(['token', 'token-cycle', 'connection', 'origins', 'target'])(
    '解析中%s后不保存旧回执/后续批次',
    async (kind) => {
      let resolve;
      const transport = vi
        .fn()
        .mockResolvedValue({
          ok: true,
          text: async () =>
            JSON.stringify({
              success: true,
              data: {
                id: 'synthetic',
                fingerprint: 'synthetic',
                scope: 'private',
                segments: [{ id: 'two', content: '第二批' }],
                totalPages: 6,
                nextPage: null
              }
            })
        })
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolve = r;
            })
        );
      vi.stubGlobal('fetch', transport);
      const pending = store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' });
      const rejected = expect(pending).rejects.toMatchObject({
        code: expect.stringMatching(/^(CONTEXT_CHANGED|CANCELLED)$/)
      });
      mutate(kind);
      resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              id: 'synthetic',
              fingerprint: 'synthetic',
              scope: 'private',
              segments: [{ id: 'one', content: '候选' }],
              totalPages: 6,
              nextPage: 6
            }
          })
      });
      await rejected;
      expect(store.state.materials).toHaveLength(0);
      expect(transport).toHaveBeenCalledOnce();
    }
  );
});

describe('文件动作只采用当前一次明确许可', () => {
  it('H5重复选择/确认/正文回调只读取与导入一次', async () => {
    await page();
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    await choose();
    selected();
    const consent = modal;
    picker.onchange();
    expect(modal).toBe(consent);
    consent.success({ confirm: true });
    consent.success({ confirm: true });
    expect(readers).toHaveLength(1);
    reader.result = 'data:application/pdf;base64,dGVzdA==';
    reader.onload();
    reader.onload();
    await flushPromises();
    expect(imported).toHaveBeenCalledOnce();
  });
  it('重新选择中止上一Reader，旧取消回调不撤销新许可', async () => {
    await page();
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    await choose();
    const oldPicker = picker;
    selected();
    modal.success({ confirm: true });
    const oldReader = reader;
    await choose();
    expect(oldReader.abort).toHaveBeenCalledOnce();
    oldPicker.oncancel();
    selected();
    modal.success({ confirm: true });
    oldReader.result = 'data:application/pdf;base64,dGVzdA==';
    oldReader.onload();
    reader.result = 'data:application/pdf;base64,dGVzdA==';
    reader.onload();
    await flushPromises();
    expect(imported).toHaveBeenCalledOnce();
  });
  it.each(['cancel', 'error'])('H5%s后迟到正文不导入，新动作可继续', async (kind) => {
    await page();
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    await choose();
    selected();
    if (kind === 'cancel') modal.success({ confirm: false });
    else {
      modal.success({ confirm: true });
      reader.onerror();
      reader.result = 'data:application/pdf;base64,dGVzdA==';
      reader.onload();
    }
    await flushPromises();
    expect(imported).not.toHaveBeenCalled();
    await choose();
    selected();
    modal.success({ confirm: true });
    reader.result = 'data:application/pdf;base64,dGVzdA==';
    reader.onload();
    await flushPromises();
    expect(imported).toHaveBeenCalledOnce();
  });
  it('微信明确许可后双次元信息核对、仅导入一次', async () => {
    await page('weixin');
    const imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    await choose();
    await completeWeixinChoice();
    modal.success({ confirm: true });
    await flushPromises();
    readData.success({ data: 'dGVzdA==' });
    readData.success({ data: 'dGVzdA==' });
    await flushPromises();
    expect(stat).toHaveBeenCalledTimes(2);
    expect(imported).toHaveBeenCalledOnce();
  });
  it('资料上下文不返回令牌，普通学习更新稳定、授权轮换失效', () => {
    const first = store.materialContext();
    expect(first).not.toContain(store.materialConnection.token);
    store.commit('profile.set', { field: 'foundation', value: '测试', source: 'self_report', scope: '当前任务' });
    expect(store.materialContext()).toBe(first);
    mutate('token-cycle');
    expect(store.materialContext()).not.toBe(first);
    const renewed = store.materialContext();
    mutate('delete');
    expect(store.materialContext()).not.toBe(renewed);
  });
  it('缺少连接的失败不锁住资料处理，未发请求', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    store.materialConnection = null;
    await expect(store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' })).rejects.toThrow();
    expect(store.materialBusy).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('App确认也拒绝恢复原值的旧授权', () => {
  it.each(['token-cycle', 'connection', 'origins'])('App确认期间%s后零正文读取', async (kind) => {
    await page('app');
    const imported = vi.spyOn(store, 'importFile');
    await choose();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '确认解析所选文件')
      .trigger('tap');
    mutate(kind);
    modal.success({ confirm: true });
    await flushPromises();
    expect(appBridge.readMaterialFile).not.toHaveBeenCalled();
    expect(imported).not.toHaveBeenCalled();
  });
  it.each(['token-cycle', 'connection'])('App读取中%s主动取消原生动作并丢弃迟到正文', async (kind) => {
    await page('app');
    const imported = vi.spyOn(store, 'importFile');
    let options, done;
    appBridge.readMaterialFile.mockImplementation((o, callback) => {
      options = o;
      done = callback;
    });
    await choose();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '确认解析所选文件')
      .trigger('tap');
    modal.success({ confirm: true });
    await flushPromises();
    mutate(kind);
    await flushPromises();
    expect(appBridge.cancelFileOperation).toHaveBeenCalledWith({ id: options.id });
    done({ id: options.id, handle: options.handle, name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' });
    await flushPromises();
    expect(imported).not.toHaveBeenCalled();
  });
});
