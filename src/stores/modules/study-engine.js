/**
 * Study Engine Store — 智能学习引擎状态管理
 *
 * 集中管理 smart-study-engine 相关的后端调用，
 * 替代页面直接调用 lafService 的架构违规。
 *
 * 覆盖 4 个调用点 (页面均已移至 src/pages/_unreleased/):
 *   - analyzeMastery (knowledge-graph--mastery.vue)
 *   - getErrorClusters (practice-sub--error-clusters.vue)
 *   - getSprintPriority (practice-sub--sprint-mode.vue)
 *   - generateStudyPlan (plan--adaptive.vue)
 *
 * @module stores/study-engine
 */

import { defineStore } from 'pinia';
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

export const useStudyEngineStore = defineStore('studyEngine', () => {
  // ==================== Actions ====================

  /** F4: 掌握度分析 — 各知识点掌握度 + 薄弱点识别 */
  const analyzeMastery = async () => {
    try {
      const res = await lafService.analyzeMastery();
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '掌握度分析失败' } };
    } catch (e) {
      logger.error('[studyEngineStore] analyzeMastery failed:', e);
      return { success: false, error: { message: e?.message || '掌握度分析失败' } };
    }
  };

  /** F1: 错题归因聚类 — 按错误类型×科目聚类 + 趋势分析 */
  const getErrorClusters = async () => {
    try {
      const res = await lafService.getErrorClusters();
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '错题聚类分析失败' } };
    } catch (e) {
      logger.error('[studyEngineStore] getErrorClusters failed:', e);
      return { success: false, error: { message: e?.message || '错题聚类分析失败' } };
    }
  };

  /** F2: 冲刺模式 — ROI优先级排序 + 战略放弃建议 */
  const getSprintPriority = async (examDate) => {
    try {
      const res = await lafService.getSprintPriority(examDate);
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '冲刺优先级获取失败' } };
    } catch (e) {
      logger.error('[studyEngineStore] getSprintPriority failed:', e);
      return { success: false, error: { message: e?.message || '冲刺优先级获取失败' } };
    }
  };

  /** F3: 自适应学习计划 — 7天计划 + 阶段划分 */
  const generateStudyPlan = async (examDate, dailyHours) => {
    try {
      const res = await lafService.generateStudyPlan(examDate, dailyHours);
      if (res?.code === 0) return { success: true, data: res.data };
      return { success: false, error: { message: res?.message || '自适应计划生成失败' } };
    } catch (e) {
      logger.error('[studyEngineStore] generateStudyPlan failed:', e);
      return { success: false, error: { message: e?.message || '自适应计划生成失败' } };
    }
  };

  return {
    analyzeMastery,
    getErrorClusters,
    getSprintPriority,
    generateStudyPlan
  };
});
