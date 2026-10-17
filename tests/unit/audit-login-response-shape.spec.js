import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadLoginHandler({
  jwtSecret = 'unit_test_jwt',
  rateLimitAllowed = true,
  users = [],
  mobileAppId = 'unit_wx_mobile_appid',
  mobileSecret = 'unit_mobile_secret+&=?',
  webAppId = 'unit_wx_web_appid',
  webSecret = 'unit_web_secret+&=?',
  indexMigration = false,
  adminSecret = 'unit_admin_secret_for_scoped_indexes'
} = {}) {
  vi.resetModules();

  const originalEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    WX_APPID: process.env.WX_APPID,
    WX_SECRET: process.env.WX_SECRET,
    WX_GZH_APPID: process.env.WX_GZH_APPID,
    WX_GZH_SECRET: process.env.WX_GZH_SECRET,
    WX_MOBILE_APPID: process.env.WX_MOBILE_APPID,
    WX_MOBILE_SECRET: process.env.WX_MOBILE_SECRET,
    WX_WEB_APPID: process.env.WX_WEB_APPID,
    WX_WEB_SECRET: process.env.WX_WEB_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET
  };

  if (jwtSecret) {
    process.env.JWT_SECRET = jwtSecret;
  } else {
    delete process.env.JWT_SECRET;
  }
  process.env.WX_APPID = 'unit_wx_appid';
  process.env.WX_SECRET = 'unit_wx_secret';
  process.env.WX_GZH_APPID = 'unit_wx_gzh_appid';
  process.env.WX_GZH_SECRET = 'unit_wx_gzh_secret';
  process.env.WX_MOBILE_APPID = mobileAppId;
  process.env.WX_MOBILE_SECRET = mobileSecret;
  process.env.WX_WEB_APPID = webAppId;
  process.env.WX_WEB_SECRET = webSecret;
  process.env.ADMIN_SECRET = adminSecret;

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const records = structuredClone(users);
  const collection = {
    createIndex: vi.fn(async (_key, options) => options.name),
    where: vi.fn((query) => ({
      getOne: async () => ({
        data: structuredClone(
          records.find((user) => Object.entries(query).every(([key, value]) => user[key] === value)) || null
        )
      })
    })),
    add: vi.fn(async (data) => {
      const id = 'isolated-user-' + records.length;
      records.push({ ...data, _id: id });
      return { id };
    }),
    doc: vi.fn((id) => ({
      update: vi.fn(async (patch) =>
        Object.assign(
          records.find((user) => user._id === id),
          patch
        )
      )
    }))
  };
  const collectionFactory = vi.fn(() => collection);
  const cloudMock = {
    default: {
      database: () => ({ collection: collectionFactory }),
      fetch: vi.fn()
    }
  };

  vi.doMock('@lafjs/cloud', () => cloudMock);
  vi.doMock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => cloudMock);

  vi.doMock('../../laf-backend/functions/_shared/perf-monitor', () => ({
    perfMonitor: {
      start: () => () => {}
    }
  }));

  vi.doMock('../../laf-backend/functions/_shared/api-response', () => ({
    createLogger: () => logger,
    checkRateLimitDistributed: async () => ({
      allowed: rateLimitAllowed,
      remaining: rateLimitAllowed ? 4 : 0,
      resetAt: Date.now() + 60_000,
      source: 'database'
    })
  }));

  const mod = indexMigration
    ? await import('../../laf-backend/functions/db-create-indexes')
    : await import('../../laf-backend/functions/login');

  const restoreEnv = () => {
    if (originalEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    if (originalEnv.WX_APPID === undefined) delete process.env.WX_APPID;
    else process.env.WX_APPID = originalEnv.WX_APPID;
    if (originalEnv.WX_SECRET === undefined) delete process.env.WX_SECRET;
    else process.env.WX_SECRET = originalEnv.WX_SECRET;
    if (originalEnv.WX_GZH_APPID === undefined) delete process.env.WX_GZH_APPID;
    else process.env.WX_GZH_APPID = originalEnv.WX_GZH_APPID;
    if (originalEnv.WX_GZH_SECRET === undefined) delete process.env.WX_GZH_SECRET;
    else process.env.WX_GZH_SECRET = originalEnv.WX_GZH_SECRET;
    for (const key of ['WX_MOBILE_APPID', 'WX_MOBILE_SECRET', 'WX_WEB_APPID', 'WX_WEB_SECRET', 'ADMIN_SECRET']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  };

  return {
    handler: (ctx) => mod.default({ ...ctx, body: { region: 'CN', ...ctx.body } }),
    restoreEnv,
    fetch: cloudMock.default.fetch,
    records,
    collection,
    collectionFactory,
    logger,
    getUserIdentityIndexes: mod.getUserIdentityIndexes
  };
}

describe('受保护用户身份索引范围', () => {
  const context = (scope = 'user-identities') => ({
    headers: { 'x-admin-secret': 'unit_admin_secret_for_scoped_indexes' },
    body: { scope }
  });
  it('桌面授权保留期限使用独立管理员范围，不顺带执行其他迁移', async () => {
    const setup = await loadLoginHandler({ indexMigration: true });
    try {
      expect((await setup.handler({ headers: {}, body: { scope: 'desktop-oauth' } })).code).toBe(403);
      expect(setup.collection.createIndex).not.toHaveBeenCalled();
      expect((await setup.handler(context('desktop-oauth'))).code).toBe(0);
      expect(setup.collectionFactory).toHaveBeenCalledExactlyOnceWith('desktop_oauth_sessions');
      expect(setup.collection.createIndex).toHaveBeenCalledExactlyOnceWith(
        { expires_at: 1 },
        { expireAfterSeconds: 0, name: 'idx_desktop_oauth_expiry' }
      );
    } finally {
      setup.restoreEnv();
    }
  });
  it('保留期限迁移失败时不泄露数据库诊断且可以明确重试', async () => {
    const setup = await loadLoginHandler({ indexMigration: true });
    setup.collection.createIndex.mockRejectedValueOnce(new Error('private-index-diagnostic'));
    try {
      const result = await setup.handler(context('desktop-oauth'));
      expect(result).toMatchObject({ code: 1, success: false, message: '桌面授权保留期限未配置' });
      expect(JSON.stringify(result)).not.toContain('private-index-diagnostic');
      expect((await setup.handler(context('desktop-oauth'))).code).toBe(0);
    } finally {
      setup.restoreEnv();
    }
  });
  it('管理员鉴权在范围处理之前，未授权或管理员配置缺失均不创建索引', async () => {
    for (const adminSecret of ['', 'unit_admin_secret_for_scoped_indexes']) {
      const setup = await loadLoginHandler({ indexMigration: true, adminSecret });
      try {
        const result = await setup.handler({
          headers: {},
          body: { scope: 'user-identities' }
        });
        expect(result.code).toBe(adminSecret ? 403 : 503);
        expect(setup.collection.createIndex).not.toHaveBeenCalled();
        expect(setup.collectionFactory).not.toHaveBeenCalled();
      } finally {
        setup.restoreEnv();
      }
    }
  });
  it.each(['', null, 'unknown', {}, ['user-identities']])('拒绝未知范围 %j，不退回完整迁移', async (scope) => {
    const setup = await loadLoginHandler({ indexMigration: true });
    try {
      const result = await setup.handler(context(scope));
      expect(result).toMatchObject({ code: 400, success: false });
      expect(setup.collection.createIndex).not.toHaveBeenCalled();
      expect(setup.collectionFactory).not.toHaveBeenCalled();
    } finally {
      setup.restoreEnv();
    }
  });
  it('身份迁移保留现有邮箱索引，并且不访问其他业务集合', async () => {
    const setup = await loadLoginHandler({ indexMigration: true });
    setup.collection.createIndex.mockImplementation(async (key, options) => {
      if ('email' in key) throw new Error('existing email_1 must stay');
      return options.name;
    });
    try {
      const result = await setup.handler(context());
      expect(result).toMatchObject({ code: 0, success: true });
      expect(setup.collection.createIndex).toHaveBeenCalledTimes(8);
      expect(setup.collectionFactory.mock.calls.every(([name]) => name === 'users')).toBe(true);
      const names = setup.collection.createIndex.mock.calls.map(([, options]) => options.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'idx_wx_mobile_identity_unique',
          'idx_apple_identity_unique',
          'idx_google_identity_unique',
          'idx_phone_unique',
          'idx_wx_web_identity_unique'
        ])
      );
      expect(setup.collection.createIndex.mock.calls.every(([, options]) => options.unique === true)).toBe(true);
    } finally {
      setup.restoreEnv();
    }
  });
  it('失败不宣称已完成，不把重复键中的真实身份回显或记入日志', async () => {
    const setup = await loadLoginHandler({ indexMigration: true });
    setup.collection.createIndex.mockRejectedValueOnce(new Error('duplicate key contains private-openid-fixture'));
    try {
      const result = await setup.handler(context());
      expect(result).toMatchObject({ code: 1, success: false, data: [{ status: 'error' }] });
      expect(JSON.stringify(result)).not.toContain('private-openid-fixture');
      expect(setup.collection.createIndex).toHaveBeenCalledTimes(1);
      expect(setup.logger.error).not.toHaveBeenCalled();
    } finally {
      setup.restoreEnv();
    }
  });
  it('省略范围仍保留完整管理员迁移，导出的定义不能被调用方改写', async () => {
    const setup = await loadLoginHandler({ indexMigration: true });
    try {
      const definitions = setup.getUserIdentityIndexes();
      definitions[0].key.wx_mobile_appid = -1;
      definitions[0].options.partialFilterExpression.app_openid.$type = 'number';
      definitions.pop();
      expect(setup.getUserIdentityIndexes()).toHaveLength(8);
      expect(setup.getUserIdentityIndexes()[0].key.wx_mobile_appid).toBe(1);
      expect(setup.getUserIdentityIndexes()[0].options.partialFilterExpression.app_openid.$type).toBe('string');
      const result = await setup.handler({ headers: context().headers, body: {} });
      expect(result).toMatchObject({ code: 0, success: true });
      expect(setup.collectionFactory.mock.calls.some(([name]) => name === 'questions')).toBe(true);
      expect(setup.collectionFactory.mock.calls.some(([name]) => name === 'mistake_book')).toBe(true);
    } finally {
      setup.restoreEnv();
    }
  });
});

describe('[安全审计] login 错误响应形态一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 JWT_SECRET 时应返回 500 且 success=false', async () => {
    const { handler, restoreEnv } = await loadLoginHandler({ jwtSecret: '' });

    try {
      const result = await handler({
        body: { type: 'wechat', code: 'valid_code_12345' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });

      expect(result.code).toBe(500);
      expect(result.success).toBe(false);
      expect(result.message).toContain('缺少 JWT 签名密钥');
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });

  it('邮箱登录缺少 email 时应返回 400 且 success=false', async () => {
    const { handler, restoreEnv } = await loadLoginHandler({ jwtSecret: 'unit_test_jwt' });

    try {
      const result = await handler({
        body: { type: 'email', verifyCode: '123456' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });

      expect(result.code).toBe(400);
      expect(result.success).toBe(false);
      expect(result.message).toContain('邮箱不能为空');
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });

  it('登录限流触发时应返回 429 且 success=false', async () => {
    const { handler, restoreEnv } = await loadLoginHandler({
      jwtSecret: 'unit_test_jwt',
      rateLimitAllowed: false
    });

    try {
      const result = await handler({
        body: { type: 'wechat', code: 'valid_code_12345' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });

      expect(result.code).toBe(429);
      expect(result.success).toBe(false);
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });
});

function wechatReplies(fetch, { openid = 'provider-openid', unionid, profile = {} } = {}) {
  fetch.mockResolvedValueOnce({
    status: 200,
    data: { access_token: 'provider-private-token', openid, ...(unionid ? { unionid } : {}) }
  });
  fetch.mockResolvedValueOnce({ status: 200, data: { openid, nickname: '微信学习者', ...profile } });
}
const nativeBody = { type: 'wechat', platform: 'app', code: 'isolated-native-code' };
const jwtPayload = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('微信移动应用的一次性授权码与服务端身份', () => {
  it.each([undefined, 12345, 'short', 'a'.repeat(201), 'valid-code&role=admin'])(
    '拒绝非法授权码 %s，无上游请求或账户写入',
    async (code) => {
      const run = await loadLoginHandler();
      try {
        expect(
          (await run.handler({ body: { ...nativeBody, code }, socket: { remoteAddress: '192.0.2.1' }, headers: {} }))
            .code
        ).toBe(400);
        expect(run.fetch).not.toHaveBeenCalled();
        expect(run.collection.add).not.toHaveBeenCalled();
      } finally {
        run.restoreEnv();
      }
    }
  );
  it.each([{ mobileAppId: '' }, { mobileSecret: '' }])('缺移动配置不借用小程序或公众号配置', async (config) => {
    const run = await loadLoginHandler(config);
    try {
      const response = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(response).toMatchObject({ code: 500, success: false });
      expect(response.message).toContain('移动应用');
      expect(run.fetch).not.toHaveBeenCalled();
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('使用移动应用密钥编码换码，忽略客户端令牌/身份/角色，JWT仅采用服务端账户', async () => {
    const run = await loadLoginHandler({
      users: [
        { _id: 'mini-user', openid: 'provider-openid', role: 'user' },
        { _id: 'h5-user', h5_openid: 'provider-openid', role: 'user' }
      ]
    });
    wechatReplies(run.fetch, { profile: { role: 'admin', password: 'private-provider-field' } });
    try {
      const response = await run.handler({
        body: {
          ...nativeBody,
          openid: 'forged-openid',
          accessToken: 'forged-token',
          userInfo: { role: 'admin' },
          role: 'admin'
        },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(response.code).toBe(0);
      expect(response.data.userId).toBe('isolated-user-2');
      expect(response.data.userInfo.role).toBe('user');
      expect(run.records[2]).toMatchObject({ app_openid: 'provider-openid', wx_mobile_appid: 'unit_wx_mobile_appid' });
      expect(run.records[2]).not.toHaveProperty('openid');
      const tokenRequest = run.fetch.mock.calls[0][0];
      const url = new URL(tokenRequest.url);
      expect(url.origin + url.pathname).toBe('https://api.weixin.qq.com/sns/oauth2/access_token');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        appid: 'unit_wx_mobile_appid',
        secret: 'unit_mobile_secret+&=?',
        code: nativeBody.code,
        grant_type: 'authorization_code'
      });
      expect(tokenRequest).toMatchObject({ timeout: 10000, maxRedirects: 0, maxContentLength: 65536 });
      expect(jwtPayload(response.data.token)).toMatchObject({
        userId: 'isolated-user-2',
        role: 'user',
        app_openid: 'provider-openid',
        wx_mobile_appid: 'unit_wx_mobile_appid'
      });
      const exposed = JSON.stringify([response, Object.values(run.logger).flatMap((fn) => fn.mock.calls), run.records]);
      for (const privateValue of [
        'provider-private-token',
        'unit_mobile_secret',
        nativeBody.code,
        'forged-token',
        'private-provider-field'
      ]) {
        expect(exposed).not.toContain(privateValue);
      }
    } finally {
      run.restoreEnv();
    }
  });
  it('同移动应用重复登录复用账户，相同 openid 的其他移动应用独立归属', async () => {
    const run = await loadLoginHandler({
      users: [{ _id: 'other-app', app_openid: 'provider-openid', wx_mobile_appid: 'other-mobile-app', role: 'user' }]
    });
    try {
      wechatReplies(run.fetch);
      const first = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      wechatReplies(run.fetch);
      const second = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(first.data.userId).not.toBe('other-app');
      expect(second.data.userId).toBe(first.data.userId);
      expect(second.data.isNewUser).toBe(false);
      expect(run.collection.add).toHaveBeenCalledTimes(1);
    } finally {
      run.restoreEnv();
    }
  });
  it('只用服务端一致的 unionid 衔接已有账户，保留服务端角色和自定昵称', async () => {
    const run = await loadLoginHandler({
      users: [{ _id: 'known-user', unionid: 'server-union', nickname: '我的昵称', role: 'user' }]
    });
    wechatReplies(run.fetch, { unionid: 'server-union', profile: { unionid: 'server-union' } });
    try {
      const response = await run.handler({
        body: { ...nativeBody, unionid: 'client-forged-union' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(response.data.userId).toBe('known-user');
      expect(response.data.userInfo.nickname).toBe('我的昵称');
      expect(run.collection.add).not.toHaveBeenCalled();
      expect(run.records[0].app_openid).toBe('provider-openid');
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    { profile: { openid: 'other-openid' } },
    { unionid: 'token-union', profile: { unionid: 'different-union' } },
    { profile: { unionid: { forged: true } } }
  ])('上游资料身份不一致不创建账户', async (provider) => {
    const run = await loadLoginHandler();
    wechatReplies(run.fetch, provider);
    try {
      expect((await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(
        401
      );
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('unionid 与移动身份已属不同账户时不合并、不改角色', async () => {
    const run = await loadLoginHandler({
      users: [
        { _id: 'one', app_openid: 'provider-openid', wx_mobile_appid: 'unit_wx_mobile_appid', role: 'user' },
        { _id: 'two', unionid: 'server-union', role: 'admin' }
      ]
    });
    wechatReplies(run.fetch, { unionid: 'server-union' });
    try {
      expect((await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(
        409
      );
      expect(run.records).toHaveLength(2);
      expect(run.records[0]).not.toHaveProperty('unionid');
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    { status: 302, data: { access_token: 'private-token', openid: 'provider-openid' } },
    { status: 200, data: 'not-json-private-token' },
    { status: 200, data: { access_token: 'private-token', openid: { forged: true } } },
    { status: 200, data: { errcode: 40029, errmsg: 'private-provider-description' } }
  ])('错误/畸形响应只返回固定消息，不写账户', async (provider) => {
    const run = await loadLoginHandler();
    run.fetch.mockResolvedValueOnce(provider);
    try {
      const response = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(response.code).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify([response, Object.values(run.logger).flatMap((fn) => fn.mock.calls)])).not.toContain(
        'private-'
      );
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('HTTP 异常中的密钥地址不会进入响应或日志', async () => {
    const run = await loadLoginHandler();
    run.fetch.mockRejectedValueOnce(new Error('private-secret-url?code=private-code'));
    try {
      expect((await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(
        502
      );
      expect(JSON.stringify(Object.values(run.logger).flatMap((fn) => fn.mock.calls))).not.toContain('private-');
    } finally {
      run.restoreEnv();
    }
  });

  it('数据库错误含身份时只保留请求定位，不记录或返回原始错误', async () => {
    const run = await loadLoginHandler();
    wechatReplies(run.fetch);
    run.collection.add.mockRejectedValueOnce(new Error('TEST_ONLY_private_db_identity'));
    try {
      const response = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(response).toMatchObject({ code: 500, success: false });
      expect(JSON.stringify([response, Object.values(run.logger).flatMap((fn) => fn.mock.calls)])).not.toContain(
        'TEST_ONLY_private_db_identity'
      );
    } finally {
      run.restoreEnv();
    }
  });
  it('H5 仍用公众号密钥和 h5_openid，移动身份不覆盖它', async () => {
    const run = await loadLoginHandler();
    wechatReplies(run.fetch);
    try {
      const response = await run.handler({
        body: { type: 'wechat_h5', code: nativeBody.code },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(response.code).toBe(0);
      expect(new URL(run.fetch.mock.calls[0][0].url).searchParams.get('appid')).toBe('unit_wx_gzh_appid');
      expect(run.records[0]).toMatchObject({ h5_openid: 'provider-openid' });
      expect(run.records[0]).not.toHaveProperty('app_openid');
      expect(jwtPayload(response.data.token)).toMatchObject({ h5_openid: 'provider-openid' });
    } finally {
      run.restoreEnv();
    }
  });
  it.each([{ type: 'unknown' }, { ...nativeBody, platform: 'unknown' }])('未知登录方式不回退到小程序', async (body) => {
    const run = await loadLoginHandler();
    try {
      expect((await run.handler({ body, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(400);
      expect(run.fetch).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('移动授权仍受登录限流约束', async () => {
    const run = await loadLoginHandler({ rateLimitAllowed: false });
    try {
      expect((await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(
        429
      );
      expect(run.fetch).not.toHaveBeenCalled();
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });

  it.each(['wechat', 'weixin'])('保留小程序 %s 登录及旧版 Store 别名', async (type) => {
    const run = await loadLoginHandler();
    run.fetch.mockResolvedValueOnce({ data: { errcode: 40029 } });
    try {
      const response = await run.handler({
        body: { type, code: nativeBody.code },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(response.code).toBe(401);
      expect(new URL(run.fetch.mock.calls[0][0].url).pathname).toBe('/sns/jscode2session');
    } finally {
      run.restoreEnv();
    }
  });

  it.each([
    ['matching', undefined, 0],
    ['conflicting', 'foreign-union', 409]
  ])('并发唯一键冲突后 %s 账户回查仍核对归属', async (_name, racedUnionid, expected) => {
    const run = await loadLoginHandler();
    wechatReplies(run.fetch, { unionid: 'server-union' });
    run.collection.add.mockImplementationOnce(async () => {
      run.records.push({
        _id: 'raced-user',
        app_openid: 'provider-openid',
        wx_mobile_appid: 'unit_wx_mobile_appid',
        role: 'user',
        ...(racedUnionid ? { unionid: racedUnionid } : {})
      });
      throw new Error('E11000 duplicate key');
    });
    try {
      const response = await run.handler({ body: nativeBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(response.code).toBe(expected);
      expect(run.records).toHaveLength(1);
      if (expected === 0) expect(response.data.userId).toBe('raced-user');
      else expect(response).not.toHaveProperty('data.token');
    } finally {
      run.restoreEnv();
    }
  });
});

describe('网站微信扫码与独立应用身份', () => {
  const websiteBody = { type: 'wechat_web', code: 'isolated-website-code' };
  it.each([{ webAppId: '' }, { webSecret: '' }])('缺网站配置时不借用公众号或移动应用', async (config) => {
    const run = await loadLoginHandler(config);
    try {
      expect(
        await run.handler({ body: websiteBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })
      ).toMatchObject({ code: 500, success: false });
      expect(run.fetch).not.toHaveBeenCalled();
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('仅用网站应用换码，隔离其他应用/平台身份，重复登录复用原账户且不暴露凭据', async () => {
    const run = await loadLoginHandler({
      users: [
        { _id: 'h5', h5_openid: 'provider-openid', role: 'user' },
        { _id: 'mobile', app_openid: 'provider-openid', wx_mobile_appid: 'unit_wx_mobile_appid', role: 'user' },
        { _id: 'other-web', web_openid: 'provider-openid', wx_web_appid: 'other-website', role: 'user' }
      ]
    });
    try {
      wechatReplies(run.fetch, { profile: { role: 'admin' } });
      const first = await run.handler({
        body: { ...websiteBody, web_openid: 'forged-id', role: 'admin' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(first.code).toBe(0);
      expect(first.data.userId).toBe('isolated-user-3');
      expect(first.data.userInfo.role).toBe('user');
      const url = new URL(run.fetch.mock.calls[0][0].url);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        appid: 'unit_wx_web_appid',
        secret: 'unit_web_secret+&=?',
        code: websiteBody.code,
        grant_type: 'authorization_code'
      });
      expect(run.fetch.mock.calls[0][0]).toMatchObject({ maxRedirects: 0, maxContentLength: 65536, timeout: 10000 });
      const identity = { web_openid: 'provider-openid', wx_web_appid: 'unit_wx_web_appid' };
      expect(run.records[3]).toMatchObject(identity);
      expect(run.records[3]).not.toHaveProperty('h5_openid');
      expect(run.records[3]).not.toHaveProperty('app_openid');
      expect(run.records[3]).not.toHaveProperty('unionid');
      expect(jwtPayload(first.data.token)).toMatchObject({ ...identity, role: 'user' });
      wechatReplies(run.fetch);
      const second = await run.handler({ body: websiteBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} });
      expect(second.data).toMatchObject({ userId: first.data.userId, isNewUser: false });
      expect(run.collection.add).toHaveBeenCalledTimes(1);
      const exposed = JSON.stringify([first, run.records, Object.values(run.logger).flatMap((fn) => fn.mock.calls)]);
      for (const value of ['unit_web_secret', 'provider-private-token', websiteBody.code, 'forged-id']) {
        expect(exposed).not.toContain(value);
      }
    } finally {
      run.restoreEnv();
    }
  });
  it('服务端一致的 unionid 连接既有账户，保留其角色、昵称和公众号身份', async () => {
    const original = {
      _id: 'known',
      unionid: 'server-union',
      h5_openid: 'h5-own-id',
      nickname: '原昵称',
      role: 'user'
    };
    const run = await loadLoginHandler({ users: [original] });
    try {
      wechatReplies(run.fetch, { unionid: 'server-union', profile: { unionid: 'server-union' } });
      const response = await run.handler({
        body: { ...websiteBody, unionid: 'forged-union' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(response.data.userId).toBe('known');
      expect(run.records[0]).toMatchObject({
        ...original,
        web_openid: 'provider-openid',
        wx_web_appid: 'unit_wx_web_appid'
      });
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each(['preexisting', 'raced'])('%s 网站身份与 unionid 冲突时不覆盖账户', async (scenario) => {
    const user = {
      _id: 'conflict',
      web_openid: 'provider-openid',
      wx_web_appid: 'unit_wx_web_appid',
      unionid: 'other-union',
      role: 'user'
    };
    const run = await loadLoginHandler({ users: scenario === 'preexisting' ? [user] : [] });
    try {
      wechatReplies(run.fetch, { unionid: 'server-union' });
      if (scenario === 'raced')
        run.collection.add.mockImplementationOnce(async () => {
          run.records.push(structuredClone(user));
          throw new Error('E11000 duplicate key');
        });
      expect(
        await run.handler({ body: websiteBody, socket: { remoteAddress: '192.0.2.1' }, headers: {} })
      ).toMatchObject({ code: 409, success: false });
      expect(run.records).toEqual([user]);
    } finally {
      run.restoreEnv();
    }
  });
  it('网站登录受限流与授权码校验约束，拒绝请求不接触上游或用户', async () => {
    for (const [rateLimitAllowed, body, code] of [
      [false, websiteBody, 429],
      [true, { ...websiteBody, code: 'bad&code' }, 400]
    ]) {
      const run = await loadLoginHandler({ rateLimitAllowed });
      try {
        expect((await run.handler({ body, socket: { remoteAddress: '192.0.2.1' }, headers: {} })).code).toBe(code);
        expect(run.fetch).not.toHaveBeenCalled();
        expect(run.collection.add).not.toHaveBeenCalled();
      } finally {
        run.restoreEnv();
      }
    }
  });
  it('网站复合索引只约束完整字符串身份，无身份记录和其他网站仍可独立存在', async () => {
    const run = await loadLoginHandler({ indexMigration: true });
    try {
      expect(run.getUserIdentityIndexes().find(({ options }) => options.name === 'idx_wx_web_identity_unique')).toEqual(
        {
          key: { wx_web_appid: 1, web_openid: 1 },
          options: {
            name: 'idx_wx_web_identity_unique',
            unique: true,
            partialFilterExpression: { wx_web_appid: { $type: 'string' }, web_openid: { $type: 'string' } }
          }
        }
      );
    } finally {
      run.restoreEnv();
    }
  });
});

describe('retired QQ rejects every former credential shape', () => {
  it.each(['h5', 'app', 'mp-qq'])('rejects %s without provider requests or data changes', async (platform) => {
    const setup = await loadLoginHandler();
    try {
      const result = await setup.handler({
        body: { type: 'qq', platform, code: 'fixture-code', accessToken: 'fixture-token' },
        socket: { remoteAddress: '192.0.2.1' },
        headers: {}
      });
      expect(result).toMatchObject({ code: 400, errorCode: 'UNSUPPORTED_LOGIN', success: false });
      expect(setup.fetch).not.toHaveBeenCalled();
      expect(setup.collection.add).not.toHaveBeenCalled();
    } finally {
      setup.restoreEnv();
    }
  });
});
