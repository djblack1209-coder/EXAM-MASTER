/**
 * Study Engine Store — 智能学习引擎状态管理
 *
 * 集中管理 smart-study-engine 相关的后端调用，
 * 作为页面与 smart-study.api.js 之间的分层网关。
 * 页面不应直接 import smart-study.api.js，而应通过本 Store 调用。
 *
 * 服务的页面:
 *   - study-detail/index.vue  → analyzeMastery()
 *   - plan/index.vue          → generateStudyPlan()
 *   - mistake/index.vue       → getErrorClusters()
 *   - quiz-result.vue         → analyzeMastery()
 *
 * 响应格式: 直接透传 smart-study.api.js 的返回值，
 *   成功时返回后端原始 response（含 data 字段），
 *   失败时返回 normalizeError 结构（含 success: false）。
 *
 * @module stores/study-engine
 */

import { defineStore } from 'pinia';
import {
  analyzeMastery as apiAnalyzeMastery,
  getErrorClusters as apiGetErrorClusters,
  getSprintPriority as apiGetSprintPriority,
  generateStudyPlan as apiGenerateStudyPlan
} from '@/services/api/domains/smart-study.api.js';
import { logger } from '@/utils/logger.js';

export const useStudyEngineStore = defineStore('studyEngine', () => {
  // ==================== Actions ====================
  // 透传 API 调用，不修改响应结构，保持页面现有的数据访问方式

  /** 掌握度分析 — 各知识点掌握度 + 薄弱点识别 */
  const analyzeMastery = async () => {
    try {
      return await apiAnalyzeMastery();
    } catch (err) {
      logger.error('[StudyEngineStore] analyzeMastery 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /** 错题归因聚类 — 按错误类型×科目聚类 + 趋势分析 */
  const getErrorClusters = async () => {
    try {
      return await apiGetErrorClusters();
    } catch (err) {
      logger.error('[StudyEngineStore] getErrorClusters 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /** 冲刺模式 — ROI优先级排序 + 战略放弃建议 */
  const getSprintPriority = async (examDate) => {
    try {
      return await apiGetSprintPriority(examDate);
    } catch (err) {
      logger.error('[StudyEngineStore] getSprintPriority 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /** 自适应学习计划 — 7天计划 + 阶段划分 */
  const generateStudyPlan = async (examDate, dailyHours) => {
    try {
      return await apiGenerateStudyPlan(examDate, dailyHours);
    } catch (err) {
      logger.error('[StudyEngineStore] generateStudyPlan 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  return {
    analyzeMastery,
    getErrorClusters,
    getSprintPriority,
    generateStudyPlan
  };
});
