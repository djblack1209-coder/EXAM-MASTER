/**
 * Token 刷新插件
 * 管理 Token 的存取、过期检测、自动刷新和并发去重
 *
 * ✅ P0修复：通过 storageService 加密存储，不再明文写入
 */

import { storageService } from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRE_KEY = 'token_expire_time';
const PRE_CHECK_BUFFER = 5 * 60 * 1000; // 5分钟提前量

class TokenRefreshPlugin {
  constructor() {
    this._refreshPromise = null;
    this._refreshTokenFn = null;
    this._preCheckTimer = null;
    this._onLogout = null;
    this._onRefreshFailed = null;
    this._maxRefreshRetries = 3;
    this.refreshRetryCount = 0;
  }

  /**
   * 初始化插件
   */
  init(options = {}) {
    this._refreshTokenFn = options.refreshTokenFn || null;
    this._onLogout = options.onLogout !== undefined ? options.onLogout : null;
    this._onRefreshFailed = options.onRefreshFailed !== undefined ? options.onRefreshFailed : null;
    this._maxRefreshRetries = options.maxRefreshRetries || 3;
    this.refreshRetryCount = 0;

    if (options.enablePreCheck !== false) {
      this.startPreCheckTimer();
    }
  }

  /**
   * 保存 Token（通过 storageService 加密存储）
   */
  saveTokens(accessToken, refreshToken, expiresIn) {
    try {
      storageService.save(TOKEN_KEY, accessToken, true);
      if (refreshToken) {
        storageService.save(REFRESH_TOKEN_KEY, refreshToken, true);
      }
      if (expiresIn) {
        const expireTime = Date.now() + expiresIn * 1000;
        storageService.save(TOKEN_EXPIRE_KEY, expireTime, true);
      }
    } catch (_e) {
      // 静默
    }
  }

  /**
   * 获取 Access Token
   */
  getAccessToken() {
    try {
      return storageService.get(TOKEN_KEY, null);
    } catch (_e) {
      return null;
    }
  }

  /**
   * 获取 Refresh Token
   */
  getRefreshToken() {
    try {
      return storageService.get(REFRESH_TOKEN_KEY, null);
    } catch (_e) {
      return null;
    }
  }

  /**
   * 清除所有 Token
   */
  clearTokens() {
    try {
      storageService.remove(TOKEN_KEY, true);
      storageService.remove(REFRESH_TOKEN_KEY, true);
      storageService.remove(TOKEN_EXPIRE_KEY, true);
    } catch (_e) {
      // 静默
    }
  }

  /**
   * Token 是否已过期
   */
  isTokenExpired() {
    try {
      const expireTime = storageService.get(TOKEN_EXPIRE_KEY, null);
      if (!expireTime) return true;
      return Date.now() >= expireTime;
    } catch (_e) {
      return true;
    }
  }

  /**
   * Token 是否即将过期（5分钟内）
   */
  isTokenExpiringSoon() {
    try {
      const expireTime = storageService.get(TOKEN_EXPIRE_KEY, null);
      if (!expireTime) return false;
      return Date.now() >= expireTime - PRE_CHECK_BUFFER && Date.now() < expireTime;
    } catch (_e) {
      return false;
    }
  }

  /**
   * 刷新 Token（支持并发去重）
   */
  async refreshToken() {
    // 并发去重
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    if (!this._refreshTokenFn) {
      throw new Error('refreshTokenFn not configured');
    }

    const currentRefreshToken = this.getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token');
    }

    // 检查重试次数
    if (this.refreshRetryCount >= this._maxRefreshRetries) {
      this.clearTokens();
      if (typeof this._onLogout === 'function') {
        this._onLogout();
      } else if (this._onLogout !== null || this._onRefreshFailed !== null) {
        // 自定义处理
      } else {
        toast.info('登录已过期，请重新登录');
        uni.reLaunch({ url: '/pages/index/index' });
      }
      this._refreshPromise = null;
      throw new Error('Max refresh retries exceeded');
    }

    this._refreshPromise = (async () => {
      try {
        const result = await this._refreshTokenFn(currentRefreshToken);
        const newAccessToken = result.accessToken || result.access_token;
        const newRefreshToken = result.refreshToken || result.refresh_token;
        const expiresIn = result.expiresIn || result.expires_in || 3600;

        this.saveTokens(newAccessToken, newRefreshToken, expiresIn);
        this.refreshRetryCount = 0;
        return newAccessToken;
      } catch (err) {
        this.refreshRetryCount++;
        throw err;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  /**
   * 包装请求，自动处理 401
   */
  async wrapRequest(requestFn) {
    try {
      return await requestFn();
    } catch (err) {
      if (err && (err.statusCode === 401 || err.status === 401)) {
        const newToken = await this.refreshToken();
        if (newToken) {
          return await requestFn();
        }
      }
      throw err;
    }
  }

  /**
   * 启动预检测定时器
   */
  startPreCheckTimer() {
    this.stopPreCheckTimer();
    this._preCheckTimer = setInterval(() => {
      if (this.isTokenExpiringSoon()) {
        this.refreshToken().catch((_err) => {
          /* silent refresh failure */
        });
      }
    }, 60 * 1000);
  }

  /**
   * 停止预检测定时器
   */
  stopPreCheckTimer() {
    if (this._preCheckTimer) {
      clearInterval(this._preCheckTimer);
      this._preCheckTimer = null;
    }
  }
}

export const tokenRefreshPlugin = new TokenRefreshPlugin();
export default tokenRefreshPlugin;
