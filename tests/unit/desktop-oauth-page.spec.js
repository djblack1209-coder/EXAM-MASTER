import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import LoginPage from '@/pages/login/index.vue';
import { getToken, getUserId } from '@/services/auth-storage.js';

const mocks = vi.hoisted(() => ({
  show: [],
  hide: [],
  desktop: vi.fn(),
  exchange: vi.fn(),
  info: vi.fn(),
  success: vi.fn()
}));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (callback) => mocks.show.push(callback),
  onHide: (callback) => mocks.hide.push(callback)
}));
vi.mock('@/services/desktop/oauth.js', () => ({ loginDesktopOAuth: mocks.desktop }));
vi.mock('@/stores/modules/auth', () => ({
  useAuthStore: () => ({
    desktopOAuth: mocks.exchange,
    regionalLogin: async () => ({ code: 0, data: { wechat: true } })
  })
}));
vi.mock('@/utils/toast.js', () => ({
  toast: { info: mocks.info, success: mocks.success, hide: vi.fn(), loading: vi.fn() }
}));
vi.mock('@/utils/logger.js', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const wrappers = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.show.length = 0;
  mocks.hide.length = 0;
  setActivePinia(createPinia());
  uni.clearStorageSync();
  uni.setStorageSync('yozi_login_region', 'CN');
  localStorage.clear();
  vi.stubGlobal('uni', { ...uni, getProvider: vi.fn(({ success }) => success?.({ provider: [] })) });
  vi.stubGlobal('__WENLI_DESKTOP__', true);
  window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.__TAURI_INTERNALS__;
});

function openLogin() {
  const wrapper = mount(LoginPage, {
    global: {
      stubs: {
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' },
        image: true,
        BaseIcon: true,
        PrivacyPopup: true
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
const ready = {
  code: 0,
  data: { userId: 'isolated-page-user', token: 'isolated-page-token', userInfo: { nickname: '验收' } }
};

describe('desktop login page lifetime', () => {
  it.each([false, true])(
    'leaving the page invalidates a delayed identity even if it becomes visible again: %s',
    async (returnBeforeReply) => {
      let resolve, current;
      mocks.desktop.mockImplementation((_provider, _exchange, isCurrent) => {
        current = isCurrent;
        return new Promise((done) => {
          resolve = done;
        });
      });
      const wrapper = openLogin();
      await vi.advanceTimersByTimeAsync(0);
      await wrapper.find('#e2e-login-agreement').trigger('tap');
      const button = wrapper.findAll('.wechat-btn').find((node) => node.text().includes('微信登录'));
      await button.trigger('tap');
      expect(mocks.desktop).toHaveBeenCalledOnce();
      expect(current()).toBe(true);
      mocks.hide.forEach((callback) => callback());
      if (returnBeforeReply) mocks.show.forEach((callback) => callback());
      expect(current()).toBe(false);
      resolve(ready);
      await vi.advanceTimersByTimeAsync(0);
      expect(getToken()).toBeNull();
      expect(getUserId()).toBeNull();
      expect(mocks.success).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2000);
      expect(uni.redirectTo).not.toHaveBeenCalled();
      expect(uni.switchTab).not.toHaveBeenCalled();
    }
  );
  it('an accepted identity is saved but hiding and returning cancels its delayed navigation', async () => {
    mocks.desktop.mockResolvedValueOnce(ready);
    const wrapper = openLogin();
    await vi.advanceTimersByTimeAsync(0);
    await wrapper.find('#e2e-login-agreement').trigger('tap');
    await wrapper
      .findAll('.wechat-btn')
      .find((node) => node.text().includes('微信登录'))
      .trigger('tap');
    await vi.advanceTimersByTimeAsync(0);
    expect(getToken()).toBe('isolated-page-token');
    expect(getUserId()).toBe('isolated-page-user');
    mocks.hide.forEach((callback) => callback());
    mocks.show.forEach((callback) => callback());
    await vi.advanceTimersByTimeAsync(2000);
    expect(uni.redirectTo).not.toHaveBeenCalled();
    expect(uni.switchTab).not.toHaveBeenCalled();
  });
});
