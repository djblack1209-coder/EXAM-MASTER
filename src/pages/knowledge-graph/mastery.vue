<template>
  <view class="mastery-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">掌握度总览</text>
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
        <view class="skel-tabs" />
        <view class="skel-card" />
        <view class="skel-card skel-short" />
        <view class="skel-card skel-short" />
      </view>

      <template v-else>
        <!-- ==================== Hero 总览 ==================== -->
        <view class="hero-card glass-card">
          <view class="hero-ring-col">
            <WdCircle
              :model-value="avgMastery"
              :size="90"
              :stroke-width="7"
              :color="masteryColor(avgMastery)"
              layer-color="rgba(255,255,255,0.06)"
              :speed="80"
            >
              <view class="ring-inner">
                <text class="ring-num">{{ avgMastery }}</text>
                <text class="ring-sub">%</text>
              </view>
            </WdCircle>
          </view>
          <view class="hero-info">
            <text class="hero-title">平均掌握度</text>
            <view class="hero-stats">
              <view class="h-stat">
                <text class="h-stat-val danger-text">{{ weakCount }}</text>
                <text class="h-stat-lbl">薄弱</text>
              </view>
              <view class="h-stat-divider" />
              <view class="h-stat">
                <text class="h-stat-val warning-text">{{ learningCount }}</text>
                <text class="h-stat-lbl">学习中</text>
              </view>
              <view class="h-stat-divider" />
              <view class="h-stat">
                <text class="h-stat-val success-text">{{ masteredCount }}</text>
                <text class="h-stat-lbl">已掌握</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ==================== 科目 TabBar ==================== -->
        <scroll-view scroll-x :show-scrollbar="false" class="tab-scroll">
          <view class="tab-bar">
            <view
              v-for="tab in SUBJECT_TABS"
              :key="tab.key"
              :class="['tab-item', { 'tab-active': activeTab === tab.key }]"
              @tap="activeTab = tab.key"
            >
              <text class="tab-text">{{ tab.label }}</text>
              <text v-if="getSubjectCount(tab.key) > 0" class="tab-count">{{ getSubjectCount(tab.key) }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- ==================== 排序控制 ==================== -->
        <view class="sort-bar">
          <view
            v-for="opt in SORT_OPTIONS"
            :key="opt.key"
            :class="['sort-chip', { 'sort-active': sortMode === opt.key }]"
            @tap="sortMode = opt.key"
          >
            <text class="sort-text">{{ opt.label }}</text>
          </view>
        </view>

        <!-- ==================== 知识点列表 ==================== -->
        <template v-if="displayGroups.length > 0">
          <view v-for="group in displayGroups" :key="group.subject" class="section">
            <!-- 科目分组标题（"全部"模式下显示，可折叠） -->
            <view v-if="activeTab === 'all'" class="section-header" @tap="toggleSection(group.subject)">
              <view class="section-left">
                <view class="section-dot" :class="'dot-' + group.subject" />
                <text class="section-title">{{ subjectLabel(group.subject) }}</text>
              </view>
              <view class="section-right">
                <text class="section-avg">均值 {{ group.avgMastery }}%</text>
                <BaseIcon :name="isSectionOpen(group.subject) ? 'arrow-down2' : 'chevron-right'" :size="24" />
              </view>
            </view>

            <!-- 知识点卡片列表 -->
            <template v-if="activeTab !== 'all' || isSectionOpen(group.subject)">
              <view
                v-for="(kp, idx) in group.items"
                :key="kp.name + idx"
                :class="['kp-card', 'glass-card', { 'kp-starred': kp.mastery >= 90 }]"
                :style="{ animationDelay: idx * 0.05 + 's' }"
                @tap="handleKpTap(kp)"
                @longpress="handleKpLongPress(kp)"
              >
                <!-- 卡片头部：名称 + 趋势 + 掌握度环 -->
                <view class="kp-head">
                  <view class="kp-name-col">
                    <view class="kp-name-row">
                      <text class="kp-name">{{ kp.name }}</text>
                      <text v-if="kp.mastery >= 90" class="star-badge">★</text>
                    </view>
                    <view class="kp-badges">
                      <view v-if="kp.trend" class="trend-badge" :class="'trend-' + kp.trend">
                        <text class="trend-text">{{ trendSymbol(kp.trend) }} {{ trendLabel(kp.trend) }}</text>
                      </view>
                      <view v-if="kp.isDue" class="due-badge">
                        <text class="due-text">待复习</text>
                      </view>
                    </view>
                  </view>
                  <view class="kp-ring">
                    <WdCircle
                      :model-value="kp.mastery"
                      :size="48"
                      :stroke-width="4"
                      :color="masteryColor(kp.mastery)"
                      layer-color="rgba(255,255,255,0.06)"
                      :speed="60"
                    >
                      <text class="kp-ring-num">{{ kp.mastery }}</text>
                    </WdCircle>
                  </view>
                </view>

                <!-- 掌握度进度条（颜色分段） -->
                <view class="mastery-bar-wrap">
                  <view class="mastery-bar-bg">
                    <view
                      class="mastery-bar-fill"
                      :style="{ width: kp.mastery + '%', background: masteryColor(kp.mastery) }"
                    />
                  </view>
                </view>

                <!-- 三列数据行 -->
                <view class="kp-stats">
                  <view class="kp-stat">
                    <text class="kp-stat-val">{{ kp.accuracy }}%</text>
                    <text class="kp-stat-lbl">正确率</text>
                  </view>
                  <view class="kp-stat-divider" />
                  <view class="kp-stat">
                    <text class="kp-stat-val">{{ kp.retrievability }}%</text>
                    <text class="kp-stat-lbl">记忆留存</text>
                  </view>
                  <view class="kp-stat-divider" />
                  <view class="kp-stat">
                    <text class="kp-stat-val">{{ kp.questionCount }}</text>
                    <text class="kp-stat-lbl">题目数</text>
                  </view>
                </view>

                <!-- 低掌握度快速入口 -->
                <WdButton
                  v-if="kp.mastery < 60"
                  size="small"
                  type="primary"
                  custom-style="margin-top: 16rpx; border-radius: 999rpx; width: 100%;"
                  @click.stop="sendToQuiz(kp)"
                >
                  定向突破
                </WdButton>
              </view>
            </template>
          </view>
        </template>

        <!-- ==================== 空状态 ==================== -->
        <view v-else class="empty-state">
          <BaseIcon name="chart-bar" :size="96" />
          <text class="empty-title">暂无掌握度数据</text>
          <text class="empty-sub">开始做题后 AI 将自动分析各知识点掌握度</text>
        </view>
      </template>

      <view class="bottom-safe" />
    </scroll-view>

    <!-- ==================== FSRS 详情弹窗 ==================== -->
    <WdPopup v-model="showFsrsPopup" position="bottom" :safe-area-inset-bottom="true">
      <view v-if="fsrsDetail" class="fsrs-popup">
        <view class="fsrs-handle" />
        <view class="fsrs-header">
          <text class="fsrs-title">{{ fsrsDetail.name }}</text>
          <view class="fsrs-close" @tap="showFsrsPopup = false">
            <BaseIcon name="close" :size="28" />
          </view>
        </view>

        <!-- 掌握度构成 -->
        <view class="fsrs-section">
          <text class="fsrs-section-title">掌握度构成</text>
          <view class="fsrs-compose">
            <view class="compose-item">
              <text class="compose-label">FSRS 记忆留存 (40%)</text>
              <view class="compose-bar-bg">
                <view
                  class="compose-bar-fill"
                  :style="{ width: fsrsDetail.retrievability + '%', background: '#32ade6' }"
                />
              </view>
              <text class="compose-val">{{ fsrsDetail.retrievability }}%</text>
            </view>
            <view class="compose-item">
              <text class="compose-label">答题正确率 (60%)</text>
              <view class="compose-bar-bg">
                <view class="compose-bar-fill" :style="{ width: fsrsDetail.accuracy + '%', background: '#34c759' }" />
              </view>
              <text class="compose-val">{{ fsrsDetail.accuracy }}%</text>
            </view>
            <view class="compose-result">
              <text class="compose-result-label">综合掌握度</text>
              <text class="compose-result-val" :style="{ color: masteryColor(fsrsDetail.mastery) }">
                {{ fsrsDetail.mastery }}%
              </text>
            </view>
          </view>
        </view>

        <!-- FSRS 参数 -->
        <view class="fsrs-section">
          <text class="fsrs-section-title">FSRS 记忆参数</text>
          <view class="fsrs-params">
            <view class="param-row">
              <text class="param-label">稳定性 (S)</text>
              <text class="param-val">{{ fsrsDetail.stability }}</text>
            </view>
            <view class="param-row">
              <text class="param-label">难度 (D)</text>
              <text class="param-val">{{ fsrsDetail.difficulty }}</text>
            </view>
            <view class="param-row">
              <text class="param-label">复习次数</text>
              <text class="param-val">{{ fsrsDetail.reps }}</text>
            </view>
            <view class="param-row">
              <text class="param-label">遗忘次数</text>
              <text class="param-val">{{ fsrsDetail.lapses }}</text>
            </view>
            <view class="param-row">
              <text class="param-label">卡片状态</text>
              <text class="param-val">{{ fsrsDetail.stateLabel }}</text>
            </view>
            <view class="param-row">
              <text class="param-label">下次复习</text>
              <text class="param-val">{{ fsrsDetail.dueLabel }}</text>
            </view>
          </view>
        </view>

        <WdButton
          block
          type="primary"
          custom-style="margin-top: 24rpx; border-radius: 999rpx;"
          @click="
            sendToQuiz(fsrsDetail);
            showFsrsPopup = false;
          "
        >
          开始练习
        </WdButton>
      </view>
    </WdPopup>
  </view>
</template>

<script setup>
// ==================== 组件导入 ====================
import WdCircle from 'wot-design-uni/components/wd-circle/wd-circle.vue';
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { storageService } from '@/services/storageService.js';
import { loadCardState, State } from '@/services/fsrs-service.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// ==================== 常量 ====================

const SUBJECT_TABS = [
  { key: 'all', label: '全部' },
  { key: 'politics', label: '政治' },
  { key: 'english', label: '英语' },
  { key: 'math', label: '数学' },
  { key: 'professional', label: '专业课' }
];

const SORT_OPTIONS = [
  { key: 'need_improve', label: '最需提升' },
  { key: 'chapter', label: '章节顺序' },
  { key: 'mastery_asc', label: '掌握度↑' },
  { key: 'recent', label: '最近学习' }
];

/** 知识点→科目映射（与 knowledge-engine.js 一致） */
const SUBJECT_MAP = {
  高等数学: 'math',
  线性代数: 'math',
  概率统计: 'math',
  概率论与数理统计: 'math',
  马克思主义基本原理: 'politics',
  马原: 'politics',
  毛泽东思想: 'politics',
  毛中特: 'politics',
  近代史: 'politics',
  中国近现代史纲要: 'politics',
  思修: 'politics',
  思想道德与法治: 'politics',
  形势与政策: 'politics',
  政治: 'politics',
  英语阅读: 'english',
  英语写作: 'english',
  英语翻译: 'english',
  完型填空: 'english',
  新题型: 'english',
  英语: 'english'
};

const SUBJECT_LABELS = { math: '数学', english: '英语', politics: '政治', professional: '专业课', other: '其他' };

/** FSRS 可提取性权重 */
const FSRS_WEIGHT = 0.4;

// ==================== 响应式状态 ====================

const isDark = ref(initTheme());
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);
const activeTab = ref('all');
const sortMode = ref('need_improve');
const openSections = ref({}); // { [subject]: boolean } 折叠状态
const allKnowledgePoints = ref([]); // 全部知识点数据

// FSRS 详情弹窗
const showFsrsPopup = ref(false);
const fsrsDetail = ref(null);

// ==================== 计算属性 ====================

/** 平均掌握度 */
const avgMastery = computed(() => {
  if (allKnowledgePoints.value.length === 0) return 0;
  const sum = allKnowledgePoints.value.reduce((s, kp) => s + kp.mastery, 0);
  return Math.round(sum / allKnowledgePoints.value.length);
});

/** 各等级数量 */
const weakCount = computed(() => allKnowledgePoints.value.filter((kp) => kp.mastery < 40).length);
const learningCount = computed(
  () => allKnowledgePoints.value.filter((kp) => kp.mastery >= 40 && kp.mastery < 70).length
);
const masteredCount = computed(() => allKnowledgePoints.value.filter((kp) => kp.mastery >= 70).length);

/** 获取某个科目 Tab 下的知识点数量 */
function getSubjectCount(tabKey) {
  if (tabKey === 'all') return allKnowledgePoints.value.length;
  return allKnowledgePoints.value.filter((kp) => kp.subject === tabKey).length;
}

/** 按当前 Tab 和排序模式分组后的显示数据 */
const displayGroups = computed(() => {
  // 1. 按 Tab 过滤
  let items = allKnowledgePoints.value;
  if (activeTab.value !== 'all') {
    items = items.filter((kp) => kp.subject === activeTab.value);
  }

  // 2. 排序
  items = [...items];
  switch (sortMode.value) {
    case 'need_improve':
      // 到期的排前面，然后按掌握度升序
      items.sort((a, b) => {
        if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
        return a.mastery - b.mastery;
      });
      break;
    case 'chapter':
      // 按科目 → 名称字母序
      items.sort((a, b) => {
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
        return a.name.localeCompare(b.name);
      });
      break;
    case 'mastery_asc':
      items.sort((a, b) => a.mastery - b.mastery);
      break;
    case 'recent':
      items.sort((a, b) => (b.lastStudyTime || 0) - (a.lastStudyTime || 0));
      break;
  }

  // 3. 按科目分组
  const groupMap = {};
  items.forEach((kp) => {
    const subj = kp.subject || 'other';
    if (!groupMap[subj]) {
      groupMap[subj] = { subject: subj, items: [], totalMastery: 0 };
    }
    groupMap[subj].items.push(kp);
    groupMap[subj].totalMastery += kp.mastery;
  });

  return Object.values(groupMap).map((g) => ({
    ...g,
    avgMastery: g.items.length > 0 ? Math.round(g.totalMastery / g.items.length) : 0
  }));
});

// ==================== 工具函数 ====================

/** 掌握度→颜色映射（0-39%红、40-69%橙、70-89%绿、90-100%深绿） */
function masteryColor(val) {
  if (val >= 90) return '#00a854';
  if (val >= 70) return '#34c759';
  if (val >= 40) return '#ff9f0a';
  return '#ff453a';
}

function trendSymbol(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendLabel(trend) {
  if (trend === 'up') return '上升';
  if (trend === 'down') return '下降';
  return '持平';
}

function subjectLabel(key) {
  return SUBJECT_LABELS[key] || key;
}

/** 折叠控制 */
function isSectionOpen(subject) {
  return openSections.value[subject] !== false; // 默认展开
}
function toggleSection(subject) {
  openSections.value[subject] = !isSectionOpen(subject);
}

/** FSRS Card.state → 中文标签 */
function stateLabel(state) {
  const map = { 0: '新卡片', 1: '学习中', 2: '复习中', 3: '重新学习' };
  return map[state] ?? '未知';
}

// ==================== 核心算法 ====================

/**
 * 构建知识点掌握度数据
 * 掌握度 = 40% × FSRS 平均 retrievability + 60% × 答题正确率
 */
function buildKnowledgePoints() {
  const bank = storageService.get('v30_bank', []);
  const mistakes = storageService.get('mistake_book', []);

  if (bank.length === 0) return [];

  // ---- 第1步：按分类/知识点聚合题目 ----
  const kpMap = {};
  bank.forEach((q) => {
    const name = q.tag || q.knowledgePoint || q.knowledge_point || q.category || q.subject || '未分类';
    if (!kpMap[name]) {
      kpMap[name] = { name, questionIds: [], totalQuestions: 0 };
    }
    kpMap[name].totalQuestions++;
    const qid = q.id || q._id || '';
    if (qid) kpMap[name].questionIds.push(qid);
  });

  // ---- 第2步：从错题本统计正确率 ----
  const mistakeMap = {};
  mistakes.forEach((m) => {
    const cat = m.category || m.subject || m.knowledge_point || '未分类';
    if (!mistakeMap[cat]) mistakeMap[cat] = { wrongCount: 0, reviewCount: 0 };
    mistakeMap[cat].wrongCount += m.wrong_count || m.wrongCount || 1;
    mistakeMap[cat].reviewCount += m.review_count || m.reviewCount || 0;
  });

  // ---- 第3步：加载上周快照用于趋势对比 ----
  const snapshot = loadWeeklySnapshot();

  const now = new Date();

  // ---- 第4步：逐知识点计算 ----
  return Object.values(kpMap).map((kp) => {
    // 科目归属
    const subject = SUBJECT_MAP[kp.name] || guessSubject(kp.name);

    // 正确率
    const md = mistakeMap[kp.name] || { wrongCount: 0, reviewCount: 0 };
    const totalAttempts = md.wrongCount + md.reviewCount;
    const accuracy = totalAttempts > 0 ? Math.max(0, Math.min(1, 1 - md.wrongCount / totalAttempts)) : 0.5;

    // FSRS 平均可提取性 + 聚合参数
    const fsrsAgg = aggregateFsrs(kp.questionIds, now);

    // 综合掌握度 = 40% FSRS + 60% 正确率
    const mastery = Math.round((FSRS_WEIGHT * fsrsAgg.avgR + (1 - FSRS_WEIGHT) * accuracy) * 100);

    // 趋势对比
    const prevMastery = snapshot.data?.[kp.name];
    let trend = 'stable';
    if (prevMastery != null) {
      if (mastery > prevMastery + 3) trend = 'up';
      else if (mastery < prevMastery - 3) trend = 'down';
    }

    return {
      name: kp.name,
      subject,
      mastery,
      accuracy: Math.round(accuracy * 100),
      retrievability: Math.round(fsrsAgg.avgR * 100),
      questionCount: kp.totalQuestions,
      wrongCount: md.wrongCount,
      isDue: fsrsAgg.dueCount > 0,
      trend,
      lastStudyTime: fsrsAgg.lastReview,
      // FSRS 聚合（用于长按弹窗）
      fsrsAvg: fsrsAgg
    };
  });
}

/**
 * 聚合一组题目的 FSRS 数据
 * 返回：平均可提取性、到期数量、聚合参数
 */
function aggregateFsrs(questionIds, now) {
  const nowMs = now.getTime();
  let rSum = 0;
  let rCount = 0;
  let dueCount = 0;
  let totalStability = 0;
  let totalDifficulty = 0;
  let totalReps = 0;
  let totalLapses = 0;
  let cardCount = 0;
  let lastReview = 0;
  let latestState = State.New;
  let latestDue = null;

  for (const qid of questionIds) {
    if (!qid) continue;
    const card = loadCardState(qid);
    if (!card) {
      // 新卡片，默认 retrievability 0.3
      rSum += 0.3;
      rCount++;
      dueCount++;
      continue;
    }

    cardCount++;
    totalStability += card.stability || 0;
    totalDifficulty += card.difficulty || 0;
    totalReps += card.reps || 0;
    totalLapses += card.lapses || 0;
    latestState = card.state;

    // 到期检查
    const dueMs = new Date(card.due).getTime();
    if (dueMs <= nowMs) dueCount++;
    if (!latestDue || dueMs < new Date(latestDue).getTime()) latestDue = card.due;

    // 最近复习时间
    if (card.last_review) {
      const lr = new Date(card.last_review).getTime();
      if (lr > lastReview) lastReview = lr;
    }

    // 可提取性
    if (card.state === State.New || !card.stability || card.stability <= 0) {
      rSum += 0.3;
      rCount++;
      continue;
    }
    const lastR = card.last_review ? new Date(card.last_review) : null;
    if (!lastR) {
      rSum += 0.3;
      rCount++;
      continue;
    }
    const elapsed = (nowMs - lastR.getTime()) / 86400000;
    if (elapsed <= 0) {
      rSum += 1;
      rCount++;
      continue;
    }
    const r = Math.pow(1 + elapsed / (9 * card.stability), -1);
    rSum += Math.max(0, Math.min(1, r));
    rCount++;
  }

  return {
    avgR: rCount > 0 ? rSum / rCount : 0.5,
    dueCount,
    avgStability: cardCount > 0 ? Math.round((totalStability / cardCount) * 10) / 10 : 0,
    avgDifficulty: cardCount > 0 ? Math.round((totalDifficulty / cardCount) * 10) / 10 : 0,
    totalReps,
    totalLapses,
    lastReview,
    latestState,
    latestDue
  };
}

/** 猜测科目归属（模糊匹配） */
function guessSubject(name) {
  if (!name) return 'professional';
  const n = name.toLowerCase();
  if (/数学|高数|线代|概率|微积分|矩阵/.test(n)) return 'math';
  if (/英语|阅读|写作|翻译|完型|作文/.test(n)) return 'english';
  if (/政治|马原|毛|近代史|思修|形势/.test(n)) return 'politics';
  return 'professional';
}

// ==================== 周趋势快照 ====================

function loadWeeklySnapshot() {
  try {
    return storageService.get('mastery_weekly_snapshot', { date: '', data: {} });
  } catch {
    return { date: '', data: {} };
  }
}

function saveWeeklySnapshot(kpList) {
  const today = new Date().toISOString().split('T')[0];
  const existing = loadWeeklySnapshot();

  // 只在快照超过7天或不存在时更新
  if (!existing.date || daysBetween(existing.date, today) >= 7) {
    const data = {};
    kpList.forEach((kp) => {
      data[kp.name] = kp.mastery;
    });
    storageService.save('mastery_weekly_snapshot', { date: today, data }, true);
  }
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1).getTime();
  const d2 = new Date(dateStr2).getTime();
  return Math.abs(Math.round((d2 - d1) / 86400000));
}

// ==================== 交互方法 ====================

/** 点击知识点 → 低掌握度直接跳转刷题 */
function handleKpTap(kp) {
  if (kp.mastery < 60) {
    sendToQuiz(kp);
  }
}

/** 长按知识点 → 显示 FSRS 详情弹窗 */
function handleKpLongPress(kp) {
  const agg = kp.fsrsAvg || {};
  fsrsDetail.value = {
    ...kp,
    stability: agg.avgStability || 0,
    difficulty: agg.avgDifficulty || 0,
    reps: agg.totalReps || 0,
    lapses: agg.totalLapses || 0,
    stateLabel: stateLabel(agg.latestState),
    dueLabel: agg.latestDue ? formatDueDate(agg.latestDue) : '无数据'
  };
  showFsrsPopup.value = true;
}

function formatDueDate(due) {
  try {
    const d = new Date(due);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return '已到期';
    const days = Math.ceil(diff / 86400000);
    if (days <= 1) return '今天';
    if (days <= 7) return `${days}天后`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '未知';
  }
}

/** 跳转刷题 */
function sendToQuiz(kp) {
  const bank = storageService.get('v30_bank', []);
  const matched = bank
    .filter((q) => {
      const cat = q.tag || q.knowledgePoint || q.knowledge_point || q.category || q.subject || '';
      return cat === kp.name;
    })
    .map((q, i) => ({
      id: q.id || q._id || `mastery_${i}_${Date.now()}`,
      question: q.question || q.title || `题目 ${i + 1}`,
      options:
        Array.isArray(q.options) && q.options.length >= 2
          ? q.options
          : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
      answer: ((q.answer || 'A') + '').charAt(0).toUpperCase(),
      desc: q.desc || q.description || q.analysis || '暂无解析',
      category: q.category || kp.name,
      type: q.type || '单选',
      difficulty: q.difficulty || 2
    }))
    .filter((q) => q.question && q.options.length >= 2);

  if (matched.length === 0) {
    toast.info('该知识点暂无可练习的题目');
    return;
  }

  const currentBank = storageService.get('v30_bank', []);
  if (currentBank.length > 0) storageService.save('v30_bank_backup', currentBank);
  storageService.save('v30_bank', matched);
  storageService.save('is_review_mode', true);

  logger.log(`[Mastery] 定向突破: ${kp.name}, ${matched.length} 题`);
  safeNavigateTo('/pages/practice-sub/do-quiz?mode=target_drill');
}

// ==================== 数据加载 ====================

function loadData() {
  loading.value = true;
  try {
    const kpList = buildKnowledgePoints();
    allKnowledgePoints.value = kpList;

    // 初始化折叠状态（默认全部展开）
    const subjects = [...new Set(kpList.map((kp) => kp.subject))];
    subjects.forEach((s) => {
      if (openSections.value[s] === undefined) openSections.value[s] = true;
    });

    // 更新周趋势快照
    saveWeeklySnapshot(kpList);
  } catch (e) {
    logger.warn('[Mastery] 数据加载失败:', e);
    toast.info('加载失败，请稍后重试');
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
.mastery-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --c-red: var(--danger, #ff453a);
  --c-orange: var(--warning, #ff9f0a);
  --c-green: var(--success, #34c759);
  --c-deep-green: #00a854;
  --c-blue: var(--em-info, #32ade6);
}
.mastery-container.dark-mode {
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
    radial-gradient(circle at 18% 24%, rgba(206, 130, 255, 0.15) 0%, transparent 40%),
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
.skel-tabs {
  height: 72rpx;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
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

/* ==================== Hero 总览 ==================== */
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
  align-items: baseline;
  justify-content: center;
}
.ring-num {
  font-size: 48rpx;
  font-weight: 900;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ring-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-left: 2rpx;
}
.hero-info {
  flex: 1;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 16rpx;
}
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.h-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.h-stat-val {
  font-size: 36rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.h-stat-lbl {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.danger-text {
  color: var(--c-red);
}
.warning-text {
  color: var(--c-orange);
}
.success-text {
  color: var(--c-green);
}
.h-stat-divider {
  width: 1px;
  height: 40rpx;
  background: var(--border, rgba(0, 0, 0, 0.06));
}

/* ==================== 科目 TabBar ==================== */
.tab-scroll {
  margin-bottom: 20rpx;
  white-space: nowrap;
}
.tab-bar {
  display: inline-flex;
  padding: 6rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
}
.dark-mode .tab-bar {
  background: rgba(255, 255, 255, 0.04);
}
.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 16rpx 28rpx;
  border-radius: 16rpx;
  margin-right: 4rpx;
  transition: all 0.2s ease;
}
.tab-item:last-child {
  margin-right: 0;
}
.tab-active {
  background: var(--bg-card);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}
.dark-mode .tab-active {
  background: rgba(255, 255, 255, 0.12);
}
.tab-text {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-secondary);
}
.tab-active .tab-text {
  color: var(--text-primary);
  font-weight: 700;
}
.tab-count {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-left: 8rpx;
  font-variant-numeric: tabular-nums;
}

/* ==================== 排序控制 ==================== */
.sort-bar {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
}
.sort-chip {
  padding: 10rpx 20rpx;
  border-radius: 16rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
  transition: all 0.2s ease;
}
.dark-mode .sort-chip {
  background: rgba(255, 255, 255, 0.04);
}
.sort-active {
  background: color-mix(in srgb, var(--c-green) 15%, transparent);
}
.sort-text {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--text-secondary);
}
.sort-active .sort-text {
  color: var(--c-green);
}

/* ==================== 科目分组 ==================== */
.section {
  margin-top: 24rpx;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 16rpx 12rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .section-header {
  background: rgba(255, 255, 255, 0.03);
}
.section-left {
  display: flex;
  align-items: center;
}
.section-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}
.dot-math {
  background: var(--c-blue);
}
.dot-english {
  background: #a855f7;
}
.dot-politics {
  background: var(--c-red);
}
.dot-professional {
  background: var(--c-orange);
}
.dot-other {
  background: var(--text-secondary);
}
.section-title {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.section-right {
  display: flex;
  align-items: center;
}
.section-avg {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  margin-right: 8rpx;
}

/* ==================== 知识点卡片 ==================== */
.kp-card {
  padding: 28rpx;
  animation: fadeSlideIn 0.3s ease-out both;
  position: relative;
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
/* 90%+ 星标卡片边框 */
.kp-starred {
  border-color: color-mix(in srgb, var(--c-deep-green) 30%, transparent);
}

.kp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.kp-name-col {
  flex: 1;
  margin-right: 16rpx;
}
.kp-name-row {
  display: flex;
  align-items: center;
}
.kp-name {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.star-badge {
  font-size: 28rpx;
  color: var(--c-deep-green);
  margin-left: 8rpx;
}
.kp-badges {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}
.trend-badge {
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
  margin-right: 8rpx;
}
.trend-up {
  background: color-mix(in srgb, var(--c-green) 12%, transparent);
}
.trend-down {
  background: color-mix(in srgb, var(--c-red) 12%, transparent);
}
.trend-stable {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.dark-mode .trend-stable {
  background: rgba(255, 255, 255, 0.06);
}
.trend-text {
  font-size: 20rpx;
  font-weight: 600;
}
.trend-up .trend-text {
  color: var(--c-green);
}
.trend-down .trend-text {
  color: var(--c-red);
}
.trend-stable .trend-text {
  color: var(--text-secondary);
}
.due-badge {
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
  background: color-mix(in srgb, var(--c-orange) 12%, transparent);
}
.due-text {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--c-orange);
}

.kp-ring {
  flex-shrink: 0;
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kp-ring-num {
  font-size: 22rpx;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ==================== 掌握度进度条 ==================== */
.mastery-bar-wrap {
  margin: 16rpx 0 12rpx;
}
.mastery-bar-bg {
  height: 10rpx;
  border-radius: 5rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}
.dark-mode .mastery-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}
.mastery-bar-fill {
  height: 100%;
  border-radius: 5rpx;
  transition: width 0.8s ease-out;
}

/* ==================== 三列数据行 ==================== */
.kp-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12rpx 0;
}
.kp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.kp-stat-val {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.kp-stat-lbl {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 2rpx;
}
.kp-stat-divider {
  width: 1px;
  height: 36rpx;
  background: var(--border, rgba(0, 0, 0, 0.06));
}

/* ==================== FSRS 详情弹窗 ==================== */
.fsrs-popup {
  padding: 32rpx;
}
.fsrs-handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 auto 20rpx;
}
.dark-mode .fsrs-handle {
  background: rgba(255, 255, 255, 0.16);
}
.fsrs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.fsrs-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.fsrs-close {
  padding: 8rpx;
  color: var(--text-secondary);
}
.fsrs-section {
  margin-bottom: 28rpx;
}
.fsrs-section-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 16rpx;
}

/* 掌握度构成 */
.fsrs-compose {
  padding: 20rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .fsrs-compose {
  background: rgba(255, 255, 255, 0.04);
}
.compose-item {
  margin-bottom: 16rpx;
}
.compose-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 8rpx;
}
.compose-bar-bg {
  height: 12rpx;
  border-radius: 6rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.06));
  overflow: hidden;
  margin-bottom: 4rpx;
}
.dark-mode .compose-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}
.compose-bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.6s ease;
}
.compose-val {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.compose-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  margin-top: 12rpx;
  border-top: 1rpx solid var(--border, rgba(0, 0, 0, 0.06));
}
.compose-result-label {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.compose-result-val {
  font-size: 36rpx;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

/* FSRS 参数表 */
.fsrs-params {
  padding: 16rpx 20rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .fsrs-params {
  background: rgba(255, 255, 255, 0.04);
}
.param-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--border, rgba(0, 0, 0, 0.04));
}
.param-row:last-child {
  border-bottom: none;
}
.param-label {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.param-val {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
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
