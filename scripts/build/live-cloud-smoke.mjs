#!/usr/bin/env node

const BASE_URL = (
  process.env.LAF_API_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  'https://nf98ia8qnt.sealosbja.site'
).replace(/\/$/, '');

const RETRIES = Number(process.env.SMOKE_RETRIES || 8);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS || 1000);

const EMAIL = process.env.SMOKE_EMAIL || '';
const PASSWORD = process.env.SMOKE_PASSWORD || '';

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
    await runCheck('proxy-ai health_check', async () => {
      const { payload } = await invoke('proxy-ai', { action: 'health_check' });
      return Number(payload?.code) === 0;
    })
  );

  checks.push(
    await runCheck('school-query list', async () => {
      const { payload } = await invoke('school-query', { action: 'list', page: 1, pageSize: 5 });
      return Number(payload?.code) === 0;
    })
  );

  checks.push(
    await runCheck('question-bank random public', async () => {
      const { payload } = await invoke('question-bank', { action: 'random', data: { count: 1 } });
      return Number(payload?.code) === 0 && payload?.success === true;
    })
  );

  checks.push(
    await runCheck('question-bank invalid token', async () => {
      const { payload } = await invoke('question-bank', { action: 'random', data: { count: 1 } }, 'invalid.token');
      return Number(payload?.code) === 401 && payload?.success === false;
    })
  );

  let token = '';
  if (EMAIL) {
    checks.push(
      await runCheck('send-email-code', async () => {
        const { payload } = await invoke('send-email-code', { email: EMAIL });
        return Number(payload?.code) === 0;
      })
    );
  } else {
    checks.push({
      name: 'send-email-code',
      ok: true,
      skipped: true,
      error: 'Provide SMOKE_EMAIL'
    });
  }

  if (EMAIL && PASSWORD) {
    const login = await invoke('login', { type: 'email', email: EMAIL, password: PASSWORD });
    token = login?.payload?.data?.token || '';
    checks.push({
      name: 'login with email/password',
      ok: Number(login?.payload?.code) === 0 && !!token,
      error: login?.payload?.message || login?.payload?.msg || 'Login failed'
    });
  } else {
    checks.push({
      name: 'login with email/password',
      ok: true,
      skipped: true,
      error: 'Provide SMOKE_EMAIL + SMOKE_PASSWORD'
    });
  }

  if (token) {
    checks.push(
      await runCheck('user-profile get (auth)', async () => {
        const { payload } = await invoke('user-profile', { action: 'get' }, token);
        return Number(payload?.code) === 0;
      })
    );

    checks.push(
      await runCheck('favorite-manager get (auth)', async () => {
        const { payload } = await invoke('favorite-manager', { action: 'get', page: 1, pageSize: 10 }, token);
        return Number(payload?.code) === 0;
      })
    );

    checks.push(
      await runCheck('study-stats get (auth)', async () => {
        const { payload } = await invoke('study-stats', { action: 'get' }, token);
        return Number(payload?.code) === 0;
      })
    );
  }

  const failed = checks.filter((result) => !pass(result));
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
  }
}

main().catch((error) => {
  console.error('Cloud smoke crashed:', error?.message || error);
  process.exit(1);
});
