// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { HumanActions } from '../helpers/human-actions.js';
import { buildH5Route, expectedRoutesFor, loadDeclaredRoutes, routeSnapshotSlug } from '../../shared/page-routes.js';

const ALL_DECLARED_ROUTES = loadDeclaredRoutes();

async function waitForRuntimeReady(page, timeout = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const runtime = await page.evaluate(() => {
      const textLen = (document.body?.innerText || '').trim().length;
      const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
      const appMounted = Boolean(document.querySelector('#app')?.children?.length > 0);
      return { hasUni, textLen, appMounted, ready: hasUni || textLen > 20 || appMounted };
    });

    if (runtime.ready) return runtime;
    await page.waitForTimeout(250);
  }

  throw new Error(`H5 runtime not ready within ${timeout}ms.`);
}

async function waitForExpectedRoute(page, expectedRoutes, timeout = 20_000) {
  const normalized = expectedRoutes.map((item) => String(item || '').replace(/^\/+/, ''));
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const current = await page.evaluate(
      () =>
        String(location.hash || '')
          .replace(/^#\/?/, '')
          .split('?')[0]
    );
    if (current && normalized.includes(current)) return current;
    await page.waitForTimeout(250);
  }

  throw new Error(`Route did not match expected paths: ${normalized.join(', ')}`);
}

async function assertNoFatalUiSignals(page) {
  const state = await page.evaluate(() => {
    const bodyText = String(document.body?.innerText || '').slice(0, 8000);
    const hasViteOverlay = Boolean(
      document.querySelector('vite-error-overlay, #vite-error-overlay, .vite-error-overlay')
    );
    return { bodyText, hasViteOverlay };
  });

  if (state.hasViteOverlay) {
    throw new Error('Detected Vite runtime error overlay.');
  }

  const fatalPattern =
    /(Cannot\s+read\s+properties|TypeError:|ReferenceError:|SyntaxError:|页面不存在|Page\s+not\s+found)/i;
  if (fatalPattern.test(state.bodyText)) {
    throw new Error('Detected fatal UI error text on page body.');
  }
}

async function assertNoHorizontalOverflow(page, tolerance = 24) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth || 0;
    const scrollWidth = Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0);
    return { viewportWidth, scrollWidth, delta: scrollWidth - viewportWidth };
  });

  expect(metrics.delta, `Horizontal overflow detected: delta=${metrics.delta}`).toBeLessThanOrEqual(tolerance);
}

async function assertReadableViewport(page) {
  const state = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const viewportHeight = window.innerHeight || 0;
    const scrollHeight = Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0);
    const elementCount = document.querySelectorAll('view,div,section,main,button,input,textarea,img,image').length;
    return { textLen, viewportHeight, scrollHeight, elementCount };
  });

  expect(state.textLen > 0 || state.elementCount > 10).toBe(true);
  expect(state.scrollHeight).toBeGreaterThan(0);
}

test.describe('A2-全页面滚动截图巡检', () => {
  test('SCROLL-001 全声明页面支持人工式滑动巡检并截图留档', async ({ app, page }, testInfo) => {
    test.setTimeout(300_000);
    const projectName = testInfo.project?.name || '';
    test.skip(projectName && projectName !== 'mobile-390x844', '滚动截图巡检仅在主移动视口执行，避免重复开销');

    await app.setLoggedInSession();
    await page.addInitScript(() => {
      localStorage.setItem('theme_mode', 'light');
    });

    const human = new HumanActions(page);
    const failures = [];

    for (const route of ALL_DECLARED_ROUTES) {
      const routePath = buildH5Route(route);
      const expectedRoutes = expectedRoutesFor(route);
      const snapshotSlug = routeSnapshotSlug(route);

      try {
        await app.goto(routePath);
        await waitForRuntimeReady(page);
        await waitForExpectedRoute(page, expectedRoutes);
        await assertNoFatalUiSignals(page);
        await assertNoHorizontalOverflow(page);
        await assertReadableViewport(page);
        await app.screenshot(`scroll-audit-top-${snapshotSlug}`);

        await human.swipeUp();
        await human.swipeUp();
        await assertNoFatalUiSignals(page);
        await assertNoHorizontalOverflow(page);
        await assertReadableViewport(page);
        await app.screenshot(`scroll-audit-bottom-${snapshotSlug}`);
      } catch (error) {
        failures.push(`${route}: ${error?.message || String(error)}`);
      }
    }

    expect(ALL_DECLARED_ROUTES.length).toBeGreaterThanOrEqual(30);
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
