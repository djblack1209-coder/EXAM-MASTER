import { observeLearningDialogs } from '../setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import {
  appMaterialSupported,
  chooseAppMaterialFile,
  readAppMaterialFile,
  releaseAppMaterialFile
} from '@/services/learning/app-material.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningPage from '@/pages/learning/index.vue';
const hooks = vi.hoisted(() => ({ show: [], hide: [] }));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (fn) => {
    hooks.show.push(fn);
  },
  onHide: (fn) => {
    hooks.hide.push(fn);
  },
  onLoad: vi.fn(),
  onBackPress: vi.fn()
}));
const file = { handle: 'file_01234567-0123-4567-89ab-0123456789ab', name: '合成.pdf', size: 4 };
const connection = {
  endpoint: 'https://connector.invalid/parse',
  token: 'TEST_ONLY_APP_MATERIAL_TOKEN_32_CHARS',
  allowedOrigins: ['https://connector.invalid'],
  consent: true,
  status: 'connector_verified'
};
const caps = () => ({
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
});
let bridge, wrapper;
beforeEach(() => {
  hooks.show.length = 0;
  hooks.hide.length = 0;
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'synthetic-app-material-owner');
  setActivePinia(createPinia());
  vi.stubGlobal('plus', { os: { name: 'Android' } });
  bridge = {
    getCapabilities: caps,
    request: vi.fn(),
    cancel: vi.fn(),
    chooseMaterialFile: vi.fn((o, done) => done({ id: o.id, file })),
    readMaterialFile: vi.fn((o, done) =>
      done({ id: o.id, handle: o.handle, name: file.name, size: file.size, contentBase64: 'dGVzdA==' })
    ),
    releaseMaterialFile: vi.fn(),
    cancelFileOperation: vi.fn()
  };
  uni.requireNativePlugin = vi.fn(() => bridge);
  wrapper = null;
});
afterEach(() => {
  wrapper?.unmount();
  delete uni.requireNativePlugin;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('App文件能力与临时句柄', () => {
  it.each(['contract', 'selection', 'read', 'handles', 'maxBytes', 'boundedRead', 'cancel'])(
    '缺%s文件保护合同零选择/读取',
    async (field) => {
      const value = caps();
      delete value.file[field];
      bridge.getCapabilities = () => value;
      expect(appMaterialSupported()).toBe(false);
      await expect(chooseAppMaterialFile()).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
      expect(bridge.chooseMaterialFile).not.toHaveBeenCalled();
      expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    }
  );
  it('选择只返回白名单元信息，不读正文、不发网络或泄露路径', async () => {
    bridge.chooseMaterialFile.mockImplementation((o, done) =>
      done({
        id: o.id,
        file: { ...file, url: 'file:///private/ignored', path: 'must-not-leave', contentBase64: 'must-not-read' }
      })
    );
    expect(await chooseAppMaterialFile()).toEqual(file);
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    expect(bridge.request).not.toHaveBeenCalled();
    expect(Object.keys(bridge.chooseMaterialFile.mock.calls[0][0])).toEqual(['id']);
  });
  it.each([{}, { consent: false }, { consent: 1 }])('未明确同意%j不打开原件', async (options) => {
    await expect(readAppMaterialFile(file, options)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
  });
  it('明确同意读取当前句柄，输出不带路径/句柄且总会释放', async () => {
    expect(await readAppMaterialFile(file, { consent: true })).toEqual({
      name: file.name,
      size: 4,
      contentBase64: 'dGVzdA=='
    });
    expect(bridge.readMaterialFile.mock.calls[0][0]).toMatchObject({
      handle: file.handle,
      consent: true,
      name: file.name,
      size: 4
    });
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it.each([
    { handle: 'file:///private/path' },
    { name: 'not-a-supported.exe' },
    { name: 'a/b.pdf' },
    { name: 'a\u0085.pdf' },
    { name: 'a\u202e.pdf' },
    { name: 'a\u2066.pdf' },
    { size: 10485761 },
    { size: 0 },
    { size: 1.5 }
  ])('非法元信息%j不读取或发送', async (patch) => {
    bridge.chooseMaterialFile.mockImplementation((o, done) => done({ id: o.id, file: { ...file, ...patch } }));
    await expect(chooseAppMaterialFile()).rejects.toThrow();
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it.each([
    { handle: 'file_11111111-1111-4111-8111-111111111111' },
    { name: 'different.pdf' },
    { size: 5 },
    { contentBase64: 'broken' },
    { contentBase64: 'dGVzdB==' }
  ])('字节/身份/编码%j变化拒绝并释放', async (patch) => {
    bridge.readMaterialFile.mockImplementation((o, done) =>
      done({ id: o.id, ...file, contentBase64: 'dGVzdA==', ...patch })
    );
    await expect(readAppMaterialFile(file, { consent: true })).rejects.toMatchObject({ code: 'FILE_CHANGED' });
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it('前置归属变化零选择；选择回调归属变化释放本请求句柄', async () => {
    await expect(
      chooseAppMaterialFile({
        assertCurrent: () => {
          throw new Error('归属变化');
        }
      })
    ).rejects.toThrow('归属变化');
    expect(bridge.chooseMaterialFile).not.toHaveBeenCalled();
    let calls = 0;
    await expect(
      chooseAppMaterialFile({
        assertCurrent: () => {
          if (++calls > 1) throw new Error('归属变化');
        }
      })
    ).rejects.toThrow('归属变化');
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
  });
  it('预取消零动作，在途取消忽略迟到元信息并释放对应句柄', async () => {
    const early = new AbortController();
    early.abort();
    await expect(chooseAppMaterialFile({ signal: early.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(bridge.chooseMaterialFile).not.toHaveBeenCalled();
    let done, input;
    bridge.chooseMaterialFile.mockImplementation((o, cb) => {
      input = o;
      done = cb;
    });
    const controller = new AbortController(),
      p = chooseAppMaterialFile({ signal: controller.signal }),
      rejected = expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
    controller.abort();
    await rejected;
    done({ id: input.id, file });
    expect(bridge.cancelFileOperation).toHaveBeenCalledWith({ id: input.id });
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
  });
  it('硬超时取消读取，不回退其他文件API/传输', async () => {
    vi.useFakeTimers();
    bridge.readMaterialFile.mockImplementation(() => {});
    const p = readAppMaterialFile(file, { consent: true }),
      rejected = expect(p).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(bridge.cancelFileOperation).toHaveBeenCalledOnce();
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
    expect(bridge.request).not.toHaveBeenCalled();
  });
  it('原生异常固定错误码，错误字符串不带原件路径', async () => {
    bridge.readMaterialFile.mockImplementation(() => {
      throw new Error('file:///private/SYNTHETIC_ERROR');
    });
    const e = await readAppMaterialFile(file, { consent: true }).catch((error) => error);
    expect(e.code).toBe('FILE_READ_FAILED');
    expect(e.message).not.toContain('/private');
    releaseAppMaterialFile(file);
  });
});
describe('App页面选择/重新授权/逐次许可', () => {
  const choose = () => wrapper.findAll('button').find((b) => b.text() === '选择 PDF / 作答图片');
  const parse = () => wrapper.findAll('button').find((b) => b.text() === '确认解析所选文件');
  const page = async () => {
    const store = useConversationLearningStore();
    wrapper = mount(LearningPage);
    await wrapper.get('#learning-composer [aria-label="导入资料"]').trigger('tap');
    await flushPromises();
    return store;
  };
  it('真实页面选择阶段不读取；隐藏清空连接，返回仍须重授权后确认才导入', async () => {
    const store = await page(),
      imported = vi.spyOn(store, 'importFile').mockResolvedValue({ nextPage: null });
    store.materialConnection = { ...connection };
    let picked, o;
    bridge.chooseMaterialFile.mockImplementation((input, done) => {
      o = input;
      picked = done;
    });
    await choose().trigger('tap');
    await flushPromises();
    hooks.hide.forEach((fn) => fn());
    expect(store.materialConnection).toBeNull();
    hooks.show.forEach((fn) => fn());
    picked({ id: o.id, file });
    await flushPromises();
    expect(wrapper.find('[data-test="app-selected-file"]').exists()).toBe(true);
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    await parse().trigger('tap');
    await flushPromises();
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    store.materialConnection = { ...connection };
    observeLearningDialogs(wrapper, (options) => options.success({ confirm: true }));
    await parse().trigger('tap');
    await flushPromises();
    expect(bridge.readMaterialFile).toHaveBeenCalledOnce();
    expect(imported).toHaveBeenCalledWith({
      name: file.name,
      size: 4,
      contentBase64: 'dGVzdA==',
      allowRecognition: false,
      actionContext: store.materialContext()
    });
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
    expect(wrapper.find('[data-test="app-selected-file"]').exists()).toBe(false);
  });
  it('用户取消确认零读取/导入，释放临时文件', async () => {
    const store = await page(),
      imported = vi.spyOn(store, 'importFile');
    store.materialConnection = { ...connection };
    await choose().trigger('tap');
    await flushPromises();
    observeLearningDialogs(wrapper, (o) => o.success({ confirm: false }));
    await parse().trigger('tap');
    await flushPromises();
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    expect(imported).not.toHaveBeenCalled();
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
  });
  it('实际页面经读取、受保护传输、Store落私人资料并刷新，失败回执不增记录', async () => {
    const store = await page();
    store.materialConnection = { ...connection };
    let fail = false;
    bridge.request.mockImplementation((input, done) => {
      expect(input.url).toBe(connection.endpoint);
      const sent = JSON.parse(input.body);
      expect(sent).toMatchObject({ name: file.name, contentBase64: 'dGVzdA==', allowOCR: false });
      const body = JSON.stringify(
        fail
          ? { success: false }
          : {
              success: true,
              data: {
                id: 'synthetic-material',
                fingerprint: 'synthetic-fingerprint',
                kind: 'pdf',
                name: file.name,
                scope: 'private',
                extractionVersion: 'synthetic-parser-v1',
                segments: [{ id: 'page-1', page: 1, content: '合成私人正文' }],
                totalPages: 1,
                nextPage: null,
                status: 'ready'
              }
            }
      );
      done({ id: input.id, status: fail ? 403 : 200, body, receivedBytes: new TextEncoder().encode(body).length });
    });
    observeLearningDialogs(wrapper, (o) => o.success({ confirm: true }));
    await choose().trigger('tap');
    await flushPromises();
    expect(store.state.materials).toHaveLength(0);
    await parse().trigger('tap');
    await flushPromises();
    expect(store.state.materials).toHaveLength(1);
    expect(store.state.materials[0].segments[0].content).toBe('合成私人正文');
    store.refresh();
    expect(store.state.materials).toHaveLength(1);
    expect(store.exportData()).not.toContain(connection.token);
    expect(store.exportData()).not.toContain(file.handle);
    fail = true;
    await choose().trigger('tap');
    await flushPromises();
    await parse().trigger('tap');
    await flushPromises();
    expect(store.state.materials).toHaveLength(1);
    expect(bridge.request).toHaveBeenCalledTimes(2);
  });
  it.each(['connection', 'same-object-token', 'hide'])('确认期间%s变化拒绝正文读取', async (kind) => {
    const store = await page();
    store.materialConnection = { ...connection };
    await choose().trigger('tap');
    await flushPromises();
    observeLearningDialogs(wrapper, (o) => {
      if (kind === 'connection') store.materialConnection = { ...connection };
      else if (kind === 'same-object-token') store.materialConnection.token = 'CHANGED_SYNTHETIC_TOKEN_32_CHARS_123';
      else hooks.hide.forEach((fn) => fn());
      o.success({ confirm: true });
    });
    await parse().trigger('tap');
    await flushPromises();
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    expect(bridge.request).not.toHaveBeenCalled();
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
  });
  it('卸载中取消选择；迟到回执释放且不产生学习事实', async () => {
    const store = await page();
    let input, done;
    bridge.chooseMaterialFile.mockImplementation((o, cb) => {
      input = o;
      done = cb;
    });
    await choose().trigger('tap');
    await flushPromises();
    wrapper.unmount();
    wrapper = null;
    done({ id: input.id, file });
    await flushPromises();
    expect(bridge.cancelFileOperation).toHaveBeenCalledWith({ id: input.id });
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
    expect(store.state.materials).toHaveLength(0);
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
  });
  it('选择后切换账户释放原句柄，不把原账户文件交给新账户', async () => {
    const store = await page();
    await choose().trigger('tap');
    await flushPromises();
    uni.setStorageSync('EXAM_USER_ID', 'synthetic-second-owner');
    store.refresh();
    await flushPromises();
    expect(wrapper.find('[data-test="app-selected-file"]').exists()).toBe(false);
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
    expect(store.state.materials).toHaveLength(0);
  });
  it.each(['cancel', 'hide', 'owner', 'delete'])('在途读取%s后迟到正文不能导入', async (kind) => {
    const store = await page(),
      imported = vi.spyOn(store, 'importFile');
    store.materialConnection = { ...connection };
    await choose().trigger('tap');
    await flushPromises();
    let input, done;
    bridge.readMaterialFile.mockImplementation((o, cb) => {
      input = o;
      done = cb;
    });
    observeLearningDialogs(wrapper, (o) => o.success({ confirm: true }));
    await parse().trigger('tap');
    await flushPromises();
    expect(bridge.readMaterialFile).toHaveBeenCalledOnce();
    if (kind === 'cancel')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '取消所选文件')
        .trigger('tap');
    else if (kind === 'hide') hooks.hide.forEach((fn) => fn());
    else if (kind === 'delete') store.deleteData();
    else {
      uni.setStorageSync('EXAM_USER_ID', 'synthetic-second-owner');
      store.refresh();
    }
    await flushPromises();
    done({ id: input.id, ...file, contentBase64: 'dGVzdA==' });
    await flushPromises();
    expect(bridge.cancelFileOperation).toHaveBeenCalledWith({ id: input.id });
    expect(bridge.releaseMaterialFile).toHaveBeenCalled();
    expect(imported).not.toHaveBeenCalled();
    expect(store.state.materials).toHaveLength(0);
  });
  it('同账户清除记录后，已选择但未确认的文件不能重新进入新记录', async () => {
    const store = await page();
    store.materialConnection = { ...connection };
    await choose().trigger('tap');
    await flushPromises();
    store.deleteData();
    await flushPromises();
    expect(wrapper.find('[data-test="app-selected-file"]').exists()).toBe(false);
    expect(bridge.releaseMaterialFile).toHaveBeenCalledWith({ handle: file.handle });
    expect(bridge.readMaterialFile).not.toHaveBeenCalled();
  });
});
