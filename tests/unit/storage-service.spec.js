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
  });

  describe('remove / clear', () => {
    it('remove 删除指定键', () => {
      storageService.remove('some_key');
      expect(uni.removeStorageSync).toHaveBeenCalled();
    });

    it('clear 清空所有存储', () => {
      storageService.clear();
      expect(uni.clearStorageSync).toHaveBeenCalled();
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
      const calls = uni.setStorageSync.mock.calls;
      const encCall = calls.find(c => c[0].includes('_enc_'));
      expect(encCall).toBeTruthy();
    });

    it('userInfo 存储时使用加密键', () => {
      storageService.save('userInfo', { name: 'test' });
      const calls = uni.setStorageSync.mock.calls;
      const encCall = calls.find(c => c[0].includes('_enc_'));
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
});
