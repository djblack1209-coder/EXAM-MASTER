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
