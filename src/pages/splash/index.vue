<template>
  <view class="splash-container">
    <!-- 主内容：垂直水平居中 -->
    <view class="splash-main">
      <!-- Logo：圆形裁切容器 -->
      <view class="logo-clip">
        <image class="logo-img" src="/static/images/logo-full.png" alt="Exam Master" mode="aspectFill" />
      </view>

      <!-- 品牌名 -->
      <text class="brand-name">Exam Master</text>

      <!-- 品牌副标题 -->
      <text class="brand-slogan">AI 助力，一战成硕</text>
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

/* 全屏容器 */
.splash-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--background);
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
  margin-top: -40px;
}

/* Logo 圆形裁切容器 —— iOS 风格圆角方形 */
.logo-clip {
  width: 120px;
  height: 120px;
  border-radius: 28px;
  overflow: hidden;
  margin-bottom: 24px;
  background: var(--bg-card);
  /* 微妙的阴影 —— 暗黑模式下改为发光边框 */
  box-shadow:
    0 2px 16px rgba(0, 0, 0, 0.06),
    0 0 0 0.5px rgba(0, 0, 0, 0.04);
  /* 入场动画 */
  opacity: 0;
  animation: logoEnter 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s forwards;
}

.logo-img {
  width: 100%;
  height: 100%;
}

/* 品牌名 */
.brand-name {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 1px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  /* 入场动画 */
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.35s forwards;
}

/* 品牌副标题 */
.brand-slogan {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  letter-spacing: 0.5px;
  font-weight: 400;
  /* 入场动画 */
  opacity: 0;
  animation: fadeUp 0.5s ease-out 0.5s forwards;
}

/* 底部版权 */
.splash-footer {
  position: absolute;
  bottom: 48px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  /* 入场动画 */
  opacity: 0;
  animation: fadeIn 0.5s ease-out 0.65s forwards;
}

.copyright {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
}
</style>
