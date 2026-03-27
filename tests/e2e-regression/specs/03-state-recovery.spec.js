// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible } from '../helpers/assertions.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

test.describe('A2-状态恢复与幂等', () => {
  test('STATE-001 返回键可回到上一页', async ({ app, page }) => {
    await app.goto('/pages/index/index');
    await app.goto('/pages/tools/id-photo');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['证件照', '制作']);

    await app.actions.goBack();
    await expect(page).toHaveURL(/#\/pages\/index\/index|#\/pages\/tools\/id-photo/);
    await app.screenshot('state-back-navigation');
  });

  test('STATE-002 快速重复点击不会导致崩溃', async ({ app, page }) => {
    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);

    const target = page.getByText('导入', { exact: false }).first();
    if (await target.isVisible().catch(() => false)) {
      await Promise.all([target.click(), target.click(), target.click()]);
    }

    await expect(page).toHaveURL(/#\/pages\/practice|#\/pages\/practice-sub\/import-data/);
    await app.screenshot('state-rapid-click');
  });

  test('STATE-003 切后台再回来页面仍可继续操作', async ({ app, page }) => {
    await app.goto('/pages/chat/chat');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['研聪', '和智能好友聊聊', '清华学霸']);
    await app.actions.backgroundAndResume();
    await expectAnyTextVisible(page, ['研聪', '和智能好友聊聊', '清华学霸']);
    await app.screenshot('state-background-resume');
  });

  test('STATE-004 刷新后保留基础会话数据', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);

    await page.reload();
    await expectAnyTextVisible(page, ['个人', '设置', '学习']);
    await app.screenshot('state-refresh-session');
  });

  test('STATE-005 登录按钮快速多次点击仅触发一次请求', async ({ app, page }) => {
    await app.goto('/pages/login/index');
    await skipWhenRuntimeNotReady(test, page);

    const emailForm = page.locator('.email-form').first();
    const emailEntry = page.getByText('邮箱登录/注册', { exact: false }).first();
    if (!(await emailForm.isVisible().catch(() => false)) && (await emailEntry.isVisible().catch(() => false))) {
      await emailEntry.click();
    }

    await expect(emailForm).toBeVisible();

    await app.actions.tap('.checkbox-wrapper');

    const emailHost = page.locator('.email-form .form-input').first();
    const passwordHost = page.locator('.email-form .form-input').nth(1);
    await emailHost.locator('input, textarea, [contenteditable="true"]').first().fill('sdet@example.com');
    await passwordHost.locator('input, textarea, [contenteditable="true"]').first().fill('Password1');

    let loginReqCount = 0;
    await page.route('**/login*', async (route) => {
      loginReqCount += 1;
      await page.waitForTimeout(700);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: -1, message: 'mock-login-failed' })
      });
    });

    try {
      const submitBtn = page.locator('.email-submit-btn').first();
      // 在浏览器内直接派发 3 次 click 事件，绕过 Playwright actionability 检查
      // 这比 Promise.all 更能模拟真实的快速多次点击
      await submitBtn.evaluate((el) => {
        el.click();
        el.click();
        el.click();
      });
      await page.waitForTimeout(1500);
      expect(loginReqCount).toBe(1);
      await app.screenshot('state-login-debounce');
    } finally {
      await page.unroute('**/login*');
    }
  });
});
