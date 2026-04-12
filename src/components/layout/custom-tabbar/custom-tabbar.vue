<template>
  <!-- 外层定位容器：完全透明，不阻挡点击 -->
  <view class="tabbar-position-wrapper">
    <!-- 内层胶囊：唯一可见实体，恢复点击 -->
    <view class="tabbar-capsule" :class="{ 'dark-mode': isDark }" :style="capsuleStyle">
      <view
        v-for="(item, index) in tabList"
        :id="`e2e-tabbar-${item.path.split('/')[2]}`"
        :key="index"
        class="tab-item"
        :class="{ active: resolvedActiveIndex === index }"
        @tap="switchTab(item.path, index)"
      >
        <view class="icon-wrapper">
          <image
            v-if="resolvedActiveIndex === index"
            :src="item.selectedIcon"
            class="tab-icon"
            alt=""
            mode="aspectFit"
          />
          <image v-else :src="item.icon" class="tab-icon" alt="" mode="aspectFit" />
          <view v-if="item.showDot" class="red-dot" />
        </view>
        <text class="tab-label">
          {{ item.text }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
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
  if (typeof location !== 'undefined' && url) {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    location.hash = `#${normalized}`;
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
  if (typeof location !== 'undefined') {
    const hashPath = location.hash.replace(/^#/, '');
    if (hashPath) {
      return hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
    }
  }
  // #endif
  return '/pages/index/index';
}

const props = defineProps({
  // ✅ F005: activeIndex 已废弃，保留兼容但优先使用自动路由检测
  activeIndex: { type: Number, default: -1 },
  isDark: { type: Boolean, default: false }
});

const mistakeDot = ref(false);
const currentRoute = ref('');
// E008: JS 安全区域回退值（用于不支持 CSS env() 的老设备）
const safeAreaBottom = ref(0);

// E008: 动态计算胶囊底部间距（JS 回退）
const capsuleStyle = computed(() => {
  if (safeAreaBottom.value > 0) {
    return { marginBottom: `calc(24rpx + ${safeAreaBottom.value}px)` };
  }
  return {};
});

// ✅ F005: 自动检测当前路由对应的 tab 索引
const resolvedActiveIndex = computed(() => {
  // 如果手动传入了有效的 activeIndex，优先使用（向后兼容）
  if (props.activeIndex >= 0) return props.activeIndex;
  // 自动检测当前路由
  const idx = tabList.value.findIndex((tab) => currentRoute.value.includes(tab.path));
  return idx >= 0 ? idx : 0;
});

// ✅ 审核模式下过滤掉隐藏功能入口
const tabList = computed(() => {
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
      showDot: mistakeDot.value,
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
});

watch(
  () => props.isDark,
  (newVal) => {
    logger.log('[CustomTabbar] 主题变化:', newVal ? '深色模式' : '浅色模式');
  }
);

// E008: JS 安全区域检测（兼容老设备）
function detectSafeArea() {
  try {
    const winInfo = getWindowInfo();
    const bottom = winInfo.safeArea ? winInfo.screenHeight - winInfo.safeArea.bottom : 0;
    if (bottom > 0) {
      safeAreaBottom.value = bottom;
      logger.log('[CustomTabbar] 安全区域底部:', bottom, 'px');
    }
  } catch (e) {
    logger.warn('[CustomTabbar] 安全区域检测失败:', e);
  }
}

// ✅ F005: 自动检测当前路由
function detectCurrentRoute() {
  try {
    if (typeof getCurrentPages === 'function') {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        currentRoute.value = '/' + (currentPage.route || currentPage.__route__ || '');
        logger.log('[CustomTabbar] 自动检测路由:', currentRoute.value);
        return;
      }
    }

    currentRoute.value = getCurrentRoutePath();
  } catch (e) {
    logger.warn('[CustomTabbar] 路由检测失败:', e);
    currentRoute.value = getCurrentRoutePath();
  }
}

function checkMistakeStatus() {
  const mistakes = storageService.get('mistake_book', []);
  mistakeDot.value = mistakes.length > 0;
}

// 定时器追踪，防止组件卸载后执行回调
let _switchTabTimer = null;

function switchTab(path, index) {
  if (resolvedActiveIndex.value === index) return;
  const uniApi = getUniApi();
  try {
    if (uniApi && typeof uniApi.vibrateShort === 'function') uniApi.vibrateShort();
  } catch (e) {
    logger.log('[CustomTabbar] 振动反馈失败:', e);
  }

  const item = tabList.value[index];

  // 根据页面类型选择跳转方式
  _switchTabTimer = setTimeout(() => {
    _switchTabTimer = null;
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

onMounted(() => {
  checkMistakeStatus();
  detectCurrentRoute();
  // F005: 监听页面 onShow 事件，确保 switchTab 后重新检测路由
  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.$on === 'function') {
    uniApi.$on('tabbarRouteUpdate', detectCurrentRoute);
  }
  // E008: JS 安全区域检测回退（兼容不支持 CSS env() 的设备）
  detectSafeArea();
});

// F005: 清理事件监听，防止内存泄漏
onBeforeUnmount(() => {
  if (_switchTabTimer) {
    clearTimeout(_switchTabTimer);
    _switchTabTimer = null;
  }
  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.$off === 'function') {
    uniApi.$off('tabbarRouteUpdate', detectCurrentRoute);
  }
});
</script>

<style lang="scss" scoped>
/* 外层定位容器：绝对透明，不阻挡点击 */
.tabbar-position-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: transparent;
  pointer-events: none;
}

/* 内层胶囊：唯一可见的实体元素 — 3D 立体风格 */
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
  pointer-events: auto;
  transition: all 0.2s ease;
  position: relative;

  /* 3D 实色胶囊：白底 + 边框 + 顶部阴影（从底部往上看的 3D 感） */
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  box-shadow:
    0 -4rpx 0 var(--em3d-border-shadow),
    0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

/* 深色模式 */
.tabbar-capsule.dark-mode {
  background-color: var(--em3d-card-bg);
  border-color: var(--em3d-border);
  box-shadow:
    0 -4rpx 0 var(--em3d-border-shadow),
    0 4rpx 16rpx rgba(0, 0, 0, 0.3);
}

/* 暗色模式顶部高光线（3D 立体感） */
.tabbar-capsule.dark-mode::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24rpx;
  right: 24rpx;
  height: 2rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 60rpx 60rpx 0 0;
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
  transform: scale(0.9);
}

/* 选中态：3D 实色药丸 */
.tab-item.active {
  background-color: var(--em3d-primary-light);
  box-shadow: inset 0 2rpx 4rpx rgba(0, 0, 0, 0.06);
  border-radius: 42rpx;
}

.dark-mode .tab-item.active {
  background-color: var(--em3d-primary-light);
  box-shadow: inset 0 2rpx 4rpx rgba(0, 0, 0, 0.15);
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

/* 深色模式下图标亮度调整 — 使用白色滤镜使其可见 */
.dark-mode .tab-icon {
  filter: brightness(0) invert(1) opacity(0.7);
}

.tab-item.active .tab-icon {
  transform: scale(1.15);
}

/* 深色模式下激活图标 — 完全白色且更亮 */
.dark-mode .tab-item.active .tab-icon {
  filter: brightness(0) invert(1) opacity(1);
}

/* 选中状态下的图标光晕效果 — 3D 实色圆 */
.tab-item.active .icon-wrapper::after {
  content: '';
  position: absolute;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: var(--em3d-primary-light);
  opacity: 1;
  z-index: -1;
}

.dark-mode .tab-item.active .icon-wrapper::after {
  background-color: var(--em3d-primary-light);
}

/* 未选中态文字 */
.tab-label {
  font-size: 24rpx;
  color: var(--em3d-text-3);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  transition: color 0.2s ease;
}

/* 深色模式下的未选中文字 */
.dark-mode .tab-label {
  color: var(--em3d-text-3);
}

/* 选中态文字 */
.tab-item.active .tab-label {
  color: var(--em3d-primary);
  font-weight: 700;
}

/* 深色模式下选中文字 */
.dark-mode .tab-item.active .tab-label {
  color: var(--em3d-primary);
}

.red-dot {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  background-color: var(--danger, var(--danger));
  border-radius: 50%;
  border: 2rpx solid var(--bg-card, #ffffff);
  transition: border-color 0.3s ease;
}

/* 深色模式下红点边框颜色 */
.dark-mode .red-dot {
  border-color: rgba(41, 37, 36, 0.96);
}
</style>
