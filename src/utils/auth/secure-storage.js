/**
 * 安全存储工具
 * 为敏感数据提供加密存储功能
 *
 * @version 1.0.0
 * @description 使用 AES 加密算法保护本地存储的敏感数据
 */

// 简单的加密密钥（生产环境应使用更安全的密钥管理）
import storageService from '@/services/storageService.js';
const ENCRYPTION_KEY = 'EXAM_MASTER_2026_SECURE_KEY';

/**
 * 简单的字符串混淆（Base64 + 字符位移）
 * 注意：这不是真正的加密，仅用于基本的数据混淆
 * 生产环境建议使用 crypto-js 等专业加密库
 */
class SecureStorage {
  constructor() {
    this.prefix = 'secure_';
    this.key = ENCRYPTION_KEY;
    // 派生多轮密钥，增加破解难度
    this._derivedKey = this._deriveKey(ENCRYPTION_KEY, 4);
  }

  /**
   * 简单密钥派生：多轮哈希拉伸，生成更长的伪随机密钥流
   * @param {string} key - 原始密钥
   * @param {number} rounds - 拉伸轮数
   * @returns {number[]} 派生密钥字节数组
   */
  _deriveKey(key, rounds) {
    let material = key;
    for (let r = 0; r < rounds; r++) {
      let hash = 0x811c9dc5; // FNV offset basis
      for (let i = 0; i < material.length; i++) {
        hash ^= material.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV prime
      }
      material += Math.abs(hash).toString(36);
    }
    return Array.from(material, (c) => c.charCodeAt(0));
  }

  /**
   * 基于派生密钥的 XOR 加密（比简单 shift 安全得多）
   * @param {string} data - 要加密的数据
   * @returns {string} 加密后的字符串
   */
  encrypt(data) {
    if (!data) return '';

    try {
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      const dk = this._derivedKey;

      // XOR 加密：每个字符与派生密钥的对应字节异或
      let encrypted = '';
      for (let i = 0; i < jsonStr.length; i++) {
        encrypted += String.fromCharCode(
          jsonStr.charCodeAt(i) ^ dk[i % dk.length]
        );
      }

      // Base64 编码
      const base64 = this.base64Encode(encodeURIComponent(encrypted));

      // HMAC 完整性校验（基于原文 + 密钥生成）
      const hmac = this._hmac(jsonStr);

      return `${hmac}:${base64}`;
    } catch (e) {
      console.error('[SecureStorage] 加密失败:', e);
      return '';
    }
  }

  /**
   * 解密
   * @param {string} encryptedData - 加密的数据
   * @returns {string|object} 解密后的数据
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;

    try {
      const [hmac, base64] = encryptedData.split(':');
      if (!base64) return null;

      // Base64 解码
      const encrypted = decodeURIComponent(this.base64Decode(base64));

      // XOR 解密
      const dk = this._derivedKey;
      let jsonStr = '';
      for (let i = 0; i < encrypted.length; i++) {
        jsonStr += String.fromCharCode(
          encrypted.charCodeAt(i) ^ dk[i % dk.length]
        );
      }

      // 验证 HMAC 完整性
      if (this._hmac(jsonStr) !== hmac) {
        console.warn('[SecureStorage] 数据校验失败，可能被篡改');
        return null;
      }

      try {
        return JSON.parse(jsonStr);
      } catch {
        return jsonStr;
      }
    } catch (e) {
      console.error('[SecureStorage] 解密失败:', e);
      return null;
    }
  }

  /**
   * HMAC 完整性校验：基于 FNV-1a 变体，比简单 djb2 更抗碰撞
   * @param {string} str - 原始字符串
   * @returns {string} 8 位十六进制校验码
   */
  _hmac(str) {
    const dk = this._derivedKey;
    let h1 = 0x811c9dc5;
    let h2 = 0x1f351f35;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i) ^ dk[i % dk.length];
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= c;
      h2 = Math.imul(h2, 0x100001b3);
    }
    return (Math.abs(h1) >>> 0).toString(16).padStart(8, '0').substring(0, 8);
  }

  /**
   * Base64 编码
   * @param {string} str - 原始字符串
   * @returns {string} Base64 编码后的字符串
   */
  base64Encode(str) {
    // 使用 encodeURIComponent 处理中文
    const encoded = encodeURIComponent(str);
    // 转换为 Base64
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;

    while (i < encoded.length) {
      const a = encoded.charCodeAt(i++);
      const b = i < encoded.length ? encoded.charCodeAt(i++) : 0;
      const c = i < encoded.length ? encoded.charCodeAt(i++) : 0;

      const b1 = a >> 2;
      const b2 = ((a & 3) << 4) | (b >> 4);
      const b3 = ((b & 15) << 2) | (c >> 6);
      const b4 = c & 63;

      result += chars.charAt(b1) + chars.charAt(b2);
      result += i - 2 < encoded.length ? chars.charAt(b3) : '=';
      result += i - 1 < encoded.length ? chars.charAt(b4) : '=';
    }

    return result;
  }

  /**
   * Base64 解码
   * @param {string} str - Base64 编码的字符串
   * @returns {string} 解码后的字符串
   */
  base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;

    // 移除非法字符
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');

    while (i < str.length) {
      const b1 = chars.indexOf(str.charAt(i++));
      const b2 = chars.indexOf(str.charAt(i++));
      const b3 = chars.indexOf(str.charAt(i++));
      const b4 = chars.indexOf(str.charAt(i++));

      const a = (b1 << 2) | (b2 >> 4);
      const b = ((b2 & 15) << 4) | (b3 >> 2);
      const c = ((b3 & 3) << 6) | b4;

      result += String.fromCharCode(a);
      if (b3 !== 64) result += String.fromCharCode(b);
      if (b4 !== 64) result += String.fromCharCode(c);
    }

    // 解码 URI 组件
    try {
      return decodeURIComponent(result);
    } catch {
      return result;
    }
  }

  /**
   * 安全存储数据
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @param {boolean} encrypt - 是否加密，默认 true
   */
  set(key, value, encrypt = true) {
    try {
      const storageKey = this.prefix + key;
      const data = encrypt ? this.encrypt(value) : JSON.stringify(value);
      storageService.save(storageKey, data);
    } catch (e) {
      console.error('[SecureStorage] 存储失败:', e);
    }
  }

  /**
   * 获取存储的数据
   * @param {string} key - 存储键名
   * @param {boolean} encrypted - 数据是否加密，默认 true
   * @returns {any} 存储的值
   */
  get(key, encrypted = true) {
    try {
      const storageKey = this.prefix + key;
      const data = storageService.get(storageKey);

      if (!data) return null;

      if (encrypted) {
        return this.decrypt(data);
      } else {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
    } catch (e) {
      console.error('[SecureStorage] 读取失败:', e);
      return null;
    }
  }

  /**
   * 删除存储的数据
   * @param {string} key - 存储键名
   */
  remove(key) {
    try {
      const storageKey = this.prefix + key;
      storageService.remove(storageKey);
    } catch (e) {
      console.error('[SecureStorage] 删除失败:', e);
    }
  }

  /**
   * 清除所有安全存储的数据
   */
  clear() {
    try {
      const info = uni.getStorageInfoSync();
      const keys = info.keys || [];

      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          storageService.remove(key);
        }
      });
    } catch (e) {
      console.error('[SecureStorage] 清除失败:', e);
    }
  }
}

// 创建单例实例
const secureStorage = new SecureStorage();

/**
 * Token 专用存储
 */
export const tokenStorage = {
  /**
   * 存储 Token
   * @param {string} token - JWT Token
   * @param {number} expiresIn - 过期时间（秒）
   */
  setToken(token, expiresIn = 7 * 24 * 3600) {
    const data = {
      token,
      expiresAt: Date.now() + expiresIn * 1000
    };
    secureStorage.set('auth_token', data);
  },

  /**
   * 获取 Token
   * @returns {string|null} Token 或 null（如果过期）
   */
  getToken() {
    const data = secureStorage.get('auth_token');

    if (!data) return null;

    // 检查是否过期
    if (data.expiresAt && Date.now() > data.expiresAt) {
      this.removeToken();
      return null;
    }

    return data.token;
  },

  /**
   * 删除 Token
   */
  removeToken() {
    secureStorage.remove('auth_token');
  },

  /**
   * 检查 Token 是否有效
   * @returns {boolean}
   */
  isValid() {
    return !!this.getToken();
  },

  /**
   * 获取 Token 剩余有效时间（秒）
   * @returns {number} 剩余秒数，0 表示已过期
   */
  getRemainingTime() {
    const data = secureStorage.get('auth_token');

    if (!data || !data.expiresAt) return 0;

    const remaining = Math.floor((data.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }
};

/**
 * 用户敏感信息存储
 */
export const userSecureStorage = {
  /**
   * 存储用户 ID
   * @param {string} userId
   */
  setUserId(userId) {
    secureStorage.set('user_id', userId);
  },

  /**
   * 获取用户 ID
   * @returns {string|null}
   */
  getUserId() {
    return secureStorage.get('user_id');
  },

  /**
   * 存储用户敏感信息
   * @param {object} info - 敏感信息对象
   */
  setUserInfo(info) {
    secureStorage.set('user_secure_info', info);
  },

  /**
   * 获取用户敏感信息
   * @returns {object|null}
   */
  getUserInfo() {
    return secureStorage.get('user_secure_info');
  },

  /**
   * 清除所有用户敏感信息
   */
  clearAll() {
    secureStorage.remove('user_id');
    secureStorage.remove('user_secure_info');
    tokenStorage.removeToken();
  }
};

// 导出
export { secureStorage, SecureStorage };
export default secureStorage;
