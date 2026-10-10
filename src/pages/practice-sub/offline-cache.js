/**
 * 离线缓存工具 — do-quiz / quiz-analytics-recorder 使用
 */
import { logger } from '@/utils/logger.js';
import { isValidQuizAttemptId } from '@/services/quiz-session-contract.js';

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
    const stored = uni.getStorageSync(key);
    const existing = stored === '' || stored == null ? [] : stored;
    if (!Array.isArray(existing)) return false;
    const index = isValidQuizAttemptId(answerData.attemptId)
      ? existing.findIndex((item) => item.attemptId === answerData.attemptId && item.userId === answerData.userId)
      : -1;
    const next = [...existing];
    if (index >= 0) {
      const previous = existing[index];
      // 同一账户/原编号不得覆盖原题、原会话、原答或原用时。
      if (['sessionId', 'questionId', 'userAnswer', 'timeSpent'].some((key) => previous[key] !== answerData[key]))
        return false;
      if (answerData.submission?.status !== 'received' || previous.submission?.status === 'received') return true;
      next[index] = { ...previous, submission: answerData.submission };
    } else next.push({ ...answerData, savedAt: Date.now() });
    uni.setStorageSync(key, next);
    return true;
  } catch (err) {
    logger.warn('[OfflineCache] saveOfflineAnswer failed:', err);
    return false;
  }
}
