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
          <text class="btn-text"> 快速练习 </text>
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
    return 0;
  }
});
</script>

<style lang="scss" scoped>
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: 36rpx;
  padding: 44rpx;
  margin-bottom: 52rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
}

.banner-light {
  background: linear-gradient(145deg, var(--bg-card) 0%, var(--bg-card) 46%, var(--bg-secondary) 100%);
  border-color: var(--apple-glass-border-strong);
}

.banner-light::before,
.banner-light::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.banner-light::before {
  top: -120rpx;
  right: -90rpx;
  width: 320rpx;
  height: 320rpx;
  background: radial-gradient(circle, var(--bg-card) 0%, transparent 72%);
  filter: blur(12rpx);
}

.banner-light::after {
  left: -80rpx;
  bottom: -110rpx;
  width: 360rpx;
  height: 360rpx;
  background: radial-gradient(circle, var(--primary-light) 0%, transparent 74%);
  filter: blur(20rpx);
}

.banner-dark {
  background: linear-gradient(160deg, var(--bg-card) 0%, var(--bg-page) 100%);
  border-color: var(--apple-glass-border-strong);
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

.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  /* gap: 32rpx; -- tag-name sibling selectors removed (WeChat WXSS restriction) */
}

.banner-content > .banner-text {
  margin-bottom: 32rpx;
}

.banner-text {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- tag-name sibling selectors removed (WeChat WXSS restriction) */
}

.banner-text > .welcome-title {
  margin-bottom: 8rpx;
}

.banner-text > .welcome-countdown {
  margin-bottom: 4rpx;
}

.welcome-title {
  font-size: 52rpx;
  font-weight: 680;
  letter-spacing: -0.4rpx;
  color: var(--text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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

.banner-light .welcome-subtitle {
  color: var(--text-sub);
}

.highlight-text {
  color: var(--primary);
  font-weight: 620;
}

.banner-actions {
  display: flex;
  gap: var(--ds-spacing-md, 24rpx);
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ds-spacing-sm, 16rpx);
  padding: 22rpx 44rpx;
  border-radius: 999rpx;
  font-size: var(--ds-font-size-base, 28rpx);
  font-weight: 620;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 88rpx;
}

.btn-primary {
  border: 1rpx solid transparent;
  box-shadow: var(--cta-primary-shadow);
}

.banner-light .btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
}

.banner-dark .btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
}

.btn-outline {
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  color: var(--text-primary);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(10rpx);
}

.banner-light .btn-outline {
  background: var(--bg-secondary);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.banner-dark .btn-outline {
  background: var(--muted);
  border-color: var(--border);
  color: var(--text-primary);
}

.action-btn:active {
  transform: scale(0.97);
}

.btn-icon {
  font-size: 32rpx;
}

.btn-text {
  font-size: 28rpx;
}

@media screen and (max-width: 375px) {
  .welcome-banner {
    padding: 32rpx;
    margin-bottom: 36rpx;
    border-radius: 28rpx;
  }

  .welcome-title {
    font-size: 40rpx;
    letter-spacing: -0.2rpx;
  }

  .welcome-subtitle {
    font-size: 24rpx;
  }

  .banner-actions {
    flex-direction: column;
    gap: 14rpx;
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
