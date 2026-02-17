/**
 * 应用全局状态管理
 *
 * 管理设备系统信息、网络状态、全局加载态、导航栏配置等运行时上下文。
 * 在 App.vue onLaunch 中通过 initAppInfo() 初始化。
 *
 * @module stores/app
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  /** @type {import('vue').Ref<Object|null>} 设备系统信息（屏幕尺寸、平台、版本等） */
  const systemInfo = ref(null);

  /** @type {import('vue').Ref<string>} 当前网络类型（wifi / 4g / 3g / none / unknown） */
  const networkType = ref('unknown');

  /** @type {import('vue').Ref<boolean>} 全局加载遮罩状态 */
  const isLoading = ref(false);

  /** @type {import('vue').Ref<Object|null>} 自定义导航栏尺寸信息 */
  const navbarInfo = ref(null);

  /**
   * 设置系统信息
   * @param {Object} info - uni.getSystemInfoSync() 返回的系统信息对象
   */
  const setSystemInfo = (info) => {
    systemInfo.value = info;
  };

  /**
   * 设置网络状态
   * @param {string} type - 网络类型（wifi / 4g / 3g / 2g / none / unknown）
   */
  const setNetworkType = (type) => {
    networkType.value = type;
  };

  /**
   * 设置全局加载状态
   * @param {boolean} loading - 是否显示加载遮罩
   */
  const setLoading = (loading) => {
    isLoading.value = loading;
  };

  /**
   * 设置导航栏信息
   * @param {Object} info - 导航栏配置（高度、胶囊按钮位置等）
   */
  const setNavbarInfo = (info) => {
    navbarInfo.value = info;
  };

  /**
   * 初始化应用信息
   */
  const initAppInfo = () => {
    // 获取系统信息
    try {
      let systemInfoData;

      // #ifdef MP-WECHAT
      // 微信小程序使用新的 API
      const windowInfo = uni.getWindowInfo();
      const deviceInfo = uni.getDeviceInfo();
      const appBaseInfo = uni.getAppBaseInfo();
      // 合并信息以兼容旧代码
      systemInfoData = {
        ...windowInfo,
        ...deviceInfo,
        ...appBaseInfo
      };
      // #endif

      // #ifndef MP-WECHAT
      systemInfoData = uni.getSystemInfoSync();
      // #endif

      setSystemInfo(systemInfoData);
    } catch (error) {
      console.error('获取系统信息失败：', error);
    }

    // 监听网络状态
    uni.getNetworkType({
      success: (res) => {
        setNetworkType(res.networkType);
      },
      fail: (err) => {
        console.warn('获取网络状态失败：', err);
        setNetworkType('unknown');
      }
    });

    // 监听网络状态变化
    uni.onNetworkStatusChange((res) => {
      setNetworkType(res.networkType);
    });
  };

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
  };
});
