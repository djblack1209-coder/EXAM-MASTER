<template>
  <view :class="['welcome-banner', 'apple-glass-card', isDark ? 'banner-dark' : 'banner-light']">
    <!-- 深色模式装饰气泡 -->
    <view v-if="isDark" class="bubble-decoration bubble-1" />
    <view v-if="isDark" class="bubble-decoration bubble-2" />

    <view class="banner-content">
      <view class="banner-text">
        <text class="welcome-title"> {{ greeting }}，{{ userName }}！ </text>
        <text v-if="examCountdown > 0" class="welcome-countdown">
          距离考研还有 <text class="highlight-text"> {{ examCountdown }} 天 </text>
        </text>
        <text class="welcome-subtitle">
          你有 <text class="highlight-text"> {{ finishedCount }} 道题目 </text> 待复习。继续保持！
        </text>
      </view>
      <view class="banner-actions">
        <view
          id="e2e-home-banner-practice"
          :class="['action-btn', 'btn-primary', 'apple-cta']"
          @tap="$emit('nav-to-practice')"
        >
          <BaseIcon name="lightning" :size="28" />
          <text class="btn-text"><text class="btn-label">快速练习</text></text>
        </view>
        <view
          id="e2e-home-banner-mock"
          class="action-btn btn-outline apple-glass-pill"
          @tap="$emit('nav-to-mock-exam')"
        >
          <BaseIcon name="clock" :size="28" />
          <text class="btn-text"> 模拟考试 </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { logger } from '@/utils/logger.js';

defineProps({
  isDark: { type: Boolean, default: false },
  userName: { type: String, default: '小伙伴' },
  finishedCount: { type: Number, default: 0 }
});
defineEmits(['nav-to-practice', 'nav-to-mock-exam']);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const examCountdown = computed(() => {
  try {
    // 考研日期：每年12月最后一个周末，简化为12月25日
    const now = new Date();
    const examYear = now.getFullYear();
    const examDate = new Date(examYear, 11, 25);
    if (now > examDate) examDate.setFullYear(examYear + 1);
    return Math.ceil((examDate - now) / 86400000);
  } catch (_e) {
    // 静默降级：倒计时计算失败不影响核心功能
    logger.warn('[WelcomeBanner] 考研倒计时计算失败，使用默认值');
    return 0;
  }
});
</script>

<style lang="scss" scoped>
/* ── 入场动画 ── */
@keyframes bannerSlideIn {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── 卡片容器（新拟物化风格） ── */
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: var(--em3d-radius-lg, 24rpx);
  padding: 44rpx;
  margin-bottom: 52rpx;
  border: none;
  box-shadow: var(--neu-shadow-md, 6rpx 6rpx 12rpx #b8bec7, -6rpx -6rpx 12rpx #ffffff);
  animation: bannerSlideIn 0.5s ease-out;
}

/* ── 浅色模式：新拟物化底色 + 柔和渐变叠加 ── */
.banner-light {
  background-color: var(--em3d-bg, #e0e5ec);
  background-image: linear-gradient(
    135deg,
    rgba(240, 252, 232, 0.45) 0%,
    rgba(232, 247, 254, 0.45) 50%,
    rgba(254, 243, 232, 0.45) 100%
  );
}

/* ── 深色模式（新拟物化） ── */
.banner-dark {
  background: linear-gradient(160deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border: none;
}

.bubble-decoration {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.bubble-1 {
  right: -130rpx;
  top: -150rpx;
  width: 420rpx;
  height: 420rpx;
  background: var(--brand-tint-strong);
  filter: blur(70rpx);
}

.bubble-2 {
  bottom: -60rpx;
  left: -80rpx;
  width: 320rpx;
  height: 320rpx;
  background: var(--brand-tint);
  filter: blur(66rpx);
}

/* ── 内容布局 ── */
.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.banner-content > .banner-text {
  margin-bottom: 32rpx;
}

.banner-text {
  display: flex;
  flex-direction: column;
}

.banner-text > .welcome-title {
  margin-bottom: 8rpx;
}

.banner-text > .welcome-countdown {
  margin-bottom: 4rpx;
}

/* ── 标题 ── */
.welcome-title {
  font-size: 56rpx;
  font-weight: 800;
  letter-spacing: -0.4rpx;
  color: var(--text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-dark .welcome-title {
  color: var(--text-primary);
}

/* ── 副标题 / 倒计时 ── */
.welcome-subtitle {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.58;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.welcome-countdown {
  font-size: 26rpx;
  color: var(--text-sub);
  display: block;
  margin-bottom: 4rpx;
}

/* ── 高亮数字 ── */
.highlight-text {
  color: #58cc02;
  font-weight: 700;
}

/* ── 按钮组 ── */
.banner-actions {
  display: flex;
  flex-wrap: wrap;
}

.banner-actions > .action-btn {
  margin-right: 24rpx;
}

.banner-actions > .action-btn:last-child {
  margin-right: 0;
}

/* ── 按钮基础 ── */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 44rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 700;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
  min-height: 88rpx;
}

.action-btn .btn-text {
  margin-left: 16rpx;
}

/* ── 主按钮（新拟物化凸起风格） ── */
.btn-primary {
  background: #58cc02;
  color: var(--text-inverse);
  font-weight: 800;
  border: none;
  box-shadow: var(--neu-shadow-sm, 4rpx 4rpx 8rpx #b8bec7, -4rpx -4rpx 8rpx #ffffff);
}

/* 按下时从凸起变为凹陷 */
.btn-primary:active {
  transform: none;
  box-shadow: var(--neu-shadow-inset, inset 4rpx 4rpx 8rpx #b8bec7, inset -4rpx -4rpx 8rpx #ffffff);
}

.banner-dark .btn-primary {
  background: linear-gradient(135deg, #00e0ff, var(--purple-dark, #9b51e0));
  color: var(--text-inverse);
  box-shadow: var(--neu-shadow-sm, 4rpx 4rpx 8rpx rgba(0, 0, 0, 0.3), -4rpx -4rpx 8rpx rgba(255, 255, 255, 0.05));
}

/* 深色模式按下凹陷 */
.banner-dark .btn-primary:active {
  transform: none;
  box-shadow: var(
    --neu-shadow-inset,
    inset 4rpx 4rpx 8rpx rgba(0, 0, 0, 0.3),
    inset -4rpx -4rpx 8rpx rgba(255, 255, 255, 0.05)
  );
}

/* ── 次按钮（新拟物化凸起风格） ── */
.btn-outline {
  background: var(--em3d-bg, #e0e5ec);
  border: none;
  box-shadow: var(--neu-shadow-sm, 4rpx 4rpx 8rpx #b8bec7, -4rpx -4rpx 8rpx #ffffff);
  color: var(--text-primary);
  font-weight: 700;
}

/* 按下时从凸起变为凹陷 */
.btn-outline:active {
  transform: none;
  box-shadow: var(--neu-shadow-inset, inset 4rpx 4rpx 8rpx #b8bec7, inset -4rpx -4rpx 8rpx #ffffff);
}

.banner-dark .btn-outline {
  background: var(--muted);
  border: none;
  color: var(--text-primary);
  box-shadow: var(--neu-shadow-sm, 4rpx 4rpx 8rpx rgba(0, 0, 0, 0.3), -4rpx -4rpx 8rpx rgba(255, 255, 255, 0.05));
}

/* 深色模式按下凹陷 */
.banner-dark .btn-outline:active {
  transform: none;
  box-shadow: var(
    --neu-shadow-inset,
    inset 4rpx 4rpx 8rpx rgba(0, 0, 0, 0.3),
    inset -4rpx -4rpx 8rpx rgba(255, 255, 255, 0.05)
  );
}

/* ── 按钮文字 ── */
.btn-text {
  font-size: 28rpx;
}

.btn-label {
  font-weight: 800;
}

/* ── 小屏适配 ── */
@media screen and (max-width: 375px) {
  .welcome-banner {
    padding: 32rpx;
    margin-bottom: 36rpx;
    border-radius: 24rpx;
  }

  .welcome-title {
    font-size: 44rpx;
    letter-spacing: -0.2rpx;
  }

  .welcome-subtitle {
    font-size: 24rpx;
  }

  .banner-actions {
    flex-direction: column;
  }

  .banner-actions > .action-btn {
    margin-right: 0;
    margin-bottom: 14rpx;
  }

  .banner-actions > .action-btn:last-child {
    margin-bottom: 0;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
    padding: 18rpx 28rpx;
    min-height: 76rpx;
    font-size: 26rpx;
  }

  .btn-text {
    font-size: 26rpx;
  }
}
</style>
