/**
 * Review Store — 复习 & 诊断 & 题库状态管理
 *
 * 集中管理 FSRS 复习、AI 诊断、复习计划、题库浏览相关的后端调用，
 * 替代页面直接调用 lafService 的架构违规。
 *
 * 覆盖 14 个调用点:
 *   - getFSRSStatus ×2, getFSRSRetentionCurve, optimizeFSRS
 *   - getDiagnosis ×2, generateDiagnosis ×2
 *   - getReviewPlan ×3
 *   - getQuestionBankStats, browseQuestions, getQuestionBankRandom (question-bank.vue)
 *   - getRandomQuestions (mock-exam.vue)
 *
 * @module stores/review
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

export const useReviewStore = defineStore('review', () => {
  // ==================== State ====================
  const fsrsStatus = ref(null);
  const retentionCurve = ref(null);
  const currentDiagnosis = ref(null);
  const diagnosisList = ref([]);
  const reviewPlan = ref(null);

  // ==================== Getters ====================
  const hasDiagnosis = computed(() => !!currentDiagnosis.value);
  const hasReviewPlan = computed(() => !!reviewPlan.value);
  const urgentReviewCount = computed(() => {
    if (!reviewPlan.value?.urgent) return 0;
    return reviewPlan.value.urgent.length;
  });

  // ==================== Actions ====================

  /** 获取 FSRS 状态 */
  const fetchFSRSStatus = async () => {
    try {
      const res = await lafService.request('/fsrs-optimizer', { action: 'status' });
      if (res.code === 0 && res.data) {
        fsrsStatus.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取 FSRS 状态失败');
    } catch (error) {
      logger.error('[ReviewStore] fetchFSRSStatus:', error);
      return { success: false, error };
    }
  };

  /** 获取 FSRS 留存率曲线 */
  const fetchRetentionCurve = async () => {
    try {
      const res = await lafService.request('/fsrs-optimizer', { action: 'retention_curve' });
      if (res.code === 0 && res.data) {
        retentionCurve.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取留存率曲线失败');
    } catch (error) {
      logger.error('[ReviewStore] fetchRetentionCurve:', error);
      return { success: false, error };
    }
  };

  /** 触发 FSRS 参数优化 */
  const optimizeFSRS = async () => {
    try {
      const res = await lafService.request('/fsrs-optimizer', { action: 'optimize' });
      if (res.code === 0) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || 'FSRS 优化失败');
    } catch (error) {
      logger.error('[ReviewStore] optimizeFSRS:', error);
      return { success: false, error };
    }
  };

  /** 生成 AI 诊断报告 */
  const generateDiagnosis = async (sessionData = {}) => {
    try {
      const res = await lafService.request('/ai-diagnosis', { action: 'generate', ...sessionData });
      if (res.code === 0 && res.data) {
        currentDiagnosis.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '诊断生成失败');
    } catch (error) {
      logger.error('[ReviewStore] generateDiagnosis:', error);
      return { success: false, error };
    }
  };

  /** 获取诊断报告（by ID 或 sessionId） */
  const fetchDiagnosis = async (params = {}) => {
    try {
      const res = await lafService.request('/ai-diagnosis', { action: 'get', ...params });
      if (res.code === 0 && res.data) {
        currentDiagnosis.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取诊断失败');
    } catch (error) {
      logger.error('[ReviewStore] fetchDiagnosis:', error);
      return { success: false, error };
    }
  };

  /** 获取复习计划 */
  const fetchReviewPlan = async () => {
    try {
      const res = await lafService.request('/ai-diagnosis', { action: 'get_review_plan' });
      if (res.code === 0 && res.data) {
        reviewPlan.value = res.data;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取复习计划失败');
    } catch (error) {
      logger.error('[ReviewStore] fetchReviewPlan:', error);
      return { success: false, error };
    }
  };

  /** 获取智能推荐题目 */
  const fetchSmartRecommendations = async (params = {}) => {
    try {
      const res = await lafService.request('/ai-diagnosis', { action: 'smart_recommend', ...params });
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取推荐失败');
    } catch (error) {
      logger.error('[ReviewStore] fetchSmartRecommendations:', error);
      return { success: false, error };
    }
  };

  /** 获取题库统计 (分类/难度分布) */
  const fetchQuestionBankStats = async () => {
    try {
      const res = await lafService.getQuestionBankStats();
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '获取题库统计失败' } };
    } catch (e) {
      logger.error('[reviewStore] fetchQuestionBankStats failed:', e);
      return { success: false, error: { message: e?.message || '获取题库统计失败' } };
    }
  };

  /** 浏览题目列表 (分页) */
  const browseQuestions = async (params) => {
    try {
      const res = await lafService.browseQuestions(params);
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '加载题目失败' } };
    } catch (e) {
      logger.error('[reviewStore] browseQuestions failed:', e);
      return { success: false, error: { message: e?.message || '加载题目失败' } };
    }
  };

  /** 从题库随机抽题 */
  const fetchQuestionBankRandom = async (params) => {
    try {
      const res = await lafService.getQuestionBankRandom(params);
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '获取随机题目失败' } };
    } catch (e) {
      logger.error('[reviewStore] fetchQuestionBankRandom failed:', e);
      return { success: false, error: { message: e?.message || '获取随机题目失败' } };
    }
  };

  /** 获取随机题目 (模拟考试) */
  const fetchRandomQuestions = async (params) => {
    try {
      const res = await lafService.getRandomQuestions(params);
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '获取随机题目失败' } };
    } catch (e) {
      logger.error('[reviewStore] fetchRandomQuestions failed:', e);
      return { success: false, error: { message: e?.message || '获取随机题目失败' } };
    }
  };

  return {
    // state
    fsrsStatus,
    retentionCurve,
    currentDiagnosis,
    diagnosisList,
    reviewPlan,
    // getters
    hasDiagnosis,
    hasReviewPlan,
    urgentReviewCount,
    // actions
    fetchFSRSStatus,
    fetchRetentionCurve,
    optimizeFSRS,
    generateDiagnosis,
    fetchDiagnosis,
    fetchReviewPlan,
    fetchSmartRecommendations,
    fetchQuestionBankStats,
    browseQuestions,
    fetchQuestionBankRandom,
    fetchRandomQuestions
  };
});
