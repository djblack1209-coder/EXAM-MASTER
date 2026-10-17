// @vitest-environment node
import crypto from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { handleDesktopOAuth } from '../../laf-backend/functions/_shared/desktop-oauth';

const fixture = vi.hoisted(() => ({
  distributed: vi.fn(),
  local: vi.fn(),
  queries: [] as any[],
  rows: [] as any[],
  source: 'db',
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('@lafjs/cloud', () => {
  const chain: any = {
    where(query: any) {
      fixture.queries.push(query);
      return chain;
    },
    orderBy() {
      return chain;
    },
    limit() {
      return chain;
    },
    skip() {
      return chain;
    },
    field() {
      return chain;
    },
    get: async () => ({ data: [] }),
    getOne: async () => ({ data: null }),
    count: async () => ({ total: 0 }),
    add: async (row: any) => {
      fixture.rows.push(row);
      return { id: 'synthetic-email-record' };
    },
    doc() {
      return chain;
    },
    remove: async () => ({ deleted: 1 })
  };
  return { default: { database: () => ({ collection: () => chain, command: { gt: (v: any) => ({ $gt: v }) } }) } };
});
vi.mock('../../laf-backend/functions/_shared/api-response', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  createLogger: () => fixture.logger,
  checkRateLimitDistributed: fixture.distributed,
  checkRateLimit: fixture.local
}));
vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: () => ({ code: 401, success: false }),
  isAuthError: (value: any) => value.code === 401
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: async () => ({ messageId: 'synthetic' }) }) }
}));
const secret = 'TEST_ONLY_client_ip_hmac_32_characters';
const forged = (i: number) => ({
  'x-forwarded-for': `203.0.113.${i}, 203.0.113.200`,
  'x-real-ip': `203.0.113.${i}`,
  'cf-connecting-ip': `203.0.113.${i}`,
  'true-client-ip': `203.0.113.${i}`,
  'x-client-ip': `203.0.113.${i}`,
  forwarded: `for=203.0.113.${i}`
});
function ctx(ip: string | undefined, body: any, i = 1) {
  return { method: 'POST', body, headers: forged(i), socket: { remoteAddress: ip } };
}
beforeEach(() => {
  vi.stubEnv('JWT_SECRET', secret);
  vi.stubEnv('SMTP_USER', 'synthetic@yozi-fixture.com');
  vi.stubEnv('SMTP_PASS', 'TEST_ONLY_not_a_credential');
  vi.resetModules();
  vi.clearAllMocks();
  fixture.queries = [];
  fixture.rows = [];
  fixture.source = 'db';
  fixture.distributed.mockImplementation(async () => ({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60000,
    source: fixture.source
  }));
  fixture.local.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
});
afterEach(() => vi.unstubAllEnvs());

describe('all IP consumers preserve trusted identity', () => {
  it.each(['login', 'question-bank', 'getHomeData', 'learning-resource'])(
    '%s ignores all forged headers and separates real sources',
    async (name) => {
      const handler = (await import(`../../laf-backend/functions/${name}.ts`)).default;
      const body =
        name === 'login' ? { type: 'password' } : { action: name === 'learning-resource' ? 'getCategories' : 'get' };
      const limiter = name === 'learning-resource' ? fixture.local : fixture.distributed;
      for (const [ip, i] of [
        ['198.51.100.2', 1],
        ['::ffff:198.51.100.2', 2],
        ['198.51.100.3', 3]
      ] as const) {
        expect((await handler(ctx(ip, body, i))).code).toBe(429);
      }
      const keys = limiter.mock.calls.map(([key]) => key);
      expect(keys[0]).toBe(keys[1]);
      expect(keys[0]).not.toBe(keys[2]);
      if (name === 'login') {
        expect(keys[0]).toBe(`login:${crypto.createHmac('sha256', secret).update('198.51.100.2').digest('hex')}`);
        expect(keys[0]).not.toContain('198.51.100.2');
      }
      limiter.mockClear();
      expect((await handler(ctx(undefined, body))).code).toBe(503);
      expect(limiter).not.toHaveBeenCalled();
      if (name === 'getHomeData') expect(JSON.stringify(fixture.logger.info.mock.calls)).not.toMatch(/198\.51|203\.0/);
    }
  );
  it.each(['login', 'question-bank', 'getHomeData', 'learning-resource'])(
    '%s keeps per-source counters separate',
    async (name) => {
      const counts = new Map<string, number>();
      const count = (key: string) => {
        const n = (counts.get(key) || 0) + 1;
        counts.set(key, n);
        return { allowed: n <= 1, remaining: Math.max(0, 1 - n), resetAt: Date.now() + 60000, source: 'db' };
      };
      fixture.local.mockImplementation(count);
      fixture.distributed.mockImplementation(async (key) => count(key));
      const handler = (await import(`../../laf-backend/functions/${name}.ts`)).default;
      const body =
        name === 'login'
          ? { type: 'invalid-fixture-type' }
          : { action: name === 'learning-resource' ? 'getCategories' : 'get' };
      expect((await handler(ctx('198.51.100.2', body, 1))).code).not.toBe(429);
      expect((await handler(ctx('198.51.100.2', body, 2))).code).toBe(429);
      expect((await handler(ctx('198.51.100.3', body, 2))).code).not.toBe(429);
      expect([...counts.values()]).toEqual([2, 1]);
    }
  );
  it('login memory fallback retains the same HMAC bucket across forged headers', async () => {
    fixture.source = 'memory';
    const handler = (await import('../../laf-backend/functions/login')).default;
    const body = { type: 'invalid-fixture-type' };
    for (let i = 0; i < 5; i++) expect((await handler(ctx('198.51.100.2', body, i))).code).not.toBe(429);
    expect((await handler(ctx('198.51.100.2', body, 9))).code).toBe(429);
    expect((await handler(ctx('198.51.100.3', body, 9))).code).not.toBe(429);
  });
  it('learning-resource search uses both local limits with the same trusted identity', async () => {
    fixture.local.mockReturnValue({ allowed: true, remaining: 10 });
    const handler = (await import('../../laf-backend/functions/learning-resource')).default;
    for (const [ip, i] of [
      ['198.51.100.2', 1],
      ['198.51.100.2', 2],
      ['198.51.100.3', 3]
    ] as const)
      await handler(ctx(ip, { action: 'search', data: { keyword: 'algebra' } }, i));
    const keys = fixture.local.mock.calls.map(([key]) => key);
    expect(keys).toEqual([
      'lr_ip_198.51.100.2',
      'lr_search_ip_198.51.100.2',
      'lr_ip_198.51.100.2',
      'lr_search_ip_198.51.100.2',
      'lr_ip_198.51.100.3',
      'lr_search_ip_198.51.100.3'
    ]);
  });
  it('desktop poll/cancel use trusted peers, even before session reads', async () => {
    const pollAllowed = vi.fn(async () => false);
    const deps: any = { enabled: true, secret, nativeOrigins: ['tauri://localhost'], pollAllowed };
    for (const action of ['poll', 'cancel']) {
      pollAllowed.mockClear();
      for (const [ip, i] of [
        ['198.51.100.2', 1],
        ['::ffff:198.51.100.2', 2],
        ['198.51.100.3', 3]
      ] as const) {
        const request = ctx(
          ip,
          { type: 'desktop_oauth', action, sessionId: 'a'.repeat(64), verifier: 'b'.repeat(64) },
          i
        );
        Object.assign(request.headers, { origin: 'tauri://localhost' });
        expect((await handleDesktopOAuth(request, deps)).code).toBe(429);
      }
      expect(pollAllowed.mock.calls.map(([ip]) => ip)).toEqual(['198.51.100.2', '198.51.100.2', '198.51.100.3']);
      const request = ctx(undefined, { type: 'desktop_oauth', action });
      Object.assign(request.headers, { origin: 'tauri://localhost' });
      expect((await handleDesktopOAuth(request, deps)).code).toBe(503);
      expect(pollAllowed).toHaveBeenCalledTimes(3);
    }
  });
  it('email hourly queries and stored client_ip match trusted transport, never forged headers', async () => {
    const handler = (await import('../../laf-backend/functions/send-email-code')).default;
    for (const [ip, i] of [
      ['198.51.100.2', 1],
      ['::ffff:198.51.100.2', 2],
      ['198.51.100.3', 3]
    ] as const)
      expect((await handler(ctx(ip, { email: `synthetic${i}@yozi-fixture.com` }, i))).code).toBe(0);
    const expected = ['198.51.100.2', '198.51.100.2', '198.51.100.3'];
    expect(fixture.rows.map((row) => row.client_ip)).toEqual(expected);
    expect(fixture.queries.filter((query) => query.client_ip).map((query) => query.client_ip)).toEqual(expected);
    expect((await handler(ctx(undefined, { email: 'synthetic4@yozi-fixture.com' }))).code).toBe(503);
    expect(fixture.rows).toHaveLength(3);
  });
});
