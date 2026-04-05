<template>
  <view class="onboarding" :class="{ 'dark-mode': isDark }">
    <!-- 背景装饰 — 活泼的彩色光斑 -->
    <view class="bg-decor">
      <view class="blob blob-1" />
      <view class="blob blob-2" />
      <view class="blob blob-3" />
    </view>

    <!-- 进度指示器 — 更粗更醒目 -->
    <view class="progress-bar">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: ((step + 1) / 4) * 100 + '%' }" />
      </view>
      <text class="progress-label">{{ step + 1 }}/4 {{ stepLabels[step] }}</text>
    </view>

    <!-- 跳过按钮 -->
    <text class="skip-btn" @tap="skipOnboarding">跳过</text>

    <!-- 步骤内容容器 -->
    <view class="steps-wrapper">
      <!-- Step 0: 选择考试类型 -->
      <view v-show="step === 0" :class="['step-container', { 'step-active': step === 0, 'step-hidden': step !== 0 }]">
        <!-- 引导插画：选择考试 -->
        <image
          class="step-illustration"
          src="./static/illustrations/onboard-choose-exam.png"
          mode="aspectFit"
          lazy-load
        />
        <text class="step-title">你在准备什么考试？</text>
        <text class="step-desc">我们会为你定制专属学习计划</text>

        <view class="exam-grid">
          <view
            v-for="exam in examTypes"
            :key="exam.id"
            class="exam-card"
            :class="{ selected: selectedExam === exam.id }"
            :style="{ '--card-accent': exam.color }"
            @tap="selectedExam = exam.id"
          >
            <view class="exam-icon-wrap" :style="{ background: exam.color + '18' }">
              <BaseIcon :name="exam.icon" :size="44" :color="exam.color" />
            </view>
            <text class="exam-name">{{ exam.name }}</text>
          </view>
        </view>

        <view class="btn-area">
          <button class="cta-btn" :disabled="!selectedExam" @tap="nextStep">
            <text class="cta-text">下一步</text>
          </button>
        </view>
      </view>

      <!-- Step 1: 设定每日目标 -->
      <view v-show="step === 1" :class="['step-container', { 'step-active': step === 1, 'step-hidden': step !== 1 }]">
        <!-- 引导插画：设定目标 -->
        <image class="step-illustration" src="./static/illustrations/onboard-set-goal.png" mode="aspectFit" lazy-load />
        <text class="step-title">每天想练多少题？</text>
        <text class="step-desc">设定一个适合自己的小目标</text>

        <view class="goal-grid">
          <view
            v-for="goal in goalOptions"
            :key="goal.count"
            class="goal-card"
            :class="{ selected: dailyGoal === goal.count }"
            :style="{ '--card-accent': goal.color }"
            @tap="dailyGoal = goal.count"
          >
            <text class="goal-count" :style="{ color: goal.color }">{{ goal.count }}</text>
            <text class="goal-unit">题/天</text>
            <view class="goal-divider" :style="{ background: goal.color }" />
            <text class="goal-label">{{ goal.label }}</text>
            <text class="goal-time">约 {{ goal.minutes }} 分钟</text>
          </view>
        </view>

        <view class="btn-area">
          <button class="cta-btn" :disabled="!dailyGoal" @tap="nextStep">
            <text class="cta-text">下一步</text>
          </button>
        </view>
      </view>

      <!-- Step 2: 导入内容 -->
      <view v-show="step === 2" :class="['step-container', { 'step-active': step === 2, 'step-hidden': step !== 2 }]">
        <!-- 引导插画：导入资料 -->
        <image class="step-illustration" src="./static/illustrations/onboard-import.png" mode="aspectFit" lazy-load />
        <text class="step-title">导入学习资料</text>
        <text class="step-desc">导入 Anki 牌组或上传学习资料，立即开始刷题</text>

        <view class="import-options">
          <view class="import-card" @tap="goImportAnki">
            <view class="import-icon-wrap" style="background: rgba(28, 176, 246, 0.12)">
              <BaseIcon name="download" :size="40" color="#1CB0F6" />
            </view>
            <view class="import-info">
              <text class="import-name">导入 Anki 牌组</text>
              <text class="import-hint">支持 .apkg 格式，考研社区数万牌组可用</text>
            </view>
            <BaseIcon name="chevron-right" :size="24" color="#afafaf" class="import-arrow" />
          </view>

          <view class="import-card" @tap="goImportFile">
            <view class="import-icon-wrap" style="background: rgba(255, 150, 0, 0.12)">
              <BaseIcon name="file-text" :size="40" color="#FF9600" />
            </view>
            <view class="import-info">
              <text class="import-name">上传学习资料</text>
              <text class="import-hint">支持 PDF、Word、TXT 等格式</text>
            </view>
            <BaseIcon name="chevron-right" :size="24" color="#afafaf" class="import-arrow" />
          </view>
        </view>

        <view class="skip-link" @tap="step = 3">
          <text class="skip-text">暂时跳过，稍后再导入</text>
        </view>
      </view>

      <!-- Step 3: 准备开始 -->
      <view v-show="step === 3" :class="['step-container', { 'step-active': step === 3, 'step-hidden': step !== 3 }]">
        <!-- 引导插画：准备开始 -->
        <image class="step-illustration" src="./static/illustrations/onboard-ready.png" mode="aspectFit" lazy-load />
        <text class="step-title">一切就绪！</text>
        <text class="step-desc">{{ readySummary }}</text>

        <view class="ready-features">
          <view class="feature-card">
            <view class="feature-icon-wrap" style="background: rgba(255, 150, 0, 0.12)">
              <BaseIcon name="bulb" :size="36" color="#FF9600" />
            </view>
            <view class="feature-text">
              <text class="feature-title">智能出题</text>
              <text class="feature-desc">AI 根据你的水平自动调整难度</text>
            </view>
          </view>
          <view class="feature-card">
            <view class="feature-icon-wrap" style="background: rgba(28, 176, 246, 0.12)">
              <BaseIcon name="trend-up" :size="36" color="#1CB0F6" />
            </view>
            <view class="feature-text">
              <text class="feature-title">科学复习</text>
              <text class="feature-desc">FSRS 算法帮你在最佳时机复习</text>
            </view>
          </view>
          <view class="feature-card">
            <view class="feature-icon-wrap" style="background: rgba(255, 215, 0, 0.15)">
              <BaseIcon name="trophy" :size="36" color="#FFB800" />
            </view>
            <view class="feature-text">
              <text class="feature-title">成就系统</text>
              <text class="feature-desc">每道题都有 XP 奖励，解锁成就徽章</text>
            </view>
          </view>
        </view>

        <view class="btn-area">
          <button class="cta-btn cta-start" @tap="completeOnboarding">
            <text class="cta-text">开始学习之旅</text>
          </button>
        </view>
      </view>
    </view>
    <!-- /steps-wrapper -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const isDark = ref(initTheme());

// 监听主题切换
function handleThemeChange(mode) {
  isDark.value = mode === 'dark';
}
onMounted(() => onThemeUpdate(handleThemeChange));
onUnmounted(() => offThemeUpdate(handleThemeChange));
const step = ref(0);
const selectedExam = ref('');
const dailyGoal = ref(0);

// 步骤名称 — 用于进度标签增强引导感
const stepLabels = ['选择考试', '设定目标', '导入资料', '准备就绪'];

const examTypes = [
  { id: 'kaoyan', name: '考研', icon: 'graduate', color: '#58CC02' },
  { id: 'cet4', name: '四级', icon: 'book', color: '#1CB0F6' },
  { id: 'cet6', name: '六级', icon: 'book-open', color: '#49C0F8' },
  { id: 'gongkao', name: '公考', icon: 'briefcase', color: '#FF9600' },
  { id: 'sikao', name: '司考', icon: 'gavel', color: '#FF4B4B' },
  { id: 'other', name: '其他', icon: 'folder', color: '#CE82FF' }
];

const goalOptions = [
  { count: 10, label: '轻松', minutes: 5, color: '#58CC02' },
  { count: 20, label: '适中', minutes: 15, color: '#1CB0F6' },
  { count: 50, label: '认真', minutes: 30, color: '#FF9600' },
  { count: 100, label: '冲刺', minutes: 60, color: '#FF4B4B' }
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
/* ============================================
   引导页 — Design System 2.0 (多邻国风格)
   ============================================ */

/* === 关键帧动画 === */
@keyframes cardPopIn {
  0% {
    transform: scale(0.85) translateY(24rpx);
    opacity: 0;
  }
  70% {
    transform: scale(1.04) translateY(-4rpx);
    opacity: 1;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes iconBounce {
  0% {
    transform: scale(0.3) rotate(-15deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.15) rotate(5deg);
    opacity: 1;
  }
  80% {
    transform: scale(0.95) rotate(-2deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes titleSlideUp {
  0% {
    transform: translateY(40rpx);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes blobFloat1 {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30rpx, -20rpx) scale(1.05);
  }
  66% {
    transform: translate(-20rpx, 15rpx) scale(0.95);
  }
}

@keyframes blobFloat2 {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(-25rpx, 25rpx) scale(1.08);
  }
  66% {
    transform: translate(15rpx, -30rpx) scale(0.92);
  }
}

@keyframes progressGlow {
  0%,
  100% {
    box-shadow: 0 0 8rpx rgba(88, 204, 2, 0.4);
  }
  50% {
    box-shadow: 0 0 16rpx rgba(88, 204, 2, 0.7);
  }
}

@keyframes selectBounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.08);
  }
  70% {
    transform: scale(0.97);
  }
  100% {
    transform: scale(1.02);
  }
}

/* === 全局容器 === */
.onboarding {
  min-height: 100vh;
  background: var(--background, #fafafa);
  padding: 0 40rpx;
  position: relative;
  overflow: hidden;
}

/* === 背景装饰光斑 === */
.bg-decor {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.35;
}

.blob-1 {
  width: 400rpx;
  height: 400rpx;
  background: #58cc02;
  top: -80rpx;
  right: -100rpx;
  animation: blobFloat1 8s ease-in-out infinite;
}

.blob-2 {
  width: 350rpx;
  height: 350rpx;
  background: #1cb0f6;
  bottom: 200rpx;
  left: -120rpx;
  animation: blobFloat2 10s ease-in-out infinite;
}

.blob-3 {
  width: 300rpx;
  height: 300rpx;
  background: #ff9600;
  bottom: -60rpx;
  right: 60rpx;
  animation: blobFloat1 12s ease-in-out infinite reverse;
}

/* === 进度条 === */
.progress-bar {
  position: fixed;
  top: calc(env(safe-area-inset-top, 44px) + 16rpx);
  left: 40rpx;
  right: 120rpx;
  z-index: 100;
  display: flex;
  align-items: center;
}

.progress-track {
  flex: 1;
  height: 16rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #58cc02, #6ee018);
  border-radius: 8rpx;
  transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: progressGlow 2s ease-in-out infinite;
}

.progress-label {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-secondary, #afafaf);
  margin-left: 16rpx;
  min-width: 140rpx;
  text-align: right;
  white-space: nowrap;
}

/* === 跳过按钮 === */
.skip-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top, 44px) + 12rpx);
  right: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary, #afafaf);
  z-index: 100;
  padding: 10rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(0, 0, 0, 0.04);
}

.skip-btn:active {
  background: rgba(0, 0, 0, 0.08);
}

/* === 步骤容器和切换 === */
.steps-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
  z-index: 1;
}

.step-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(env(safe-area-inset-top, 44px) + 100rpx);
  transition:
    opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-hidden {
  opacity: 0;
  transform: translateX(80rpx);
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

/* === 步骤插画 === */
.step-illustration {
  width: 400rpx;
  height: 320rpx;
  margin: 0 auto 40rpx;
  display: block;
}

/* === 步骤图标圆 — 多邻国技能图标风格（保留，已被插画替代） === */
.step-icon-circle {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 36rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
  /* 入场弹跳动画 */
  opacity: 0;
  animation: iconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
}

.icon-green {
  background: linear-gradient(135deg, #58cc02, #46a302);
}
.icon-blue {
  background: linear-gradient(135deg, #1cb0f6, #0899db);
}
.icon-orange {
  background: linear-gradient(135deg, #ff9600, #e58600);
}
.icon-purple {
  background: linear-gradient(135deg, #ce82ff, #a855f7);
}

/* === 步骤标题 / 副标题 === */
.step-title {
  font-size: 48rpx;
  font-weight: 800;
  color: var(--text-primary, #3c3c3c);
  margin-bottom: 16rpx;
  letter-spacing: -0.5px;
  /* 入场动画 */
  opacity: 0;
  animation: titleSlideUp 0.5s ease-out 0.25s forwards;
}

.step-desc {
  font-size: 28rpx;
  color: var(--text-secondary, #afafaf);
  margin-bottom: 56rpx;
  font-weight: 500;
  /* 入场动画 */
  opacity: 0;
  animation: titleSlideUp 0.5s ease-out 0.35s forwards;
}

/* === 考试类型网格 === */
.exam-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  margin-bottom: 48rpx;
}

.exam-grid > .exam-card {
  margin: 12rpx;
}

.exam-card {
  width: 200rpx;
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-card, #ffffff);
  border-radius: 28rpx;
  border: 4rpx solid transparent;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: all 0.15s ease;
  /* 入场动画 — 依次弹出 */
  opacity: 0;
  animation: cardPopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* 卡片依次延迟出场 */
.step-active .exam-card:nth-child(1) {
  animation-delay: 0.15s;
}
.step-active .exam-card:nth-child(2) {
  animation-delay: 0.2s;
}
.step-active .exam-card:nth-child(3) {
  animation-delay: 0.25s;
}
.step-active .exam-card:nth-child(4) {
  animation-delay: 0.3s;
}
.step-active .exam-card:nth-child(5) {
  animation-delay: 0.35s;
}
.step-active .exam-card:nth-child(6) {
  animation-delay: 0.4s;
}

.exam-card:active {
  transform: scale(0.95);
}

.exam-card.selected {
  border-color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 8%, var(--bg-card, #ffffff));
  box-shadow: 0 6rpx 20rpx color-mix(in srgb, var(--card-accent) 25%, transparent);
  /* 必须显式设 opacity:1，否则 selectBounce 会覆盖 cardPopIn 的 fill-mode 导致消失 */
  opacity: 1;
  animation: selectBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.exam-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.exam-name {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary, #3c3c3c);
}

/* === 目标选项网格 === */
.goal-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  margin-bottom: 48rpx;
}

.goal-grid > .goal-card {
  margin: 12rpx;
}

.goal-card {
  width: 300rpx;
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-card, #ffffff);
  border-radius: 28rpx;
  border: 4rpx solid transparent;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: all 0.15s ease;
  /* 入场动画 */
  opacity: 0;
  animation: cardPopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.step-active .goal-card:nth-child(1) {
  animation-delay: 0.15s;
}
.step-active .goal-card:nth-child(2) {
  animation-delay: 0.22s;
}
.step-active .goal-card:nth-child(3) {
  animation-delay: 0.29s;
}
.step-active .goal-card:nth-child(4) {
  animation-delay: 0.36s;
}

.goal-card:active {
  transform: scale(0.95);
}

.goal-card.selected {
  border-color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 8%, var(--bg-card, #ffffff));
  box-shadow: 0 6rpx 20rpx color-mix(in srgb, var(--card-accent) 25%, transparent);
  opacity: 1;
  animation: selectBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.goal-count {
  font-size: 64rpx;
  font-weight: 900;
  line-height: 1;
}

.goal-unit {
  font-size: 22rpx;
  color: var(--text-secondary, #afafaf);
  margin-bottom: 12rpx;
  font-weight: 600;
}

.goal-divider {
  width: 48rpx;
  height: 6rpx;
  border-radius: 3rpx;
  opacity: 0.5;
  margin-bottom: 12rpx;
}

.goal-label {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary, #3c3c3c);
  margin-bottom: 4rpx;
}

.goal-time {
  font-size: 22rpx;
  color: var(--text-secondary, #afafaf);
  font-weight: 500;
}

/* === 导入选项 === */
.import-options {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 16rpx;
}

.import-options > .import-card + .import-card {
  margin-top: 24rpx;
}

.import-card {
  display: flex;
  align-items: center;
  padding: 32rpx;
  background: var(--bg-card, #ffffff);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: all 0.15s ease;
  /* 入场动画 */
  opacity: 0;
  animation: cardPopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.step-active .import-card:nth-child(1) {
  animation-delay: 0.2s;
}
.step-active .import-card:nth-child(2) {
  animation-delay: 0.3s;
}

.import-card:active {
  transform: scale(0.97);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.import-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.import-info {
  flex: 1;
}

.import-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary, #3c3c3c);
  display: block;
}

.import-hint {
  font-size: 24rpx;
  color: var(--text-secondary, #afafaf);
  margin-top: 6rpx;
  display: block;
  font-weight: 500;
}

.import-arrow {
  color: var(--text-tertiary, #d1d1d6);
  margin-left: 12rpx;
}

.skip-link {
  text-align: center;
  margin-top: 48rpx;
  padding: 16rpx 32rpx;
}

.skip-text {
  font-size: 26rpx;
  color: var(--text-secondary, #afafaf);
  font-weight: 600;
}

.skip-text:active {
  color: var(--muted-foreground, #8e8e93);
}

/* === 功能亮点卡片 === */
.ready-features {
  width: 100%;
  margin-bottom: 48rpx;
}

.ready-features > .feature-card + .feature-card {
  margin-top: 20rpx;
}

.feature-card {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  background: var(--bg-card, #ffffff);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  /* 入场动画 */
  opacity: 0;
  animation: cardPopIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.step-active .feature-card:nth-child(1) {
  animation-delay: 0.2s;
}
.step-active .feature-card:nth-child(2) {
  animation-delay: 0.3s;
}
.step-active .feature-card:nth-child(3) {
  animation-delay: 0.4s;
}

.feature-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.feature-text {
  display: flex;
  flex-direction: column;
}

.feature-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary, #3c3c3c);
  margin-bottom: 4rpx;
}

.feature-desc {
  font-size: 24rpx;
  color: var(--text-secondary, #afafaf);
  font-weight: 500;
}

/* === 3D 按钮 — 多邻国招牌设计 === */
.btn-area {
  width: 100%;
  padding: 0 20rpx;
  margin-top: 8rpx;
}

.cta-btn {
  width: 100%;
  height: 104rpx;
  line-height: 104rpx;
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
  background: #58cc02;
  border-radius: 24rpx;
  border: none;
  position: relative;
  /* 3D 效果 — 底部深色边营造立体感 */
  box-shadow:
    0 8rpx 0 #46a302,
    0 12rpx 24rpx rgba(88, 204, 2, 0.25);
  transition: all 0.08s ease;
  letter-spacing: 1rpx;
}

.cta-btn:active {
  box-shadow:
    0 2rpx 0 #46a302,
    0 4rpx 12rpx rgba(88, 204, 2, 0.2);
  transform: translateY(6rpx);
}

.cta-btn[disabled] {
  background: var(--muted, #e5e5ea);
  box-shadow:
    0 8rpx 0 #c7c7cc,
    0 12rpx 24rpx rgba(0, 0, 0, 0.08);
  color: var(--text-secondary, #afafaf);
  /* 微妙呼吸脉动 — 提示用户"先选一个" */
  animation: ctaPulse 2.5s ease-in-out infinite;
}

@keyframes ctaPulse {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 0.85;
  }
}

.cta-btn[disabled]:active {
  transform: none;
  box-shadow:
    0 8rpx 0 #c7c7cc,
    0 12rpx 24rpx rgba(0, 0, 0, 0.08);
}

.cta-text {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
}

/* 最终「开始学习之旅」按钮 — 渐变加强版 */
.cta-start {
  background: linear-gradient(135deg, #58cc02 0%, #46a302 100%);
  font-size: 36rpx;
  height: 112rpx;
  line-height: 112rpx;
}

/* === 暗色模式 — 保持赛博朋克风格 === */
.dark-mode {
  background: linear-gradient(180deg, var(--background, #1a1c23) 0%, var(--page-gradient-mid, #15171e) 100%);
}

.dark-mode .bg-decor .blob {
  opacity: 0.12;
}

.dark-mode .blob-1 {
  background: #00e0ff;
}
.dark-mode .blob-2 {
  background: #9b51e0;
}
.dark-mode .blob-3 {
  background: #00e0ff;
}

.dark-mode .progress-track {
  background: rgba(255, 255, 255, 0.08);
}

.dark-mode .progress-fill {
  background: linear-gradient(90deg, #00e0ff, #9b51e0);
  animation: none;
  box-shadow: 0 0 12rpx rgba(0, 224, 255, 0.5);
}

.dark-mode .progress-label {
  color: rgba(255, 255, 255, 0.4);
}

.dark-mode .skip-btn {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
}

.dark-mode .step-title {
  color: var(--foreground, #ffffff);
}

.dark-mode .step-desc {
  color: rgba(245, 245, 247, 0.5);
}

.dark-mode .exam-card,
.dark-mode .goal-card,
.dark-mode .feature-card,
.dark-mode .import-card {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.06);
}

.dark-mode .exam-card.selected,
.dark-mode .goal-card.selected {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 4rpx 20rpx rgba(99, 102, 241, 0.3);
}

.dark-mode .exam-name,
.dark-mode .goal-label,
.dark-mode .feature-title,
.dark-mode .import-name {
  color: rgba(255, 255, 255, 0.9);
}

.dark-mode .goal-unit,
.dark-mode .goal-time,
.dark-mode .feature-desc,
.dark-mode .import-hint,
.dark-mode .skip-text {
  color: rgba(255, 255, 255, 0.4);
}

.dark-mode .import-arrow {
  color: rgba(255, 255, 255, 0.2);
}

.dark-mode .cta-btn {
  background: linear-gradient(135deg, #00e0ff, #9b51e0);
  box-shadow:
    0 8rpx 0 rgba(0, 150, 180, 0.8),
    0 12rpx 24rpx rgba(0, 224, 255, 0.2);
  color: #1a1c23;
}

.dark-mode .cta-btn:active {
  box-shadow:
    0 2rpx 0 rgba(0, 150, 180, 0.8),
    0 4rpx 12rpx rgba(0, 224, 255, 0.15);
}

.dark-mode .cta-btn[disabled] {
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8rpx 0 rgba(255, 255, 255, 0.04),
    0 0 0 transparent;
  color: rgba(255, 255, 255, 0.2);
}
</style>
