import crypto from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  confirmAge,
  registrationFields,
  verifyIdentityToken,
  fetchOfficialKeys,
  beginProvider,
  providerIdentity,
  sendPhoneCode,
  verifyPhoneCode,
  normalizePhone,
  providerConfig
} from '../../laf-backend/functions/_shared/regional-auth';

function collection() {
  const rows: any[] = [];
  const match = (row: any, query: any) =>
    Object.entries(query).every(([key, value]: any) =>
      value?.$gt !== undefined ? row[key] > value.$gt : row[key] === value
    );
  const result = (query: any) => ({
    getOne: async () => ({ data: rows.find((row) => match(row, query)) || null }),
    orderBy() {
      return this;
    },
    count: async () => ({ total: rows.filter((row) => match(row, query)).length }),
    update: async (patch: any) => {
      const row = rows.find((row) => match(row, query));
      if (!row) return { updated: 0 };
      Object.assign(row, patch);
      return { updated: 1 };
    }
  });
  return {
    rows,
    add: vi.fn(async (value: any) => {
      const id = value._id || `fixture-${rows.length}`;
      if (rows.some((row) => row._id === id)) throw new Error('duplicate');
      rows.push({ ...value, _id: id });
      return { id };
    }),
    where: (query: any) => result(query),
    doc: (id: string) => ({
      get: async () => ({ data: rows.find((row) => row._id === id) || null }),
      update: (patch: any) => result({ _id: id }).update(patch),
      remove: async () => {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) rows.splice(index, 1);
        return { deleted: 1 };
      }
    })
  };
}
const now = Date.UTC(2026, 9, 11);
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
function token(provider = 'apple', patch: any = {}, alg = 'RS256', headerPatch = {}) {
  const key = alg === 'ES256' ? ec : rsa;
  const header = Buffer.from(JSON.stringify({ alg, kid: alg, ...headerPatch })).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      iss: provider === 'apple' ? 'https://appleid.apple.com' : 'https://accounts.google.com',
      aud: 'fixture-client',
      sub: 'fixture-sub',
      nonce: 'fixture-nonce',
      iat: now / 1000,
      exp: now / 1000 + 60,
      email: 'fixture@example.invalid',
      email_verified: true,
      ...patch
    })
  ).toString('base64url');
  const signature = crypto
    .sign('sha256', Buffer.from(`${header}.${claims}`), {
      key: key.privateKey,
      ...(alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {})
    })
    .toString('base64url');
  return `${header}.${claims}.${signature}`;
}
const keys = ['RS256', 'ES256'].map((alg) => ({
  ...(alg === 'ES256' ? ec : rsa).publicKey.export({ format: 'jwk' }),
  kid: alg,
  alg,
  use: 'sig'
}));

describe('regional auth cryptography and privacy', () => {
  it.each(['apple', 'google'])('verifies %s RS256 and ES256 without email linking', (provider) => {
    for (const alg of ['RS256', 'ES256'])
      expect(
        verifyIdentityToken(token(provider, {}, alg), provider as any, 'fixture-client', 'fixture-nonce', keys, now)
      ).toEqual({ sub: 'fixture-sub' });
  });
  it.each(['apple', 'google'])('rejects %s bad signatures, aud, iss, exp, nonce and algorithms', (provider) => {
    for (const patch of [
      { aud: 'other' },
      { aud: ['fixture-client', 'other'] },
      { iss: 'https://evil.invalid' },
      { exp: now / 1000 },
      { exp: 'infinity' },
      { nonce: 'other' },
      { sub: '' },
      { iat: now / 1000 + 61 },
      { azp: 'other' }
    ])
      expect(() =>
        verifyIdentityToken(token(provider, patch), provider as any, 'fixture-client', 'fixture-nonce', keys, now)
      ).toThrow('INVALID_IDENTITY_TOKEN');
    expect(() =>
      verifyIdentityToken(token(provider) + 'a', provider as any, 'fixture-client', 'fixture-nonce', keys, now)
    ).toThrow();
    for (const patch of [{ alg: 'none' }, { jku: 'https://evil.invalid' }, { kid: 'unknown' }])
      expect(() =>
        verifyIdentityToken(
          token(provider, {}, 'RS256', patch),
          provider as any,
          'fixture-client',
          'fixture-nonce',
          keys,
          now
        )
      ).toThrow();
    expect(() => verifyIdentityToken(token(provider), provider as any, '', 'fixture-nonce', keys, now)).toThrow(
      'PROVIDER_DISABLED'
    );
  });
  it.each([false, 'true', undefined])('Google requires boolean email_verified: %j', (email_verified) =>
    expect(() =>
      verifyIdentityToken(token('google', { email_verified }), 'google', 'fixture-client', 'fixture-nonce', keys, now)
    ).toThrow()
  );
  it('age confirmation stores only proof and time, rejects underage before any write', async () => {
    const col = collection();
    expect(await confirmAge({ region: 'US', year: 2015, month: 10 }, col, now)).toMatchObject({
      errorCode: 'AGE_BLOCKED'
    });
    expect(col.rows).toHaveLength(0);
    const age: any = await confirmAge({ region: 'US', year: 2000, month: 1 }, col, now);
    const serialized = JSON.stringify(col.rows);
    expect(serialized).not.toMatch(/year|month|birthday|birth/i);
    const fields = await registrationFields({ region: 'US', ageTicket: age.data.ticket }, col, now);
    expect(fields).toEqual({ registration_region: 'US', age_over13: true, age_confirmed_at: now });
    await expect(registrationFields({ region: 'US', ageTicket: age.data.ticket }, col, now)).rejects.toThrow(
      'AGE_CONFIRMATION_REQUIRED'
    );
    expect(await registrationFields({ region: 'CN' }, col, now)).toEqual({ registration_region: 'CN' });
  });
  it('conservative birthday-month boundary, future input, missing, expired and parallel ticket claims', async () => {
    const col = collection();
    expect(await confirmAge({ region: 'US', year: 2013, month: 10 }, col, now)).toMatchObject({
      errorCode: 'AGE_BLOCKED'
    });
    await expect(confirmAge({ region: 'US', year: 2027, month: 1 }, col, now)).rejects.toThrow('INVALID_BIRTH_MONTH');
    await expect(registrationFields({ region: 'US', over13: true }, col, now)).rejects.toThrow();
    await expect(registrationFields({}, col, now)).rejects.toThrow('REGION_REQUIRED');
    const age: any = await confirmAge({ region: 'US', year: 2000, month: 1 }, col, now);
    await expect(
      registrationFields({ region: 'US', ageTicket: age.data.ticket }, col, now + 600_000)
    ).rejects.toThrow();
    const results = await Promise.allSettled(
      [1, 2].map(() => registrationFields({ region: 'US', ageTicket: age.data.ticket }, col, now))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('official fixed JWKS only, timeout, no redirect, cached and no token-selected hosts', async () => {
    const fetcher = vi.fn(async () => ({ status: 200, data: { keys } }));
    expect(await fetchOfficialKeys('apple', fetcher, now)).toEqual(keys);
    await fetchOfficialKeys('apple', fetcher, now + 1);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toMatchObject({
      url: 'https://appleid.apple.com/auth/keys',
      timeout: 5000,
      maxRedirects: 0
    });
    await expect(fetchOfficialKeys('evil' as any, fetcher, now)).rejects.toThrow();
    await expect(
      fetchOfficialKeys('apple', async () => ({ status: 302, data: { keys } }), now + 300_000)
    ).rejects.toThrow('PROVIDER_UNAVAILABLE');
    await expect(
      fetchOfficialKeys(
        'apple',
        async () => {
          throw new Error('private-upstream-detail');
        },
        now + 300_001
      )
    ).rejects.toThrow('PROVIDER_UNAVAILABLE');
    await expect(fetchOfficialKeys('toString' as any, fetcher, now)).rejects.toThrow('UNSUPPORTED_LOGIN');
  });
  it('a corrupted or missing expiry never grants age proof or provider authentication', async () => {
    const col = collection();
    const age: any = await confirmAge({ region: 'US', year: 2000, month: 1 }, col, now);
    delete col.rows[0].deadline;
    await expect(registrationFields({ region: 'US', ageTicket: age.data.ticket }, col, now)).rejects.toThrow(
      'AGE_CONFIRMATION_REQUIRED'
    );
    const env = { APPLE_APP_CLIENT_ID: 'fixture-client' };
    const started: any = await beginProvider('apple', 'app', col, env, now);
    delete col.rows[1].deadline;
    const fetcher = vi.fn();
    await expect(
      providerIdentity({ type: 'apple', platform: 'app', session: started.data.session }, col, fetcher, env, now)
    ).rejects.toThrow('IDENTITY_REPLAY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['apple', 'google'])(
    '%s unconfigured, expired and consumed provider session fails closed',
    async (provider) => {
      const col = collection(),
        env = { [`${provider.toUpperCase()}_APP_CLIENT_ID`]: 'fixture-client' };
      expect(await beginProvider(provider as any, 'app', col, {}, now)).toMatchObject({
        errorCode: 'PROVIDER_DISABLED'
      });
      const started: any = await beginProvider(provider as any, 'app', col, env, now);
      const body = {
        type: provider,
        platform: 'app',
        session: started.data.session,
        identityToken: token(provider, { nonce: started.data.nonce })
      };
      const fetcher = async () => ({ status: 200, data: { keys } });
      expect(await providerIdentity(body, col, fetcher, env, now)).toMatchObject({
        [`${provider}_sub`]: 'fixture-sub'
      });
      await expect(providerIdentity(body, col, fetcher, env, now)).rejects.toThrow('IDENTITY_REPLAY');
      const expired: any = await beginProvider(provider as any, 'app', col, env, now);
      await expect(
        providerIdentity({ ...body, session: expired.data.session }, col, fetcher, env, now + 600_000)
      ).rejects.toThrow('IDENTITY_REPLAY');
      expect(providerConfig(provider as any, 'mp-weixin', env)).toBeNull();
    }
  );
});

describe('phone codes with an isolated synthetic transport', () => {
  const body = { region: 'US', prefix: '+1', phone: '2025550123', idempotencyKey: 'synthetic-request-001' };
  const deps = () => ({
    collection: collection(),
    limit: vi.fn(async () => ({ allowed: true })),
    secret: crypto.randomBytes(32).toString('hex'),
    enabled: true,
    authorized: true,
    send: vi.fn(async (_phone: string, _code: string) => {}),
    now: () => now
  });
  it.each([
    ['+1', '0125550123'],
    ['+86', '12345678901'],
    ['+44', '2025550123'],
    ['+1', {}]
  ])('rejects %j %j', (prefix, phone) => expect(() => normalizePhone(prefix, phone)).toThrow('INVALID_PHONE'));
  it('validates +1/+86, defaults closed with no writes, even flags cannot install a transport', async () => {
    expect(normalizePhone('+86', '13800000000')).toBe('+8613800000000');
    const d = deps();
    for (const patch of [{ enabled: false }, { authorized: false }, { send: undefined }])
      expect(await sendPhoneCode(body, { ...d, ...patch })).toMatchObject({ errorCode: 'SMS_DISABLED' });
    expect(d.send).not.toHaveBeenCalled();
    expect(d.collection.rows).toHaveLength(0);
  });
  it('hash only, idem sends once, frequency/parallel claim and one-time login proof', async () => {
    const d = deps();
    expect(await sendPhoneCode(body, d)).toMatchObject({ code: 0 });
    const code = d.send.mock.calls[0][1];
    expect(d.collection.rows[0]).not.toHaveProperty('code');
    expect(d.collection.rows[0]).not.toHaveProperty('phone');
    expect(d.collection.rows[0].codeHash).not.toBe(code);
    expect(await sendPhoneCode(body, d)).toMatchObject({ code: 0, alreadySent: true });
    expect(d.send).toHaveBeenCalledOnce();
    expect(await sendPhoneCode({ ...body, idempotencyKey: 'synthetic-request-002' }, d)).toMatchObject({
      errorCode: 'RATE_LIMITED'
    });
    expect(await verifyPhoneCode({ ...body, verifyCode: code }, d.collection, d.secret, now)).toBe('+12025550123');
    await expect(verifyPhoneCode({ ...body, verifyCode: code }, d.collection, d.secret, now)).rejects.toThrow();
    const parallel = deps();
    const results = await Promise.all([1, 2].map(() => sendPhoneCode(body, parallel)));
    expect(results.filter((r) => r.code === 0)).toHaveLength(1);
    expect(parallel.send).toHaveBeenCalledOnce();
  });
  it('limits verification failures and expiry; wrong region, idempotency and rate fail', async () => {
    const d = deps();
    await sendPhoneCode(body, d);
    const code = d.send.mock.calls[0][1];
    for (let i = 0; i < 5; i++)
      await expect(
        verifyPhoneCode({ ...body, verifyCode: code === '000000' ? '999999' : '000000' }, d.collection, d.secret, now)
      ).rejects.toThrow();
    await expect(verifyPhoneCode({ ...body, verifyCode: code }, d.collection, d.secret, now)).rejects.toThrow();
    const expired = deps();
    await sendPhoneCode(body, expired);
    await expect(
      verifyPhoneCode(
        { ...body, verifyCode: expired.send.mock.calls[0][1] },
        expired.collection,
        expired.secret,
        now + 300_000
      )
    ).rejects.toThrow();
    expect(await sendPhoneCode({ ...body, region: 'CN' }, deps())).toMatchObject({ errorCode: 'INVALID_REGION' });
    expect(await sendPhoneCode({ ...body, idempotencyKey: 'short' }, deps())).toMatchObject({
      errorCode: 'INVALID_IDEMPOTENCY_KEY'
    });
    const limited = deps();
    limited.limit.mockResolvedValue({ allowed: false });
    expect(await sendPhoneCode(body, limited)).toMatchObject({ code: 429 });
    expect(limited.send).not.toHaveBeenCalled();
  });
});

const state = vi.hoisted(() => ({ db: null as any, fetch: vi.fn(), limit: vi.fn(), allowed: true }));
vi.mock('@lafjs/cloud', () => ({
  default: { database: () => state.db, fetch: (...args: any[]) => state.fetch(...args) }
}));
vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({ info() {}, error() {}, warn() {} }),
  checkRateLimitDistributed: async (...args: any[]) => {
    state.limit(...args);
    return {
      allowed: state.allowed,
      remaining: 4,
      resetAt: Date.now() + 60_000,
      source: 'db'
    };
  }
}));
vi.mock('../../laf-backend/functions/_shared/perf-monitor', () => ({ perfMonitor: { start: () => () => {} } }));

describe('actual login entry with isolated database and provider responses', () => {
  let collections: any, handler: any;
  beforeEach(async () => {
    collections = {};
    state.db = {
      collection: (name: string) => (collections[name] ||= collection()),
      command: { gt: (n: number) => ({ $gt: n }) }
    };
    state.allowed = true;
    state.limit.mockClear();
    vi.stubEnv('JWT_SECRET', crypto.randomBytes(32).toString('hex'));
    vi.stubEnv('WX_APPID', 'fixture-wechat');
    vi.stubEnv('WX_SECRET', 'fixture-only');
    for (const provider of ['APPLE', 'GOOGLE']) vi.stubEnv(`${provider}_APP_CLIENT_ID`, 'fixture-client');
    state.fetch.mockImplementation(async ({ url }) => ({
      data: url.includes('jscode2session') ? { openid: 'fixture-wechat-user' } : { keys }
    }));
    vi.resetModules();
    handler = (await import('../../laf-backend/functions/login')).default;
  });
  afterEach(() => vi.unstubAllEnvs());
  const call = (body: any) => handler({ body, headers: {}, socket: { remoteAddress: '127.0.0.1' } });
  it.each(['qq', 'unknown'])('rejects %s without provider calls or user writes', async (type) => {
    expect(await call({ type })).toMatchObject({ code: 400, errorCode: 'UNSUPPORTED_LOGIN' });
    expect(state.fetch).not.toHaveBeenCalled();
    expect(collections.users.rows).toHaveLength(0);
  });
  it('age screening and login share the same opaque IP bucket and unchanged limit', async () => {
    await call({ type: 'capabilities', platform: 'app' });
    await call({ type: 'age_confirm', region: 'US', year: 2020, month: 1 });
    expect(state.limit).toHaveBeenCalledTimes(2);
    const [first, second] = state.limit.mock.calls;
    expect(first).toEqual(second);
    expect(first[0]).toMatch(/^login:[a-f0-9]{64}$/);
    expect(first[0]).not.toContain('127.0.0.1');
    expect(first.slice(1)).toEqual([5, 60000]);
    expect(Object.values(collections).flatMap((col: any) => col.rows)).toEqual([]);
  });
  it('age rejection makes zero writes; US new-account requires server proof; CN creates; existing does not require age', async () => {
    expect(await call({ type: 'age_confirm', region: 'US', year: 2020, month: 1 })).toMatchObject({
      errorCode: 'AGE_BLOCKED'
    });
    expect(Object.values(collections).flatMap((c: any) => c.rows)).toHaveLength(0);
    expect(await call({ type: 'wechat', code: 'fixture-wechat-code', region: 'US', ageOver13: true })).toMatchObject({
      errorCode: 'AGE_CONFIRMATION_REQUIRED'
    });
    expect(collections.users.rows).toHaveLength(0);
    const age = await call({ type: 'age_confirm', region: 'US', year: 2000, month: 1 });
    const us = await call({ type: 'wechat', code: 'fixture-wechat-code', region: 'US', ageTicket: age.data.ticket });
    expect(us.code).toBe(0);
    expect(us.data.isNewUser).toBe(true);
    expect(collections.users.rows[0]).toMatchObject({ registration_region: 'US', age_over13: true });
    expect(JSON.stringify(collections.users.rows)).not.toMatch(/birth|year|month/);
    expect((await call({ type: 'wechat', code: 'fixture-wechat-code', region: 'US' })).data.isNewUser).toBe(false);
  });
  it.each(['apple', 'google'])(
    '%s authenticates and creates CN identity independent of existing email, then reuses identity',
    async (provider) => {
      await collections.users.add({ email: 'fixture@example.invalid', role: 'user' });
      for (let i = 0; i < 2; i++) {
        const started = await call({ type: provider, action: 'begin', platform: 'app', region: 'CN' });
        const input = {
          type: provider,
          platform: 'app',
          region: 'CN',
          session: started.data.session,
          identityToken: token(provider, {
            nonce: started.data.nonce,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60
          })
        };
        const result = await call(input);
        expect(result.code).toBe(0);
        expect(result.data.isNewUser).toBe(i === 0);
        expect(await call(input)).toMatchObject({ errorCode: 'IDENTITY_REPLAY' });
      }
      expect(collections.users.rows).toHaveLength(2);
      expect(collections.users.rows[1]).not.toHaveProperty('email');
    }
  );
  it('email creation follows age gate and consumes verified code once', async () => {
    const email = 'fixture@example.invalid';
    await state.db
      .collection('email_codes')
      .add({ email, code: '123456', used: false, created_at: Date.now(), expires_at: Date.now() + 600_000 });
    const result = await call({ type: 'email', region: 'CN', email, verifyCode: '123456', password: 'FixturePass123' });
    expect(result.code).toBe(0);
    expect(result.data.token).toBeTruthy();
    expect(collections.users.rows[0]).toMatchObject({ registration_region: 'CN' });
    expect((await call({ type: 'email', region: 'CN', email, verifyCode: '123456' })).code).toBe(401);
  });
  it('SMS disabled and all supported methods retain distributed login rate limit', async () => {
    expect(
      await call({
        type: 'phone',
        action: 'send',
        region: 'US',
        prefix: '+1',
        phone: '2025550123',
        idempotencyKey: 'synthetic-request-001'
      })
    ).toMatchObject({ errorCode: 'SMS_DISABLED' });
    state.allowed = false;
    for (const type of ['wechat', 'email', 'apple', 'google', 'phone', 'age_confirm'])
      expect((await call({ type })).code).toBe(429);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('phone entry consumes a synthetic hashed code once; flags cannot send; US creation still requires proof', async () => {
    vi.stubEnv('AUTH_SMS_ENABLED', 'true');
    vi.stubEnv('AUTH_SMS_AUTHORIZED', 'true');
    const body = {
      type: 'phone',
      region: 'US',
      prefix: '+1',
      phone: '2025550123',
      idempotencyKey: 'fixture-request-001'
    };
    expect(await call({ ...body, action: 'send' })).toMatchObject({ errorCode: 'SMS_DISABLED' });
    const codes = state.db.collection('phone_codes');
    expect(codes.rows).toHaveLength(0);
    let code = '';
    const seed = async (idempotencyKey: string) =>
      sendPhoneCode(
        { ...body, idempotencyKey },
        {
          collection: codes,
          secret: process.env.JWT_SECRET!,
          enabled: true,
          authorized: true,
          limit: async () => ({ allowed: true }),
          send: async (_phone, value) => {
            code = value;
          }
        }
      );
    await seed('fixture-request-001');
    expect(await call({ ...body, verifyCode: code })).toMatchObject({ errorCode: 'AGE_CONFIRMATION_REQUIRED' });
    expect(collections.users.rows).toHaveLength(0);
    codes.rows.splice(0);
    await seed('fixture-request-002');
    const age = await call({ type: 'age_confirm', region: 'US', year: 2000, month: 1 });
    const signedIn = await call({ ...body, verifyCode: code, ageTicket: age.data.ticket });
    expect(signedIn.code).toBe(0);
    expect(signedIn.data.isNewUser).toBe(true);
    expect(collections.users.rows[0]).toMatchObject({
      phone: '+12025550123',
      registration_region: 'US',
      age_over13: true
    });
    expect(await call({ ...body, verifyCode: code })).toMatchObject({ errorCode: 'INVALID_PHONE_CODE' });
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
