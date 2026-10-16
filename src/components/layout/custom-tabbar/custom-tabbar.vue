<template>
  <view ref="keyboardRoot" class="tabbar-position-wrapper" role="navigation" :aria-label="t('nav.label')">
    <view
      class="tabbar-capsule"
      :class="{
        'dark-mode': isDarkMode,
        'theme-light': !isDarkMode,
        dragging: isDragging,
        'reduce-motion': reducedMotion
      }"
      :style="capsuleStyle"
      @touchstart="handleTouchStart"
      @touchmove.stop="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <view
        v-for="(item, index) in tabList"
        :id="`e2e-tabbar-${item.path.split('/')[2]}`"
        :key="item.path"
        class="tab-item"
        role="button"
        tabindex="0"
        data-learning-toggle="true"
        :aria-label="item.text"
        :aria-current="resolvedActiveIndex === index ? 'page' : undefined"
        :class="{
          active: visualActiveIndex === index,
          pressing: pressedIndex === index
        }"
        @tap="switchTab(item.path, index)"
      >
        <view class="icon-wrapper">
          <BaseIcon
            class="tab-icon"
            :name="item.icon"
            :selected="visualActiveIndex === index"
            :tone="visualActiveIndex === index ? 'violet-ink' : 'ink-3'"
          />
          <view v-if="item.showDot" class="red-dot" />
        </view>
        <text class="tab-label">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import config from '@/config/index.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';
import { t } from '@/i18n/index.js';

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
const themeStore = useThemeStore();

const mistakeDot = ref(false);
const currentRoute = ref('');
const safeAreaStyle = ref({});
const optimisticIndex = ref(null);
const pressedIndex = ref(null);
const touchStartX = ref(0);
const dragOffset = ref(0);
const isDragging = ref(false);
const keyboardRoot = ref(null);
const reducedMotion = ref(true);
let releaseKeyboard = () => undefined;
let releaseMotion = () => undefined;

const tabList = computed(() => {
  const allTabs = [
    {
      text: t('nav.home'),
      path: '/pages/index/index',
      icon: 'home',
      showDot: false,
      isTabBar: true
    },
    {
      text: t('nav.practice'),
      path: '/pages/practice/index',
      icon: 'list',
      showDot: mistakeDot.value,
      isTabBar: true
    },
    {
      text: t('nav.profile'),
      path: '/pages/profile/index',
      icon: 'user',
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

const isDarkMode = computed(() => props.isDark || themeStore.isDark);

const capsuleStyle = computed(() => safeAreaStyle.value);

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
  safeAreaStyle.value = getTabbarSafeAreaStyle();
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
  if (['dark', 'light'].includes(mode) && themeStore.isDark !== (mode === 'dark')) {
    themeStore.setDarkMode(mode === 'dark');
  }
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

onShow(() => {
  // Tab pages are cached, so a previous pending highlight can survive navigation.
  optimisticIndex.value = null;
  pressedIndex.value = null;
  detectCurrentRoute();
});

onMounted(() => {
  releaseKeyboard = bindLearningKeyboard(keyboardRoot.value);
  releaseMotion = bindBusinessMotion((reduced) => {
    reducedMotion.value = reduced;
  });
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
  releaseKeyboard();
  releaseMotion();
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
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  padding-inline: var(--s-4);
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
  pointer-events: none;
}
.tabbar-capsule {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: calc(var(--dialog-width) + var(--s-6));
  height: var(--tabbar-height);
  margin: 0 0 calc(var(--tabbar-gap) + var(--yozi-safe-bottom));
  padding: var(--s-1);
  pointer-events: auto;
  border: var(--border-thin) solid var(--glass-line);
  border-radius: var(--r-pill);
  background: var(--glass);
  box-shadow: var(--lift-2);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  touch-action: pan-x;
}
.tab-item {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-1);
  min-height: var(--touch-min);
  color: var(--ink-3);
  background: transparent;
  border-radius: var(--r-pill);
}
.tab-item.active {
  color: var(--violet-ink);
}
.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-label {
  font: var(--weight-ui-emphasis) var(--size-caption)/var(--leading-caption) var(--font-ui);
}
.red-dot {
  position: absolute;
  top: 0;
  right: calc(-1 * var(--s-1));
  width: var(--s-2);
  height: var(--s-2);
  border: var(--border-selected) solid var(--paper);
  border-radius: var(--r-pill);
  background: var(--coral-fill);
}
.tab-item:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: calc(-1 * var(--border-selected));
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .tabbar-capsule {
    background: var(--paper);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@supports not (backdrop-filter: blur(1px)) {
  .tabbar-capsule {
    background: var(--paper);
  }
}
</style>
