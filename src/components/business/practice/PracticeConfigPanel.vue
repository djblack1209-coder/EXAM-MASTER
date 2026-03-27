<template>
  <WdPopup
    :model-value="visible"
    position="bottom"
    custom-style="border-radius: 28rpx 28rpx 0 0; max-height: 80vh;"
    @close="$emit('close')"
    @update:model-value="
      (val) => {
        if (!val) $emit('close');
      }
    "
  >
    <view class="config-panel">
      <!-- Header -->
      <view class="panel-header">
        <text class="panel-title">练习设置</text>
        <view class="panel-close" @tap="$emit('close')">
          <BaseIcon name="close" :size="28" />
        </view>
      </view>

      <scroll-view scroll-y class="panel-body">
        <!-- Question Count -->
        <view class="config-section">
          <text class="section-label">题目数量</text>
          <view class="count-options">
            <view
              v-for="count in countOptions"
              :key="count"
              :class="['count-chip', { active: config.questionCount === count }]"
              @tap="config.questionCount = count"
            >
              <text class="chip-text">{{ count }}题</text>
            </view>
          </view>
        </view>

        <!-- Difficulty -->
        <view class="config-section">
          <text class="section-label">难度偏好</text>
          <view class="difficulty-options">
            <view
              v-for="d in difficultyOptions"
              :key="d.value"
              :class="['diff-chip', { active: config.difficulty === d.value }]"
              @tap="config.difficulty = d.value"
            >
              <view class="chip-icon"><BaseIcon :name="d.icon" :size="28" /></view>
              <text class="chip-text">{{ d.label }}</text>
            </view>
          </view>
        </view>

        <!-- Category (Subject) -->
        <view class="config-section">
          <text class="section-label">科目</text>
          <view class="category-options">
            <view
              v-for="cat in categoryOptions"
              :key="cat.value"
              :class="['cat-chip', { active: config.category === cat.value }]"
              @tap="config.category = cat.value"
            >
              <text class="chip-text">{{ cat.label }}</text>
            </view>
          </view>
        </view>

        <!-- Practice Mode -->
        <view class="config-section">
          <text class="section-label">练习模式</text>
          <view class="mode-options">
            <view
              v-for="mode in modeOptions"
              :key="mode.value"
              :class="['mode-card', { active: config.mode === mode.value }]"
              @tap="config.mode = mode.value"
            >
              <view class="mode-icon"><BaseIcon :name="mode.icon" :size="28" /></view>
              <view class="mode-info">
                <text class="mode-name">{{ mode.label }}</text>
                <text class="mode-desc">{{ mode.desc }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Timer Toggle -->
        <view class="config-section timer-section">
          <view class="timer-row">
            <text class="section-label">计时模式</text>
            <WdSwitch v-model="config.timerEnabled" size="36rpx" />
          </view>
          <text class="timer-hint">
            {{ config.timerEnabled ? '每题限时答题，模拟考试氛围' : '无时间压力，自由思考' }}
          </text>
        </view>
      </scroll-view>

      <!-- Start Button -->
      <view class="panel-footer">
        <WdButton type="primary" block size="large" @click="startPractice">
          开始练习 · {{ config.questionCount }}题
        </WdButton>
      </view>
    </view>
  </WdPopup>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';
import WdSwitch from 'wot-design-uni/components/wd-switch/wd-switch.vue';
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { reactive } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const _props = defineProps({
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'start']);

const countOptions = [10, 20, 30, 50];

const difficultyOptions = [
  { value: 'auto', label: '智能', icon: 'robot' },
  { value: 'easy', label: '简单', icon: 'smiley' },
  { value: 'medium', label: '中等', icon: 'brain' },
  { value: 'hard', label: '困难', icon: 'flame' }
];

const categoryOptions = [
  { value: 'all', label: '全部' },
  { value: '政治', label: '政治' },
  { value: '英语', label: '英语' },
  { value: '数学', label: '数学' },
  { value: '专业课', label: '专业课' }
];

const modeOptions = [
  { value: 'normal', label: '普通练习', desc: '按序做题，查看解析', icon: 'note' },
  { value: 'ai_adaptive', label: 'AI自适应', desc: '根据水平动态调整', icon: 'brain' },
  { value: 'review', label: '复习模式', desc: 'FSRS算法推荐', icon: 'refresh' },
  { value: 'mistake_redo', label: '错题重做', desc: '重做做错的题目', icon: 'error' }
];

const config = reactive({
  questionCount: 20,
  difficulty: 'auto',
  category: 'all',
  mode: 'normal',
  timerEnabled: false
});

function startPractice() {
  emit('start', { ...config });
  emit('close');
}
</script>

<style lang="scss" scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 16rpx;
  border-bottom: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.panel-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}

.close-icon {
  font-size: 28rpx;
  color: var(--text-sub);
}

.panel-body {
  flex: 1;
  padding: 8rpx 32rpx;
  max-height: 55vh;
}

.config-section {
  margin-bottom: 32rpx;
}

.section-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
}

/* Count chips */
.count-options {
  display: flex;
  /* gap: 16rpx; -- replaced for MP WebView compat */
}

.count-chip {
  flex: 1;
  padding: 18rpx 0;
  text-align: center;
  border-radius: 16rpx;
  border: 2rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-card, #fff);
  transition: all 0.2s ease;
}

.count-chip.active {
  border-color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.08);
}

.count-chip.active .chip-text {
  color: var(--primary, #0f5f34);
  font-weight: 600;
}

/* Difficulty chips */
.difficulty-options {
  display: flex;
  /* gap: 16rpx; -- replaced for MP WebView compat */
}

.diff-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 6rpx; -- replaced for MP WebView compat */
  padding: 18rpx 0;
  border-radius: 16rpx;
  border: 2rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-card, #fff);
  transition: all 0.2s ease;
}

.diff-chip.active {
  border-color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.08);
}

.chip-icon {
  font-size: 32rpx;
}

.chip-text {
  font-size: 24rpx;
  color: var(--text-primary);
}

/* Category chips */
.category-options {
  display: flex;
  flex-wrap: wrap;
  /* gap: 12rpx; -- replaced for MP WebView compat */
}

.cat-chip {
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-card, #fff);
  transition: all 0.2s ease;
}

.cat-chip.active {
  border-color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.08);
}

.cat-chip.active .chip-text {
  color: var(--primary, #0f5f34);
  font-weight: 600;
}

/* Mode cards */
.mode-options {
  display: flex;
  flex-direction: column;
  /* gap: 12rpx; -- replaced for MP WebView compat */
}

.mode-card {
  display: flex;
  align-items: center;
  /* gap: 20rpx; -- replaced for MP WebView compat */
  padding: 24rpx;
  border-radius: 20rpx;
  border: 2rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-card, #fff);
  transition: all 0.2s ease;
}

.mode-card.active {
  border-color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.06);
}

.mode-icon {
  font-size: 40rpx;
}

.mode-info {
  display: flex;
  flex-direction: column;
  /* gap: 4rpx; -- replaced for MP WebView compat */
}

.mode-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.mode-desc {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* Timer section */
.timer-section {
  padding: 20rpx 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  border-radius: 20rpx;
}

.timer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timer-hint {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 8rpx;
}

/* Footer */
.panel-footer {
  padding: 16rpx 32rpx calc(constant(safe-area-inset-bottom) + 16rpx);
  padding: 16rpx 32rpx calc(env(safe-area-inset-bottom) + 16rpx);
  border-top: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
}
</style>
