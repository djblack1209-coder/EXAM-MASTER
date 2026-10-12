#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const H5_ROOT = path.join(PROJECT_ROOT, 'dist/build/h5');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'output/mobile-viewport-smoke');

export const MOBILE_SMOKE_ROUTES = [
  '/pages/splash/index',
  '/pages/login/onboarding',
  '/pages/index/index',
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

export function findBlockingToastText(pageText = '') {
  const text = String(pageText || '');
  return BLOCKING_TOAST_TEXTS.find((message) => text.includes(message)) || null;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json') || filePath.endsWith('.webmanifest')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function safeFilePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const relativePath = decoded === '/' || !path.extname(decoded) ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);
  return relativeToRoot && !relativeToRoot.startsWith('..') ? filePath : path.join(root, 'index.html');
}

function serveStatic(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const filePath = safeFilePath(root, url.pathname);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
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
  const browser = await chromium.launch();
  const failures = [];

  try {
    for (const viewport of MOBILE_VIEWPORTS) {
      for (const route of MOBILE_SMOKE_ROUTES) {
        const page = await browser.newPage({ viewport });
        const consoleErrors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });

        await page.goto(`http://127.0.0.1:${port}/#${route}`, { waitUntil: 'networkidle' });
        const pageState = await page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
          title: document.title,
          text: document.body.innerText || ''
        }));
        const blockingToastText = findBlockingToastText(pageState.text);

        const screenshotDir = path.join(OUTPUT_ROOT, viewport.name);
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
          path: path.join(screenshotDir, `${routeSlug(route)}.png`),
          fullPage: true
        });

        if (consoleErrors.length > 0) {
          failures.push({ viewport: viewport.name, route, code: 'console_error', detail: consoleErrors });
        }
        if (pageState.scrollWidth > pageState.innerWidth + 1) {
          failures.push({ viewport: viewport.name, route, code: 'horizontal_overflow', detail: pageState });
        }
        if (blockingToastText) {
          failures.push({ viewport: viewport.name, route, code: 'blocking_toast', detail: { text: blockingToastText } });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }

  if (failures.length > 0) {
    console.error(`[mobile-viewport-smoke] FAIL\n${JSON.stringify(failures, null, 2)}`);
    process.exit(1);
  }
  console.log(`[mobile-viewport-smoke] OK: ${MOBILE_VIEWPORTS.length} viewports x ${MOBILE_SMOKE_ROUTES.length} routes`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSmoke().catch((error) => {
    console.error(`[mobile-viewport-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
