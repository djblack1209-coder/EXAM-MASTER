/**
 * loginGuard.js 单元测试
 *
 * 覆盖目标：所有导出函数的关键分支
 * - isUserLoggedIn: store 已登录 / storage 回退 / restoreUserInfo 异常
 * - getCurrentUserId / getCurrentUserInfo: 各优先级路径
 * - requireLogin: 已登录+回调 / 已登录+异步回调异常 / 未登录+modal / 未登录+toast
 * - requireLoginAsync: resolve / reject
 * - pageRequireLogin: 已登录 / 未登录+redirectBack
 * - redirectAfterLogin: 有重定向URL / 重定向失败 / 无URL
 * - loginRequired: 装饰器已登录 / 未登录
 * - checkFeaturePermissions: guest/user/vip/admin/unknown 角色
 * - watchLoginStatus: 状态变化检测 + cleanup
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ==================== Mock 依赖 ====================
const mockUserStore = {
  isLogin: false,
  userInfo: null,
  restoreUserInfo: vi.fn()
};

vi.mock('../../src/stores', () => ({
  useUserStore: vi.fn(() => mockUserStore)
}));

vi.mock('../../src/utils/safe-navigate', () => ({
  safeNavigateTo: vi.fn()
}));

vi.mock('../../src/services/storageService.js', () => ({
  storageService: {
    get: vi.fn(),
    save: vi.fn(),
    remove: vi.fn()
  },
  getUserId: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { safeNavigateTo } from '../../src/utils/safe-navigate';
import { storageService, getUserId } from '../../src/services/storageService.js';
import { logger } from '../../src/utils/logger.js';

// 全局 uni mock
const mockShowModal = vi.fn();
const mockShowToast = vi.fn();
const mockRedirectTo = vi.fn();
const mockSwitchTab = vi.fn();

globalThis.uni = {
  showModal: mockShowModal,
  showToast: mockShowToast,
  hideToast: vi.fn(),
  redirectTo: mockRedirectTo,
  switchTab: mockSwitchTab
};

// getCurrentPages mock
globalThis.getCurrentPages = vi.fn(() => []);

let mod;

beforeEach(async () => {
  vi.clearAllMocks();

  // 重置 store 状态
  mockUserStore.isLogin = false;
  mockUserStore.userInfo = null;
  mockUserStore.restoreUserInfo.mockReset();

  getUserId.mockReturnValue(null);
  storageService.get.mockReturnValue(null);

  // 动态导入（必须在 useFakeTimers 之前，否则 ESM 导入会在假定时器环境下超时）
  mod = await import('../../src/utils/auth/loginGuard.js');

  // 只 fake 定时器核心函数和 Date，排除 requestAnimationFrame/performance，避免 happy-dom 冲突
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ==================== isUserLoggedIn ====================
describe('isUserLoggedIn', () => {
  it('store 已登录 + 有 userInfo → true', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };

    expect(mod.isUserLoggedIn()).toBe(true);
  });

  it('store 未登录但 storage 有 userId → 触发 restoreUserInfo 并返回 true', () => {
    mockUserStore.isLogin = false;
    getUserId.mockReturnValue('cached_uid');
    // restoreUserInfo 成功后 isLogin 仍为 false，但 cachedUserId 存在
    expect(mod.isUserLoggedIn()).toBe(true);
    expect(mockUserStore.restoreUserInfo).toHaveBeenCalled();
  });

  it('store 未登录 + restoreUserInfo 抛异常 → 仍返回 true（因为 cachedUserId 存在）', () => {
    mockUserStore.isLogin = false;
    getUserId.mockReturnValue('cached_uid');
    mockUserStore.restoreUserInfo.mockImplementation(() => {
      throw new Error('restore failed');
    });

    expect(mod.isUserLoggedIn()).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('store 未登录 + 无 cachedUserId → false', () => {
    mockUserStore.isLogin = false;
    getUserId.mockReturnValue(null);

    expect(mod.isUserLoggedIn()).toBe(false);
  });

  it('store.isLogin=true 但 userInfo=null → 走 storage 回退', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = null;
    getUserId.mockReturnValue(null);

    expect(mod.isUserLoggedIn()).toBe(false);
  });
});

// ==================== getCurrentUserId ====================
describe('getCurrentUserId', () => {
  it('优先返回 userInfo._id', () => {
    mockUserStore.userInfo = { _id: 'uid_from_id' };
    expect(mod.getCurrentUserId()).toBe('uid_from_id');
  });

  it('_id 不存在时返回 userInfo.userId', () => {
    mockUserStore.userInfo = { userId: 'uid_from_userId' };
    expect(mod.getCurrentUserId()).toBe('uid_from_userId');
  });

  it('userInfo 无 id 时回退到 getUserId()', () => {
    mockUserStore.userInfo = {};
    getUserId.mockReturnValue('storage_uid');
    expect(mod.getCurrentUserId()).toBe('storage_uid');
  });

  it('全部为空 → null', () => {
    mockUserStore.userInfo = null;
    getUserId.mockReturnValue(null);
    expect(mod.getCurrentUserId()).toBeNull();
  });
});

// ==================== getCurrentUserInfo ====================
describe('getCurrentUserInfo', () => {
  it('优先返回 store.userInfo', () => {
    const info = { _id: 'u1', name: 'test' };
    mockUserStore.userInfo = info;
    expect(mod.getCurrentUserInfo()).toBe(info);
  });

  it('store 无 userInfo 时回退到 storageService', () => {
    mockUserStore.userInfo = null;
    const cached = { _id: 'u2', name: 'cached' };
    storageService.get.mockReturnValue(cached);
    expect(mod.getCurrentUserInfo()).toBe(cached);
    expect(storageService.get).toHaveBeenCalledWith('userInfo', null);
  });
});

// ==================== requireLogin ====================
describe('requireLogin', () => {
  it('已登录 + 同步回调 → 执行回调并返回 true', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    const cb = vi.fn();

    expect(mod.requireLogin(cb)).toBe(true);
    expect(cb).toHaveBeenCalled();
  });

  it('已登录 + 回调抛同步异常 → 捕获并返回 true', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    const cb = vi.fn(() => {
      throw new Error('sync boom');
    });

    expect(mod.requireLogin(cb)).toBe(true);
    expect(logger.error).toHaveBeenCalled();
  });

  it('已登录 + 回调返回 rejected Promise → 捕获异步异常', async () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    const rejectedPromise = Promise.reject(new Error('async boom'));
    const cb = vi.fn(() => rejectedPromise);

    expect(mod.requireLogin(cb)).toBe(true);
    // 等待微任务处理 catch
    await vi.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it('已登录 + 无回调 → 返回 true 不报错', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };

    expect(mod.requireLogin(null)).toBe(true);
    expect(mod.requireLogin(undefined)).toBe(true);
  });

  it('未登录 + useModal=true → 显示 modal 并返回 false', () => {
    expect(mod.requireLogin(vi.fn(), { useModal: true })).toBe(false);
    expect(mockShowModal).toHaveBeenCalled();
  });

  it('未登录 + modal 确认 → 保存重定向路径并导航到登录页', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/practice/index', options: { id: '123' } }]);

    mod.requireLogin(vi.fn());

    // 模拟 modal success 回调
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(storageService.save).toHaveBeenCalledWith('redirect_after_login', '/pages/practice/index?id=123');
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/login/index');
  });

  it('未登录 + modal 取消 → 不导航', () => {
    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: false });

    expect(safeNavigateTo).not.toHaveBeenCalled();
  });

  it('未登录 + useModal=false + showToast=true → toast + 延迟导航', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/index/index', options: {} }]);

    expect(mod.requireLogin(vi.fn(), { useModal: false, showToast: true })).toBe(false);
    expect(mockShowToast).toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/login/index');
  });

  it('未登录 + 自定义 loginUrl 和 message', () => {
    mod.requireLogin(vi.fn(), {
      loginUrl: '/pages/custom-login/index',
      message: '自定义提示',
      useModal: false,
      showToast: true
    });

    expect(mockShowToast.mock.calls[0][0].title).toBe('自定义提示');
    vi.advanceTimersByTime(1500);
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/custom-login/index');
  });
});

// ==================== buildCurrentPageFullPath (间接测试) ====================
describe('buildCurrentPageFullPath (通过 requireLogin 间接测试)', () => {
  it('page 为 null → 不保存重定向路径', () => {
    globalThis.getCurrentPages = vi.fn(() => [null]);

    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(storageService.save).not.toHaveBeenCalled();
  });

  it('page 无 route → 不保存重定向路径', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ options: {} }]);

    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(storageService.save).not.toHaveBeenCalled();
  });

  it('page 无 options → 路径不带查询参数', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/home/index' }]);

    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(storageService.save).toHaveBeenCalledWith('redirect_after_login', '/pages/home/index');
  });

  it('getCurrentPages 为空数组 → 不保存', () => {
    globalThis.getCurrentPages = vi.fn(() => []);

    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(storageService.save).not.toHaveBeenCalled();
  });

  it('getCurrentPages 抛异常 → 静默处理', () => {
    globalThis.getCurrentPages = vi.fn(() => {
      throw new Error('no pages');
    });

    mod.requireLogin(vi.fn());
    const modalCall = mockShowModal.mock.calls[0][0];
    modalCall.success({ confirm: true });

    expect(logger.error).toHaveBeenCalled();
    expect(storageService.save).not.toHaveBeenCalled();
  });
});

// ==================== requireLoginAsync ====================
describe('requireLoginAsync', () => {
  it('已登录 → resolve(true)', async () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };

    await expect(mod.requireLoginAsync()).resolves.toBe(true);
  });

  it('未登录 → reject', async () => {
    await expect(mod.requireLoginAsync()).rejects.toThrow('用户未登录');
  });
});

// ==================== pageRequireLogin ====================
describe('pageRequireLogin', () => {
  it('已登录 → 返回 true，不显示 toast', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };

    expect(mod.pageRequireLogin({})).toBe(true);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('未登录 + showToast=true → 显示 toast + 延迟导航', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/practice/index', options: { mode: 'exam' } }]);

    expect(mod.pageRequireLogin({}, { showToast: true })).toBe(false);
    expect(mockShowToast).toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/login/index');
    expect(storageService.save).toHaveBeenCalledWith('redirect_after_login', '/pages/practice/index?mode=exam');
  });

  it('未登录 + showToast=false → 立即导航', () => {
    expect(mod.pageRequireLogin({}, { showToast: false })).toBe(false);
    vi.advanceTimersByTime(0);
    expect(safeNavigateTo).toHaveBeenCalled();
  });

  it('未登录 + redirectBack=false → 不保存重定向路径', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/test/index', options: {} }]);

    mod.pageRequireLogin({}, { redirectBack: false, showToast: false });
    expect(storageService.save).not.toHaveBeenCalled();
  });
});

// ==================== redirectAfterLogin ====================
describe('redirectAfterLogin', () => {
  it('有重定向 URL → 清除记录并跳转', () => {
    storageService.get.mockReturnValue('/pages/practice/index?id=1');

    mod.redirectAfterLogin();

    expect(storageService.remove).toHaveBeenCalledWith('redirect_after_login');
    expect(mockRedirectTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/practice/index?id=1' }));
  });

  it('重定向失败 → switchTab 到首页', () => {
    storageService.get.mockReturnValue('/pages/practice/index');
    mockRedirectTo.mockImplementation((opts) => opts.fail({ errMsg: 'fail' }));

    mod.redirectAfterLogin();

    expect(mockSwitchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
  });

  it('无重定向 URL → switchTab 到首页', () => {
    storageService.get.mockReturnValue(null);

    mod.redirectAfterLogin();

    expect(mockSwitchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
    expect(mockRedirectTo).not.toHaveBeenCalled();
  });
});

// ==================== loginRequired 装饰器 ====================
describe('loginRequired', () => {
  it('已登录 → 执行原始方法', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };

    const original = vi.fn(() => 'result');
    const descriptor = { value: original };
    const decorated = mod.loginRequired('请登录')(null, 'method', descriptor);

    const result = decorated.value.call({}, 'arg1');
    expect(original).toHaveBeenCalledWith('arg1');
    expect(result).toBe('result');
  });

  it('未登录 → 显示 toast + 延迟导航 + 返回 false', () => {
    const original = vi.fn();
    const descriptor = { value: original };
    const decorated = mod.loginRequired('自定义消息')(null, 'method', descriptor);

    const result = decorated.value.call({});
    expect(result).toBe(false);
    expect(original).not.toHaveBeenCalled();
    expect(mockShowToast.mock.calls[0][0].title).toBe('自定义消息');

    vi.advanceTimersByTime(1500);
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/login/index');
  });
});

// ==================== checkFeaturePermissions ====================
describe('checkFeaturePermissions', () => {
  it('未登录 → 仅 guest 功能可用', () => {
    const perms = mod.checkFeaturePermissions(['view_questions', 'practice', 'ai_chat']);
    expect(perms.view_questions).toBe(true);
    expect(perms.practice).toBe(false);
    expect(perms.ai_chat).toBe(false);
  });

  it('user 角色 → user 级别功能可用', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1', role: 'user' };
    getUserId.mockReturnValue('u1');

    const perms = mod.checkFeaturePermissions(['view_questions', 'practice', 'ai_chat', 'ai_photo_search']);
    expect(perms.view_questions).toBe(true);
    expect(perms.practice).toBe(true);
    expect(perms.ai_chat).toBe(true);
    expect(perms.ai_photo_search).toBe(false);
  });

  it('vip 角色 → vip 级别功能可用', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1', role: 'vip' };
    getUserId.mockReturnValue('u1');

    const perms = mod.checkFeaturePermissions(['ai_photo_search', 'trend_predict']);
    expect(perms.ai_photo_search).toBe(true);
    expect(perms.trend_predict).toBe(true);
  });

  it('admin 角色 → 所有功能可用（通配符 *）', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'admin1', role: 'admin' };
    getUserId.mockReturnValue('admin1');

    const perms = mod.checkFeaturePermissions(['view_questions', 'ai_photo_search', 'any_feature']);
    expect(perms.view_questions).toBe(true);
    expect(perms.ai_photo_search).toBe(true);
    expect(perms.any_feature).toBe(true);
  });

  it('未知角色 → 回退到 guest 权限', () => {
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1', role: 'unknown_role' };
    getUserId.mockReturnValue('u1');

    const perms = mod.checkFeaturePermissions(['view_questions', 'practice']);
    expect(perms.view_questions).toBe(true);
    expect(perms.practice).toBe(false);
  });

  it('空 features 数组 → 返回空对象', () => {
    expect(mod.checkFeaturePermissions([])).toEqual({});
  });
});

// ==================== watchLoginStatus ====================
describe('watchLoginStatus', () => {
  it('状态变化时调用 callback', () => {
    const cb = vi.fn();
    const cleanup = mod.watchLoginStatus(cb);

    // 初始未登录，推进 5 秒
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled(); // 状态未变

    // 模拟登录
    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledWith(true);

    // 模拟登出
    mockUserStore.isLogin = false;
    mockUserStore.userInfo = null;
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledWith(false);

    cleanup();
  });

  it('cleanup 后不再触发 callback', () => {
    const cb = vi.fn();
    const cleanup = mod.watchLoginStatus(cb);
    cleanup();

    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    vi.advanceTimersByTime(10000);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ==================== silentLoginCheck ====================
describe('silentLoginCheck', () => {
  it('等同于 isUserLoggedIn', () => {
    expect(mod.silentLoginCheck()).toBe(false);

    mockUserStore.isLogin = true;
    mockUserStore.userInfo = { _id: 'u1' };
    expect(mod.silentLoginCheck()).toBe(true);
  });
});
