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

  return {
    info,
    hasPlan,
    setInfo,
    clearInfo,
    restore
  };
});
