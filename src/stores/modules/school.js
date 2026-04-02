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
import { logger } from '@/utils/logger.js';

export const useSchoolStore = defineStore('school', () => {
  /**
   * 获取热门院校列表
   * @param {Object} [params] - 查询参数（如 { limit: 10 }）
   */
  const fetchHotSchools = async (params) => {
    try {
      return await getHotSchools(params);
    } catch (err) {
      logger.error('[SchoolStore] fetchHotSchools 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 调用爬虫接口获取院校数据
   * @param {Object} params - 请求参数（action, data 等）
   * @param {Object} [options] - 请求选项（skipAuth, maxRetries 等）
   */
  const crawlSchoolData = async (params, options) => {
    try {
      return await crawlSchoolDataApi(params, options);
    } catch (err) {
      logger.error('[SchoolStore] crawlSchoolData 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 智能择校推荐
   * @param {string} action - 推荐动作（如 'recommend'）
   * @param {Object} params - 推荐参数
   */
  const aiRecommend = async (action, params) => {
    try {
      return await proxyAI(action, params);
    } catch (err) {
      logger.error('[SchoolStore] aiRecommend 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 获取院校详情
   * @param {string} id - 院校 ID
   */
  const fetchSchoolDetail = async (id) => {
    try {
      return await getSchoolDetail(id);
    } catch (err) {
      logger.error('[SchoolStore] fetchSchoolDetail 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 智能录取概率预测
   * @param {string} action - 预测动作（如 'predict'）
   * @param {Object} params - 预测参数
   */
  const aiPredict = async (action, params) => {
    try {
      return await proxyAI(action, params);
    } catch (err) {
      logger.error('[SchoolStore] aiPredict 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 搜索院校
   * @param {string} keyword - 搜索关键词
   * @param {number} [limit=10] - 返回数量限制
   */
  const searchSchools = async (keyword, limit = 10) => {
    try {
      return await searchSchoolsApi(keyword, limit);
    } catch (err) {
      logger.error('[SchoolStore] searchSchools 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * AI 智能好友聊天
   * @param {string} friendType - 好友类型（如 'yan-cong'）
   * @param {string} content - 用户发送的消息内容
   * @param {Object} context - 上下文信息（情绪、学习状态等）
   */
  const aiFriendChat = async (friendType, content, context) => {
    try {
      return await aiFriendChatApi(friendType, content, context);
    } catch (err) {
      logger.error('[SchoolStore] aiFriendChat 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
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
