<template>
  <view class="splash-container">
    <!-- 主内容：垂直水平居中 -->
    <view class="splash-main">
      <!-- Logo：圆角方形裁切容器 -->
      <view class="logo-clip">
        <image class="logo-img" src="/static/images/logo-full.png" alt="Exam Master" mode="aspectFill" />
      </view>

      <!-- 品牌名：双色增强品牌辨识度 -->
      <text class="brand-name"><text class="brand-exam">Exam</text> <text class="brand-master">Master</text></text>

      <!-- 品牌副标题 -->
      <text class="brand-slogan">AI 助力，一战成硕</text>
    </view>

    <!-- 加载进度暗示：三个脉动圆点 -->
    <view class="loading-dots">
      <view class="dot dot-1" />
      <view class="dot dot-2" />
      <view class="dot dot-3" />
    </view>

    <!-- 底部版权 -->
    <view class="splash-footer">
      <text class="copyright">Exam-Master Team</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme';

// 主题（暂留接口，极简白净版暂不区分深色）
const isDark = ref(initTheme());
const themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};

const splashTimer = ref(null);

// 视觉快照模式检测
function isVisualSnapshot() {
  if (typeof location === 'undefined') {
    return false;
  }
  return /visual=1/.test(location.hash || '') || /visual=1/.test(location.search || '');
}

// 导航逻辑
function navigateAfterSplash() {
  const hasOnboarded = storageService.get('onboarding_completed', false);

  if (!hasOnboarded) {
    logger.log('[Splash] New user, navigate to onboarding');
    uni.redirectTo({
      url: '/pages/login/onboarding',
      fail: (err) => {
        logger.warn('[Splash] onboarding redirect failed, fallback to home', err);
        openHomeTab();
      }
    });
  } else {
    openHomeTab();
  }
}

function openHomeTab() {
  let navigated = false;

  const doNavigate = () => {
    if (navigated) return;
    navigated = true;
    uni.switchTab({
      url: '/pages/index/index',
      fail: (err1) => {
        logger.warn('[Splash] switchTab failed, try reLaunch', err1);
        uni.reLaunch({
          url: '/pages/index/index',
          fail: (err2) => {
            logger.warn('[Splash] reLaunch failed, try redirectTo', err2);
            uni.redirectTo({
              url: '/pages/index/index',
              fail: (err3) => {
                logger.error('[Splash] all navigation failed', err3);
              }
            });
          }
        });
      }
    });
  };

  doNavigate();

  // 兜底：3 秒后仍在 splash 则强制跳转
  setTimeout(() => {
    if (!navigated) return;
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const current = pages.length > 0 ? pages[pages.length - 1] : null;
    const route = current ? current.route || current.__route__ || '' : '';
    if (route.includes('splash')) {
      logger.warn('[Splash] still on splash after 3s, force reLaunch');
      uni.reLaunch({ url: '/pages/index/index' });
    }
  }, 3000);
}

onMounted(() => {
  onThemeUpdate(themeHandler);
  if (isVisualSnapshot()) {
    logger.log('[Splash] visual snapshot mode, skip auto navigation');
    return;
  }
  splashTimer.value = setTimeout(() => {
    logger.log('[Splash] navigating after splash');
    navigateAfterSplash();
  }, 1800);
});

// 页面销毁时清除定时器
onBeforeUnmount(() => {
  offThemeUpdate(themeHandler);
  if (splashTimer.value) {
    clearTimeout(splashTimer.value);
    splashTimer.value = null;
  }
});
</script>

<style lang="scss" scoped>
/* ===== 极简白净 Splash ===== */

/* 入场动画 */
@keyframes logoEnter {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeUp {
  0% {
    transform: translateY(12px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* Logo 呼吸辉光：入场后缓慢脉动，保持页面"活"的感觉 */
@keyframes breathGlow {
  0%,
  100% {
    box-shadow: var(--icon-highlight);
  }
  50% {
    box-shadow: 0 8px 32px rgba(88, 204, 2, 0.18);
  }
}

/* 加载脉动圆点 */
@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 全屏容器 */
.splash-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* P1: 径向渐变背景增加空间深度感 */
  background: radial-gradient(ellipse at 50% 40%, var(--bg-card) 0%, var(--background) 70%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 主内容区 —— 垂直水平居中 */
.splash-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 稍微偏上一点，视觉重心更舒服 */
  margin-top: -48px;
}

/* Logo 圆角方形裁切容器 —— iOS 风格圆角方形 */
.logo-clip {
  width: 120px;
  height: 120px;
  border-radius: 28px;
  overflow: hidden;
  margin-bottom: 28px;
  background: var(--bg-card);
  /* 阴影随主题自动切换：亮色柔影 / 暗色品牌辉光 */
  box-shadow: var(--icon-highlight);
  /* 入场动画 */
  opacity: 0;
  animation:
    logoEnter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards,
    breathGlow 3s ease-in-out 1.2s infinite;
}

.logo-img {
  width: 100%;
  height: 100%;
}

/* 品牌名 */
.brand-name {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1.5px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  /* 入场动画 */
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.45s forwards;
}

/* P1: 品牌双色 — "Exam" 主色 + "Master" 品牌绿，增强辨识度 */
.brand-exam {
  color: var(--text-primary);
}

.brand-master {
  color: #58cc02;
}

/* 品牌副标题 */
.brand-slogan {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 12px;
  letter-spacing: 2px;
  font-weight: 400;
  /* 入场动画 */
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.65s forwards;
}

/* 底部版权 */
.splash-footer {
  position: absolute;
  bottom: 48px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  /* P4: 与上方元素统一运动语言 */
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.85s forwards;
}

.copyright {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
}

/* P2: 加载进度暗示 — 三个脉动圆点 */
.loading-dots {
  position: absolute;
  bottom: 100px;
  display: flex;
  gap: 8px;
  opacity: 0;
  animation: fadeIn 0.4s ease-out 1s forwards;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.dot-2 {
  animation-delay: 0.2s;
}

.dot-3 {
  animation-delay: 0.4s;
}
</style>
