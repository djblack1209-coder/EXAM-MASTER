<template>
  <view ref="splashRoot" class="splash-container" :class="{ 'dark-mode': isDark, 'theme-light': !isDark }">
    <!-- 主内容：垂直水平居中 -->
    <view class="splash-main">
      <YoziMascot pose="idle" play="loop" size="medium" />

      <!-- 品牌名：双色增强品牌辨识度 -->
      <text class="brand-name">
        <text class="brand-exam">{{ BRAND.name }}</text>
      </text>
    </view>

    <!-- 加载进度暗示：三个脉动圆点 -->
    <view class="loading-dots" role="status" :aria-label="$t('ui.loading')">
      <view class="dot dot-1" />
      <view class="dot dot-2" />
      <view class="dot dot-3" />
    </view>

    <BaseButton v-if="showManualEntry" class="manual-entry" @tap="openHomeTab">{{ $t('nav.home') }}</BaseButton>
  </view>
</template>

<script setup>
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { BRAND } from '@/config/brand.js';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme';
import { storageService } from '@/services/storageService.js';
import { getCurrentRoute, openLearningEntry as navigateHomeTab } from '@/utils/home-navigation.js';
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
  color: var(--ink);
  background: var(--canvas);
  font-family: var(--font-ui);
}
.splash-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: calc(-1 * var(--control-height));
}
.logo-clip {
  width: var(--mascot-halo);
  height: var(--mascot-halo);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: var(--s-6);
  background: var(--glass);
  box-shadow: var(--yozi-shadow);
}
.logo-img {
  width: 100%;
  height: 100%;
}
.brand-name {
  font: var(--weight-display) var(--size-title-1)/var(--leading-title-1) var(--font-display);
  letter-spacing: var(--tracking-title);
}
.loading-dots {
  position: absolute;
  bottom: max(calc(var(--s-14) + var(--s-4)), env(safe-area-inset-bottom));
  display: flex;
}
.dot {
  width: var(--bubble-tail);
  height: var(--bubble-tail);
  border-radius: var(--r-pill);
  background: var(--ink-3);
  animation: dotPulse 1.4s ease-in-out infinite;
}
.dot + .dot {
  margin-left: var(--s-2);
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
  right: var(--s-6);
  left: var(--s-6);
  bottom: max(calc(var(--s-14) * 2), calc(env(safe-area-inset-bottom) + var(--s-14) + var(--s-6)));
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
    background: var(--paper);
  }
}
</style>
