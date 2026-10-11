<template>
  <view ref="splashRoot" class="splash-container" :class="{ 'dark-mode': isDark, 'theme-light': !isDark }">
    <!-- 主内容：垂直水平居中 -->
    <view class="splash-main">
      <!-- Logo：圆角方形裁切容器 -->
      <view class="logo-clip">
        <image class="logo-img" src="/static/images/logo.png" :alt="BRAND.name" mode="aspectFit" />
      </view>

      <!-- 品牌名：双色增强品牌辨识度 -->
      <text class="brand-name">
        <text class="brand-exam">{{ BRAND.name }}</text>
      </text>
    </view>

    <!-- 加载进度暗示：三个脉动圆点 -->
    <view class="loading-dots" role="status" aria-label="加载中">
      <view class="dot dot-1" />
      <view class="dot dot-2" />
      <view class="dot dot-3" />
    </view>

    <button v-if="showManualEntry" class="manual-entry" role="button" tabindex="0" @tap="openHomeTab">
      <text class="manual-entry-title">进入首页</text>
    </button>
  </view>
</template>

<script setup>
import { BRAND } from '@/config/brand.js';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme';
import { storageService } from '@/services/storageService.js';
import { getCurrentRoute, openHomeTab as navigateHomeTab } from '@/utils/home-navigation.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';

const isDark = ref(initTheme());
const splashRoot = ref(null);
let unbindKeyboard = () => undefined;
let active = true;
const navigationTimers = new Set();
const themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};

const splashTimer = ref(null);
const manualEntryTimer = ref(null);
const showManualEntry = ref(false);

// 视觉快照模式检测
function isVisualSnapshot() {
  if (typeof location === 'undefined') {
    return false;
  }
  return /visual=1/.test(location.hash || '') || /visual=1/.test(location.search || '');
}

function navigateAfterSplash() {
  if (!active) return;
  const completed = storageService.get('onboarding_completed', false);
  if (completed) {
    openHomeTab();
    return;
  }
  openOnboarding();
}

function openOnboarding() {
  if (!active) return;
  uni.redirectTo({
    url: '/pages/login/onboarding',
    fail: (err1) => {
      if (!active) return;
      logger.warn('[Splash] onboarding redirect failed, try reLaunch', err1);
      uni.reLaunch({
        url: '/pages/login/onboarding',
        fail: (err2) => {
          if (!active) return;
          logger.warn('[Splash] onboarding reLaunch failed, open home', err2);
          openHomeTab();
        }
      });
    }
  });
}

function openHomeTab() {
  if (!active) return;
  showManualEntry.value = false;
  navigateHomeTab({
    isCurrent: () => active,
    schedule: (callback, delay) => {
      if (!active) return;
      const timer = setTimeout(() => {
        navigationTimers.delete(timer);
        if (active) callback();
      }, delay);
      navigationTimers.add(timer);
    },
    onFail: (error) => {
      logger.error('[Splash] home navigation failed', error);
      showManualEntry.value = true;
    }
  });
}

onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(splashRoot.value);
  onThemeUpdate(themeHandler);
  if (isVisualSnapshot()) {
    logger.log('[Splash] visual snapshot mode, skip auto navigation');
    return;
  }
  splashTimer.value = setTimeout(() => {
    logger.log('[Splash] navigating after splash');
    navigateAfterSplash();
  }, 1800);
  manualEntryTimer.value = setTimeout(() => {
    if (getCurrentRoute().includes('splash')) {
      showManualEntry.value = true;
    }
  }, 4200);
});

// 页面销毁时清除定时器
onBeforeUnmount(() => {
  active = false;
  for (const timer of navigationTimers) clearTimeout(timer);
  navigationTimers.clear();
  unbindKeyboard();
  offThemeUpdate(themeHandler);
  if (splashTimer.value) {
    clearTimeout(splashTimer.value);
    splashTimer.value = null;
  }
  if (manualEntryTimer.value) {
    clearTimeout(manualEntryTimer.value);
    manualEntryTimer.value = null;
  }
});
</script>

<style lang="scss" scoped>
.splash-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text-primary, #31263f);
  background: radial-gradient(ellipse at 50% 40%, var(--yozi-reading, #f8f6ff), var(--yozi-solid, #eae8fc) 70%);
  font-family:
    'DM Sans',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}
.splash-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -48px;
}
.logo-clip {
  width: 120px;
  height: 120px;
  border-radius: 28px;
  overflow: hidden;
  margin-bottom: 24px;
  background: var(--yozi-glass, rgba(248, 246, 255, 0.7));
  box-shadow: var(--yozi-shadow);
}
.logo-img {
  width: 100%;
  height: 100%;
}
.brand-name {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.loading-dots {
  position: absolute;
  bottom: max(72px, env(safe-area-inset-bottom));
  display: flex;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary, #79698f);
  animation: dotPulse 1.4s ease-in-out infinite;
}
.dot + .dot {
  margin-left: 8px;
}
.dot-2 {
  animation-delay: 0.2s;
}
.dot-3 {
  animation-delay: 0.4s;
}
@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}
.manual-entry {
  position: absolute;
  right: 28px;
  bottom: max(112px, calc(env(safe-area-inset-bottom) + 84px));
  left: 28px;
  min-height: 44px;
  margin: 0;
  border-radius: 12px;
  color: var(--yozi-button-ink, #fff);
  background: var(--yozi-button, #7050b0);
  box-shadow: var(--yozi-button-shadow);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}
.manual-entry-title {
  font-size: 16px;
  font-weight: 600;
}
.manual-entry:focus-visible {
  outline: 2px solid var(--primary, #9972da);
  outline-offset: 3px;
}
.manual-entry:active {
  transform: translateY(2px);
  transition-duration: 100ms;
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
  .manual-entry {
    transition: none;
    transform: none;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .logo-clip {
    background: var(--yozi-solid, #f8f6ff);
  }
}
</style>
