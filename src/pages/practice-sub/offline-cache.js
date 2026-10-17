import { captureSession, assertSession } from '@/services/auth-storage.js';
import { storageService } from '@/services/storageService.js';
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

export async function saveOfflineAnswer(answerData, session = captureSession()) {
  try {
    const key = 'EXAM_OFFLINE_ANSWERS';
    assertSession(session);
    if ((answerData.userId || 'guest') !== session.owner) return false;
    const original = JSON.parse(JSON.stringify(answerData));
    return storageService.update(
      key,
      [],
      (existing) => {
        if (!Array.isArray(existing)) throw new Error('离线原答暂不可读');
        const index = isValidQuizAttemptId(original.attemptId)
          ? existing.findIndex((item) => item.attemptId === original.attemptId && item.userId === original.userId)
          : -1;
        const next = [...existing];
        if (index >= 0) {
          const previous = existing[index];
          if (['sessionId', 'questionId', 'userAnswer', 'timeSpent'].some((key) => previous[key] !== original[key]))
            throw new Error('原答编号冲突，原件保留');
          if (original.submission?.status === 'received' && previous.submission?.status !== 'received')
            next[index] = { ...previous, submission: original.submission };
        } else next.push({ ...original, savedAt: Date.now() });
        return next;
      },
      session
    );
  } catch (err) {
    logger.warn('[OfflineCache] saveOfflineAnswer failed:', err);
    return false;
  }
}
