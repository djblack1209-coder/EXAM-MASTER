/**
 * 择校信息状态管理
 *
 * 提供院校搜索、爬虫数据、AI 推荐、录取预测等后端调用。
 *
 * @module stores/school
 */

import { defineStore } from 'pinia';
import {
  getHotSchools,
  crawlSchoolData as crawlSchoolDataApi,
  getSchoolDetail,
  searchSchools as searchSchoolsApi
} from '@/services/api/domains/school.api.js';
import { proxyAI, aiFriendChat as aiFriendChatApi } from '@/services/api/domains/ai.api.js';

export const useSchoolStore = defineStore('school', () => {
  /**
   * 获取热门院校列表
   * @param {Object} [params] - 查询参数（如 { limit: 10 }）
   */
  const fetchHotSchools = async (params) => {
    return await getHotSchools(params);
  };

  /**
   * 调用爬虫接口获取院校数据
   * @param {Object} params - 请求参数（action, data 等）
   * @param {Object} [options] - 请求选项（skipAuth, maxRetries 等）
   */
  const crawlSchoolData = async (params, options) => {
    return await crawlSchoolDataApi(params, options);
  };

  /**
   * 智能择校推荐
   * @param {string} action - 推荐动作（如 'recommend'）
   * @param {Object} params - 推荐参数
   */
  const aiRecommend = async (action, params) => {
    return await proxyAI(action, params);
  };

  /**
   * 获取院校详情
   * @param {string} id - 院校 ID
   */
  const fetchSchoolDetail = async (id) => {
    return await getSchoolDetail(id);
  };

  /**
   * 智能录取概率预测
   * @param {string} action - 预测动作（如 'predict'）
   * @param {Object} params - 预测参数
   */
  const aiPredict = async (action, params) => {
    return await proxyAI(action, params);
  };

  /**
   * 搜索院校
   * @param {string} keyword - 搜索关键词
   * @param {number} [limit=10] - 返回数量限制
   */
  const searchSchools = async (keyword, limit = 10) => {
    return await searchSchoolsApi(keyword, limit);
  };

  /**
   * AI 智能好友聊天
   * @param {string} friendType - 好友类型（如 'yan-cong'）
   * @param {string} content - 用户发送的消息内容
   * @param {Object} context - 上下文信息（情绪、学习状态等）
   */
  const aiFriendChat = async (friendType, content, context) => {
    return await aiFriendChatApi(friendType, content, context);
  };

  return {
    fetchHotSchools,
    crawlSchoolData,
    aiRecommend,
    fetchSchoolDetail,
    aiPredict,
    searchSchools,
    aiFriendChat
  };
});
