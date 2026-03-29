/**
 * 认证服务 API
 * 职责：用户登录（微信/QQ/邮箱）、邮箱验证码发送
 *
 * @module services/api/domains/auth
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { request } from './_request-core.js';

/**
 * 统一登录接口
 * @param {Object} params - 登录参数
 * @param {string} params.type - 登录类型: 'wechat' | 'qq' | 'email'
 * @param {string} params.code - 微信/QQ登录凭证
 * @param {string} params.email - 邮箱地址
 * @param {string} params.password - 密码
 * @param {string} params.verifyCode - 验证码（注册时需要）
 * @param {boolean} params.isRegister - 是否为注册
 * @returns {Promise} 返回登录结果
 */
export async function login(params) {
  try {
    logger.log('[LafService] 🔐 登录请求:', { type: params.type });

    const response = await request('/login', params, { skipAuth: true });

    if (response.code === 0 && response.data) {
      logger.log('[LafService] ✅ 登录成功:', {
        userId: response.data.userId,
        isNewUser: response.data.isNewUser
      });
    }

    return response;
  } catch (error) {
    logger.error('[LafService] ❌ 登录失败:', error);
    return {
      code: -1,
      success: false,
      message: error.message || '登录失败，请重试'
    };
  }
}

/**
 * 发送邮箱验证码
 * @param {string} email - 邮箱地址
 * @returns {Promise} 返回发送结果
 */
export async function sendEmailCode(email) {
  try {
    logger.log('[LafService] 📧 发送验证码:', { email });

    const response = await request(
      '/send-email-code',
      { email },
      { skipAuth: true, maxRetries: 0, timeout: config.api.emailCodeTimeout }
    );
    return response;
  } catch (error) {
    logger.error('[LafService] ❌ 发送验证码失败:', error);
    return {
      code: -1,
      success: false,
      message: error.message || '发送失败，请重试'
    };
  }
}
