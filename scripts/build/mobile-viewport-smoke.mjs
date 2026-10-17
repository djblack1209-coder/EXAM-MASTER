#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const H5_ROOT = path.resolve(
  process.env.YOZI_MOBILE_SMOKE_H5_DIR ||
    process.env.WENLI_MOBILE_SMOKE_H5_DIR ||
    path.join(PROJECT_ROOT, 'dist/build/h5')
);
const OUTPUT_ROOT = path.resolve(
  process.env.YOZI_MOBILE_SMOKE_OUTPUT_DIR ||
    process.env.WENLI_MOBILE_SMOKE_OUTPUT_DIR ||
    path.join(PROJECT_ROOT, 'output/mobile-viewport-smoke')
);

export const MOBILE_SMOKE_ROUTES = [
  '/pages/splash/index',
  '/pages/login/onboarding',
  '/pages/index/index',
  '/pages/learning/index',
  '/pages/practice/index',
  '/pages/practice-sub/question-bank',
  '/pages/practice-sub/do-quiz',
  '/pages/mistake/index',
  '/pages/profile/index'
];

export const MOBILE_VIEWPORTS = [
  { width: 360, height: 800, name: 'android-compact' },
  { width: 375, height: 812, name: 'iphone-x' },
  { width: 390, height: 844, name: 'iphone-regular' },
  { width: 430, height: 932, name: 'iphone-large' }
];

export const BLOCKING_TOAST_TEXTS = ['保存失败，请检查存储空间'];
const OFFLINE_DECORATION_URLS = new Set(['https://cdn.dcloud.net.cn/img/shadow-grey.png']);

export function findBlockingToastText(pageText = '') {
  const text = String(pageText || '');
  return BLOCKING_TOAST_TEXTS.find((message) => text.includes(message)) || null;
}

// 全新资料域的启动页应自动进入引导页；其余入口应停留在所请求页面。
export const MOBILE_ROUTE_READY_SELECTORS = {
  '/pages/splash/index': '.splash-container .brand-name',
  '/pages/login/onboarding': '.onboarding-page .base-button--primary',
  '/pages/index/index': '.playful-nav .base-button, .future-nav .nav-link',
  '/pages/learning/index':
    '.learning-page .goal-panel textarea, .learning-page #learning-composer textarea, .learning-page #learning-composer input',
  '/pages/practice/index': '.practice-command.primary',
  '/pages/practice-sub/question-bank': '.learning-space .paper-hero .hero-title',
  '/pages/practice-sub/do-quiz': '#e2e-quiz-progress, .custom-modal-container .base-state',
  '/pages/mistake/index': '.learning-overview .overview-title, .learning-overview .overview-empty',
  '/pages/profile/index': '.profile-command-card .user-name'
};

export async function verifyMobileRoute(
  page,
  {
    baseUrl,
    route,
    navigationTimeoutMs = 10000,
    readyTimeoutMs = 5000,
    observationMs = 1000,
    screenshotPath,
    blockedExternalResources = new Map()
  }
) {
  const origin = new URL(baseUrl).origin;
  const finalRoute = route === '/pages/splash/index' ? '/pages/login/onboarding' : route;
  const failures = [];
  const cancelledImages = [];
  const expectedBlockedResources = new Set();
  const record = (code, detail) => {
    if (
      !failures.some((failure) => failure.code === code && JSON.stringify(failure.detail) === JSON.stringify(detail))
    ) {
      failures.push({ code, detail });
    }
  };
  const isCritical = (request) =>
    new URL(request.url()).origin === origin &&
    ['document', 'script', 'stylesheet', 'font', 'image', 'xhr', 'fetch'].includes(request.resourceType());
  const listeners = {
    console: (message) => {
      if (message.type() !== 'error') return;
      const url = message.location().url;
      // Only the harness's explicitly blocked external decoration is expected in an offline run.
      if (
        OFFLINE_DECORATION_URLS.has(url) &&
        blockedExternalResources.get(url) === 'image' &&
        /^Failed to load resource: net::ERR_BLOCKED_BY_CLIENT(?:\.Inspector)?$/.test(message.text())
      ) {
        expectedBlockedResources.add(url);
      } else record('console_error', message.text());
    },
    pageerror: (error) => record('page_error', error.message),
    requestfailed: (request) => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
        // External bootstrap failures remain fatal even when another request shares the URL.
        if (
          !OFFLINE_DECORATION_URLS.has(url.href) ||
          request.resourceType() !== 'image' ||
          blockedExternalResources.get(url.href) !== 'image'
        ) {
          record('critical_external_resource_failed', {
            url: url.href,
            type: request.resourceType(),
            error: request.failure()
          });
        }
        return;
      }
      if (!isCritical(request)) return;
      const detail = { url: request.url(), error: request.failure() };
      if (request.resourceType() === 'image' && detail.error?.errorText === 'net::ERR_ABORTED') {
        cancelledImages.push(detail);
      } else record('critical_resource_failed', detail);
    },
    response: (response) => {
      if (response.status() >= 400 && isCritical(response.request())) {
        record('critical_resource_failed', { url: response.url(), status: response.status() });
      }
    }
  };
  // 必须在首次导航前监听，覆盖应用错误处理器安装之前的异常。
  for (const [event, listener] of Object.entries(listeners)) page.on(event, listener);
  let pageState;
  try {
    await page.exposeFunction('__mobileSmokeReport', (text) => record('blocking_toast', { text }));
    await page.addInitScript((blockingTexts) => {
      const seen = new Set();
      const inspect = (text) => {
        for (const message of blockingTexts) {
          if (text?.includes(message) && !seen.has(message)) {
            seen.add(message);
            window.__mobileSmokeReport(message);
          }
        }
      };
      const readNode = (node) => {
        if (['SCRIPT', 'STYLE'].includes(node.nodeName) || ['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName))
          return;
        inspect(node.innerText ?? node.textContent);
      };
      new window.MutationObserver((mutations) => {
        inspect(document.body?.innerText);
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) readNode(node);
          if (
            mutation.type === 'characterData' &&
            !['SCRIPT', 'STYLE'].includes(mutation.target.parentElement?.tagName)
          ) {
            readNode(mutation.target);
            inspect(mutation.oldValue);
          }
        }
      }).observe(document, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
    }, BLOCKING_TOAST_TEXTS);
    const waitForReady = (expectedRoute) =>
      page.waitForFunction(
        ({ expectedRoute, selector, origin }) => {
          const visible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          return (
            location.origin === origin &&
            location.hash.split('?')[0] === `#${expectedRoute}` &&
            [...document.querySelectorAll(selector)].some(visible) &&
            ![...document.querySelectorAll('.base-state--loading')].some(visible)
          );
        },
        { expectedRoute, selector: MOBILE_ROUTE_READY_SELECTORS[expectedRoute], origin },
        { timeout: readyTimeoutMs }
      );
    try {
      await page.goto(`${origin}/#${route}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
      await waitForReady(route);
      if (finalRoute !== route) await waitForReady(finalRoute);
    } catch (error) {
      record('page_not_ready', error.message);
    }
    // 错误监听和 DOM 观察在整个导航、就绪等待、观察期及截图期间保持开启。
    await page.waitForTimeout(observationMs);
    // 防止观察期结束前入口消失、重新进入加载或被错误态替换。
    try {
      await waitForReady(finalRoute);
    } catch (error) {
      record('page_not_ready', error.message);
    }
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    pageState = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      title: document.title,
      text: document.body.innerText || '',
      url: location.href,
      referencedImageUrls: [...document.querySelectorAll('*')].flatMap((element) => {
        const urls = [];
        if (element.tagName === 'IMG' && !element.naturalWidth) urls.push(element.currentSrc || element.src);
        // A cancelled image is unused only if no DOM or generated pseudo-element still references it.
        for (const pseudo of [null, '::before', '::after']) {
          const style = window.getComputedStyle(element, pseudo);
          for (const value of [style.backgroundImage, style.maskImage, style.borderImageSource, style.content]) {
            for (const match of (value || '').matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.push(match[1]);
          }
        }
        return urls;
      })
    }));
    for (const detail of cancelledImages) {
      if (pageState.referencedImageUrls.includes(detail.url)) record('critical_resource_failed', detail);
    }
    pageState.expectedBlockedResources = [...expectedBlockedResources];
    pageState.cancelledUnusedImages = cancelledImages
      .filter((detail) => !pageState.referencedImageUrls.includes(detail.url))
      .map((detail) => detail.url);
    const finalUrl = new URL(pageState.url);
    if (finalUrl.origin !== origin || finalUrl.hash.split('?')[0] !== `#${finalRoute}`) {
      record('unexpected_route', { expected: finalRoute, actual: pageState.url });
    }
    if (await page.locator('.base-state--error').first().isVisible()) record('page_error_state', pageState.text);
    if (pageState.scrollWidth > pageState.innerWidth + 1) record('horizontal_overflow', pageState);
    const blockingText = findBlockingToastText(pageState.text);
    if (blockingText) record('blocking_toast', { text: blockingText });
  } finally {
    for (const [event, listener] of Object.entries(listeners)) page.off(event, listener);
  }
  if (failures.length) {
    const error = new Error(`Mobile entry failed: ${route}`);
    error.failures = failures;
    throw error;
  }
  return pageState;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json') || filePath.endsWith('.webmanifest')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(filePath)) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.ttf')) return 'font/ttf';
  if (filePath.endsWith('.woff')) return 'font/woff';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  if (filePath.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

function safeFilePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const relativePath = decoded === '/' || !path.extname(decoded) ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);
  return relativeToRoot && !relativeToRoot.startsWith('..') ? filePath : path.join(root, 'index.html');
}

export function serveStatic(root, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const filePath = safeFilePath(root, url.pathname);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const size = fs.statSync(filePath).size;
      const headers = { 'content-type': contentType(filePath), 'accept-ranges': 'bytes' };
      let start = 0;
      let end = size - 1;
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match && (match[1] || match[2])) {
          if (match[1]) {
            start = Number(match[1]);
            if (match[2]) end = Math.min(Number(match[2]), end);
          } else {
            start = Math.max(0, size - Number(match[2]));
          }
        }
        if (
          !match ||
          (!match[1] && !match[2]) ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          start > end
        ) {
          res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` });
          res.end();
          return;
        }
        headers['content-range'] = `bytes ${start}-${end}/${size}`;
      }
      headers['content-length'] = String(Math.max(0, end - start + 1));
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD' || size === 0) {
        res.end();
        return;
      }
      fs.createReadStream(filePath, { start, end }).pipe(res);
    });

    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function routeSlug(route) {
  return route.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

async function runSmoke() {
  if (!fs.existsSync(path.join(H5_ROOT, 'index.html'))) {
    throw new Error('dist/build/h5/index.html is missing. Run npm run build:h5 first.');
  }

  const { chromium } = await import('playwright');
  const { server, port } = await serveStatic(H5_ROOT);
  let browser;
  const failures = [];
  let expectedBlockedResourceCount = 0;
  let cancelledUnusedImageCount = 0;

  try {
    browser = await chromium.launch({
      channel:
        process.env.YOZI_MOBILE_SMOKE_BROWSER_CHANNEL || process.env.WENLI_MOBILE_SMOKE_BROWSER_CHANNEL || undefined
    });
    for (const viewport of MOBILE_VIEWPORTS) {
      for (const route of MOBILE_SMOKE_ROUTES) {
        const page = await browser.newPage({ viewport });
        const blockedExternalResources = new Map();
        // 本机界面验收不调用远程服务，浏览器使用新的独立资料域。
        await page.route('**/*', (request) => {
          const url = new URL(request.request().url());
          if (['http:', 'https:'].includes(url.protocol) && url.origin !== `http://127.0.0.1:${port}`) {
            const type = request.request().resourceType();
            if (!blockedExternalResources.has(url.href) || type !== 'image') {
              blockedExternalResources.set(url.href, type);
            }
            return request.abort('blockedbyclient');
          }
          return request.continue();
        });
        const screenshotDir = path.join(OUTPUT_ROOT, viewport.name);
        fs.mkdirSync(screenshotDir, { recursive: true });
        try {
          const state = await verifyMobileRoute(page, {
            baseUrl: `http://127.0.0.1:${port}`,
            route,
            screenshotPath: path.join(screenshotDir, `${routeSlug(route)}.png`),
            blockedExternalResources
          });
          expectedBlockedResourceCount += state.expectedBlockedResources.length;
          cancelledUnusedImageCount += state.cancelledUnusedImages.length;
        } catch (error) {
          const routeFailures = error.failures || [{ code: 'smoke_error', detail: error.message }];
          failures.push(...routeFailures.map((failure) => ({ viewport: viewport.name, route, ...failure })));
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      server.closeAllConnections?.();
      await closeServer(server);
    }
  }

  if (failures.length > 0) {
    console.error(`[mobile-viewport-smoke] FAIL\n${JSON.stringify(failures, null, 2)}`);
    process.exit(1);
  }
  console.log(
    `[mobile-viewport-smoke] OK: ${MOBILE_VIEWPORTS.length} viewports x ${MOBILE_SMOKE_ROUTES.length} routes`
  );
  console.log(
    `[mobile-viewport-smoke] offline visual resources blocked: ${expectedBlockedResourceCount}; cancelled unused images: ${cancelledUnusedImageCount}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSmoke().catch((error) => {
    console.error(`[mobile-viewport-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
