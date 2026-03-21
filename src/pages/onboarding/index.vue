<template>
  <view class="onboarding" :class="{ 'dark-mode': isDark }">
    <!-- 进度指示器 -->
    <view class="progress-bar">
      <view class="progress-fill" :style="{ width: ((step + 1) / 4) * 100 + '%' }" />
    </view>

    <!-- 跳过按钮 -->
    <text class="skip-btn" @tap="skipOnboarding">跳过</text>

    <!-- 步骤内容容器 -->
    <view class="steps-wrapper">
      <!-- Step 0: 选择考试类型 -->
      <view v-show="step === 0" :class="['step-container', { 'step-active': step === 0, 'step-hidden': step !== 0 }]">
        <text class="step-emoji">🎯</text>
        <text class="step-title">你在准备什么考试？</text>
        <text class="step-desc">我们会为你定制学习计划</text>

        <view class="exam-grid">
          <view
            v-for="exam in examTypes"
            :key="exam.id"
            class="exam-card"
            :class="{ selected: selectedExam === exam.id }"
            @tap="selectedExam = exam.id"
          >
            <text class="exam-icon">{{ exam.icon }}</text>
            <text class="exam-name">{{ exam.name }}</text>
          </view>
        </view>

        <button class="next-btn" :disabled="!selectedExam" @tap="nextStep">下一步</button>
      </view>

      <!-- Step 1: 设定每日目标 -->
      <view v-show="step === 1" :class="['step-container', { 'step-active': step === 1, 'step-hidden': step !== 1 }]">
        <text class="step-emoji">📊</text>
        <text class="step-title">每天想练多少题？</text>
        <text class="step-desc">设定一个适合自己的目标</text>

        <view class="goal-options">
          <view
            v-for="goal in goalOptions"
            :key="goal.count"
            class="goal-card"
            :class="{ selected: dailyGoal === goal.count }"
            @tap="dailyGoal = goal.count"
          >
            <text class="goal-count">{{ goal.count }}</text>
            <text class="goal-unit">题/天</text>
            <text class="goal-label">{{ goal.label }}</text>
            <text class="goal-time">约 {{ goal.minutes }} 分钟</text>
          </view>
        </view>

        <button class="next-btn" :disabled="!dailyGoal" @tap="nextStep">下一步</button>
      </view>

      <!-- Step 2: 导入内容 -->
      <view v-show="step === 2" :class="['step-content', { 'step-active': step === 2, 'step-hidden': step !== 2 }]">
        <text class="step-emoji">📚</text>
        <text class="step-title">导入学习资料</text>
        <text class="step-desc">导入 Anki 牌组或上传学习资料，立即开始刷题</text>

        <view class="import-options">
          <view class="import-option" @tap="goImportAnki">
            <text class="import-icon">📦</text>
            <view class="import-info">
              <text class="import-name">导入 Anki 牌组</text>
              <text class="import-hint">支持 .apkg 格式，考研社区数万牌组可用</text>
            </view>
            <text class="import-arrow">›</text>
          </view>

          <view class="import-option" @tap="goImportFile">
            <text class="import-icon">📄</text>
            <view class="import-info">
              <text class="import-name">上传学习资料</text>
              <text class="import-hint">支持 PDF、Word、TXT 等格式</text>
            </view>
            <text class="import-arrow">›</text>
          </view>
        </view>

        <view class="step-actions">
          <view class="skip-link" @tap="step = 3">
            <text class="skip-text">暂时跳过，稍后再导入</text>
          </view>
        </view>
      </view>

      <!-- Step 3: 准备开始 -->
      <view v-show="step === 3" :class="['step-container', { 'step-active': step === 3, 'step-hidden': step !== 3 }]">
        <text class="step-emoji">🚀</text>
        <text class="step-title">一切就绪！</text>
        <text class="step-desc">{{ readySummary }}</text>

        <view class="ready-features">
          <view class="feature-item">
            <text class="feature-icon">🧠</text>
            <view class="feature-text">
              <text class="feature-title">智能出题</text>
              <text class="feature-desc">AI 根据你的水平自动调整难度</text>
            </view>
          </view>
          <view class="feature-item">
            <text class="feature-icon">📈</text>
            <view class="feature-text">
              <text class="feature-title">科学复习</text>
              <text class="feature-desc">FSRS 算法帮你在最佳时机复习</text>
            </view>
          </view>
          <view class="feature-item">
            <text class="feature-icon">🏆</text>
            <view class="feature-text">
              <text class="feature-title">成就系统</text>
              <text class="feature-desc">每道题都有 XP 奖励，解锁成就徽章</text>
            </view>
          </view>
        </view>

        <button class="start-btn" @tap="completeOnboarding">开始学习之旅</button>
      </view> </view
    ><!-- /steps-wrapper -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';

const isDark = ref(initTheme());

// Listen for theme changes from other pages
function handleThemeChange(mode) {
  isDark.value = mode === 'dark';
}
onMounted(() => onThemeUpdate(handleThemeChange));
onUnmounted(() => offThemeUpdate(handleThemeChange));
const step = ref(0);
const selectedExam = ref('');
const dailyGoal = ref(0);

const examTypes = [
  { id: 'kaoyan', name: '考研', icon: '🎓' },
  { id: 'cet4', name: '四级', icon: '📝' },
  { id: 'cet6', name: '六级', icon: '📖' },
  { id: 'gongkao', name: '公考', icon: '🏛️' },
  { id: 'sikao', name: '司考', icon: '⚖️' },
  { id: 'other', name: '其他', icon: '📚' }
];

const goalOptions = [
  { count: 10, label: '轻松', minutes: 5 },
  { count: 20, label: '适中', minutes: 15 },
  { count: 50, label: '认真', minutes: 30 },
  { count: 100, label: '冲刺', minutes: 60 }
];

const readySummary = computed(() => {
  const exam = examTypes.find((e) => e.id === selectedExam.value);
  const examName = exam ? exam.name : '考试';
  return `${examName}备考，每天 ${dailyGoal.value} 题，我们陪你一起`;
});

function nextStep() {
  if (step.value < 3) step.value++;
}

function saveOnboardingData() {
  try {
    storageService.save('onboarding_completed', true);
    storageService.save('exam_type', selectedExam.value || 'kaoyan');
    storageService.save('daily_goal', dailyGoal.value || 20);
    logger.log('[Onboarding] Saved:', { exam: selectedExam.value, goal: dailyGoal.value });
  } catch (e) {
    logger.warn('[Onboarding] Save error:', e);
  }
}

function completeOnboarding() {
  saveOnboardingData();
  uni.switchTab({ url: '/pages/index/index' });
}

function goImportAnki() {
  saveOnboardingData();
  uni.navigateTo({ url: '/pages/practice-sub/import-data?source=onboarding&type=apkg' });
}

function goImportFile() {
  saveOnboardingData();
  uni.navigateTo({ url: '/pages/practice-sub/import-data?source=onboarding' });
}

function skipOnboarding() {
  storageService.save('onboarding_completed', true);
  storageService.save('daily_goal', 20); // 默认目标
  uni.switchTab({ url: '/pages/index/index' });
}
</script>

<style lang="scss" scoped>
.onboarding {
  min-height: 100vh;
  background: var(--bg-page, #f5f5f7);
  padding: 0 40rpx;
  position: relative;
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 6rpx;
  background: rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.progress-fill {
  height: 100%;
  background: var(--primary, #37b24d);
  border-radius: 0 3rpx 3rpx 0;
  transition: width 0.4s ease;
}

.skip-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top, 44px) + 16rpx);
  right: 40rpx;
  font-size: 28rpx;
  color: var(--text-sub, #999);
  z-index: 100;
  padding: 8rpx 16rpx;
}

.step-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(env(safe-area-inset-top, 44px) + 120rpx);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.step-emoji {
  font-size: 96rpx;
  margin-bottom: 32rpx;
}

.step-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 16rpx;
}

.step-desc {
  font-size: 28rpx;
  color: var(--text-sub, #999);
  margin-bottom: 64rpx;
}

/* 考试类型网格 */
.exam-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  margin-bottom: 64rpx;
}

.exam-grid > .exam-card {
  margin: 12rpx;
}

.exam-card {
  width: 200rpx;
  height: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #fff);
  border-radius: 24rpx;
  border: 3rpx solid transparent;
  transition: all 0.2s;
}

.exam-card.selected {
  border-color: var(--primary, #37b24d);
  background: rgba(55, 178, 77, 0.06);
  transform: scale(1.05);
}

.exam-icon {
  font-size: 56rpx;
  margin-bottom: 12rpx;
}

.exam-name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

/* 目标选项 */
.goal-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  margin-bottom: 64rpx;
}

.goal-options > .goal-card {
  margin: 12rpx;
}

.goal-card {
  width: 300rpx;
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-secondary, #fff);
  border-radius: 24rpx;
  border: 3rpx solid transparent;
  transition: all 0.2s;
}

.goal-card.selected {
  border-color: var(--primary, #37b24d);
  background: rgba(55, 178, 77, 0.06);
  transform: scale(1.05);
}

.goal-count {
  font-size: 56rpx;
  font-weight: 800;
  color: var(--primary, #37b24d);
}

.goal-unit {
  font-size: 22rpx;
  color: var(--text-sub, #999);
  margin-bottom: 8rpx;
}

.goal-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 4rpx;
}

.goal-time {
  font-size: 22rpx;
  color: var(--text-sub, #999);
}

/* 准备开始 */
.ready-features {
  width: 100%;
  margin-bottom: 64rpx;
}

.ready-features > .feature-item + .feature-item {
  margin-top: 24rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  background: var(--bg-secondary, #fff);
  border-radius: 20rpx;
}

.feature-icon {
  font-size: 48rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.feature-text {
  display: flex;
  flex-direction: column;
}

.feature-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 4rpx;
}

.feature-desc {
  font-size: 24rpx;
  color: var(--text-sub, #999);
}

/* 按钮 */
.next-btn,
.start-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  background: var(--primary, #37b24d);
  border-radius: 48rpx;
  border: none;
  margin-top: 16rpx;
}

.next-btn[disabled] {
  opacity: 0.4;
}

.start-btn {
  background: linear-gradient(135deg, var(--primary, #37b24d), #2f9e44);
  font-size: 34rpx;
}

/* 导入选项 */
.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(env(safe-area-inset-top, 44px) + 120rpx);
  padding-left: 40rpx;
  padding-right: 40rpx;
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.import-options {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 40rpx;
  width: 100%;
}
.import-option {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx;
  background: var(--bg-secondary, rgba(255, 255, 255, 0.1));
  border-radius: 20rpx;
  border: 2rpx solid var(--border-color, rgba(255, 255, 255, 0.15));
}
.import-option:active {
  opacity: 0.8;
  transform: scale(0.98);
}
.import-icon {
  font-size: 48rpx;
}
.import-info {
  flex: 1;
}
.import-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: block;
}
.import-hint {
  font-size: 24rpx;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  margin-top: 6rpx;
  display: block;
}
.import-arrow {
  font-size: 36rpx;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
}
.skip-link {
  text-align: center;
  margin-top: 40rpx;
}
.skip-text {
  font-size: 26rpx;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-decoration: underline;
}

/* 步骤容器 */
.steps-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
}

/* 步骤切换动画 */
.step-hidden {
  opacity: 0;
  transform: translateX(60rpx);
  pointer-events: none;
  position: absolute;
  width: 100%;
}

.step-active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
  position: relative;
}

/* 暗色模式 */
.dark-mode {
  background: linear-gradient(180deg, #0b0b0f 0%, #1a1a2e 100%);
}

.dark-mode .step-title {
  color: #f5f5f7;
}

.dark-mode .step-desc {
  color: rgba(245, 245, 247, 0.6);
}

.dark-mode .exam-card,
.dark-mode .goal-card,
.dark-mode .feature-item {
  background: rgba(255, 255, 255, 0.08);
}

.dark-mode .exam-card.selected,
.dark-mode .goal-card.selected {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}

.dark-mode .import-option {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}
</style>
