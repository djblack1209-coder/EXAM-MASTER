// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectRoute } from '../helpers/assertions.js';

async function clickVisible(locator) {
  await locator
    .evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    })
    .catch(() => {});
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 10_000, force: true });
}

async function installUniUiSpy(page) {
  await page.evaluate(() => {
    window.__e2eUiSpy = { modals: [], toasts: [], actionSheets: [] };
    const uniApi = window.uni || {};

    uniApi.showModal = (options = {}) => {
      window.__e2eUiSpy.modals.push({
        title: options.title || '',
        content: options.content || '',
        confirmText: options.confirmText || ''
      });
      if (typeof options.success === 'function') {
        options.success({ confirm: true, cancel: false });
      }
    };

    uniApi.showToast = (options = {}) => {
      window.__e2eUiSpy.toasts.push({ title: options.title || '', icon: options.icon || '' });
    };

    uniApi.showActionSheet = (options = {}) => {
      window.__e2eUiSpy.actionSheets.push({ itemList: options.itemList || [] });
      if (typeof options.success === 'function') {
        options.success({ tapIndex: 0 });
      }
    };

    window.uni = uniApi;
  });
}

async function readUiSpy(page) {
  return page.evaluate(() => window.__e2eUiSpy || { modals: [], toasts: [], actionSheets: [] });
}

async function mockAccountDeleteApi(page, initialState = { status: 'active', remainingDays: null }) {
  let deletionState = { ...initialState };

  await page.route('**/account-delete*', async (route) => {
    let payload = {};
    try {
      payload = JSON.parse(route.request().postData() || '{}');
    } catch {
      payload = {};
    }

    if (payload.action === 'request') {
      deletionState = { status: 'pending_deletion', remainingDays: 7 };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: '7天冷静期内可撤销', data: deletionState })
      });
      return;
    }

    if (payload.action === 'cancel') {
      deletionState = { status: 'active', remainingDays: null };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: '注销已撤销', data: deletionState })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: deletionState })
    });
  });
}

test.describe('A2-个人中心与设置页精细交互', () => {
  test('PROFILE-SET-001 登录页协议链接、个人中心反馈与设置菜单都可触达', async ({ app, page }) => {
    await app.goto('/pages/login/index');
    await clickVisible(page.getByText('《隐私政策》', { exact: false }).first());
    await expectRoute(page, '/pages/settings/privacy');
    await expectAnyTextVisible(page, ['隐私政策', '更新日期']);

    await app.goto('/pages/login/index');
    await clickVisible(page.getByText('《用户协议》', { exact: false }).first());
    await expectRoute(page, '/pages/settings/terms');
    await expectAnyTextVisible(page, ['用户协议', '更新日期']);

    await app.setLoggedInSession();
    await app.goto('/pages/profile/index');
    await installUniUiSpy(page);

    await clickVisible(page.locator('#e2e-profile-menu-feedback').first());
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title).toBe('意见反馈');
    expect(uiSpy.modals.at(-1)?.content).toContain('feedback@exam-master.com');

    await clickVisible(page.locator('#e2e-profile-menu-settings').first());
    await expectRoute(page, '/pages/settings/index');
    await expectAnyTextVisible(page, ['设置', '深色模式', '清除缓存数据']);
  });

  test('PROFILE-SET-002 个人中心主题切换、退出确认与打卡按钮可响应', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/profile/index');
    await installUniUiSpy(page);

    const beforeIsDark = await page.locator('#e2e-profile-root').evaluate((el) => el.classList.contains('dark-mode'));
    await clickVisible(page.locator('#e2e-profile-theme-btn').first());
    const afterIsDark = await page.locator('#e2e-profile-root').evaluate((el) => el.classList.contains('dark-mode'));
    expect(afterIsDark).not.toBe(beforeIsDark);

    await clickVisible(page.locator('#e2e-profile-checkin-btn').first());
    const uiSpyAfterCheckin = await readUiSpy(page);
    const toastTitles = uiSpyAfterCheckin.toasts.map((item) => item.title).join(' | ');
    expect(toastTitles).toMatch(/打卡|今日已打卡/);

    await clickVisible(page.locator('#e2e-profile-logout-btn').first());
    const uiSpyAfterLogout = await readUiSpy(page);
    expect(uiSpyAfterLogout.modals.at(-1)?.title).toBe('确认退出');
  });

  test('PROFILE-SET-003 设置页开关、清缓存、目标院校弹窗与注销确认可响应', async ({ app, page }) => {
    await app.setLoggedInSession();
    await mockAccountDeleteApi(page);
    await app.setStorage('userInfo', { uid: 'e2e_user', _id: 'e2e_user', nickName: 'E2E User', avatarUrl: '' });
    await app.setStorage('target_schools', [{ name: 'E2E 示例大学', location: '北京', id: 'school_1' }]);
    await app.setStorage('cache_probe', { foo: 'bar' });
    await app.goto('/pages/settings/index');
    await installUniUiSpy(page);

    const darkBefore = await page.locator('#e2e-settings-root').evaluate((el) => el.classList.contains('dark-mode'));
    await clickVisible(page.locator('#e2e-settings-dark-switch').first());
    const darkAfter = await page.locator('#e2e-settings-root').evaluate((el) => el.classList.contains('dark-mode'));
    expect(darkAfter).not.toBe(darkBefore);

    await clickVisible(page.locator('#e2e-settings-voice-switch').first());
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.toasts.some((item) => /语音伴学/.test(item.title))).toBe(true);

    await clickVisible(page.locator('#e2e-settings-target-school-stat').first());
    await expect(page.getByText('目标院校管理', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await clickVisible(page.locator('#e2e-settings-target-modal-close').first());

    await clickVisible(page.locator('#e2e-settings-clear-cache').first());
    const uiSpyAfterCache = await readUiSpy(page);
    expect(uiSpyAfterCache.modals.some((item) => item.title === '提示')).toBe(true);
    expect(uiSpyAfterCache.toasts.some((item) => item.title === '缓存已清理')).toBe(true);

    await clickVisible(page.locator('#e2e-settings-delete-account').first());
    const uiSpyAfterDelete = await readUiSpy(page);
    expect(uiSpyAfterDelete.modals.some((item) => item.title === '注销账号')).toBe(true);
  });

  test('PROFILE-SET-004 设置页目标院校删除与注销撤销状态可自动验证', async ({ app, page }) => {
    await app.setLoggedInSession();
    await mockAccountDeleteApi(page, { status: 'pending_deletion', remainingDays: 7 });
    await app.setStorage('userInfo', { uid: 'e2e_user', _id: 'e2e_user', nickName: 'E2E User', avatarUrl: '' });
    await app.setStorage('target_schools', [{ name: 'E2E 示例大学', location: '北京', id: 'school_1' }]);
    await app.goto('/pages/settings/index');
    await installUniUiSpy(page);

    await clickVisible(page.locator('#e2e-settings-target-school-stat').first());
    await clickVisible(page.getByText('删除', { exact: false }).first());
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.some((item) => item.title === '确认删除')).toBe(true);
    await page.reload();
    await expect(page.locator('#e2e-settings-target-school-stat').first()).toContainText('0');

    await expect(page.getByText('账号注销中', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await clickVisible(page.getByText('撤销注销', { exact: false }).first());
  });
});
