<template>
  <view class="onboarding-page">
    <view class="topbar">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </view>
      <text class="skip" @tap="skipOnboarding">跳过</text>
    </view>

    <view class="brand-line">
      <text class="brand">EXAM-MASTER</text>
      <text class="step-count">{{ step + 1 }} / 4</text>
    </view>

    <view class="panel">
      <view v-if="step === 0" class="step">
        <text class="eyebrow">START PATH</text>
        <text class="title">先确定你的备考路径</text>
        <text class="desc">小程序会根据路径分配公共课题库、每日目标和知识图谱节点。</text>

        <view class="exam-card selected">
          <view class="exam-card-main">
            <text class="exam-name">2027 考研公共课</text>
            <text class="exam-desc">政治、英语、数学按你选择的版本进入训练</text>
          </view>
          <text class="exam-status">已选择</text>
        </view>
      </view>

      <view v-else-if="step === 1" class="step">
        <text class="eyebrow">PUBLIC COURSES</text>
        <text class="title">选择你要训练的公共课</text>
        <text class="desc">后续题库、错题复习和知识图谱都按这里的轨道归档。</text>

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
        <text class="eyebrow">DAILY RHYTHM</text>
        <text class="title">设定每天的训练强度</text>
        <text class="desc">建议从 25 题开始，既能形成节奏，也不会让前几天过载。</text>

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
        <text class="eyebrow">KNOWLEDGE MAP</text>
        <text class="title">知识图谱会从第一题开始点亮</text>
        <text class="desc">答对、答错、用时都会沉淀到对应知识节点，用来安排下一轮复习。</text>

        <view class="map-preview">
          <view v-for="line in previewLines" :key="line.id" class="map-line" :style="line.style" />
          <view
            v-for="node in previewNodes"
            :key="node.id"
            class="map-node"
            :class="node.tone"
            :style="{ left: node.x + '%', top: node.y + '%' }"
          >
            <text>{{ node.label }}</text>
          </view>
        </view>

        <view class="summary-card">
          <text class="summary-label">已配置</text>
          <text class="summary-value">{{ selectedTrackLabels.join(' / ') }}</text>
          <text class="summary-sub">{{ dailyGoal }} 题/天，优先进入限时训练</text>
        </view>
      </view>
    </view>

    <view class="actions">
      <view v-if="step > 0" class="secondary-btn" hover-class="btn-hover" @tap="prevStep">
        <text>上一步</text>
      </view>
      <view class="primary-btn" hover-class="btn-hover" @tap="nextOrComplete">
        <text>{{ step === 3 ? '进入 EXAM-MASTER' : '继续' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store.js';

const step = ref(0);
const dailyGoal = ref(25);
const selectedTracks = ref(['politics', 'english1', 'math1']);
const learningTrajectoryStore = useLearningTrajectoryStore();

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

const previewNodes = [
  { id: 'p', label: '政治', x: 14, y: 42, tone: 'primed' },
  { id: 'e', label: '英语', x: 42, y: 20, tone: 'unknown' },
  { id: 'm', label: '数学', x: 72, y: 45, tone: 'strong' },
  { id: 'r', label: '阅读', x: 36, y: 68, tone: 'watch' },
  { id: 'c', label: '高数', x: 62, y: 78, tone: 'unknown' }
];

const previewLines = [
  { id: 'a', style: { left: '22%', top: '42%', width: '170rpx', transform: 'rotate(-22deg)' } },
  { id: 'b', style: { left: '48%', top: '32%', width: '160rpx', transform: 'rotate(18deg)' } },
  { id: 'c', style: { left: '41%', top: '58%', width: '190rpx', transform: 'rotate(18deg)' } }
];

const progressPercent = computed(() => ((step.value + 1) / 4) * 100);

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
  if (step.value < 3) {
    step.value += 1;
    return;
  }
  completeOnboarding();
}

function saveOnboardingData(completed = true) {
  const profile = {
    exam: 'kaoyan',
    targetYear: 2027,
    tracks: selectedTracks.value
  };
  storageService.save('onboarding_completed', completed);
  storageService.save('exam_type', 'kaoyan');
  storageService.save('exam_profile', profile);
  storageService.save('daily_goal', dailyGoal.value);
  learningTrajectoryStore.setExamProfile(profile);
}

function completeOnboarding() {
  saveOnboardingData(true);
  uni.switchTab({ url: '/pages/index/index' });
}

function skipOnboarding() {
  saveOnboardingData(true);
  uni.switchTab({ url: '/pages/index/index' });
}
</script>

<style lang="scss" scoped>
$primary: #9fe870;
$ink: #142017;
$muted: #6e776f;
$paper: #fcfdf8;
$surface: #ffffff;
$line: rgba(20, 32, 23, 0.08);

.onboarding-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top, 44px) + 28rpx) 34rpx 42rpx;
  background: linear-gradient(180deg, #fcfdf8 0%, #f2f5ee 100%);
  color: $ink;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', sans-serif;
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
  background: rgba(20, 32, 23, 0.08);
}

.progress-fill {
  height: 100%;
  border-radius: 999rpx;
  background: #27b45f;
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
  box-shadow: 0 18rpx 52rpx rgba(20, 32, 23, 0.08);
}

.eyebrow {
  display: block;
  color: rgba(20, 32, 23, 0.44);
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
  background: #f6f8f2;
  box-shadow: inset 0 0 0 1rpx $line;
}

.exam-card.selected {
  background: #f1f8ea;
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
  color: #102415;
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
  background: #f4f5f1;
  color: $muted;
  font-size: 25rpx;
  font-weight: 750;
}

.track-chip.selected {
  background: #102415;
  color: #f8fff2;
  box-shadow: 0 12rpx 28rpx rgba(16, 36, 21, 0.14);
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
  background: #f6f7f2;
  box-shadow: inset 0 0 0 1rpx $line;
}

.goal-card:nth-child(odd) {
  margin-right: 20rpx;
}

.goal-card.selected {
  background: #102415;
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
  color: #f8fff2;
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

.map-preview {
  position: relative;
  height: 360rpx;
  margin-top: 40rpx;
  overflow: hidden;
  border-radius: 30rpx;
  background: linear-gradient(145deg, #102415, #17261d);
}

.map-line {
  position: absolute;
  height: 2rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
  transform-origin: left center;
}

.map-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: 999rpx;
  transform: translate3d(-50%, -50%, 0);
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.22);
}

.map-node text {
  color: #102415;
  font-size: 22rpx;
  font-weight: 900;
}

.map-node.unknown {
  background: #dde8dd;
}

.map-node.primed {
  background: #ffffff;
}

.map-node.strong {
  background: $primary;
}

.map-node.watch {
  background: #ffd166;
}

.summary-card {
  align-items: flex-start;
  flex-direction: column;
  margin-top: 24rpx;
}

.summary-label {
  color: rgba(20, 32, 23, 0.44);
  font-size: 20rpx;
  font-weight: 850;
  letter-spacing: 1rpx;
}

.summary-value {
  margin-top: 8rpx;
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
  background: #102415;
  box-shadow: 0 18rpx 38rpx rgba(16, 36, 21, 0.18);
}

.primary-btn text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 850;
}

.secondary-btn {
  width: 178rpx;
  margin-right: 18rpx;
  background: rgba(20, 32, 23, 0.06);
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
