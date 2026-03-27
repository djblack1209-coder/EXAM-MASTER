<template>
  <view :class="['focus-page', isDark ? 'dark-mode' : '']">
    <!-- Custom nav bar -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-back" hover-class="hover-scale" @tap="handleBack">
        <text class="back-icon">&lt;</text>
      </view>
      <text class="nav-title">专注计时</text>
      <view class="nav-placeholder" />
    </view>

    <view class="timer-container" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- Session type indicator -->
      <view class="session-type">
        <text :class="['type-tag', isBreak ? 'type-break' : 'type-focus']">
          {{ isBreak ? '休息时间' : '专注学习' }}
        </text>
      </view>

      <!-- Main timer ring -->
      <view class="ring-wrapper">
        <WdCircle
          :model-value="progress"
          :size="280"
          :stroke-width="10"
          :color="isBreak ? '#3b82f6' : circleColor"
          :layer-color="circleLayerColor"
          :speed="100"
          :clockwise="false"
        >
          <view class="ring-inner">
            <text class="timer-display">{{ displayTime }}</text>
            <text class="timer-session">第 {{ completedSessions + 1 }} 个番茄</text>
          </view>
        </WdCircle>
      </view>

      <!-- Controls -->
      <view class="controls">
        <view v-if="!isRunning && !isPaused" class="start-btn" hover-class="hover-scale" @tap="startTimer">
          <text class="btn-text">开始专注</text>
        </view>
        <view v-else class="control-row">
          <view class="control-btn" hover-class="hover-scale" @tap="resetTimer">
            <text class="ctrl-icon">⟲</text>
            <text class="ctrl-label">重置</text>
          </view>
          <view
            :class="['control-btn', 'primary-btn', isBreak ? 'break-btn' : '']"
            hover-class="hover-scale"
            @tap="togglePause"
          >
            <view class="ctrl-icon"><BaseIcon :name="isPaused ? 'play' : 'pause'" :size="28" /></view>
            <text class="ctrl-label">{{ isPaused ? '继续' : '暂停' }}</text>
          </view>
          <view class="control-btn" hover-class="hover-scale" @tap="skipSession">
            <view class="ctrl-icon"><BaseIcon name="skip-forward" :size="28" /></view>
            <text class="ctrl-label">跳过</text>
          </view>
        </view>
      </view>

      <!-- Duration config -->
      <view v-if="!isRunning && !isPaused" class="config-section">
        <text class="config-title">专注时长</text>
        <view class="duration-options">
          <view
            v-for="d in durationOptions"
            :key="d"
            :class="['duration-chip', { active: focusDuration === d }]"
            @tap="focusDuration = d"
          >
            <text class="chip-text">{{ d }}分钟</text>
          </view>
        </view>
      </view>

      <!-- Today's stats -->
      <view class="today-stats">
        <view class="stat-item">
          <text class="stat-value">{{ completedSessions }}</text>
          <text class="stat-label">完成番茄</text>
        </view>
        <view class="stat-divider" />
        <view class="stat-item">
          <text class="stat-value">{{ totalFocusMinutes }}</text>
          <text class="stat-label">专注分钟</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdCircle from 'wot-design-uni/components/wd-circle/wd-circle.vue';

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { toast } from '@/utils/toast.js';
import storageService from '@/services/storageService.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { today } from '@/utils/date.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// Layout
const statusBarHeight = ref(44);
const isDark = ref(false);

// WdCircle 在 H5 的 Canvas 不支持 CSS 变量，需传实际颜色值
const circleColor = computed(() => (isDark.value ? '#4ade80' : '#0f5f34'));
const circleLayerColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'));

// Timer state
const focusDuration = ref(25); // minutes
const breakDuration = ref(5); // minutes
const isRunning = ref(false);
const isPaused = ref(false);
const isBreak = ref(false);
const remainingSeconds = ref(0);
const completedSessions = ref(0);
const totalFocusMinutes = ref(0);

const durationOptions = [15, 25, 30, 45, 60];

let interval = null;

// Computed
const totalSeconds = computed(() => {
  return (isBreak.value ? breakDuration.value : focusDuration.value) * 60;
});

const progress = computed(() => {
  if (totalSeconds.value === 0) return 0;
  return Math.round((1 - remainingSeconds.value / totalSeconds.value) * 100);
});

const displayTime = computed(() => {
  const mins = Math.floor(remainingSeconds.value / 60);
  const secs = remainingSeconds.value % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});

// Methods
function startTimer() {
  remainingSeconds.value = totalSeconds.value;
  isRunning.value = true;
  isPaused.value = false;
  vibrateLight();

  // Keep screen on
  // #ifdef APP-PLUS
  plus.device.setKeepScreenOn(true);
  // #endif

  runInterval();
}

function runInterval() {
  if (interval) clearInterval(interval);
  interval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--;
    } else {
      // Session complete
      clearInterval(interval);
      onSessionComplete();
    }
  }, 1000);
}

function togglePause() {
  if (isPaused.value) {
    isPaused.value = false;
    runInterval();
  } else {
    isPaused.value = true;
    if (interval) clearInterval(interval);
  }
  vibrateLight();
}

function resetTimer() {
  if (interval) clearInterval(interval);
  isRunning.value = false;
  isPaused.value = false;
  isBreak.value = false;
  remainingSeconds.value = 0;
  vibrateLight();
}

function skipSession() {
  if (interval) clearInterval(interval);
  onSessionComplete();
}

function onSessionComplete() {
  vibrateLight();

  if (!isBreak.value) {
    // Focus session completed
    completedSessions.value++;
    totalFocusMinutes.value += focusDuration.value;
    saveTodayStats();

    // Start break
    isBreak.value = true;
    remainingSeconds.value = breakDuration.value * 60;
    runInterval();

    toast.success('专注完成！休息一下');
  } else {
    // Break completed
    isBreak.value = false;
    isRunning.value = false;
    isPaused.value = false;
    remainingSeconds.value = 0;

    toast.info('休息结束，继续加油！');
  }
}

function saveTodayStats() {
  const key = 'FOCUS_STATS';
  const stats = storageService.get(key) || {};
  const todayKey = today();
  if (!stats[todayKey]) {
    stats[todayKey] = { sessions: 0, minutes: 0 };
  }
  stats[todayKey].sessions = completedSessions.value;
  stats[todayKey].minutes = totalFocusMinutes.value;
  storageService.save(key, stats);
}

function loadTodayStats() {
  const stats = storageService.get('FOCUS_STATS') || {};
  const todayData = stats[today()] || { sessions: 0, minutes: 0 };
  completedSessions.value = todayData.sessions;
  totalFocusMinutes.value = todayData.minutes;
}

function handleBack() {
  if (isRunning.value && !isPaused.value) {
    uni.showModal({
      title: '确认退出？',
      content: '专注计时正在进行中，退出将丢失当前进度',
      success: (res) => {
        if (res.confirm) {
          resetTimer();
          uni.navigateBack();
        }
      }
    });
  } else {
    uni.navigateBack();
  }
}

// Lifecycle
onMounted(() => {
  const sysInfo = uni.getWindowInfo();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  isDark.value = uni.getStorageSync('theme_mode') === 'dark';
  loadTodayStats();
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
  // #ifdef APP-PLUS
  plus.device.setKeepScreenOn(false);
  // #endif
});
</script>

<style lang="scss" scoped>
.focus-page {
  min-height: 100vh;
  background: var(--bg-page);
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx 16rpx;
}

.nav-back {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-card);
}

.back-icon {
  font-size: 32rpx;
  color: var(--text-primary);
  font-weight: 700;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.nav-placeholder {
  width: 60rpx;
}

.timer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 32rpx;
}

.session-type {
  margin-bottom: 48rpx;
}

.type-tag {
  font-size: 28rpx;
  font-weight: 600;
  padding: 10rpx 32rpx;
  border-radius: 999rpx;
}

.type-focus {
  color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.1);
}

.type-break {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.ring-wrapper {
  margin-bottom: 48rpx;
}

.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for MP WebView compat */
}

.timer-display {
  font-size: 72rpx;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2rpx;
}

.timer-session {
  font-size: 24rpx;
  color: var(--text-sub);
}

.controls {
  margin-bottom: 48rpx;
}

.start-btn {
  padding: 24rpx 80rpx;
  background: var(--primary, #0f5f34);
  border-radius: 999rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 95, 52, 0.3);
}

.btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
}

.control-row {
  display: flex;
  align-items: center;
  /* gap: 32rpx; -- replaced for MP WebView compat */
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for MP WebView compat */
  padding: 20rpx 28rpx;
  border-radius: 20rpx;
  background: var(--bg-card);
  min-width: 120rpx;
}

.primary-btn {
  background: var(--primary, #0f5f34);
  box-shadow: 0 4rpx 16rpx rgba(15, 95, 52, 0.25);
}

.primary-btn .ctrl-icon,
.primary-btn .ctrl-label {
  color: #fff;
}

.break-btn {
  background: #3b82f6;
  box-shadow: 0 4rpx 16rpx rgba(59, 130, 246, 0.25);
}

.ctrl-icon {
  font-size: 36rpx;
  color: var(--text-primary);
}

.ctrl-label {
  font-size: 22rpx;
  color: var(--text-sub);
}

.config-section {
  width: 100%;
  margin-bottom: 48rpx;
}

.config-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
  text-align: center;
}

.duration-options {
  display: flex;
  justify-content: center;
  /* gap: 16rpx; -- replaced for MP WebView compat */
}

.duration-chip {
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-card);
  transition: all 0.2s;
}

.duration-chip.active {
  border-color: var(--primary, #0f5f34);
  background: rgba(15, 95, 52, 0.08);
}

.duration-chip.active .chip-text {
  color: var(--primary, #0f5f34);
  font-weight: 600;
}

.chip-text {
  font-size: 24rpx;
  color: var(--text-primary);
}

.today-stats {
  display: flex;
  align-items: center;
  /* gap: 48rpx; -- replaced for MP WebView compat */
  padding: 28rpx 48rpx;
  background: var(--bg-card);
  border-radius: 24rpx;
  border: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 4rpx; -- replaced for MP WebView compat */
}

.stat-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
}

.stat-divider {
  width: 1rpx;
  height: 48rpx;
  background: var(--border-color, rgba(0, 0, 0, 0.08));
}
</style>
