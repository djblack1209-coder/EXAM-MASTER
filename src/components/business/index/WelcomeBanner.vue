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

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
export default {
  name: 'WelcomeBanner',
  components: { BaseIcon },
  props: {
    isDark: { type: Boolean, default: false },
    userName: { type: String, default: '小伙伴' },
    finishedCount: { type: Number, default: 0 }
  },
  emits: ['nav-to-practice', 'nav-to-mock-exam'],
  computed: {
    greeting() {
      const h = new Date().getHours();
      if (h < 6) return '夜深了';
      if (h < 9) return '早上好';
      if (h < 12) return '上午好';
      if (h < 14) return '中午好';
      if (h < 18) return '下午好';
      return '晚上好';
    },
    examCountdown() {
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
    }
  }
};
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
  background: linear-gradient(
    145deg,
    rgba(252, 255, 249, 0.72) 0%,
    rgba(255, 255, 255, 0.96) 46%,
    rgba(233, 247, 218, 0.88) 100%
  );
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
  background: radial-gradient(circle, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 72%);
  filter: blur(12rpx);
}

.banner-light::after {
  left: -80rpx;
  bottom: -110rpx;
  width: 360rpx;
  height: 360rpx;
  background: radial-gradient(circle, rgba(15, 95, 52, 0.18) 0%, rgba(15, 95, 52, 0) 74%);
  filter: blur(20rpx);
}

.banner-dark {
  background: linear-gradient(160deg, rgba(18, 22, 30, 0.92) 0%, rgba(12, 14, 20, 0.98) 100%);
  border-color: rgba(124, 176, 255, 0.18);
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

.banner-text {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- tag-name sibling selectors removed (WeChat WXSS restriction) */
}

.welcome-title {
  font-size: 52rpx;
  font-weight: 680;
  letter-spacing: -0.4rpx;
  color: var(--text-primary);
  line-height: 1.2;
}

.welcome-subtitle {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.58;
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
  background: rgba(255, 255, 255, 0.8);
  border: 1rpx solid var(--apple-glass-border-strong);
  color: var(--text-primary);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(10rpx);
}

.banner-light .btn-outline {
  background: rgba(255, 255, 255, 0.62);
  border-color: rgba(16, 40, 26, 0.08);
  box-shadow: 0 12rpx 26rpx rgba(16, 40, 26, 0.1);
}

.banner-dark .btn-outline {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
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
