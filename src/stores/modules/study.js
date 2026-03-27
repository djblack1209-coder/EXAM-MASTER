/**
 * 学习进度状态管理（核心指标聚合）
 *
 * 跟踪用户的做题进度、正确率、学习时长等核心学习指标。
 * 数据通过 storageService 持久化到本地，支持断点恢复。
 *
 * 职责边界：
 * - study.js：聚合指标（总题数、正确率、学习天数），面向首页/个人中心展示
 * - learning-trajectory-store.js：细粒度轨迹（事件流、知识点掌握度、会话），面向学习路径分析
 * 两者的 recordAnswer 语义不同：study 更新聚合计数，trajectory 记录事件流
 *
 * @module stores/study
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import config from '@/config/index.js';
const APP_CONFIG = { cacheKeys: config.storage.cacheKeys };
import { storageService } from '../../services/storageService.js';

export const useStudyStore = defineStore('study', () => {
  /** @type {import('vue').Ref<Object>} 学习进度汇总数据 */
  const studyProgress = ref({
    totalQuestions: 0,
    completedQuestions: 0,
    correctQuestions: 0,
    studyDays: 0,
    studyMinutes: 0,
    lastStudyDate: null
  });

  /** @type {import('vue').Ref<Object|null>} 当前正在作答的题目 */
  const currentQuestion = ref(null);

  /** @type {import('vue').Ref<Array<Object>>} 最近答题记录（最多 100 条） */
  const questionHistory = ref([]);

  /** @type {import('vue').ComputedRef<number>} 完成率百分比（保留一位小数） */
  const completionRate = computed(() => {
    const { totalQuestions, completedQuestions } = studyProgress.value;
    if (totalQuestions === 0) return 0;
    return Math.round((completedQuestions / totalQuestions) * 1000) / 10;
  });

  /** @type {import('vue').ComputedRef<number>} 正确率百分比（保留一位小数） */
  const accuracy = computed(() => {
    const { completedQuestions, correctQuestions } = studyProgress.value;
    if (completedQuestions === 0) return 0;
    return Math.round((correctQuestions / completedQuestions) * 1000) / 10;
  });

  /**
   * 更新学习进度（增量合并）
   * @param {Object} progress - 要合并的进度字段
   * @param {number} [progress.totalQuestions] - 总题目数
   * @param {number} [progress.completedQuestions] - 已完成题目数
   * @param {number} [progress.studyMinutes] - 学习分钟数
   */
  const updateProgress = (progress) => {
    studyProgress.value = { ...studyProgress.value, ...progress };
    // 持久化存储
    saveProgress();
  };

  /**
   * 设置当前正在作答的题目
   * @param {Object|null} question - 题目对象，null 表示清除
   */
  const setCurrentQuestion = (question) => {
    currentQuestion.value = question;
  };

  /**
   * 添加答题记录到历史（最多保留 100 条）
   * @param {Object} record - 答题记录 { questionId, isCorrect, timeSpent, timestamp }
   */
  const addQuestionHistory = (record) => {
    questionHistory.value.unshift(record);
    // 限制历史记录数量
    if (questionHistory.value.length > 100) {
      questionHistory.value = questionHistory.value.slice(0, 100);
    }
  };

  /**
   * 记录单次答题结果，自动更新进度并持久化
   * @param {string} questionId - 题目 ID
   * @param {boolean} isCorrect - 是否回答正确
   * @param {number} timeSpent - 答题耗时（毫秒）
   */
  const recordAnswer = (questionId, isCorrect, timeSpent) => {
    const record = {
      questionId,
      isCorrect,
      timeSpent,
      timestamp: Date.now()
    };

    addQuestionHistory(record);

    // 更新进度
    studyProgress.value.completedQuestions++;
    if (isCorrect) {
      studyProgress.value.correctQuestions++;
    }

    saveProgress();
  };

  /**
   * 持久化当前进度和答题历史到本地存储
   * 静默失败，不会弹出错误提示
   */
  const saveProgress = () => {
    storageService.save(
      APP_CONFIG.cacheKeys.studyProgress,
      {
        progress: studyProgress.value,
        history: questionHistory.value
      },
      true
    ); // 静默失败，避免频繁提示
  };

  /**
   * 从本地缓存恢复进度数据（App 启动时调用）
   */
  const restoreProgress = () => {
    const cached = storageService.get(APP_CONFIG.cacheKeys.studyProgress, null);
    if (cached) {
      if (cached.progress) {
        studyProgress.value = cached.progress;
      }
      if (cached.history) {
        questionHistory.value = cached.history;
      }
    }
  };

  /**
   * 重置所有学习进度和答题历史（清零）
   */
  const resetProgress = () => {
    studyProgress.value = {
      totalQuestions: 0,
      completedQuestions: 0,
      correctQuestions: 0,
      studyDays: 0,
      studyMinutes: 0,
      lastStudyDate: null
    };
    questionHistory.value = [];
    currentQuestion.value = null;
    saveProgress();
  };

  return {
    // 状态
    studyProgress,
    currentQuestion,
    questionHistory,
    completionRate,
    accuracy,

    // 方法
    updateProgress,
    setCurrentQuestion,
    addQuestionHistory,
    recordAnswer,
    saveProgress,
    restoreProgress,
    resetProgress
  };
});
