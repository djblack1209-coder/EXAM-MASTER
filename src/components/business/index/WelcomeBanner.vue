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

/* ── 卡片容器 ── */
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: 32rpx;
  padding: 44rpx;
  margin-bottom: 52rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  animation: bannerSlideIn 0.5s ease-out;
}

/* ── 浅色模式：柔和多彩渐变 ── */
.banner-light {
  background: linear-gradient(135deg, #f0fce8 0%, #e8f7fe 50%, #fef3e8 100%);
}

/* ── 深色模式 ── */
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

/* ── 主按钮（3D 多邻国风格） ── */
.btn-primary {
  background: #58cc02;
  color: var(--text-inverse);
  font-weight: 800;
  border: none;
  box-shadow: 0 8rpx 0 #46a302;
}

.btn-primary:active {
  transform: translateY(6rpx);
  box-shadow: 0 2rpx 0 #46a302;
}

.banner-dark .btn-primary {
  background: linear-gradient(135deg, #00e0ff, var(--purple-dark, #9b51e0));
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 rgba(0, 0, 0, 0.3);
}

.banner-dark .btn-primary:active {
  transform: translateY(6rpx);
  box-shadow: 0 2rpx 0 rgba(0, 0, 0, 0.3);
}

/* ── 次按钮（3D 轮廓风格） ── */
.btn-outline {
  background: var(--bg-card);
  border: 3rpx solid #e5e5ea;
  box-shadow: 0 6rpx 0 #e5e5ea;
  color: var(--text-primary);
  font-weight: 700;
}

.btn-outline:active {
  transform: translateY(4rpx);
  box-shadow: 0 2rpx 0 #e5e5ea;
}

.banner-dark .btn-outline {
  background: var(--muted);
  border-color: var(--border);
  color: var(--text-primary);
  box-shadow: 0 6rpx 0 var(--border);
}

.banner-dark .btn-outline:active {
  transform: translateY(4rpx);
  box-shadow: 0 2rpx 0 var(--border);
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
