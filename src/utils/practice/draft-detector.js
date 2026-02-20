/**
 * 草稿检测器 - 检查点2.2
 * 用于检测用户是否有未完成的练习进度
 *
 * 功能：
 * 1. 检测本地存储中的草稿数据
 * 2. 验证草稿有效性（未过期、数据完整）
 * 3. 提供草稿摘要信息
 */

// 存储键名
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const DRAFT_KEYS = {
  QUIZ_PROGRESS: 'EXAM_QUIZ_PROGRESS',
  QUIZ_TIMESTAMP: 'EXAM_QUIZ_PROGRESS_TIME',
  PK_DRAFT: 'EXAM_PK_DRAFT',
  IMPORT_DRAFT: 'EXAM_IMPORT_DRAFT'
};

// 草稿过期时间（24小时）
const DRAFT_EXPIRE_TIME = 24 * 60 * 60 * 1000;

/**
 * 检测是否有未完成的练习
 * @returns {Object|null} 草稿信息，无草稿返回null
 */
export function detectUnfinishedPractice() {
  try {
    const progressStr = storageService.get(DRAFT_KEYS.QUIZ_PROGRESS);
    const timestampStr = storageService.get(DRAFT_KEYS.QUIZ_TIMESTAMP);

    if (!progressStr || !timestampStr) {
      logger.log('[DraftDetector] 无保存的练习进度');
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    // 检查是否过期
    if (now - timestamp > DRAFT_EXPIRE_TIME) {
      logger.log('[DraftDetector] 练习进度已过期，清除');
      clearDraft('quiz');
      return null;
    }

    let progress;
    try {
      // storageService.get 可能返回对象或字符串，兼容两种情况
      progress = typeof progressStr === 'string' ? JSON.parse(progressStr) : progressStr;
    } catch (parseError) {
      logger.error('[DraftDetector] JSON解析失败，清除无效草稿:', parseError);
      clearDraft('quiz');
      return null;
    }

    // 验证数据完整性
    if (!progress || typeof progress.currentIndex !== 'number') {
      logger.log('[DraftDetector] 练习进度数据不完整');
      clearDraft('quiz');
      return null;
    }

    // 验证题库是否仍然存在（防止题库被清空后恢复到空白状态）
    const bankData = storageService.get('v30_bank', []);
    if (!Array.isArray(bankData) || bankData.length === 0) {
      logger.log('[DraftDetector] 题库已清空，草稿无效');
      clearDraft('quiz');
      return null;
    }

    // 只有真正开始答题才算有草稿
    if (
      progress.currentIndex === 0 &&
      !progress.hasAnswered &&
      (!progress.answeredQuestions || progress.answeredQuestions.length === 0)
    ) {
      logger.log('[DraftDetector] 练习未真正开始，不算草稿');
      return null;
    }

    // 计算时间差
    const savedAt = new Date(progress.savedAt || timestamp);
    const diffMinutes = Math.floor((now - savedAt.getTime()) / 1000 / 60);

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

    // 格式化用时
    const seconds = progress.seconds || 0;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const formattedTime = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

    const draftInfo = {
      type: 'quiz',
      currentIndex: progress.currentIndex,
      answeredCount: progress.answeredQuestions?.length || 0,
      seconds: progress.seconds,
      timeAgo,
      formattedTime,
      savedAt: progress.savedAt || timestamp,
      // 用于恢复的完整数据
      fullData: progress
    };

    logger.log('[DraftDetector] 检测到未完成的练习:', draftInfo);
    return draftInfo;
  } catch (error) {
    logger.error('[DraftDetector] 检测草稿失败:', error);
    return null;
  }
}

/**
 * 检测是否有未完成的PK对战
 * @returns {Object|null} PK草稿信息
 */
export function detectUnfinishedPK() {
  try {
    const draftStr = storageService.get(DRAFT_KEYS.PK_DRAFT);
    if (!draftStr) return null;

    let draft;
    try {
      // [AUDIT FIX] storageService.get 可能返回已解析的对象，兼容两种情况
      draft = typeof draftStr === 'string' ? JSON.parse(draftStr) : draftStr;
    } catch (parseError) {
      logger.error('[DraftDetector] PK草稿JSON解析失败，清除无效数据:', parseError);
      clearDraft('pk');
      return null;
    }

    const now = Date.now();

    // PK草稿过期时间较短（1小时）
    if (now - (draft.savedAt || 0) > 60 * 60 * 1000) {
      clearDraft('pk');
      return null;
    }

    return {
      type: 'pk',
      ...draft
    };
  } catch (error) {
    logger.error('[DraftDetector] 检测PK草稿失败:', error);
    return null;
  }
}

/**
 * 检测是否有未完成的导入任务
 * @returns {Object|null} 导入草稿信息
 */
export function detectUnfinishedImport() {
  try {
    const draftStr = storageService.get(DRAFT_KEYS.IMPORT_DRAFT);
    if (!draftStr) return null;

    let draft;
    try {
      // [AUDIT FIX] storageService.get 可能返回已解析的对象，兼容两种情况
      draft = typeof draftStr === 'string' ? JSON.parse(draftStr) : draftStr;
    } catch (parseError) {
      logger.error('[DraftDetector] 导入草稿JSON解析失败，清除无效数据:', parseError);
      clearDraft('import');
      return null;
    }

    const now = Date.now();

    // 导入草稿过期时间（12小时）
    if (now - (draft.savedAt || 0) > 12 * 60 * 60 * 1000) {
      clearDraft('import');
      return null;
    }

    return {
      type: 'import',
      fileName: draft.fileName,
      progress: draft.progress,
      generatedCount: draft.generatedCount,
      ...draft
    };
  } catch (error) {
    logger.error('[DraftDetector] 检测导入草稿失败:', error);
    return null;
  }
}

/**
 * 检测所有类型的草稿
 * @returns {Array} 所有草稿列表
 */
export function detectAllDrafts() {
  const drafts = [];

  const quizDraft = detectUnfinishedPractice();
  if (quizDraft) drafts.push(quizDraft);

  const pkDraft = detectUnfinishedPK();
  if (pkDraft) drafts.push(pkDraft);

  const importDraft = detectUnfinishedImport();
  if (importDraft) drafts.push(importDraft);

  return drafts;
}

/**
 * 清除指定类型的草稿
 * @param {string} type - 草稿类型：quiz, pk, import, all
 */
export function clearDraft(type = 'all') {
  try {
    if (type === 'quiz' || type === 'all') {
      storageService.remove(DRAFT_KEYS.QUIZ_PROGRESS);
      storageService.remove(DRAFT_KEYS.QUIZ_TIMESTAMP);
    }
    if (type === 'pk' || type === 'all') {
      storageService.remove(DRAFT_KEYS.PK_DRAFT);
    }
    if (type === 'import' || type === 'all') {
      storageService.remove(DRAFT_KEYS.IMPORT_DRAFT);
    }
    logger.log('[DraftDetector] 已清除草稿:', type);
  } catch (error) {
    logger.error('[DraftDetector] 清除草稿失败:', error);
  }
}

/**
 * 保存PK草稿
 * @param {Object} data - PK进度数据
 */
export function savePKDraft(data) {
  try {
    const draft = {
      ...data,
      savedAt: Date.now()
    };
    storageService.save(DRAFT_KEYS.PK_DRAFT, JSON.stringify(draft));
    logger.log('[DraftDetector] PK草稿已保存');
  } catch (error) {
    logger.error('[DraftDetector] 保存PK草稿失败:', error);
  }
}

/**
 * 保存导入草稿
 * @param {Object} data - 导入进度数据
 */
export function saveImportDraft(data) {
  try {
    const draft = {
      ...data,
      savedAt: Date.now()
    };
    storageService.save(DRAFT_KEYS.IMPORT_DRAFT, JSON.stringify(draft));
    logger.log('[DraftDetector] 导入草稿已保存');
  } catch (error) {
    logger.error('[DraftDetector] 保存导入草稿失败:', error);
  }
}

export default {
  detectUnfinishedPractice,
  detectUnfinishedPK,
  detectUnfinishedImport,
  detectAllDrafts,
  clearDraft,
  savePKDraft,
  saveImportDraft,
  DRAFT_KEYS
};
