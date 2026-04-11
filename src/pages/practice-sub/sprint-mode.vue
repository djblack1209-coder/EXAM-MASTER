<template>
  <view class="sprint-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">冲刺模式</text>
      <view class="nav-right" />
    </view>

    <scroll-view
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- ==================== 骨架屏 ==================== -->
      <view v-if="loading" class="skel-area">
        <view class="skel-card skel-tall" />
        <view class="skel-card" />
        <view class="skel-card" />
        <view class="skel-card skel-short" />
      </view>

      <template v-else>
        <!-- ==================== 考试日期选择 ==================== -->
        <picker mode="date" :value="examDateStr" :start="todayStr" :end="maxDateStr" @change="onDateChange">
          <view class="date-cell glass-card">
            <view class="date-left">
              <BaseIcon name="calendar" :size="36" />
              <view class="date-text-col">
                <text class="date-label">考试日期</text>
                <text class="date-value">{{ examDateDisplay }}</text>
              </view>
            </view>
            <BaseIcon name="chevron-right" :size="24" class="date-arrow" />
          </view>
        </picker>

        <!-- ==================== 倒计时 Hero ==================== -->
        <view v-if="hasExamDate" class="hero-card glass-card" :class="'tier-' + pressureTier">
          <!-- 倒计时环 -->
          <view class="hero-ring-col">
            <WdCircle
              :model-value="countdownProgress"
              :size="pressureTier === 'emergency' ? 120 : 90"
              :stroke-width="7"
              :color="ringColor"
              layer-color="rgba(255,255,255,0.06)"
              :speed="80"
            >
              <view class="ring-inner">
                <text class="ring-num" :class="{ 'ring-xl': pressureTier === 'emergency' }">{{ daysRemaining }}</text>
                <text class="ring-sub">天</text>
              </view>
            </WdCircle>
          </view>
          <!-- 策略信息 -->
          <view class="hero-info">
            <text class="hero-title">{{ heroTitle }}</text>
            <text class="hero-strategy">{{ strategyText }}</text>
            <view class="hero-tags">
              <view class="htag htag-must">
                <text class="htag-text">必做 {{ mustDoCount }}</text>
              </view>
              <view class="htag htag-should">
                <text class="htag-text">建议 {{ shouldDoCount }}</text>
              </view>
              <view v-if="abandonCount > 0" class="htag htag-abandon">
                <text class="htag-text">放弃 {{ abandonCount }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ==================== 紧急模式横幅 ==================== -->
        <view v-if="pressureTier === 'emergency'" class="emergency-banner glass-card">
          <BaseIcon name="warning" :size="32" />
          <text class="emergency-text">最后 {{ daysRemaining }} 天！集中火力攻克 Top 5 高 ROI 知识点</text>
        </view>

        <!-- ==================== 知识点卡片列表 ==================== -->
        <view
          v-for="(item, idx) in displayItems"
          :key="item.name + idx"
          :class="['sprint-card', 'glass-card', { 'card-abandon': item.isAbandon }]"
          :style="{ animationDelay: idx * 0.06 + 's' }"
        >
          <!-- 卡片头部：知识点名 + ROI 徽章 -->
          <view class="card-head">
            <text class="card-kp">{{ item.name }}</text>
            <view class="roi-pill" :class="'roi-' + roiLevel(item.roi)">
              <text class="roi-score">ROI {{ item.roi }}</text>
            </view>
          </view>

          <!-- 三列数据行 -->
          <view class="stats-row">
            <view class="stat-col">
              <text class="stat-val">{{ item.expectedGain }}%</text>
              <text class="stat-lbl">预期提升</text>
            </view>
            <view class="stat-divider" />
            <view class="stat-col">
              <text class="stat-val">{{ item.examFrequency }}%</text>
              <text class="stat-lbl">出题率</text>
            </view>
            <view class="stat-divider" />
            <view class="stat-col">
              <text class="stat-val">{{ item.estimatedMinutes }}min</text>
              <text class="stat-lbl">建议时间</text>
            </view>
          </view>

          <!-- 掌握度进度条 -->
          <view class="mastery-row">
            <text class="mastery-label">掌握度 {{ item.mastery }}%</text>
            <WdProgress
              :percentage="item.mastery"
              :color="getMasteryColor(item.mastery)"
              :show-text="false"
              :stroke-width="6"
            />
          </view>

          <!-- 战略放弃原因 -->
          <view v-if="item.isAbandon" class="abandon-box">
            <BaseIcon name="info" :size="24" />
            <text class="abandon-text">{{ item.abandonReason }}</text>
          </view>

          <!-- 操作按钮 -->
          <WdButton
            v-if="!item.isAbandon"
            size="small"
            type="primary"
            custom-style="margin-top: 20rpx; border-radius: 999rpx;"
            @click="startSprint(item)"
          >
            开始冲刺 ({{ item.totalQuestions }}题)
          </WdButton>
          <text v-else class="abandon-label">建议战略放弃</text>
        </view>

        <!-- ==================== 空状态 ==================== -->
        <view v-if="!hasExamDate" class="empty-state">
          <image class="hero-cartoon-icon" src="/static/icons/target-bullseye.png" mode="aspectFit" alt="目标靶心" />
          <text class="empty-title">请先设置考试日期</text>
          <text class="empty-sub">设置后 AI 将生成最优冲刺优先级</text>
        </view>

        <view v-else-if="displayItems.length === 0 && hasExamDate" class="empty-state">
          <BaseIcon name="sparkle" :size="96" />
          <text class="empty-title">题库数据不足</text>
          <text class="empty-sub">请先导入学习资料生成题库</text>
        </view>
      </template>

      <view class="bottom-safe" />
    </scroll-view>
  </view>
</template>

<script setup>
// ==================== 组件导入 ====================
// wot-design-uni（显式导入，分包优化）
import WdCircle from 'wot-design-uni/components/wd-circle/wd-circle.vue';
import WdProgress from 'wot-design-uni/components/wd-progress/wd-progress.vue';
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { storageService } from '@/services/storageService.js';
import { loadCardState, State } from '@/services/fsrs-service.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// ==================== 响应式状态 ====================

const isDark = ref(initTheme());
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);

// 考试日期（YYYY-MM-DD 格式字符串）
const examDateStr = ref('');
// 冲刺知识点列表（已排序、含ROI）
const sprintItems = ref([]);
// 压力等级：normal(>30天) | high(10-30天) | emergency(<10天)
const pressureTier = ref('normal');
// 距考试天数
const daysRemaining = ref(0);

// ==================== 日期常量 ====================

const todayStr = new Date().toISOString().split('T')[0];
const maxDateStr = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().split('T')[0];
})();

// ==================== 计算属性 ====================

const hasExamDate = computed(() => !!examDateStr.value);

const examDateDisplay = computed(() => {
  if (!examDateStr.value) return '点击设置考试日期';
  // 格式化为更友好的显示
  const parts = examDateStr.value.split('-');
  return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
});

/** 倒计时环进度（100→0，天数越少进度越低） */
const countdownProgress = computed(() => {
  if (!hasExamDate.value || daysRemaining.value <= 0) return 0;
  // 以 180 天为满进度基准
  return Math.min(100, Math.round((daysRemaining.value / 180) * 100));
});

/** 环颜色：红/橙/绿 */
const ringColor = computed(() => {
  if (daysRemaining.value <= 7) return '#ff453a';
  if (daysRemaining.value <= 30) return '#ff9f0a';
  return '#34c759';
});

/** Hero 标题 */
const heroTitle = computed(() => {
  if (pressureTier.value === 'emergency') return '最后冲刺！';
  if (pressureTier.value === 'high') return '距考试还剩';
  return '距考试还剩';
});

/** 策略描述文本 */
const strategyText = computed(() => {
  if (pressureTier.value === 'emergency') {
    return '只攻 Top 5 高 ROI 知识点，其余全部放弃';
  }
  if (pressureTier.value === 'high') {
    return '聚焦高 ROI 知识点，低 ROI 建议战略放弃';
  }
  return '按 ROI 优先级有序推进，兼顾广度和深度';
});

/** 按显示优先级筛选后的列表 */
const displayItems = computed(() => {
  if (pressureTier.value === 'emergency') {
    // 紧急模式：只显示 Top 5
    return sprintItems.value.slice(0, 5);
  }
  return sprintItems.value;
});

// 用单次遍历统计三种优先级的数量
const priorityCounts = computed(() => {
  let must = 0;
  let should = 0;
  let abandon = 0;
  for (const item of displayItems.value) {
    if (item.isAbandon) abandon++;
    else if (item.priority === 'must_do') must++;
    else should++;
  }
  return { must, should, abandon };
});
const mustDoCount = computed(() => priorityCounts.value.must);
const shouldDoCount = computed(() => priorityCounts.value.should);
const abandonCount = computed(() => priorityCounts.value.abandon);

// ==================== ROI 核心算法 ====================

/**
 * 构建知识点 ROI 优先级列表
 *
 * 公式: ROI = (预期分值提升 × 出题概率) / 预计掌握时间
 * - 预期分值提升 = (1 - 当前正确率) × 分值权重
 * - 出题概率 = 该知识点题目数 / 总题目数（近似近5年出题频率）
 * - 预计掌握时间 = 由 FSRS retrievability 归一化到 1-10 分钟
 *
 * @returns {Array} 按 ROI 降序排列的知识点列表
 */
function buildKnowledgePoints() {
  const bank = storageService.get('v30_bank', []);
  const mistakes = storageService.get('mistake_book', []);

  if (bank.length === 0) return [];

  // ---- 第1步：按学科分类聚合题库数据 ----
  const kpMap = {};
  bank.forEach((q) => {
    const cat = q.category || q.subject || '未分类';
    if (!kpMap[cat]) {
      kpMap[cat] = {
        name: cat,
        questionIds: [],
        totalQuestions: 0,
        difficulties: [],
        tags: new Set()
      };
    }
    kpMap[cat].totalQuestions++;
    kpMap[cat].questionIds.push(q.id || q._id || '');
    kpMap[cat].difficulties.push(Number(q.difficulty) || 2);
    (q.tags || []).forEach((t) => kpMap[cat].tags.add(t));
  });

  // ---- 第2步：从错题本统计每个分类的错误次数和答题次数 ----
  const mistakeMap = {};
  mistakes.forEach((m) => {
    const cat = m.category || m.subject || m.knowledge_point || '未分类';
    if (!mistakeMap[cat]) {
      mistakeMap[cat] = { wrongCount: 0, reviewCount: 0 };
    }
    mistakeMap[cat].wrongCount += m.wrong_count || m.wrongCount || 1;
    mistakeMap[cat].reviewCount += m.review_count || m.reviewCount || 0;
  });

  const totalBankSize = Math.max(1, bank.length);
  const now = new Date();

  // ---- 第3步：逐知识点计算 ROI ----
  const results = Object.values(kpMap).map((kp) => {
    // --- 正确率 ---
    const md = mistakeMap[kp.name] || { wrongCount: 0, reviewCount: 0 };
    const totalAttempts = md.wrongCount + md.reviewCount;
    // 有答题记录时用实际正确率，否则默认 50%（中性假设）
    const accuracy = totalAttempts > 0 ? Math.max(0, Math.min(1, 1 - md.wrongCount / totalAttempts)) : 0.5;

    // --- 分值权重（题目平均难度归一化到 0.5-2.5）---
    const avgDiff = kp.difficulties.reduce((s, d) => s + d, 0) / kp.difficulties.length;
    const weightFactor = avgDiff * 0.5;

    // --- 预期分值提升 ---
    const expectedGain = (1 - accuracy) * weightFactor;

    // --- 出题概率（该分类占总题库的比例）---
    const examFrequency = kp.totalQuestions / totalBankSize;

    // --- FSRS 平均可提取性 → 预计掌握时间 ---
    const avgR = getAvgRetrievability(kp.questionIds, now);
    // retrievability 0→10分钟（完全遗忘），1→1分钟（已掌握）
    const estimatedTime = 1 + (1 - avgR) * 9;

    // --- ROI = (预期分值提升 × 出题概率) / 预计掌握时间 ---
    const roiRaw = (expectedGain * examFrequency) / Math.max(0.1, estimatedTime);
    // 归一化到 0-100 的易读分值
    const roi = Math.round(roiRaw * 10000) / 10;

    return {
      name: kp.name,
      accuracy: Math.round(accuracy * 100),
      mastery: Math.round(accuracy * 100),
      totalQuestions: kp.totalQuestions,
      examFrequency: Math.round(examFrequency * 100),
      expectedGain: Math.round(expectedGain * 100),
      estimatedMinutes: Math.round(estimatedTime),
      roi,
      avgRetrievability: avgR,
      wrongCount: md.wrongCount,
      tags: [...kp.tags],
      // 以下字段在 applyPressureLogic 中填充
      priority: 'should_do',
      isAbandon: false,
      abandonReason: ''
    };
  });

  // 按 ROI 降序排列
  results.sort((a, b) => b.roi - a.roi);
  return results;
}

/**
 * 计算一组题目的 FSRS 平均可提取性
 * retrievability 越低 → 遗忘风险越高 → 需要更多时间重新掌握
 */
function getAvgRetrievability(questionIds, now) {
  let sum = 0;
  let count = 0;

  for (const qid of questionIds) {
    if (!qid) continue;
    const card = loadCardState(qid);
    if (!card || card.state === State.New || !card.stability || card.stability <= 0) {
      // 新卡片或无数据 → 视为 retrievability 0.3（偏低，需学习）
      sum += 0.3;
      count++;
      continue;
    }

    const lastReview = card.last_review ? new Date(card.last_review) : null;
    if (!lastReview) {
      sum += 0.3;
      count++;
      continue;
    }

    const elapsed = (now.getTime() - lastReview.getTime()) / 86400000;
    if (elapsed <= 0) {
      sum += 1;
      count++;
      continue;
    }

    // FSRS 遗忘曲线: R = (1 + t/(9*S))^(-1)
    const r = Math.pow(1 + elapsed / (9 * card.stability), -1);
    sum += Math.max(0, Math.min(1, r));
    count++;
  }

  return count > 0 ? sum / count : 0.5;
}

// ==================== 压力感知逻辑 ====================

/**
 * 根据距考试天数应用不同的压力策略
 * - >30天：展示完整计划
 * - 10-30天：标记 ROI 最低的 20% 为"战略放弃"
 * - <10天：只展示 Top 5
 */
function applyPressureLogic(items, days) {
  if (days < 10) {
    pressureTier.value = 'emergency';
    // 紧急模式：Top 5 全部标记为 must_do
    return items.map((item) => ({
      ...item,
      priority: 'must_do',
      isAbandon: false,
      abandonReason: ''
    }));
  }

  if (days <= 30) {
    pressureTier.value = 'high';
    // 高压模式：底部 20% 标记为战略放弃
    const abandonIdx = Math.floor(items.length * 0.8);
    return items.map((item, i) => {
      if (i >= abandonIdx) {
        return {
          ...item,
          priority: 'abandon',
          isAbandon: true,
          abandonReason: `该知识点近5年出题率仅${item.examFrequency}%，建议将时间用于高频考点`
        };
      }
      return {
        ...item,
        priority: item.roi >= 5 ? 'must_do' : 'should_do',
        isAbandon: false,
        abandonReason: ''
      };
    });
  }

  // 正常模式：完整展示，按 ROI 分三档
  pressureTier.value = 'normal';
  return items.map((item) => ({
    ...item,
    priority: item.roi >= 5 ? 'must_do' : item.roi >= 2 ? 'should_do' : 'nice_to_have',
    isAbandon: false,
    abandonReason: ''
  }));
}

// ==================== 界面辅助 ====================

/** ROI 等级（用于颜色） */
function roiLevel(roi) {
  if (roi >= 5) return 'high';
  if (roi >= 2) return 'mid';
  return 'low';
}

/** 掌握度颜色 */
function getMasteryColor(mastery) {
  if (mastery >= 80) return 'var(--success, #34c759)';
  if (mastery >= 50) return 'var(--warning, #ff9500)';
  return 'var(--danger, #ff453a)';
}

// ==================== 交互方法 ====================

/** 日期选择器回调 */
function onDateChange(e) {
  const dateStr = e.detail.value; // YYYY-MM-DD
  examDateStr.value = dateStr;
  try {
    uni.setStorageSync('exam_date', dateStr);
  } catch (_e) {
    // 静默
  }
  computeSprintData();
}

/** 计算冲刺数据（核心调度入口） */
function computeSprintData() {
  if (!examDateStr.value) {
    sprintItems.value = [];
    return;
  }

  const examTs = new Date(examDateStr.value + 'T23:59:59').getTime();
  const days = Math.max(0, Math.ceil((examTs - Date.now()) / 86400000));
  daysRemaining.value = days;

  // 1. 构建知识点 ROI 列表
  const kpList = buildKnowledgePoints();

  // 2. 应用压力感知逻辑
  sprintItems.value = applyPressureLogic(kpList, days);
}

/** 开始冲刺（筛选该知识点的题目 → 跳转 do-quiz） */
function startSprint(item) {
  const bank = storageService.get('v30_bank', []);
  const matched = bank
    .filter((q) => {
      const cat = q.category || q.subject || '';
      return cat === item.name;
    })
    .map((q, i) => ({
      id: q.id || q._id || `sprint_${i}_${Date.now()}`,
      question: q.question || q.title || `题目 ${i + 1}`,
      options:
        Array.isArray(q.options) && q.options.length >= 2
          ? q.options
          : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
      answer: ((q.answer || 'A') + '').charAt(0).toUpperCase(),
      desc: q.desc || q.description || q.analysis || '暂无解析',
      category: q.category || item.name,
      type: q.type || '单选',
      difficulty: q.difficulty || 2,
      isReview: false
    }))
    .filter((q) => q.question && q.options.length >= 2);

  if (matched.length === 0) {
    toast.info('该知识点暂无可练习的题目');
    return;
  }

  // 备份原题库 → 临时替换 → 跳转
  const currentBank = storageService.get('v30_bank', []);
  if (currentBank.length > 0) {
    storageService.save('v30_bank_backup', currentBank);
  }
  storageService.save('v30_bank', matched);
  storageService.save('is_review_mode', true);

  logger.log(`[Sprint] 开始冲刺: ${item.name}, ${matched.length} 题, ROI=${item.roi}`);
  safeNavigateTo('/pages/practice-sub/do-quiz?mode=sprint');
}

/** 加载数据 */
function loadData() {
  loading.value = true;
  try {
    // 恢复已保存的考试日期
    const saved = uni.getStorageSync('exam_date');
    if (saved) {
      examDateStr.value = saved;
    }
    // 计算冲刺数据
    computeSprintData();
  } catch (e) {
    logger.warn('[Sprint] 初始化失败:', e);
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  isRefreshing.value = true;
  loadData();
  isRefreshing.value = false;
}

function goBack() {
  safeNavigateBack();
}

// ==================== 生命周期 ====================

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  loadData();
});
</script>

<style scoped>
/* ==================== 页面容器 ==================== */
.sprint-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --c-red: var(--danger, #ff453a);
  --c-orange: var(--warning, #ff9f0a);
  --c-green: var(--success, #34c759);
  --c-blue: var(--em-info, #32ade6);
}
.sprint-container.dark-mode {
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
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  padding: 160rpx 32rpx 40rpx;
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
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* ==================== 日期选择器 ==================== */
.date-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
}
.date-left {
  display: flex;
  align-items: center;
}
.date-text-col {
  margin-left: 20rpx;
}
.date-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
}
.date-value {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
  margin-top: 4rpx;
}
.date-arrow {
  color: var(--text-secondary);
}

/* ==================== 倒计时 Hero ==================== */
.hero-card {
  display: flex;
  align-items: center;
  padding: 36rpx;
}
.hero-ring-col {
  flex-shrink: 0;
  margin-right: 32rpx;
}
.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-num {
  font-size: 52rpx;
  font-weight: 900;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ring-num.ring-xl {
  font-size: 80rpx;
}
.ring-sub {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.hero-info {
  flex: 1;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
}
.hero-strategy {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.5;
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20rpx;
}
.htag {
  display: flex;
  align-items: center;
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}
.htag-must {
  background: color-mix(in srgb, var(--c-red) 12%, transparent);
}
.htag-should {
  background: color-mix(in srgb, var(--c-orange) 12%, transparent);
}
.htag-abandon {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.htag-text {
  font-size: 22rpx;
  font-weight: 600;
}
.htag-must .htag-text {
  color: var(--c-red);
}
.htag-should .htag-text {
  color: var(--c-orange);
}
.htag-abandon .htag-text {
  color: var(--text-secondary);
}

/* 压力等级 Hero 边框强调 */
.tier-emergency {
  border: 2rpx solid var(--c-red);
  box-shadow: 0 0 24rpx color-mix(in srgb, var(--c-red) 15%, transparent);
}
.tier-high {
  border-color: color-mix(in srgb, var(--c-orange) 30%, transparent);
}

/* ==================== 紧急模式横幅 ==================== */
.emergency-banner {
  display: flex;
  align-items: center;
  padding: 24rpx 28rpx;
  background: color-mix(in srgb, var(--c-red) 8%, var(--bg-card));
  border: 2rpx solid color-mix(in srgb, var(--c-red) 25%, transparent);
  animation: urgentPulse 2s ease-in-out infinite;
}
@keyframes urgentPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}
.emergency-text {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--c-red);
  margin-left: 16rpx;
  flex: 1;
  line-height: 1.5;
}

/* ==================== 知识点卡片 ==================== */
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

/* 战略放弃卡片：灰色虚线边框 */
.card-abandon {
  border: 2rpx dashed var(--text-secondary, #8e8e93);
  opacity: 0.65;
  box-shadow: none;
}
.dark-mode .card-abandon {
  border-color: rgba(255, 255, 255, 0.2);
}

/* 卡片头部 */
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.card-kp {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
  margin-right: 16rpx;
}

/* ROI 胶囊 */
.roi-pill {
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
}
.roi-high {
  background: color-mix(in srgb, var(--c-red) 12%, transparent);
}
.roi-mid {
  background: color-mix(in srgb, var(--c-orange) 12%, transparent);
}
.roi-low {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.roi-score {
  font-size: 24rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.roi-high .roi-score {
  color: var(--c-red);
}
.roi-mid .roi-score {
  color: var(--c-orange);
}
.roi-low .roi-score {
  color: var(--text-secondary);
}

/* 三列数据行 */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 20rpx 0;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .stats-row {
  background: rgba(255, 255, 255, 0.04);
}
.stat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.stat-val {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.stat-lbl {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.stat-divider {
  width: 1px;
  height: 48rpx;
  background: var(--border, rgba(0, 0, 0, 0.06));
}

/* 掌握度 */
.mastery-row {
  margin-bottom: 12rpx;
}
.mastery-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 8rpx;
}

/* 战略放弃原因 */
.abandon-box {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 20rpx;
  margin-top: 16rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .abandon-box {
  background: rgba(255, 255, 255, 0.04);
}
.abandon-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-left: 12rpx;
  flex: 1;
}
.abandon-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 16rpx;
  display: block;
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
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 32rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
}
.bottom-safe {
  height: 80rpx;
}
</style>
