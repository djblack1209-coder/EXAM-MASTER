/**
 * 全链路测试 1: 启动 -> 登录 -> 首页流程
 * 模拟真机从冷启动到进入首页的完整数据流
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock 依赖模块（必须在 import store 之前）
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: 启动 -> 登录 -> 首页', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    global.__mockStorage = {};
    vi.clearAllMocks();

    // 重置 store 的"只注册一次"标志位（使事件处理器在新的 pinia 实例上重新注册）
    delete global.uni.__profileStoreLogoutBound__;
    delete global.uni.__profileStoreRestoreBound__;
    delete global.uni.__profileStoreUserdataBound__;
    delete global.uni.__userStoreLogoutBound__;

    // 让 uni 事件总线实际工作（store 内部依赖 $emit/$on 通信）
    const eventBus = {};
    global.uni.$on = vi.fn((event, handler) => {
      if (!eventBus[event]) eventBus[event] = [];
      eventBus[event].push(handler);
    });
    global.uni.$emit = vi.fn((event, ...args) => {
      (eventBus[event] || []).forEach((fn) => fn(...args));
    });
    global.uni.$off = vi.fn((event, handler) => {
      if (eventBus[event]) {
        eventBus[event] = handler ? eventBus[event].filter((fn) => fn !== handler) : [];
      }
    });
    global.uni.$once = vi.fn((event, handler) => {
      const wrapper = (...args) => {
        handler(...args);
        global.uni.$off(event, wrapper);
      };
      global.uni.$on(event, wrapper);
    });
    global.uni.$emit = vi.fn((event, ...args) => {
      (eventBus[event] || []).forEach((fn) => fn(...args));
    });
    global.uni.$off = vi.fn((event, handler) => {
      if (eventBus[event]) {
        eventBus[event] = handler ? eventBus[event].filter((fn) => fn !== handler) : [];
      }
    });
    global.uni.$once = vi.fn((event, handler) => {
      const wrapper = (...args) => {
        handler(...args);
        global.uni.$off(event, wrapper);
      };
      global.uni.$on(event, wrapper);
    });

    // Mock uni.login
    global.uni.login = vi.fn(({ success }) => {
      success?.({ code: 'mock_wx_code_123' });
    });
    // Mock uni.getNetworkType
    global.uni.getNetworkType = vi.fn(({ success }) => {
      success?.({ networkType: 'wifi' });
    });
    // Mock uni.onNetworkStatusChange
    global.uni.onNetworkStatusChange = vi.fn();
    // Mock uni.getWindowInfo / uni.getDeviceInfo / uni.getAppBaseInfo
    global.uni.getWindowInfo = vi.fn(() => ({ windowWidth: 375, windowHeight: 812 }));
    global.uni.getDeviceInfo = vi.fn(() => ({ platform: 'ios', model: 'iPhone 12' }));
    global.uni.getAppBaseInfo = vi.fn(() => ({ appVersion: '1.0.0' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phase 1: 冷启动初始化', () => {
    it('AppStore 初始化系统信息', async () => {
      const { useAppStore } = await import('@/stores/modules/app.js');
      const appStore = useAppStore();

      expect(appStore.systemInfo).toBeNull();
      expect(appStore.networkType).toBe('unknown');

      appStore.initAppInfo();

      expect(appStore.systemInfo).toBeTruthy();
      expect(uni.getNetworkType).toHaveBeenCalled();
    });

    it('AppStore 网络状态变化监听', async () => {
      const { useAppStore } = await import('@/stores/modules/app.js');
      const appStore = useAppStore();

      appStore.setNetworkType('wifi');
      expect(appStore.networkType).toBe('wifi');

      appStore.setNetworkType('none');
      expect(appStore.networkType).toBe('none');
    });

    it('AppStore loading 状态管理', async () => {
      const { useAppStore } = await import('@/stores/modules/app.js');
      const appStore = useAppStore();

      expect(appStore.isLoading).toBe(false);
      appStore.setLoading(true);
      expect(appStore.isLoading).toBe(true);
      appStore.setLoading(false);
      expect(appStore.isLoading).toBe(false);
    });
  });

  describe('Phase 2: 用户认证流程', () => {
    it('首次启动 - 无缓存 - 需要登录', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      expect(userStore.isLogin).toBe(false);
      expect(userStore.userInfo).toBeNull();
      expect(userStore.token).toBe('');
    });

    it('restoreUserInfo - 从缓存恢复用户信息', async () => {
      // 预设缓存数据
      global.__mockStorage = {
        _enc_EXAM_TOKEN: '',
        EXAM_TOKEN: 'cached_token_abc',
        _enc_EXAM_USER_INFO: '',
        EXAM_USER_INFO: { _id: 'user_001', nickname: '考研人' },
        _enc_EXAM_USER_ID: '',
        EXAM_USER_ID: 'user_001'
      };

      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      userStore.restoreUserInfo();

      expect(userStore.token).toBe('cached_token_abc');
      expect(userStore.userInfo).toBeTruthy();
      expect(userStore.userInfo._id).toBe('user_001');
      expect(userStore.isLogin).toBe(true);
    });

    it('restoreUserInfo - 仅有 userId 也能恢复基本信息', async () => {
      global.__mockStorage = {
        _enc_EXAM_USER_ID: '',
        EXAM_USER_ID: 'user_002'
      };

      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      userStore.restoreUserInfo();

      expect(userStore.userInfo).toBeTruthy();
      expect(userStore.userInfo.userId).toBe('user_002');
    });

    it('setToken + setUserInfo 联动更新登录状态', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      expect(userStore.isLogin).toBe(false);

      userStore.setToken('new_token');
      // 只有 token 没有 userInfo，仍然不算登录
      expect(userStore.isLogin).toBe(false);

      userStore.setUserInfo({ _id: 'user_003', nickname: '学霸' });
      expect(userStore.isLogin).toBe(true);
    });

    it('logout 清除所有认证状态', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      // 先登录
      userStore.setToken('token_to_clear');
      userStore.setUserInfo({ _id: 'user_004' });
      expect(userStore.isLogin).toBe(true);

      // 登出
      userStore.logout();
      expect(userStore.isLogin).toBe(false);
      expect(userStore.token).toBe('');
      expect(userStore.userInfo).toBeNull();
      // 验证存储也被清理
      expect(uni.removeStorageSync).toHaveBeenCalled();
    });

    it('updateUserInfo 增量更新用户信息', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      userStore.setUserInfo({ _id: 'user_005', nickname: '旧昵称' });
      userStore.updateUserInfo({ nickname: '新昵称', avatar: 'new_avatar.png' });

      expect(userStore.userInfo.nickname).toBe('新昵称');
      expect(userStore.userInfo.avatar).toBe('new_avatar.png');
      expect(userStore.userInfo._id).toBe('user_005');
    });
  });

  describe('Phase 3: VIP 与邀请系统', () => {
    it('VIP 状态管理 - 有效期内', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      userStore.setVipStatus(true, 2, futureDate, ['无广告', '高级题库']);

      expect(userStore.isVip).toBe(true);
      expect(userStore.vipLevelName).toBe('白银会员');
      expect(userStore.vipDaysLeft).toBeGreaterThan(0);
      expect(userStore.vipBenefits).toHaveLength(2);
    });

    it('VIP 状态管理 - 已过期', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      const pastDate = new Date(Date.now() - 1000).toISOString();
      userStore.setVipStatus(true, 1, pastDate, []);

      expect(userStore.isVip).toBe(false);
      expect(userStore.vipDaysLeft).toBe(0);
    });

    it('邀请信息管理', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      userStore.setInviteInfo('INVITE_ABC', 5, [
        { id: 'r1', amount: 10, claimed: false },
        { id: 'r2', amount: 20, claimed: true }
      ]);

      expect(userStore.inviteCode).toBe('INVITE_ABC');
      expect(userStore.inviteCount).toBe(5);
      expect(userStore.totalInviteRewards).toBe(30);
    });

    it('VIP 等级名称映射', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      const levels = [
        [0, '普通用户'],
        [1, '青铜会员'],
        [2, '白银会员'],
        [3, '黄金会员'],
        [4, '钻石会员']
      ];

      for (const [level, name] of levels) {
        userStore.setVipStatus(true, level, null, []);
        expect(userStore.vipLevelName).toBe(name);
      }
    });
  });

  describe('Phase 4: silentLogin 完整流程', () => {
    it('有缓存时直接恢复，不发起网络请求', async () => {
      global.__mockStorage = {
        EXAM_TOKEN: 'existing_token',
        EXAM_USER_INFO: { _id: 'user_cached', nickname: '缓存用户' },
        EXAM_USER_ID: 'user_cached'
      };

      const { useUserStore } = await import('@/stores/modules/user.js');
      const userStore = useUserStore();

      const result = await userStore.silentLogin();

      expect(result.success).toBe(true);
      expect(userStore.isLogin).toBe(true);
      // uni.login 不应被调用（因为已有缓存）
      expect(uni.login).not.toHaveBeenCalled();
    });
  });
});
