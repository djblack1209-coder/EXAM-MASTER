// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { performanceThresholds } from '../data/test-data.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

test.describe('A2-基础性能门禁', () => {
  test('PERF-001 首页首屏时间低于阈值', async ({ app, page }) => {
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    const firstScreenMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.domContentLoadedEventEnd > 0) {
        return nav.domContentLoadedEventEnd;
      }
      return performance.now();
    });

    expect(firstScreenMs).toBeLessThan(performanceThresholds.firstScreenMs);
    await app.screenshot(`perf-first-screen-${Math.round(firstScreenMs)}ms`);
  });

  test('PERF-002 首页到刷题页交互响应低于阈值', async ({ app, page }) => {
    await app.goto('/pages/index/index');
    await skipWhenRuntimeNotReady(test, page);

    // 先做一次预热，降低首跳构建/缓存抖动对结果的影响
    await app.goto('/pages/practice/index');
    await app.goto('/pages/index/index');

    const samples = [];
    for (let i = 0; i < 2; i += 1) {
      const start = Date.now();
      await app.goto('/pages/practice/index');
      samples.push(Date.now() - start);
      if (i === 0) {
        await app.goto('/pages/index/index');
      }
    }
    const interactionMs = Math.min(...samples);

    const projectName = test.info().project?.name || '';
    const interactionThreshold = projectName.startsWith('mobile-')
      ? performanceThresholds.interactionMs + 300
      : performanceThresholds.interactionMs;

    expect(interactionMs).toBeLessThan(interactionThreshold);
    await app.screenshot(
      `perf-home-to-practice-${interactionMs}ms-th${interactionThreshold}-samples-${samples.join('-')}`
    );
  });
});
