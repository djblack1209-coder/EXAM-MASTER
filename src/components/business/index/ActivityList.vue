<template>
  <view>
    <view class="section-header section-header-apple">
      <text class="section-title"> 学习轨迹 </text>
      <text id="e2e-home-activity-view-all" class="section-action apple-glass-pill" @tap="$emit('view-all')">
        查看全部
      </text>
    </view>
    <view class="activity-list">
      <!-- ✅ F008: 使用稳定的唯一 key 替代 index，避免列表变化时不必要的 DOM 重建 -->
      <view
        v-for="activity in activities"
        :key="activity.id || activity.title + activity.time"
        :class="['activity-item', 'apple-group-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      >
        <view :class="['activity-icon-wrapper', 'status-' + activity.status]">
          <view class="activity-icon">
            <BaseIcon :name="activity.icon" :size="34" />
          </view>
        </view>
        <view class="activity-content">
          <text class="activity-title">
            {{ activity.title }}
          </text>
          <text class="activity-subtitle">
            {{ activity.subtitle }}
          </text>
        </view>
        <view class="activity-meta">
          <text class="activity-time">
            {{ activity.time }}
          </text>
          <view :class="['activity-badge', 'badge-' + activity.status]">
            <text class="badge-text">
              {{ getStatusText(activity.status) }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  isDark: { type: Boolean, default: false },
  activities: { type: Array, default: () => [] }
});
defineEmits(['view-all']);

function getStatusText(status) {
  const map = {
    completed: '已完成',
    'in-progress': '进行中',
    pending: '待开始'
  };
  return map[status] || status;
}
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-header-apple {
  margin-bottom: 26rpx;
}

.section-title {
  font-size: 24rpx;
  font-weight: 620;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.section-action {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 600;
  min-height: 72rpx;
  padding: 0 24rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.glass {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(14rpx) saturate(130%);
  -webkit-backdrop-filter: blur(14rpx) saturate(130%);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.card-light {
  background: linear-gradient(160deg, #ffffff 0%, #f4faf6 100%);
}

.card-hover:active {
  transform: translateY(-2rpx);
  box-shadow: var(--shadow-md);
}

.activity-list {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 48rpx;
}

.activity-item + .activity-item {
  margin-top: 16rpx;
}

.activity-item {
  position: relative;
  display: flex;
  align-items: center;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  padding: 28rpx;
  min-height: 116rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--apple-shadow-card);
  overflow: hidden;
}

.activity-item::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.activity-icon-wrapper {
  width: 74rpx;
  height: 74rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.7);
}

.status-completed {
  background: rgba(52, 199, 89, 0.15);
  color: #30b35f;
}

.status-in-progress {
  background: var(--brand-tint);
  color: var(--primary);
}

.status-pending {
  background: rgba(120, 120, 128, 0.12);
  color: #7c7c82;
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  min-width: 0;
}

.activity-content .activity-subtitle {
  margin-top: 8rpx;
}

.activity-title {
  font-size: 28rpx;
  font-weight: 620;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-subtitle {
  font-size: 23rpx;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  flex-shrink: 0;
}

.activity-meta .activity-badge {
  margin-top: 8rpx;
}

.activity-time {
  font-size: 20rpx;
  color: var(--text-sub);
}

.activity-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.4);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.64);
}

.badge-completed {
  background: var(--success-light);
  color: var(--success);
}

.badge-in-progress {
  background: var(--primary-light);
  color: var(--primary);
}

.badge-pending {
  background: var(--bg-secondary);
  color: var(--text-sub);
}

.badge-text {
  font-size: 20rpx;
  font-weight: 500;
}

.glass .activity-icon-wrapper {
  border-color: rgba(10, 132, 255, 0.18);
  box-shadow: var(--apple-shadow-surface);
}

.glass .status-completed {
  background: rgba(64, 200, 160, 0.16);
}

.glass .status-in-progress {
  background: rgba(10, 132, 255, 0.16);
}

.glass .status-pending {
  background: rgba(58, 108, 190, 0.16);
}
</style>
