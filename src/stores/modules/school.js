/**
 * 择校信息状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSchoolStore = defineStore('school', () => {
  const info = ref({})

  const hasPlan = computed(() => {
    return info.value && Object.keys(info.value).length > 0
  })

  const setInfo = (payload = {}) => {
    info.value = payload || {}
  }

  const clearInfo = () => {
    info.value = {}
  }

  return {
    info,
    hasPlan,
    setInfo,
    clearInfo
  }
})
