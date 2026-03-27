<template>
  <view class="learning-stats-card apple-glass-card">
    <view class="stats-row">
      <view class="stat-item" @tap="$emit('open-goal-setting')">
        <view class="stat-value">
          {{ todayQuestions }}
        </view>
        <view class="stat-label"> 今日刷题 </view>
        <view v-if="todayQuestions < todayGoal" class="stat-goal editable">
          目标 {{ todayGoal }} <BaseIcon name="edit" :size="14" class="edit-icon" />
        </view>
        <view v-else class="stat-goal achieved"> 已达标 </view>
      </view>
      <view class="stat-divider" />
      <view class="stat-item">
        <view class="stat-value streak">
          {{ currentStreak }}
        </view>
        <view class="stat-label"> 连续学习 </view>
        <view class="stat-unit"> 天 </view>
      </view>
      <view class="stat-divider" />
      <view class="stat-item">
        <view class="stat-value" :class="{ good: weeklyAccuracy >= 60, excellent: weeklyAccuracy >= 80 }">
          {{ weeklyAccuracy }}%
        </view>
        <view class="stat-label"> 正确率 </view>
      </view>
      <view v-if="weakPointsCount > 0" class="stat-divider" />
      <view v-if="weakPointsCount > 0" class="stat-item weak" @tap="$emit('go-mistake')">
        <view class="stat-value warning">
          {{ weakPointsCount }}
        </view>
        <view class="stat-label"> 薄弱点 </view>
        <view class="stat-action"> 去强化 › </view>
      </view>
    </view>
    <!-- 成就展示入口 -->
    <view v-if="unlockedAchievements.length > 0" class="achievement-preview" @tap="$emit('show-achievement')">
      <view class="achievement-icons">
        <text v-for="(ach, idx) in unlockedAchievements.slice(0, 4)" :key="idx" class="achievement-icon">
          {{ ach.icon }}
        </text>
      </view>
      <text class="achievement-text"> 已解锁 {{ unlockedAchievements.length }} 个成就 </text>
      <text class="achievement-arrow"> › </text>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  todayQuestions: { type: Number, default: 0 },
  todayGoal: { type: Number, default: 20 },
  currentStreak: { type: Number, default: 0 },
  weeklyAccuracy: { type: Number, default: 0 },
  weakPointsCount: { type: Number, default: 0 },
  unlockedAchievements: { type: Array, default: () => [] }
});
defineEmits(['open-goal-setting', 'go-mistake', 'show-achievement']);
</script>

<style lang="scss" scoped>
.learning-stats-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--apple-shadow-floating);
}

.learning-stats-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 12px;
  min-width: 60px;
}
.stat-item.weak {
  cursor: pointer;
}
.stat-item.weak:active {
  opacity: 0.7;
}
.stat-divider {
  width: 1px;
  height: 40px;
  background-color: var(--border);
}
.stat-value {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}
.stat-value.streak {
  color: var(--primary);
}
.stat-value.good {
  color: var(--success);
}
.stat-value.excellent {
  color: var(--info);
}
.stat-value.warning {
  color: var(--danger);
}
.stat-label {
  font-size: 24rpx;
  color: var(--text-sub);
  margin-top: 4px;
}
.stat-goal {
  font-size: 20rpx;
  color: var(--text-sub);
  margin-top: 2px;
  opacity: 0.8;
}
.stat-goal.achieved {
  color: var(--primary);
  font-weight: 500;
}
.stat-unit {
  font-size: 20rpx;
  color: var(--text-sub);
  margin-top: 2px;
}
.stat-action {
  font-size: 20rpx;
  color: var(--primary);
  margin-top: 4px;
  font-weight: 500;
}
.stat-goal.editable {
  cursor: pointer;
  display: flex;
  align-items: center;
  /* gap: 4px; -- replaced for Android WebView compat */
}
.stat-goal.editable:active {
  opacity: 0.7;
}
.edit-icon {
  font-size: 20rpx;
  opacity: 0.6;
}
.achievement-preview {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-top: 16px;
  background: linear-gradient(160deg, var(--apple-glass-pill-bg) 0%, rgba(255, 255, 255, 0.56) 100%);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.48);
  cursor: pointer;
  transition: all 0.2s ease;
}
.achievement-preview:active {
  opacity: 0.8;
  transform: scale(0.98);
}
.achievement-icons {
  display: flex;
  /* gap: 4px; -- replaced for Android WebView compat */
}
.achievement-icon {
  font-size: 40rpx;
}
.achievement-text {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-sub);
  margin-left: 12px;
}
.achievement-arrow {
  font-size: 36rpx;
  color: var(--text-sub);
  font-weight: 600;
}
</style>
