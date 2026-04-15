<template>
  <view>
    <view class="section-header">
      <view class="section-title-group">
        <view class="section-icon-dot" />
        <text class="section-title"> 学习轨迹 </text>
      </view>
      <text id="e2e-home-activity-view-all" class="section-action" @tap="$emit('view-all')"> 查看全部 </text>
    </view>
    <view class="activity-list">
      <!-- ✅ F008: 使用稳定的唯一 key 替代 index，避免列表变化时不必要的 DOM 重建 -->
      <view
        v-for="(activity, index) in activities"
        :key="activity.id || activity.title + activity.time"
        :class="['activity-item', isDark ? 'glass' : 'card-light', 'card-hover']"
        :style="{ animationDelay: index * 80 + 'ms' }"
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
/* ============================
   Duolingo Design System 2.0
   模块色: var(--info) (蓝 - 活动/学习)
   ============================ */

/* ---------- 入场动画 ---------- */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---------- 区块标题 ---------- */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28rpx;
}

.section-title-group {
  display: flex;
  align-items: center;
}

.section-icon-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 6rpx;
  background: var(--info);
  margin-right: 12rpx;
  flex-shrink: 0;
}

.section-title {
  font-size: 26rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.section-action {
  font-size: 24rpx;
  color: var(--info);
  font-weight: 700;
  min-height: 64rpx;
  padding: 0 20rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  background: color-mix(in srgb, var(--info) 8%, transparent);
  transition: background 0.2s ease;
}

.section-action:active {
  background: color-mix(in srgb, var(--info) 16%, transparent);
}

/* ---------- 列表容器 ---------- */
.activity-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 48rpx;
}

/* ---------- 卡片基础（新拟物化） ---------- */
.activity-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 28rpx;
  min-height: 116rpx;
  border-radius: 24rpx;
  border: none; /* 新拟物化不需要边框，靠阴影区分层次 */
  box-shadow: var(--neu-shadow-md); /* 新拟物化凸起阴影 */
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  /* 入场动画 */
  animation: fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.activity-item + .activity-item {
  margin-top: 16rpx;
}

/* ---------- 亮色卡片（新拟物化同色背景） ---------- */
.card-light {
  background: var(--em3d-bg);
}

/* ---------- 暗色玻璃卡片（新拟物化） ---------- */
.glass {
  background: var(--em3d-bg); /* 新拟物化同色背景 */
  border: none; /* 新拟物化不需要边框 */
  box-shadow: var(--neu-shadow-md); /* 新拟物化凸起阴影 */
}

/* ---------- 按压反馈（新拟物化凹陷效果） ---------- */
.card-hover:active {
  transform: scale(0.98);
  box-shadow: var(--neu-shadow-inset); /* 按下时从凸起变凹陷 */
}

/* ---------- 图标容器 ---------- */
.activity-icon-wrapper {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;
  transition: background 0.2s ease;
}

/* 已完成 = 练习 = 绿色调 #58CC02 */
.status-completed {
  background: color-mix(in srgb, #58cc02 14%, transparent);
  color: #58cc02;
}

/* 进行中 = 复习 = 蓝色调 var(--info) */
.status-in-progress {
  background: color-mix(in srgb, var(--info) 14%, transparent);
  color: var(--info);
}

/* 待开始 = 考试 = 橙色调 var(--warning) */
.status-pending {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: var(--warning);
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------- 内容区 ---------- */
.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.activity-content .activity-subtitle {
  margin-top: 6rpx;
}

.activity-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.activity-subtitle {
  font-size: 23rpx;
  font-weight: 500;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

/* ---------- 右侧信息 ---------- */
.activity-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.activity-meta .activity-badge {
  margin-top: 8rpx;
}

.activity-time {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--text-sub);
}

/* ---------- 状态徽章 ---------- */
.activity-badge {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.badge-completed {
  background: color-mix(in srgb, #58cc02 14%, transparent);
  color: #58cc02;
}

.badge-in-progress {
  background: color-mix(in srgb, var(--info) 14%, transparent);
  color: var(--info);
}

.badge-pending {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: var(--warning);
}

.badge-text {
  font-size: 20rpx;
  font-weight: 700;
}

/* ---------- 暗色模式覆盖 ---------- */
.glass .activity-icon-wrapper {
  border: none;
  box-shadow: none;
}

.glass .status-completed {
  background: color-mix(in srgb, #58cc02 18%, transparent);
}

.glass .status-in-progress {
  background: color-mix(in srgb, var(--info) 18%, transparent);
}

.glass .status-pending {
  background: color-mix(in srgb, var(--warning) 18%, transparent);
}

.glass .badge-completed {
  background: color-mix(in srgb, #58cc02 18%, transparent);
}

.glass .badge-in-progress {
  background: color-mix(in srgb, var(--info) 18%, transparent);
}

.glass .badge-pending {
  background: color-mix(in srgb, var(--warning) 18%, transparent);
}

.glass .section-icon-dot {
  box-shadow: 0 0 8rpx color-mix(in srgb, var(--info) 60%, transparent);
}
</style>
