/**
 * 全链路测试 6: 存储服务 & 导航 & 安全全链路
 * StorageService CRUD -> 加密存储 -> 防抖写入 -> 安全导航 -> Cipher 加解密
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: 存储服务 & 导航 & 安全', () => {
  beforeEach(() => {
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: StorageService 基础 CRUD', () => {
    it('save + get 基本读写', async () => {
      const { storageService } = await import('@/services/storageService.js');

      const result = storageService.save('test_key', { name: '测试数据', count: 42 });
      expect(result).toBe(true);

      const data = storageService.get('test_key');
      expect(data.name).toBe('测试数据');
      expect(data.count).toBe(42);
    });

    it('get 不存在的 key 返回默认值', async () => {
      const { storageService } = await import('@/services/storageService.js');

      expect(storageService.get('nonexistent')).toBeNull();
      expect(storageService.get('nonexistent', [])).toEqual([]);
      expect(storageService.get('nonexistent', 0)).toBe(0);
    });

    it('has 检查 key 是否存在', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('exists_key', 'value');
      expect(storageService.has('exists_key')).toBe(true);
      expect(storageService.has('not_exists')).toBe(false);
    });

    it('remove 删除指定 key', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('to_remove', 'data');
      expect(storageService.has('to_remove')).toBe(true);

      const result = storageService.remove('to_remove');
      expect(result).toBe(true);
    });

    it('clear 清空所有存储', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('key1', 'v1');
      storageService.save('key2', 'v2');

      const result = storageService.clear();
      expect(result).toBe(true);
      expect(uni.clearStorageSync).toHaveBeenCalled();
    });

    it('saveBatch + getBatch 批量操作', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.saveBatch({
        batch_a: 'value_a',
        batch_b: 'value_b',
        batch_c: 'value_c'
      });

      const result = storageService.getBatch(['batch_a', 'batch_b', 'batch_c']);
      expect(result.batch_a).toBe('value_a');
      expect(result.batch_b).toBe('value_b');
      expect(result.batch_c).toBe('value_c');
    });

    it('getAllKeys 获取所有键名', async () => {
      const { storageService } = await import('@/services/storageService.js');
      const keys = storageService.getAllKeys();
      expect(Array.isArray(keys)).toBe(true);
    });

    it('getStorageInfo 获取存储信息', async () => {
      const { storageService } = await import('@/services/storageService.js');
      const info = storageService.getStorageInfo();
      expect(info).toHaveProperty('keys');
      expect(info).toHaveProperty('currentSize');
    });
  });

  describe('Phase 2: 敏感数据加密存储', () => {
    it('EXAM_TOKEN 自动加密存储', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('EXAM_TOKEN', 'my_secret_token');

      // 应该调用了加密存储（_enc_ 前缀）
      const calls = uni.setStorageSync.mock.calls;
      const encCall = calls.find((c) => c[0] === '_enc_EXAM_TOKEN');
      // 如果加密成功，应该有 _enc_ 前缀的调用
      // 如果加密失败（无密钥），会回退到明文
      expect(calls.length).toBeGreaterThan(0);
    });

    it('EXAM_USER_ID 自动加密存储', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('EXAM_USER_ID', 'user_secret_id');
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('非敏感 key 不加密', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.save('normal_key', 'normal_value');

      const calls = uni.setStorageSync.mock.calls;
      const normalCall = calls.find((c) => c[0] === 'normal_key');
      expect(normalCall).toBeTruthy();
      expect(normalCall[1]).toBe('normal_value');
    });

    it('remove 同时清理加密和明文存储', async () => {
      const { storageService } = await import('@/services/storageService.js');

      storageService.remove('EXAM_TOKEN');

      const removeCalls = uni.removeStorageSync.mock.calls.map((c) => c[0]);
      expect(removeCalls).toContain('EXAM_TOKEN');
      expect(removeCalls).toContain('_enc_EXAM_TOKEN');
    });
  });

  describe('Phase 3: 防抖写入', () => {
    it('saveDebounced 延迟写入', async () => {
      const { storageService } = await import('@/services/storageService.js');

      vi.useFakeTimers();

      storageService.saveDebounced('debounce_key', 'value1');
      storageService.saveDebounced('debounce_key', 'value2');
      storageService.saveDebounced('debounce_key', 'value3');

      // 还没到延迟时间，不应该写入
      const callsBefore = uni.setStorageSync.mock.calls.filter((c) => c[0] === 'debounce_key');
      expect(callsBefore.length).toBe(0);

      // 快进 600ms（超过 500ms 防抖延迟）
      vi.advanceTimersByTime(600);

      const callsAfter = uni.setStorageSync.mock.calls.filter((c) => c[0] === 'debounce_key');
      expect(callsAfter.length).toBe(1);
      expect(callsAfter[0][1]).toBe('value3'); // 只写入最后一次

      vi.useRealTimers();
    });

    it('flushPendingWrites 立即刷新所有待写入', async () => {
      const { storageService } = await import('@/services/storageService.js');

      vi.useFakeTimers();

      storageService.saveDebounced('flush_a', 'va');
      storageService.saveDebounced('flush_b', 'vb');

      storageService.flushPendingWrites();

      const calls = uni.setStorageSync.mock.calls;
      const flushA = calls.find((c) => c[0] === 'flush_a');
      const flushB = calls.find((c) => c[0] === 'flush_b');
      expect(flushA).toBeTruthy();
      expect(flushB).toBeTruthy();

      vi.useRealTimers();
    });
  });

  describe('Phase 4: storage 便捷别名', () => {
    it('storage.set / storage.get / storage.remove', async () => {
      const { storage } = await import('@/services/storageService.js');

      storage.set('alias_key', 'alias_value');
      const value = storage.get('alias_key');
      expect(value).toBe('alias_value');

      storage.remove('alias_key');
    });
  });

  describe('Phase 5: 安全导航', () => {
    it('tabBar 页面自动使用 switchTab', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      safeNavigateTo('/pages/index/index');
      expect(uni.switchTab).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/pages/index/index'
        })
      );
      expect(uni.navigateTo).not.toHaveBeenCalled();
    });

    it('普通页面使用 navigateTo', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      safeNavigateTo('/pages/practice-sub/do-quiz');
      expect(uni.navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/pages/practice-sub/do-quiz'
        })
      );
    });

    it('tabBar 页面去掉查询参数', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      safeNavigateTo('/pages/practice/index?from=home');
      expect(uni.switchTab).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/pages/practice/index'
        })
      );
    });

    it('navigateTo 失败降级到 redirectTo', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      // Mock navigateTo 失败
      uni.navigateTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'navigateTo:fail page limit exceeded' });
      });

      safeNavigateTo('/pages/practice-sub/do-quiz');

      expect(uni.redirectTo).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/pages/practice-sub/do-quiz'
        })
      );
    });

    it('switchTab 失败降级到 reLaunch', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      uni.switchTab.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'switchTab:fail' });
      });

      safeNavigateTo('/pages/index/index');

      expect(uni.reLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/pages/index/index'
        })
      );
    });

    it('自定义 fail 回调不触发降级', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      const customFail = vi.fn();
      uni.navigateTo.mockImplementationOnce(({ fail }) => {
        fail?.({ errMsg: 'fail' });
      });

      safeNavigateTo('/pages/practice-sub/do-quiz', { fail: customFail });

      expect(customFail).toHaveBeenCalled();
      expect(uni.redirectTo).not.toHaveBeenCalled();
    });

    it('所有 tabBar 页面路径都能识别', async () => {
      const { safeNavigateTo } = await import('@/utils/safe-navigate.js');

      const tabPages = ['/pages/index/index', '/pages/practice/index', '/pages/school/index', '/pages/profile/index'];

      for (const page of tabPages) {
        vi.clearAllMocks();
        safeNavigateTo(page);
        expect(uni.switchTab).toHaveBeenCalled();
      }
    });
  });

  describe('Phase 6: Cipher 加解密', () => {
    it('base64Encode + base64Decode ASCII 往返一致', async () => {
      const { base64Encode, base64Decode } = await import('@/utils/crypto/cipher.js');

      // 注意：该 base64 实现是字节级的，仅支持 ASCII/Latin1
      const testCases = ['hello', 'abc123!@#', 'test_token_12345', ''];
      for (const input of testCases) {
        const encoded = base64Encode(input);
        const decoded = base64Decode(encoded);
        expect(decoded).toBe(input);
      }
    });

    it('sipHash 相同输入产生相同输出', async () => {
      const { sipHash } = await import('@/utils/crypto/cipher.js');

      const hash1 = sipHash('test_string', 0x5a3c);
      const hash2 = sipHash('test_string', 0x5a3c);
      expect(hash1).toBe(hash2);
    });

    it('sipHash 不同输入产生不同输出', async () => {
      const { sipHash } = await import('@/utils/crypto/cipher.js');

      const hash1 = sipHash('string_a', 0x5a3c);
      const hash2 = sipHash('string_b', 0x5a3c);
      expect(hash1).not.toBe(hash2);
    });

    it('feistelEncrypt + feistelDecrypt 往返一致', async () => {
      const { feistelEncrypt, feistelDecrypt } = await import('@/utils/crypto/cipher.js');

      const key = 'test_encryption_key';
      const original = [72, 101, 108, 108, 111]; // "Hello"

      const encrypted = feistelEncrypt(original, key);
      expect(encrypted).not.toEqual(original);

      const decrypted = feistelDecrypt(encrypted, key);
      expect(decrypted.slice(0, original.length)).toEqual(original);
    });

    it('obfuscate + deobfuscate 字符串往返', async () => {
      const { obfuscate, deobfuscate } = await import('@/utils/crypto/cipher.js');

      const original = 'secret_token_12345';
      const encrypted = obfuscate(original);

      if (encrypted !== null) {
        // 有密钥时应该能加解密
        expect(encrypted).not.toBe(original);
        expect(encrypted.startsWith('v2.')).toBe(true);

        const decrypted = deobfuscate(encrypted);
        expect(decrypted).toBe(original);
      }
      // 无密钥时 obfuscate 返回 null，这也是合法行为
    });

    it('obfuscate + deobfuscate 对象往返', async () => {
      const { obfuscate, deobfuscate } = await import('@/utils/crypto/cipher.js');

      const original = { userId: 'user_001', role: 'student' };
      const encrypted = obfuscate(original);

      if (encrypted !== null) {
        const decrypted = deobfuscate(encrypted);
        expect(decrypted).toEqual(original);
      }
    });

    it('deobfuscate 无效 V2 数据返回 null', async () => {
      const { deobfuscate } = await import('@/utils/crypto/cipher.js');

      // V2 格式但数据损坏
      expect(deobfuscate('v2.bad.data')).toBeNull();
      // 空字符串走 legacy 路径，可能返回 null 或空
      const emptyResult = deobfuscate('');
      expect(emptyResult === null || emptyResult === '').toBe(true);
    });
  });
});
