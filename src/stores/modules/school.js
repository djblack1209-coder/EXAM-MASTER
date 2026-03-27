/**
 * 择校信息状态管理
 *
 * 存储用户的目标院校/专业选择信息，供择校推荐、分数线查询等模块使用。
 *
 * @module stores/school
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { storageService } from '@/services/storageService.js';
import { lafService } from '@/services/lafService.js';

const STORAGE_KEY = 'school_selection_info';

export const useSchoolStore = defineStore('school', () => {
  /** @type {import('vue').Ref<Object>} 择校计划信息（院校、专业、分数线等） */
  const info = ref({});

  /** @type {import('vue').ComputedRef<boolean>} 用户是否已设置择校计划 */
  const hasPlan = computed(() => {
    return info.value && Object.keys(info.value).length > 0;
  });

  /**
   * 设置择校信息
   * @param {Object} [payload={}] - 择校计划数据（schoolId, majorId, targetScore 等）
   */
  const setInfo = (payload = {}) => {
    info.value = payload || {};
  };

  /**
   * 清空择校信息
   */
  const clearInfo = () => {
    info.value = {};
  };

  /**
   * 从本地存储恢复择校信息
   */
  const restore = () => {
    try {
      const cached = storageService.get(STORAGE_KEY, null);
      if (cached && typeof cached === 'object') {
        info.value = cached;
      }
    } catch (_e) {
      // 恢复失败忽略
    }
  };

  // 自动持久化：info 变化时写入存储
  watch(
    info,
    (val) => {
      try {
        storageService.save(STORAGE_KEY, val);
      } catch (_e) {
        // 存储失败忽略
      }
    },
    { deep: true }
  );

  // 初始化时恢复
  restore();

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
    info,
    hasPlan,
    setInfo,
    clearInfo,
    restore,
    // B2: 新增院校相关 action
    fetchHotSchools,
    crawlSchoolData,
    aiRecommend,
    fetchSchoolDetail,
    aiPredict,
    searchSchools
  };
});
