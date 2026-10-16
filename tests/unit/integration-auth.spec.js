/**
 * 全链路测试 1: 启动 -> 登录 -> 首页流程
 * 模拟真机从冷启动到进入首页的完整数据流
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

// Mock 依赖模块（必须在 import store 之前）
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));
vi.mock('@/services/api/domains/stats.api.js', () => ({
  getStatsOverview: vi.fn(),
  getDailyStats: vi.fn(),
  getStudyTrend: vi.fn(),
  getRankInfo: vi.fn(),
  recordStudyTime: vi.fn(),
  updateStreak: vi.fn()
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

  describe('Phase 2: 用户认证流程', () => {
    it('静默登录只恢复缓存，启动及设置续期令牌保留代号', async () => {
      const { storageService } = await import('@/services/storageService.js');
      const { getLoginSessionEpoch } = await import('@/services/auth-storage.js');
      const { useAuthStore } = await import('@/stores/modules/auth.js');
      storageService.saveLoginSession({
        userId: 'silent-epoch-user',
        token: 'synthetic-silent-token',
        userInfo: { _id: 'silent-epoch-user' }
      });
      const auth = useAuthStore();
      auth._setUserInfoRef(ref({ _id: 'silent-epoch-user' }));
      const first = getLoginSessionEpoch();
      auth.restoreUserInfo();
      expect(getLoginSessionEpoch()).toBe(first);
      expect(auth.silentLogin().success).toBe(true);
      const second = getLoginSessionEpoch();
      expect(second).toBe(first);
      auth.setToken('synthetic-silent-refresh');
      expect(getLoginSessionEpoch()).toBe(second);
      expect(auth.silentLogin().success).toBe(true);
      expect(getLoginSessionEpoch()).toBe(second);
    });
    async function localProgressFixture() {
      const { storageService } = await import('@/services/storageService.js');
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const account = (id) => {
        storageService.save('EXAM_USER_ID', `synthetic-local-${id}`, true);
        storageService.save('EXAM_TOKEN', `synthetic-token-${id}`, true);
      };
      account('a');
      const original = {
        progress: { totalQuestions: 81, completedQuestions: 81, correctQuestions: 61, studyMinutes: 120 },
        history: [{ questionId: 'private-original-a', isCorrect: true }]
      };
      storageService.save('EXAM_STUDY_PROGRESS', original, true);
      const study = useStudyStore();
      study.restoreProgress();
      return { storageService, study, account, original };
    }

    it.each([null, { history: [{ questionId: 'private-original-b', isCorrect: false }] }])(
      '旧题库进度切到新账户后从当前账户完整恢复，缺字段不沿用A：%j',
      async (cached) => {
        const { storageService, study, account, original } = await localProgressFixture();
        account('b');
        if (cached) storageService.save('EXAM_STUDY_PROGRESS', cached, true);
        study.restoreProgress();
        expect(study.studyProgress.completedQuestions).toBe(0);
        expect(study.questionHistory).toEqual(cached?.history || []);
        account('a');
        expect(storageService.get('EXAM_STUDY_PROGRESS')).toEqual(original);
        study.restoreProgress();
        expect(study.studyProgress.completedQuestions).toBe(81);
      }
    );

    it('切换后未先打开个人页的首个旧题库写入也不能带入A统计或原题', async () => {
      const { storageService, study, account, original } = await localProgressFixture();
      account('b');
      study.recordQuestionAttempt({ question: { id: 'explicit-b-answer' }, isCorrect: false });
      expect(study.studyProgress.completedQuestions).toBe(1);
      expect(study.questionHistory.map((item) => item.questionId)).toEqual(['explicit-b-answer']);
      expect(storageService.get('EXAM_STUDY_PROGRESS').progress.completedQuestions).toBe(1);
      account('a');
      expect(storageService.get('EXAM_STUDY_PROGRESS')).toEqual(original);
    });

    it('真实退出同步清空旧题库内存，保留A本机原记录', async () => {
      const { storageService, study, account, original } = await localProgressFixture();
      const { useUserStore } = await import('@/stores/modules/user.js');
      const user = useUserStore();
      user.setUserInfo({ _id: 'synthetic-local-a' });
      user.setToken('synthetic-token-a');
      user.logout();
      expect(study.studyProgress.completedQuestions).toBe(0);
      expect(study.questionHistory).toEqual([]);
      account('a');
      expect(storageService.get('EXAM_STUDY_PROGRESS')).toEqual(original);
    });

    it('登录事件及时切换旧题库展示，销毁后撤销自身监听', async () => {
      const { study, account } = await localProgressFixture();
      account('b');
      uni.$emit('loginStatusChanged', true);
      expect(study.studyProgress.completedQuestions).toBe(0);
      study.$dispose();
      expect(uni.$off).toHaveBeenCalledWith('user:logout', expect.any(Function));
    });

    it.each(['EXAM_STUDY_PROGRESS', 'studyProgress'])('登录不能静默迁移访客旧统计：%s', async (key) => {
      const { storageService } = await import('@/services/storageService.js');
      const original = { progress: { completedQuestions: 72 }, history: [{ questionId: 'guest-original' }] };
      storageService.save(key, original, true);
      storageService.save('EXAM_USER_ID', 'synthetic-local-new', true);
      storageService.migrateUserKeys();
      expect(storageService.get(key, null)).toBeNull();
      storageService.remove('EXAM_USER_ID');
      expect(storageService.get(key)).toEqual(original);
    });

    it.each([
      ['fetchOverview', 'getStatsOverview', []],
      ['fetchDailyStats', 'getDailyStats', [7]],
      ['fetchTrend', 'getStudyTrend', ['week']],
      ['fetchRankInfo', 'getRankInfo', []],
      ['reportStudyTime', 'recordStudyTime', [10]],
      ['reportStreak', 'updateStreak', []]
    ])('%s的旧账户回执不能污染新账户缓存或返回旧私有内容', async (method, api, args) => {
      const { storageService } = await import('@/services/storageService.js');
      const { useStatsStore } = await import('@/stores/modules/stats.js');
      const statsApi = await import('@/services/api/domains/stats.api.js');
      const stats = useStatsStore();
      const account = (id) => {
        storageService.save('EXAM_USER_ID', `synthetic-${id}`, true);
        storageService.save('EXAM_TOKEN', `synthetic-token-${id}`, true);
      };
      let resolveOld;
      const old = new Promise((resolve) => {
        resolveOld = resolve;
      });
      account('a');
      statsApi[api].mockReturnValueOnce(old);
      const pending = stats[method](...args);
      account('b');
      statsApi.getStatsOverview.mockResolvedValueOnce({
        code: 0,
        data: { totalQuestions: 20, totalStudyMinutes: 5, streakDays: 2 }
      });
      await stats.fetchOverview();
      resolveOld({
        code: 0,
        data: {
          privateMarker: 'synthetic-a-only',
          totalQuestions: 99,
          streakDays: 99,
          stats: [{ privateMarker: 'synthetic-a-only' }]
        }
      });
      const result = await pending;
      expect(JSON.stringify(result)).not.toContain('synthetic-a-only');
      expect(stats.overview).toEqual({ totalQuestions: 20, totalStudyMinutes: 5, streakDays: 2 });
      expect(stats.dailyStats).toEqual([]);
      expect(stats.trend).toBeNull();
      expect(stats.rankInfo).toBeNull();
    });

    it.each(['success', 'error'])('旧统计%s结束不清除新请求的等待或显示旧错误', async (outcome) => {
      const { storageService } = await import('@/services/storageService.js');
      const { useStatsStore } = await import('@/stores/modules/stats.js');
      const { getStatsOverview } = await import('@/services/api/domains/stats.api.js');
      const stats = useStatsStore();
      storageService.save('EXAM_USER_ID', 'synthetic-a', true);
      storageService.save('EXAM_TOKEN', 'synthetic-token-a', true);
      let resolveA, rejectA, resolveB;
      getStatsOverview.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          resolveA = resolve;
          rejectA = reject;
        })
      );
      const pendingA = stats.fetchOverview();
      storageService.save('EXAM_USER_ID', 'synthetic-b', true);
      storageService.save('EXAM_TOKEN', 'synthetic-token-b', true);
      getStatsOverview.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveB = resolve;
        })
      );
      const pendingB = stats.fetchOverview();
      expect(stats.loading).toBe(true);
      if (outcome === 'success') resolveA({ code: 0, data: { totalQuestions: 99 } });
      else rejectA(new Error('synthetic-a-only'));
      await pendingA;
      expect(stats.loading).toBe(true);
      expect(stats.error).toBeNull();
      resolveB({ code: 0, data: { totalQuestions: 20 } });
      await pendingB;
      expect(stats.loading).toBe(false);
      expect(stats.overview.totalQuestions).toBe(20);
    });

    it('切换账户后统计缓存只属于当前账户', async () => {
      const { storageService } = await import('@/services/storageService.js');
      const { useStatsStore } = await import('@/stores/modules/stats.js');
      const { getStatsOverview } = await import('@/services/api/domains/stats.api.js');
      const stats = useStatsStore();
      storageService.save('EXAM_USER_ID', 'synthetic-a', true);
      storageService.save('EXAM_TOKEN', 'synthetic-token-a', true);
      getStatsOverview.mockResolvedValueOnce({ code: 0, data: { totalQuestions: 10 } });
      expect((await stats.fetchOverview()).totalQuestions).toBe(10);
      storageService.save('EXAM_USER_ID', 'synthetic-b', true);
      storageService.save('EXAM_TOKEN', 'synthetic-token-b', true);
      getStatsOverview.mockResolvedValueOnce({ code: 0, data: { totalQuestions: 20 } });
      expect((await stats.fetchOverview()).totalQuestions).toBe(20);
      expect(getStatsOverview).toHaveBeenCalledTimes(2);
    });

    it('旧退出清理不能清空新账户的统计和收藏缓存', async () => {
      const { useUserStore } = await import('@/stores/modules/user.js');
      const { useStatsStore } = await import('@/stores/modules/stats.js');
      const { useFavoriteStore } = await import('@/stores/modules/favorite.js');
      const user = useUserStore();
      const stats = useStatsStore();
      const favorites = useFavoriteStore();
      const { storageService } = await import('@/services/storageService.js');
      storageService.saveLoginSession({ userId: 'synthetic-a', token: 'synthetic-token-a', userInfo: {} });
      user.setToken('synthetic-token-a');
      user.setUserInfo({ _id: 'synthetic-a' });
      user.logout();
      storageService.saveLoginSession({ userId: 'synthetic-b', token: 'synthetic-token-b', userInfo: {} });
      user.setToken('synthetic-token-b');
      user.setUserInfo({ _id: 'synthetic-b' });
      stats.overview = { totalQuestions: 20 };
      favorites.favorites = [{ id: 'synthetic-b-favorite' }];
      favorites.folders = [{ id: 'synthetic-b-folder' }];
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(stats.overview).toEqual({ totalQuestions: 20 });
      expect(favorites.favorites).toEqual([{ id: 'synthetic-b-favorite' }]);
      expect(favorites.folders).toEqual([{ id: 'synthetic-b-folder' }]);
    });

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

      uni.setStorageSync('EXAM_USER_ID', 'user_003');
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
      uni.setStorageSync('EXAM_USER_ID', 'user_004');
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
