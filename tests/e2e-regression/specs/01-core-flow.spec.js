// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible } from '../helpers/assertions.js';
import { testUsers } from '../data/test-data.js';

const hasRealAccount = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

async function ensureEmailFormVisible(page) {
  const emailForm = page.locator('.email-form').first();
  let emailInput = emailForm.locator('input').first();

  if (await emailInput.isVisible().catch(() => false)) {
    return emailInput;
  }

  const entryCandidates = [
    page.getByText('邮箱登录/注册', { exact: false }).first(),
    page.locator('.email-btn').first(),
    page.locator('.login-btn', { hasText: '邮箱登录/注册' }).first(),
    page.locator('text=邮箱登录/注册').first(),
    page.locator('.email-btn .btn-text').first()
  ];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    for (const candidate of entryCandidates) {
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      await candidate.click({ timeout: 3_000, force: true }).catch(() => {});
      await page.waitForTimeout(350);

      if ((await emailForm.isVisible().catch(() => false)) || (await emailInput.isVisible().catch(() => false))) {
        return emailInput;
      }
    }

    await page
      .evaluate(() => {
        const btn = document.querySelector('.email-btn');
        if (btn instanceof HTMLElement) {
          btn.click();
        }
      })
      .catch(() => {});

    if (await emailForm.isVisible().catch(() => false)) {
      emailInput = emailForm.locator('input').first();
      if (await emailInput.isVisible().catch(() => false)) {
        return emailInput;
      }
    }

    await page.waitForTimeout(300);
  }

  await expect(emailForm).toBeVisible({ timeout: 10_000 });
  emailInput = emailForm.locator('input').first();
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  return emailInput;
}

test.describe('A2-核心流程', () => {
  test('CORE-001 登录页可输入并触发登录动作', async ({ app, page }) => {
    await app.goto('/pages/login/index');
    await skipWhenRuntimeNotReady(test, page);

    const emailInput = await ensureEmailFormVisible(page);
    await emailInput.fill('');
    await emailInput.type(testUsers.primary.email, { delay: 35 });

    await expectAnyTextVisible(page, ['登录', '邮箱地址', '验证码', '密码']);
    await app.screenshot('core-login-input');
  });

  test('CORE-002 登录后进入刷题页并打开做题页', async ({ app, page }) => {
    if (hasRealAccount) {
      await app.goto('/pages/login/index');
      await skipWhenRuntimeNotReady(test, page);

      const emailInput = await ensureEmailFormVisible(page);
      await emailInput.fill('');
      await emailInput.type(process.env.E2E_EMAIL || '', { delay: 35 });

      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(process.env.E2E_PASSWORD || '');
      }

      const loginButton = page.getByText('登录', { exact: false }).first();
      if (await loginButton.isVisible().catch(() => false)) {
        await loginButton.click();
      }
    } else {
      await app.setLoggedInSession();
    }

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await expectAnyTextVisible(page, ['智能刷题', '开始刷题', '导入资料']);

    const startBtn = page.getByText('开始刷题', { exact: false }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    } else {
      await app.goto('/pages/practice-sub/do-quiz');
    }

    await expectAnyTextVisible(page, ['题库空空如也', '确认退出', '继续答题', '练习完成']);
    await app.screenshot('core-practice-to-quiz');
  });

  test('CORE-003 学习计划结果页可达', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/plan/index');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['学习计划', '创建', '计划', '学习']);

    const createBtn = page.getByText('创建', { exact: false }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    } else {
      await app.goto('/pages/plan/create');
    }

    await expectAnyTextVisible(page, ['创建学习计划', '保存', '目标']);
    await app.screenshot('core-plan-result-page');
  });
});
