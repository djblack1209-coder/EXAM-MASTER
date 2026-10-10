import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  handleDesktopOAuth,
  desktopAuthorizationUrl,
  desktopCallbackOrigin
} from '../../laf-backend/functions/_shared/desktop-oauth';

function fixture() {
  let clock = 1_800_000_000_000;
  const records = new Map<string, any>();
  const collection = {
    add: vi.fn(async (doc: any) => {
      records.set(doc._id, structuredClone(doc));
      return { id: doc._id };
    }),
    doc: (id: string) => ({ get: async () => ({ data: structuredClone(records.get(id)) }) }),
    where: (query: any) => ({
      update: async (patch: any) => {
        let updated = 0;
        for (const record of records.values())
          if (Object.entries(query).every(([key, value]) => record[key] === value)) {
            Object.assign(record, structuredClone(patch));
            updated++;
          }
        return { updated };
      }
    })
  };
  const verifier = 'ab'.repeat(32);
  const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
  const configs: any = {
    qq: { appId: 'test_qq_123', redirectUri: 'https://learning.example.com/oauth/qq.html' },
    wechat: { appId: 'test_wx_123', redirectUri: 'https://learning.example.com/oauth/wechat.html' }
  };
  const deps = {
    enabled: true,
    secret: 'isolated-test-secret-only',
    collection,
    nativeOrigins: ['tauri://localhost', 'http://tauri.localhost'],
    now: () => clock,
    config: (provider: any) => configs[provider],
    exchange: vi.fn(async () => ({
      code: 0,
      data: { userId: 'private-user-fixture', token: 'private-jwt-fixture', isNewUser: true }
    })),
    issue: vi.fn(async (userId, isNewUser) => ({
      code: 0,
      data: { userId, isNewUser, token: 'desktop-only-test-token' }
    })),
    pollAllowed: vi.fn(async () => true),
    retentionConfigured: vi.fn(async () => true)
  };
  const call = (body: any, origin = 'tauri://localhost', method = 'POST') =>
    handleDesktopOAuth(
      {
        method,
        body: { type: 'desktop_oauth', ...body },
        headers: { origin },
        socket: { remoteAddress: 'unit-test-ip' }
      },
      deps
    );
  const begin = (provider = 'qq') => call({ action: 'begin', provider, challenge });
  const finish = (id: string, provider = 'qq', extra: any = {}) =>
    call(
      {
        action: 'complete',
        provider,
        state: `desktop_${id}`,
        code: 'test_supplier_code',
        ...extra
      },
      'https://learning.example.com'
    );
  const poll = (id: string, proof = verifier) => call({ action: 'poll', sessionId: id, verifier: proof });
  return {
    deps,
    configs,
    records,
    call,
    begin,
    finish,
    poll,
    verifier,
    challenge,
    advance: (ms: number) => {
      clock += ms;
    }
  };
}

describe('desktop OAuth bound handover', () => {
  it.each(['qq', 'wechat'])(
    'browser gets no token; %s desktop claims once using its original proof',
    async (provider) => {
      const f = fixture();
      const started = await f.begin(provider);
      const id = started.data!.sessionId;
      const url = new URL(started.data!.authorizationUrl);
      expect(url.searchParams.get('state')).toBe(`desktop_${id}`);
      expect(url.searchParams.get('redirect_uri')).toBe(f.configs[provider].redirectUri);
      expect(JSON.stringify(started)).not.toContain(f.verifier);
      expect((await f.poll(id)).data).toMatchObject({ status: 'pending', interval: 3 });
      const completed = await f.finish(id, provider);
      expect(completed).toMatchObject({ code: 0, data: { desktopReady: true } });
      const serialized = JSON.stringify([completed, [...f.records.values()]]);
      for (const secret of ['private-user-fixture', 'private-jwt-fixture', f.verifier])
        expect(serialized).not.toContain(secret);
      const results = await Promise.all([f.poll(id), f.poll(id)]);
      expect(results.map((r) => r.code).sort()).toEqual([0, 409]);
      expect(f.deps.issue).toHaveBeenCalledTimes(1);
      expect(f.records.get(id).result).toBeNull();
    }
  );
  it('parallel browser finishes exchange one credential once', async () => {
    const f = fixture(),
      start = await f.begin(),
      id = start.data!.sessionId;
    const results = await Promise.all([f.finish(id), f.finish(id), f.finish(id)]);
    expect(results.map((r) => r.code).sort()).toEqual([0, 409, 409]);
    expect(f.deps.exchange).toHaveBeenCalledTimes(1);
  });
  it.each(['https://evil.example.com', 'http://tauri.localhost', '', 'null'])(
    'wrong browser origin %s cannot finish',
    async (origin) => {
      const f = fixture(),
        id = (await f.begin()).data!.sessionId;
      const result = await f.call(
        { action: 'complete', provider: 'qq', state: `desktop_${id}`, code: 'test_code' },
        origin
      );
      expect(result.code).toBe(403);
      expect(f.records.get(id).phase).toBe('pending');
      expect(f.deps.exchange).not.toHaveBeenCalled();
    }
  );
  it('provider/config switching cannot consume the valid originating request', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    expect((await f.finish(id, 'wechat')).code).toBe(403);
    f.configs.qq.appId = 'changed-app';
    expect((await f.finish(id)).code).toBe(403);
    expect(f.records.get(id).phase).toBe('pending');
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
  it.each(['00'.repeat(32), '', 'not-hex'])('wrong verifier cannot consume or cancel %s', async (proof) => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    await f.finish(id);
    expect((await f.poll(id, proof)).code).toBe(403);
    expect((await f.call({ action: 'cancel', sessionId: id, verifier: proof })).code).toBe(403);
    expect(f.records.get(id).phase).toBe('ready');
    expect(f.deps.issue).not.toHaveBeenCalled();
  });
  it('an allowed other native origin cannot claim the initiating origin request', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    await f.finish(id);
    expect((await f.call({ action: 'poll', sessionId: id, verifier: f.verifier }, 'http://tauri.localhost')).code).toBe(
      403
    );
    expect(f.deps.issue).not.toHaveBeenCalled();
  });
  it('cancellation while supplier exchange is running rejects the late identity', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    let deliver: any;
    f.deps.exchange.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        })
    );
    const pending = f.finish(id);
    await vi.waitFor(() => expect(deliver).toBeTypeOf('function'));
    expect((await f.call({ action: 'cancel', sessionId: id, verifier: f.verifier })).code).toBe(0);
    deliver({ code: 0, data: { userId: 'late-user' } });
    expect((await pending).code).toBe(409);
    expect((await f.poll(id)).code).toBe(401);
    expect(f.records.get(id).result).toBeNull();
    expect(f.deps.issue).not.toHaveBeenCalled();
  });
  it('expiry during exchange prevents ready state and subsequent signing', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    f.deps.exchange.mockImplementationOnce(async () => {
      f.advance(600_000);
      return { code: 0, data: { userId: 'expired-user' } };
    });
    expect((await f.finish(id)).code).toBe(401);
    expect((await f.poll(id)).code).toBe(401);
    expect(f.deps.issue).not.toHaveBeenCalled();
  });
  it('ciphertext alteration fails closed and cannot replay a consumed reference', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    await f.finish(id);
    const doc = f.records.get(id);
    doc.result.body = '00'.repeat(50);
    expect((await f.poll(id)).code).toBe(401);
    expect((await f.poll(id)).code).toBe(409);
    expect(f.deps.issue).not.toHaveBeenCalled();
  });
  it('upstream error or rejected issuance never returns credentials to the browser', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    f.deps.exchange.mockRejectedValueOnce(new Error('provider-secret-fixture'));
    expect(JSON.stringify(await f.finish(id))).not.toContain('provider-secret-fixture');
    expect((await f.poll(id)).code).toBe(401);
    expect(f.deps.exchange).toHaveBeenCalledTimes(1);
  });
  it('disabled or missing retention refuses session creation', async () => {
    for (const disabled of [true, false]) {
      const f = fixture();
      f.deps.enabled = !disabled;
      f.deps.retentionConfigured.mockResolvedValue(false);
      expect((await f.begin()).code).toBe(503);
      expect(f.deps.collection.add).not.toHaveBeenCalled();
    }
  });
  it.each(['https://learning.example.com', '', 'null'])('browser %s cannot create a native session', async (origin) => {
    const f = fixture();
    expect((await f.call({ action: 'begin', provider: 'qq', challenge: f.challenge }, origin)).code).toBe(403);
    expect(f.deps.collection.add).not.toHaveBeenCalled();
  });
  it('GET, unknown fields and malformed proofs fail before supplier calls or writes', async () => {
    const f = fixture();
    for (const [body, method] of [
      [{ action: 'begin', provider: 'qq', challenge: f.challenge }, 'GET'],
      [{ action: 'begin', provider: 'qq', challenge: f.challenge, redirectUri: 'https://evil.example.com/' }, 'POST'],
      [{ action: 'begin', provider: 'qq', challenge: 'a' }, 'POST']
    ] as const) {
      expect((await f.call(body, 'tauri://localhost', method)).code).toBe(400);
    }
    expect(f.deps.collection.add).not.toHaveBeenCalled();
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
  it('supplier cancellation is consumed once and stops desktop polling', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    expect((await f.finish(id, 'qq', { error: 'access_denied' })).message).toBe('用户取消授权');
    expect((await f.poll(id)).message).toBe('用户取消授权');
    expect((await f.finish(id)).code).toBe(409);
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
  it('poll limiting preserves ready state for a later legitimate claim', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    await f.finish(id);
    f.deps.pollAllowed.mockResolvedValueOnce(false);
    expect((await f.poll(id)).code).toBe(429);
    expect(f.records.get(id).phase).toBe('ready');
    expect((await f.poll(id)).code).toBe(0);
  });
  it('wrong proof attempts still consume the bounded poll budget before any session read', async () => {
    const f = fixture(),
      id = (await f.begin()).data!.sessionId;
    f.deps.pollAllowed.mockResolvedValue(false);
    const reads = vi.spyOn(f.deps.collection, 'doc');
    expect((await f.poll(id, '00'.repeat(32))).code).toBe(429);
    expect(reads).not.toHaveBeenCalled();
    expect(f.records.get(id).phase).toBe('pending');
  });
  it.each([
    'http://learning.example.com/oauth/qq.html',
    'https://learning.example.com/#/callback',
    'https://127.0.0.1/oauth/qq.html',
    'https://10.1.1.1/oauth/qq.html',
    'https://user@learning.example.com/oauth/qq.html',
    'https://learning.example.com:5000/oauth/qq.html'
  ])('rejects unsafe registered callback %s', (value) => {
    expect(desktopCallbackOrigin('qq', value)).toBeNull();
    expect(() => desktopAuthorizationUrl('qq', { appId: 'test', redirectUri: value }, '00'.repeat(32))).toThrow();
  });
});
