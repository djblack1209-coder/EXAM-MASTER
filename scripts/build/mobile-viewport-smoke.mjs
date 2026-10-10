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

  try {
    browser = await chromium.launch();
    for (const viewport of MOBILE_VIEWPORTS) {
      for (const route of MOBILE_SMOKE_ROUTES) {
        const page = await browser.newPage({ viewport });
        const consoleErrors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });

        await page.goto(`http://127.0.0.1:${port}/#${route}`, { waitUntil: 'networkidle' });
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
          title: document.title
        }));

        const screenshotDir = path.join(OUTPUT_ROOT, viewport.name);
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
          path: path.join(screenshotDir, `${routeSlug(route)}.png`),
          fullPage: true
        });

        if (consoleErrors.length > 0) {
          failures.push({ viewport: viewport.name, route, code: 'console_error', detail: consoleErrors });
        }
        if (overflow.scrollWidth > overflow.innerWidth + 1) {
          failures.push({ viewport: viewport.name, route, code: 'horizontal_overflow', detail: overflow });
        }
        await page.close();
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSmoke().catch((error) => {
    console.error(`[mobile-viewport-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
