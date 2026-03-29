/**
 * 智能学习引擎 API
 * 职责：知识点掌握度分析、错题归因聚类、深度矫正、冲刺优先级、AI学习计划
 *
 * @module services/api/domains/smart-study
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 获取知识点掌握度分析
 * 根据用户历史答题数据，分析各知识点的掌握程度
 * @returns {Promise} 返回知识点掌握度数据
 */
export async function analyzeMastery() {
  logger.log('[SmartStudy] 调用知识点掌握度分析');
  try {
    const response = await request(
      '/smart-study-engine',
      {
        action: 'analyze_mastery',
        data: {}
      },
      { timeout: config.ai.analysisTimeout }
    );
    return response;
  } catch (error) {
    logger.warn('[SmartStudy] 知识点掌握度分析失败:', error);
    return normalizeError(error, '知识点掌握度分析');
  }
}

/**
 * 获取错题归因聚类
 * 对错题进行智能聚类，找出薄弱环节和共性原因
 * @returns {Promise} 返回错题聚类数据
 */
export async function getErrorClusters() {
  logger.log('[SmartStudy] 调用错题归因聚类');
  try {
    const response = await request(
      '/smart-study-engine',
      {
        action: 'error_clustering',
        data: {}
      },
      { timeout: config.ai.analysisTimeout }
    );
    return response;
  } catch (error) {
    logger.warn('[SmartStudy] 错题归因聚类失败:', error);
    return normalizeError(error, '错题归因聚类');
  }
}

/**
 * 获取待处理的矫正列表
 * @returns {Promise} 返回待处理矫正数据
 */
export async function getPendingCorrections() {
  logger.log('[SmartStudy] 调用获取待处理矫正');
  try {
    const response = await request('/smart-study-engine', {
      action: 'get_pending_corrections',
      data: {}
    });
    return response;
  } catch (error) {
    logger.warn('[SmartStudy] 获取待处理矫正失败:', error);
    return normalizeError(error, '获取待处理矫正');
  }
}

/**
 * 获取冲刺模式ROI优先级排序
 * 根据考试日期计算剩余时间，按投入产出比排序知识点
 * @param {string} examDate - 考试日期，格式 YYYY-MM-DD（必传）
 * @returns {Promise} 返回冲刺优先级数据
 */
export async function getSprintPriority(examDate) {
  logger.log('[SmartStudy] 调用冲刺优先级排序, 考试日期:', examDate);
  try {
    const response = await request('/smart-study-engine', {
      action: 'sprint_priority',
      data: { examDate }
    });
    return response;
  } catch (error) {
    logger.warn('[SmartStudy] 冲刺优先级排序失败:', error);
    return normalizeError(error, '冲刺优先级排序');
  }
}

/**
 * 生成AI自适应学习计划
 * 根据考试日期和每日可用学时，生成个性化学习计划
 * @param {string} examDate - 考试日期，格式 YYYY-MM-DD（必传）
 * @param {number} [dailyHours] - 每日可用学习时长（小时），可选
 * @returns {Promise} 返回AI生成的学习计划
 */
export async function generateStudyPlan(examDate, dailyHours) {
  logger.log('[SmartStudy] 调用AI学习计划生成, 考试日期:', examDate, '每日学时:', dailyHours || '未指定');
  try {
    const data = { examDate };
    if (dailyHours != null) {
      data.dailyHours = dailyHours;
    }
    const response = await request(
      '/smart-study-engine',
      {
        action: 'generate_plan',
        data
      },
      { timeout: config.api.timeout }
    );
    return response;
  } catch (error) {
    logger.warn('[SmartStudy] AI学习计划生成失败:', error);
    return normalizeError(error, 'AI学习计划生成');
  }
}

// ✅ D019: 移除 generateAdaptivePlan 别名，统一使用 generateStudyPlan
