#!/usr/bin/env node

import crypto from 'crypto';

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
const DIRECT_TOKEN = process.env.SMOKE_TOKEN || process.env.SMOKE_JWT || '';
const AUTO_TOKEN = ['1', 'true', 'yes'].includes(String(process.env.SMOKE_AUTO_TOKEN || '').toLowerCase());
const JWT_SECRET = process.env.SMOKE_JWT_SECRET || process.env.JWT_SECRET || '';

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

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function getTokenUserId(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') return '';
  return payload.userId || payload.uid || '';
}

function generateJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${headerBase64}.${payloadBase64}`).digest('base64url');
  return `${headerBase64}.${payloadBase64}.${signature}`;
}

async function bootstrapTokenFromRank() {
  if (!JWT_SECRET) {
    return { token: '', userId: '', message: 'SMOKE_AUTO_TOKEN enabled but JWT secret is missing' };
  }

  const rankResponse = await invoke('rank-center', { action: 'get', rankType: 'total', limit: 20 });
  if (Number(rankResponse?.payload?.code) !== 0 || !Array.isArray(rankResponse?.payload?.data)) {
    return {
      token: '',
      userId: '',
      message: rankResponse?.payload?.message || rankResponse?.payload?.msg || 'rank-center bootstrap precheck failed'
    };
  }

  const firstUser = rankResponse.payload.data.find((item) => typeof item?.uid === 'string' && item.uid);
  const userId = firstUser?.uid || '';
  if (!userId) {
    return { token: '', userId: '', message: 'rank-center returned no usable uid' };
  }

  const now = Date.now();
  const token = generateJwt(
    {
      userId,
      role: 'user',
      iat: now,
      exp: now + 7 * 24 * 60 * 60 * 1000
    },
    JWT_SECRET
  );

  return { token, userId, message: 'generated token from rank-center uid' };
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
      const { payload } = await invoke('question-bank', { action: 'random', data: { count: 1 } }, 'invalid.token');
      return Number(payload?.code) === 401 && payload?.success === false;
    })
  );

  let token = DIRECT_TOKEN;
  let tokenUserId = getTokenUserId(token);
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
    token = login?.payload?.data?.token || token;
    tokenUserId = login?.payload?.data?.userId || tokenUserId || getTokenUserId(token);
    checks.push({
      name: 'login with email/password',
      ok: Number(login?.payload?.code) === 0 && !!(login?.payload?.data?.token || ''),
      error: login?.payload?.message || login?.payload?.msg || 'Login failed'
    });
  } else if (!token && AUTO_TOKEN) {
    const bootstrapResult = await bootstrapTokenFromRank();
    if (bootstrapResult.token) {
      token = bootstrapResult.token;
      tokenUserId = bootstrapResult.userId;
      checks.push({
        name: 'auth token bootstrap',
        ok: true,
        error: bootstrapResult.message
      });
    } else {
      checks.push({
        name: 'auth token bootstrap',
        ok: false,
        error: bootstrapResult.message
      });
    }
  } else if (!token) {
    checks.push({
      name: 'login with email/password',
      ok: true,
      skipped: true,
      error: 'Provide SMOKE_EMAIL + SMOKE_PASSWORD, or SMOKE_TOKEN, or enable SMOKE_AUTO_TOKEN'
    });
  }

  if (token && !(EMAIL && PASSWORD)) {
    checks.push({
      name: 'auth token source',
      ok: true,
      error: AUTO_TOKEN ? 'Using auto-generated token' : 'Using SMOKE_TOKEN'
    });
  }

  if (token) {
    checks.push(
      await runCheck('favorite-manager get (auth)', async () => {
        const { payload } = await invoke('favorite-manager', { action: 'get', page: 1, pageSize: 10 }, token);
        return Number(payload?.code) === 0;
      })
    );

    if (!tokenUserId) {
      tokenUserId = getTokenUserId(token);
    }

    if (tokenUserId) {
      checks.push(
        await runCheck('user-profile get (auth)', async () => {
          const { payload } = await invoke('user-profile', { action: 'get', userId: tokenUserId }, token);
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('study-stats get (auth)', async () => {
          const { payload } = await invoke('study-stats', { action: 'get', userId: tokenUserId }, token);
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('study-stats daily (auth)', async () => {
          const { payload } = await invoke(
            'study-stats',
            { action: 'daily', userId: tokenUserId, data: { days: 7 } },
            token
          );
          return Number(payload?.code) === 0;
        })
      );

      checks.push(
        await runCheck('study-stats weekly (auth)', async () => {
          const { payload } = await invoke('study-stats', { action: 'weekly', userId: tokenUserId }, token);
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
        name: 'study-stats get (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });

      checks.push({
        name: 'study-stats daily (auth)',
        ok: true,
        skipped: true,
        error: 'token payload has no userId'
      });

      checks.push({
        name: 'study-stats weekly (auth)',
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
  }
}

main().catch((error) => {
  console.error('Cloud smoke crashed:', error?.message || error);
  process.exit(1);
});
