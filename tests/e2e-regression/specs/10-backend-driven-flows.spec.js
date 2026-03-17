// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectRoute } from '../helpers/assertions.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

async function clickVisible(locator) {
  await locator
    .evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    })
    .catch(() => {});
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 10_000, force: true });
}

test.describe('A2-后端返回重点流转', () => {
  test('BACK-001 择校表单提交后真实渲染后端推荐结果，并可进入详情页', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/school/index');
    await skipWhenRuntimeNotReady(test, page);

    await page.locator('#e2e-school-input-current-school input').first().fill('示例本科大学');
    await page.locator('#e2e-school-input-current-major input').first().fill('计算机科学与技术');
    await clickVisible(page.locator('#e2e-school-step1-next'));

    await page.locator('#e2e-school-input-target-school input').first().fill('E2E 示例大学');
    await page.locator('#e2e-school-input-target-major input').first().fill('人工智能');
    await clickVisible(page.locator('#e2e-school-step2-submit'));

    await expect(page.locator('#e2e-school-result-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('E2E 示例大学', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('E2E 智能学院', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await expectAnyTextVisible(page, ['本次智能分析说明', '已解析到 2 所推荐院校', '匹配度']);

    await clickVisible(page.locator('#e2e-school-card-detail-0'));
    await expectRoute(page, '/pages/school-sub/detail');
    await expectAnyTextVisible(page, ['E2E 示例大学', '智能录取概率预测', '智能咨询', '计算机科学与技术']);
  });

  test('BACK-002 智能好友聊天真实发送后可渲染后端回复', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/chat/chat');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['和智能好友聊聊', '清华学霸', '发送']);
    await page.locator('#e2e-chat-input input').first().fill('我最近复习效率有点低，怎么办？');
    await clickVisible(page.locator('#e2e-chat-send'));

    await expect(page.getByText('我最近复习效率有点低，怎么办？', { exact: false }).first()).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByText('这是后端返回的智能好友回复', { exact: false }).first()).toBeVisible({
      timeout: 20_000
    });
  });
});
