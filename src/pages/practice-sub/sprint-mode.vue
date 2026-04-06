<template>
  <view class="sprint-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back-arrow" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">冲刺模式</text>
      <view class="nav-right" />
    </view>

    <scroll-view
      class="main-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 加载骨架 -->
      <view v-if="loading" class="loading-state">
        <view class="skeleton-card" />
        <view class="skeleton-card short" />
        <view class="skeleton-card short" />
      </view>

      <view v-else>
        <!-- Hero 倒计时 -->
        <view class="hero-card apple-glass-card">
          <view class="hero-left">
            <view class="ring-wrap">
              <WdCircle
                :model-value="overallProgress"
                :size="90"
                :stroke-width="7"
                :color="progressColor"
                layer-color="rgba(255,255,255,0.06)"
                :speed="80"
              >
                <view class="ring-inner">
                  <text class="ring-num">{{ daysRemaining }}</text>
                  <text class="ring-label">天</text>
                </view>
              </WdCircle>
            </view>
          </view>
          <view class="hero-right">
            <text class="hero-title">距考试还剩</text>
            <text class="hero-sub">{{ strategyText }}</text>
            <view class="hero-tags">
              <view class="hero-tag tag-must">
                <text class="tag-text">必做 {{ mustDoCount }}</text>
              </view>
              <view class="hero-tag tag-should">
                <text class="tag-text">建议 {{ shouldDoCount }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Sprint Items -->
        <view
          v-for="(item, idx) in sprintItems"
          :key="item.knowledgePoint + idx"
          class="sprint-card apple-glass-card"
          :style="{ animationDelay: idx * 0.06 + 's' }"
        >
          <view class="sprint-header">
            <text class="sprint-kp">{{ item.knowledgePoint }}</text>
            <view class="priority-badge" :class="'priority-' + item.priority">
              <text class="priority-text">{{ priorityLabel(item.priority) }}</text>
            </view>
          </view>

          <view class="sprint-mastery">
            <text class="mastery-label">掌握度 {{ item.mastery || 0 }}%</text>
            <WdProgress
              :percentage="item.mastery || 0"
              :color="getMasteryColor(item.mastery || 0)"
              :show-text="false"
              :stroke-width="6"
            />
          </view>

          <view class="sprint-meta">
            <view class="roi-badge">
              <text class="roi-text">ROI {{ item.roi || '-' }}</text>
            </view>
          </view>

          <text v-if="item.reason" class="sprint-reason">{{ item.reason }}</text>

          <WdButton
            v-if="item.priority !== 'skip'"
            size="small"
            type="primary"
            custom-style="margin-top: 20rpx; border-radius: 999rpx;"
            @click="startSprint(item)"
          >
            开始冲刺
          </WdButton>
        </view>

        <!-- 空状态 -->
        <view v-if="sprintItems.length === 0" class="empty-state">
          <!-- 卡通图标替代装饰性 BaseIcon -->
          <image class="hero-cartoon-icon" src="/static/icons/target-bullseye.png" mode="aspectFit" />
          <text class="empty-title">请先设置考试日期</text>
          <text class="empty-sub">设置后 AI 将生成最优冲刺优先级</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdCircle from 'wot-design-uni/components/wd-circle/wd-circle.vue';
import WdProgress from 'wot-design-uni/components/wd-progress/wd-progress.vue';
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { useStudyEngineStore } from '@/stores/modules/study-engine';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const isDark = ref(initTheme());
const studyEngineStore = useStudyEngineStore();
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);

const daysRemaining = ref(0);
const strategyText = ref('');
const overallProgress = ref(0);
const sprintItems = ref([]);

// [AUDIT FIX R135] 单次遍历同时计算两种优先级数量，避免重复 filter
const priorityCounts = computed(() => {
  let mustDo = 0;
  let shouldDo = 0;
  for (const i of sprintItems.value) {
    if (i.priority === 'must_do') mustDo++;
    else if (i.priority === 'should_do') shouldDo++;
  }
  return { mustDo, shouldDo };
});
const mustDoCount = computed(() => priorityCounts.value.mustDo);
const shouldDoCount = computed(() => priorityCounts.value.shouldDo);

const progressColor = computed(() => {
  if (daysRemaining.value <= 7) return '#ff453a';
  if (daysRemaining.value <= 30) return '#ff9f0a';
  return '#34c759';
});

function priorityLabel(p) {
  const map = { must_do: '必做', should_do: '建议', nice_to_have: '选做', skip: '跳过' };
  return map[p] || p;
}

function getMasteryColor(mastery) {
  if (mastery >= 80) return 'var(--success, #34C759)';
  if (mastery >= 50) return 'var(--warning, #FF9500)';
  return 'var(--danger, var(--danger))';
}

function getExamDate() {
  try {
    return uni.getStorageSync('exam_date') || '';
  } catch {
    return '';
  }
}

async function loadData() {
  loading.value = true;
  try {
    const examDate = getExamDate();
    if (!examDate) {
      loading.value = false;
      return;
    }
    const result = await studyEngineStore.getSprintPriority(examDate);
    if (result.success && result.data) {
      daysRemaining.value = result.data.daysRemaining || 0;
      strategyText.value = result.data.strategy || '';
      overallProgress.value = result.data.overallProgress || 0;
      sprintItems.value = result.data.items || [];
    }
  } catch (e) {
    logger.warn('[SprintMode] 加载失败:', e);
    toast.info('加载失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  isRefreshing.value = true;
  await loadData();
  isRefreshing.value = false;
}

function startSprint(item) {
  safeNavigateTo('/pages/practice-sub/do-quiz', {
    mode: 'sprint',
    knowledgePoint: item.knowledgePoint
  });
}

function goBack() {
  safeNavigateBack();
}

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  loadData();
});
</script>

<style scoped>
.sprint-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --red: var(--danger, #ff453a);
  --orange: var(--warning, #ff9f0a);
  --blue: var(--info);
  --green: var(--success, #34c759);
}
.sprint-container.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
}
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, rgba(28, 176, 246, 0.16) 0%, transparent 40%),
    radial-gradient(circle at 82% 10%, rgba(28, 176, 246, 0.08) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.9;
  z-index: 0;
}
.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 18% 24%, rgba(255, 159, 10, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 82% 10%, rgba(100, 160, 255, 0.1) 0%, transparent 30%);
}
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  -webkit-backdrop-filter: saturate(180%) blur(40rpx);
  backdrop-filter: saturate(180%) blur(40rpx);
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.nav-back-arrow {
  font-size: 36rpx;
  color: var(--text-primary);
  padding: 20rpx;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.nav-right {
  width: 48rpx;
}
.main-scroll {
  padding: 160rpx 32rpx 80rpx;
  position: relative;
  z-index: 1;
}

/* 骨架 */
.loading-state {
  padding-top: 40rpx;
}
.skeleton-card {
  height: 200rpx;
  border-radius: 32rpx;
  margin-bottom: 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton-card.short {
  height: 140rpx;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

/* 玻璃卡片 */
.apple-glass-card {
  background: var(--bg-card);
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .apple-glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Hero */
.hero-card {
  display: flex;
  align-items: center;
  /* gap: 32rpx; -- replaced for MP WebView compat */
  padding: 40rpx;
}
.hero-left {
  flex-shrink: 0;
}
.ring-wrap {
  position: relative;
  width: 180rpx;
  height: 180rpx;
}
.ring-inner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-num {
  font-size: 52rpx;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ring-label {
  font-size: 20rpx;
  color: var(--text-secondary, #8e8e93);
  margin-top: 2rpx;
}
.hero-right {
  flex: 1;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
}
.hero-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.5;
}
.hero-tags {
  display: flex;
  /* gap: 16rpx; -- replaced for MP WebView compat */
  margin-top: 20rpx;
}
.hero-tag {
  display: flex;
  align-items: center;
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
}
.tag-must {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
.tag-should {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}
.tag-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}
.tag-must .tag-text {
  color: var(--red);
}
.tag-should .tag-text {
  color: var(--orange);
}

/* Sprint Cards */
.sprint-card {
  padding: 28rpx;
  animation: fadeSlideIn 0.3s ease-out both;
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateX(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.sprint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.sprint-kp {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}
.priority-badge {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.priority-must_do {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
.priority-should_do {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}
.priority-nice_to_have {
  background: rgba(50, 173, 230, 0.12);
}
.priority-skip {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.priority-text {
  font-size: 22rpx;
  font-weight: 600;
}
.priority-must_do .priority-text {
  color: var(--red);
}
.priority-should_do .priority-text {
  color: var(--orange);
}
.priority-nice_to_have .priority-text {
  color: var(--blue);
}
.priority-skip .priority-text {
  color: var(--text-tertiary, #c7c7cc);
}

.sprint-mastery {
  margin-bottom: 12rpx;
}
.mastery-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 8rpx;
}
.sprint-meta {
  display: flex;
  /* gap: 12rpx; -- replaced for MP WebView compat */
  margin-bottom: 12rpx;
}
.roi-badge {
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.dark-mode .roi-badge {
  background: rgba(255, 255, 255, 0.06);
}
.roi-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.sprint-reason {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  display: block;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
/* 英雄级卡通图标（替代 BaseIcon size>=80） */
.hero-cartoon-icon {
  width: 160rpx;
  height: 160rpx;
}
.empty-icon {
  font-size: 96rpx;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 32rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
}
</style>
