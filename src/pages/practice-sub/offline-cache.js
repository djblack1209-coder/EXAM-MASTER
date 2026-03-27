/**
 * 离线缓存工具 — do-quiz / quiz-analytics-recorder 使用
 */
import { logger } from '@/utils/logger.js';

export function checkOfflineAvailability() {
  try {
    const bank = uni.getStorageSync('v30_bank');
    return Array.isArray(bank) && bank.length > 0;
  } catch {
    return false;
  }
}

export async function saveOfflineAnswer(answerData) {
  try {
    const key = 'EXAM_OFFLINE_ANSWERS';
    const existing = uni.getStorageSync(key) || [];
    existing.push({ ...answerData, savedAt: Date.now() });
    uni.setStorageSync(key, existing);
    return true;
  } catch (err) {
    logger.warn('[OfflineCache] saveOfflineAnswer failed:', err);
    return false;
  }
}
