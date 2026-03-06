// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
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

    if (runtime.ready) {
      return runtime;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`H5 runtime not ready within ${timeout}ms.`);
}

async function waitForExpectedRoute(page, expectedRoutes, timeout = 20_000) {
  const normalized = expectedRoutes.map((item) => String(item || '').replace(/^\/+/, ''));
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const current = await page.evaluate(() => {
      const hash = String(location.hash || '').replace(/^#\/?/, '');
      return hash.split('?')[0];
    });

    if (current && normalized.includes(current)) {
      return current;
    }

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

  expect(
    metrics.delta,
    `Horizontal overflow detected: delta=${metrics.delta}, viewport=${metrics.viewportWidth}, scroll=${metrics.scrollWidth}`
  ).toBeLessThanOrEqual(tolerance);
}

async function runRouteCoverageScan({ app, page, theme }) {
  await app.setLoggedInSession();
  await page.addInitScript((mode) => {
    localStorage.setItem('theme_mode', mode);
  }, theme);

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
    } catch (error) {
      await app.screenshot(`full-route-${theme}-${snapshotSlug}`);
      failures.push(`${route}: ${error?.message || String(error)}`);
    }
  }

  expect(ALL_DECLARED_ROUTES.length).toBeGreaterThanOrEqual(30);
  expect(failures, failures.join('\n')).toEqual([]);
}

test.describe('A2-全量页面覆盖与 UI 健康度', () => {
  test('FULL-ROUTE-001 亮色模式全量路由可达 + UI 健康度检查', async ({ app, page }) => {
    await runRouteCoverageScan({ app, page, theme: 'light' });
  });

  test('FULL-ROUTE-002 深色模式全量路由可达 + UI 健康度检查', async ({ app, page }) => {
    await runRouteCoverageScan({ app, page, theme: 'dark' });
  });
});
