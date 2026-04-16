/**
 * FSRS 间隔重复记忆调度 Composable
 *
 * 封装 FSRS 卡片状态加载、评分预览、调度持久化、错题调度等逻辑。
 * 从 do-quiz.vue Options API 提取，供 Composition API 迁移使用。
 *
 * @module composables/useQuizFSRS
 * @example
 *   const fsrs = useQuizFSRS();
 *   await fsrs.loadMemoryState(questionId);
 *   const preview = fsrs.previewRatings(questionId);
 *   await fsrs.rateAndSchedule(questionId, Rating.Good);
 */

import { ref } from 'vue';
import {
  scheduleAndSave,
  previewSchedule,
  formatInterval as _formatInterval,
  loadCardState,
  createNewCard
} from '@/services/fsrs-service.js';
import { scheduleMistakeReview } from '../utils/mistake-fsrs-scheduler.js';
import { triggerOptimization } from '../services/fsrs-optimizer-client.js';
import { logger } from '@/utils/logger.js';

/** @type {string} 日志前缀 */
const TAG = '[useQuizFSRS]';

/**
 * FSRS 间隔重复调度 Composable
 *
 * @returns {{
 *   memoryState: import('vue').Ref<Object|null>,
 *   fsrsPreview: import('vue').Ref<Object|null>,
 *   loadMemoryState: (questionId: string) => Object|null,
 *   previewRatings: (questionId: string) => Object|null,
 *   rateAndSchedule: (questionId: string, rating: number) => Object|null,
 *   formatInterval: (days: number) => string,
 *   scheduleMistakeForReview: (mistakeData: Object, rating: 'again'|'hard'|'good'|'easy') => Object|null,
 *   triggerOptimize: () => void,
 * }}
 */
export function useQuizFSRS() {
  // ---------------------------------------------------------------------------
  // 响应式状态
  // ---------------------------------------------------------------------------

  /** FSRS 记忆引擎卡片状态 { card, log } */
  const memoryState = ref(null);

  /** FSRS 4 种评分预览数据 { again, hard, good, easy } */
  const fsrsPreview = ref(null);

  // ---------------------------------------------------------------------------
  // 方法
  // ---------------------------------------------------------------------------

  /**
   * 加载题目的 FSRS 卡片记忆状态
   *
   * 先尝试从本地存储读取已有状态，不存在则创建新卡片。
   *
   * @param {string} questionId - 题目唯一 ID
   * @returns {Object|null} 卡片状态对象，失败返回 null
   */
  function loadMemoryState(questionId) {
    try {
      if (!questionId) {
        logger.warn(TAG, 'loadMemoryState: questionId 为空');
        return null;
      }

      // 尝试读取已有卡片状态
      let cardState = loadCardState(questionId);

      // 不存在则创建新卡片
      if (!cardState) {
        cardState = createNewCard();
        logger.log(TAG, '为题目创建新 FSRS 卡片', questionId);
      }

      memoryState.value = cardState;
      return cardState;
    } catch (error) {
      logger.error(TAG, '加载记忆状态失败', questionId, error);
      memoryState.value = null;
      return null;
    }
  }

  /**
   * 预览 4 种评分（Again / Hard / Good / Easy）对应的下次复习时间
   *
   * 需要先调用 loadMemoryState 确保 memoryState 已就绪。
   *
   * @param {string} questionId - 题目唯一 ID（用于兜底加载卡片）
   * @returns {Object|null} { again, hard, good, easy } 每项含 { nextDue, intervalDays }
   */
  function previewRatings(questionId) {
    try {
      // 确保卡片状态已加载
      let card = memoryState.value;
      if (!card && questionId) {
        card = loadMemoryState(questionId);
      }
      if (!card) {
        logger.warn(TAG, 'previewRatings: 无可用卡片状态');
        fsrsPreview.value = null;
        return null;
      }

      // previewSchedule 接收 card 对象
      const preview = previewSchedule(card);
      fsrsPreview.value = preview;
      return preview;
    } catch (error) {
      logger.error(TAG, '预览评分失败', questionId, error);
      fsrsPreview.value = null;
      return null;
    }
  }

  /**
   * 执行评分并持久化调度结果
   *
   * 调用后会自动更新 memoryState 为最新卡片状态。
   *
   * @param {string} questionId - 题目唯一 ID
   * @param {1|2|3|4} rating - FSRS 评分（1=Again, 2=Hard, 3=Good, 4=Easy）
   * @returns {Object|null} 调度结果，含 { card, log, questionId } 等，失败返回 null
   */
  function rateAndSchedule(questionId, rating) {
    try {
      if (!questionId) {
        logger.warn(TAG, 'rateAndSchedule: questionId 为空');
        return null;
      }

      const result = scheduleAndSave(questionId, rating);

      // 同步更新本地记忆状态
      if (result?.card) {
        memoryState.value = result.card;
      }

      logger.log(TAG, '评分调度完成', questionId, `rating=${rating}`);
      return result;
    } catch (error) {
      logger.error(TAG, '评分调度失败', questionId, error);
      return null;
    }
  }

  /**
   * 格式化间隔天数为人类可读文本
   *
   * @param {number} days - 间隔天数
   * @returns {string} 例如 "10分钟"、"1天"、"2.5个月"
   */
  function formatInterval(days) {
    try {
      return _formatInterval(days);
    } catch (error) {
      logger.error(TAG, '格式化间隔失败', days, error);
      return '';
    }
  }

  /**
   * 将错题安排进 FSRS 复习调度
   *
   * @param {Object} mistakeData - 错题数据（需包含 questionId、用户作答等信息）
   * @param {'again'|'hard'|'good'|'easy'} rating - 评分字符串
   * @returns {Object|null} 调度结果（FSRS 字段对象），失败返回 null
   */
  function scheduleMistakeForReview(mistakeData, rating) {
    try {
      if (!mistakeData) {
        logger.warn(TAG, 'scheduleMistakeForReview: mistakeData 为空');
        return null;
      }

      const result = scheduleMistakeReview(mistakeData, rating);
      logger.log(TAG, '错题已加入复习调度', mistakeData?.questionId);
      return result;
    } catch (error) {
      logger.error(TAG, '错题调度失败', error);
      return null;
    }
  }

  /**
   * 触发后台 FSRS 参数优化
   *
   * 静默执行，不阻塞用户操作。建议每积累 50 条复习记录后调用。
   */
  function triggerOptimize() {
    try {
      // 异步执行，不等待结果
      triggerOptimization().catch((error) => {
        logger.warn(TAG, '后台参数优化失败（静默忽略）', error);
      });
    } catch (error) {
      logger.warn(TAG, '触发优化异常', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 导出
  // ---------------------------------------------------------------------------

  return {
    // 响应式状态
    memoryState,
    fsrsPreview,

    // 方法
    loadMemoryState,
    previewRatings,
    rateAndSchedule,
    formatInterval,
    scheduleMistakeForReview,
    triggerOptimize
  };
}
