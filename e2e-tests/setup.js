import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { beforeAll, afterAll } from '@jest/globals';
import automator from 'miniprogram-automator';

const workspaceRoot = path.resolve(process.cwd());
const port = Number(process.env.WECHAT_DEVTOOLS_PORT || 19099);
const wsEndpoint = process.env.WECHAT_WS_ENDPOINT || `ws://127.0.0.1:${port}`;
const launchTimeout = Number(process.env.WECHAT_AUTOMATOR_TIMEOUT || 120000);
const httpEndpoint = process.env.WECHAT_HTTP_ENDPOINT || `http://127.0.0.1:${port}`;
const launchPort = Number(process.env.WECHAT_AUTOMATOR_LAUNCH_PORT || 0);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry({ timeoutMs = 20000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return await automator.connect({ wsEndpoint });
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }

  throw lastError || new Error(`Failed connecting to ${wsEndpoint}`);
}

async function openProjectViaHttp(projectPath) {
  const params = new URLSearchParams({ project: projectPath });
  const openUrl = `${httpEndpoint}/v2/open?${params.toString()}`;

  const response = await fetch(openUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP open failed (${response.status})`);
  }
}

async function resolveCliPath() {
  const envCliPath = process.env.WECHAT_DEVTOOLS_CLI_PATH;
  const candidates = [
    envCliPath,
    '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    '/Applications/微信开发者工具.app/Contents/MacOS/cli',
    '/Applications/WeChat DevTools.app/Contents/MacOS/cli',
    path.join(process.env.HOME || '', 'Applications/wechatwebdevtools.app/Contents/MacOS/cli')
  ].filter(Boolean);

  for (const cliPath of candidates) {
    try {
      await fs.access(cliPath, fsConstants.X_OK);
      return cliPath;
    } catch {
      // Continue scanning candidates.
    }
  }

  return null;
}

async function connectMiniProgram() {
  const projectPath = process.env.WECHAT_PROJECT_PATH || workspaceRoot;

  try {
    const miniProgram = await automator.connect({ wsEndpoint });
    return { miniProgram, launchedByTest: false };
  } catch (connectError) {
    try {
      await openProjectViaHttp(projectPath);
      const miniProgram = await connectWithRetry({ timeoutMs: 25000, intervalMs: 1000 });
      return { miniProgram, launchedByTest: false };
    } catch {
      // Fallback to CLI launch when HTTP open is unavailable.
    }

    const cliPath = await resolveCliPath();
    if (!cliPath) {
      const message = [
        `Failed to connect to WeChat DevTools at ${wsEndpoint}.`,
        'If DevTools is already open, verify that Service Port is enabled and the port number is correct.',
        'If you want the test to launch DevTools automatically, install WeChat DevTools in /Applications or set WECHAT_DEVTOOLS_CLI_PATH.',
        `Original error: ${connectError?.message || connectError}`
      ].join(' ');
      throw new Error(message);
    }

    const miniProgram = await automator.launch({
      projectPath,
      cliPath,
      ...(launchPort > 0 ? { port: launchPort } : {}),
      trustProject: true,
      timeout: launchTimeout
    });

    return { miniProgram, launchedByTest: true };
  }
}

beforeAll(async () => {
  const { miniProgram, launchedByTest } = await connectMiniProgram();
  globalThis.__MINI_PROGRAM__ = miniProgram;
  globalThis.__MINI_PROGRAM_META__ = { launchedByTest };
}, launchTimeout + 10000);

afterAll(async () => {
  const miniProgram = globalThis.__MINI_PROGRAM__;
  const launchedByTest = Boolean(globalThis.__MINI_PROGRAM_META__?.launchedByTest);
  if (!miniProgram) return;

  if (launchedByTest) {
    try {
      await miniProgram.close();
    } catch {
      // Ignore close failures, disconnect is still attempted.
    }
  }

  try {
    miniProgram.disconnect();
  } catch {
    // Ignore disconnect failures in teardown.
  }

  delete globalThis.__MINI_PROGRAM__;
  delete globalThis.__MINI_PROGRAM_META__;
});
