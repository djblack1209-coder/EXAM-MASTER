<template>
  <view>
    <view class="section-header">
      <text class="section-title"> 学习轨迹 </text>
      <text class="section-action" @tap="$emit('view-all')"> 查看全部 </text>
    </view>
    <view class="activity-list">
      <!-- ✅ F008: 使用稳定的唯一 key 替代 index，避免列表变化时不必要的 DOM 重建 -->
      <view
        v-for="activity in activities"
        :key="activity.id || activity.title + activity.time"
        :class="['activity-item', isDark ? 'glass' : 'card-light', 'card-hover']"
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

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'ActivityList',
  components: {
    BaseIcon
  },
  props: {
    isDark: { type: Boolean, default: false },
    activities: { type: Array, default: () => [] }
  },
  emits: ['view-all'],
  methods: {
    getStatusText(status) {
      const map = {
        completed: '已完成',
        'in-progress': '进行中',
        pending: '待开始'
      };
      return map[status] || status;
    }
  }
};
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.section-action {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid var(--border);
}

.card-light {
  background: var(--card);
}

.card-hover:active {
  transform: translateY(-4rpx);
  box-shadow: var(--shadow-lg);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 64rpx;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 32rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.activity-icon-wrapper {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-completed {
  background: var(--success-light);
  color: var(--success);
}

.status-in-progress {
  background: var(--primary-light);
  color: var(--primary);
}

.status-pending {
  background: var(--bg-secondary);
  color: var(--text-sub);
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
  gap: 8rpx;
  min-width: 0;
}

.activity-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-subtitle {
  font-size: 24rpx;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.activity-time {
  font-size: 20rpx;
  color: var(--text-sub);
}

.activity-badge {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
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
</style>
