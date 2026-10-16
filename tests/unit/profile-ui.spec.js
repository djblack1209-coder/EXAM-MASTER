import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('profile page static UI contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/pages/profile/index.vue'), 'utf8');

  it('does not render escaped HTML entities for menu arrows', () => {
    expect(source).not.toContain('<text class="menu-arrow">></text>');
    expect(source).toContain('<BaseListRow');
    expect(source).toContain("goTo('/pages/settings/privacy')");
  });
});

import ProfilePage from '@/pages/profile/index.vue';
import { requestProfilePanel, consumeProfilePanel, safeNavigateTo } from '@/utils/safe-navigate.js';

describe('profile panel navigation across page registration', () => {
  afterEach(() => {
    consumeProfilePanel();
    vi.restoreAllMocks();
  });
  function page() {
    const context = {
      settingsMode: false,
      syncTheme: vi.fn(),
      initLayout: vi.fn(),
      studyStore: { restoreProgress: vi.fn() },
      userStore: { restoreUserInfo: vi.fn() }
    };
    context.syncPanelTitle = ProfilePage.methods.syncPanelTitle.bind(context);
    context.setProfilePanel = ProfilePage.methods.setProfilePanel.bind(context);
    return context;
  }
  it('first tab navigation retains settings until onLoad, even when success precedes registration', () => {
    uni.setNavigationBarTitle = vi.fn();
    vi.spyOn(uni, 'switchTab').mockImplementation(({ success }) => success?.({}));
    requestProfilePanel('settings');
    safeNavigateTo('/pages/profile/index');
    const context = page();
    ProfilePage.onLoad.call(context, {});
    ProfilePage.onShow.call(context);
    expect(context.settingsMode).toBe(true);
    expect(uni.setNavigationBarTitle).toHaveBeenLastCalledWith({ title: '设置' });
    expect(consumeProfilePanel()).toBeNull();
  });
  it('a reused tab consumes each latest target once in onShow', () => {
    const context = page();
    requestProfilePanel('settings');
    ProfilePage.onShow.call(context);
    expect(context.settingsMode).toBe(true);
    ProfilePage.onShow.call(context);
    expect(context.settingsMode).toBe(true);
    requestProfilePanel('profile');
    ProfilePage.onShow.call(context);
    expect(context.settingsMode).toBe(false);
  });
  it('an already visible tab consumes the target through its listener', () => {
    const context = page();
    requestProfilePanel('settings');
    context.setProfilePanel();
    expect(context.settingsMode).toBe(true);
    expect(consumeProfilePanel()).toBeNull();
  });
});

it('order-03: mounted profile reacts to unavailable, recovery and revoked login without stale alias fallback', async () => {
  const { createPinia, setActivePinia } = await import('pinia');
  const { mount } = await import('@vue/test-utils');
  const { nextTick } = await import('vue');
  const { storageService } = await import('@/services/storageService.js');
  const { useUserStore } = await import('@/stores/modules/user.js');
  uni.clearStorageSync();
  const pinia = createPinia();
  setActivePinia(pinia);
  storageService.saveLoginSession({
    userId: 'profile-fixture',
    token: 'fixture-profile-token',
    userInfo: { id: 'profile-fixture', nickName: '保留昵称' }
  });
  const user = useUserStore();
  await user.setUserInfo({ id: 'profile-fixture', nickName: '保留昵称' });
  user.restoreUserInfo();
  const wrapper = mount(ProfilePage, {
    global: {
      plugins: [pinia],
      stubs: { LearningShell: { template: '<div><slot/></div>' }, CustomModal: true, CustomTabbar: true, image: true }
    }
  });
  try {
    expect(wrapper.vm.isLoggedIn).toBe(true);
    user.sessionStatus = 'unavailable';
    await nextTick();
    expect(wrapper.vm.isLoggedIn).toBeNull();
    expect(wrapper.get('[role="status"]').text()).toContain('暂不可用');
    expect(wrapper.text()).not.toContain('未登录');
    expect(user.userInfo.nickName).toBe('保留昵称');
    user.sessionStatus = 'current';
    await nextTick();
    expect(wrapper.vm.isLoggedIn).toBe(true);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    uni.removeStorageSync('_enc_EXAM_SESSION_EPOCH');
    user.sessionStatus = 'changed';
    user.isLogin = false;
    await nextTick();
    expect(wrapper.vm.isLoggedIn).toBe(false);
    expect(wrapper.text()).toContain('登录后同步学习轨迹');
  } finally {
    wrapper.unmount();
    for (const store of pinia._s.values()) store.$dispose();
  }
});
