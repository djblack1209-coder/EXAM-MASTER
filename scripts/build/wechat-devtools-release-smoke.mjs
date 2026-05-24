#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const automator = require('miniprogram-automator');

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const DEFAULT_PROJECT = path.join(PROJECT_ROOT, 'dist/build/mp-weixin');
const DEFAULT_REPORT = path.join(PROJECT_ROOT, 'data/reports/wechat-devtools-release-smoke.json');
const DEFAULT_SCREENSHOT = path.join(PROJECT_ROOT, 'data/release-evidence/wechat-release-smoke.png');

function parseArgs(argv) {
  const options = {
    cliPath: DEFAULT_CLI,
    projectPath: DEFAULT_PROJECT,
    output: DEFAULT_REPORT,
    screenshot: DEFAULT_SCREENSHOT,
    port: 9421,
    timeout: 120_000,
    failOnBlockers: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=');
    const nextValue = inlineValue ?? argv[index + 1];

    if (key === '--cli-path') {
      options.cliPath = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--project-path') {
      options.projectPath = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--output') {
      options.output = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--screenshot') {
      options.screenshot = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--port') {
      options.port = Number(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--timeout') {
      options.timeout = Number(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (arg === '--fail-on-blockers') {
      options.failOnBlockers = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function usage() {
  console.log(`Usage: node scripts/build/wechat-devtools-release-smoke.mjs [options]

Options:
  --project-path <path>      Built mp-weixin directory. Defaults to dist/build/mp-weixin.
  --cli-path <path>          WeChat DevTools CLI path.
  --output <path>            JSON report output path.
  --screenshot <path>        Screenshot output path.
  --port <number>            Automation port. Defaults to 9421.
  --fail-on-blockers         Exit non-zero when a smoke assertion fails.
`);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pass(name, details = {}) {
  return { name, status: 'passed', ...details };
}

function block(name, error, details = {}) {
  return {
    name,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
    ...details
  };
}

function buildTimeoutReport(options) {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    finishedAt: now,
    tool: 'WeChat DevTools CLI + miniprogram-automator',
    cliPath: options.cliPath,
    projectPath: options.projectPath,
    screenshot: options.screenshot,
    status: 'blocked',
    steps: [
      block(
        'smoke-timeout',
        new Error(`Timed out after ${options.timeout}ms while connecting to or driving WeChat DevTools`),
        {
          timeoutMs: options.timeout,
          action: 'Check that WeChat DevTools automation port is available, then re-run this smoke command.'
        }
      )
    ]
  };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function textOf(page, selector) {
  const element = await page.$(selector);
  return element ? await element.text() : '';
}

async function countOf(page, selector) {
  return (await page.$$(selector)).length;
}

async function waitForPage(page, selector, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.$(selector)) return;
    await page.waitFor(250);
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function getStorage(miniProgram) {
  return await miniProgram.evaluate(() => {
    const storage = {};
    for (const key of wx.getStorageInfoSync().keys) {
      storage[key] = wx.getStorageSync(key);
    }
    return storage;
  });
}

async function setReleaseSmokeProfile(miniProgram) {
  await miniProgram.evaluate(() => {
    wx.clearStorageSync();
    wx.setStorageSync('onboarding_completed', true);
    wx.setStorageSync('exam_profile', {
      targetExam: 'postgraduate',
      tracks: {
        politics: 'politics',
        english: 'english1',
        math: 'math1'
      },
      dailyGoal: 25,
      updatedAt: new Date().toISOString()
    });
  });
}

async function seedEnglish2011Bank(miniProgram) {
  const bankPath = path.join(PROJECT_ROOT, 'src/config/flashcard-banks/english1-2011.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  await miniProgram.evaluate((payload) => {
    const normalizeOption = (option) => {
      const text =
        typeof option === 'string'
          ? option
          : [option && option.label, (option && (option.text || option.value || option.content))].filter(Boolean).join('. ');
      return String(text || '').replace(/^[A-Z]\s*[.。:：、)）-]\s*/i, '').trim();
    };
    const cards = (payload.cards || []).map((card) => {
      const passage = card.passage || card.context || card.material || card.article || '';
      return {
        ...card,
        paperId: 'english1-2011',
        paperName: '2011考研英语一真题',
        category: '英语',
        passage,
        context: card.context || passage,
        material: card.material || passage,
        options: (card.options || []).map(normalizeOption),
        desc: card.explanation || card.desc || '暂无解析'
      };
    });
    wx.setStorageSync('v30_bank', cards);
    wx.setStorageSync('loaded_flashcard_banks', ['english1-2011']);
    wx.setStorageSync('smart_review_ids', cards.map((card) => card.id));
  }, bank);
  return bank.cards?.length || 0;
}

async function runSmoke(options) {
  if (!fs.existsSync(options.cliPath)) {
    throw new Error(`WeChat DevTools CLI not found: ${options.cliPath}`);
  }
  if (!fs.existsSync(path.join(options.projectPath, 'app.json'))) {
    throw new Error(`Built mp-weixin artifact not found: ${options.projectPath}`);
  }

  const report = {
    startedAt: new Date().toISOString(),
    tool: 'WeChat DevTools CLI + miniprogram-automator',
    cliPath: options.cliPath,
    projectPath: options.projectPath,
    screenshot: options.screenshot,
    status: 'running',
    steps: []
  };

  let miniProgram = null;
  try {
    miniProgram = await automator.launch({
      cliPath: options.cliPath,
      projectPath: options.projectPath,
      port: options.port,
      timeout: options.timeout,
      trustProject: true
    });

    miniProgram.on('exception', (event) => {
      report.steps.push(block('runtime-exception', new Error(JSON.stringify(event))));
    });

    const systemInfo = await miniProgram.systemInfo();
    report.steps.push(pass('devtools-runtime', {
      platform: systemInfo?.platform,
      SDKVersion: systemInfo?.SDKVersion,
      version: systemInfo?.version,
      model: systemInfo?.model,
      system: systemInfo?.system
    }));

    await setReleaseSmokeProfile(miniProgram);
    report.steps.push(pass('reset-local-profile'));

    let page = await miniProgram.reLaunch('/pages/splash/index');
    await page.waitFor(2300);
    page = await miniProgram.currentPage();
    assertCondition(['pages/index/index', 'pages/practice/index'].includes(page.path), `Unexpected post-splash page: ${page.path}`);
    report.steps.push(pass('launch-and-splash-route', { path: page.path }));

    page = await miniProgram.switchTab('/pages/practice/index');
    await waitForPage(page, '.practice-hero');
    const practiceData = await page.data();
    const practiceHeroText = await textOf(page, '.practice-hero');
    const practiceCommands = await countOf(page, '.practice-command');
    assertCondition(practiceHeroText.includes('今日刷题'), 'Practice center hero is not visible');
    assertCondition(practiceCommands >= 2, 'Practice center command buttons are missing');
    report.steps.push(pass('practice-center', {
      path: page.path,
      commandCount: practiceCommands,
      selectedTrackId: practiceData.selectedTrackId,
      selectedSubjectKey: practiceData.selectedSubjectKey
    }));

    page = await miniProgram.navigateTo('/pages/practice-sub/question-bank');
    await waitForPage(page, '.paper-card');
    const questionBankText = await textOf(page, '.qb-page');
    const paperCardCount = await countOf(page, '.paper-card');
    const pendingItemCount = await countOf(page, '.pending-item');
    assertCondition(questionBankText.includes('按年份刷真题'), 'Question bank title is not visible');
    assertCondition(paperCardCount >= 1, 'No playable paper cards are visible');
    report.steps.push(pass('question-bank', {
      path: page.path,
      paperCardCount,
      pendingItemCount
    }));

    const defaultPaperButton = await page.$('.paper-btn.primary');
    assertCondition(defaultPaperButton, 'Default paper primary action is not visible');
    await defaultPaperButton.tap();
    await page.waitFor(4500);
    page = await miniProgram.currentPage();
    assertCondition(page.path === 'pages/practice-sub/do-quiz', `Expected quiz page after default paper start, got ${page.path}`);
    const defaultStartStorage = await getStorage(miniProgram);
    const defaultBankCount = Array.isArray(defaultStartStorage.v30_bank) ? defaultStartStorage.v30_bank.length : 0;
    const defaultOptionCount = await countOf(page, '.option-item');
    assertCondition(defaultBankCount > 0, 'Default paper start did not import questions into local storage');
    assertCondition(defaultOptionCount >= 4, 'Default paper start did not render selectable options');
    report.steps.push(pass('question-bank-default-start', {
      path: page.path,
      localBankCount: defaultBankCount,
      optionCount: defaultOptionCount
    }));

    page = await miniProgram.navigateBack();
    await page.waitFor(800);
    page = await miniProgram.currentPage();
    if (page.path !== 'pages/practice-sub/question-bank') {
      page = await miniProgram.navigateTo('/pages/practice-sub/question-bank');
      await waitForPage(page, '.paper-card');
    }

    const seededEnglishCards = await seedEnglish2011Bank(miniProgram);
    report.steps.push(pass('seed-english2011-bank', { cardCount: seededEnglishCards }));
    page = await miniProgram.navigateTo('/pages/practice-sub/do-quiz?mode=smart_review&paperId=english1-2011');
    await page.waitFor(4500);
    page = await miniProgram.currentPage();
    assertCondition(page.path === 'pages/practice-sub/do-quiz', `Expected quiz page, got ${page.path}`);
    const quizStorage = await getStorage(miniProgram);
    const loadedEnglishCards = Array.isArray(quizStorage.v30_bank)
      ? quizStorage.v30_bank.filter((item) => item.paperId === 'english1-2011')
      : [];
    assertCondition(loadedEnglishCards.length === 52, `Expected 52 loaded English 2011 cards, got ${loadedEnglishCards.length}`);
    const passageSegmentCount = await countOf(page, '.q-passage-segment');
    const optionCount = await countOf(page, '.option-item');
    const progressText = await textOf(page, '#e2e-quiz-progress');
    assertCondition(passageSegmentCount > 0, 'English passage segments are not visible');
    assertCondition(optionCount >= 4, 'Quiz options are not visible');
    report.steps.push(pass('english-quiz-entry', {
      path: page.path,
      progressText,
      loadedEnglish2011Cards: loadedEnglishCards.length,
      passageSegmentCount,
      optionCount
    }));

    const firstSegment = await page.$('.q-passage-segment');
    assertCondition(firstSegment, 'No passage segment can be selected');
    await firstSegment.tap();
    await page.waitFor(500);
    const storageAfterAnnotation = await getStorage(miniProgram);
    const annotationKeys = Object.keys(storageAfterAnnotation.passage_annotations || {});
    assertCondition(annotationKeys.length > 0, 'Passage annotation was not saved');
    report.steps.push(pass('english-passage-annotation', {
      annotationKeys,
      storageHasPassageAnnotations: Boolean(storageAfterAnnotation.passage_annotations)
    }));

    const firstOption = await page.$('.option-item');
    assertCondition(firstOption, 'No option can be selected');
    await firstOption.tap();
    await page.waitFor(800);
    const resultVisible = await countOf(page, '.result-pop');
    assertCondition(resultVisible === 1, 'Quiz result panel did not open after selecting an answer');
    report.steps.push(pass('quiz-answer-result', {
      resultVisible
    }));

    await miniProgram.navigateBack();
    await miniProgram.navigateBack();
    page = await miniProgram.navigateTo('/pages/practice-sub/professional-index');
    await waitForPage(page, '.professional-page');
    const professionalText = await textOf(page, '.professional-page');
    const sourceCardCount = await countOf(page, '.source-card');
    assertCondition(professionalText.includes('专业课索引'), 'Professional index header is not visible');
    assertCondition(sourceCardCount > 0, 'Professional source cards are not visible');
    assertCondition(!/\benglish\b|\bpolitics\b|\bmath\b/.test(professionalText), 'Professional directions expose raw track keys');
    report.steps.push(pass('professional-index', {
      path: page.path,
      visibleSourceCards: sourceCardCount
    }));

    ensureParent(options.screenshot);
    await miniProgram.screenshot({ path: options.screenshot });
    report.steps.push(pass('screenshot', { path: options.screenshot }));
  } catch (error) {
    report.steps.push(block('smoke-run', error));
  } finally {
    if (miniProgram) {
      try {
        await miniProgram.close();
      } catch (_error) {
        miniProgram.disconnect?.();
      }
    }
  }

  report.finishedAt = new Date().toISOString();
  report.status = report.steps.some((step) => step.status === 'blocked') ? 'blocked' : 'passed';
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return 0;
  }

  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(buildTimeoutReport(options));
    }, Math.max(Number(options.timeout || 60_000) + 10_000, 15_000));
  });
  const report = await Promise.race([runSmoke(options), timeoutPromise]);
  clearTimeout(timeoutHandle);
  ensureParent(options.output);
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `[wechat-devtools-smoke] status=${report.status} steps=${report.steps.length} report=${path.relative(PROJECT_ROOT, options.output)}`
  );
  if (report.status !== 'passed') {
    const blockers = report.steps.filter((step) => step.status === 'blocked');
    for (const blocker of blockers) {
      console.error(`[wechat-devtools-smoke] blocked ${blocker.name}: ${blocker.error}`);
    }
    return options.failOnBlockers ? 2 : 0;
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
