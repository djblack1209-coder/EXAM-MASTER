/**
 * 微信订阅消息服务
 * 用于发送学习提醒通知
 *
 * 微信订阅消息流程：
 * 1. 前端调用 wx.requestSubscribeMessage 获取用户授权
 * 2. 用户同意后，前端通知后端记录授权状态
 * 3. 后端在合适时机通过微信 API 发送消息
 *
 * 本服务只处理前端部分（授权请求 + 记录）
 */

import { logger } from '@/utils/logger.js';

// 订阅消息模板 ID（需要在微信公众平台配置）
// 这里使用占位符，实际部署时替换为真实模板 ID
const TEMPLATE_IDS = {
  // 学习提醒：该复习了，今日还有 X 题待完成
  STUDY_REMINDER: '', // TODO: 在微信公众平台申请后填入
  // 学习报告：本周学习 X 小时，答对 Y 题
  WEEKLY_REPORT: '' // TODO: 同上
};

/**
 * 请求用户授权订阅消息
 * 调用时机：用户开启学习提醒、完成 onboarding、每日首次打开等
 * @param {string[]} templateIds - 需要授权的模板 ID 列表
 * @returns {Promise<{success: boolean, results: object}>}
 */
export async function requestSubscription(templateIds = []) {
  // #ifdef MP-WEIXIN
  const ids = templateIds.length > 0 ? templateIds : Object.values(TEMPLATE_IDS).filter(Boolean);

  if (ids.length === 0) {
    logger.warn('[Subscribe] 未配置订阅消息模板 ID，跳过授权请求');
    return { success: false, results: {} };
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: ids,
      success: (res) => {
        logger.log('[Subscribe] 授权结果:', res);
        // 记录用户授权状态到本地
        const authStatus = {};
        ids.forEach((id) => {
          authStatus[id] = res[id]; // 'accept' | 'reject' | 'ban'
        });
        uni.setStorageSync('subscribe_auth', JSON.stringify(authStatus));
        resolve({ success: true, results: authStatus });
      },
      fail: (err) => {
        logger.warn('[Subscribe] 授权请求失败:', err);
        resolve({ success: false, results: {} });
      }
    });
  });
  // #endif

  // #ifndef MP-WEIXIN
  logger.log('[Subscribe] 非微信环境，跳过订阅消息');
  return { success: false, results: {} };
  // #endif
}

/**
 * 检查是否已获得订阅授权
 * @param {string} templateId - 模板 ID
 * @returns {boolean}
 */
export function isSubscribed(templateId) {
  try {
    const auth = JSON.parse(uni.getStorageSync('subscribe_auth') || '{}');
    return auth[templateId] === 'accept';
  } catch {
    return false;
  }
}

/**
 * 在合适时机请求订阅授权
 * 策略：每天最多请求一次，避免骚扰用户
 */
export async function smartRequestSubscription() {
  try {
    const lastAsk = uni.getStorageSync('subscribe_last_ask') || '';
    const today = new Date().toISOString().split('T')[0];
    if (lastAsk === today) return; // 今天已经问过了

    uni.setStorageSync('subscribe_last_ask', today);
    await requestSubscription();
  } catch (_e) {
    // 静默失败
  }
}

/**
 * 获取模板 ID 配置（供外部检查是否已配置）
 */
export function getTemplateIds() {
  return { ...TEMPLATE_IDS };
}
