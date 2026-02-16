<template>
  <view v-if="visible" class="goal-modal-overlay" @tap="$emit('close')">
    <view class="goal-modal" @tap.stop>
      <view class="goal-modal-header">
        <text class="goal-modal-title">
          设置每日目标
        </text>
        <view class="goal-modal-close" @tap="$emit('close')">
          ✕
        </view>
      </view>
      <view class="goal-modal-body">
        <view class="goal-input-group">
          <button class="goal-adjust-btn" @tap="adjustValue(-5)">
            -
          </button>
          <view class="goal-input-wrapper">
            <input
              v-model="localValue"
              type="number"
              class="goal-input"
              :min="5"
              :max="200"
            />
            <text class="goal-unit">
              道/天
            </text>
          </view>
          <button class="goal-adjust-btn" @tap="adjustValue(5)">
            +
          </button>
        </view>
        <view class="goal-presets">
          <view class="goal-preset" :class="{ active: localValue === 10 }" @tap="localValue = 10">
            10道
          </view>
          <view class="goal-preset" :class="{ active: localValue === 20 }" @tap="localValue = 20">
            20道
          </view>
          <view class="goal-preset" :class="{ active: localValue === 30 }" @tap="localValue = 30">
            30道
          </view>
          <view class="goal-preset" :class="{ active: localValue === 50 }" @tap="localValue = 50">
            50道
          </view>
        </view>
        <view class="goal-tips">
          <text class="goal-tip-text">
            建议：每天坚持刷20-30道题，效果最佳
          </text>
        </view>
      </view>
      <view class="goal-modal-footer">
        <button class="goal-cancel-btn" @tap="$emit('close')">
          取消
        </button>
        <button class="goal-save-btn" @tap="handleSave">
          保存
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { getTodayGoals, GOAL_TYPES, learningGoalManager } from '@/utils/learning/learning-goal.js';
import { logger } from '@/utils/logger.js';

export default {
  name: 'GoalSettingModal',
  props: {
    visible: { type: Boolean, default: false },
    currentGoal: { type: Number, default: 20 }
  },
  emits: ['close', 'saved'],
  data() {
    return { localValue: 20 };
  },
  watch: {
    visible(val) {
      if (val) this.localValue = this.currentGoal;
    }
  },
  methods: {
    adjustValue(delta) {
      this.localValue = Math.max(5, Math.min(200, Number(this.localValue) + delta));
    },
    handleSave() {
      try {
        const minValue = GOAL_TYPES.DAILY_QUESTIONS.minValue;
        const maxValue = GOAL_TYPES.DAILY_QUESTIONS.maxValue;
        this.localValue = Math.max(minValue, Math.min(maxValue, this.localValue));

        const todayGoals = getTodayGoals();
        const existingGoal = todayGoals.find((g) => g.type === 'DAILY_QUESTIONS');

        if (existingGoal) {
          learningGoalManager.goals = learningGoalManager.goals.map((g) => {
            if (g.id === existingGoal.id) {
              return { ...g, targetValue: this.localValue, updatedAt: Date.now() };
            }
            return g;
          });
          learningGoalManager._saveGoals();
        } else {
          learningGoalManager.createGoal({
            type: 'DAILY_QUESTIONS',
            targetValue: this.localValue,
            period: 'daily'
          });
        }

        this.$emit('saved', this.localValue);
        uni.showToast({ title: '目标已更新', icon: 'success' });
        logger.log('[GoalSettingModal] 学习目标已保存:', this.localValue);
      } catch (e) {
        logger.warn('[GoalSettingModal] 保存学习目标失败:', e);
        uni.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.goal-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: var(--overlay); backdrop-filter: blur(10px);
  z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 40px;
}
.goal-modal {
  width: 100%; max-width: 400px; background: var(--bg-card);
  border-radius: 24px; padding: 32px; box-shadow: var(--shadow-xl);
  animation: fadeInUp 0.3s ease-out;
}
.goal-modal-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px;
}
.goal-modal-title { font-size: 44rpx; font-weight: 700; color: var(--text-primary); }
.goal-modal-close {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  font-size: 48rpx; color: var(--text-sub); cursor: pointer; border-radius: 50%; background: var(--bg-secondary);
}
.goal-modal-body { margin-bottom: 28px; }
.goal-input-group {
  display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 24px;
}
.goal-adjust-btn {
  width: 48px; height: 48px; border-radius: 50%; background: var(--bg-secondary);
  border: 1px solid var(--border); font-size: 56rpx; font-weight: 600; color: var(--text-primary);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;
}
.goal-adjust-btn:active { background: var(--primary-light); transform: scale(0.95); }
.goal-input-wrapper { display: flex; align-items: baseline; gap: 8px; }
.goal-input {
  width: 80px; font-size: 96rpx; font-weight: 700; color: var(--primary);
  text-align: center; background: transparent; border: none; border-bottom: 3px solid var(--primary); padding: 0;
}
.goal-unit { font-size: 32rpx; color: var(--text-sub); }
.goal-presets { display: flex; justify-content: center; gap: 12px; margin-bottom: 20px; }
.goal-preset {
  padding: 10px 20px; border-radius: 20px; background: var(--bg-secondary);
  border: 1px solid var(--border); font-size: 28rpx; color: var(--text-sub);
  cursor: pointer; transition: all 0.2s ease;
}
.goal-preset.active { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
.goal-preset:active { transform: scale(0.95); }
.goal-tips { text-align: center; padding: 12px; background: var(--bg-secondary); border-radius: 12px; }
.goal-tip-text { font-size: 26rpx; color: var(--text-sub); }
.goal-modal-footer { display: flex; gap: 16px; }
.goal-cancel-btn {
  flex: 1; height: 52px; background: var(--bg-secondary); color: var(--text-sub);
  font-size: 32rpx; font-weight: 500; border-radius: 16px; border: none;
}
.goal-save-btn {
  flex: 1; height: 52px; background: var(--primary); color: var(--primary-foreground);
  font-size: 32rpx; font-weight: 600; border-radius: 16px; border: none;
}
.goal-cancel-btn::after, .goal-save-btn::after { border: none; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
