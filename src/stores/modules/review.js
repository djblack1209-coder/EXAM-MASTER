/**
 * Review Store — 复习 & 题库状态管理
 *
 * 集中管理 FSRS 复习、题库浏览相关的后端调用。
 * AI 诊断/复习计划/智能推荐功能因 ai.api 移除已降级。
 *
 * 数据流：Page -> Store -> Domain API (practice.api)
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
import { logger } from '@/utils/logger.js';

export const useReviewStore = defineStore('review', () => {
  // ==================== State ====================
  const fsrsStatus = ref(null);
  const retentionCurve = ref(null);
  const currentDiagnosis = ref(null);
  const reviewPlan = ref(null);

  // ==================== Actions ====================

  /** 获取 FSRS 状态 */
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

  /** 获取 FSRS 留存率曲线 */
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
      if (res?.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res?.message || 'FSRS 优化失败');
    } catch (error) {
      logger.error('[ReviewStore] optimizeFSRS:', error);
      return { success: false, error };
    }
  };

  /** 生成 AI 诊断报告（ai.api 已移除，返回降级结果） */
  const generateDiagnosis = async (_sessionData = {}) => {
    logger.warn('[ReviewStore] generateDiagnosis: ai.api 已移除，功能降级');
    return { success: false, error: { message: 'AI 诊断功能已下线' } };
  };

  /** 获取诊断报告（ai.api 已移除，返回降级结果） */
  const fetchDiagnosis = async (_params = {}) => {
    logger.warn('[ReviewStore] fetchDiagnosis: ai.api 已移除，功能降级');
    return { success: false, error: { message: 'AI 诊断功能已下线' } };
  };

  /** 获取复习计划（ai.api 已移除，返回降级结果） */
  const fetchReviewPlan = async () => {
    logger.warn('[ReviewStore] fetchReviewPlan: ai.api 已移除，功能降级');
    return { success: false, error: { message: '复习计划功能已下线' } };
  };

  /** 获取智能推荐题目（ai.api 已移除，返回降级结果） */
  const fetchSmartRecommendations = async (_params = {}) => {
    logger.warn('[ReviewStore] fetchSmartRecommendations: ai.api 已移除，功能降级');
    return { success: false, error: { message: '智能推荐功能已下线' } };
  };

  /** 获取题库统计 (分类/难度分布) */
  const fetchQuestionBankStats = async () => {
    try {
      const res = await apiGetQuestionBankStats();
      if (res?.code === 0) return { success: true, data: res?.data ?? null };
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
      if (res?.code === 0) return { success: true, data: res?.data ?? null };
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
      if (res?.code === 0) return { success: true, data: res?.data ?? null };
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
      if (res?.code === 0) return { success: true, data: res?.data ?? null };
      return { success: false, error: { message: res?.message || '获取随机题目失败' } };
    } catch (e) {
      logger.error('[reviewStore] fetchRandomQuestions failed:', e);
      return { success: false, error: { message: e?.message || '获取随机题目失败' } };
    }
  };

  /** 重置 store 状态到初始值 */
  const $reset = () => {
    fsrsStatus.value = null;
    retentionCurve.value = null;
    currentDiagnosis.value = null;
    reviewPlan.value = null;
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
    fetchRandomQuestions,
    $reset
  };
});
