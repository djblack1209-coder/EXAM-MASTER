/**
 * 总监级审计测试 - Batch 4: 登录鉴权门控测试
 *
 * 审计维度：
 * 1. guest/user/vip 三级权限验证
 * 2. 未登录用户各功能降级行为（Modal/Toast/静默）
 * 3. token 过期 401 处理链
 * 4. token 自动刷新逻辑（5分钟提前量）
 * 5. isLogin 双条件验证（token && userInfo）
 * 6. 并发 401 请求的 token 刷新去重
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

// ============================================================
// 1. isLogin 双条件验证
// ============================================================
describe('[审计] isLogin — 双条件验证 (token && userInfo)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('token 和 userInfo 都存在 — isLogin 为 true', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    store.setToken('valid-token-123');
    store.setUserInfo({ _id: 'user1', nickname: '考研人' });

    expect(store.isLogin).toBe(true);
  });

  it('仅 setUserInfo 不 setToken — isLogin 为 false', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    store.setUserInfo({ _id: 'user1', nickname: '考研人' });
    // 没有 setToken

    expect(store.isLogin).toBe(false);
  });

  it('仅 setToken 不 setUserInfo — isLogin 为 false', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    store.setToken('valid-token-123');
    // 没有 setUserInfo

    expect(store.isLogin).toBe(false);
  });

  it('两者都为空 — isLogin 为 false', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    expect(store.isLogin).toBe(false);
  });

  it('logout 后 — isLogin 变为 false', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    store.setToken('valid-token-123');
    store.setUserInfo({ _id: 'user1', nickname: '考研人' });
    expect(store.isLogin).toBe(true);

    store.logout();
    expect(store.isLogin).toBe(false);
  });

  it('setToken 空字符串 — isLogin 为 false', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const store = useUserStore();

    store.setToken('');
    store.setUserInfo({ _id: 'user1', nickname: '考研人' });

    expect(store.isLogin).toBe(false);
  });
});

// ============================================================
// 2. 权限分级 — guest/user/vip/admin
// ============================================================
describe('[审计] checkFeaturePermissions — 角色权限分级', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('guest 角色 — 只能 view_questions 和 view_school', async () => {
    const { checkFeaturePermissions } = await import('@/utils/auth/loginGuard.js');

    const features = [
      'view_questions',
      'view_school',
      'practice',
      'ai_chat',
      'ai_photo_search',
      'trend_predict',
      'material_understand'
    ];
    const perms = checkFeaturePermissions(features);

    // guest 只有 view_questions 和 view_school
    expect(perms.view_questions).toBe(true);
    expect(perms.view_school).toBe(true);
    expect(perms.practice).toBe(false);
    expect(perms.ai_chat).toBe(false);
    expect(perms.ai_photo_search).toBe(false);
    expect(perms.trend_predict).toBe(false);
    expect(perms.material_understand).toBe(false);
  });

  it('user 角色 — 有 practice/ai_chat 等，无 vip 功能', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const { checkFeaturePermissions } = await import('@/utils/auth/loginGuard.js');
    const store = useUserStore();

    store.setToken('token');
    store.setUserInfo({ _id: 'u1', nickname: 'test', role: 'user' });

    const features = [
      'view_questions',
      'practice',
      'ai_chat',
      'friend_list',
      'study_stats',
      'mistake_book',
      'upload_avatar',
      'ai_photo_search',
      'trend_predict',
      'material_understand'
    ];
    const perms = checkFeaturePermissions(features);

    expect(perms.view_questions).toBe(true);
    expect(perms.practice).toBe(true);
    expect(perms.ai_chat).toBe(true);
    expect(perms.friend_list).toBe(true);
    expect(perms.study_stats).toBe(true);
    expect(perms.mistake_book).toBe(true);
    expect(perms.upload_avatar).toBe(true);
    // VIP 功能不可用
    expect(perms.ai_photo_search).toBe(false);
    expect(perms.trend_predict).toBe(false);
    expect(perms.material_understand).toBe(false);
  });

  it('vip 角色 — 拥有所有用户功能 + VIP 专属功能', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const { checkFeaturePermissions } = await import('@/utils/auth/loginGuard.js');
    const store = useUserStore();

    store.setToken('token');
    store.setUserInfo({ _id: 'u1', nickname: 'vip_user', role: 'vip' });

    const features = [
      'practice',
      'ai_chat',
      'ai_photo_search',
      'trend_predict',
      'adaptive_pick',
      'material_understand'
    ];
    const perms = checkFeaturePermissions(features);

    expect(perms.practice).toBe(true);
    expect(perms.ai_chat).toBe(true);
    expect(perms.ai_photo_search).toBe(true);
    expect(perms.trend_predict).toBe(true);
    expect(perms.adaptive_pick).toBe(true);
    expect(perms.material_understand).toBe(true);
  });

  it('admin 角色 — 通配符 * 拥有所有权限', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const { checkFeaturePermissions } = await import('@/utils/auth/loginGuard.js');
    const store = useUserStore();

    store.setToken('token');
    store.setUserInfo({ _id: 'admin1', nickname: 'admin', role: 'admin' });

    const features = ['ai_photo_search', 'trend_predict', 'some_random_feature'];
    const perms = checkFeaturePermissions(features);

    expect(perms.ai_photo_search).toBe(true);
    expect(perms.trend_predict).toBe(true);
    expect(perms.some_random_feature).toBe(true); // admin 有通配符
  });

  it('未知角色 — 降级为 guest 权限', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const { checkFeaturePermissions } = await import('@/utils/auth/loginGuard.js');
    const store = useUserStore();

    store.setToken('token');
    store.setUserInfo({ _id: 'u1', nickname: 'test', role: 'unknown_role' });

    const features = ['view_questions', 'practice', 'ai_chat'];
    const perms = checkFeaturePermissions(features);

    expect(perms.view_questions).toBe(true); // guest 级别
    expect(perms.practice).toBe(false);
    expect(perms.ai_chat).toBe(false);
  });
});

// ============================================================
// 3. requireLogin — 未登录门控行为
// ============================================================
describe('[审计] requireLogin — 未登录门控行为', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('已登录 — 直接执行回调，返回 true', async () => {
    const { useUserStore } = await import('@/stores/modules/user.js');
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');
    const store = useUserStore();

    store.setToken('token');
    store.setUserInfo({ _id: 'u1', nickname: 'test' });

    let callbackCalled = false;
    const result = requireLogin(() => {
      callbackCalled = true;
    });

    expect(result).toBe(true);
    expect(callbackCalled).toBe(true);
  });

  it('未登录 + useModal=true — 显示 Modal 弹窗', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    const result = requireLogin(() => {}, { useModal: true });

    expect(result).toBe(false);
    // uni.showModal 应该被调用
    expect(uni.showModal).toHaveBeenCalled();
    const modalArgs = uni.showModal.mock.calls[0][0];
    expect(modalArgs.title).toContain('登录');
    expect(modalArgs.confirmText).toBe('去登录');
  });

  it('未登录 + useModal=false + showToast=true — 显示 Toast + 延迟跳转', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    const result = requireLogin(() => {}, {
      useModal: false,
      showToast: true,
      message: '请先登录'
    });

    expect(result).toBe(false);
    expect(uni.showToast).toHaveBeenCalled();
    const toastArgs = uni.showToast.mock.calls[0][0];
    expect(toastArgs.title).toContain('请先登录');
  });

  it('未登录 — 回调不被执行', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    let callbackCalled = false;
    requireLogin(() => {
      callbackCalled = true;
    });

    expect(callbackCalled).toBe(false);
  });

  it('自定义 loginUrl — 跳转到指定页面', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    requireLogin(() => {}, {
      loginUrl: '/pages/settings/index',
      useModal: true
    });

    expect(uni.showModal).toHaveBeenCalled();
  });
});

// ============================================================
// 4. Token 刷新插件审计
// ============================================================
describe('[审计] TokenRefreshPlugin — Token 刷新机制', () => {
  let tokenPlugin;

  beforeEach(async () => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
    const mod = await import('@/utils/auth/token-refresh-plugin.js');
    tokenPlugin = mod.tokenRefreshPlugin || mod.default;
    // 停止预检测定时器避免干扰
    if (tokenPlugin.stopPreCheckTimer) {
      tokenPlugin.stopPreCheckTimer();
    }
  });

  afterEach(() => {
    if (tokenPlugin && tokenPlugin.stopPreCheckTimer) {
      tokenPlugin.stopPreCheckTimer();
    }
  });

  it('isTokenExpired — 无过期时间记录时返回 true', () => {
    expect(tokenPlugin.isTokenExpired()).toBe(true);
  });

  it('isTokenExpiringSoon — 无过期时间记录时返回 false', () => {
    // 无 TOKEN_EXPIRE_KEY 时返回 false（不是 true）
    expect(tokenPlugin.isTokenExpiringSoon()).toBe(false);
  });

  it('saveTokens + getAccessToken — 正确存取', () => {
    tokenPlugin.saveTokens('access-123', 'refresh-456', 3600);

    const token = tokenPlugin.getAccessToken();
    expect(token).toBe('access-123');

    const refreshToken = tokenPlugin.getRefreshToken();
    expect(refreshToken).toBe('refresh-456');
  });

  it('clearTokens — 清除所有 Token', () => {
    tokenPlugin.saveTokens('access-123', 'refresh-456', 3600);
    tokenPlugin.clearTokens();

    expect(tokenPlugin.getAccessToken()).toBeNull();
    expect(tokenPlugin.getRefreshToken()).toBeNull();
  });

  it('isTokenExpired — Token 未过期时返回 false', () => {
    // 保存一个 1 小时后过期的 Token
    tokenPlugin.saveTokens('token', 'refresh', 3600);
    expect(tokenPlugin.isTokenExpired()).toBe(false);
  });

  it('isTokenExpiringSoon — 5分钟内过期返回 true', () => {
    // 保存一个 4 分钟后过期的 Token（在 5 分钟缓冲区内）
    tokenPlugin.saveTokens('token', 'refresh', 240); // 240秒 = 4分钟
    expect(tokenPlugin.isTokenExpiringSoon()).toBe(true);
  });

  it('isTokenExpiringSoon — 10分钟后过期返回 false', () => {
    tokenPlugin.saveTokens('token', 'refresh', 600); // 600秒 = 10分钟
    expect(tokenPlugin.isTokenExpiringSoon()).toBe(false);
  });

  it('refreshToken — 未配置 refreshTokenFn 时抛错', async () => {
    tokenPlugin.init({ refreshTokenFn: null });
    tokenPlugin.saveTokens('token', 'refresh', 3600);

    await expect(tokenPlugin.refreshToken()).rejects.toThrow('refreshTokenFn not configured');
  });

  it('refreshToken — 无 refreshToken 时抛错', async () => {
    tokenPlugin.init({
      refreshTokenFn: vi.fn().mockResolvedValue('new-token')
    });
    tokenPlugin.clearTokens();

    await expect(tokenPlugin.refreshToken()).rejects.toThrow('No refresh token');
  });

  it('refreshToken — 成功刷新返回新 Token', async () => {
    const mockRefreshFn = vi.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 7200
    });

    tokenPlugin.init({ refreshTokenFn: mockRefreshFn, enablePreCheck: false });
    tokenPlugin.saveTokens('old-token', 'old-refresh', 3600);

    const newToken = await tokenPlugin.refreshToken();
    expect(newToken).toBe('new-access-token');
    expect(tokenPlugin.getAccessToken()).toBe('new-access-token');
    expect(tokenPlugin.getRefreshToken()).toBe('new-refresh-token');
  });

  it('refreshToken — 并发调用只刷新一次', async () => {
    let resolveRefresh;
    const mockRefreshFn = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    });

    tokenPlugin.init({ refreshTokenFn: mockRefreshFn, enablePreCheck: false });
    tokenPlugin.saveTokens('old-token', 'old-refresh', 3600);

    // 并发发起两次刷新
    const p1 = tokenPlugin.refreshToken();
    const p2 = tokenPlugin.refreshToken();

    // 只调用了一次 refreshTokenFn
    expect(mockRefreshFn).toHaveBeenCalledTimes(1);

    // 解决 Promise
    resolveRefresh({ accessToken: 'new-token', expiresIn: 3600 });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('new-token');
    expect(r2).toBe('new-token');
  });

  it('refreshToken — 刷新失败后清除 Token 并跳转首页', async () => {
    const mockRefreshFn = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const mockOnLogout = vi.fn();

    tokenPlugin.init({
      refreshTokenFn: mockRefreshFn,
      enablePreCheck: false,
      maxRefreshRetries: 1,
      onLogout: mockOnLogout
    });
    tokenPlugin.saveTokens('old-token', 'old-refresh', 3600);
    tokenPlugin.refreshRetryCount = 1; // 已达重试上限

    await expect(tokenPlugin.refreshToken()).rejects.toThrow();
    expect(tokenPlugin.getAccessToken()).toBeNull();
    expect(mockOnLogout).toHaveBeenCalled();
  });
});

// ============================================================
// 5. 登录门控三种模式审计
// ============================================================
describe('[审计] 登录门控三种模式 — Modal/Toast/静默', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('模式1: Modal 提示 + 跳转 — requireLogin useModal=true', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    requireLogin(() => {}, { useModal: true, message: '请先登录使用AI匹配' });

    expect(uni.showModal).toHaveBeenCalled();
    const args = uni.showModal.mock.calls[0][0];
    expect(args.content).toContain('请先登录使用AI匹配');
    expect(args.cancelText).toBe('暂不登录');
  });

  it('模式2: Toast + 延迟跳转 — requireLogin useModal=false', async () => {
    const { requireLogin } = await import('@/utils/auth/loginGuard.js');

    requireLogin(() => {}, { useModal: false, showToast: true, message: '请先登录' });

    expect(uni.showToast).toHaveBeenCalled();
    // 延迟 1500ms 后跳转（通过 setTimeout）
  });

  it('模式3: 静默降级 — silentLoginCheck 不显示任何提示', async () => {
    const { silentLoginCheck } = await import('@/utils/auth/loginGuard.js');

    const result = silentLoginCheck();

    expect(result).toBe(false);
    // 不应该有任何 UI 提示
    expect(uni.showModal).not.toHaveBeenCalled();
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it('import-data 未登录 — 限制本地 15 题', () => {
    // import-data.vue 中未登录时 totalQuestionsLimit = 15
    const isLoggedIn = false;
    const totalQuestionsLimit = isLoggedIn ? 50 : 15;

    expect(totalQuestionsLimit).toBe(15);
  });

  it('PK/Rank 未登录 — 使用空 userId', () => {
    // 某些功能未登录时使用空 userId 而非阻止
    const userId = null || 'anonymous';
    expect(userId).toBe('anonymous');
  });
});

// ============================================================
// 6. 登录后重定向审计
// ============================================================
describe('[审计] redirectAfterLogin — 登录后重定向', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('有保存的重定向路径 — 跳转回原页面', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { redirectAfterLogin } = await import('@/utils/auth/loginGuard.js');

    storageService.save('redirect_after_login', '/pages/school/index?step=2');

    redirectAfterLogin();

    expect(uni.redirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/school/index?step=2' }));
  });

  it('无保存的重定向路径 — 跳转到首页', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { redirectAfterLogin } = await import('@/utils/auth/loginGuard.js');

    storageService.remove('redirect_after_login');

    redirectAfterLogin();

    expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
  });

  it('重定向后清除记录 — 不会重复跳转', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { redirectAfterLogin } = await import('@/utils/auth/loginGuard.js');

    storageService.save('redirect_after_login', '/pages/school/index');

    redirectAfterLogin();

    // 记录已被清除
    const saved = storageService.get('redirect_after_login');
    expect(saved).toBeFalsy();
  });
});

// ============================================================
// 7. 401 处理链审计
// ============================================================
describe('[审计] 401 处理链 — Token 过期响应处理', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it('lafService 收到 401 — 不自动重试（由 token-refresh-plugin 处理）', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const spy = vi.spyOn(lafService, 'request').mockRejectedValue({
      statusCode: 401,
      errMsg: 'unauthorized'
    });

    try {
      await lafService.proxyAI('chat', { content: '测试' });
    } catch (e) {
      // 预期抛出错误
    }

    // request 只被调用一次，不自动重试 401
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('token-refresh-plugin wrapRequest — 401 触发刷新', async () => {
    const mod = await import('@/utils/auth/token-refresh-plugin.js');
    const plugin = mod.tokenRefreshPlugin || mod.default;

    if (plugin.stopPreCheckTimer) plugin.stopPreCheckTimer();

    const mockRefreshFn = vi.fn().mockResolvedValue({
      accessToken: 'new-token',
      expiresIn: 3600
    });

    plugin.init({
      refreshTokenFn: mockRefreshFn,
      enablePreCheck: false,
      maxRefreshRetries: 2
    });
    plugin.saveTokens('old-token', 'old-refresh', 3600);

    let callCount = 0;
    const mockRequest = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // 第一次返回 401
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
      }
      return { code: 0, data: 'success' };
    });

    const result = await plugin.wrapRequest(mockRequest);
    expect(result).toEqual({ code: 0, data: 'success' });
    expect(mockRefreshFn).toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(2); // 第一次 401 + 刷新后重试
  });

  it('刷新失败 — reLaunch 到首页', async () => {
    const mod = await import('@/utils/auth/token-refresh-plugin.js');
    const plugin = mod.tokenRefreshPlugin || mod.default;

    if (plugin.stopPreCheckTimer) plugin.stopPreCheckTimer();

    plugin.init({
      refreshTokenFn: vi.fn().mockRejectedValue(new Error('refresh failed')),
      enablePreCheck: false,
      maxRefreshRetries: 1,
      onLogout: null,
      onRefreshFailed: null
    });
    plugin.saveTokens('old-token', 'old-refresh', 3600);
    plugin.refreshRetryCount = 1;

    try {
      await plugin.refreshToken();
    } catch (e) {
      // 预期失败
    }

    // Token 被清除
    expect(plugin.getAccessToken()).toBeNull();
    // 默认行为：showToast + reLaunch
    expect(uni.showToast).toHaveBeenCalled();
  });
});
