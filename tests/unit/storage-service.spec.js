/**
 * storageService.js 单元测试
 * T001/T006: 核心服务层测试覆盖
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

// Mock lafService
vi.mock('@/services/lafService.js', () => ({
  lafService: {
    request: vi.fn().mockResolvedValue({ code: 0, data: {} })
  }
}));

describe('storageService', () => {
  let storageService;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.__mockStorage = {};
    const mod = await import('@/services/storageService.js');
    storageService = mod.storageService;
  });

  describe('save / get 基础操作', () => {
    it('save 存储普通数据', () => {
      const result = storageService.save('test_key', 'test_value');
      expect(result).toBe(true);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('get 读取普通数据', () => {
      global.__mockStorage['test_key'] = 'hello';
      const value = storageService.get('test_key');
      expect(value).toBe('hello');
    });

    it('get 缺失键返回默认值', () => {
      const value = storageService.get('nonexistent', 'default_val');
      expect(value).toBe('default_val');
    });

    it('save 对象数据', () => {
      const obj = { name: 'test', count: 42 };
      storageService.save('obj_key', obj);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('save 数组数据', () => {
      const arr = [1, 2, 3];
      storageService.save('arr_key', arr);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('smart_review_ids 使用全局瞬态键，跨页面跳转时不加用户前缀', () => {
      global.__mockStorage.EXAM_USER_ID = 'user_001';

      const ids = ['politics-2025-001'];
      expect(storageService.save('smart_review_ids', ids)).toBe(true);

      expect(global.__mockStorage.smart_review_ids).toEqual(ids);
      expect(global.__mockStorage.u_user_001_smart_review_ids).toBeUndefined();
      expect(storageService.get('smart_review_ids', [])).toEqual(ids);
    });

    it('模块加载后注入 uni 时仍写入当前运行时存储', async () => {
      const originalUni = global.uni;
      const originalWx = global.wx;
      const runtimeStorage = {};
      try {
        vi.resetModules();
        delete global.uni;
        delete global.wx;
        const { storageService: lateStorageService } = await import('@/services/storageService.js');
        global.uni = {
          getStorageSync: vi.fn((key) =>
            Object.prototype.hasOwnProperty.call(runtimeStorage, key) ? runtimeStorage[key] : ''
          ),
          setStorageSync: vi.fn((key, value) => {
            runtimeStorage[key] = value;
          }),
          removeStorageSync: vi.fn((key) => {
            delete runtimeStorage[key];
          }),
          getStorageInfoSync: vi.fn(() => ({
            keys: Object.keys(runtimeStorage),
            currentSize: Object.keys(runtimeStorage).length,
            limitSize: 10240
          })),
          showToast: vi.fn()
        };

        expect(lateStorageService.save('late_key', 'late_value')).toBe(true);
        expect(global.uni.setStorageSync).toHaveBeenCalledWith('late_key', 'late_value');
        expect(lateStorageService.get('late_key')).toBe('late_value');
      } finally {
        global.uni = originalUni;
        global.wx = originalWx;
      }
    });

    it('微信小程序端未挂载 global uni 时回退到 wx 持久存储', async () => {
      const originalUni = global.uni;
      const originalWx = global.wx;
      const runtimeStorage = {};
      try {
        vi.resetModules();
        delete global.uni;
        global.wx = {
          getStorageSync: vi.fn((key) =>
            Object.prototype.hasOwnProperty.call(runtimeStorage, key) ? runtimeStorage[key] : ''
          ),
          setStorageSync: vi.fn((key, value) => {
            runtimeStorage[key] = value;
          }),
          removeStorageSync: vi.fn((key) => {
            delete runtimeStorage[key];
          }),
          getStorageInfoSync: vi.fn(() => ({
            keys: Object.keys(runtimeStorage),
            currentSize: Object.keys(runtimeStorage).length,
            limitSize: 10240
          })),
          showToast: vi.fn()
        };

        const { storageService: wxStorageService } = await import('@/services/storageService.js');

        expect(wxStorageService.save('wx_key', 'wx_value')).toBe(true);
        expect(global.wx.setStorageSync).toHaveBeenCalledWith('wx_key', 'wx_value');
        expect(wxStorageService.get('wx_key')).toBe('wx_value');
      } finally {
        global.uni = originalUni;
        global.wx = originalWx;
      }
    });
  });

  describe('saveDebounced', () => {
    it('clear 会取消待执行的防抖写入，避免清空后恢复旧数据', () => {
      vi.useFakeTimers();
      try {
        storageService.saveDebounced('temp_cache_key', 'stale_value');
        storageService.clear(true, { preserveGlobal: false });
        vi.advanceTimersByTime(600);

        expect(global.__mockStorage.temp_cache_key).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('remove / clear', () => {
    it('remove 删除指定键', () => {
      storageService.remove('some_key');
      expect(uni.removeStorageSync).toHaveBeenCalled();
    });

    it('clear 默认保留全局键，仅清理业务缓存', () => {
      global.__mockStorage = {
        EXAM_TOKEN: 'token_123',
        theme_mode: 'dark',
        temp_cache_key: 'to_remove'
      };

      storageService.clear();

      expect(global.__mockStorage.EXAM_TOKEN).toBe('token_123');
      expect(global.__mockStorage.theme_mode).toBe('dark');
      expect(global.__mockStorage.temp_cache_key).toBeUndefined();
      expect(uni.clearStorageSync).not.toHaveBeenCalled();
    });

    it('clear 可显式关闭保留策略并执行全清', () => {
      global.__mockStorage = { EXAM_TOKEN: 'token_123', temp_cache_key: 'to_remove' };

      storageService.clear(false, { preserveGlobal: false });

      expect(uni.clearStorageSync).toHaveBeenCalled();
      expect(global.__mockStorage).toEqual({});
    });
  });

  describe('has', () => {
    it('存在的键返回 true', () => {
      global.__mockStorage['existing'] = 'value';
      expect(storageService.has('existing')).toBe(true);
    });

    it('不存在的键返回 false', () => {
      expect(storageService.has('missing_key')).toBe(false);
    });
  });

  describe('saveBatch / getBatch', () => {
    it('saveBatch 批量存储', () => {
      const data = { key1: 'val1', key2: 'val2', key3: 'val3' };
      const result = storageService.saveBatch(data);
      expect(result).toBe(true);
    });

    it('getBatch 批量读取', () => {
      global.__mockStorage['k1'] = 'v1';
      global.__mockStorage['k2'] = 'v2';
      const result = storageService.getBatch(['k1', 'k2', 'k3']);
      expect(result).toHaveProperty('k1', 'v1');
      expect(result).toHaveProperty('k2', 'v2');
    });
  });

  describe('敏感数据加密', () => {
    it('EXAM_TOKEN 存储时使用加密键', () => {
      storageService.save('EXAM_TOKEN', 'my_secret_token');
      // 应该调用 setStorageSync，且键名包含 _enc_ 前缀
      const calls = /** @type {any} */ (uni.setStorageSync).mock.calls;
      const encCall = calls.find((c) => c[0].includes('_enc_'));
      expect(encCall).toBeTruthy();
    });

    it('userInfo 存储时使用加密键', () => {
      storageService.save('userInfo', { name: 'test' });
      const calls = /** @type {any} */ (uni.setStorageSync).mock.calls;
      const encCall = calls.find((c) => c[0].includes('_enc_'));
      expect(encCall).toBeTruthy();
    });
  });

  describe('getStorageInfo', () => {
    it('返回存储信息对象', () => {
      const info = storageService.getStorageInfo();
      expect(info).toBeDefined();
    });
  });

  describe('getAllKeys', () => {
    it('返回键名数组', () => {
      const keys = storageService.getAllKeys();
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('getMistakes 本地降级', () => {
    it('返回按时间排序的分页结果时不改变本地缓存原始顺序', async () => {
      const originalMistakes = [
        { id: 'old', created_at: 1, is_mastered: false },
        { id: 'new', created_at: 2, is_mastered: false }
      ];
      storageService.save('mistake_book', originalMistakes, true);

      const result = await storageService.getMistakes(1, 20);

      expect(result.list.map((item) => item.id)).toEqual(['new', 'old']);
      expect(storageService.get('mistake_book').map((item) => item.id)).toEqual(['old', 'new']);
    });
  });
});
