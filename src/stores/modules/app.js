/**
 * 应用全局状态管理
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 系统信息
  const systemInfo = ref(null)
  
  // 网络状态
  const networkType = ref('unknown')
  
  // 加载状态
  const isLoading = ref(false)
  
  // 导航栏信息
  const navbarInfo = ref(null)

  /**
   * 设置系统信息
   */
  const setSystemInfo = (info) => {
    systemInfo.value = info
  }

  /**
   * 设置网络状态
   */
  const setNetworkType = (type) => {
    networkType.value = type
  }

  /**
   * 设置加载状态
   */
  const setLoading = (loading) => {
    isLoading.value = loading
  }

  /**
   * 设置导航栏信息
   */
  const setNavbarInfo = (info) => {
    navbarInfo.value = info
  }

  /**
   * 初始化应用信息
   */
  const initAppInfo = () => {
    // 获取系统信息
    try {
      let systemInfoData
      
      // #ifdef MP-WECHAT
      // 微信小程序使用新的 API
      const windowInfo = uni.getWindowInfo()
      const deviceInfo = uni.getDeviceInfo()
      const appBaseInfo = uni.getAppBaseInfo()
      // 合并信息以兼容旧代码
      systemInfoData = {
        ...windowInfo,
        ...deviceInfo,
        ...appBaseInfo
      }
      // #endif
      
      // #ifndef MP-WECHAT
      systemInfoData = uni.getSystemInfoSync()
      // #endif
      
      setSystemInfo(systemInfoData)
    } catch (error) {
      console.error('获取系统信息失败：', error)
    }

    // 监听网络状态
    uni.getNetworkType({
      success: (res) => {
        setNetworkType(res.networkType)
      }
    })

    // 监听网络状态变化
    uni.onNetworkStatusChange((res) => {
      setNetworkType(res.networkType)
    })
  }

  return {
    // 状态
    systemInfo,
    networkType,
    isLoading,
    navbarInfo,
    
    // 方法
    setSystemInfo,
    setNetworkType,
    setLoading,
    setNavbarInfo,
    initAppInfo
  }
})
