<template>
  <view class="splash-container">
    <view class="content-wrapper">
      <view class="logo-wrapper">
        <view class="splash-pulse-ring" />
        <image class="logo-icon" src="../login/static/logo.png" alt="Exam Master" mode="aspectFit" />
      </view>

      <text class="app-name"> Exam-Master </text>

      <text class="splash-greeting">{{ greeting }}</text>

      <view v-if="streakDays > 0" class="streak-preview">
        <text class="streak-flame">🔥</text>
        <text class="streak-text">连续学习 {{ streakDays }} 天</text>
      </view>

      <view class="loading-dots">
        <view class="dot" />
        <view class="dot" />
        <view class="dot" />
      </view>
    </view>

    <view class="footer-fluid">
      <view class="wave-layer layer-1" />
      <view class="wave-layer layer-2" />
      <view class="wave-layer layer-3" />
    </view>

    <view class="swoosh-arrow-container">
      <view class="arrow-body" />
      <view class="arrow-head" />
    </view>
  </view>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';

const splashTimer = ref(null);

// 动态问候语
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了，注意休息 🌙';
  if (hour < 9) return '早安，新的一天加油 ☀️';
  if (hour < 12) return '上午好，状态正佳 📖';
  if (hour < 14) return '中午好，适当休息 🍵';
  if (hour < 18) return '下午好，继续冲刺 💪';
  if (hour < 22) return '晚上好，坚持就是胜利 🌟';
  return '夜深了，注意休息 🌙';
});

// 连续学习天数
const streakDays = ref(0);
try {
  const dailyRecords = storageService.get('daily_study_records', {});
  const dates = Object.keys(dailyRecords).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  streakDays.value = streak;
} catch {
  /* silent */
}

function isVisualSnapshot() {
  if (typeof location === 'undefined') {
    return false;
  }
  return /visual=1/.test(location.hash || '');
}

function navigateAfterSplash() {
  // 检查是否完成过引导
  const hasOnboarded = storageService.get('onboarding_completed', false);

  if (!hasOnboarded) {
    // 新用户 → 引导流程
    logger.log('[Splash] New user, navigate to onboarding');
    uni.redirectTo({
      url: '/pages/login/onboarding',
      fail: (err) => {
        logger.warn('[Splash] onboarding redirect failed, fallback to home', err);
        openHomeTab();
      }
    });
  } else {
    // 老用户 → 首页
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

  // 兜底：如果 3 秒后仍未离开 splash，强制再次跳转
  setTimeout(() => {
    if (!navigated) return;
    // 检查是否仍在 splash 页
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
  if (isVisualSnapshot()) {
    logger.log('[Splash] visual snapshot mode, skip auto navigation');
    return;
  }
  splashTimer.value = setTimeout(() => {
    logger.log('[Splash] navigating after splash');
    navigateAfterSplash();
  }, 1200);
});

// [AUDIT FIX] 页面销毁时清除定时器，防止已卸载页面触发导航
onBeforeUnmount(() => {
  if (splashTimer.value) {
    clearTimeout(splashTimer.value);
    splashTimer.value = null;
  }
});
</script>

<style lang="scss" scoped>
/* ===== Splash 品牌入场动画 ===== */
@keyframes splashLogoEnter {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  60% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes splashTextEnter {
  0% {
    transform: translateY(40rpx);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes splashPulseRing {
  0% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.3);
    opacity: 0;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.6;
  }
}

@keyframes splashStreakEnter {
  0% {
    transform: translateY(20rpx) scale(0.9);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes splashDotsEnter {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* 全局容器 */
.splash-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100%;
  height: 100vh;
  background: linear-gradient(180deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 85%, #000) 100%);
  overflow: hidden;
  transition: background 0.3s;
}

.splash-container.dark-mode {
  background: linear-gradient(180deg, #0b0b0f 0%, #111118 50%, #0a1a0f 100%);
}

/* 1. 内容区域 */
.content-wrapper {
  position: absolute;
  top: 32%;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 50;
}

/* Logo 包裹层 — 用于定位脉冲环 */
.logo-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  /* 入场动画 */
  animation: splashLogoEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 0;
}

/* 脉冲光环 */
.splash-pulse-ring {
  position: absolute;
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  border: 4rpx solid var(--primary-foreground, #fff);
  opacity: 0;
  animation: splashPulseRing 2s ease-in-out 0.6s infinite;
}

.logo-icon {
  width: 100px;
  height: 100px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
}

.app-name {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--primary-foreground);
  letter-spacing: 0.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  /* 入场动画：延迟 0.2s */
  opacity: 0;
  animation: splashTextEnter 0.5s ease-out 0.2s forwards;
}

.splash-greeting {
  font-size: 28rpx;
  color: var(--primary-foreground);
  margin-top: 12px;
  letter-spacing: 1rpx;
  /* 入场动画：延迟 0.4s */
  opacity: 0;
  animation: splashTextEnter 0.5s ease-out 0.4s forwards;
}

.streak-preview {
  display: flex;
  align-items: center;
  margin-top: 16px;
  padding: 8rpx 24rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 32rpx;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* 入场动画：延迟 0.55s */
  opacity: 0;
  animation: splashStreakEnter 0.5s ease-out 0.55s forwards;
}

.streak-flame {
  font-size: 32rpx;
  margin-right: 8rpx;
}

.streak-text {
  font-size: 24rpx;
  color: var(--primary-foreground);
  font-weight: 600;
}

.loading-dots {
  display: flex;
  margin-top: 24px;
  /* 入场动画：延迟 0.7s，与品牌元素错开 */
  opacity: 0;
  animation: splashDotsEnter 0.4s ease-out 0.7s forwards;

  .dot {
    width: 8px;
    height: 8px;
    background-color: var(--primary-foreground);
    border-radius: 50%;
    opacity: 0.6;
    animation: blink 1.5s infinite ease-in-out both;
    box-shadow: 0 0 12px var(--brand-glow);
  }

  .dot + .dot {
    margin-left: 8px;
  }

  .dot:nth-child(1) {
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 2. 底部流体波浪 (关键还原点) */
.footer-fluid {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 35vh;
  z-index: 10;
  /* 裁剪溢出，保证底部整齐 */
  overflow: hidden;
}

.wave-layer {
  position: absolute;
  bottom: -50%;
  left: -20%;
  width: 140%;
  height: 100%;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; /* 这种圆角能模拟波浪形状 */
  opacity: 0.9;
}

/* 蓝色层 (背景) */
.layer-1 {
  background: linear-gradient(120deg, #0052d4 0%, #4364f7 100%);
  bottom: -40%;
  left: -30%;
  transform: rotate(-10deg);
  opacity: 0.8;
  z-index: 1;
}

/* 青/黄层 (中间过渡) */
.layer-2 {
  background: linear-gradient(120deg, #20bdff 0%, #a5fecb 100%);
  bottom: -55%;
  left: -10%;
  transform: rotate(5deg);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  z-index: 2;
  opacity: 0.8;
}

/* 橙红层 (前景高光) */
.layer-3 {
  background: linear-gradient(90deg, #ffc107 0%, #ff5722 50%, #f7797d 100%);
  bottom: -60%;
  right: -20%;
  left: auto;
  width: 120%;
  transform: rotate(-5deg);
  border-radius: 50% 50% 0 0;
  z-index: 3;
}

/* 3. 大箭头 Swoosh (纯 CSS 绘制，不依赖图片) */
.swoosh-arrow-container {
  position: absolute;
  bottom: 8%;
  left: 0;
  width: 100%;
  height: 150px;
  z-index: 20; /* 在波浪之上 */
  /* 透视变形，制造"飞出"的感觉 */
  transform: rotate(-10deg) skewX(-15deg);
  opacity: 0.95;
  filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
}

.arrow-body {
  position: absolute;
  bottom: 20px;
  left: -20px;
  width: 80%; /* 长长的尾巴 */
  height: 18px; /* 箭身粗细 */
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 40%);
  border-radius: 0 4px 4px 0;
}

.arrow-head {
  position: absolute;
  bottom: 9px; /* 微调对齐箭身 */
  left: 78%; /* 放在箭身末端 */
  width: 0;
  height: 0;
  border-top: 20px solid transparent;
  border-bottom: 20px solid transparent;
  border-left: 40px solid var(--primary-foreground); /* 箭头形状 */
}
</style>
