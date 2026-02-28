/**
 * auth-storage.js 单元测试
 *
 * 覆盖目标：getUserId / getToken 的全部分支路径
 * - 加密值存在 + 解密成功
 * - 加密值存在 + 解密返回 null → 回退明文
 * - 加密值存在 + 解密抛异常 → 回退明文
 * - 仅明文值存在
 * - 无任何值 → null
 * - uni 可用 / uni 不可用 / uni 抛异常
 * - localStorage 直接命中 / compat 前缀命中 / JSON 解析失败
 * - normalizeStringValue 各类型
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock deobfuscate
vi.mock('../../src/utils/crypto/cipher.js', () => ({
  deobfuscate: vi.fn(),
  obfuscate: vi.fn((v) => `enc_${v}`),
  base64Encode: vi.fn((v) => v),
  base64Decode: vi.fn((v) => v)
}));

import { deobfuscate } from '../../src/utils/crypto/cipher.js';

// 保存原始全局对象
const originalUni = globalThis.uni;
const originalLocalStorage = globalThis.localStorage;

function mockLocalStorage(store = {}) {
  globalThis.localStorage = {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn(),
    removeItem: vi.fn()
  };
}

function mockUni(storage = {}) {
  globalThis.uni = {
    getStorageSync: vi.fn((key) => {
      if (key in storage) return storage[key];
      return '';
    })
  };
}

function removeUni() {
  delete globalThis.uni;
}

describe('auth-storage', () => {
  let getUserId, getToken;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // 默认：无 uni，无 localStorage
    delete globalThis.uni;
    delete globalThis.localStorage;

    // 动态导入以获取新鲜模块
    const mod = await import('../../src/services/auth-storage.js');
    getUserId = mod.getUserId;
    getToken = mod.getToken;
  });

  afterEach(() => {
    // 恢复全局对象
    if (originalUni) globalThis.uni = originalUni;
    else delete globalThis.uni;
    if (originalLocalStorage) globalThis.localStorage = originalLocalStorage;
    else delete globalThis.localStorage;
  });

  // ==================== getUserId ====================
  describe('getUserId', () => {
    it('返回解密后的 userId（加密值存在 + 解密成功）', () => {
      mockUni({ _enc_EXAM_USER_ID: 'encrypted_uid' });
      deobfuscate.mockReturnValue('real_user_123');

      expect(getUserId()).toBe('real_user_123');
      expect(deobfuscate).toHaveBeenCalledWith('encrypted_uid');
    });

    it('加密值存在但解密返回 null → 回退到明文', () => {
      mockUni({
        _enc_EXAM_USER_ID: 'bad_encrypted',
        EXAM_USER_ID: 'plain_uid_456'
      });
      deobfuscate.mockReturnValue(null);

      expect(getUserId()).toBe('plain_uid_456');
    });

    it('加密值存在但解密抛异常 → 回退到明文', () => {
      mockUni({
        _enc_EXAM_USER_ID: 'corrupt',
        EXAM_USER_ID: 'fallback_uid'
      });
      deobfuscate.mockImplementation(() => {
        throw new Error('decrypt failed');
      });

      expect(getUserId()).toBe('fallback_uid');
    });

    it('无加密值，仅明文值存在', () => {
      mockUni({ EXAM_USER_ID: 'only_plain' });
      deobfuscate.mockReturnValue(null);

      expect(getUserId()).toBe('only_plain');
    });

    it('无任何值 → 返回 null', () => {
      mockUni({});
      expect(getUserId()).toBeNull();
    });

    it('uni 不可用时通过 localStorage 获取', () => {
      removeUni();
      mockLocalStorage({ EXAM_USER_ID: 'ls_uid' });

      expect(getUserId()).toBe('ls_uid');
    });

    it('uni 抛异常时回退到 localStorage', () => {
      globalThis.uni = {
        getStorageSync: vi.fn(() => {
          throw new Error('storage error');
        })
      };
      mockLocalStorage({ EXAM_USER_ID: 'ls_fallback' });

      expect(getUserId()).toBe('ls_fallback');
    });
  });

  // ==================== getToken ====================
  describe('getToken', () => {
    it('返回解密后的 token（加密值存在 + 解密成功）', () => {
      mockUni({ _enc_EXAM_TOKEN: 'encrypted_tok' });
      deobfuscate.mockReturnValue('real_token_abc');

      expect(getToken()).toBe('real_token_abc');
      expect(deobfuscate).toHaveBeenCalledWith('encrypted_tok');
    });

    it('加密值存在但解密返回 null → 回退到明文', () => {
      mockUni({
        _enc_EXAM_TOKEN: 'bad_enc',
        EXAM_TOKEN: 'plain_token_xyz'
      });
      deobfuscate.mockReturnValue(null);

      expect(getToken()).toBe('plain_token_xyz');
    });

    it('加密值存在但解密抛异常 → 回退到明文', () => {
      mockUni({
        _enc_EXAM_TOKEN: 'corrupt',
        EXAM_TOKEN: 'fallback_tok'
      });
      deobfuscate.mockImplementation(() => {
        throw new Error('decrypt boom');
      });

      expect(getToken()).toBe('fallback_tok');
    });

    it('无加密值，仅明文 token', () => {
      mockUni({ EXAM_TOKEN: 'only_plain_tok' });
      expect(getToken()).toBe('only_plain_tok');
    });

    it('无任何值 → 返回 null', () => {
      mockUni({});
      expect(getToken()).toBeNull();
    });
  });

  // ==================== localStorage compat 前缀 ====================
  describe('localStorage compat 前缀路径', () => {
    it('直接 key 命中 localStorage', () => {
      removeUni();
      mockLocalStorage({ EXAM_USER_ID: 'direct_hit' });

      expect(getUserId()).toBe('direct_hit');
      expect(globalThis.localStorage.getItem).toHaveBeenCalledWith('EXAM_USER_ID');
    });

    it('compat 前缀命中 + JSON 解析 { value }', () => {
      removeUni();
      mockLocalStorage({
        '__exam_storage__:EXAM_USER_ID': JSON.stringify({ value: 'compat_uid' })
      });

      expect(getUserId()).toBe('compat_uid');
    });

    it('compat 前缀命中但 JSON 解析失败 → 返回原始字符串', () => {
      removeUni();
      mockLocalStorage({
        '__exam_storage__:EXAM_USER_ID': 'not_json_at_all'
      });

      expect(getUserId()).toBe('not_json_at_all');
    });

    it('compat 前缀命中 + JSON 有效但无 value 属性 → 返回原始字符串', () => {
      removeUni();
      mockLocalStorage({
        '__exam_storage__:EXAM_TOKEN': JSON.stringify({ other: 'data' })
      });

      // JSON 解析成功但没有 value 属性，走到 return compatValue
      expect(getToken()).toBe(JSON.stringify({ other: 'data' }));
    });

    it('localStorage 不可用 → 返回 null', () => {
      removeUni();
      delete globalThis.localStorage;

      expect(getUserId()).toBeNull();
      expect(getToken()).toBeNull();
    });
  });

  // ==================== normalizeStringValue ====================
  describe('normalizeStringValue 边界', () => {
    it('数字类型的 userId 被转为字符串', () => {
      mockUni({ EXAM_USER_ID: 12345 });
      expect(getUserId()).toBe('12345');
    });

    it('NaN 被归一化为空字符串 → 返回 null', () => {
      mockUni({ EXAM_USER_ID: NaN });
      expect(getUserId()).toBeNull();
    });

    it('Infinity 被归一化为空字符串 → 返回 null', () => {
      mockUni({ EXAM_USER_ID: Infinity });
      expect(getUserId()).toBeNull();
    });

    it('null/undefined 被归一化为空字符串 → 返回 null', () => {
      mockUni({ EXAM_USER_ID: null });
      expect(getUserId()).toBeNull();
    });

    it('对象类型被归一化为空字符串 → 返回 null', () => {
      mockUni({ EXAM_USER_ID: { id: 'obj' } });
      expect(getUserId()).toBeNull();
    });
  });
});
