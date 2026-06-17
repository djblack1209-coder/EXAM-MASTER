<template>
  <view class="tabbar-position-wrapper">
    <view
      class="tabbar-capsule"
      :class="{ 'dark-mode': isDarkMode, dragging: isDragging }"
      :style="capsuleStyle"
      @touchstart="handleTouchStart"
      @touchmove.stop="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <view class="tabbar-sheen" />
      <view class="tabbar-glider" :style="gliderStyle" />

      <view
        v-for="(item, index) in tabList"
        :id="`e2e-tabbar-${item.path.split('/')[2]}`"
        :key="item.path"
        class="tab-item"
        :class="{
          active: visualActiveIndex === index,
          pressing: pressedIndex === index
        }"
        @tap="switchTab(item.path, index)"
      >
        <view class="icon-wrapper">
          <image :src="visualActiveIndex === index ? item.selectedIcon : item.icon" class="tab-icon" mode="aspectFit" />
          <view v-if="item.showDot" class="red-dot" />
        </view>
        <text class="tab-label">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import config from '@/config/index.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { getWindowInfo } from '@/utils/core/system.js';
import { getAssetUrl } from '@/config/static-assets.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';

const SWIPE_THRESHOLD = 28;
const MAX_DRAG_OFFSET = 96;
const NAVIGATION_DELAY = 80;

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
  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.reLaunch === 'function' && url) {
    uniApi.reLaunch({ url });
    return true;
  }
  // #endif

  return false;
}

function getCurrentRoutePath() {
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
  activeIndex: { type: Number, default: -1 },
  isDark: { type: Boolean, default: false }
});

const mistakeDot = ref(false);
const resolvedTheme = ref('light');
const currentRoute = ref('');
const safeAreaBottom = ref(0);
const optimisticIndex = ref(null);
const pressedIndex = ref(null);
const touchStartX = ref(0);
const dragOffset = ref(0);
const isDragging = ref(false);

const tabList = computed(() => {
  const allTabs = [
    {
      text: '首页',
      path: '/pages/index/index',
      icon: getAssetUrl('tabbar', 'home'),
      selectedIcon: getAssetUrl('tabbar', 'home-active'),
      showDot: false,
      isTabBar: true
    },
    {
      text: '刷题',
      path: '/pages/practice/index',
      icon: getAssetUrl('tabbar', 'practice'),
      selectedIcon: getAssetUrl('tabbar', 'practice-active'),
      showDot: mistakeDot.value,
      isTabBar: true
    },
    {
      text: '我的',
      path: '/pages/profile/index',
      icon: getAssetUrl('tabbar', 'profile'),
      selectedIcon: getAssetUrl('tabbar', 'profile-active'),
      showDot: false,
      isTabBar: true
    }
  ];

  if (config.audit.isAuditMode) {
    return allTabs.filter((tab) => {
      if (!tab.featureKey) return true;
      return !config.audit.hiddenFeatures.includes(tab.featureKey);
    });
  }

  return allTabs;
});

const resolvedActiveIndex = computed(() => {
  if (props.activeIndex >= 0) return props.activeIndex;
  const idx = tabList.value.findIndex((tab) => currentRoute.value.includes(tab.path));
  return idx >= 0 ? idx : 0;
});

const visualActiveIndex = computed(() => {
  const idx = optimisticIndex.value;
  if (idx === null || idx === undefined) return resolvedActiveIndex.value;
  return Math.max(0, Math.min(idx, tabList.value.length - 1));
});

const isDarkMode = computed(() => props.isDark || resolvedTheme.value === 'dark');

const capsuleStyle = computed(() => {
  if (safeAreaBottom.value > 0) {
    return { marginBottom: `calc(22rpx + ${safeAreaBottom.value}px)` };
  }
  return {};
});

const gliderStyle = computed(() => {
  const tabCount = Math.max(tabList.value.length, 1);
  const offset = isDragging.value ? dragOffset.value : 0;
  const translate = `calc(${visualActiveIndex.value * 100}% + ${offset}px)`;

  return {
    width: `calc((100% - 16rpx) / ${tabCount})`,
    transform: `translate3d(${translate}, 0, 0)`,
    transitionDuration: isDragging.value ? '0ms' : '320ms'
  };
});

watch(
  () => props.isDark,
  (newVal) => {
    logger.log('[CustomTabbar] theme:', newVal ? 'dark' : 'light');
  }
);

watch(resolvedActiveIndex, (idx) => {
  if (optimisticIndex.value !== null && optimisticIndex.value === idx) {
    optimisticIndex.value = null;
  }
});

function getTouchX(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  return Number(touch?.clientX || 0);
}

function triggerHaptic() {
  vibrateLight('light');
}

function clampDrag(delta) {
  const isAtFirst = visualActiveIndex.value === 0 && delta > 0;
  const isAtLast = visualActiveIndex.value === tabList.value.length - 1 && delta < 0;
  const resistance = isAtFirst || isAtLast ? 0.36 : 1;
  const next = delta * resistance;

  return Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, next));
}

function handleTouchStart(event) {
  detectCurrentRoute();
  optimisticIndex.value = null;
  touchStartX.value = getTouchX(event);
  dragOffset.value = 0;
  isDragging.value = true;
}

function handleTouchMove(event) {
  if (!isDragging.value) return;
  const delta = getTouchX(event) - touchStartX.value;
  dragOffset.value = clampDrag(delta);
}

function handleTouchEnd(event) {
  if (!isDragging.value) return;

  const delta = getTouchX(event) - touchStartX.value;
  const active = resolvedActiveIndex.value;
  let targetIndex = active;

  if (Math.abs(delta) >= SWIPE_THRESHOLD) {
    targetIndex = delta < 0 ? active + 1 : active - 1;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, tabList.value.length - 1));
  isDragging.value = false;
  dragOffset.value = 0;

  if (targetIndex !== active) {
    const target = tabList.value[targetIndex];
    if (target) switchTab(target.path, targetIndex);
  } else {
    optimisticIndex.value = active;
    setTimeout(() => {
      if (optimisticIndex.value === active) optimisticIndex.value = null;
    }, 180);
  }
}

function handleTouchCancel() {
  isDragging.value = false;
  dragOffset.value = 0;
}

function detectSafeArea() {
  try {
    const winInfo = getWindowInfo();
    const insetBottom = Number(winInfo.safeAreaInsets?.bottom || 0);
    const legacyBottom = winInfo.safeArea ? Number(winInfo.screenHeight - winInfo.safeArea.bottom) : 0;
    const bottom = insetBottom || legacyBottom || 0;
    safeAreaBottom.value = Math.max(0, Math.min(bottom, 48));
  } catch (e) {
    logger.warn('[CustomTabbar] safe area failed:', e);
  }
}

function detectCurrentRoute() {
  try {
    if (typeof getCurrentPages === 'function') {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        currentRoute.value = '/' + (currentPage.route || currentPage.__route__ || '');
        return;
      }
    }

    currentRoute.value = getCurrentRoutePath();
  } catch (e) {
    logger.warn('[CustomTabbar] route detect failed:', e);
    currentRoute.value = getCurrentRoutePath();
  }
}

function checkMistakeStatus() {
  const mistakes = storageService.get('mistake_book', []);
  mistakeDot.value = mistakes.length > 0;
}

function syncTheme(mode) {
  if (mode === 'dark' || mode === 'light') {
    resolvedTheme.value = mode;
    return;
  }
  resolvedTheme.value = storageService.get('theme_mode', 'light') === 'dark' ? 'dark' : 'light';
}

let _switchTabTimer = null;
let _pressTimer = null;

function switchTab(path, index) {
  pressedIndex.value = index;
  if (_pressTimer) clearTimeout(_pressTimer);
  _pressTimer = setTimeout(() => {
    pressedIndex.value = null;
    _pressTimer = null;
  }, 180);

  if (resolvedActiveIndex.value === index) return;

  optimisticIndex.value = index;
  triggerHaptic();

  const item = tabList.value[index];
  const uniApi = getUniApi();

  if (_switchTabTimer) clearTimeout(_switchTabTimer);
  _switchTabTimer = setTimeout(() => {
    _switchTabTimer = null;

    if (item && item.isTabBar && uniApi && typeof uniApi.switchTab === 'function') {
      uniApi.switchTab({
        url: path,
        success: () => {
          currentRoute.value = path;
          optimisticIndex.value = null;
        },
        fail: (err) => {
          logger.warn('[CustomTabbar] switchTab failed, try reLaunch:', err);
          if (typeof uniApi.reLaunch === 'function') {
            uniApi.reLaunch({
              url: path,
              success: () => {
                currentRoute.value = path;
                optimisticIndex.value = null;
              },
              fail: (err2) => {
                logger.error('[CustomTabbar] reLaunch failed:', err2);
                optimisticIndex.value = null;
                if (!fallbackRouteJump(path)) safeNavigateTo(path);
              }
            });
            return;
          }

          optimisticIndex.value = null;
          if (!fallbackRouteJump(path)) safeNavigateTo(path);
        }
      });
      return;
    }

    if (item && item.isTabBar) {
      if (!fallbackRouteJump(path)) safeNavigateTo(path);
      return;
    }

    safeNavigateTo(path);
  }, NAVIGATION_DELAY);
}

onMounted(() => {
  checkMistakeStatus();
  detectCurrentRoute();
  syncTheme();

  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.$on === 'function') {
    uniApi.$on('tabbarRouteUpdate', detectCurrentRoute);
    uniApi.$on('themeUpdate', syncTheme);
  }

  detectSafeArea();
});

onBeforeUnmount(() => {
  if (_switchTabTimer) {
    clearTimeout(_switchTabTimer);
    _switchTabTimer = null;
  }
  if (_pressTimer) {
    clearTimeout(_pressTimer);
    _pressTimer = null;
  }

  const uniApi = getUniApi();
  if (uniApi && typeof uniApi.$off === 'function') {
    uniApi.$off('tabbarRouteUpdate', detectCurrentRoute);
    uniApi.$off('themeUpdate', syncTheme);
  }
});
</script>

<style lang="scss" scoped>
.tabbar-position-wrapper {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
  background: transparent;
  pointer-events: none;
}

.tabbar-capsule {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: calc(100vw - 56rpx);
  min-width: 300rpx;
  max-width: 650rpx;
  height: 118rpx;
  margin-right: auto;
  margin-bottom: calc(22rpx + constant(safe-area-inset-bottom, 0px));
  margin-bottom: calc(22rpx + env(safe-area-inset-bottom, 0px));
  margin-left: auto;
  padding: 8rpx;
  overflow: hidden;
  pointer-events: auto;
  border-radius: 999rpx;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.88), rgba(240, 255, 228, 0.68)), rgba(255, 255, 255, 0.58);
  box-shadow:
    0 26rpx 70rpx rgba(13, 71, 36, 0.18),
    0 10rpx 26rpx rgba(13, 71, 36, 0.1),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.9),
    inset 0 -1rpx 0 rgba(18, 64, 30, 0.06);
  backdrop-filter: blur(20px) saturate(132%);
  -webkit-backdrop-filter: blur(20px) saturate(132%);
  touch-action: pan-x;
  transition-property: transform, opacity, box-shadow;
  transition-duration: 240ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.tabbar-capsule.dragging {
  transform: scale(1.012);
}

.tabbar-capsule.dark-mode {
  background: linear-gradient(145deg, rgba(37, 52, 42, 0.92), rgba(18, 38, 24, 0.84)), rgba(20, 33, 23, 0.9);
  box-shadow:
    0 28rpx 70rpx rgba(0, 0, 0, 0.34),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.1),
    inset 0 -1rpx 0 rgba(0, 0, 0, 0.2);
}

.tabbar-sheen {
  position: absolute;
  top: 8rpx;
  right: 30rpx;
  left: 30rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0));
  opacity: 0.7;
  pointer-events: none;
}

.tabbar-glider {
  position: absolute;
  box-sizing: border-box;
  top: 8rpx;
  bottom: 8rpx;
  left: 8rpx;
  z-index: 0;
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 30% 16%, rgba(255, 255, 255, 0.92), transparent 34%),
    linear-gradient(135deg, #f7ffe9 0%, #d9ffc1 48%, #b7f7e1 100%);
  box-shadow:
    0 14rpx 32rpx rgba(13, 71, 36, 0.15),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.82),
    inset 0 -2rpx 4rpx rgba(18, 64, 30, 0.07);
  pointer-events: none;
  transition-property: transform, opacity;
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tabbar-glider::after {
  content: '';
  position: absolute;
  right: 34rpx;
  bottom: 10rpx;
  left: 34rpx;
  height: 7rpx;
  border-radius: 999rpx;
  background: #18552f;
  box-shadow: 0 6rpx 16rpx rgba(24, 85, 47, 0.24);
}

.tab-item {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 100%;
  border-radius: 999rpx;
  transform: scale(1);
  transition-property: transform, opacity;
  transition-duration: 220ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.tab-item.active {
  transform: scale(1.055);
}

.tab-item.pressing,
.tab-item:active {
  transform: scale(0.94);
}

.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  margin-bottom: 4rpx;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  opacity: 0.66;
  filter: saturate(0.72);
  transform: translate3d(0, 0, 0) scale(1);
  transition-property: transform, opacity, filter;
  transition-duration: 240ms;
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tab-item.active .tab-icon {
  opacity: 1;
  filter: saturate(0.92);
  transform: translate3d(0, -3rpx, 0) scale(1.14);
}

.tab-label {
  max-width: 92rpx;
  overflow: hidden;
  color: rgba(20, 33, 23, 0.58);
  font-size: 23rpx;
  font-weight: 650;
  line-height: 1.14;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition-property: color, opacity, transform;
  transition-duration: 220ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.tab-item.active .tab-label {
  color: #142017;
  transform: translate3d(0, -1rpx, 0);
}

.dark-mode .tab-label {
  color: rgba(241, 248, 238, 0.6);
}

.dark-mode .tab-item.active .tab-label {
  color: #f5ffe9;
}

.dark-mode .tab-icon {
  filter: brightness(0) invert(1) opacity(0.72);
}

.dark-mode .tab-item.active .tab-icon {
  filter: brightness(0) invert(1) opacity(1);
}

.red-dot {
  position: absolute;
  top: -4rpx;
  right: -6rpx;
  width: 16rpx;
  height: 16rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  background-color: #ef4444;
  box-shadow: 0 4rpx 10rpx rgba(239, 68, 68, 0.28);
}

.dark-mode .red-dot {
  border-color: rgba(20, 33, 23, 0.92);
}
</style>
