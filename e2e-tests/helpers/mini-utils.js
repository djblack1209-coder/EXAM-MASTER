import fs from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'e2e-tests/error-screenshots');

function normalizeRoute(route) {
  if (typeof route !== 'string') return '';
  return route.replace(/^\//, '');
}

export function getMiniProgram() {
  const miniProgram = globalThis.__MINI_PROGRAM__;
  if (!miniProgram) {
    throw new Error('MiniProgram instance is not initialized. Check e2e-tests/setup.js');
  }
  return miniProgram;
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCurrentPage() {
  const miniProgram = getMiniProgram();
  const page = await miniProgram.currentPage();
  if (!page) {
    throw new Error('No active mini program page found.');
  }
  return page;
}

export async function waitForRoute(expectedRoute, options = {}) {
  const timeout = options.timeout ?? 10000;
  const interval = options.interval ?? 200;
  const normalizedExpected = normalizeRoute(expectedRoute);
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const page = await getMiniProgram().currentPage();
    if (page && normalizeRoute(page.path) === normalizedExpected) {
      return page;
    }
    await sleep(interval);
  }

  throw new Error(`Route timeout: expected ${normalizedExpected} within ${timeout}ms`);
}

export async function waitForSelector(selector, options = {}) {
  const timeout = options.timeout ?? 10000;
  const interval = options.interval ?? 200;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const page = await getCurrentPage();
    const element = await page.$(selector);
    if (element) {
      return element;
    }
    await sleep(interval);
  }

  throw new Error(`Selector timeout: ${selector} not found within ${timeout}ms`);
}

export async function tap(selector, options = {}) {
  const element = await waitForSelector(selector, options);
  await element.tap();
  return element;
}

export async function input(selector, value, options = {}) {
  const element = await waitForSelector(selector, options);
  await element.input(String(value));
  return element;
}

export async function textOf(selector, options = {}) {
  const element = await waitForSelector(selector, options);
  return element.text();
}

export async function wxmlOf(selector, options = {}) {
  const element = await waitForSelector(selector, options);
  return element.wxml();
}

export async function waitForPageData(predicate, options = {}) {
  const timeout = options.timeout ?? 10000;
  const interval = options.interval ?? 200;
  const errorMessage = options.errorMessage || 'Timed out while waiting for page data condition.';
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const page = await getCurrentPage();
    const data = await page.data();
    if (predicate(data)) {
      return data;
    }
    await sleep(interval);
  }

  throw new Error(errorMessage);
}

export async function swipe(selector, direction = 'left') {
  const element = await waitForSelector(selector);
  const y = 380;
  const startX = direction === 'right' ? 40 : 320;
  const endX = direction === 'right' ? 320 : 40;

  await element.touchstart({
    touches: [{ identifier: 1, pageX: startX, pageY: y, clientX: startX, clientY: y }]
  });

  await element.touchmove({
    touches: [{ identifier: 1, pageX: endX, pageY: y, clientX: endX, clientY: y }]
  });

  await element.touchend({
    changeTouches: [{ identifier: 1, pageX: endX, pageY: y, clientX: endX, clientY: y }]
  });
}

function toSafeName(rawName) {
  return String(rawName || 'unknown')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

export async function captureFailureScreenshot(label) {
  const miniProgram = getMiniProgram();
  const safeName = toSafeName(label);
  const timestamp = Date.now();
  const filePath = path.join(SCREENSHOT_DIR, `${timestamp}_${safeName}.png`);

  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await miniProgram.screenshot({ path: filePath });
  return filePath;
}

export async function runCaseWithScreenshot(label, testFn) {
  try {
    await testFn();
  } catch (error) {
    try {
      const screenshotPath = await captureFailureScreenshot(label);
      if (error && error.message) {
        error.message = `${error.message}\nFailure screenshot: ${screenshotPath}`;
      }
    } catch {
      // Ignore screenshot errors so the original assertion still surfaces.
    }
    throw error;
  }
}
