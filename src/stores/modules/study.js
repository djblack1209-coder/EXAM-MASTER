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

  /** @type {import('vue').Ref<Array<Object>>} 最近答题记录（最多 100 条） */
  const questionHistory = ref([]);

  /** @type {import('vue').ComputedRef<number>} 正确率百分比（保留一位小数） */
  const accuracy = computed(() => {
    const { completedQuestions, correctQuestions } = studyProgress.value;
    if (completedQuestions === 0) return 0;
    return Math.round((correctQuestions / completedQuestions) * 1000) / 10;
  });

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

  const persistProgress = () => {
    storageService.save(
      APP_CONFIG.cacheKeys.studyProgress,
      {
        progress: studyProgress.value,
        history: questionHistory.value
      },
      true
    );
  };

  /**
   * 记录一次真实答题，驱动首页/个人中心统计立即更新。
   * @param {{ question?: Object, isCorrect?: boolean|null, timeSpent?: number, timestamp?: number }} attempt
   */
  const recordQuestionAttempt = (attempt = {}) => {
    const question = attempt.question || {};
    const now = Number(attempt.timestamp || Date.now());
    const today = new Date(now).toISOString().split('T')[0];
    const lastDate = studyProgress.value.lastStudyDate;
    const isFirstStudyToday = lastDate !== today;
    const isCorrect = attempt.isCorrect === true;
    const attemptMinutes = Math.max(1, Math.ceil(Number(attempt.timeSpent || 0) / 60000));
    const nextProgress = {
      ...studyProgress.value,
      totalQuestions: Math.max(studyProgress.value.totalQuestions || 0, studyProgress.value.completedQuestions || 0),
      completedQuestions: (studyProgress.value.completedQuestions || 0) + 1,
      correctQuestions: (studyProgress.value.correctQuestions || 0) + (isCorrect ? 1 : 0),
      studyDays: (studyProgress.value.studyDays || 0) + (isFirstStudyToday ? 1 : 0),
      studyMinutes: (studyProgress.value.studyMinutes || 0) + attemptMinutes,
      lastStudyDate: today
    };

    nextProgress.totalQuestions = Math.max(nextProgress.totalQuestions || 0, nextProgress.completedQuestions || 0);
    studyProgress.value = nextProgress;

    questionHistory.value = [
      {
        questionId: question.id || question._id || attempt.questionId || '',
        questionType: question.type || question.category || '综合题',
        bankName: question.paperName || question.category || question.subject || '未分类',
        category: question.category || question.subject || '未分类',
        isCorrect: attempt.isCorrect,
        correct: isCorrect,
        timeSpent: Number(attempt.timeSpent || 0),
        timestamp: now
      },
      ...questionHistory.value
    ].slice(0, 100);

    persistProgress();
    return questionHistory.value[0];
  };

  /**
   * 重置 store 状态到初始值（Setup Store 手动实现）
   */
  const $reset = () => {
    studyProgress.value = {
      totalQuestions: 0,
      completedQuestions: 0,
      correctQuestions: 0,
      studyDays: 0,
      studyMinutes: 0,
      lastStudyDate: null
    };
    questionHistory.value = [];
  };

  return {
    // 状态
    studyProgress,
    questionHistory,
    accuracy,

    // 方法
    restoreProgress,
    recordQuestionAttempt,
    $reset
  };
});
