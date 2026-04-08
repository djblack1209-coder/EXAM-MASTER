<template>
  <view v-if="visible" class="achievement-modal-overlay" @tap="$emit('close')">
    <view class="achievement-modal apple-glass-card" @tap.stop>
      <view class="achievement-modal-handle" />
      <view class="achievement-modal-header">
        <view>
          <text class="achievement-modal-eyebrow"> Achievement Board </text>
          <text class="achievement-modal-title"> 我的成就 </text>
        </view>
        <!-- 成就星光特效 -->
        <image class="achievement-sparkle" src="/static/effects/star-sparkle.png" mode="aspectFit" alt="" />
        <view class="achievement-modal-close apple-glass-pill" @tap="$emit('close')">
          <BaseIcon name="close" :size="24" />
        </view>
      </view>
      <view class="achievement-modal-body">
        <view class="achievement-section">
          <text class="achievement-section-title"> 已解锁 ({{ unlockedAchievements.length }}) </text>
          <view class="achievement-grid">
            <view v-for="ach in unlockedAchievements" :key="ach.id" class="achievement-item unlocked apple-group-card">
              <view class="achievement-item-icon">
                <image
                  :src="getBadgeImage(ach)"
                  class="achievement-badge-img"
                  mode="aspectFit"
                  :alt="ach.name + '徽章'"
                />
              </view>
              <text class="achievement-item-name">
                {{ ach.name }}
              </text>
              <text class="achievement-item-desc">
                {{ ach.description }}
              </text>
            </view>
          </view>
        </view>
        <view v-if="lockedList.length > 0" class="achievement-section">
          <text class="achievement-section-title"> 未解锁 ({{ lockedList.length }}) </text>
          <view class="achievement-grid">
            <view v-for="ach in lockedList" :key="ach.id" class="achievement-item locked apple-group-card">
              <view class="achievement-item-icon">
                <image
                  :src="getBadgeImage(ach)"
                  class="achievement-badge-img achievement-badge-locked"
                  mode="aspectFit"
                />
              </view>
              <text class="achievement-item-name">
                {{ ach.name }}
              </text>
              <text class="achievement-item-desc">
                {{ ach.description }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// 成就徽章图片映射
const BADGE_IMAGES = {
  'streak-7': '/static/badges/streak-7day.png',
  'streak-30': '/static/badges/streak-30day.png',
  accuracy: '/static/badges/accuracy-90.png',
  'first-100': '/static/badges/first-100.png',
  master: '/static/badges/master-500.png',
  'pk-victory': '/static/badges/pk-victory.png',
  scholar: '/static/badges/scholar.png',
  speed: '/static/badges/speed-demon.png',
  perfect: '/static/badges/perfect-score.png',
  explorer: '/static/badges/knowledge-explorer.png'
};

// 根据成就类型获取徽章图片路径
function getBadgeImage(achievement) {
  const key = achievement.id || achievement.type || '';
  for (const [prefix, path] of Object.entries(BADGE_IMAGES)) {
    if (key.includes(prefix)) return path;
  }
  // 默认返回通用徽章图标
  return '/static/badges/scholar.png';
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  unlockedAchievements: { type: Array, default: () => [] },
  allAchievements: { type: Array, default: () => [] }
});
defineEmits(['close']);

const lockedList = computed(() => {
  const unlockedIds = new Set(props.unlockedAchievements.map((a) => a.id));
  return props.allAchievements.filter((a) => !unlockedIds.has(a.id));
});
</script>

<style lang="scss" scoped>
.achievement-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 40rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
}
.achievement-modal {
  width: 100%;
  max-width: 720rpx;
  max-height: 80vh;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 36rpx 36rpx 28rpx 28rpx;
  padding: 18rpx 22rpx 24rpx;
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
  animation: fadeInUp 0.3s ease-out;
  overflow-y: auto;
}
.achievement-modal-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}
.achievement-modal-eyebrow {
  display: block;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}
.achievement-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 8rpx;
  position: relative;
}

/* 成就星光特效 */
.achievement-sparkle {
  width: 80rpx;
  height: 80rpx;
  position: absolute;
  top: -20rpx;
  right: 60rpx;
  animation: sparkle-rotate 3s linear infinite;
}
@keyframes sparkle-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.achievement-modal-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-main);
}
.achievement-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: var(--text-sub);
  cursor: pointer;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}
.achievement-modal-body {
  padding-bottom: 16px;
}
.achievement-section {
  margin-bottom: 24px;
}
.achievement-section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-sub);
  margin-bottom: 16px;
  display: block;
}
.achievement-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* gap: 14rpx; */
}
.achievement-grid > view {
  margin-right: 14rpx;
  margin-bottom: 14rpx;
}
.achievement-grid > view:nth-child(3n) {
  margin-right: 0;
}
.achievement-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 196rpx;
  padding: 20rpx 12rpx;
  border-radius: 24rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}
.achievement-item.unlocked {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--success) 16%, transparent) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border-color: color-mix(in srgb, var(--success) 18%, transparent);
}
.achievement-item.locked {
  opacity: 0.72;
}
.achievement-item-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-bottom: 10rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 18%, transparent);
}
.achievement-item-name {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
}
.achievement-item-desc {
  font-size: 20rpx;
  color: var(--text-sub);
  line-height: 1.3;
}
.achievement-badge-img {
  width: 56rpx;
  height: 56rpx;
}
.achievement-badge-locked {
  filter: grayscale(100%);
  opacity: 0.4;
}

:global(.dark-mode) .achievement-modal-overlay {
  background: rgba(3, 8, 14, 0.52);
}

:global(.dark-mode) .achievement-modal {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark-mode) .achievement-modal-handle {
  background: rgba(255, 255, 255, 0.16);
}

:global(.dark-mode) .achievement-modal-eyebrow,
:global(.dark-mode) .achievement-section-title,
:global(.dark-mode) .achievement-item-desc {
  color: rgba(255, 255, 255, 0.68);
}

:global(.dark-mode) .achievement-modal-title,
:global(.dark-mode) .achievement-item-name,
:global(.dark-mode) .achievement-modal-close {
  color: var(--foreground);
}

:global(.dark-mode) .achievement-modal-close,
:global(.dark-mode) .achievement-item {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark-mode) .achievement-item.unlocked {
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.16) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(10, 132, 255, 0.18);
}

:global(.dark-mode) .achievement-item-icon {
  background: rgba(10, 132, 255, 0.14);
  border-color: rgba(10, 132, 255, 0.18);
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
