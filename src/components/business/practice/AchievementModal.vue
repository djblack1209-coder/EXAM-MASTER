<template>
  <view v-if="visible" class="achievement-modal-overlay" @tap="$emit('close')">
    <view class="achievement-modal" @tap.stop>
      <view class="achievement-modal-header">
        <text class="achievement-modal-title"> 我的成就 </text>
        <view class="achievement-modal-close" @tap="$emit('close')">
          <BaseIcon name="close" :size="24" />
        </view>
      </view>
      <view class="achievement-modal-body">
        <view class="achievement-section">
          <text class="achievement-section-title"> 已解锁 ({{ unlockedAchievements.length }}) </text>
          <view class="achievement-grid">
            <view v-for="ach in unlockedAchievements" :key="ach.id" class="achievement-item unlocked">
              <view class="achievement-item-icon">
                <BaseIcon name="trophy" :size="20" />
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
            <view v-for="ach in lockedList" :key="ach.id" class="achievement-item locked">
              <view class="achievement-item-icon">
                <BaseIcon name="lock" :size="28" />
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

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'AchievementModal',
  components: { BaseIcon },
  props: {
    visible: { type: Boolean, default: false },
    unlockedAchievements: { type: Array, default: () => [] },
    allAchievements: { type: Array, default: () => [] }
  },
  emits: ['close'],
  computed: {
    lockedList() {
      const unlockedIds = new Set(this.unlockedAchievements.map((a) => a.id));
      return this.allAchievements.filter((a) => !unlockedIds.has(a.id));
    }
  }
};
</script>

<style lang="scss" scoped>
.achievement-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.achievement-modal {
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  background: var(--bg-card);
  border-radius: 24px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  animation: fadeInUp 0.3s ease-out;
  overflow-y: auto;
}
.achievement-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.achievement-modal-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary);
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
  background: var(--bg-secondary);
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
  gap: 16px;
}
.achievement-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  border-radius: 16px;
  background: var(--bg-secondary);
  text-align: center;
}
.achievement-item.unlocked {
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(52, 152, 219, 0.1));
}
.achievement-item.locked {
  opacity: 0.5;
}
.achievement-item-icon {
  font-size: 40rpx;
  margin-bottom: 8px;
}
.achievement-item-name {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.achievement-item-desc {
  font-size: 20rpx;
  color: var(--text-sub);
  line-height: 1.3;
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
