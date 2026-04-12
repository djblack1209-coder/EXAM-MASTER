<template>
  <wd-popup :show="visible" position="center" custom-class="goal-modal apple-glass-card" @close="$emit('close')">
    <view class="goal-modal-inner">
      <view class="goal-modal-header">
        <text class="goal-modal-title"> 设置每日目标 </text>
        <view class="goal-modal-close apple-glass-pill" @tap="$emit('close')">
          <BaseIcon name="close" :size="24" />
        </view>
      </view>
      <view class="goal-modal-body">
        <view class="goal-input-group">
          <wd-button plain custom-class="goal-adjust-btn apple-glass-pill" @click="adjustValue(-5)">-</wd-button>
          <view class="goal-input-wrapper">
            <wd-input-number v-model="localValue" :min="5" :max="200" :step="5" />
            <text class="goal-unit"> 道/天 </text>
          </view>
          <wd-button plain custom-class="goal-adjust-btn apple-glass-pill" @click="adjustValue(5)">+</wd-button>
        </view>
        <view class="goal-presets">
          <view class="goal-preset apple-glass-pill" :class="{ active: localValue === 10 }" @tap="localValue = 10">
            10道
          </view>
          <view class="goal-preset apple-glass-pill" :class="{ active: localValue === 20 }" @tap="localValue = 20">
            20道
          </view>
          <view class="goal-preset apple-glass-pill" :class="{ active: localValue === 30 }" @tap="localValue = 30">
            30道
          </view>
          <view class="goal-preset apple-glass-pill" :class="{ active: localValue === 50 }" @tap="localValue = 50">
            50道
          </view>
        </view>
        <view class="goal-tips">
          <text class="goal-tip-text"> 建议：每天坚持刷20-30道题，效果最佳 </text>
        </view>
      </view>
      <view class="goal-modal-footer">
        <wd-button plain custom-class="goal-cancel-btn apple-glass-pill" @click="$emit('close')">取消</wd-button>
        <wd-button type="primary" custom-class="goal-save-btn apple-cta" @click="handleSave">保存</wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<script setup>
import { ref, watch } from 'vue';
import { toast } from '@/utils/toast.js';
import { getTodayGoals, GOAL_TYPES, learningGoalManager } from '@/utils/learning/learning-goal.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  currentGoal: { type: Number, default: 20 }
});
const emit = defineEmits(['close', 'saved']);

const localValue = ref(20);

watch(
  () => props.visible,
  (val) => {
    if (val) localValue.value = props.currentGoal;
  }
);

function adjustValue(delta) {
  localValue.value = Math.max(5, Math.min(200, Number(localValue.value) + delta));
}

function handleSave() {
  try {
    const minValue = GOAL_TYPES.DAILY_QUESTIONS.minValue;
    const maxValue = GOAL_TYPES.DAILY_QUESTIONS.maxValue;
    localValue.value = Math.max(minValue, Math.min(maxValue, localValue.value));

    const todayGoals = getTodayGoals();
    const existingGoal = todayGoals.find((g) => g.type === 'DAILY_QUESTIONS');

    if (existingGoal) {
      learningGoalManager.goals = learningGoalManager.goals.map((g) => {
        if (g.id === existingGoal.id) {
          return { ...g, targetValue: localValue.value, updatedAt: Date.now() };
        }
        return g;
      });
      learningGoalManager._saveGoals();
    } else {
      learningGoalManager.createGoal({
        type: 'DAILY_QUESTIONS',
        targetValue: localValue.value,
        period: 'daily'
      });
    }

    emit('saved', localValue.value);
    toast.success('目标已更新');
    logger.log('[GoalSettingModal] 学习目标已保存:', localValue.value);
  } catch (e) {
    logger.warn('[GoalSettingModal] 保存学习目标失败:', e);
    toast.info('保存失败');
  }
}
</script>

<style lang="scss" scoped>
.goal-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.goal-modal {
  width: 100%;
  max-width: 400px;
  background-color: var(--em3d-card-bg);
  border-radius: 28px;
  padding: 32px;
  border: 2rpx solid var(--em3d-border);
  box-shadow:
    0 8rpx 0 var(--em3d-border-shadow),
    0 16rpx 40rpx rgba(0, 0, 0, 0.15);
  animation: fadeInUp 0.3s ease-out;
}
.goal-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.goal-modal-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.goal-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: var(--text-sub);
  cursor: pointer;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.64);
}
.goal-modal-body {
  margin-bottom: 28px;
}
.goal-input-group {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 16px; -- replaced for Android WebView compat */
  margin-bottom: 24px;
}
.goal-adjust-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  font-size: 56rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.goal-adjust-btn:active {
  background: rgba(255, 255, 255, 0.9);
  transform: scale(0.95);
}
.goal-input-wrapper {
  display: flex;
  align-items: baseline;
  /* gap: 8px; -- replaced for Android WebView compat */
}
.goal-input {
  width: 80px;
  font-size: 96rpx;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
  background: transparent;
  border: none;
  border-bottom: 3px solid var(--primary);
  padding: 0;
}
.goal-unit {
  font-size: 32rpx;
  color: var(--text-sub);
}
.goal-presets {
  display: flex;
  justify-content: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  margin-bottom: 20px;
}
.goal-preset {
  padding: 10px 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  border: 2rpx solid rgba(255, 255, 255, 0.48);
  font-size: 28rpx;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s ease;
}
.goal-preset.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
  color: var(--cta-primary-text);
  box-shadow: var(--cta-primary-shadow);
}
.goal-preset:active {
  transform: scale(0.95);
}
.goal-tips {
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.54);
  border-radius: 20px;
  border: 2rpx solid rgba(255, 255, 255, 0.44);
}
.goal-tip-text {
  font-size: 26rpx;
  color: var(--text-sub);
}
.goal-modal-footer {
  display: flex;
  /* gap: 16px; -- replaced for Android WebView compat */
}
.goal-cancel-btn {
  flex: 1;
  height: 52px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--text-primary);
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 999px;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}
.goal-save-btn {
  flex: 1;
  height: 52px;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 999px;
  border: 2rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}
.goal-cancel-btn::after,
.goal-save-btn::after {
  border: none;
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
