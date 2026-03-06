// @ts-nocheck
import { test } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible } from '../helpers/assertions.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

test.describe('A2-人工手势模拟', () => {
  test('HUMAN-001 首页上滑后页面保持可交互', async ({ app, page }) => {
    await app.goto('/pages/index/index');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['实用工具', '待办事项', '首页']);
    await app.actions.swipeUp();
    await app.actions.swipeUp();

    await expectAnyTextVisible(page, ['实用工具', '待办事项', '文档转换']);
    await app.screenshot('human-gesture-home-swipe-up');
  });
});
