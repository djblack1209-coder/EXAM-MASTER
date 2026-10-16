/**
 * 答题进度自动保存组合式函数
 * ✅ P0-3 新增：解决用户努力随时归零问题
 * ✅ 检查点2.1：增加防抖机制（500ms）
 *
 * 功能：
 * 1. 每答一题自动保存进度到 localStorage（带防抖）
 * 2. 页面退出/被杀死时保存进度
 * 3. 重新进入时自动恢复进度
 * 4. 支持断点续答
 */

import storageService from '@/services/storageService.js';
import { captureSession, checkSession } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';
import {
  isValidQuizSessionId,
  isValidQuizAttemptId,
  isSeededPracticeRecord
} from '@/services/quiz-session-contract.js';

const QUIZ_PROGRESS_KEY = 'EXAM_QUIZ_PROGRESS';
const QUIZ_PROGRESS_TIMESTAMP_KEY = 'EXAM_QUIZ_PROGRESS_TIME';
const PROGRESS_EXPIRE_TIME = 24 * 60 * 60 * 1000;

let saveDebounceTimer = null;
const DEBOUNCE_DELAY = 500;

export function saveQuizProgress(progress, immediate = false, context = null, session = captureSession()) {
  if (checkSession(session) !== 'current') return false;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = null;
  const current = () => checkSession(session) === 'current';
  let snapshot, frozenContext;
  try {
    snapshot = JSON.parse(JSON.stringify(progress));
    frozenContext = context ? JSON.parse(JSON.stringify(context)) : null;
  } catch {
    return false;
  }
  if (immediate) return current() && doSaveProgress(snapshot, frozenContext, session);
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    if (current()) doSaveProgress(snapshot, frozenContext, session);
  }, DEBOUNCE_DELAY);
  return true;
}

function doSaveProgress(progress, context = null, session = captureSession()) {
  try {
    if (progress.sessionId !== undefined && progress.sessionId !== '' && !isValidQuizSessionId(progress.sessionId)) {
      logger.warn('[QuizAutoSave] 会话标识无效，原记录已保留');
      return false;
    }
    const normalizedContext = normalizeProgressContext(context);
    const data = {
      currentIndex: progress.currentIndex || 0,
      userChoice: progress.userChoice,
      hasAnswered: progress.hasAnswered || false,
      seconds: progress.seconds || 0,
      aiComment: progress.aiComment || '',
      answeredQuestions: progress.answeredQuestions || [],
      questions: Array.isArray(progress.questions) ? progress.questions : undefined,
      context: normalizedContext,
      contextKey: normalizedContext ? buildProgressContextKey(normalizedContext) : '',
      savedAt: Date.now(),
      version: '1.2.0'
    };
    if (progress.sessionId) data.sessionId = progress.sessionId;
    if (progress.questionTiming) data.questionTiming = { ...progress.questionTiming };
    if (!isValidProgressData(data)) return false;

    if (storageService.save(QUIZ_PROGRESS_KEY, data, true, session) !== true) return false;
    const saved = storageService.get(QUIZ_PROGRESS_KEY, null, { migrateLegacy: false, throwOnError: true, session });
    if (JSON.stringify(saved) !== JSON.stringify(data)) return false;

    logger.log('[QuizAutoSave] 进度已保存:', {
      currentIndex: data.currentIndex,
      seconds: data.seconds,
      answeredCount: data.answeredQuestions.length,
      contextKey: data.contextKey
    });

    return true;
  } catch (error) {
    logger.error('[QuizAutoSave] 保存进度失败:', error);
    return false;
  }
}

export function loadQuizProgress(context = null) {
  try {
    const dataRaw = storageService.get(QUIZ_PROGRESS_KEY, null, { migrateLegacy: false, throwOnError: true });
    if (!dataRaw) return null;
    const data = typeof dataRaw === 'string' ? JSON.parse(dataRaw) : dataRaw;
    const timestamp =
      data?.version === '1.2.0'
        ? data.savedAt
        : Number(storageService.get(QUIZ_PROGRESS_TIMESTAMP_KEY, null, { migrateLegacy: false, throwOnError: true }));
    if (!Number.isFinite(timestamp) || timestamp <= 0 || Date.now() - timestamp > PROGRESS_EXPIRE_TIME) return null;

    if (!isValidProgressData(data)) {
      logger.warn('[QuizAutoSave] 进度数据结构无效，保留记录');
      return null;
    }
    if (Array.isArray(data.questions) && data.questions.some(isSeededPracticeRecord)) return null;

    if (!isProgressContextMatch(data, context)) {
      logger.log('[QuizAutoSave] 存档上下文不匹配，跳过恢复');
      return null;
    }

    logger.log('[QuizAutoSave] 加载进度成功:', {
      currentIndex: data.currentIndex,
      seconds: data.seconds,
      savedAt: new Date(data.savedAt).toLocaleString()
    });

    return data;
  } catch {
    logger.warn('[QuizAutoSave] 记录无法读取，原记录已保留');
    return null;
  }
}

export function clearQuizProgress(session = captureSession()) {
  if (checkSession(session) !== 'current') return false;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = null;
  try {
    storageService.remove(QUIZ_PROGRESS_KEY, true, session);
    storageService.remove(QUIZ_PROGRESS_TIMESTAMP_KEY, true, session);
    logger.log('[QuizAutoSave] 进度已清除');
    return true;
  } catch (error) {
    logger.error('[QuizAutoSave] 清除进度失败:', error);
    return false;
  }
}

export function hasUnfinishedProgress(context = null) {
  const progress = loadQuizProgress(context);
  return (
    progress !== null &&
    !isQuizProgressComplete(progress) &&
    (progress.currentIndex > 0 || progress.answeredQuestions.length > 0)
  );
}

export function isQuizProgressComplete(progress) {
  const questions = progress?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return false;
  const answered = new Set();
  for (const record of progress.answeredQuestions || []) {
    if (record?.source === 'reference_view' || record?.userChoice === 'flashcard_flip') continue;
    if (
      Number.isInteger(record?.index) &&
      record.index >= 0 &&
      record.index < questions.length &&
      (questions[record.index]?.id ?? questions[record.index]?._id) != null &&
      String(record.questionId ?? '') === String(questions[record.index]?.id ?? questions[record.index]?._id ?? '')
    )
      answered.add(record.index);
  }
  return answered.size === questions.length;
}

export function getRecoverableQuizProgress() {
  const progress = loadQuizProgress();
  if (!progress || !Array.isArray(progress.questions) || !progress.questions.length) return null;
  const questions = progress.questions;
  if (progress.currentIndex >= questions.length || isQuizProgressComplete(progress)) return null;
  if (
    questions.some((q) => {
      const id = q?.id ?? q?._id;
      const text = q?.question || q?.title;
      return (
        !['string', 'number'].includes(typeof id) ||
        (typeof id === 'number' && !Number.isFinite(id)) ||
        !String(id).trim() ||
        typeof text !== 'string' ||
        !text.trim()
      );
    })
  )
    return null;
  if (
    progress.answeredQuestions.some(
      (record) =>
        !Number.isInteger(record?.index) ||
        record.index < 0 ||
        record.index >= questions.length ||
        String(record.questionId ?? '') !== String(questions[record.index].id ?? questions[record.index]._id)
    )
  )
    return null;
  return progress.currentIndex > 0 || progress.answeredQuestions.length > 0 ? progress : null;
}

export function getProgressSummary(context = null) {
  const progress = loadQuizProgress(context);
  if (!progress) return null;

  const savedAt = new Date(progress.savedAt);
  const diffMinutes = Math.floor((Date.now() - savedAt.getTime()) / 1000 / 60);

  let timeAgo;
  if (diffMinutes < 1) {
    timeAgo = '刚刚';
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes}分钟前`;
  } else if (diffMinutes < 1440) {
    timeAgo = `${Math.floor(diffMinutes / 60)}小时前`;
  } else {
    timeAgo = `${Math.floor(diffMinutes / 1440)}天前`;
  }

  return {
    currentIndex: progress.currentIndex,
    answeredCount: progress.answeredQuestions?.length || 0,
    totalQuestions: Array.isArray(progress.questions) ? progress.questions.length : 0,
    seconds: progress.seconds,
    timeAgo,
    formattedTime: formatSeconds(progress.seconds)
  };
}

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

function isValidProgressData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Number.isInteger(data.currentIndex) || data.currentIndex < 0) return false;
  if (typeof data.seconds !== 'number' || !Number.isFinite(data.seconds) || data.seconds < 0) return false;
  if (!Array.isArray(data.answeredQuestions)) return false;
  if (
    data.answeredQuestions.some((record) => record?.attemptId !== undefined && !isValidQuizAttemptId(record.attemptId))
  )
    return false;
  if (typeof data.hasAnswered !== 'boolean') return false;
  if (data.questions !== undefined && !Array.isArray(data.questions)) return false;
  if (data.sessionId !== undefined && !isValidQuizSessionId(data.sessionId)) return false;
  if (data.questionTiming) {
    const timing = data.questionTiming;
    if (
      timing.index !== data.currentIndex ||
      timing.questionId !== data.questions?.[timing.index]?.id ||
      !Number.isFinite(timing.elapsedMs) ||
      timing.elapsedMs < 0 ||
      timing.elapsedMs > 86400000
    )
      return false;
  }
  return true;
}

function normalizeProgressContext(context) {
  if (!context || typeof context !== 'object') return null;
  const normalized = {};
  const copyString = (key) => {
    const value = context[key];
    if (value !== undefined && value !== null && String(value) !== '') {
      normalized[key] = String(value);
    }
  };

  copyString('mode');
  copyString('paperId');
  copyString('questionBankFingerprint');
  copyString('handoffId');

  if (Array.isArray(context.questionIds)) {
    normalized.questionIds = context.questionIds.map((id) => String(id ?? '')).filter(Boolean);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function buildProgressContextKey(context) {
  const normalized = normalizeProgressContext(context);
  if (!normalized) return '';
  return JSON.stringify({
    mode: normalized.mode || '',
    paperId: normalized.paperId || '',
    questionBankFingerprint: normalized.questionBankFingerprint || '',
    questionIds: normalized.questionIds || [],
    ...(normalized.handoffId ? { handoffId: normalized.handoffId } : {})
  });
}

function isProgressContextMatch(progress, context) {
  const expectedContext = normalizeProgressContext(context);
  if (!expectedContext) return true;

  const expectedKey = buildProgressContextKey(expectedContext);
  if (!progress.contextKey) {
    return false;
  }

  return progress.contextKey === expectedKey;
}

export function useQuizAutoSave() {
  return {
    saveProgress: saveQuizProgress,
    loadProgress: loadQuizProgress,
    clearProgress: clearQuizProgress,
    hasUnfinished: hasUnfinishedProgress,
    getSummary: getProgressSummary
  };
}

export default {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary,
  useQuizAutoSave
};
