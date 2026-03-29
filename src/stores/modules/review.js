/**
 * Review Store — 复习 & 诊断 & 题库状态管理
 *
 * 集中管理 FSRS 复习、AI 诊断、复习计划、题库浏览相关的后端调用，
 * 替代页面直接调用 lafService 的架构违规。
 *
 * 覆盖 14 个调用点：
 *   - getFSRSStatus ×2, getFSRSRetentionCurve, optimizeFSRS
 *   - getDiagnosis ×2, generateDiagnosis ×2
 *   - getReviewPlan ×3
 *   - getQuestionBankStats, browseQuestions, getQuestionBankRandom (question-bank.vue)
 *   - getRandomQuestions (mock-exam.vue)
 *
 * 数据流：Page → Store → Domain API (practice.api / ai.api)
 *
 * @module stores/review
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getFSRSStatus as apiFSRSStatus,
  getFSRSRetentionCurve as apiFSRSRetentionCurve,
  optimizeFSRS as apiOptimizeFSRS,
  getQuestionBankStats as apiGetQuestionBankStats,
  browseQuestions as apiBrowseQuestions,
  getQuestionBankRandom as apiGetQuestionBankRandom,
  getRandomQuestions as apiGetRandomQuestions
} from '@/services/api/domains/practice.api.js';
import {
  generateDiagnosis as apiGenerateDiagnosis,
  getDiagnosis as apiGetDiagnosis,
  getReviewPlan as apiGetReviewPlan,
  getSmartRecommendations as apiGetSmartRecommendations
} from '@/services/api/domains/ai.api.js';
import { logger } from '@/utils/logger.js';

export const useReviewStore = defineStore('review', () => {
  // ==================== State ====================
  const fsrsStatus = ref(null);
  const retentionCurve = ref(null);
  const currentDiagnosis = ref(null);
  const reviewPlan = ref(null);

  // ==================== Actions ====================

  /**
   * 获取 FSRS 状态
   * 注：domain API 使用 action: 'getStatus'（后端正确的 action name），
   * 修复了原先 action: 'status' 导致后端 400 错误的潜在 bug
   */
  const fetchFSRSStatus = async () => {
    try {
      const res = await apiFSRSStatus();
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

  /**
   * 获取 FSRS 留存率曲线
   * 注：domain API 使用 action: 'getRetentionCurve'（后端正确的 action name），
   * 修复了原先 action: 'retention_curve' 导致后端 400 错误的潜在 bug
   */
  const fetchRetentionCurve = async () => {
    try {
      const res = await apiFSRSRetentionCurve();
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
      const res = await apiOptimizeFSRS();
      if (res.code === 0) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || 'FSRS 优化失败');
    } catch (error) {
      logger.error('[ReviewStore] optimizeFSRS:', error);
      return { success: false, error };
    }
  };

  /**
   * 生成 AI 诊断报告
   * @param {Object} sessionData - 调用方传 { sessionId: '...' }
   * 注：ai.api.js 的 generateDiagnosis 接受 sessionId 字符串参数，
   * 这里从 sessionData 对象中提取 sessionId 进行适配
   */
  const generateDiagnosis = async (sessionData = {}) => {
    try {
      const res = await apiGenerateDiagnosis(sessionData.sessionId);
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
      const res = await apiGetDiagnosis(params);
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
      const res = await apiGetReviewPlan();
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
      const res = await apiGetSmartRecommendations(params);
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
      const res = await apiGetQuestionBankStats();
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
      const res = await apiBrowseQuestions(params);
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
      const res = await apiGetQuestionBankRandom(params);
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
      const res = await apiGetRandomQuestions(params);
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
    reviewPlan,
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
