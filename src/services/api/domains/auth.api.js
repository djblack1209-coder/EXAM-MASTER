/**
 * 认证服务 API
 * 职责：用户登录（微信/Apple/Google/手机号/邮箱）、邮箱验证码发送
 *
 * @module services/api/domains/auth
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 统一登录接口
 * @param {Object} params - 登录参数
 * @param {string} params.type - 登录类型: 'wechat' | 'apple' | 'google' | 'phone' | 'email'
 * @param {string} params.code - 微信登录凭证
 * @param {string} params.email - 邮箱地址
 * @param {string} params.password - 密码
 * @param {string} params.verifyCode - 验证码（注册时需要）
 * @param {boolean} params.isRegister - 是否为注册
 * @returns {Promise} 返回登录结果
 */
export async function login(params) {
  try {
    logger.log('[LafService] 🔐 登录请求:', { type: params.type });

    // 登录凭证可能仅可消费一次；网络失败后由用户重新发起，不自动重放。
    const response = await request('/login', params, {
      skipAuth: true,
      maxRetries: 0,
      coldStartRetries: 0,
      redactErrors: true,
      suppressAuthFailure: true
    });

    if (response.code === 0 && response.data) {
      logger.log('[LafService] ✅ 登录成功:', {
        isNewUser: response.data.isNewUser === true
      });
    }

    return response;
  } catch (error) {
    logger.error('[LafService] ❌ 登录未完成');
    return normalizeError(error, '登录', { redact: true });
  }
}

// No credentials or session verifier enter logs; a pending receipt is not a login.
export async function desktopOAuth(params) {
  try {
    return await request(
      '/login',
      { ...params, type: 'desktop_oauth' },
      {
        skipAuth: true,
        maxRetries: 0,
        coldStartRetries: 0,
        redactErrors: true,
        suppressAuthFailure: true,
        timeout: 10_000
      }
    );
  } catch (error) {
    return normalizeError(error, '桌面授权', { redact: true });
  }
}

/**
 * 发送邮箱验证码
 * @param {string} email - 邮箱地址
 * @returns {Promise} 返回发送结果
 */
export async function sendEmailCode(email) {
  try {
    logger.log('[LafService] 邮箱验证码请求');

    const response = await request(
      '/send-email-code',
      { email },
      { skipAuth: true, maxRetries: 0, timeout: config.api.emailCodeTimeout }
    );
    return response;
  } catch (error) {
    logger.error('[LafService] ❌ 发送验证码失败:', error);
    return normalizeError(error, '发送验证码'); // [AUDIT FIX R267]
  }
}
