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
 *
 * 使用方式：
 * import { useQuizAutoSave } from '@/composables/useQuizAutoSave'
 * const { saveProgress, loadProgress, clearProgress } = useQuizAutoSave()
 */

// 存储键名
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const QUIZ_PROGRESS_KEY = 'EXAM_QUIZ_PROGRESS';
const QUIZ_PROGRESS_TIMESTAMP_KEY = 'EXAM_QUIZ_PROGRESS_TIME';

// 进度过期时间（24小时）
const PROGRESS_EXPIRE_TIME = 24 * 60 * 60 * 1000;

// ✅ 检查点2.1：防抖定时器
let saveDebounceTimer = null;
const DEBOUNCE_DELAY = 500; // 500ms 防抖延迟

/**
 * 保存答题进度（带防抖）
 * @param {Object} progress - 进度数据
 * @param {number} progress.currentIndex - 当前题目索引
 * @param {number|null} progress.userChoice - 用户选择
 * @param {boolean} progress.hasAnswered - 是否已作答
 * @param {number} progress.seconds - 答题用时（秒）
 * @param {string} progress.aiComment - AI 解析内容
 * @param {Array} progress.answeredQuestions - 已答题目记录
 * @param {boolean} immediate - 是否立即保存（跳过防抖）
 * @returns {boolean} 是否保存成功
 */
export function saveQuizProgress(progress, immediate = false) {
  // 立即保存模式（用于页面退出等紧急情况）
  if (immediate) {
    return doSaveProgress(progress);
  }

  // ✅ 检查点2.1：防抖保存
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    doSaveProgress(progress);
    saveDebounceTimer = null;
  }, DEBOUNCE_DELAY);

  return true;
}

/**
 * 实际执行保存操作
 * @param {Object} progress - 进度数据
 * @returns {boolean} 是否保存成功
 */
function doSaveProgress(progress) {
  try {
    const data = {
      currentIndex: progress.currentIndex || 0,
      userChoice: progress.userChoice,
      hasAnswered: progress.hasAnswered || false,
      seconds: progress.seconds || 0,
      aiComment: progress.aiComment || '',
      answeredQuestions: progress.answeredQuestions || [],
      // 元数据
      savedAt: Date.now(),
      version: '1.0.0'
    };

    storageService.save(QUIZ_PROGRESS_KEY, data);
    storageService.save(QUIZ_PROGRESS_TIMESTAMP_KEY, Date.now().toString());

    logger.log('[QuizAutoSave] 进度已保存:', {
      currentIndex: data.currentIndex,
      seconds: data.seconds,
      answeredCount: data.answeredQuestions.length
    });

    return true;
  } catch (error) {
    logger.error('[QuizAutoSave] 保存进度失败:', error);
    return false;
  }
}

/**
 * 加载答题进度
 * @returns {Object|null} 进度数据，如果不存在或已过期返回 null
 */
export function loadQuizProgress() {
  try {
    const dataRaw = storageService.get(QUIZ_PROGRESS_KEY);
    const timestampStr = storageService.get(QUIZ_PROGRESS_TIMESTAMP_KEY);

    if (!dataRaw || !timestampStr) {
      logger.log('[QuizAutoSave] 无保存的进度');
      return null;
    }

    const timestamp = Number(timestampStr);
    if (!Number.isFinite(timestamp)) {
      logger.warn('[QuizAutoSave] 进度时间戳无效，清除损坏数据');
      clearQuizProgress();
      return null;
    }

    const now = Date.now();

    // 检查是否过期
    if (now - timestamp > PROGRESS_EXPIRE_TIME) {
      logger.log('[QuizAutoSave] 进度已过期，清除');
      clearQuizProgress();
      return null;
    }

    const data = typeof dataRaw === 'string' ? JSON.parse(dataRaw) : dataRaw;
    if (!isValidProgressData(data)) {
      logger.warn('[QuizAutoSave] 进度数据结构无效，清除损坏数据');
      clearQuizProgress();
      return null;
    }

    logger.log('[QuizAutoSave] 加载进度成功:', {
      currentIndex: data.currentIndex,
      seconds: data.seconds,
      savedAt: new Date(data.savedAt).toLocaleString()
    });

    return data;
  } catch (error) {
    logger.error('[QuizAutoSave] 加载进度失败:', error);
    // 损坏数据清理，防止每次启动重复失败
    try {
      storageService.remove(QUIZ_PROGRESS_KEY);
      storageService.remove(QUIZ_PROGRESS_TIMESTAMP_KEY);
    } catch (_) {
      /* ignore */
    }
    return null;
  }
}

/**
 * 清除答题进度
 * @returns {boolean} 是否清除成功
 */
export function clearQuizProgress() {
  try {
    storageService.remove(QUIZ_PROGRESS_KEY);
    storageService.remove(QUIZ_PROGRESS_TIMESTAMP_KEY);
    logger.log('[QuizAutoSave] 进度已清除');
    return true;
  } catch (error) {
    logger.error('[QuizAutoSave] 清除进度失败:', error);
    return false;
  }
}

/**
 * 检查是否有未完成的进度
 * @returns {boolean} 是否有未完成的进度
 */
export function hasUnfinishedProgress() {
  const progress = loadQuizProgress();
  return progress !== null && progress.currentIndex > 0;
}

/**
 * 获取进度摘要（用于显示恢复提示）
 * @returns {Object|null} 进度摘要
 */
export function getProgressSummary() {
  const progress = loadQuizProgress();
  if (!progress) return null;

  const savedAt = new Date(progress.savedAt);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - savedAt.getTime()) / 1000 / 60);

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
    seconds: progress.seconds,
    timeAgo,
    formattedTime: formatSeconds(progress.seconds)
  };
}

/**
 * 格式化秒数为 mm:ss 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间
 */
function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

function isValidProgressData(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.currentIndex !== 'number') return false;
  if (typeof data.seconds !== 'number') return false;
  if (!Array.isArray(data.answeredQuestions)) return false;
  if (typeof data.hasAnswered !== 'boolean') return false;
  return true;
}

/**
 * 组合式函数导出
 */
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
