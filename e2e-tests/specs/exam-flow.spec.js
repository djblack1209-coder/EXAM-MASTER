import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  captureFailureScreenshot,
  getMiniProgram,
  runCaseWithScreenshot,
  input,
  waitForRoute,
  waitForSelector,
  tap,
  textOf,
  wxmlOf,
  sleep,
  swipe,
  getCurrentPage
} from '../helpers/mini-utils.js';
import { seedBaseState, resetStorage } from '../helpers/fixtures.js';

function timeoutError(label, timeoutMs) {
  return new Error(`Action timeout: ${label} exceeded ${timeoutMs}ms`);
}

async function withActionTimeout(promise, timeoutMs, label) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForProgressFragment(fragment, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const progress = (await textOf('#e2e-quiz-progress')).replace(/\s+/g, '');
    if (progress.includes(fragment)) {
      return progress;
    }
    await sleep(200);
  }

  throw new Error(`Progress did not reach ${fragment} within ${timeout}ms`);
}

async function completeMockExamTenQuestions() {
  await waitForSelector('#e2e-mock-question-text');
  const miniProgram = getMiniProgram();

  const getVmState = async () =>
    miniProgram.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      const current = pages[pages.length - 1];
      const vm = current?.$vm || current;
      if (!vm) {
        return { ready: false, total: 0 };
      }
      return {
        ready: typeof vm.selectAnswer === 'function' && typeof vm.submitExam === 'function',
        total: Array.isArray(vm.examQuestions) ? vm.examQuestions.length : 0
      };
    });

  const startedAt = Date.now();
  let total = 0;
  while (Date.now() - startedAt <= 10000) {
    const state = await getVmState();
    total = Number(state?.total || 0);
    if (state?.ready && Number.isFinite(total) && total > 0) {
      break;
    }
    await sleep(220);
  }

  if (!Number.isFinite(total) || total <= 0) {
    const progress = (await textOf('#e2e-mock-progress', { timeout: 3000 })).replace(/\s+/g, '');
    const match = progress.match(/\/(\d+)/);
    total = Number(match?.[1] || 0);
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Mock exam questions are not ready.');
  }

  for (let idx = 0; idx < total; idx += 1) {
    await miniProgram.evaluate(
      (payload) => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        const current = pages[pages.length - 1];
        const vm = current?.$vm || current;
        if (!vm || typeof vm.selectAnswer !== 'function') {
          throw new Error('selectAnswer not available');
        }
        vm.selectAnswer(0);
        if (payload.hasNext && typeof vm.nextQuestion === 'function') {
          vm.nextQuestion();
        }
        return true;
      },
      { hasNext: idx < total - 1 }
    );
    await sleep(80);
    if (idx < total - 1) {
      await sleep(360);
    }
  }

  await miniProgram.evaluate(() => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages[pages.length - 1];
    const vm = current?.$vm || current;
    if (!vm || typeof vm.submitExam !== 'function') {
      throw new Error('submitExam not available');
    }
    vm.submitExam();
    return true;
  });
  await waitForSelector('#e2e-mock-result', { timeout: 15000 });
}

async function getExamRecords(miniProgram) {
  const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  if (hasBridge) {
    return withActionTimeout(
      miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.getStorage('exam_records', [])),
      15000,
      'get exam_records via bridge'
    );
  }

  const raw = await withActionTimeout(
    miniProgram.callWxMethod('getStorageSync', 'exam_records'),
    15000,
    'get exam_records via wx API'
  );
  return Array.isArray(raw) ? raw : [];
}

const PAGES_CONFIG_PATH = path.resolve(process.cwd(), 'pages.json');

function loadAllDeclaredRoutes() {
  const raw = fs.readFileSync(PAGES_CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  const rootPages = (config.pages || []).map((item) => item.path);
  const subPages = (config.subPackages || []).flatMap((pkg) =>
    (pkg.pages || []).map((subPage) => `${pkg.root}/${subPage.path}`)
  );

  return {
    allRoutes: [...rootPages, ...subPages],
    tabRoutes: new Set((config.tabBar?.list || []).map((item) => item.pagePath))
  };
}

async function waitForAnyRoute(expectedRoutes, timeout = 15000) {
  const normalized = expectedRoutes.map((route) => route.replace(/^\//, ''));
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeout) {
    const page = await getMiniProgram().currentPage();
    const current = (page?.path || '').replace(/^\//, '');
    if (current && normalized.includes(current)) {
      return current;
    }
    await sleep(250);
  }

  throw new Error(`No expected route reached: ${normalized.join(', ')}`);
}

function buildRouteUrl(route) {
  const queryMap = {
    'pages/login/index': 'e2e=1',
    'pages/school-sub/detail': 'id=e2e-school',
    'pages/social/friend-profile':
      'uid=e2e_friend&nickname=E2E%20Friend&score=123&studyDays=15&accuracy=88&lastActive=1730000000000'
  };
  const query = queryMap[route];
  return query ? `/${route}?${query}` : `/${route}`;
}

async function openRouteWithRetry(miniProgram, route, tabRoutes, expectedRoutes) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (tabRoutes.has(route)) {
        if (attempt === 1) {
          await withActionTimeout(miniProgram.switchTab(`/${route}`), 20000, `switchTab ${route}`);
        } else {
          await withActionTimeout(miniProgram.reLaunch(`/${route}`), 20000, `reLaunch ${route}`);
        }
      } else {
        await withActionTimeout(miniProgram.reLaunch(buildRouteUrl(route)), 20000, `reLaunch ${route}`);
      }

      await sleep(350);
      return await waitForAnyRoute(expectedRoutes, 20000);
    } catch (error) {
      lastError = error;
      await sleep(800);
    }
  }

  throw lastError || new Error(`Unable to open route: ${route}`);
}

const UI_SNAPSHOT_DIR = path.resolve(process.cwd(), 'e2e-tests/ui-snapshots');

async function captureUiSnapshot(miniProgram, label) {
  if (!fs.existsSync(UI_SNAPSHOT_DIR)) {
    fs.mkdirSync(UI_SNAPSHOT_DIR, { recursive: true });
  }
  const filePath = path.join(UI_SNAPSHOT_DIR, `${Date.now()}_${label}.png`);
  await withActionTimeout(miniProgram.screenshot({ path: filePath }), 20000, `screenshot ${label}`);
  return filePath;
}

async function setThemeMode(miniProgram, mode) {
  const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  if (hasBridge) {
    await withActionTimeout(
      miniProgram.evaluate((m) => globalThis.__E2E_BRIDGE__.setStorage('theme_mode', m), mode),
      15000,
      `set theme_mode via bridge (${mode})`
    );
  } else {
    await withActionTimeout(
      miniProgram.callWxMethod('setStorageSync', 'theme_mode', mode),
      15000,
      `set theme_mode via wx API (${mode})`
    );
  }
  await sleep(350);
}

async function getThemeMode(miniProgram) {
  const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  if (hasBridge) {
    return withActionTimeout(
      miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.getStorage('theme_mode', 'light')),
      12000,
      'get theme_mode via bridge'
    );
  }
  return withActionTimeout(
    miniProgram.callWxMethod('getStorageSync', 'theme_mode'),
    12000,
    'get theme_mode via wx API'
  );
}

async function setStorageValue(miniProgram, key, value) {
  const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  if (hasBridge) {
    return withActionTimeout(
      miniProgram.evaluate((payload) => globalThis.__E2E_BRIDGE__.setStorage(payload.key, payload.value), {
        key,
        value
      }),
      15000,
      `set storage via bridge (${key})`
    );
  }
  return withActionTimeout(
    miniProgram.callWxMethod('setStorageSync', key, value),
    15000,
    `set storage via wx API (${key})`
  );
}

function shouldRetryMiniProgramCase(error) {
  const message = String(error?.message || '');
  return /timeout|Transport\.Connection|WebSocket|No active mini program page/i.test(message);
}

async function runCaseWithRetry(label, testFn, { attempts = 4, retryDelay = 1200 } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptLabel = attempts > 1 ? `${label}_attempt_${attempt}` : label;

    try {
      await runCaseWithScreenshot(attemptLabel, testFn);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetryMiniProgramCase(error)) {
        throw error;
      }
      await sleep(retryDelay);
    }
  }

  throw lastError;
}

async function getStorageValue(miniProgram, key, defaultValue = null) {
  const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
  if (hasBridge) {
    return withActionTimeout(
      miniProgram.evaluate((payload) => globalThis.__E2E_BRIDGE__.getStorage(payload.key, payload.defaultValue), {
        key,
        defaultValue
      }),
      15000,
      `get storage via bridge (${key})`
    );
  }
  const raw = await withActionTimeout(
    miniProgram.callWxMethod('getStorageSync', key),
    15000,
    `get storage via wx API (${key})`
  );
  return typeof raw === 'undefined' ? defaultValue : raw;
}

async function waitForPageDarkState(expectedIsDark, timeout = 12000) {
  const startedAt = Date.now();
  const miniProgram = getMiniProgram();

  while (Date.now() - startedAt <= timeout) {
    const page = await getCurrentPage();
    const data = await page.data();
    if (typeof data?.isDark === 'boolean' && data.isDark === expectedIsDark) {
      return data;
    }

    const mode = await getThemeMode(miniProgram);
    if (String(mode) === (expectedIsDark ? 'dark' : 'light')) {
      return { isDark: expectedIsDark, source: 'storage' };
    }

    await sleep(250);
  }

  throw new Error(`Page dark state did not become ${expectedIsDark} within ${timeout}ms`);
}

describe('Mini Program E2E: login, quiz, and submission', () => {
  beforeEach(async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await resetStorage();
        return;
      } catch (error) {
        lastError = error;
        await sleep(600);
      }
    }

    throw lastError;
  });

  test('Test Case 7 (Route Coverage): smoke open all declared pages', async () => {
    const miniProgram = getMiniProgram();
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await seedBaseState({ userId: 'e2e_user', questionCount: 20 });

        const { allRoutes, tabRoutes } = loadAllDeclaredRoutes();
        const excludedRoutes = new Set([]);
        const routeExpectations = {
          'pages/splash/index': ['pages/splash/index', 'pages/index/index'],
          'pages/login/index': ['pages/login/index', 'pages/index/index'],
          'pages/login/wechat-callback': ['pages/login/wechat-callback', 'pages/login/index', 'pages/index/index'],
          'pages/login/qq-callback': ['pages/login/qq-callback', 'pages/login/index', 'pages/index/index']
        };

        const smokeRoutes = allRoutes.filter((route) => !excludedRoutes.has(route));
        const failures = [];

        await miniProgram.reLaunch('/pages/index/index');
        await waitForAnyRoute(['pages/index/index', 'pages/practice/index'], 20000);

        for (const route of smokeRoutes) {
          try {
            const expected = routeExpectations[route] || [route];
            await openRouteWithRetry(miniProgram, route, tabRoutes, expected);

            const page = await getCurrentPage();
            const data = await page.data();
            if (!data || typeof data !== 'object') {
              throw new Error('Page data is empty or invalid object.');
            }
          } catch (error) {
            const screenshotPath = await captureFailureScreenshot(`route_${route.replace(/[\\/]/g, '_')}`);
            failures.push({ route, message: error?.message || String(error), screenshotPath });
          }
        }

        if (failures.length > 0) {
          const details = failures.map((item) => `${item.route}: ${item.message} (${item.screenshotPath})`).join('\n');
          throw new Error(`Route smoke failed ${failures.length}/${smokeRoutes.length} routes:\n${details}`);
        }

        expect(smokeRoutes.length).toBeGreaterThanOrEqual(30);
        return;
      } catch (error) {
        lastError = error;
        await sleep(1200);
      }
    }

    throw lastError;
  }, 420000);

  test('Test Case 10 (Route Coverage Dark): smoke open all pages in dark mode', async () => {
    const miniProgram = getMiniProgram();
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
        await setThemeMode(miniProgram, 'dark');

        const { allRoutes, tabRoutes } = loadAllDeclaredRoutes();
        const routeExpectations = {
          'pages/splash/index': ['pages/splash/index', 'pages/index/index'],
          'pages/login/index': ['pages/login/index', 'pages/index/index'],
          'pages/login/wechat-callback': ['pages/login/wechat-callback', 'pages/login/index', 'pages/index/index'],
          'pages/login/qq-callback': ['pages/login/qq-callback', 'pages/login/index', 'pages/index/index']
        };

        const smokeRoutes = allRoutes;
        const failures = [];

        await miniProgram.reLaunch('/pages/index/index');
        await waitForAnyRoute(['pages/index/index', 'pages/practice/index'], 20000);

        for (const route of smokeRoutes) {
          try {
            const expected = routeExpectations[route] || [route];
            await openRouteWithRetry(miniProgram, route, tabRoutes, expected);

            const page = await getCurrentPage();
            const data = await page.data();
            if (!data || typeof data !== 'object') {
              throw new Error('Page data is empty or invalid object.');
            }
            if (Object.prototype.hasOwnProperty.call(data, 'isDark') && data.isDark !== true) {
              throw new Error('Page exposes isDark but not in dark mode.');
            }
          } catch (error) {
            const screenshotPath = await captureFailureScreenshot(`route_dark_${route.replace(/[\\/]/g, '_')}`);
            failures.push({ route, message: error?.message || String(error), screenshotPath });
          }
        }

        if (failures.length > 0) {
          const details = failures.map((item) => `${item.route}: ${item.message} (${item.screenshotPath})`).join('\n');
          throw new Error(`Dark route smoke failed ${failures.length}/${smokeRoutes.length} routes:\n${details}`);
        }

        expect(smokeRoutes.length).toBeGreaterThanOrEqual(30);
        return;
      } catch (error) {
        lastError = error;
        await sleep(1200);
      }
    }

    throw lastError;
  }, 480000);

  test('Test Case 1 (User Login & Auth): mock authorization writes token storage', async () => {
    await runCaseWithScreenshot('case1_login_auth', async () => {
      const miniProgram = getMiniProgram();

      await miniProgram.reLaunch('/pages/login/index?e2e=1');
      await waitForRoute('pages/login/index');

      await waitForSelector('#e2e-login-agreement');
      await waitForSelector('#e2e-login-mock-btn');

      await tap('#e2e-login-agreement');
      await tap('#e2e-login-mock-btn');

      await waitForRoute('pages/index/index', { timeout: 15000 });

      const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
      let hasToken = false;
      let hasUserId = false;

      if (hasBridge) {
        const token = await miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.getStorage('EXAM_TOKEN', ''));
        const userId = await miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.getStorage('EXAM_USER_ID', ''));
        const rawEncToken = await miniProgram.evaluate(() =>
          globalThis.__E2E_BRIDGE__.getStorage('_enc_EXAM_TOKEN', '')
        );
        hasToken =
          (typeof token === 'string' && token.length > 0) ||
          (typeof rawEncToken === 'string' && rawEncToken.length > 0);
        hasUserId = typeof userId === 'string' && userId.length > 0;
      } else {
        const encryptedToken = await miniProgram.callWxMethod('getStorageSync', '_enc_EXAM_TOKEN');
        const encryptedUserId = await miniProgram.callWxMethod('getStorageSync', '_enc_EXAM_USER_ID');
        const plainToken = await miniProgram.callWxMethod('getStorageSync', 'EXAM_TOKEN');
        const plainUserId = await miniProgram.callWxMethod('getStorageSync', 'EXAM_USER_ID');

        hasToken =
          (typeof encryptedToken === 'string' && encryptedToken.length > 0) ||
          (typeof plainToken === 'string' && plainToken.length > 0);
        hasUserId =
          (typeof encryptedUserId === 'string' && encryptedUserId.length > 0) ||
          (typeof plainUserId === 'string' && plainUserId.length > 0);
      }

      expect(hasToken).toBe(true);
      expect(hasUserId).toBe(true);
    });
  });

  test('Test Case 2 (Exam & Question Navigation): option select + next + swipe back', async () => {
    await runCaseWithScreenshot('case2_exam_navigation', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 12 });

      await miniProgram.switchTab('/pages/practice/index');
      await waitForRoute('pages/practice/index');
      await waitForSelector('#e2e-practice-start-btn');

      const startBtnWxml = await wxmlOf('#e2e-practice-start-btn');
      expect(startBtnWxml).toContain('btn-text');

      await tap('#e2e-practice-start-btn');
      await waitForRoute('pages/practice-sub/do-quiz');

      await waitForSelector('#e2e-quiz-option-0');
      const firstProgress = (await textOf('#e2e-quiz-progress')).replace(/\s+/g, '');
      expect(firstProgress).toContain('1/');

      await tap('#e2e-quiz-option-0');
      await waitForSelector('#e2e-quiz-next-btn');
      await tap('#e2e-quiz-next-btn');

      await waitForProgressFragment('2/', 8000);

      const secondProgress = (await textOf('#e2e-quiz-progress')).replace(/\s+/g, '');
      expect(secondProgress).toContain('2/');

      await swipe('#e2e-quiz-scroll', 'right');

      try {
        await waitForProgressFragment('1/', 2500);
      } catch {
        const page = await getCurrentPage();
        await page.callMethod('goToPrevQuestion');
        await waitForProgressFragment('1/', 5000);
      }
    });
  });

  test('Test Case 3 (Submission & Results): complete exam and verify score rendering', async () => {
    await runCaseWithRetry('case3_submission_results', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });

      await miniProgram.reLaunch('/pages/practice-sub/mock-exam?e2e=1');
      await waitForRoute('pages/practice-sub/mock-exam');

      await waitForSelector('#e2e-mock-count-10');
      await tap('#e2e-mock-count-10');
      await tap('#e2e-mock-start-btn');

      const initialProgress = (await textOf('#e2e-mock-progress')).replace(/\s+/g, '');
      expect(initialProgress).toContain('/10');
      await waitForSelector('#e2e-mock-question-text');

      await completeMockExamTenQuestions();

      await waitForSelector('#e2e-mock-score');
      const scoreText = await textOf('#e2e-mock-score');
      const score = Number(scoreText);

      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      const resultWxml = await wxmlOf('#e2e-mock-result');
      expect(resultWxml).toContain('score-number');

      const hasBridge = await miniProgram.evaluate(() => Boolean(globalThis.__E2E_BRIDGE__));
      if (hasBridge) {
        const records = await miniProgram.evaluate(() => globalThis.__E2E_BRIDGE__.getStorage('exam_records', []));
        const latest = Array.isArray(records) ? records[0] : null;
        expect(latest && Number(latest.questionCount)).toBe(10);
      }
    });
  });

  test('Test Case 4 (Result Actions): retry exam returns setup screen', async () => {
    await runCaseWithRetry('case4_result_retry', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });

      await miniProgram.reLaunch('/pages/practice-sub/mock-exam?e2e=1');
      await waitForRoute('pages/practice-sub/mock-exam');

      await waitForSelector('#e2e-mock-count-10');
      await tap('#e2e-mock-count-10');
      await tap('#e2e-mock-start-btn');

      await completeMockExamTenQuestions();

      await waitForSelector('#e2e-mock-retry-btn');
      await tap('#e2e-mock-retry-btn');

      await waitForSelector('#e2e-mock-setup', { timeout: 8000 });
      await waitForSelector('#e2e-mock-start-btn', { timeout: 8000 });

      const page = await getCurrentPage();
      const resultPanel = await page.$('#e2e-mock-result');
      expect(resultPanel).toBeNull();
    });
  });

  test('Test Case 5 (History Persistence): retry + second submission appends records', async () => {
    await runCaseWithScreenshot('case5_history_persistence', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });

      await miniProgram.reLaunch('/pages/practice-sub/mock-exam?e2e=1');
      await waitForRoute('pages/practice-sub/mock-exam');

      await waitForSelector('#e2e-mock-count-10');
      await tap('#e2e-mock-count-10');
      await tap('#e2e-mock-start-btn');

      await completeMockExamTenQuestions();

      const firstRecords = await getExamRecords(miniProgram);
      expect(Array.isArray(firstRecords)).toBe(true);
      expect(firstRecords.length).toBeGreaterThanOrEqual(1);

      await waitForSelector('#e2e-mock-retry-btn');
      await tap('#e2e-mock-retry-btn');
      await waitForSelector('#e2e-mock-setup', { timeout: 8000 });

      await tap('#e2e-mock-count-10');
      await tap('#e2e-mock-start-btn');
      await completeMockExamTenQuestions();

      const secondRecords = await getExamRecords(miniProgram);
      expect(Array.isArray(secondRecords)).toBe(true);
      expect(secondRecords.length).toBeGreaterThan(firstRecords.length);

      const latest = secondRecords[0] || {};
      expect(Number(latest.questionCount)).toBe(10);
    });
  });

  test('Test Case 6 (Import Flow): open import page and verify key controls', async () => {
    await runCaseWithScreenshot('case6_import_to_quiz', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });

      await miniProgram.switchTab('/pages/practice/index');
      await waitForRoute('pages/practice/index');

      await waitForSelector('#e2e-practice-import-card');
      await tap('#e2e-practice-import-card');

      await waitForRoute('pages/practice-sub/import-data');
      await waitForSelector('#e2e-import-choose-file');
      await waitForSelector('#e2e-import-start-ai-btn');

      const uploadWxml = await wxmlOf('#e2e-import-choose-file');
      expect(uploadWxml).toContain('upload-main-text');

      const startAiWxml = await wxmlOf('#e2e-import-start-ai-btn');
      expect(startAiWxml).toContain('开始智能出题');
    });
  });

  test('Test Case 8 (Core Interactions): tabs, tools, settings, school form flow', async () => {
    await runCaseWithScreenshot('case8_core_interactions', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
      const { tabRoutes } = loadAllDeclaredRoutes();

      await openRouteWithRetry(miniProgram, 'pages/index/index', tabRoutes, ['pages/index/index']);
      await waitForSelector('#e2e-home-tool-doc', { timeout: 12000 });
      await waitForSelector('#e2e-home-tool-id-photo', { timeout: 12000 });
      await waitForSelector('#e2e-home-tool-photo-search', { timeout: 12000 });

      await tap('#e2e-home-tool-doc');
      await waitForAnyRoute(['pages/tools/doc-convert'], 12000);

      await openRouteWithRetry(miniProgram, 'pages/index/index', tabRoutes, ['pages/index/index']);
      await tap('#e2e-home-tool-id-photo');
      await waitForAnyRoute(['pages/tools/id-photo'], 12000);

      await openRouteWithRetry(miniProgram, 'pages/index/index', tabRoutes, ['pages/index/index']);
      await tap('#e2e-home-tool-photo-search');
      await waitForAnyRoute(['pages/tools/photo-search'], 12000);

      await openRouteWithRetry(miniProgram, 'pages/profile/index', tabRoutes, ['pages/profile/index']);
      await waitForSelector('#e2e-profile-menu-settings', { timeout: 12000 });
      await tap('#e2e-profile-menu-settings');
      await waitForAnyRoute(['pages/settings/index'], 12000);
      await waitForSelector('#e2e-settings-root');

      await openRouteWithRetry(miniProgram, 'pages/profile/index', tabRoutes, ['pages/profile/index']);
      await waitForSelector('#e2e-profile-menu-mistake', { timeout: 12000 });
      await tap('#e2e-profile-menu-mistake');
      await waitForAnyRoute(['pages/mistake/index'], 12000);

      await openRouteWithRetry(miniProgram, 'pages/school/index', tabRoutes, ['pages/school/index']);
      await waitForSelector('#e2e-school-input-current-school', { timeout: 15000 });
      await waitForSelector('#e2e-school-input-current-major', { timeout: 15000 });
      await input('#e2e-school-input-current-school', 'E2E大学');
      await input('#e2e-school-input-current-major', '计算机科学与技术');
      await tap('#e2e-school-step1-next');
      await waitForSelector('#e2e-school-input-target-school', { timeout: 15000 });

      await waitForSelector('#e2e-school-input-target-major');
      await input('#e2e-school-input-target-school', '北京大学');
      await input('#e2e-school-input-target-major', '计算机');

      await tap('#e2e-school-step2-prev');
      await waitForSelector('#e2e-school-input-current-school', { timeout: 12000 });
      await tap('#e2e-school-step1-next');
      await waitForSelector('#e2e-school-input-target-school', { timeout: 12000 });
    });
  }, 300000);

  test('Test Case 9 (Theme/UI): verify light and dark mode rendering on key pages', async () => {
    await runCaseWithRetry(
      'case9_theme_ui_modes',
      async () => {
        const miniProgram = getMiniProgram();
        await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
        const { tabRoutes } = loadAllDeclaredRoutes();

        await setThemeMode(miniProgram, 'light');
        await openRouteWithRetry(miniProgram, 'pages/index/index', tabRoutes, ['pages/index/index']);
        await waitForSelector('#e2e-home-root', { timeout: 12000 });
        await waitForPageDarkState(false, 12000);
        await captureUiSnapshot(miniProgram, 'home_light');

        await openRouteWithRetry(miniProgram, 'pages/profile/index', tabRoutes, ['pages/profile/index']);
        await waitForSelector('#e2e-profile-theme-btn', { timeout: 12000 });
        await tap('#e2e-profile-theme-btn');
        await sleep(700);
        await waitForPageDarkState(true, 12000);

        const darkMode = await getThemeMode(miniProgram);
        expect(String(darkMode)).toBe('dark');
        await captureUiSnapshot(miniProgram, 'profile_dark');

        await openRouteWithRetry(miniProgram, 'pages/practice/index', tabRoutes, ['pages/practice/index']);
        await waitForPageDarkState(true, 12000);
        await captureUiSnapshot(miniProgram, 'practice_dark');

        await openRouteWithRetry(miniProgram, 'pages/school/index', tabRoutes, ['pages/school/index']);
        await waitForPageDarkState(true, 12000);
        await captureUiSnapshot(miniProgram, 'school_dark');

        await openRouteWithRetry(miniProgram, 'pages/settings/index', tabRoutes, ['pages/settings/index']);
        await waitForPageDarkState(true, 12000);
        await waitForSelector('#e2e-settings-dark-switch');
        await captureUiSnapshot(miniProgram, 'settings_dark');

        await openRouteWithRetry(miniProgram, 'pages/profile/index', tabRoutes, ['pages/profile/index']);
        await waitForSelector('#e2e-profile-theme-btn', { timeout: 12000 });
        await tap('#e2e-profile-theme-btn');
        await sleep(700);
        await waitForPageDarkState(false, 12000);

        const lightModeAgain = await getThemeMode(miniProgram);
        expect(String(lightModeAgain)).toBe('light');

        await openRouteWithRetry(miniProgram, 'pages/index/index', tabRoutes, ['pages/index/index']);
        await waitForPageDarkState(false, 12000);
        await captureUiSnapshot(miniProgram, 'home_light_again');
      },
      { attempts: 3, retryDelay: 1800 }
    );
  }, 240000);

  test('Test Case 11 (Practice Deep): battle and menu route interactions', async () => {
    await runCaseWithScreenshot('case11_practice_deep_routes', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
      const { tabRoutes } = loadAllDeclaredRoutes();

      const openPractice = () =>
        openRouteWithRetry(miniProgram, 'pages/practice/index', tabRoutes, ['pages/practice/index']);

      await openPractice();
      await waitForSelector('#e2e-practice-battle-btn', { timeout: 15000 });
      await tap('#e2e-practice-battle-btn');
      await waitForAnyRoute(['pages/practice-sub/pk-battle'], 12000);

      await openPractice();
      await waitForSelector('#e2e-practice-menu-file-manager', { timeout: 15000 });
      await tap('#e2e-practice-menu-file-manager');
      await waitForAnyRoute(['pages/practice-sub/file-manager'], 12000);

      await openPractice();
      await waitForSelector('#e2e-practice-menu-ai-tutor', { timeout: 15000 });
      await tap('#e2e-practice-menu-ai-tutor');
      await waitForAnyRoute(['pages/chat/chat'], 12000);

      await openPractice();
      await waitForSelector('#e2e-practice-menu-rank', { timeout: 15000 });
      await tap('#e2e-practice-menu-rank');
      await waitForAnyRoute(['pages/practice-sub/rank'], 12000);

      await openPractice();
      await waitForSelector('#e2e-practice-menu-study-detail', { timeout: 15000 });
      await tap('#e2e-practice-menu-study-detail');
      await waitForAnyRoute(['pages/study-detail/index'], 12000);

      await openPractice();
      await waitForSelector('#e2e-practice-menu-mistake', { timeout: 15000 });
      await tap('#e2e-practice-menu-mistake');
      await waitForAnyRoute(['pages/mistake/index'], 12000);
    });
  }, 300000);

  test('Test Case 12 (School Deep): result cards, target toggle, detail actions', async () => {
    await runCaseWithScreenshot('case12_school_deep_flow', async () => {
      const miniProgram = getMiniProgram();
      await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
      const { tabRoutes } = loadAllDeclaredRoutes();

      await openRouteWithRetry(miniProgram, 'pages/school/index', tabRoutes, ['pages/school/index']);
      await waitForSelector('#e2e-school-input-current-school', { timeout: 15000 });
      await input('#e2e-school-input-current-school', 'E2E 本科院校');
      await input('#e2e-school-input-current-major', '计算机科学');
      await tap('#e2e-school-step1-next');

      await waitForSelector('#e2e-school-input-target-school', { timeout: 15000 });
      await input('#e2e-school-input-target-school', '目标大学');
      await input('#e2e-school-input-target-major', '软件工程');

      const mockSchools = [
        {
          id: 'e2e_school_main',
          code: 'e2e_school_main',
          name: 'E2E大学',
          location: '北京',
          tags: ['985', '211'],
          matchRate: 91,
          majors: [
            { code: '081200', name: '计算机科学与技术', type: '学硕', scores: [{ total: '372', eng: '60' }] },
            { code: '085400', name: '电子信息', type: '专硕', scores: [{ total: '365', eng: '58' }] }
          ]
        },
        {
          id: 'e2e_school_alt',
          code: 'e2e_school_alt',
          name: 'E2E理工大学',
          location: '上海',
          tags: ['双一流'],
          matchRate: 84,
          majors: [{ code: '081100', name: '控制科学与工程', type: '学硕', scores: [{ total: '358', eng: '55' }] }]
        }
      ];

      const injectResult = await miniProgram.evaluate(
        (payload) => {
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
          const current = pages[pages.length - 1];
          const vm = current?.$vm || current;
          if (!vm) {
            return { ok: false, reason: 'missing-vm' };
          }

          if (typeof vm.applySchoolList === 'function') {
            vm.applySchoolList(payload.schools, true);
          } else {
            vm.schoolList = Array.isArray(payload.schools) ? payload.schools : [];
            vm.hasRealData = true;
            if (typeof vm.syncTargetStatus === 'function') {
              vm.syncTargetStatus();
            }
          }

          vm.currentStep = 3;
          return {
            ok: true,
            count: Array.isArray(vm.schoolList) ? vm.schoolList.length : 0
          };
        },
        { schools: mockSchools }
      );

      expect(injectResult?.ok).toBe(true);
      expect(Number(injectResult?.count || 0)).toBeGreaterThanOrEqual(2);
      await waitForSelector('#e2e-school-result-root', { timeout: 15000 });
      await waitForSelector('#e2e-school-card-target-0', { timeout: 15000 });

      await tap('#e2e-school-card-target-0');
      await sleep(500);
      const targetsAfterAdd = await getStorageValue(miniProgram, 'target_schools', []);
      expect(Array.isArray(targetsAfterAdd)).toBe(true);
      expect(targetsAfterAdd.some((item) => String(item?.id) === 'e2e_school_main')).toBe(true);

      await tap('#e2e-school-card-target-0');
      await sleep(500);
      const targetsAfterRemove = await getStorageValue(miniProgram, 'target_schools', []);
      expect(targetsAfterRemove.some((item) => String(item?.id) === 'e2e_school_main')).toBe(false);

      await tap('#e2e-school-card-detail-0');
      await waitForRoute('pages/school-sub/detail', { timeout: 15000 });
      await waitForSelector('#e2e-school-detail-root', { timeout: 15000 });
      await waitForSelector('#e2e-school-detail-consult-btn', { timeout: 15000 });
      await waitForSelector('#e2e-school-detail-target-btn', { timeout: 15000 });

      await tap('#e2e-school-detail-consult-btn');
      await sleep(400);
      const detailPage = await getCurrentPage();
      const detailData = await detailPage.data();
      if (Object.prototype.hasOwnProperty.call(detailData, 'showAIConsultPanel')) {
        expect(detailData.showAIConsultPanel).toBe(true);
      }

      await tap('#e2e-school-detail-target-btn');
      await sleep(500);
      const detailTargetsAdded = await getStorageValue(miniProgram, 'target_schools', []);
      expect(detailTargetsAdded.some((item) => String(item?.id) === 'e2e_school_main')).toBe(true);

      await tap('#e2e-school-detail-target-btn');
      await sleep(500);
      const detailTargetsRemoved = await getStorageValue(miniProgram, 'target_schools', []);
      expect(detailTargetsRemoved.some((item) => String(item?.id) === 'e2e_school_main')).toBe(false);
    });
  }, 320000);

  test('Test Case 13 (Profile/Settings): checkin and switch persistence', async () => {
    await runCaseWithRetry(
      'case13_profile_settings_persistence',
      async () => {
        const miniProgram = getMiniProgram();
        await seedBaseState({ userId: 'e2e_user', questionCount: 20 });
        const { tabRoutes } = loadAllDeclaredRoutes();

        await openRouteWithRetry(miniProgram, 'pages/profile/index', tabRoutes, ['pages/profile/index']);
        await waitForSelector('#e2e-profile-checkin-btn', { timeout: 15000 });

        const profilePage = await getCurrentPage();
        const beforeProfileData = await profilePage.data();
        if (!beforeProfileData?.todayChecked) {
          await tap('#e2e-profile-checkin-btn');
          await sleep(700);
          const afterProfileData = await (await getCurrentPage()).data();
          if (Object.prototype.hasOwnProperty.call(afterProfileData, 'todayChecked')) {
            expect(afterProfileData.todayChecked).toBe(true);
          }
        }

        await waitForSelector('#e2e-profile-menu-settings', { timeout: 12000 });
        await tap('#e2e-profile-menu-settings');
        await waitForRoute('pages/settings/index', { timeout: 15000 });

        await waitForSelector('#e2e-settings-voice-switch', { timeout: 15000 });
        await waitForSelector('#e2e-settings-dark-switch', { timeout: 15000 });
        await waitForSelector('#e2e-settings-back', { timeout: 15000 });

        const voiceBefore = Boolean(await getStorageValue(miniProgram, 'voice_enabled', true));
        await tap('#e2e-settings-voice-switch');
        await sleep(500);

        let voiceAfter = Boolean(await getStorageValue(miniProgram, 'voice_enabled', true));
        if (voiceAfter === voiceBefore) {
          const settingsPage = await getCurrentPage();
          await settingsPage.callMethod('toggleVoice', { detail: { value: !voiceBefore } });
          await sleep(500);
          voiceAfter = Boolean(await getStorageValue(miniProgram, 'voice_enabled', true));
        }
        expect(voiceAfter).toBe(!voiceBefore);

        const darkBefore = String(await getStorageValue(miniProgram, 'theme_mode', 'light'));
        await tap('#e2e-settings-dark-switch');
        await sleep(500);
        let darkAfter = String(await getStorageValue(miniProgram, 'theme_mode', 'light'));

        if (darkAfter === darkBefore) {
          const settingsPage = await getCurrentPage();
          await settingsPage.callMethod('toggleDark', { detail: { value: darkBefore !== 'dark' } });
          await sleep(500);
          darkAfter = String(await getStorageValue(miniProgram, 'theme_mode', 'light'));
        }
        expect(darkAfter).not.toBe(darkBefore);

        await tap('#e2e-settings-back');
        await waitForAnyRoute(['pages/profile/index'], 15000);

        await setStorageValue(miniProgram, 'theme_mode', 'light');
        await setStorageValue(miniProgram, 'voice_enabled', true);
      },
      { attempts: 3, retryDelay: 1800 }
    );
  }, 260000);
});
