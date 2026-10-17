// @vitest-environment node
// Playwright owns the real document; the harness needs Node HTTP/process APIs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { chromium } from 'playwright';

import {
  BLOCKING_TOAST_TEXTS,
  MOBILE_SMOKE_ROUTES,
  MOBILE_ROUTE_READY_SELECTORS,
  MOBILE_VIEWPORTS,
  findBlockingToastText,
  serveStatic,
  verifyMobileRoute
} from '../../scripts/build/mobile-viewport-smoke.mjs';

function readMedia(url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const call = request(url, { headers, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() })
      );
      response.on('error', reject);
    });
    call.on('error', reject);
    call.end();
  });
}

describe('mobile viewport smoke config', () => {
  it('covers the mobile shell critical path', () => {
    expect(MOBILE_SMOKE_ROUTES).toEqual([
      '/pages/splash/index',
      '/pages/login/onboarding',
      '/pages/index/index',
      '/pages/learning/index',
      '/pages/practice/index',
      '/pages/practice-sub/question-bank',
      '/pages/practice-sub/do-quiz',
      '/pages/mistake/index',
      '/pages/profile/index'
    ]);
  });

  it('covers narrow and large phone viewports', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      { width: 360, height: 800, name: 'android-compact' },
      { width: 375, height: 812, name: 'iphone-x' },
      { width: 390, height: 844, name: 'iphone-regular' },
      { width: 430, height: 932, name: 'iphone-large' }
    ]);
  });

  it('rejects a storage failure covering the first screen while allowing ordinary page copy', () => {
    expect(BLOCKING_TOAST_TEXTS).toContain('保存失败，请检查存储空间');
    expect(findBlockingToastText('首页\n保存失败，请检查存储空间\n今日任务')).toBe('保存失败，请检查存储空间');
    expect(findBlockingToastText('首页\n今日任务')).toBeNull();
    expect(findBlockingToastText(null)).toBeNull();
  });

  it('serves video byte ranges so actual homepage frame seeking can work', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'exam-media-range-'));
    const content = Buffer.from('0123456789abcdef');
    await writeFile(path.join(root, 'gaze.mp4'), content);
    const { server, port } = await serveStatic(root);
    try {
      const url = `http://127.0.0.1:${port}/gaze.mp4`;
      const partial = await readMedia(url, { Range: 'bytes=2-5' });
      expect(partial.status).toBe(206);
      expect(partial.headers['content-type']).toBe('video/mp4');
      expect(partial.headers['content-range']).toBe('bytes 2-5/16');
      expect(partial.body).toBe('2345');
      const suffix = await readMedia(url, { Range: 'bytes=-3' });
      expect(suffix.status).toBe(206);
      expect(suffix.body).toBe('def');
      const invalid = await readMedia(url, { Range: 'bytes=16-' });
      expect(invalid.status).toBe(416);
      expect(invalid.headers['content-range']).toBe('bytes */16');
      const head = await readMedia(url, {}, 'HEAD');
      expect(head.headers['content-length']).toBe('16');
      expect(head.headers['accept-ranges']).toBe('bytes');
      expect(head.body).toBe('');
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});

// verifyMobileRoute has separate navigation and readiness deadlines. A normal
// route can spend the readiness budget both before and after observation; splash
// uses three waits but overrides readiness to 1500ms (3 * 1500 < 2 * 5000).
const NAVIGATION_TIMEOUT_MS = 10_000;
const READY_TIMEOUT_MS = 5000;
const OBSERVATION_MS = 120;
const CONTEXT_SETUP_BUDGET_MS = 5000;
const PROTOCOL_AND_ASSERTION_BUDGET_MS = 5000;
const CONTEXT_CLOSE_BUDGET_MS = 5000;
const CHECK_TIMEOUT_MS =
  CONTEXT_SETUP_BUDGET_MS +
  NAVIGATION_TIMEOUT_MS +
  2 * READY_TIMEOUT_MS +
  OBSERVATION_MS +
  PROTOCOL_AND_ASSERTION_BUDGET_MS +
  CONTEXT_CLOSE_BUDGET_MS; // 35,120ms, including failure paths and cleanup.
// Playwright allows up to 30s for launch and graceful browser shutdown. The
// hooks must outlive that deadline and still close the server/remove fixtures.
const BROWSER_LIFECYCLE_BUDGET_MS = 30_000;
const SERVER_AND_FIXTURE_BUDGET_MS = 5000;
const ENTRY_TEST_OPTIONS = { timeout: CHECK_TIMEOUT_MS, concurrent: false };

// Keep a single browser; every check gets its own profile, page and listeners.
describe('mobile entry initialization checks with synthetic pages', ENTRY_TEST_OPTIONS, () => {
  let browser;
  let root;
  let server;
  let baseUrl;
  const route = '/pages/practice/index';
  const readyMarkup = '<button class="practice-command primary">开始练习</button>';

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'exam-mobile-entry-'));
    const served = await serveStatic(root);
    server = served.server;
    baseUrl = `http://127.0.0.1:${served.port}`;
    browser = await chromium.launch({
      timeout: BROWSER_LIFECYCLE_BUDGET_MS,
      // Synthetic DOM/resource checks need no GPU work. Actual product visuals
      // are verified separately with the browser's normal graphics path.
      args: ['--disable-gpu'],
      // Use Playwright's matching headless shell. A branded browser is an
      // explicit diagnostic override, never an implicit fallback to a new version.
      channel: process.env.YOZI_MOBILE_SMOKE_BROWSER_CHANNEL || undefined
    });
  }, BROWSER_LIFECYCLE_BUDGET_MS + SERVER_AND_FIXTURE_BUDGET_MS);

  afterAll(async () => {
    try {
      await browser?.close();
    } finally {
      server?.closeAllConnections();
      if (server) await new Promise((resolve) => server.close(resolve));
      if (root) await rm(root, { recursive: true, force: true });
    }
  }, BROWSER_LIFECYCLE_BUDGET_MS + SERVER_AND_FIXTURE_BUDGET_MS);

  async function check(html, options = {}, configure = () => {}) {
    await writeFile(
      path.join(root, 'index.html'),
      `<!doctype html><html><head><link rel="icon" href="data:,"></head><body>${html}</body></html>`
    );
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORTS[0] });
    try {
      const page = await context.newPage();
      await configure(page);
      return await verifyMobileRoute(page, {
        baseUrl,
        route,
        navigationTimeoutMs: NAVIGATION_TIMEOUT_MS,
        readyTimeoutMs: READY_TIMEOUT_MS,
        observationMs: OBSERVATION_MS,
        ...options
      });
    } finally {
      await context.close();
    }
  }

  it('defines a visible readiness contract for every smoke entry', () => {
    expect(Object.keys(MOBILE_ROUTE_READY_SELECTORS)).toEqual(MOBILE_SMOKE_ROUTES);
    expect(Object.values(MOBILE_ROUTE_READY_SELECTORS).every((selector) => selector.length > 0)).toBe(true);
  });

  it('accepts a ready entry at the requested route', async () => {
    await expect(check(readyMarkup)).resolves.toMatchObject({ url: `${baseUrl}/#${route}` });
  });

  it('allows slow navigation without spending the entry readiness budget', async () => {
    await expect(
      check(readyMarkup, { readyTimeoutMs: 250 }, (page) =>
        page.route('**/', async (request) => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          await request.continue();
        })
      )
    ).resolves.toMatchObject({ url: `${baseUrl}/#${route}` });
  });

  it('still rejects an entry that renders after its readiness deadline', async () => {
    await expect(
      check(`<script>setTimeout(() => { document.body.innerHTML = '${readyMarkup}'; }, 700)</script>`, {
        readyTimeoutMs: 250,
        observationMs: 0
      })
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'page_not_ready', detail: expect.any(String) }])
    });
  });

  it('accepts the initial learning goal form before a conversation has a composer', async () => {
    await expect(
      check(
        '<main class="learning-page"><section class="goal-panel"><textarea aria-label="学习目标"></textarea></section></main>',
        {
          route: '/pages/learning/index'
        }
      )
    ).resolves.toMatchObject({ url: `${baseUrl}/#/pages/learning/index` });
  });

  it('allows an aborted image removed by the native tab bar replacement', async () => {
    await expect(
      check(
        `${readyMarkup}<img src="/retired.png"><script>document.querySelector('img').remove()</script>`,
        {},
        (page) => page.route('**/retired.png', (request) => request.abort('aborted'))
      )
    ).resolves.toMatchObject({ url: `${baseUrl}/#${route}` });
  });

  it('still rejects an aborted image used by the visible entry', async () => {
    await expect(
      check(`${readyMarkup}<img src="/visible.png" width="40" height="40">`, {}, (page) =>
        page.route('**/visible.png', (request) => request.abort('aborted'))
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'critical_resource_failed', detail: expect.any(Object) }])
    });
  });

  it('records external decoration explicitly blocked by the offline harness', async () => {
    const url = 'https://cdn.dcloud.net.cn/img/shadow-grey.png';
    await expect(
      check(`${readyMarkup}<img src="${url}">`, { blockedExternalResources: new Map([[url, 'image']]) }, (page) =>
        page.route('https://cdn.dcloud.net.cn/**', (request) => request.abort('blockedbyclient'))
      )
    ).resolves.toMatchObject({ expectedBlockedResources: [url] });
  });

  it.each(['untracked-image', 'script'])('does not hide an external %s failure', async (kind) => {
    const url = `https://offline.invalid/${kind}`;
    const html = kind === 'script' ? `<script src="${url}"></script>` : `<img src="${url}">`;
    await expect(
      check(
        `${readyMarkup}${html}`,
        { blockedExternalResources: new Map(kind === 'script' ? [[url, 'script']] : []) },
        (page) => page.route('https://offline.invalid/**', (request) => request.abort('blockedbyclient'))
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'console_error', detail: expect.any(String) }])
    });
  });

  it('rejects an external script sharing its blocked URL with an image', async () => {
    const url = 'https://cdn.dcloud.net.cn/img/shadow-grey.png';
    const blockedExternalResources = new Map();
    await expect(
      check(
        `${readyMarkup}<script async src="${url}"></script><img src="${url}">`,
        { blockedExternalResources },
        (page) =>
          page.route('https://cdn.dcloud.net.cn/**', async (request) => {
            const type = request.request().resourceType();
            blockedExternalResources.set(url, type);
            if (type === 'script') await new Promise((resolve) => setTimeout(resolve, 70));
            await request.abort('blockedbyclient');
          })
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'critical_external_resource_failed', detail: expect.any(Object) }])
    });
  });

  it('rejects an aborted visible pseudo-element background', async () => {
    await expect(
      check(
        `${readyMarkup}<style>.hero::before{content:'';display:block;width:40px;height:40px;background-image:url('/pseudo.png')}</style><div class="hero"></div>`,
        {},
        (page) => page.route('**/pseudo.png', (request) => request.abort('aborted'))
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'critical_resource_failed', detail: expect.any(Object) }])
    });
  });

  it('rejects an otherwise clean blank page', async () => {
    await expect(check('', { readyTimeoutMs: 250 })).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'page_not_ready', detail: expect.any(String) }])
    });
  });

  it('rejects a hidden entry and a shell stuck in loading', { timeout: 2 * CHECK_TIMEOUT_MS }, async () => {
    for (const html of [
      `<div style="display:none">${readyMarkup}</div>`,
      `${readyMarkup}<div class="base-state--loading">加载中</div>`
    ]) {
      await expect(check(html, { readyTimeoutMs: 250 })).rejects.toMatchObject({
        failures: expect.arrayContaining([{ code: 'page_not_ready', detail: expect.any(String) }])
      });
    }
  });

  it('catches a blank initialization crash before any application error handler or console.error exists', async () => {
    await expect(
      check('<script>throw new Error("early init crash")</script>', { readyTimeoutMs: 250 })
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([
        { code: 'page_error', detail: 'early init crash' },
        { code: 'page_not_ready', detail: expect.any(String) }
      ])
    });
  });

  it.each([
    ['script', '<script src="/missing.js"></script>'],
    ['stylesheet', '<link rel="stylesheet" href="/missing.css">']
  ])('rejects a same-origin %s HTTP failure even if the entry renders', async (_type, markup) => {
    await expect(check(`${readyMarkup}${markup}`)).rejects.toMatchObject({
      failures: expect.arrayContaining([
        { code: 'critical_resource_failed', detail: { url: expect.stringContaining('/missing.'), status: 404 } }
      ])
    });
  });

  it('rejects a transport failure for a same-origin bootstrap resource', async () => {
    await expect(
      check(`${readyMarkup}<script src="/boot.js"></script>`, {}, (page) =>
        page.route('**/boot.js', (request) => request.abort('failed'))
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([
        { code: 'critical_resource_failed', detail: { url: `${baseUrl}/boot.js`, error: expect.any(Object) } }
      ])
    });
  });

  it('rejects a rendered entry redirected to the wrong final route during observation', async () => {
    await expect(
      check(`${readyMarkup}<script>setTimeout(() => { location.hash = '/pages/profile/index'; }, 60)</script>`)
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([
        { code: 'unexpected_route', detail: { expected: route, actual: `${baseUrl}/#/pages/profile/index` } }
      ])
    });
  });

  it('validates splash readiness and its expected onboarding transition', async () => {
    await expect(
      check(
        '<div class="splash-container"><span class="brand-name">Yozi</span></div><script>setTimeout(() => { document.body.innerHTML = \'<div class="onboarding-page"><button class="base-button--primary">开始</button></div>\'; location.hash = \'/pages/login/onboarding\'; }, 500)</script>',
        { route: '/pages/splash/index', readyTimeoutMs: 1500 }
      )
    ).resolves.toMatchObject({ url: `${baseUrl}/#/pages/login/onboarding` });
  });

  it('rejects a splash that never reaches onboarding', async () => {
    await expect(
      check('<div class="splash-container"><span class="brand-name">Yozi</span></div>', {
        route: '/pages/splash/index',
        readyTimeoutMs: 250
      })
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'page_not_ready', detail: expect.any(String) }])
    });
  });

  it('retains a storage failure toast that appears and disappears between snapshots', async () => {
    const html = `${readyMarkup}<script>setTimeout(() => { const toast = document.createElement('div'); toast.textContent = '保存失败，请检查存储空间'; document.body.append(toast); toast.remove(); }, 60)</script>`;
    await expect(check(html, { readyTimeoutMs: 250 })).rejects.toMatchObject({
      failures: expect.arrayContaining([{ code: 'blocking_toast', detail: { text: '保存失败，请检查存储空间' } }])
    });
  });

  it('does not treat failure copy inside a script as a displayed toast', async () => {
    await expect(
      check(`${readyMarkup}<script>window.fixtureCopy = '保存失败，请检查存储空间';</script>`)
    ).resolves.toMatchObject({ url: `${baseUrl}/#${route}` });
  });

  it('keeps runtime and resource listeners active after entry readiness', async () => {
    await expect(
      check(
        `${readyMarkup}<script>setTimeout(() => { fetch('/late.json'); throw new Error('late crash'); }, 60)</script>`
      )
    ).rejects.toMatchObject({
      failures: expect.arrayContaining([
        { code: 'page_error', detail: 'late crash' },
        { code: 'critical_resource_failed', detail: { url: `${baseUrl}/late.json`, status: 404 } }
      ])
    });
  });
});
