<template>
  <!-- 外层定位容器：完全透明，不阻挡点击 -->
  <view
    class="tabbar-position-wrapper"
    style="
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 999;
      background-color: transparent !important;
      background: transparent !important;
      pointer-events: none;
    "
  >
    <!-- 内层胶囊：唯一可见实体，恢复点击 -->
    <view
      class="tabbar-capsule apple-glass"
      style="pointer-events: auto"
      :class="{ 'dark-mode': isDark }"
      :style="capsuleStyle"
    >
      <view
        v-for="(item, index) in tabList"
        :id="`e2e-tabbar-${item.path.split('/')[2]}`"
        :key="index"
        class="tab-item"
        :class="{ active: resolvedActiveIndex === index }"
        @tap="switchTab(item.path, index)"
      >
        <view class="icon-wrapper">
          <image v-if="resolvedActiveIndex === index" :src="item.selectedIcon" class="tab-icon" mode="aspectFit" />
          <image v-else :src="item.icon" class="tab-icon" mode="aspectFit" />
          <view v-if="item.showDot" class="red-dot" />
        </view>
        <text class="tab-label">
          {{ item.text }}
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// ✅ 导入配置（用于审核模式判断）
import config from '@/config/index.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// 系统信息工具
import { getWindowInfo } from '@/utils/core/system.js';

function getUniApi() {
  if (typeof uni !== 'undefined') return uni;
  if (typeof globalThis !== 'undefined' && globalThis.uni) return globalThis.uni;
  return null;
}

function fallbackRouteJump(url) {
  // #ifdef H5
  `;
    return true;
  }
  // #endif
  // #ifndef H5
  // App/小程序端使用 uni.reLaunch 作为最终 fallback
  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.reLaunch === 'function' && url) {
    uniApi.reLaunch({ url });
    return true;
  }
  // #endif
  return false;
}

function getCurrentRoutePath() {
  // 优先使用 getCurrentPages（全平台通用）
  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      return '/' + (currentPage.route || currentPage.__route__ || 'pages/index/index');
    }
  }
  // #ifdef H5
  
  // #endif
  return '/pages/index/index';
}

export default {
  name: 'CustomTabbar',
  props: {
    // ✅ F005: activeIndex 已废弃，保留兼容但优先使用自动路由检测
    activeIndex: { type: Number, default: -1 },
    isDark: { type: Boolean, default: false }
  },
  data() {
    return {
      mistakeDot: false,
      currentRoute: '',
      // E008: JS 安全区域回退值（用于不支持 CSS env() 的老设备）
      safeAreaBottom: 0
    };
  },
  computed: {
    // E008: 动态计算胶囊底部间距（JS 回退）
    capsuleStyle() {
      if (this.safeAreaBottom > 0) {
        return { marginBottom: `calc(24rpx + ${this.safeAreaBottom}px)` };
      }
      return {};
    },
    // ✅ F005: 自动检测当前路由对应的 tab 索引
    resolvedActiveIndex() {
      // 如果手动传入了有效的 activeIndex，优先使用（向后兼容）
      if (this.activeIndex >= 0) return this.activeIndex;
      // 自动检测当前路由
      const idx = this.tabList.findIndex((tab) => this.currentRoute.includes(tab.path));
      return idx >= 0 ? idx : 0;
    },
    // ✅ 审核模式下过滤掉隐藏功能入口
    tabList() {
      const allTabs = [
        {
          text: '首页',
          path: '/pages/index/index',
          icon: '/static/tabbar/home.png',
          selectedIcon: '/static/tabbar/home-active.png',
          showDot: false,
          isTabBar: true
        },
        {
          text: '刷题',
          path: '/pages/practice/index',
          icon: '/static/tabbar/practice.png',
          selectedIcon: '/static/tabbar/practice-active.png',
          showDot: this.mistakeDot,
          isTabBar: true
        },
        {
          text: '择校',
          path: '/pages/school/index',
          icon: '/static/tabbar/school.png',
          selectedIcon: '/static/tabbar/school-active.png',
          showDot: false,
          isTabBar: true
        },
        {
          text: '我的',
          path: '/pages/profile/index',
          icon: '/static/tabbar/profile.png',
          selectedIcon: '/static/tabbar/profile-active.png',
          showDot: false,
          isTabBar: true
        }
      ];

      // ✅ 审核模式下过滤掉隐藏的功能
      if (config.audit.isAuditMode) {
        return allTabs.filter((tab) => {
          if (!tab.featureKey) return true;
          return !config.audit.hiddenFeatures.includes(tab.featureKey);
        });
      }

      return allTabs;
    }
  },
  watch: {
    isDark(newVal) {
      logger.log('[CustomTabbar] 主题变化:', newVal ? '深色模式' : '浅色模式');
    }
  },
  mounted() {
    this.checkMistakeStatus();
    this.detectCurrentRoute();
    // F005: 监听页面 onShow 事件，确保 switchTab 后重新检测路由
    const uniApi = getUniApi();
    if (uniApi && typeof uniApi.$on === 'function') {
      uniApi.$on('tabbarRouteUpdate', this.detectCurrentRoute);
    }
    // E008: JS 安全区域检测回退（兼容不支持 CSS env() 的设备）
    this.detectSafeArea();
  },
  // F005: 清理事件监听，防止内存泄漏
  beforeUnmount() {
    const uniApi = getUniApi();
    if (uniApi && typeof uniApi.$off === 'function') {
      uniApi.$off('tabbarRouteUpdate', this.detectCurrentRoute);
    }
  },
  methods: {
    // E008: JS 安全区域检测（兼容老设备）
    detectSafeArea() {
      try {
        const winInfo = getWindowInfo();
        const bottom = winInfo.safeArea ? winInfo.screenHeight - winInfo.safeArea.bottom : 0;
        if (bottom > 0) {
          this.safeAreaBottom = bottom;
          logger.log('[CustomTabbar] 安全区域底部:', bottom, 'px');
        }
      } catch (e) {
        logger.warn('[CustomTabbar] 安全区域检测失败:', e);
      }
    },
    // ✅ F005: 自动检测当前路由
    detectCurrentRoute() {
      try {
        if (typeof getCurrentPages === 'function') {
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const currentPage = pages[pages.length - 1];
            this.currentRoute = '/' + (currentPage.route || currentPage.__route__ || '');
            logger.log('[CustomTabbar] 自动检测路由:', this.currentRoute);
            return;
          }
        }

        this.currentRoute = getCurrentRoutePath();
      } catch (e) {
        logger.warn('[CustomTabbar] 路由检测失败:', e);
        this.currentRoute = getCurrentRoutePath();
      }
    },
    checkMistakeStatus() {
      const mistakes = storageService.get('mistake_book', []);
      this.mistakeDot = mistakes.length > 0;
    },
    switchTab(path, index) {
      if (this.resolvedActiveIndex === index) return;
      const uniApi = getUniApi();
      try {
        if (uniApi && typeof uniApi.vibrateShort === 'function') uniApi.vibrateShort();
      } catch (e) {
        logger.log('[CustomTabbar] 振动反馈失败:', e);
      }

      const item = this.tabList[index];

      // 根据页面类型选择跳转方式
      setTimeout(() => {
        if (item && item.isTabBar && uniApi && typeof uniApi.switchTab === 'function') {
          // tabBar 页面优先使用 switchTab
          uniApi.switchTab({
            url: path,
            fail: (err) => {
              logger.warn('[CustomTabbar] switchTab 失败，尝试 reLaunch:', err);
              if (typeof uniApi.reLaunch === 'function') {
                uniApi.reLaunch({
                  url: path,
                  fail: (err2) => {
                    logger.error('[CustomTabbar] reLaunch 也失败:', err2);
                    if (!fallbackRouteJump(path)) {
                      safeNavigateTo(path);
                    }
                  }
                });
                return;
              }

              if (!fallbackRouteJump(path)) {
                safeNavigateTo(path);
              }
            }
          });
        } else if (item && item.isTabBar) {
          if (!fallbackRouteJump(path)) {
            safeNavigateTo(path);
          }
        } else {
          // 非 tabBar 页面使用 navigateTo 或 reLaunch
          safeNavigateTo(path);
        }
      }, 50);
    }
  }
};
</script>

<style lang="scss" scoped>
/* 外层定位容器：绝对不能有任何背景色 */
.tabbar-position-wrapper {
  /* 所有背景相关属性都在 inline style 中用 !important 强制透明 */
}

/* 内层胶囊：唯一可见的实体元素 */
.tabbar-capsule {
  margin-left: 24rpx;
  margin-right: 24rpx;
  /* ✅ E008: 添加 constant() 回退，兼容 iOS < 11.2 */
  margin-bottom: calc(24rpx + constant(safe-area-inset-bottom, 0px));
  margin-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-radius: 60rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 深色模式：灰色玻璃质感悬浮导航栏 */
.tabbar-capsule.dark-mode {
  border-color: rgba(255, 255, 255, 0.12);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 12rpx 4rpx;
  margin: 12rpx 8rpx;
  border-radius: 42rpx;
  transition: transform 0.2s ease;
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-item.active {
  background: rgba(255, 255, 255, 0.38);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.42),
    0 8rpx 22rpx rgba(16, 40, 26, 0.12);
}

.dark-mode .tab-item.active {
  background: rgba(10, 132, 255, 0.18);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.1),
    0 10rpx 24rpx rgba(0, 0, 0, 0.32);
}

.icon-wrapper {
  position: relative;
  width: 56rpx;
  height: 56rpx;
  margin-bottom: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 确保点击区域足够大 (min 44px = 88rpx) */
  min-width: 88rpx;
  min-height: 88rpx;
}

.tab-icon {
  width: 56rpx;
  height: 56rpx;
  transition:
    transform 0.2s ease,
    filter 0.3s ease;
}

/* 深色模式下图标亮度调整 - 使用白色滤镜使其可见 */
.dark-mode .tab-icon {
  filter: brightness(0) invert(1) opacity(0.7);
}

.tab-item.active .tab-icon {
  transform: scale(1.15);
}

/* 深色模式下激活图标 - 完全白色且更亮 */
.dark-mode .tab-item.active .tab-icon {
  filter: brightness(0) invert(1) opacity(1);
}

/* 选中状态下的图标光晕效果 */
.tab-item.active .icon-wrapper::after {
  content: '';
  position: absolute;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  opacity: 1;
  z-index: -1;
}

.dark-mode .tab-item.active .icon-wrapper::after {
  background: rgba(10, 132, 255, 0.2);
}

.tab-label {
  font-size: 24rpx;
  color: var(--text-sub, #8e8e93);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  transition: color 0.3s ease;
}

/* 深色模式下的文字颜色 - 使用浅灰色确保可见 */
.dark-mode .tab-label {
  color: rgba(255, 255, 255, 0.6);
}

.tab-item.active .tab-label {
  color: var(--primary);
  font-weight: 600;
}

/* 深色模式下激活文字颜色 - 使用白色确保可见 */
.dark-mode .tab-item.active .tab-label {
  color: var(--ds-color-text-inverse, #ffffff);
}

.red-dot {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  background-color: var(--ds-color-error, #ff3b30);
  border-radius: 50%;
  border: 2rpx solid var(--ds-color-surface, #ffffff);
  transition: border-color 0.3s ease;
}

/* 深色模式下红点边框颜色 */
.dark-mode .red-dot {
  border-color: rgba(45, 45, 45, 0.9);
}
</style>
