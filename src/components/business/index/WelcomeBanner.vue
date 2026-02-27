<template>
  <view :class="['welcome-banner', isDark ? 'banner-dark' : 'banner-light']">
    <!-- 深色模式装饰气泡 -->
    <view v-if="isDark" class="bubble-decoration bubble-1" />
    <view v-if="isDark" class="bubble-decoration bubble-2" />

    <view class="banner-content">
      <view class="banner-text">
        <text class="welcome-title">
          欢迎回来，{{ userName }}！
        </text>
        <text class="welcome-subtitle">
          你有 <text class="highlight-text">
            {{ finishedCount }} 道题目
          </text> 待复习。继续保持学习势头！
        </text>
      </view>
      <view class="banner-actions">
        <view :class="['action-btn', 'btn-primary', isDark && 'animate-pulse-glow']" @tap="$emit('nav-to-practice')">
          <BaseIcon name="lightning" :size="28" />
          <text class="btn-text">
            快速练习
          </text>
        </view>
        <view class="action-btn btn-outline" @tap="$emit('nav-to-mock-exam')">
          <BaseIcon name="clock" :size="28" />
          <text class="btn-text">
            模拟考试
          </text>
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
  emits: ['nav-to-practice', 'nav-to-mock-exam']
};
</script>

<style lang="scss" scoped>
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: 48rpx;
  padding: 48rpx;
  margin-bottom: 64rpx;
  border: 1rpx solid var(--border);
}

.banner-light {
  background: var(--bg-secondary);
}

.banner-dark {
  background: var(--bg-card);
  border-color: var(--border);
}

.bubble-decoration {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.bubble-1 {
  right: -160rpx;
  top: -160rpx;
  width: 512rpx;
  height: 512rpx;
  background: var(--primary-light);
  filter: blur(60px);
}

.bubble-2 {
  bottom: -80rpx;
  left: -80rpx;
  width: 384rpx;
  height: 384rpx;
  background: var(--primary-light);
  filter: blur(60px);
}

.banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.welcome-title {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.welcome-subtitle {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.banner-light .welcome-subtitle {
  color: var(--text-sub);
}

.highlight-text {
  color: var(--primary);
  font-weight: 600;
}

.banner-light .highlight-text {
  color: #047857;
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
  padding: var(--ds-spacing-md, 24rpx) var(--ds-spacing-xl, 48rpx);
  border-radius: var(--ds-radius-lg, 24rpx);
  font-size: var(--ds-font-size-base, 28rpx);
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 88rpx;
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-outline {
  background: rgba(255, 255, 255, 0.6);
  border: 2rpx solid var(--border);
  color: var(--text-primary);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.banner-dark .btn-outline {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.action-btn:active {
  transform: scale(0.95);
}

.btn-icon {
  font-size: 32rpx;
}

.btn-text {
  font-size: 28rpx;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 40rpx var(--primary-light),
      0 0 80rpx var(--primary-light);
  }
  50% {
    box-shadow:
      0 0 60rpx var(--primary-light),
      0 0 120rpx var(--primary-light);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}
</style>
