#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

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
  const diagnostic = classifyWechatDevtoolsSmokeError(error);
  return {
    name,
    status: 'blocked',
    error: error instanceof Error ? error.message : String(error),
    code: diagnostic.code,
    category: diagnostic.category,
    action: diagnostic.action,
    ...details
  };
}

export function classifyWechatDevtoolsSmokeError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/需要重新登录|重新登录|code\s*10|login\s*false/i.test(message)) {
    return {
      code: 'wechat_devtools_login_required',
      category: 'auth',
      action: 'Log in to WeChat DevTools, then re-run npm run smoke:wechat:devtools.'
    };
  }
  if (/listen EPERM|operation not permitted/i.test(message)) {
    return {
      code: 'local_port_listen_denied',
      category: 'environment',
      action: 'Run the smoke command in an environment that allows local automation ports.'
    };
  }
  if (/http port is open|Port .* is in use|Failed connecting to ws/i.test(message)) {
    return {
      code: 'wechat_devtools_automation_port_unavailable',
      category: 'environment',
      action: 'Enable WeChat DevTools automation/service port, then re-run npm run smoke:wechat:devtools.'
    };
  }
  return {
    code: 'wechat_devtools_smoke_failed',
    category: 'smoke',
    action: 'Inspect the blocked smoke step, fix the mini-program flow, then re-run npm run smoke:wechat:devtools.'
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

async function waitForPage(page, selector, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.$(selector)) return;
    await page.waitFor(250);
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

async function runSmoke(options, lifecycle) {
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
    const loginCheck = spawnSync(options.cliPath, ['islogin'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 15_000
    });
    const loginOutput = `${loginCheck.stdout || ''}\n${loginCheck.stderr || ''}`.trim();
    if (/\"login\"\s*:\s*false/.test(loginOutput)) {
      throw new Error(`WeChat DevTools login required: ${loginOutput}`);
    }
    if (loginCheck.status !== 0 && loginOutput) {
      throw new Error(loginOutput);
    }
    if (/\"login\"\s*:\s*true/.test(loginOutput)) {
      report.steps.push(pass('wechat-devtools-preflight', { login: true }));
    }

    miniProgram = await automator.launch({
      cliPath: options.cliPath,
      projectPath: options.projectPath,
      port: options.port,
      timeout: options.timeout,
      trustProject: true
    });
    lifecycle.miniProgram = miniProgram;
    if (lifecycle.timedOut) throw new Error('Smoke deadline expired before launch completed');

    miniProgram.on('exception', (event) => {
      report.steps.push(block('runtime-exception', new Error(JSON.stringify(event))));
    });

    const systemInfo = await miniProgram.systemInfo();
    report.steps.push(
      pass('devtools-runtime', {
        platform: systemInfo?.platform,
        SDKVersion: systemInfo?.SDKVersion,
        version: systemInfo?.version,
        model: systemInfo?.model,
        system: systemInfo?.system
      })
    );

    let page = await miniProgram.reLaunch('/pages/learning/index');
    await waitForPage(page, '.learning-page');
    report.steps.push(pass('conversation-workspace', { path: page.path }));
    page = await miniProgram.navigateTo('/pages/archive/index');
    await waitForPage(page, '.archive-content');
    report.steps.push(pass('learning-archive', { path: page.path }));
    // Navigation is only a partial device check and must not unlock public release.
    report.steps.push(
      block(
        'full-device-learning-pending',
        new Error('工作区导航已检查；真实设备作答、资料、隐私、登录和网络仍须完整验收。')
      )
    );
    ensureParent(options.screenshot);
    await miniProgram.screenshot({ path: options.screenshot });
    report.steps.push(pass('screenshot', { path: options.screenshot }));
  } catch (error) {
    report.steps.push(block('smoke-run', error));
  } finally {
    await lifecycle.close();
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

  const lifecycle = {
    miniProgram: null,
    timedOut: false,
    closing: null,
    async close() {
      if (!this.miniProgram) return;
      if (!this.closing) {
        const program = this.miniProgram;
        this.closing = (async () => {
          let deadline;
          try {
            await Promise.race([
              program.close(),
              new Promise((_, reject) => {
                deadline = setTimeout(() => reject(new Error('DevTools close timeout')), 5000);
              })
            ]);
          } finally {
            clearTimeout(deadline);
            program.disconnect?.();
          }
        })();
      }
      return this.closing;
    }
  };
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(
      () => {
        lifecycle.timedOut = true;
        resolve(buildTimeoutReport(options));
      },
      Math.max(Number(options.timeout || 60_000) + 10_000, 15_000)
    );
  });
  let report;
  try {
    report = await Promise.race([runSmoke(options, lifecycle), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
    await lifecycle.close();
  }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
