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

async function openEmailForm(page) {
  await clickVisible(page.locator('#e2e-login-email-entry').first());
  await expect(page.locator('#e2e-login-email').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('A2-登录与资料导入精细回归', () => {
  test('PREC-001 邮箱登录与注册密码输入默认隐藏', async ({ app, page }) => {
    await app.goto('/pages/login/index');
    await openEmailForm(page);

    await expect(page.locator('#e2e-login-toggle-password').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#e2e-login-password').first()).toHaveClass(/form-input-password/);
    await clickVisible(page.locator('#e2e-login-toggle-password').first());
    await expect(page.locator('#e2e-login-password').first()).not.toHaveClass(/form-input-password/);

    await clickVisible(page.locator('#e2e-login-toggle-register').first());
    await expect(page.locator('#e2e-login-toggle-register-password').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#e2e-login-register-password').first()).toHaveClass(/form-input-password/);
    await clickVisible(page.locator('#e2e-login-toggle-register-password').first());
    await expect(page.locator('#e2e-login-register-password').first()).not.toHaveClass(/form-input-password/);
  });

  test('PREC-002 邮箱注册发送验证码后显示倒计时并可成功注册', async ({ app, page }) => {
    await page.route('**/send-email-code*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, success: true, message: '验证码已发送，请查收邮件' })
      });
    });

    await page.route('**/login*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: {
            userId: 'email_user_1',
            token: 'email_token_1',
            isNewUser: true,
            userInfo: {
              nickname: '邮箱注册用户',
              avatar_url: ''
            }
          },
          message: '注册成功'
        })
      });
    });

    await app.goto('/pages/login/index');
    await openEmailForm(page);
    await clickVisible(page.locator('#e2e-login-agreement').first());
    await clickVisible(page.locator('#e2e-login-toggle-register').first());

    await page.locator('#e2e-login-email input').first().fill('user@example-mail.com');
    await clickVisible(page.locator('#e2e-login-send-code').first());
    await expect(page.locator('#e2e-login-send-code').first()).toContainText('60s', { timeout: 10_000 });

    await page.locator('#e2e-login-code input').first().fill('123456');
    await page.locator('#e2e-login-register-password input').first().fill('StrongPass1');
    await clickVisible(page.locator('#e2e-login-email-submit').first());

    await expect(page).toHaveURL(/#\/$|#\/pages\/index\/index$/, { timeout: 10_000 });
  });

  test('PREC-003 验证码发送后按钮进入倒计时而不是假死', async ({ app, page }) => {
    await page.route('**/send-email-code*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 429, success: false, message: '发送太频繁，请1分钟后再试', retryAfter: 42 })
      });
    });

    await app.goto('/pages/login/index');
    await openEmailForm(page);
    await clickVisible(page.locator('#e2e-login-toggle-register').first());
    await page.locator('#e2e-login-email input').first().fill('user@example-mail.com');
    await clickVisible(page.locator('#e2e-login-send-code').first());

    await expect(page.locator('#e2e-login-send-code').first()).toContainText(/\d+s/, { timeout: 10_000 });
  });

  test('PREC-004 欢迎横幅进入资料导入页后主卡片与操作栏不重叠', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.setStorage('v30_bank', []);
    await app.gotoHome();

    await clickVisible(page.locator('#e2e-home-banner-practice').first());
    await expectAnyTextVisible(page, ['题库空空如也', '去上传']);
    await clickVisible(page.getByText('去上传', { exact: false }).first());
    await expectRoute(page, '/pages/practice-sub/import-data');

    const mainCardBox = await page.locator('.main-glass-card').first().boundingBox();
    const actionBarBox = await page.locator('.bottom-action-bar').first().boundingBox();

    expect(mainCardBox).toBeTruthy();
    expect(actionBarBox).toBeTruthy();
    expect(actionBarBox.y).toBeGreaterThanOrEqual(mainCardBox.y + mainCardBox.height - 2);
  });
});
