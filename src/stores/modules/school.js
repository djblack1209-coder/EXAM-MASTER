/**
 * 择校信息状态管理
 *
 * 提供院校搜索、爬虫数据、AI 推荐、录取预测等后端调用。
 *
 * @module stores/school
 */

import { defineStore } from 'pinia';
import { lafService } from '@/services/lafService.js';

export const useSchoolStore = defineStore('school', () => {
  /**
   * 获取热门院校列表
   * @param {Object} [params] - 查询参数（如 { limit: 10 }）
   */
  const fetchHotSchools = async (params) => {
    return await lafService.getHotSchools(params);
  };

  /**
   * 调用爬虫接口获取院校数据
   * @param {Object} params - 请求参数（action, data 等）
   * @param {Object} [options] - 请求选项（skipAuth, maxRetries 等）
   */
  const crawlSchoolData = async (params, options) => {
    return await lafService.request('/school-crawler-api', params, options);
  };

  /**
   * 智能择校推荐
   * @param {string} action - 推荐动作（如 'recommend'）
   * @param {Object} params - 推荐参数
   */
  const aiRecommend = async (action, params) => {
    return await lafService.proxyAI(action, params);
  };

  /**
   * 获取院校详情
   * @param {string} id - 院校 ID
   */
  const fetchSchoolDetail = async (id) => {
    return await lafService.getSchoolDetail(id);
  };

  /**
   * 智能录取概率预测
   * @param {string} action - 预测动作（如 'predict'）
   * @param {Object} params - 预测参数
   */
  const aiPredict = async (action, params) => {
    return await lafService.proxyAI(action, params);
  };

  /**
   * 搜索院校
   * @param {string} keyword - 搜索关键词
   * @param {number} [limit=10] - 返回数量限制
   */
  const searchSchools = async (keyword, limit = 10) => {
    return await lafService.searchSchools(keyword, limit);
  };

  return {
    fetchHotSchools,
    crawlSchoolData,
    aiRecommend,
    fetchSchoolDetail,
    aiPredict,
    searchSchools
  };
});
