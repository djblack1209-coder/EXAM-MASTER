<template>
  <view class="onboarding-page">
    <view v-if="legacyMode" class="topbar">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </view>
      <text class="skip" @tap="skipOnboarding">跳过</text>
    </view>

    <view class="brand-line">
      <text class="brand">{{ BRAND.name }}</text>
      <text v-if="legacyMode" class="step-count">{{ step + 1 }} / 4</text>
    </view>

    <view class="panel">
      <view v-if="!legacyMode" class="step welcome-step">
        <text class="title">开始学习</text>
      </view>
      <view v-else-if="step === 0" class="step">
        <text class="title">备考方向</text>

        <view class="exam-card selected">
          <view class="exam-card-main">
            <text class="exam-name">2027 考研公共课</text>
          </view>
          <text class="exam-status">已选择</text>
        </view>
      </view>

      <view v-else-if="step === 1" class="step">
        <text class="title">选择科目</text>

        <view v-for="group in trackGroups" :key="group.subject" class="track-group">
          <text class="track-title">{{ group.label }}</text>
          <view class="track-options">
            <view
              v-for="option in group.options"
              :key="option.id"
              class="track-chip"
              :class="{ selected: isTrackSelected(option.id) }"
              @tap="selectTrack(group.subject, option.id)"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="step === 2" class="step">
        <text class="title">每日题量</text>

        <view class="goal-grid">
          <view
            v-for="goal in goalOptions"
            :key="goal.count"
            class="goal-card"
            :class="{ selected: dailyGoal === goal.count }"
            @tap="dailyGoal = goal.count"
          >
            <text class="goal-count">{{ goal.count }}</text>
            <text class="goal-label">{{ goal.label }}</text>
            <text class="goal-time">{{ goal.time }}</text>
          </view>
        </view>
      </view>

      <view v-else class="step">
        <text class="title">确认设置</text>

        <view class="paper-preview">
          <view v-for="paper in previewPapers" :key="paper.label" class="paper-row" :class="paper.state">
            <text class="paper-label">{{ paper.label }}</text>
            <text class="paper-state">{{ paper.stateText }}</text>
          </view>
        </view>

        <view class="summary-card">
          <text class="summary-label">已配置</text>
          <text class="summary-value">{{ selectedTrackLabels.join(' / ') }}</text>
          <text class="summary-sub">{{ dailyGoal }} 题/天</text>
        </view>
      </view>
    </view>

    <view class="actions">
      <view v-if="legacyMode && step > 0" class="secondary-btn" hover-class="btn-hover" @tap="prevStep">
        <text>上一步</text>
      </view>
      <view class="primary-btn" hover-class="btn-hover" @tap="nextOrComplete">
        <text>{{ !legacyMode ? '开始学习' : step === 3 ? '保存设置' : '继续' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { BRAND } from '@/config/brand.js';
import { computed, ref, onBeforeUnmount } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { storageService } from '@/services/storageService.js';
import { openHomeTab } from '@/utils/home-navigation.js';

const step = ref(0);
const legacyMode = ref(false);
let active = true;
const navigationTimers = new Set();
onBeforeUnmount(() => {
  active = false;
  for (const timer of navigationTimers) clearTimeout(timer);
  navigationTimers.clear();
});
function returnHome() {
  if (!active) return;
  for (const timer of navigationTimers) clearTimeout(timer);
  navigationTimers.clear();
  openHomeTab({
    isCurrent: () => active,
    schedule(callback, delay) {
      if (!active) return;
      const timer = setTimeout(() => {
        navigationTimers.delete(timer);
        if (active) callback();
      }, delay);
      navigationTimers.add(timer);
    }
  });
}
onLoad((options) => {
  legacyMode.value = options?.source === 'home';
  if (!legacyMode.value) skipOnboarding();
});
const dailyGoal = ref(25);
const selectedTracks = ref(['politics', 'english1', 'math1']);

const trackGroups = [
  {
    subject: 'politics',
    label: '政治',
    options: [{ id: 'politics', label: '政治 101' }]
  },
  {
    subject: 'english',
    label: '英语',
    options: [
      { id: 'english1', label: '英语一 201' },
      { id: 'english2', label: '英语二 204' }
    ]
  },
  {
    subject: 'math',
    label: '数学',
    options: [
      { id: 'math1', label: '数学一 301' },
      { id: 'math2', label: '数学二 302' },
      { id: 'math3', label: '数学三 303' }
    ]
  }
];

const goalOptions = [
  { count: 15, label: '轻量', time: '约 10 分钟' },
  { count: 25, label: '稳态', time: '约 18 分钟' },
  { count: 40, label: '强化', time: '约 30 分钟' },
  { count: 60, label: '冲刺', time: '约 45 分钟' }
];

const previewPapers = [
  { label: '政治 2025', state: 'pending', stateText: '核对来源' },
  { label: '政治 2024', state: 'pending', stateText: '核对来源' },
  { label: '英语一/二 2025', state: 'pending', stateText: '补篇章' },
  { label: '数学一/二/三 2025', state: 'pending', stateText: '完善中' }
];

const progressPercent = computed(() => (legacyMode.value ? ((step.value + 1) / 4) * 100 : 100));

const selectedTrackLabels = computed(() => {
  const labels = [];
  for (const group of trackGroups) {
    for (const option of group.options) {
      if (selectedTracks.value.includes(option.id)) labels.push(option.label.replace(/\s\d+$/, ''));
    }
  }
  return labels;
});

function isTrackSelected(id) {
  return selectedTracks.value.includes(id);
}

function selectTrack(subject, id) {
  if (subject === 'politics') {
    selectedTracks.value = Array.from(new Set([...selectedTracks.value, 'politics']));
    return;
  }

  const group = trackGroups.find((item) => item.subject === subject);
  const groupIds = new Set((group?.options || []).map((item) => item.id));
  selectedTracks.value = selectedTracks.value.filter((trackId) => !groupIds.has(trackId));
  selectedTracks.value.push(id);
}

function prevStep() {
  if (step.value > 0) step.value -= 1;
}

function nextOrComplete() {
  if (legacyMode.value && step.value < 3) {
    step.value += 1;
    return;
  }
  completeOnboarding();
}

function saveOnboardingData(completed = true) {
  storageService.save('onboarding_completed', completed);
  if (!legacyMode.value) return;
  const profile = {
    exam: 'kaoyan',
    targetYear: 2027,
    tracks: selectedTracks.value
  };
  storageService.save('exam_type', 'kaoyan');
  storageService.save('exam_profile', profile);
  storageService.save('daily_goal', dailyGoal.value);
}

function completeOnboarding() {
  saveOnboardingData(true);
  returnHome();
}

function skipOnboarding() {
  storageService.save('onboarding_completed', true);
  returnHome();
}
</script>

<style lang="scss" scoped>
$primary: var(--primary, #785bbc);
$ink: var(--text-primary, #080909);
$muted: var(--text-secondary, #62576d);
$paper: var(--bg-page, #f0eefa);
$surface: var(--bg-card, #ffffff);
$line: var(--border, rgba(98, 87, 109, 0.12));

.onboarding-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top, 44px) + 28rpx) 34rpx 42rpx;
  background: $paper;
  color: $ink;
  font-family:
    'DM Sans',
    -apple-system,
    BlinkMacSystemFont,
    'PingFang SC',
    'Microsoft YaHei',
    sans-serif;
  max-width: 840px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  align-items: center;
}

.progress-track {
  flex: 1;
  height: 8rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--bg-secondary, #eeeaf6);
}

.progress-fill {
  height: 100%;
  border-radius: 999rpx;
  background: $primary;
  transition-property: width;
  transition-duration: 260ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.skip {
  margin-left: 22rpx;
  color: $muted;
  font-size: 26rpx;
  font-weight: 650;
}

.brand-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 42rpx;
}

.brand {
  font-size: 30rpx;
  font-weight: 900;
  letter-spacing: 1.8rpx;
}

.step-count {
  color: $muted;
  font-size: 24rpx;
  font-weight: 700;
}

.panel {
  min-height: 760rpx;
  margin-top: 28rpx;
  padding: 38rpx 34rpx;
  border-radius: 34rpx;
  background: $surface;
  box-shadow: 0 18rpx 52rpx rgba(98, 87, 109, 0.08);
}

.eyebrow {
  display: block;
  color: $muted;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.title {
  display: block;
  margin-top: 18rpx;
  color: $ink;
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.16;
}

.desc {
  display: block;
  margin-top: 18rpx;
  color: $muted;
  font-size: 27rpx;
  line-height: 1.55;
}

.exam-card,
.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 48rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  background: var(--bg-secondary, #eeeaf6);
  box-shadow: inset 0 0 0 1rpx $line;
}

.exam-card.selected {
  background: var(--bg-secondary, #eeeaf6);
}

.exam-card-main {
  display: flex;
  flex-direction: column;
}

.exam-name,
.summary-value {
  color: $ink;
  font-size: 31rpx;
  font-weight: 850;
  line-height: 1.3;
}

.exam-desc,
.summary-sub {
  margin-top: 8rpx;
  color: $muted;
  font-size: 24rpx;
  line-height: 1.45;
}

.exam-status {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: $primary;
  color: var(--primary-foreground, #ffffff);
  font-size: 22rpx;
  font-weight: 850;
}

.track-group {
  margin-top: 34rpx;
}

.track-title {
  display: block;
  margin-bottom: 14rpx;
  color: $ink;
  font-size: 27rpx;
  font-weight: 800;
}

.track-options {
  display: flex;
  flex-wrap: wrap;
}

.track-chip {
  margin-right: 14rpx;
  margin-bottom: 14rpx;
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  background: var(--bg-secondary, #eeeaf6);
  color: $muted;
  font-size: 25rpx;
  font-weight: 750;
}

.track-chip.selected {
  background: $primary;
  color: var(--primary-foreground, #ffffff);
  box-shadow: 0 12rpx 28rpx rgba(120, 91, 188, 0.14);
}

.goal-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 42rpx;
}

.goal-card {
  box-sizing: border-box;
  width: calc(50% - 10rpx);
  margin-bottom: 20rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  background: var(--bg-secondary, #eeeaf6);
  box-shadow: inset 0 0 0 1rpx $line;
}

.goal-card:nth-child(odd) {
  margin-right: 20rpx;
}

.goal-card.selected {
  background: $primary;
}

.goal-count {
  display: block;
  color: $ink;
  font-size: 52rpx;
  font-weight: 900;
  line-height: 1;
}

.goal-card.selected .goal-count,
.goal-card.selected .goal-label,
.goal-card.selected .goal-time {
  color: var(--primary-foreground, #ffffff);
}

.goal-label {
  display: block;
  margin-top: 16rpx;
  color: $ink;
  font-size: 28rpx;
  font-weight: 800;
}

.goal-time {
  display: block;
  margin-top: 8rpx;
  color: $muted;
  font-size: 23rpx;
}

.paper-preview {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 40rpx;
  border-radius: 30rpx;
  background: #332842;
  padding: 24rpx;
}

.paper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68rpx;
  border-radius: 18rpx;
  padding: 0 22rpx;
  background: rgba(255, 255, 255, 0.08);
}

.paper-row.ready {
  background: rgba(201, 177, 238, 0.16);
}

.paper-label {
  color: rgba(255, 255, 255, 0.92);
  font-size: 25rpx;
  font-weight: 850;
}

.paper-state {
  color: rgba(255, 255, 255, 0.58);
  font-size: 22rpx;
  font-weight: 800;
}

.summary-card {
  align-items: flex-start;
  flex-direction: column;
  margin-top: 24rpx;
}

.summary-label {
  color: $muted;
  font-size: 20rpx;
  font-weight: 850;
  letter-spacing: 1rpx;
}

.summary-value {
  margin-top: 8rpx;
}

.welcome-note {
  margin-top: 48rpx;
  padding: 30rpx;
}

.actions {
  display: flex;
  margin-top: 30rpx;
}

.primary-btn,
.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  border-radius: 999rpx;
  transition-property: transform, opacity;
  transition-duration: 180ms;
}

.primary-btn {
  flex: 1;
  background: $primary;
  box-shadow: 0 18rpx 38rpx rgba(120, 91, 188, 0.18);
}

.primary-btn text {
  color: var(--primary-foreground, #ffffff);
  font-size: 30rpx;
  font-weight: 850;
}

.secondary-btn {
  width: 178rpx;
  margin-right: 18rpx;
  background: var(--bg-secondary, #eeeaf6);
}

.secondary-btn text {
  color: $ink;
  font-size: 28rpx;
  font-weight: 750;
}

.btn-hover {
  opacity: 0.88;
  transform: scale(0.97);
}
</style>
