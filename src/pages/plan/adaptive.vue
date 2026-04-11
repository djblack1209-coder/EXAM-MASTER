<template>
  <view class="adaptive-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">自适应计划</text>
      <view class="nav-right" />
    </view>

    <!-- ==================== AI 生成动画遮罩 ==================== -->
    <AiGenerationOverlay
      :visible="isGenerating"
      file-name="学习计划"
      :generated-count="genProgress"
      :total-questions-limit="1"
      :batch-question-count="1"
      :current-soup="genTip"
    />

    <scroll-view
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- ==================== 骨架屏 ==================== -->
      <view v-if="loading && !isGenerating" class="skel-area">
        <view class="skel-card skel-tall" />
        <view class="skel-card" />
        <view class="skel-card" />
        <view class="skel-card skel-short" />
      </view>

      <template v-else-if="!isGenerating">
        <!-- ==================== 离线模式横幅 ==================== -->
        <view v-if="isOfflineMode" class="offline-banner glass-card">
          <BaseIcon name="wifi-off" :size="28" />
          <text class="offline-text">离线模式 — 上次同步: {{ offlineSyncLabel }}</text>
        </view>

        <!-- ==================== 阶段进度条 ==================== -->
        <view v-if="currentPhase && hasPlan" class="phase-progress-card glass-card">
          <view class="phase-progress-header">
            <text class="phase-current-label">当前阶段</text>
            <view class="phase-current-badge" :class="'phase-' + currentPhase.type">
              <text class="phase-badge-text">{{ currentPhase.label }}</text>
            </view>
          </view>
          <view class="phase-bar-row">
            <view
              v-for="seg in phaseSegments"
              :key="seg.type"
              class="phase-seg"
              :class="{ 'seg-active': seg.active, 'seg-done': seg.done }"
            >
              <view class="seg-fill" :class="'seg-' + seg.type" :style="{ width: seg.fillPct + '%' }" />
            </view>
          </view>
          <view class="phase-labels">
            <text
              v-for="seg in phaseSegments"
              :key="seg.type"
              class="phase-seg-label"
              :class="{ 'label-active': seg.active }"
              >
{{ seg.label }}
</text
            >
          </view>
        </view>

        <!-- ==================== Hero 总览 ==================== -->
        <view v-if="hasPlan" class="hero-card glass-card">
          <text class="hero-title">{{ planData.summary || '个性化学习计划' }}</text>
          <text class="hero-sub">{{ planData.description || 'AI 根据你的掌握度动态调整' }}</text>
          <!-- 计划有效期提示 -->
          <view v-if="planAgeLabel" class="plan-age-row">
            <BaseIcon name="timer" :size="24" />
            <text class="plan-age-text">{{ planAgeLabel }}</text>
          </view>
        </view>

        <!-- ==================== 操作按钮区 ==================== -->
        <view v-if="hasPlan" class="action-bar">
          <WdButton
            type="primary"
            block
            custom-style="border-radius: 999rpx; font-weight: 700;"
            @click="startTodayTasks"
          >
            开始今日任务
          </WdButton>
          <WdButton plain block custom-style="margin-top: 16rpx; border-radius: 999rpx;" @click="adjustPlan">
            调整计划（重新生成）
          </WdButton>
        </view>

        <!-- ==================== 7天计划卡片 ==================== -->
        <view v-if="dailyPlans.length > 0" class="section">
          <text class="section-title">7天学习计划</text>

          <view
            v-for="(day, dIdx) in dailyPlans"
            :key="day.date"
            :class="['day-card', 'glass-card', { 'day-today': day.isToday, 'day-past': day.isPast }]"
            :style="{ animationDelay: dIdx * 0.06 + 's' }"
          >
            <!-- 日期标签行 -->
            <view class="day-header">
              <view class="day-label-row">
                <text class="day-date-label">{{ day.dateLabel }}</text>
                <text v-if="day.isToday" class="today-badge">今天</text>
              </view>
              <text class="day-total">{{ day.totalMinutes }}分钟</text>
            </view>

            <!-- 任务列表 -->
            <view v-for="(task, tIdx) in day.tasks" :key="task.knowledgePoint + tIdx" class="task-item">
              <view class="task-header">
                <view class="ta<REDACTED_SECRET>">
                  <text class="task-kp">{{ task.knowledgePoint }}</text>
                  <view v-if="task.mastery != null" class="ta<REDACTED_SECRET>">
                    <view class="mini-bar-bg">
                      <view
                        class="mini-bar-fill"
                        :style="{ width: task.mastery + '%', background: masteryColor(task.mastery) }"
                      />
                    </view>
                    <text class="mini-bar-text">{{ task.mastery }}%</text>
                  </view>
                </view>
                <view class="action-badge" :class="'action-' + task.action">
                  <text class="action-text">{{ actionLabel(task.action) }}</text>
                </view>
              </view>

              <view class="task-meta">
                <text v-if="task.durationMinutes" class="meta-text">{{ task.durationMinutes }}分钟</text>
                <text v-if="task.questionCount" class="meta-text">{{ task.questionCount }}题</text>
                <text v-if="task.reason" class="meta-reason">{{ task.reason }}</text>
              </view>

              <!-- 仅今天的任务显示开始按钮 -->
              <WdButton
                v-if="day.isToday"
                size="small"
                type="primary"
                custom-style="margin-top: 16rpx; border-radius: 999rpx;"
                @click="startTask(task)"
              >
                开始学习
              </WdButton>
            </view>
          </view>
        </view>

        <!-- ==================== 阶段时间线 ==================== -->
        <view v-if="phases.length > 0" class="section">
          <text class="section-title">学习阶段</text>
          <view class="timeline">
            <view v-for="(phase, idx) in phases" :key="phase.name" class="tl-item">
              <view class="tl-dot-col">
                <view class="tl-dot" :class="'dot-' + phase.type" />
                <view v-if="idx < phases.length - 1" class="tl-line" />
              </view>
              <view class="tl-content glass-card">
                <view class="tl-header">
                  <text class="tl-name">{{ phase.name }}</text>
                  <view class="tl-type-badge" :class="'phase-' + phase.type">
                    <text class="tl-type-text">{{ phaseLabel(phase.type) }}</text>
                  </view>
                </view>
                <text class="tl-date">{{ phase.startDate }} — {{ phase.endDate }}</text>
                <text v-if="phase.description || phase.focus" class="tl-desc">
{{
                  phase.description || phase.focus
                }}
</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ==================== 空状态 ==================== -->
        <view v-if="!hasPlan && !loading" class="empty-state">
          <image class="hero-cartoon-icon" src="./static/icons/notebook-pen.png" mode="aspectFit" alt="笔记本与笔" />
          <text class="empty-title">暂无自适应计划</text>
          <text class="empty-sub">请先设置考试日期和每日学习时长</text>
          <WdButton type="primary" custom-style="margin-top: 40rpx; border-radius: 999rpx;" @click="handleGenerate">
            生成计划
          </WdButton>
        </view>

        <!-- ==================== 到期提示 ==================== -->
        <view v-if="isExpired && hasPlan" class="expired-banner glass-card">
          <BaseIcon name="refresh" :size="28" />
          <view class="expired-info">
            <text class="expired-title">计划已到期</text>
            <text class="expired-sub">上次生成于 {{ planAgeLabel }}，建议重新生成</text>
          </view>
          <WdButton size="small" type="primary" custom-style="border-radius: 999rpx;" @click="adjustPlan">
            重新生成
          </WdButton>
        </view>
      </template>

      <view class="bottom-safe" />
    </scroll-view>

    <!-- 离线状态指示器（全局 easycom 注册，无需导入） -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script setup>
// ==================== 组件导入 ====================
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { useStudyEngineStore } from '@/stores/modules/study-engine';
import { useTodoStore } from '@/stores/modules/todo.js';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { storageService } from '@/services/storageService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import AiGenerationOverlay from '@/components/business/practice/AiGenerationOverlay.vue';

// ==================== 常量 ====================

const CACHE_KEY = 'adaptive_plan_cache';
const CACHE_MAX_AGE_DAYS = 7;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const GEN_TIPS = [
  '正在分析你的答题数据...',
  '正在识别薄弱知识点...',
  '正在计算最优学习路径...',
  '正在生成每日任务分配...',
  '即将完成，请稍候...'
];

// ==================== Store ====================

const studyEngineStore = useStudyEngineStore();
const todoStore = useTodoStore();

// ==================== 响应式状态 ====================

const isDark = ref(initTheme());
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);

// 生成动画
const isGenerating = ref(false);
const genProgress = ref(0);
const genTip = ref(GEN_TIPS[0]);
let _genTipTimer = null;

// 计划数据
const planData = ref({});
const phases = ref([]);
const dailyPlans = ref([]);
const cacheCreatedAt = ref(0);

// 离线状态
const isOfflineMode = ref(false);

// ==================== 计算属性 ====================

const _todayStr = new Date().toISOString().split('T')[0];

const hasPlan = computed(() => dailyPlans.value.length > 0);

/** 计划年龄标签 */
const planAgeLabel = computed(() => {
  if (!cacheCreatedAt.value) return '';
  const days = Math.floor((Date.now() - cacheCreatedAt.value) / 86400000);
  if (days === 0) return '今天生成';
  if (days === 1) return '1天前';
  return `${days}天前`;
});

/** 计划是否已到期（超过7天） */
const isExpired = computed(() => {
  if (!cacheCreatedAt.value) return false;
  return Date.now() - cacheCreatedAt.value > CACHE_MAX_AGE_DAYS * 86400000;
});

/** 离线同步标签 */
const offlineSyncLabel = computed(() => planAgeLabel.value || '未知');

/** 距考试天数 */
const examDaysLeft = computed(() => {
  const examDate = getExamDate();
  if (!examDate) return 999;
  const diff = new Date(examDate + 'T23:59:59').getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
});

/** 当前阶段信息 */
const currentPhase = computed(() => {
  const d = examDaysLeft.value;
  if (d > 90) return { type: 'foundation', label: '基础夯实' };
  if (d > 30) return { type: 'intensive', label: '强化提升' };
  if (d > 10) return { type: 'sprint', label: '冲刺备考' };
  return { type: 'mock', label: '模拟冲刺' };
});

/** 阶段进度条分段数据 */
const phaseSegments = computed(() => {
  const d = examDaysLeft.value;
  const segs = [
    { type: 'foundation', label: '基础', active: false, done: false, fillPct: 0 },
    { type: 'intensive', label: '强化', active: false, done: false, fillPct: 0 },
    { type: 'sprint', label: '冲刺', active: false, done: false, fillPct: 0 },
    { type: 'mock', label: '模拟', active: false, done: false, fillPct: 0 }
  ];

  if (d > 90) {
    segs[0].active = true;
    segs[0].fillPct = Math.round(Math.max(10, 100 - ((d - 90) / 90) * 100));
  } else if (d > 30) {
    segs[0].done = true;
    segs[0].fillPct = 100;
    segs[1].active = true;
    segs[1].fillPct = Math.round(Math.max(10, 100 - ((d - 30) / 60) * 100));
  } else if (d > 10) {
    segs[0].done = true;
    segs[0].fillPct = 100;
    segs[1].done = true;
    segs[1].fillPct = 100;
    segs[2].active = true;
    segs[2].fillPct = Math.round(Math.max(10, 100 - ((d - 10) / 20) * 100));
  } else {
    segs[0].done = true;
    segs[0].fillPct = 100;
    segs[1].done = true;
    segs[1].fillPct = 100;
    segs[2].done = true;
    segs[2].fillPct = 100;
    segs[3].active = true;
    segs[3].fillPct = Math.round(Math.max(10, 100 - (d / 10) * 100));
  }
  return segs;
});

// ==================== 工具函数 ====================

function getExamDate() {
  try {
    return uni.getStorageSync('exam_date') || '';
  } catch {
    return '';
  }
}

function getDailyHours() {
  try {
    return Number(uni.getStorageSync('daily_study_hours')) || 4;
  } catch {
    return 4;
  }
}

function phaseLabel(type) {
  return { foundation: '基础', intensive: '强化', sprint: '冲刺', mock: '模考' }[type] || type;
}

function actionLabel(action) {
  return (
    { new_learn: '新学', review: '复习', drill: '错题巩固', mock: '模拟', error_review: '错题巩固' }[action] || action
  );
}

function actionTagColor(action) {
  return { new_learn: 'green', review: 'blue', drill: 'orange', mock: 'red', error_review: 'orange' }[action] || 'gray';
}

function masteryColor(val) {
  if (val >= 80) return '#34c759';
  if (val >= 50) return '#ff9f0a';
  return '#ff453a';
}

/** 将日期字符串格式化为友好标签 */
function formatDateLabel(dateStr) {
  const today = new Date();
  const todayS = today.toISOString().split('T')[0];
  const tomorrowS = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const dayAfterS = new Date(today.getTime() + 2 * 86400000).toISOString().split('T')[0];

  if (dateStr === todayS) return '今天';
  if (dateStr === tomorrowS) return '明天';
  if (dateStr === dayAfterS) return '后天';

  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

// ==================== 缓存管理 ====================

function loadCache() {
  try {
    const cached = storageService.get(CACHE_KEY, null);
    if (!cached || !cached.data || !cached.createdAt) return null;
    // 检查是否过期
    const ageMs = Date.now() - cached.createdAt;
    if (ageMs > CACHE_MAX_AGE_DAYS * 86400000) {
      logger.log('[AdaptivePlan] 缓存已过期，需要重新生成');
      return cached; // 仍然返回过期缓存（离线降级用）
    }
    return cached;
  } catch {
    return null;
  }
}

function saveCache(data) {
  const cache = {
    createdAt: Date.now(),
    examDate: getExamDate(),
    dailyHours: getDailyHours(),
    data
  };
  storageService.save(CACHE_KEY, cache, true);
  cacheCreatedAt.value = cache.createdAt;
}

function clearCache() {
  storageService.remove(CACHE_KEY, true);
  cacheCreatedAt.value = 0;
}

// ==================== 数据处理 ====================

/** 将后端返回的 dailyPlans 增强为带友好日期标签的格式 */
function enrichDailyPlans(plans) {
  if (!Array.isArray(plans)) return [];
  const today = new Date().toISOString().split('T')[0];

  return plans.slice(0, 7).map((day) => ({
    ...day,
    dateLabel: formatDateLabel(day.date),
    isToday: day.date === today,
    isPast: day.date < today,
    totalMinutes: day.totalMinutes || day.tasks?.reduce((s, t) => s + (t.durationMinutes || t.duration || 0), 0) || 0,
    tasks: (day.tasks || []).map((t) => ({
      ...t,
      durationMinutes: t.durationMinutes || t.duration || 0,
      mastery: t.mastery ?? null
    }))
  }));
}

/** 应用计划数据到响应式状态 */
function applyPlanData(data) {
  planData.value = data;
  phases.value = data.phases || [];
  dailyPlans.value = enrichDailyPlans(data.plans || data.dailyPlans || []);
}

// ==================== 生成动画 ====================

function startGenAnimation() {
  isGenerating.value = true;
  genProgress.value = 0;
  genTip.value = GEN_TIPS[0];

  let tipIdx = 0;
  _genTipTimer = setInterval(() => {
    tipIdx = (tipIdx + 1) % GEN_TIPS.length;
    genTip.value = GEN_TIPS[tipIdx];
  }, 2500);
}

function stopGenAnimation() {
  genProgress.value = 1;
  isGenerating.value = false;
  if (_genTipTimer) {
    clearInterval(_genTipTimer);
    _genTipTimer = null;
  }
}

// ==================== 核心流程 ====================

/** 页面加载时的完整流程 */
async function loadData() {
  loading.value = true;
  isOfflineMode.value = false;

  try {
    // 第1步：检查缓存
    const cached = loadCache();

    if (cached && cached.data) {
      cacheCreatedAt.value = cached.createdAt;
      applyPlanData(cached.data);

      // 缓存未过期 → 直接使用
      const ageMs = Date.now() - cached.createdAt;
      if (ageMs <= CACHE_MAX_AGE_DAYS * 86400000) {
        logger.log('[AdaptivePlan] 使用缓存计划');
        loading.value = false;
        return;
      }
      // 过期了但先展示旧数据，后台尝试更新
      logger.log('[AdaptivePlan] 缓存已过期，尝试后台更新');
    }

    // 第2步：无有效缓存，调用 API
    const examDate = getExamDate();
    if (!examDate) {
      loading.value = false;
      return;
    }

    await fetchPlanFromAPI(examDate);
  } catch (e) {
    logger.warn('[AdaptivePlan] 加载失败:', e);

    // 第3步：离线降级 — 使用过期缓存
    if (hasPlan.value) {
      isOfflineMode.value = true;
      toast.info('网络不可用，使用离线缓存计划');
    } else {
      toast.info('加载失败，请检查网络后重试');
    }
  } finally {
    loading.value = false;
  }
}

/** 调用后端 API 生成计划 */
async function fetchPlanFromAPI(examDate) {
  const dailyHours = getDailyHours();

  startGenAnimation();
  try {
    const result = await studyEngineStore.generateStudyPlan(examDate, dailyHours);

    if (result?.success !== false && result?.data) {
      applyPlanData(result.data);
      saveCache(result.data);
      logger.log('[AdaptivePlan] 计划生成成功，已缓存');
    } else {
      throw new Error(result?.message || '生成失败');
    }
  } finally {
    stopGenAnimation();
  }
}

/** 手动生成计划（空状态按钮） */
async function handleGenerate() {
  const examDate = getExamDate();
  if (!examDate) {
    toast.info('请先在设置中设定考试日期');
    return;
  }
  try {
    await fetchPlanFromAPI(examDate);
  } catch (e) {
    logger.warn('[AdaptivePlan] 手动生成失败:', e);
    toast.info('生成失败，请稍后重试');
  }
}

/** 调整计划（清缓存重新生成） */
async function adjustPlan() {
  clearCache();
  planData.value = {};
  phases.value = [];
  dailyPlans.value = [];

  const examDate = getExamDate();
  if (!examDate) {
    toast.info('请先设置考试日期');
    return;
  }
  try {
    await fetchPlanFromAPI(examDate);
    toast.success('计划已更新');
  } catch (e) {
    logger.warn('[AdaptivePlan] 调整计划失败:', e);
    toast.info('生成失败，请稍后重试');
  }
}

// ==================== 执行操作 ====================

/** 开始今日任务 → 写入 todoStore + 跳转刷题 */
function startTodayTasks() {
  const todayPlan = dailyPlans.value.find((d) => d.isToday);
  if (!todayPlan || !todayPlan.tasks || todayPlan.tasks.length === 0) {
    toast.info('今天没有待完成的任务');
    return;
  }

  // 批量写入 todoStore
  const todoTasks = todayPlan.tasks.map((t) => ({
    title: `${actionLabel(t.action)}: ${t.knowledgePoint} (${t.durationMinutes || '?'}分钟)`,
    priority: t.action === 'review' || t.action === 'drill' ? 'high' : 'medium',
    tag: actionLabel(t.action),
    tagColor: actionTagColor(t.action)
  }));

  todoStore.bulkAddTasks(todoTasks);
  logger.log(`[AdaptivePlan] 已写入 ${todoTasks.length} 个任务到 todoStore`);

  // 跳转刷题
  startTask(todayPlan.tasks[0]);
}

/** 开始单个任务 → 跳转 do-quiz */
function startTask(task) {
  safeNavigateTo(
    `/pages/practice-sub/do-quiz?mode=adaptive&knowledgePoint=${encodeURIComponent(task.knowledgePoint)}&action=${encodeURIComponent(task.action || '')}`
  );
}

/** 下拉刷新 */
async function onRefresh() {
  isRefreshing.value = true;
  await loadData();
  isRefreshing.value = false;
}

function goBack() {
  safeNavigateBack();
}

// ==================== 生命周期 ====================

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  todoStore.initTasks();
  loadData();
});
</script>

<style scoped>
/* ==================== 页面容器 ==================== */
.adaptive-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --c-red: var(--danger, #ff453a);
  --c-orange: var(--warning, #ff9f0a);
  --c-blue: var(--em-info, #32ade6);
  --c-green: #58cc02;
  --c-success: var(--success, #34c759);
}
.adaptive-container.dark-mode {
  background: linear-gradient(
    180deg,
    var(--background) 0%,
    var(--page-gradient-mid, var(--background)) 50%,
    var(--background) 100%
  );
}

/* ==================== 极光背景 ==================== */
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, color-mix(in srgb, var(--success) 22%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 82% 10%, rgba(255, 255, 255, 0.32) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.9;
  z-index: 0;
}
.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 18% 24%, rgba(52, 199, 89, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 82% 10%, rgba(100, 160, 255, 0.1) 0%, transparent 30%);
}

/* ==================== 导航栏 ==================== */
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
  background: var(--apple-glass-nav-bg, rgba(245, 245, 247, 0.72));
  border-bottom: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.06));
}
.dark-mode .top-nav {
  background: rgba(10, 10, 15, 0.72);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.nav-back {
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

/* ==================== 骨架屏 ==================== */
.skel-area {
  padding-top: 20rpx;
}
.skel-card {
  height: 160rpx;
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
}
.skel-tall {
  height: 220rpx;
}
.skel-short {
  height: 120rpx;
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

/* ==================== 通用玻璃卡片 ==================== */
.glass-card {
  background: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  -webkit-backdrop-filter: blur(20rpx);
  backdrop-filter: blur(20rpx);
}
.dark-mode .glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* ==================== 离线横幅 ==================== */
.offline-banner {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  background: color-mix(in srgb, var(--c-orange) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--c-orange) 25%, transparent);
}
.offline-text {
  font-size: 24rpx;
  color: var(--c-orange);
  margin-left: 12rpx;
  font-weight: 600;
}

/* ==================== 阶段进度条 ==================== */
.phase-progress-card {
  padding: 28rpx 32rpx;
}
.phase-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.phase-current-label {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.phase-current-badge {
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
}
.phase-badge-text {
  font-size: 22rpx;
  font-weight: 700;
}
.phase-foundation {
  background: rgba(50, 173, 230, 0.12);
}
.phase-intensive {
  background: color-mix(in srgb, var(--c-orange) 12%, transparent);
}
.phase-sprint {
  background: color-mix(in srgb, var(--c-red) 12%, transparent);
}
.phase-mock {
  background: color-mix(in srgb, var(--c-red) 18%, transparent);
}
.phase-foundation .phase-badge-text,
.phase-foundation .tl-type-text {
  color: var(--c-blue);
}
.phase-intensive .phase-badge-text,
.phase-intensive .tl-type-text {
  color: var(--c-orange);
}
.phase-sprint .phase-badge-text,
.phase-sprint .tl-type-text {
  color: var(--c-red);
}
.phase-mock .phase-badge-text,
.phase-mock .tl-type-text {
  color: var(--c-red);
}

.phase-bar-row {
  display: flex;
  height: 12rpx;
  border-radius: 6rpx;
  overflow: hidden;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.dark-mode .phase-bar-row {
  background: rgba(255, 255, 255, 0.06);
}
.phase-seg {
  flex: 1;
  position: relative;
  margin-right: 4rpx;
  overflow: hidden;
  border-radius: 3rpx;
}
.phase-seg:last-child {
  margin-right: 0;
}
.seg-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 3rpx;
  transition: width 0.6s ease;
}
.seg-foundation {
  background: var(--c-blue);
}
.seg-intensive {
  background: var(--c-orange);
}
.seg-sprint {
  background: var(--c-red);
}
.seg-mock {
  background: var(--c-red);
}
.seg-done .seg-fill {
  opacity: 0.4;
}
.phase-labels {
  display: flex;
  margin-top: 10rpx;
}
.phase-seg-label {
  flex: 1;
  text-align: center;
  font-size: 20rpx;
  color: var(--text-secondary);
}
.label-active {
  color: var(--text-primary);
  font-weight: 700;
}

/* ==================== Hero 总览 ==================== */
.hero-card {
  padding: 36rpx;
}
.hero-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
}
.hero-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 12rpx;
  line-height: 1.5;
}
.plan-age-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
}
.dark-mode .plan-age-row {
  background: rgba(255, 255, 255, 0.04);
}
.plan-age-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-left: 8rpx;
}

/* ==================== 操作按钮区 ==================== */
.action-bar {
  margin-bottom: 24rpx;
}

/* ==================== Section ==================== */
.section {
  margin-top: 32rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 20rpx;
}

/* ==================== 7天计划卡片 ==================== */
.day-card {
  padding: 28rpx;
  animation: fadeSlideIn 0.3s ease-out both;
  transition: border-color 0.2s;
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
/* 今天的卡片高亮 */
.day-today {
  border-color: color-mix(in srgb, var(--c-green) 40%, transparent);
  box-shadow: 0 0 24rpx color-mix(in srgb, var(--c-green) 12%, transparent);
}
/* 过去的卡片灰化 */
.day-past {
  opacity: 0.55;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.day-label-row {
  display: flex;
  align-items: center;
}
.day-date-label {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.today-badge {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--c-green);
  background: color-mix(in srgb, var(--c-green) 12%, transparent);
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
  margin-left: 12rpx;
}
.day-total {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* 任务项 */
.task-item {
  padding: 20rpx 0;
  border-top: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.04));
}
.task-item:first-child {
  border-top: none;
  padding-top: 0;
}
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8rpx;
}
.ta<REDACTED_SECRET> {
  flex: 1;
  margin-right: 12rpx;
}
.task-kp {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}

/* 知识点掌握度迷你进度条 */
.ta<REDACTED_SECRET> {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}
.mini-bar-bg {
  flex: 1;
  max-width: 200rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}
.dark-mode .mini-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}
.mini-bar-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 0.6s ease;
}
.mini-bar-text {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-left: 8rpx;
  font-variant-numeric: tabular-nums;
}

/* 任务类型 Badge */
.action-badge {
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}
.action-new_learn {
  background: color-mix(in srgb, var(--c-success) 12%, transparent);
}
.action-review {
  background: rgba(50, 173, 230, 0.12);
}
.action-drill,
.action-error_review {
  background: color-mix(in srgb, var(--c-orange) 12%, transparent);
}
.action-mock {
  background: color-mix(in srgb, var(--c-red) 12%, transparent);
}
.action-text {
  font-size: 20rpx;
  font-weight: 600;
}
.action-new_learn .action-text {
  color: var(--c-green);
}
.action-review .action-text {
  color: var(--c-blue);
}
.action-drill .action-text,
.action-error_review .action-text {
  color: var(--c-orange);
}
.action-mock .action-text {
  color: var(--c-red);
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
}
.meta-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-right: 16rpx;
}
.meta-reason {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 4rpx;
  display: block;
  width: 100%;
}

/* ==================== 时间线 ==================== */
.timeline {
  padding-left: 8rpx;
}
.tl-item {
  display: flex;
}
.tl-dot-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.tl-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-top: 36rpx;
}
.dot-foundation {
  background: var(--c-blue);
}
.dot-intensive {
  background: var(--c-orange);
}
.dot-sprint,
.dot-mock {
  background: var(--c-red);
  box-shadow: 0 0 12rpx rgba(255, 69, 58, 0.4);
}
.tl-line {
  width: 2rpx;
  flex: 1;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.08));
}
.dark-mode .tl-line {
  background: rgba(255, 255, 255, 0.08);
}
.tl-content {
  flex: 1;
  padding: 24rpx;
}
.tl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.tl-name {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.tl-type-badge {
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
}
.tl-type-text {
  font-size: 20rpx;
  font-weight: 600;
}
.tl-date {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
}
.tl-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.5;
}

/* ==================== 到期提示 ==================== */
.expired-banner {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  background: color-mix(in srgb, var(--c-orange) 6%, var(--bg-card));
  border-color: color-mix(in srgb, var(--c-orange) 20%, transparent);
}
.expired-info {
  flex: 1;
  margin-left: 16rpx;
  margin-right: 12rpx;
}
.expired-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}
.expired-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 4rpx;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.hero-cartoon-icon {
  width: 160rpx;
  height: 160rpx;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 32rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
  text-align: center;
}
.bottom-safe {
  height: 80rpx;
}
</style>
