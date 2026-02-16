/**
 * 择校信息状态管理
 *
 * 存储用户的目标院校/专业选择信息，供择校推荐、分数线查询等模块使用。
 *
 * @module stores/school
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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

  return {
    info,
    hasPlan,
    setInfo,
    clearInfo
  };
});
