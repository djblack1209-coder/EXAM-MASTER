#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_ENV_FILES = [
  path.join(PROJECT_ROOT, '.env'),
  path.join(PROJECT_ROOT, '.env.production'),
  path.join(PROJECT_ROOT, 'laf-backend/.env')
];

function parseArgs(argv) {
  const options = {
    failOnSkipped: false,
    output: '',
    envFiles: [...DEFAULT_ENV_FILES],
    useEnvFiles: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=');
    const nextValue = inlineValue ?? argv[index + 1];

    if (arg === '--fail-on-skipped') {
      options.failOnSkipped = true;
    } else if (key === '--output') {
      options.output = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--env-file') {
      options.envFiles.push(path.resolve(nextValue));
      options.useEnvFiles = true;
      if (inlineValue === undefined) index += 1;
    } else if (arg === '--no-env-files') {
      options.envFiles = [];
      options.useEnvFiles = false;
    }
  }

  return options;
}

function existsFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function stripInlineComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? '' : quote || char;
    }
    if (char === '#' && !quote && /\s/.test(previous || ' ')) {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

function normalizeEnvValue(rawValue) {
  let value = stripInlineComment(String(rawValue || '').trim());
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }
  if (quote === '"') {
    value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
  }
  return value;
}

function parseEnvFile(filePath) {
  if (!existsFile(filePath)) return {};
  const result = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    result[match[1]] = normalizeEnvValue(match[2]);
  }
  return result;
}

function loadEnvFiles(filePaths) {
  return filePaths.reduce((merged, filePath) => ({ ...merged, ...parseEnvFile(filePath) }), {});
}

const OPTIONS = parseArgs(process.argv.slice(2));
const RELEASE_ENV = OPTIONS.useEnvFiles ? { ...loadEnvFiles(OPTIONS.envFiles), ...process.env } : { ...process.env };

const BASE_URL_SOURCE =
  RELEASE_ENV.SMOKE_BASE_URL || RELEASE_ENV.LAF_API_URL || RELEASE_ENV.VITE_API_BASE_URL || '';
const ALLOW_LEGACY_SEALOS = String(RELEASE_ENV.SMOKE_ALLOW_LEGACY_SEALOS || '').toLowerCase() === 'true';

if (!BASE_URL_SOURCE) {
  console.error(
    'Cloud smoke requires an explicit SMOKE_BASE_URL (or LAF_API_URL/VITE_API_BASE_URL); refusing to use a retired default.'
  );
  process.exit(2);
}

if (/sealosbja\.site/i.test(BASE_URL_SOURCE) && !ALLOW_LEGACY_SEALOS) {
  console.error(
    'Cloud smoke target is the retired Sealos host. Set SMOKE_BASE_URL to the current production entry, or explicitly opt in with SMOKE_ALLOW_LEGACY_SEALOS=true for cold recovery only.'
  );
  process.exit(2);
}

const BASE_URL = BASE_URL_SOURCE.replace(/\/$/, '');

const RETRIES = Number(RELEASE_ENV.SMOKE_RETRIES || 8);
const RETRY_DELAY_MS = Number(RELEASE_ENV.SMOKE_RETRY_DELAY_MS || 1000);
const FAIL_ON_SKIPPED =
  OPTIONS.failOnSkipped || String(RELEASE_ENV.SMOKE_FAIL_ON_SKIPPED || '').toLowerCase() === 'true';

const EMAIL = RELEASE_ENV.SMOKE_EMAIL || '';
const PASSWORD = RELEASE_ENV.SMOKE_PASSWORD || '';
const DIRECT_TOKEN = RELEASE_ENV.SMOKE_TOKEN || RELEASE_ENV.SMOKE_JWT || '';
const DIRECT_USER_ID = RELEASE_ENV.SMOKE_USER_ID || '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(responseStatus, payload) {
  if (responseStatus >= 500) return true;
  if (Number(payload?.code) >= 500) return true;
  const message = [payload?.message, payload?.msg, payload?.error, payload?.raw]
    .filter((item) => typeof item === 'string' && item.trim())
    .join(' | ');
  if (/Function Not Found/i.test(message)) return true;
  if (responseStatus === 404 && /(Cannot POST|Not Found|Function)/i.test(message || '')) return true;
  if (Number(payload?.code) === 404 && /(Not Found|Function)/i.test(message)) return true;
  return false;
}

async function invoke(functionName, body = {}, token = '') {
  const url = `${BASE_URL}/${functionName}`;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const rawText = await res.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { code: res.status, success: false, message: 'Non-JSON response', raw: rawText };
    }

    if (isRetryable(res.status, payload) && attempt < RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    return { status: res.status, payload };
  }

  throw new Error(`Invoke failed after retries: ${functionName}`);
}

function pass(result) {
  return result && result.ok && !result.skipped;
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function userIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  return payload.userId || payload.uid || payload.sub || '';
}

async function runCheck(name, fn) {
  try {
    const ok = await fn();
    return { name, ok, error: ok ? '' : 'Predicate failed' };
  } catch (error) {
    return { name, ok: false, error: error?.message || String(error) };
  }
}

async function main() {
  const checks = [];

  checks.push(
    await runCheck('health-check public', async () => {
      const { payload } = await invoke('health-check', {});
      return Number(payload?.code) === 0 && payload?.status === 'ok';
    })
  );

  checks.push(
    await runCheck('getHomeData public', async () => {
      const { payload } = await invoke('getHomeData', {});
      return Number(payload?.code) === 0;
    })
  );

  checks.push(
    await runCheck('question-bank random public', async () => {
      const { payload } = await invoke('question-bank', { action: 'random', data: { count: 1 } });
      return Number(payload?.code) === 0 && payload?.success === true;
    })
  );

  const randomForIds = await invoke('question-bank', { action: 'random', data: { count: 1 } });
  if (Number(randomForIds?.payload?.code) === 0 && randomForIds?.payload?.success === true) {
    const firstQuestion = Array.isArray(randomForIds?.payload?.data) ? randomForIds.payload.data[0] : null;
    const questionId = firstQuestion?._id || firstQuestion?.id || '';
    if (questionId) {
      checks.push(
        await runCheck('question-bank getByIds public', async () => {
          const { payload } = await invoke('question-bank', { action: 'getByIds', data: { ids: [questionId] } });
          return Number(payload?.code) === 0 && payload?.success === true && Array.isArray(payload?.data);
        })
      );
    } else {
      checks.push({
        name: 'question-bank getByIds public',
        ok: true,
        skipped: true,
        error: 'random returned no usable id'
      });
    }
  } else {
    checks.push({
      name: 'question-bank getByIds public',
      ok: false,
      error: randomForIds?.payload?.message || randomForIds?.payload?.msg || 'random precheck failed'
    });
  }

  checks.push(
    await runCheck('question-bank invalid token', async () => {
      const { payload } = await invoke('question-bank', { action: 'get_stats', data: {} }, 'invalid.token');
      return Number(payload?.code) === 401 && payload?.success === false;
    })
  );

  let token = DIRECT_TOKEN;
  let tokenUserId = DIRECT_USER_ID || userIdFromToken(DIRECT_TOKEN);
  if (EMAIL) {
    checks.push(
      await runCheck('send-email-code', async () => {
        const { payload } = await invoke('send-email-code', { email: EMAIL });
        return Number(payload?.code) === 0;
      })
    );
  } else if (DIRECT_TOKEN) {
    checks.push({
      name: 'send-email-code',
      ok: true,
      error: 'Token mode uses SMOKE_TOKEN; email code check not required'
    });
  } else {
    checks.push({ name: 'send-email-code', ok: true, skipped: true, error: 'Provide SMOKE_EMAIL' });
  }

  if (EMAIL && PASSWORD) {
    const login = await invoke('login', { type: 'email', email: EMAIL, password: PASSWORD });
    token = login?.payload?.data?.token || token;
    tokenUserId = login?.payload?.data?.userId || tokenUserId;
    checks.push({
      name: 'login with email/password',
      ok: Number(login?.payload?.code) === 0 && !!(login?.payload?.data?.token || ''),
      error: login?.payload?.message || login?.payload?.msg || 'Login failed'
    });
  } else if (!token) {
    checks.push({
      name: 'login with email/password',
      ok: true,
      skipped: true,
      error: 'Provide SMOKE_EMAIL + SMOKE_PASSWORD, or SMOKE_TOKEN'
    });
  }

  if (token && !(EMAIL && PASSWORD)) {
    checks.push({
      name: 'auth token source',
      ok: true,
      error: tokenUserId ? 'Using SMOKE_TOKEN + user id' : 'Using SMOKE_TOKEN without user id'
    });
  }

  if (token) {
    checks.push(
      await runCheck('favorite-manager get (auth)', async () => {
        const { payload } = await invoke('favorite-manager', { action: 'get', page: 1, pageSize: 10 }, token);
        return Number(payload?.code) === 0;
      })
    );

    if (tokenUserId) {
      checks.push(
        await runCheck('user-profile get (auth)', async () => {
          const { payload } = await invoke('user-profile', { action: 'get', userId: tokenUserId }, token);
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('user-stats overview (auth)', async () => {
          const { payload } = await invoke('user-stats', { action: 'getOverview', userId: tokenUserId }, token);
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('user-stats daily (auth)', async () => {
          const { payload } = await invoke(
            'user-stats',
            { action: 'getDailyStats', userId: tokenUserId, data: { days: 7 } },
            token
          );
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('user-stats trend (auth)', async () => {
          const { payload } = await invoke(
            'user-stats',
            { action: 'getTrend', userId: tokenUserId, data: { period: 'week' } },
            token
          );
          return Number(payload?.code) === 0;
        })
      );
    } else {
      checks.push({
        name: 'user-profile get (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });

      checks.push({
        name: 'user-stats overview (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });

      checks.push({
        name: 'user-stats daily (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });

      checks.push({
        name: 'user-stats trend (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });
    }
  }

  const skipped = checks.filter((result) => result.skipped).length;
  const passed = checks.filter((result) => pass(result)).length;
  const failedOnly = checks.filter((result) => !result.skipped && !result.ok);

  console.log(`\nCloud smoke: ${passed} passed, ${failedOnly.length} failed, ${skipped} skipped`);
  checks.forEach((result) => {
    const icon = result.skipped ? 'SKIP' : result.ok ? 'OK ' : 'FAIL';
    const suffix = !result.error ? '' : ` -> ${result.error}`;
    console.log(`- [${icon}] ${result.name}${suffix}`);
  });

  if (failedOnly.length > 0) {
    process.exitCode = 1;
  } else if (FAIL_ON_SKIPPED && skipped > 0) {
    console.error(
      'Cloud smoke skipped checks are release blockers. Provide smoke credentials or remove skipped checks.'
    );
    process.exitCode = 1;
  }

  if (OPTIONS.output) {
    fs.mkdirSync(path.dirname(OPTIONS.output), { recursive: true });
    fs.writeFileSync(
      OPTIONS.output,
      `${JSON.stringify(
        {
          version: 1,
          generatedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          summary: { passed, failed: failedOnly.length, skipped },
          checks: checks.map((check) => ({
            name: check.name,
            ok: Boolean(check.ok),
            skipped: Boolean(check.skipped),
            error: check.error || ''
          })),
          releaseReadiness: {
            canPublish: failedOnly.length === 0 && (!FAIL_ON_SKIPPED || skipped === 0),
            failOnSkipped: FAIL_ON_SKIPPED
          }
        },
        null,
        2
      )}\n`
    );
  }
}

main().catch((error) => {
  console.error('Cloud smoke crashed:', error?.message || error);
  process.exit(1);
});
