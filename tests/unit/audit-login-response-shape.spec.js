import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadLoginHandler({
  jwtSecret = 'unit_test_jwt',
  rateLimitAllowed = true,
  qqRedirectUri = '',
  users = [],
  mobileAppId = 'unit_wx_mobile_appid',
  mobileSecret = 'unit_mobile_secret+&=?',
  webAppId = 'unit_wx_web_appid',
  webSecret = 'unit_web_secret+&=?',
  qqMobileAppId = 'unit_qq_mobile_appid',
  qqMiniAppId = 'unit_qq_mini_appid',
  qqMiniSecret = 'unit_qq_mini_secret+&=?',
  qqWebSecret = 'unit_qq_secret+&=?',
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
    QQ_APPID: process.env.QQ_APPID,
    QQ_SECRET: process.env.QQ_SECRET,
    QQ_REDIRECT_URI: process.env.QQ_REDIRECT_URI,
    QQ_MOBILE_APPID: process.env.QQ_MOBILE_APPID,
    QQ_MINI_APPID: process.env.QQ_MINI_APPID,
    QQ_MINI_SECRET: process.env.QQ_MINI_SECRET,
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
  process.env.QQ_APPID = 'unit_qq_appid';
  process.env.QQ_SECRET = qqWebSecret;
  process.env.QQ_REDIRECT_URI = qqRedirectUri;
  process.env.QQ_MOBILE_APPID = qqMobileAppId;
  process.env.QQ_MINI_APPID = qqMiniAppId;
  process.env.QQ_MINI_SECRET = qqMiniSecret;
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
    for (const key of [
      'QQ_APPID',
      'QQ_SECRET',
      'QQ_REDIRECT_URI',
      'QQ_MOBILE_APPID',
      'QQ_MINI_APPID',
      'QQ_MINI_SECRET',
      'WX_MOBILE_APPID',
      'WX_MOBILE_SECRET',
      'WX_WEB_APPID',
      'WX_WEB_SECRET',
      'ADMIN_SECRET'
    ]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  };

  return {
    handler: mod.default,
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
        const result = await setup.handler({ headers: {}, body: { scope: 'user-identities' } });
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
      expect(setup.collection.createIndex).toHaveBeenCalledTimes(9);
      expect(setup.collectionFactory.mock.calls.every(([name]) => name === 'users')).toBe(true);
      const names = setup.collection.createIndex.mock.calls.map(([, options]) => options.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'idx_wx_mobile_identity_unique',
          'idx_qq_mobile_identity_unique',
          'idx_qq_mini_identity_unique',
          'idx_qq_unionid_unique',
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
      expect(setup.getUserIdentityIndexes()).toHaveLength(9);
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
      const result = await handler({ body: { type: 'wechat', code: 'valid_code_12345' }, headers: {} });

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
      const result = await handler({ body: { type: 'email', verifyCode: '123456' }, headers: {} });

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
      const result = await handler({ body: { type: 'wechat', code: 'valid_code_12345' }, headers: {} });

      expect(result.code).toBe(429);
      expect(result.success).toBe(false);
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });
});

describe('QQ 网页授权使用可登记且一致的回调地址', () => {
  it.each([
    ['origin', '', undefined, 'https://exam.245334.xyz/oauth/qq.html'],
    ['configured', 'https://exam.245334.xyz/oauth/qq.html', undefined, 'https://exam.245334.xyz/oauth/qq.html'],
    ['saved', '', 'https://exam.245334.xyz/oauth/qq.html?version=1', 'https://exam.245334.xyz/oauth/qq.html?version=1']
  ])('%s 回调按原值发送给供应商', async (_name, qqRedirectUri, redirectUri, expected) => {
    const { handler, restoreEnv, fetch } = await loadLoginHandler({ qqRedirectUri });
    fetch.mockResolvedValue({ status: 200, data: 'access_token=' });
    try {
      const result = await handler({
        body: { type: 'qq', platform: 'h5', code: 'test_only_qq_code', redirectUri },
        headers: _name === 'origin' ? { origin: 'https://exam.245334.xyz' } : {}
      });
      expect(result.code).toBe(401);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(new URL(fetch.mock.calls[0][0].url).searchParams.get('redirect_uri')).toBe(expected);
    } finally {
      restoreEnv();
    }
  });

  it.each([
    ['fragment', 'https://exam.245334.xyz/#/pages/login/qq-callback'],
    ['credentials', 'https://user:pass@exam.245334.xyz/oauth/qq.html'],
    ['unapproved host', 'https://exam.245334.xyz.attacker.invalid/oauth/qq.html']
  ])('显式 %s 地址在上游调用前拒绝', async (_name, redirectUri) => {
    const { handler, restoreEnv, fetch } = await loadLoginHandler({
      qqRedirectUri: 'https://exam.245334.xyz/oauth/qq.html'
    });
    try {
      const result = await handler({
        body: { type: 'qq', platform: 'h5', code: 'test_only_qq_code', redirectUri },
        headers: { origin: 'https://exam.245334.xyz' }
      });
      expect(result.code).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      restoreEnv();
    }
  });

  it('旧的带片段服务端配置在上游调用前拒绝', async () => {
    const { handler, restoreEnv, fetch } = await loadLoginHandler({
      qqRedirectUri: 'https://exam.245334.xyz/#/pages/login/qq-callback'
    });
    try {
      const result = await handler({
        body: { type: 'qq', platform: 'h5', code: 'test_only_qq_code' },
        headers: {}
      });
      expect(result.code).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
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
        expect((await run.handler({ body: { ...nativeBody, code }, headers: {} })).code).toBe(400);
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
      const response = await run.handler({ body: nativeBody, headers: {} });
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
      const first = await run.handler({ body: nativeBody, headers: {} });
      wechatReplies(run.fetch);
      const second = await run.handler({ body: nativeBody, headers: {} });
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
      const response = await run.handler({ body: { ...nativeBody, unionid: 'client-forged-union' }, headers: {} });
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
      expect((await run.handler({ body: nativeBody, headers: {} })).code).toBe(401);
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
      expect((await run.handler({ body: nativeBody, headers: {} })).code).toBe(409);
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
      const response = await run.handler({ body: nativeBody, headers: {} });
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
      expect((await run.handler({ body: nativeBody, headers: {} })).code).toBe(502);
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
      const response = await run.handler({ body: nativeBody, headers: {} });
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
      const response = await run.handler({ body: { type: 'wechat_h5', code: nativeBody.code }, headers: {} });
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
      expect((await run.handler({ body, headers: {} })).code).toBe(400);
      expect(run.fetch).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('移动授权仍受登录限流约束', async () => {
    const run = await loadLoginHandler({ rateLimitAllowed: false });
    try {
      expect((await run.handler({ body: nativeBody, headers: {} })).code).toBe(429);
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
      const response = await run.handler({ body: { type, code: nativeBody.code }, headers: {} });
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
      const response = await run.handler({ body: nativeBody, headers: {} });
      expect(response.code).toBe(expected);
      expect(run.records).toHaveLength(1);
      if (expected === 0) expect(response.data.userId).toBe('raced-user');
      else expect(response).not.toHaveProperty('data.token');
    } finally {
      run.restoreEnv();
    }
  });
});

const qqAppBody = { type: 'qq', platform: 'app', accessToken: 'TEST_ONLY_token+&=?' };
const qqWebBody = {
  type: 'qq',
  platform: 'h5',
  code: 'isolated-qq-web-code',
  redirectUri: 'https://exam.245334.xyz/oauth/qq.html'
};
function qqReplies(
  fetch,
  { appId = 'unit_qq_mobile_appid', openid = 'provider-qq-openid', unionid, profile = {}, webToken } = {}
) {
  if (webToken !== undefined) fetch.mockResolvedValueOnce({ status: 200, data: webToken });
  fetch.mockResolvedValueOnce({
    status: 200,
    data: { client_id: appId, openid, ...(unionid !== undefined ? { unionid } : {}) }
  });
  fetch.mockResolvedValueOnce({ status: 200, data: { ret: 0, nickname: 'QQ学习者', ...profile } });
}

describe('网站微信扫码与独立应用身份', () => {
  const websiteBody = { type: 'wechat_web', code: 'isolated-website-code' };
  it.each([{ webAppId: '' }, { webSecret: '' }])('缺网站配置时不借用公众号或移动应用', async (config) => {
    const run = await loadLoginHandler(config);
    try {
      expect(await run.handler({ body: websiteBody, headers: {} })).toMatchObject({ code: 500, success: false });
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
      const second = await run.handler({ body: websiteBody, headers: {} });
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
      const response = await run.handler({ body: { ...websiteBody, unionid: 'forged-union' }, headers: {} });
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
      expect(await run.handler({ body: websiteBody, headers: {} })).toMatchObject({ code: 409, success: false });
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
        expect((await run.handler({ body, headers: {} })).code).toBe(code);
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

describe('QQ 授权归属与平台身份隔离', () => {
  it.each([
    { access_token: 'TEST_ONLY_token+&=?' },
    'access_token=TEST_ONLY_token%2B%26%3D%3F&expires_in=7776000',
    'callback({"access_token":"TEST_ONLY_token+&=?"});'
  ])('网站兼容 QQ 官方/旧响应格式且每次核验应用 ID', async (webToken) => {
    const run = await loadLoginHandler();
    qqReplies(run.fetch, { appId: 'unit_qq_appid', webToken });
    try {
      const response = await run.handler({ body: qqWebBody, headers: {} });
      expect(response.code).toBe(0);
      expect(run.records[0]).toMatchObject({ qq_openid: 'provider-qq-openid', role: 'user' });
      expect(run.records[0]).not.toHaveProperty('qq_mobile_openid');
      const tokenUrl = new URL(run.fetch.mock.calls[0][0].url);
      expect(tokenUrl.origin + tokenUrl.pathname).toBe('https://graph.qq.com/oauth2.0/token');
      expect(Object.fromEntries(tokenUrl.searchParams)).toEqual({
        grant_type: 'authorization_code',
        client_id: 'unit_qq_appid',
        client_secret: 'unit_qq_secret+&=?',
        code: qqWebBody.code,
        redirect_uri: qqWebBody.redirectUri,
        fmt: 'json'
      });
      const meUrl = new URL(run.fetch.mock.calls[1][0].url);
      expect(Object.fromEntries(meUrl.searchParams)).toEqual({
        access_token: qqAppBody.accessToken,
        unionid: '1',
        fmt: 'json'
      });
      for (const [request] of run.fetch.mock.calls)
        expect(request).toMatchObject({ timeout: 10000, maxRedirects: 0, maxContentLength: 65536 });
    } finally {
      run.restoreEnv();
    }
  });
  it.each([undefined, 123, 'unit_qq_appid', 'other-mobile-app'])(
    '移动 token 的回执应用 ID %s 不匹配即拒绝',
    async (client_id) => {
      const run = await loadLoginHandler();
      run.fetch.mockResolvedValueOnce({ status: 200, data: { client_id, openid: 'provider-qq-openid' } });
      try {
        expect((await run.handler({ body: qqAppBody, headers: {} })).code).toBe(401);
        expect(run.fetch).toHaveBeenCalledTimes(1);
        expect(run.collection.where).not.toHaveBeenCalled();
        expect(run.collection.add).not.toHaveBeenCalled();
      } finally {
        run.restoreEnv();
      }
    }
  );
  it('移动应用不采纳客户端角色/资料，服务器用精确编码 token 查询自己的应用', async () => {
    const run = await loadLoginHandler({ users: [{ _id: 'web-user', qq_openid: 'provider-qq-openid', role: 'user' }] });
    qqReplies(run.fetch, {
      profile: {
        role: 'admin',
        password: 'TEST_ONLY_provider_password',
        figureurl_qq_2: 'https://qlogo.example/avatar.png'
      }
    });
    try {
      const response = await run.handler({
        body: {
          ...qqAppBody,
          role: 'admin',
          unionid: 'forged-union',
          userInfo: { role: 'admin', nickname: 'forged-profile' }
        },
        headers: {}
      });
      expect(response.code).toBe(0);
      expect(response.data.userId).not.toBe('web-user');
      expect(response.data.userInfo).toMatchObject({ nickname: 'QQ学习者', role: 'user' });
      expect(run.records[1]).toMatchObject({
        qq_mobile_appid: 'unit_qq_mobile_appid',
        qq_mobile_openid: 'provider-qq-openid'
      });
      expect(run.records[1]).not.toHaveProperty('qq_openid');
      expect(jwtPayload(response.data.token)).toMatchObject({
        userId: response.data.userId,
        qq_openid: 'provider-qq-openid',
        role: 'user'
      });
      const profileUrl = new URL(run.fetch.mock.calls[1][0].url);
      expect(Object.fromEntries(profileUrl.searchParams)).toEqual({
        access_token: qqAppBody.accessToken,
        oauth_consumer_key: 'unit_qq_mobile_appid',
        openid: 'provider-qq-openid'
      });
      const exposed = JSON.stringify([response, run.records, Object.values(run.logger).flatMap((fn) => fn.mock.calls)]);
      for (const value of [qqAppBody.accessToken, 'forged-union', 'forged-profile', 'TEST_ONLY_provider_password'])
        expect(exposed).not.toContain(value);
      expect(JSON.stringify(Object.values(run.logger).flatMap((fn) => fn.mock.calls))).not.toContain(
        response.data.userId
      );
    } finally {
      run.restoreEnv();
    }
  });
  it('openid 客户端提示与 QQ 回执不一致时拒绝，不能覆盖现有身份', async () => {
    const run = await loadLoginHandler();
    qqReplies(run.fetch);
    try {
      expect((await run.handler({ body: { ...qqAppBody, openid: 'forged-openid' }, headers: {} })).code).toBe(401);
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each([undefined, '', 'has space', 'line\nbreak', 'a'.repeat(2049), 123])(
    '非法移动凭证在上游调用前拒绝',
    async (accessToken) => {
      const run = await loadLoginHandler();
      try {
        expect((await run.handler({ body: { ...qqAppBody, accessToken }, headers: {} })).code).toBe(400);
        expect(run.fetch).not.toHaveBeenCalled();
        expect(run.collection.add).not.toHaveBeenCalled();
      } finally {
        run.restoreEnv();
      }
    }
  );
  it.each([
    [{ ...qqAppBody, platform: 'unknown' }, {}, 400],
    [{ ...qqAppBody, platform: null }, {}, 400],
    [qqAppBody, { qqMobileAppId: '' }, 500],
    [qqWebBody, { qqWebSecret: '' }, 500],
    [{ ...qqWebBody, accessToken: '' }, {}, 400],
    [{ ...qqWebBody, code: 'code&token=forged' }, {}, 400],
    [{ type: 'qq', platform: 'mp-qq', code: 'isolated-mini-code' }, { qqMiniSecret: '' }, 500],
    [{ type: 'qq', platform: 'mp-qq', code: 'isolated-mini-code' }, { qqMiniAppId: '' }, 500]
  ])('未知平台、不完整配置或混用凭据不借用其他平台', async (body, config, code) => {
    const run = await loadLoginHandler(config);
    try {
      expect((await run.handler({ body, headers: {} })).code).toBe(code);
      expect(run.fetch).not.toHaveBeenCalled();
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    { status: 302, data: { client_id: 'unit_qq_mobile_appid', openid: 'provider-qq-openid' } },
    { status: 200, data: 'prefix callback({"client_id":"unit_qq_mobile_appid","openid":"provider-qq-openid"});' },
    { status: 200, data: { client_id: 'unit_qq_mobile_appid', openid: {} } },
    { status: 200, data: { client_id: 'unit_qq_mobile_appid', openid: 'provider-qq-openid', unionid: null } },
    { status: 200, data: { error: 100001, error_description: 'TEST_ONLY_private_description' } }
  ])('非成功或不明确上游回执仅返回固定提示', async (provider) => {
    const run = await loadLoginHandler();
    run.fetch.mockResolvedValueOnce(provider);
    try {
      const response = await run.handler({ body: qqAppBody, headers: {} });
      expect(response).toMatchObject({ code: 401, message: 'QQ 登录校验失败，请重新登录' });
      expect(JSON.stringify([response, Object.values(run.logger).flatMap((fn) => fn.mock.calls)])).not.toContain(
        'TEST_ONLY_private_description'
      );
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('HTTP 错误和重复 token 参数不泄露凭据，也不能取得业务会话', async () => {
    const run = await loadLoginHandler();
    try {
      run.fetch.mockRejectedValueOnce(new Error('TEST_ONLY_private_url?access_token=TEST_ONLY_private_token'));
      expect((await run.handler({ body: qqAppBody, headers: {} })).code).toBe(401);
      run.fetch.mockResolvedValueOnce({ status: 200, data: 'access_token=one&access_token=two' });
      expect((await run.handler({ body: qqWebBody, headers: {} })).code).toBe(401);
      expect(run.fetch).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(Object.values(run.logger).flatMap((fn) => fn.mock.calls))).not.toContain(
        'TEST_ONLY_private_'
      );
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    [{}, 'unit_qq_mini_appid', 'unit_qq_mini_secret+&=?'],
    [{ qqMiniAppId: '', qqMiniSecret: '' }, 'unit_qq_appid', 'unit_qq_secret+&=?']
  ])('小程序独立配置及完整旧配置兼容均按小程序身份保存', async (config, appid, secret) => {
    const run = await loadLoginHandler(config);
    run.fetch.mockResolvedValueOnce({
      status: 200,
      data: { openid: 'provider-qq-openid', session_key: 'TEST_ONLY_private_session' }
    });
    try {
      const response = await run.handler({
        body: { type: 'qq', platform: 'mp-qq', code: 'isolated-mini-code' },
        headers: {}
      });
      expect(response.code).toBe(0);
      expect(run.fetch).toHaveBeenCalledTimes(1);
      const url = new URL(run.fetch.mock.calls[0][0].url);
      expect(url.origin + url.pathname).toBe('https://api.q.qq.com/sns/jscode2session');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        appid,
        secret,
        js_code: 'isolated-mini-code',
        grant_type: 'authorization_code'
      });
      expect(run.records[0]).toMatchObject({ qq_mini_appid: appid, qq_mini_openid: 'provider-qq-openid' });
      expect(run.records[0]).not.toHaveProperty('qq_openid');
      expect(JSON.stringify([response, run.records])).not.toContain('TEST_ONLY_private_session');
    } finally {
      run.restoreEnv();
    }
  });
  it('相同 openid 的移动/小程序/网站和其他应用独立保存，缺 unionid 不写 null', async () => {
    const run = await loadLoginHandler({
      users: [
        { _id: 'other-app', qq_mobile_appid: 'other-mobile-app', qq_mobile_openid: 'provider-qq-openid', role: 'user' }
      ]
    });
    try {
      qqReplies(run.fetch);
      const mobile = await run.handler({ body: qqAppBody, headers: {} });
      qqReplies(run.fetch, { appId: 'unit_qq_appid', webToken: { access_token: qqAppBody.accessToken } });
      const web = await run.handler({ body: qqWebBody, headers: {} });
      run.fetch.mockResolvedValueOnce({ status: 200, data: { openid: 'provider-qq-openid' } });
      const mini = await run.handler({
        body: { type: 'qq', platform: 'mp-qq', code: 'isolated-mini-code' },
        headers: {}
      });
      expect(new Set([mobile.data.userId, web.data.userId, mini.data.userId, 'other-app']).size).toBe(4);
      expect(run.records.every((user) => !Object.hasOwn(user, 'qq_unionid'))).toBe(true);
      qqReplies(run.fetch);
      const repeated = await run.handler({ body: qqAppBody, headers: {} });
      expect(repeated.data.userId).toBe(mobile.data.userId);
      expect(repeated.data.isNewUser).toBe(false);
      expect(run.records).toHaveLength(4);
    } finally {
      run.restoreEnv();
    }
  });
  it('仅服务器确认的 unionid 衔接账户，自定昵称和角色保留', async () => {
    const run = await loadLoginHandler({
      users: [
        {
          _id: 'known-user',
          qq_openid: 'web-openid',
          qq_unionid: 'server-qq-union',
          nickname: '我的昵称',
          role: 'user'
        }
      ]
    });
    qqReplies(run.fetch, { unionid: 'server-qq-union' });
    try {
      const response = await run.handler({ body: { ...qqAppBody, unionid: 'forged-union' }, headers: {} });
      expect(response.data).toMatchObject({ userId: 'known-user', userInfo: { nickname: '我的昵称', role: 'user' } });
      expect(run.records[0].qq_openid).toBe('web-openid');
      expect(run.records[0].qq_mobile_openid).toBe('provider-qq-openid');
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    [
      {
        _id: 'identity',
        qq_mobile_appid: 'unit_qq_mobile_appid',
        qq_mobile_openid: 'provider-qq-openid',
        qq_unionid: 'different-union',
        role: 'user'
      }
    ],
    [
      {
        _id: 'union',
        qq_unionid: 'server-qq-union',
        qq_mobile_appid: 'unit_qq_mobile_appid',
        qq_mobile_openid: 'different-openid',
        role: 'user'
      }
    ],
    [
      {
        _id: 'identity',
        qq_mobile_appid: 'unit_qq_mobile_appid',
        qq_mobile_openid: 'provider-qq-openid',
        role: 'user'
      },
      { _id: 'union', qq_unionid: 'server-qq-union', role: 'admin' }
    ]
  ])('服务器 unionid 和已绑定身份冲突时保全所有账户', async (...users) => {
    const run = await loadLoginHandler({ users });
    const before = structuredClone(run.records);
    qqReplies(run.fetch, { unionid: 'server-qq-union' });
    try {
      expect((await run.handler({ body: qqAppBody, headers: {} })).code).toBe(409);
      expect(run.records).toEqual(before);
      expect(run.collection.add).not.toHaveBeenCalled();
      expect(run.collection.doc).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
  it('已有默认昵称更新后，实际响应也呈现已保存的服务端资料', async () => {
    const run = await loadLoginHandler({
      users: [
        {
          _id: 'known-user',
          qq_mobile_appid: 'unit_qq_mobile_appid',
          qq_mobile_openid: 'provider-qq-openid',
          nickname: '考研学子ABCD',
          role: 'user',
          avatar_url: ''
        }
      ]
    });
    qqReplies(run.fetch, { profile: { figureurl_qq_2: 'https://qlogo.example/avatar.png' } });
    try {
      const response = await run.handler({ body: qqAppBody, headers: {} });
      expect(response.data.userInfo).toMatchObject({
        nickname: 'QQ学习者',
        avatar_url: 'https://qlogo.example/avatar.png'
      });
      expect(run.records[0]).toMatchObject({ nickname: 'QQ学习者', avatar_url: 'https://qlogo.example/avatar.png' });
    } finally {
      run.restoreEnv();
    }
  });
  it.each([
    ['matching', undefined, 0],
    ['conflicting', 'different-union', 409]
  ])('并发唯一键争用后的 %s 身份回查仍核对应用和 unionid', async (_name, racedUnionid, expected) => {
    const run = await loadLoginHandler();
    qqReplies(run.fetch, { unionid: 'server-qq-union' });
    run.collection.add.mockImplementationOnce(async () => {
      run.records.push({
        _id: 'raced-user',
        qq_mobile_appid: 'unit_qq_mobile_appid',
        qq_mobile_openid: 'provider-qq-openid',
        role: 'user',
        ...(racedUnionid ? { qq_unionid: racedUnionid } : {})
      });
      throw new Error('E11000 duplicate key');
    });
    try {
      const response = await run.handler({ body: qqAppBody, headers: {} });
      expect(response.code).toBe(expected);
      expect(run.records).toHaveLength(1);
      if (expected === 0) expect(response.data.userId).toBe('raced-user');
      else expect(response).not.toHaveProperty('data.token');
    } finally {
      run.restoreEnv();
    }
  });
  it('QQ 新流程仍须通过既有登录限流', async () => {
    const run = await loadLoginHandler({ rateLimitAllowed: false });
    try {
      expect((await run.handler({ body: qqAppBody, headers: {} })).code).toBe(429);
      expect(run.fetch).not.toHaveBeenCalled();
      expect(run.collection.add).not.toHaveBeenCalled();
    } finally {
      run.restoreEnv();
    }
  });
});
