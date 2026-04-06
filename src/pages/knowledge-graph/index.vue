<template>
  <view :class="['knowledge-graph-page', { 'dark-mode': isDark, 'wot-theme-dark': isDark }]">
    <view class="aurora-bg" />

    <view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="handleBack">
          <BaseIcon name="arrow-left" :size="36" />
        </view>
        <view class="nav-title-wrap">
          <text class="nav-title"> 知识图谱 </text>
          <text class="nav-subtitle"> 关联知识点与练习表现 </text>
        </view>
        <view class="nav-refresh" @tap="handleRefresh">
          <BaseIcon name="refresh" :size="30" />
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="page-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      :style="{ paddingTop: statusBarHeight + 74 + 'px' }"
      @refresherrefresh="onPullRefresh"
    >
      <view class="hero-card">
        <text class="hero-eyebrow"> Knowledge Atlas </text>
        <text class="hero-title"> 用一张图看清你的掌握度、薄弱点和推进顺序 </text>
        <text class="hero-subtitle"> 点击节点查看详情，按关联关系安排下一轮训练。 </text>

        <view class="hero-stats">
          <view class="hero-stat">
            <text class="hero-stat-value"> {{ totalNodes }} </text>
            <text class="hero-stat-label"> 知识点 </text>
          </view>
          <view class="hero-stat">
            <text class="hero-stat-value"> {{ totalQuestions }} </text>
            <text class="hero-stat-label"> 题目量 </text>
          </view>
          <view class="hero-stat">
            <text class="hero-stat-value"> {{ weakNodes.length }} </text>
            <text class="hero-stat-label"> 薄弱项 </text>
          </view>
        </view>
      </view>

      <!-- 智能学习推荐 -->
      <view v-if="recommendedTopic" class="recommended-topic apple-glass-card">
        <view class="recommended-header">
          <text class="recommended-icon">标</text>
          <text class="recommended-title">推荐下一步学习</text>
        </view>
        <view class="recommended-body">
          <text class="recommended-name">{{ recommendedTopic.knowledgePoint }}</text>
          <text class="recommended-reason">{{ recommendedTopic.reason }}</text>
          <view class="recommended-mastery-bar">
            <view class="recommended-mastery-fill" :style="{ width: (recommendedTopic.mastery || 0) + '%' }" />
          </view>
          <text class="recommended-mastery-label">当前掌握度 {{ recommendedTopic.mastery || 0 }}%</text>
        </view>
      </view>

      <!-- 学习路径 -->
      <view v-if="studyPath.length > 0" class="study-path-section">
        <text class="section-title">学习路径</text>
        <view class="study-path-list">
          <view
            v-for="(item, index) in studyPath.slice(0, 8)"
            :key="item.knowledgePoint"
            :class="['path-item', 'path-status-' + item.status]"
          >
            <view class="path-index">{{ index + 1 }}</view>
            <view class="path-content">
              <text class="path-name">{{ item.knowledgePoint }}</text>
              <view class="path-mastery-bar">
                <view class="path-mastery-fill" :style="{ width: (item.mastery || 0) + '%' }" />
              </view>
            </view>
            <view class="path-badge">
              <text v-if="item.status === 'mastered'" class="path-badge-text badge-mastered">已掌握</text>
              <text v-else-if="item.status === 'ready'" class="path-badge-text badge-ready">可学习</text>
              <text v-else class="path-badge-text badge-blocked">需前置</text>
            </view>
          </view>
        </view>
      </view>

      <scroll-view scroll-x class="action-strip" :show-scrollbar="false">
        <view
          class="action-strip-inner"
          style="display: flex; padding-right: 24rpx; align-items: center; white-space: nowrap"
        >
          <wd-button size="small" type="primary" plain @click="showMasteryStats">
            <!-- 卡通图标替代装饰性 BaseIcon -->
            <image
              class="feature-cartoon-icon"
              src="./static/icons/chart-trend.png"
              mode="aspectFit"
              style="width: 48rpx; height: 48rpx; margin-right: 4rpx; vertical-align: middle"
            />掌握分布
          </wd-button>
          <wd-button size="small" type="primary" plain @click="showLearningPath">
            <BaseIcon name="path" :size="24" style="margin-right: 4rpx" />学习路径
          </wd-button>
          <wd-button size="small" type="primary" plain @click="showConnectionAnalysis">
            <BaseIcon name="link" :size="24" style="margin-right: 4rpx" />关联分析
          </wd-button>
          <wd-button size="small" type="primary" plain @click="showPersonalizedPlan">
            <BaseIcon name="note" :size="24" style="margin-right: 4rpx" />个性计划
          </wd-button>
        </view>
      </scroll-view>

      <view v-if="isLoading" class="loading-card">
        <view class="loading-spinner" />
        <text class="loading-title"> 正在构建知识图谱 </text>
        <text class="loading-text"> 汇总题库、错题与掌握度关系中... </text>
      </view>

      <template v-else>
        <view class="graph-card">
          <view class="section-header">
            <text class="section-eyebrow"> Graph Scene </text>
            <text class="section-title"> 点击一个节点展开它的关联知识点 </text>
          </view>

          <scroll-view scroll-x class="graph-scroller" :show-scrollbar="false">
            <view class="graph-stage">
              <view class="graph-glow graph-glow-a" />
              <view class="graph-glow graph-glow-b" />

              <view class="center-node" @tap="handleCenterClick">
                <view class="center-shine" />
                <view class="center-content">
                  <text class="center-icon">
                    <BaseIcon name="target" :size="36" />
                  </text>
                  <text class="center-title"> 知识体系 </text>
                  <text class="center-subtitle"> {{ totalNodes }} 个知识点 · {{ totalQuestions }} 题 </text>
                </view>
              </view>

              <view
                v-for="(node, index) in knowledgeNodes"
                :key="node.id"
                :class="['knowledge-node', activeNodeId === node.id && 'node-active']"
                :style="getNodeStyle(node, index)"
                @tap="handleNodeClick(node)"
              >
                <view class="node-connector" :style="getConnectorStyle(node, index)" />
                <view class="node-body" :style="{ borderColor: node.color }">
                  <view
                    class="node-glow"
                    :style="{ background: `radial-gradient(circle, ${node.color}30 0%, transparent 70%)` }"
                  />
                  <text class="node-icon">
                    <BaseIcon :name="node.icon" :size="26" />
                  </text>
                  <text class="node-title">
                    {{ node.title }}
                  </text>
                  <view class="node-progress">
                    <view class="progress-bar">
                      <view class="progress-fill" :style="{ width: node.mastery + '%', backgroundColor: node.color }" />
                    </view>
                    <text class="progress-text"> {{ node.mastery }}% </text>
                  </view>
                  <text class="node-count"> {{ node.count }} 题 </text>
                </view>
              </view>

              <view
                v-for="(child, idx) in expandedChildren"
                :key="child.id"
                class="child-node"
                :style="getChildNodeStyle(child, idx)"
                @tap="handleChildClick(child)"
              >
                <view class="child-body">
                  <text class="child-icon">
                    <BaseIcon :name="child.icon" :size="20" />
                  </text>
                  <text class="child-title">
                    {{ child.title }}
                  </text>
                  <text class="child-mastery"> {{ child.mastery }}% </text>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="info-grid">
          <view class="legend-card">
            <view class="section-header compact">
              <text class="section-eyebrow"> Mastery </text>
              <text class="section-title"> 掌握度图例 </text>
            </view>
            <view class="legend-items">
              <view class="legend-item">
                <view class="legend-dot weak" />
                <text class="legend-text"> 薄弱 (&lt;40%) </text>
              </view>
              <view class="legend-item">
                <view class="legend-dot learning" />
                <text class="legend-text"> 学习中 (40-59%) </text>
              </view>
              <view class="legend-item">
                <view class="legend-dot solid" />
                <text class="legend-text"> 熟练 (60-79%) </text>
              </view>
              <view class="legend-item">
                <view class="legend-dot master" />
                <text class="legend-text"> 已掌握 (≥80%) </text>
              </view>
            </view>
          </view>

          <view v-if="weakNodes.length > 0" class="weak-card" @tap="showWeakNodes">
            <view class="section-header compact">
              <text class="section-eyebrow"> Weak Spots </text>
              <text class="section-title"> 优先补强区域 </text>
            </view>
            <view class="weak-summary">
              <text class="weak-count"> {{ weakNodes.length }} </text>
              <text class="weak-copy"> 个薄弱知识点需要额外练习 </text>
            </view>
            <text class="weak-next">
              优先查看 {{ weakNodes[0].name || weakNodes[0].title }}，然后继续展开关联节点。
            </text>
          </view>
        </view>

        <view v-if="learningPath.length > 0" class="path-card">
          <view class="section-header compact">
            <text class="section-eyebrow"> Suggested Flow </text>
            <text class="section-title"> 推荐学习顺序 </text>
          </view>
          <view class="path-list">
            <view v-for="(item, index) in learningPath.slice(0, 3)" :key="index" class="path-item">
              <text class="path-index"> 0{{ index + 1 }} </text>
              <view class="path-meta">
                <text class="path-name"> {{ item.node.name }} </text>
                <text class="path-time"> {{ item.estimatedTime }} </text>
              </view>
            </view>
          </view>
        </view>
      </template>

      <view class="bottom-spacer" />
    </scroll-view>

    <view v-if="selectedNode" class="floating-panel">
      <view class="panel-handle" />
      <view class="panel-header">
        <view class="panel-icon" :style="{ backgroundColor: selectedNode.color + '20' }">
          <BaseIcon :name="selectedNode.icon" :size="30" />
        </view>
        <view class="panel-title-area">
          <text class="panel-title">
            {{ selectedNode.title }}
          </text>
          <text class="panel-subtitle"> 掌握度 {{ selectedNode.mastery }}% </text>
        </view>
        <view class="panel-close" @tap="selectedNode = null">
          <BaseIcon name="close" :size="32" />
        </view>
      </view>

      <view class="panel-stats">
        <view class="panel-stat">
          <text class="panel-stat-value"> {{ selectedNode.count }} </text>
          <text class="panel-stat-label"> 题目数 </text>
        </view>
        <view class="panel-stat">
          <text class="panel-stat-value"> {{ selectedNode.correctRate || 0 }}% </text>
          <text class="panel-stat-label"> 正确率 </text>
        </view>
        <view class="panel-stat">
          <text class="panel-stat-value"> {{ selectedNode.reviewCount || 0 }} </text>
          <text class="panel-stat-label"> 复习次数 </text>
        </view>
      </view>

      <view class="panel-actions">
        <view class="panel-btn primary" @tap="startPractice(selectedNode)">
          <text>开始练习</text>
        </view>
        <view class="panel-btn" @tap="viewDetails(selectedNode)">
          <text>查看详情</text>
        </view>
        <view class="panel-btn" @tap="showNodeConnections(selectedNode)">
          <text>关联分析</text>
        </view>
      </view>
    </view>

    <wd-popup v-model="detailModalVisible" position="bottom" custom-class="node-detail-modal">
      <view v-if="activeNodeData" class="detail-content" style="padding: 40rpx">
        <view
          class="detail-header"
          style="margin-bottom: 24rpx; border-bottom: 1px solid var(--border-color); padding-bottom: 16rpx"
        >
          <text style="font-size: 36rpx; font-weight: bold; color: var(--text-primary)">
            {{ activeNodeData.title }}
          </text>
        </view>
        <view class="detail-stats" style="margin-bottom: 32rpx">
          <text style="font-size: 28rpx; color: var(--text-sub)">掌握度: {{ activeNodeData.mastery }}%</text>
        </view>
        <view class="detail-actions" style="display: flex">
          <wd-button block style="flex: 1" @click="goPractice(activeNodeData)">普通练习</wd-button>
          <wd-button type="warning" block style="flex: 1" @click="summonAITutor(activeNodeData)">
            召唤 AI 特训
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import {
  knowledgeGraphManager,
  getGraphData,
  getWeakNodes,
  getMasteryDistribution,
  getLearningPath,
  buildGraphFromQuestions,
  analyzeKnowledgeConnections,
  generatePersonalizedPlan,
  getStrongConnections
} from './knowledge-graph.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { getSmartStudyPath, getKnowledgeMapData, getNextRecommendedTopic } from './knowledge-engine.js';

// ---- 响应式状态 ----
const detailModalVisible = ref(false);
const activeNodeData = ref(null);
const statusBarHeight = ref(44);
const isDark = ref(false);
const isLoading = ref(true);
const isRefreshing = ref(false);
const activeNodeId = ref(null);
const selectedNode = ref(null);
const expandedChildren = ref([]);

// 知识节点数据（从 knowledge-graph.js 加载）
const knowledgeNodes = ref([]);
// 图谱边数据
const graphEdges = ref([]);
// 薄弱知识点
const weakNodes = ref([]);
// 学习路径建议
const learningPath = ref([]);
// 掌握度分布
const masteryDistribution = ref(null);
// 知识关联分析
const connectionAnalysis = ref(null);
// 个性化学习计划
const personalizedPlan = ref(null);
// 显示模式：'graph' | 'list' | 'path' | 'plan'
const viewMode = ref('graph');
// 知识引擎增强数据
const studyPath = ref([]);
const recommendedTopic = ref(null);
const knowledgeMapNodes = ref([]);
const knowledgeMapEdges = ref([]);

// ---- 非响应式实例变量 ----
let _themeHandler = null;
let _pendingTimers = [];

// ---- 计算属性 ----
const totalNodes = computed(() => knowledgeNodes.value.length);

// F016: 修复属性名 — 映射后的节点使用 count 而非 value/totalQuestions
const totalQuestions = computed(() =>
  knowledgeNodes.value.reduce((sum, node) => sum + (node.count || node.value || 0), 0)
);

// F016: 移除未使用的 sortedByMastery 计算属性
const _weakNodesList = computed(() =>
  [...knowledgeNodes.value].sort((a, b) => (a.correctRate || a.mastery || 0) - (b.correctRate || b.mastery || 0))
);

// ---- 工具函数 ----

/** 获取分类图标 */
function getCategoryIcon(category) {
  const iconMap = {
    politics: 'book',
    english: 'notebook',
    math: 'formula',
    professional: 'pen',
    错题集: 'target',
    热门考点: 'flame',
    练习题: 'note',
    核心概念: 'brain',
    公式定理: 'formula',
    阅读理解: 'books'
  };
  return iconMap[category] || 'books';
}

/** 根据掌握度获取颜色 */
function getMasteryColor(accuracy) {
  if (accuracy >= 80) return '#10B981'; // 已掌握 - 绿色
  if (accuracy >= 60) return '#3B82F6'; // 熟练 - 蓝色
  if (accuracy >= 40) return '#F59E0B'; // 学习中 - 橙色
  return '#EF4444'; // 薄弱 - 红色
}

/** 获取默认节点数据 */
function getDefaultNodes(questionCount, mistakeCount) {
  const studyRecord = storageService.get('study_record', {});
  const overallAccuracy =
    studyRecord.totalAnswered > 0 ? Math.round((studyRecord.correctCount / studyRecord.totalAnswered) * 100) : 0;

  return [
    {
      id: 'default_1',
      title: '错题集',
      count: mistakeCount,
      icon: 'target',
      mastery: mistakeCount > 0 ? Math.max(10, 100 - mistakeCount * 2) : 100,
      color: '#EF4444',
      level: 1,
      correctRate: 0,
      reviewCount: studyRecord.mistakeReviewCount || 0,
      category: '错题集'
    },
    {
      id: 'default_2',
      title: '热门考点',
      count: Math.floor(questionCount * 0.3),
      icon: 'flame',
      mastery: Math.max(0, overallAccuracy - 10),
      color: '#F59E0B',
      level: 1,
      correctRate: Math.max(0, overallAccuracy - 10),
      reviewCount: 0,
      category: '热门考点'
    },
    {
      id: 'default_3',
      title: '练习题',
      count: questionCount,
      icon: 'note',
      mastery: overallAccuracy,
      color: '#00F2FF',
      level: 1,
      correctRate: overallAccuracy,
      reviewCount: studyRecord.totalAnswered || 0,
      category: '练习题'
    },
    {
      id: 'default_4',
      title: '核心概念',
      count: Math.floor(questionCount * 0.4),
      icon: 'brain',
      mastery: Math.min(95, overallAccuracy + 5),
      color: '#10B981',
      level: 1,
      correctRate: Math.min(95, overallAccuracy + 5),
      reviewCount: 0,
      category: '核心概念'
    },
    {
      id: 'default_5',
      title: '公式定理',
      count: Math.floor(questionCount * 0.2),
      icon: 'formula',
      mastery: Math.max(0, overallAccuracy - 5),
      color: '#A855F7',
      level: 1,
      correctRate: Math.max(0, overallAccuracy - 5),
      reviewCount: 0,
      category: '公式定理'
    },
    {
      id: 'default_6',
      title: '阅读理解',
      count: Math.floor(questionCount * 0.15),
      icon: 'books',
      mastery: Math.max(0, overallAccuracy - 15),
      color: '#EC4899',
      level: 1,
      correctRate: Math.max(0, overallAccuracy - 15),
      reviewCount: 0,
      category: '阅读理解'
    }
  ];
}

// ---- 数据加载 ----

/** 初始化基础数据 */
function initData() {
  statusBarHeight.value = getStatusBarHeight();
}

/** 加载知识图谱全量数据 */
async function loadKnowledgeData() {
  isLoading.value = true;

  try {
    // 初始化知识图谱管理器
    knowledgeGraphManager.init();

    // 从本地存储获取题库数据
    const questionBank = storageService.get('v30_bank', []);
    const mistakesResult = await storageService.getMistakes(1, 999);
    const mistakes = mistakesResult?.list || [];

    // 如果有题目数据，构建知识图谱
    if (questionBank.length > 0 || mistakes.length > 0) {
      buildGraphFromQuestions(questionBank, mistakes);
    }

    // 获取图谱可视化数据
    const graphData = getGraphData();

    // 转换节点数据格式 [AUDIT R300] 防止 nodes 为 undefined 导致 TypeError
    knowledgeNodes.value = (graphData.nodes || []).map((node, _index) => ({
      id: node.id,
      title: node.name,
      count: node.value || 0,
      icon: getCategoryIcon(node.category),
      mastery: node.accuracy || 0,
      color: node.itemStyle?.color || getMasteryColor(node.accuracy || 0),
      level: 1,
      correctRate: node.accuracy || 0,
      reviewCount: 0,
      masteryLevel: node.masteryLevel || 'weak',
      category: node.category
    }));

    // 获取边数据 [AUDIT R300] 防止 edges 为 undefined
    graphEdges.value = graphData.edges || [];

    // 获取薄弱知识点
    weakNodes.value = getWeakNodes(5);

    // 获取掌握度分布
    masteryDistribution.value = getMasteryDistribution();

    // 获取学习路径建议
    learningPath.value = getLearningPath();

    // 分析知识关联
    connectionAnalysis.value = analyzeKnowledgeConnections();

    // 生成个性化学习计划
    personalizedPlan.value = generatePersonalizedPlan({
      duration: 30,
      dailyTime: 2,
      focusAreas: Object.keys(
        knowledgeNodes.value.reduce((acc, node) => {
          acc[node.category] = true;
          return acc;
        }, {})
      )
    });

    // 如果没有数据，显示默认节点
    if (knowledgeNodes.value.length === 0) {
      knowledgeNodes.value = getDefaultNodes(questionBank.length, mistakes.length);
    }

    // 知识引擎增强：加载学习路径和推荐
    try {
      const allQuestions = storageService.get('v30_bank', []);
      studyPath.value = getSmartStudyPath(allQuestions);
      recommendedTopic.value = getNextRecommendedTopic(allQuestions);
      const mapData = getKnowledgeMapData(allQuestions);
      knowledgeMapNodes.value = mapData.nodes;
      knowledgeMapEdges.value = mapData.edges;
    } catch (e) {
      logger.warn('[KnowledgeGraph] 知识引擎加载失败:', e);
    }

    logger.log('[KnowledgeGraph] 数据加载完成:', {
      nodes: knowledgeNodes.value.length,
      edges: graphEdges.value.length,
      weakNodes: weakNodes.value.length,
      distribution: masteryDistribution.value,
      connections: connectionAnalysis.value
    });
  } catch (error) {
    logger.error('[KnowledgeGraph] 加载数据失败:', error);
    // 降级到默认数据
    knowledgeNodes.value = getDefaultNodes(0, 0);
    toast.info('数据加载失败');
  } finally {
    isLoading.value = false;
  }
}

// ---- 样式计算 ----

/** 获取节点位置样式 */
function getNodeStyle(_node, index) {
  const total = knowledgeNodes.value.length;
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  // R411: 缩小半径避免右侧节点被屏幕边缘裁切（390px 屏幕宽度下 280rpx 过大）
  const radius = 220;

  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  const opacity = Math.max(0.4, (_node.mastery || 50) / 100);
  const dropShadow = `drop-shadow(0 0 ${(_node.mastery || 50) / 10}px ${_node.color})`;
  return {
    opacity,
    filter: dropShadow,
    transform: `translate(${x}rpx, ${y}rpx)`,
    animationDelay: `${index * 100}ms`
  };
}

/** 获取连接线样式 */
function getConnectorStyle(_node, index) {
  const total = knowledgeNodes.value.length;
  const angle = (index / total) * 360 - 90;

  return {
    transform: `rotate(${angle}deg)`,
    width: '200rpx'
  };
}

/** 获取子节点样式 */
function getChildNodeStyle(_child, index) {
  const angle = (index / expandedChildren.value.length) * 2 * Math.PI - Math.PI / 2;
  const radius = 150;

  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  return {
    transform: `translate(${x}rpx, ${y}rpx)`,
    animationDelay: `${index * 50}ms`
  };
}

// ---- 交互处理 ----

/** 下拉刷新 */
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    await loadKnowledgeData();
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 召唤 AI 导师 */
function summonAITutor(node) {
  if (!node) return;
  toast.loading('AI 导师组卷中...');
  const t = setTimeout(() => {
    toast.hide();
    uni.navigateTo({
      url: `/pages/practice-sub/do-quiz?mode=ai_tutor&topic=${encodeURIComponent(node.title)}`
    });
    detailModalVisible.value = false;
  }, 1500);
  _pendingTimers.push(t);
}

/** 返回上一页 */
function handleBack() {
  safeNavigateBack();
}

/** 手动刷新 */
function handleRefresh() {
  toast.loading('刷新中...');
  loadKnowledgeData()
    .then(() => {
      toast.success('刷新成功');
    })
    .catch((error) => {
      logger.error('[KnowledgeGraph] 刷新失败:', error);
      toast.info('刷新失败');
    })
    .finally(() => {
      toast.hide();
    });
}

/** 点击中心节点 */
function handleCenterClick() {
  // 震动反馈
  try {
    uni.vibrateShort();
  } catch (_e) {
    /* 设备不支持震动 */
  }
  toast.info(`共 ${totalNodes.value} 个知识点`);
}

/** 加载节点的子节点（关联知识点） */
function loadExpandedChildren(node) {
  const connections = getStrongConnections(node.id, 5);
  if (connections.length > 0) {
    expandedChildren.value = connections.map((conn, idx) => ({
      id: `child_${node.id}_${idx}`,
      title: conn.node.name,
      icon: getCategoryIcon(conn.node.category),
      mastery: conn.node.accuracy || 0,
      parentId: node.id
    }));
  } else {
    // 没有关联数据时，根据同类别节点生成子节点
    const sameCategory = knowledgeNodes.value.filter((n) => n.category === node.category && n.id !== node.id);
    expandedChildren.value = sameCategory.slice(0, 4).map((n, idx) => ({
      id: `child_${node.id}_${idx}`,
      title: n.title,
      icon: n.icon,
      mastery: n.mastery,
      parentId: node.id
    }));
  }
}

/** 点击知识节点 */
function handleNodeClick(node) {
  if (activeNodeId.value === node.id) {
    activeNodeId.value = null;
    activeNodeData.value = null;
    detailModalVisible.value = false;
  } else {
    activeNodeId.value = node.id;
    activeNodeData.value = node;
    detailModalVisible.value = true;
    loadExpandedChildren(node);
  }
}

/** 点击子节点 */
function handleChildClick(child) {
  logger.log('[KnowledgeGraph] 子节点点击:', child.title);
  toast.info(child.title);
}

/** 开始练习 */
function startPractice(node) {
  logger.log('[KnowledgeGraph] 开始练习:', node.title);

  // 定义路由映射：tabBar 页面和普通页面分开处理
  const tabBarPages = ['/pages/practice/index', '/pages/profile/index', '/pages/index/index', '/pages/school/index'];

  const routeMap = {
    错题集: '/pages/mistake/index',
    练习题: '/pages/practice/index',
    热门考点: '/pages/practice-sub/import-data?source=hotTopics',
    核心概念: '/pages/practice-sub/import-data?source=concepts',
    公式定理: '/pages/practice/index',
    阅读理解: '/pages/practice/index'
  };

  const url = routeMap[node.title] || '/pages/practice/index';
  const isTabBarPage = tabBarPages.some((page) => url === page || url.startsWith(page + '?'));

  // 错题集需要登录守卫
  if (url === '/pages/mistake/index') {
    requireLogin(
      () => {
        safeNavigateTo(url);
      },
      { message: '请先登录后查看错题集' }
    );
    return;
  }

  if (isTabBarPage) {
    // tabBar 页面使用 switchTab
    uni.switchTab({
      url: url.split('?')[0], // switchTab 不支持参数
      fail: () => uni.reLaunch({ url })
    });
  } else {
    // 普通页面使用 navigateTo
    safeNavigateTo(url);
  }
}

/** 普通练习（模板中 goPractice 的实现） */
function goPractice(node) {
  if (!node) return;
  startPractice(node);
}

/** 查看节点详情 */
function viewDetails(node) {
  logger.log('[KnowledgeGraph] 查看详情:', node.title);

  // 获取节点详情（包含关联节点）
  const detail = knowledgeGraphManager.getNodeDetail(node.id);

  const content = detail
    ? `题目数量：${detail.totalQuestions || node.count}\n掌握度：${detail.accuracy || node.mastery}%\n正确率：${node.correctRate || 0}%\n复习次数：${node.reviewCount || 0}\n关联知识点：${detail.relatedCount || 0}个`
    : `题目数量：${node.count}\n掌握度：${node.mastery}%\n正确率：${node.correctRate || 0}%\n复习次数：${node.reviewCount || 0}`;

  modal.show({
    title: node.title,
    content,
    showCancel: false,
    confirmText: '知道了'
  });
}

/** 切换视图模式 */
function switchViewMode(mode) {
  viewMode.value = mode;
  try {
    uni.vibrateShort();
  } catch (_e) {
    /* 设备不支持震动 */
  }
}

/** 显示学习路径 */
function showLearningPath() {
  if (learningPath.value.length === 0) {
    toast.info('暂无学习建议');
    return;
  }

  const pathText = learningPath.value
    .map((item, index) => `${index + 1}. ${item.node.name} (${item.estimatedTime})`)
    .join('\n');

  modal.show({
    title: '推荐学习路径',
    content: pathText,
    showCancel: false,
    confirmText: '开始学习'
  });
}

/** 显示掌握度分布 */
function showMasteryStats() {
  if (!masteryDistribution.value) {
    toast.info('暂无统计数据');
    return;
  }

  const { percentages } = masteryDistribution.value;
  const content = `已掌握 (≥80%): ${percentages.master}%\n熟练 (60-79%): ${percentages.proficient}%\n学习中 (40-59%): ${percentages.learning}%\n薄弱 (<40%): ${percentages.weak}%`;

  modal.show({
    title: '知识掌握度分布',
    content,
    showCancel: false,
    confirmText: '知道了'
  });
}

/** 显示薄弱知识点 */
function showWeakNodes() {
  if (weakNodes.value.length === 0) {
    toast.info('暂无薄弱知识点');
    return;
  }

  const weakText = weakNodes.value
    .map(
      (node, index) =>
        `${index + 1}. ${node.name} (${node.accuracy}%)\n   ${node.improvementSuggestion || '建议多做练习'}`
    )
    .join('\n\n');

  modal.show({
    title: '薄弱知识点',
    content: weakText,
    confirmText: '生成学习计划',
    cancelText: '开始练习',
    success: (res) => {
      if (res.confirm) {
        // 生成学习计划
        generateLearningPlan();
      } else if (res.cancel && weakNodes.value.length > 0) {
        // 跳转到练习页面
        uni.switchTab({
          url: '/pages/practice/index',
          fail: () => uni.reLaunch({ url: '/pages/practice/index' })
        });
      }
    }
  });
}

/** 显示知识关联分析 */
function showConnectionAnalysis() {
  if (!connectionAnalysis.value) {
    toast.info('暂无关联数据');
    return;
  }

  const { totalEdges, edgeTypes, strongConnections, isolatedNodes } = connectionAnalysis.value;
  const edgeTypesText = Object.entries(edgeTypes)
    .map(([type, count]) => `${type}: ${count}个`)
    .join('\n');

  const content = `总关联数：${totalEdges}个\n\n关联类型：\n${edgeTypesText}\n\n强关联：${strongConnections.length}个\n孤立知识点：${isolatedNodes.length}个`;

  modal.show({
    title: '知识关联分析',
    content,
    showCancel: false,
    confirmText: '知道了'
  });
}

/** 显示个性化学习计划 */
function showPersonalizedPlan() {
  if (!personalizedPlan.value) {
    toast.info('暂无学习计划');
    return;
  }

  const { title, duration, dailyTime, milestones } = personalizedPlan.value;
  const milestonesText = milestones
    .map((milestone, index) => `${index + 1}. ${milestone.title} (${milestone.days}天)\n   ${milestone.description}`)
    .join('\n\n');

  const content = `计划时长：${duration}天\n每天学习：${dailyTime}小时\n\n里程碑：\n${milestonesText}`;

  modal.show({
    title,
    content,
    confirmText: '查看详情',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm) {
        switchViewMode('plan');
      }
    }
  });
}

/** 显示节点的强关联 */
function showNodeConnections(node) {
  const connections = getStrongConnections(node.id, 3);
  if (connections.length === 0) {
    toast.info('暂无关联知识点');
    return;
  }

  const connectionsText = connections
    .map((conn, index) => `${index + 1}. ${conn.node.name} (强度: ${conn.strength})\n   关系: ${conn.relationship}`)
    .join('\n\n');

  modal.show({
    title: `${node.title} 的关联知识点`,
    content: connectionsText,
    showCancel: false,
    confirmText: '知道了'
  });
}

/** 生成学习计划 */
function generateLearningPlan() {
  toast.loading('生成学习计划...');
  const t = setTimeout(() => {
    try {
      const plan = generatePersonalizedPlan({
        duration: 30,
        dailyTime: 2,
        focusAreas: weakNodes.value.map((node) => node.name),
        learningStyle: 'balanced'
      });

      personalizedPlan.value = plan;
      toast.hide();
      toast.success('学习计划生成成功');
      showPersonalizedPlan();
    } catch (error) {
      toast.hide();
      logger.error('[KnowledgeGraph] 生成学习计划失败:', error);
      toast.info('生成失败，请重试');
    }
  }, 1000);
  _pendingTimers.push(t);
}

// ---- 生命周期 ----

onLoad(() => {
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  initData();
  loadKnowledgeData();
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
  // 清理所有待执行的定时器
  if (_pendingTimers.length > 0) {
    _pendingTimers.forEach((t) => clearTimeout(t));
    _pendingTimers = [];
  }
});
</script>

<style lang="scss" scoped>
.knowledge-graph-page {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
  position: relative;
  overflow: hidden;
}

.aurora-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background:
    radial-gradient(circle at 16% 12%, rgba(206, 130, 255, 0.18) 0%, transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(255, 255, 255, 0.34) 0%, transparent 24%),
    radial-gradient(circle at 50% 82%, rgba(206, 130, 255, 0.1) 0%, transparent 28%);
  filter: blur(34px);
  pointer-events: none;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.nav-content {
  display: flex;
  align-items: center;
  /* gap: 18rpx; -- replaced for Android WebView compat */
  height: 88rpx;
  padding: 0 28rpx;
}

.nav-back,
.nav-refresh {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.back-icon {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-main);
}

.nav-title-wrap {
  flex: 1;
  min-width: 0;
}

.nav-title,
.nav-subtitle,
.hero-eyebrow,
.section-eyebrow,
.hero-title,
.hero-subtitle,
.section-title,
.legend-text,
.weak-copy,
.weak-next,
.path-name,
.path-time,
.loading-title,
.loading-text,
.panel-title,
.panel-subtitle,
.panel-stat-label,
.panel-stat-value,
.hero-stat-value,
.hero-stat-label,
.quick-action-text,
.center-title,
.center-subtitle,
.node-title,
.node-count,
.progress-text,
.child-title,
.child-mastery {
  display: block;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.nav-subtitle {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.page-scroll {
  height: 100%;
  height: 100vh;
  position: relative;
  z-index: 1;
  padding: 0 24rpx 140rpx;
  box-sizing: border-box;
}

.hero-card,
.graph-card,
.legend-card,
.weak-card,
.path-card,
.loading-card,
.floating-panel {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.hero-card {
  margin-top: 12rpx;
  padding: 34rpx 30rpx;
  border-radius: 32rpx;
}

.hero-eyebrow,
.section-eyebrow {
  margin-bottom: 10rpx;
  font-size: 22rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.hero-title {
  font-size: 42rpx;
  line-height: 1.22;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-subtitle {
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-secondary);
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 28rpx;
}

.hero-stat,
.quick-action,
.panel-stat {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.hero-stat {
  padding: 18rpx 16rpx;
  border-radius: 22rpx;
  text-align: center;
}

.hero-stat-value {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--purple-light, #ce82ff);
}

.hero-stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

.action-strip {
  white-space: nowrap;
  margin: 22rpx 0;
}

.action-strip-inner {
  display: inline-flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding-right: 24rpx;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  color: var(--text-main);
}

.quick-action-text {
  font-size: 24rpx;
  font-weight: 520;
  color: var(--text-main);
}

.loading-card,
.graph-card,
.legend-card,
.weak-card,
.path-card {
  border-radius: 30rpx;
  padding: 28rpx;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 70rpx 28rpx;
}

.loading-spinner {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  border: 4rpx solid color-mix(in srgb, var(--success) 16%, transparent);
  border-top-color: color-mix(in srgb, var(--success) 88%, transparent);
  animation: spin 1s linear infinite;
}

.loading-title {
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.loading-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.section-header {
  margin-bottom: 22rpx;
}

.section-header.compact {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.graph-scroller {
  width: 100%;
  white-space: nowrap;
}

.graph-stage {
  position: relative;
  width: 780rpx;
  height: 1180rpx;
  border-radius: 32rpx;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.36) 0%, transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 100%);
  border: 1px solid rgba(255, 255, 255, 0.36);
  overflow: hidden;
}

.graph-stage::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 56rpx 56rpx;
  opacity: 0.25;
}

.graph-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
}

.graph-glow-a {
  top: 180rpx;
  left: 100rpx;
  width: 220rpx;
  height: 220rpx;
  background: color-mix(in srgb, var(--success) 18%, transparent);
}

.graph-glow-b {
  right: 90rpx;
  bottom: 180rpx;
  width: 260rpx;
  height: 260rpx;
  background: color-mix(in srgb, var(--info) 12%, transparent);
}

.center-node {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 2rpx solid rgba(206, 130, 255, 0.25);
  box-shadow: 0 18rpx 48rpx rgba(206, 130, 255, 0.16);
  z-index: 10;
}

.center-shine {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  bottom: 14rpx;
  left: 14rpx;
  border-radius: 50%;
  border-top: 1px solid rgba(255, 255, 255, 0.7);
}

.center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  position: relative;
  z-index: 1;
}

.center-icon {
  color: var(--text-main);
}

.center-title {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.center-subtitle {
  width: 150rpx;
  text-align: center;
  font-size: 22rpx;
  line-height: 1.4;
  color: var(--text-secondary);
}

.knowledge-node,
.child-node {
  position: absolute;
  top: 50%;
  left: 50%;
}

.knowledge-node {
  margin-left: -88rpx;
  margin-top: -88rpx;
  animation: node-in 0.4s ease-out forwards;
}

.node-connector {
  position: absolute;
  top: 50%;
  right: 100%;
  height: 2rpx;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--success) 6%, transparent) 0%,
    color-mix(in srgb, var(--success) 55%, transparent) 100%
  );
  transform-origin: right center;
}

.node-body {
  width: 176rpx;
  min-height: 176rpx;
  padding: 18rpx 14rpx;
  border-radius: 28rpx;
  background: var(--bg-card);
  border: 2rpx solid;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.node-glow {
  position: absolute;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  opacity: 0.55;
}

.node-icon,
.node-title,
.node-progress,
.node-count {
  position: relative;
  z-index: 1;
}

.node-icon {
  color: var(--text-main);
}

.node-title {
  margin-top: 8rpx;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  color: var(--text-primary);
}

.node-progress {
  width: 100%;
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  margin-top: 10rpx;
}

.progress-bar {
  flex: 1;
  height: 8rpx;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 999rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999rpx;
}

.progress-text,
.node-count {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.node-count {
  margin-top: 8rpx;
}

.knowledge-node.node-active .node-body {
  transform: scale(1.06);
  box-shadow: 0 16rpx 40rpx rgba(52, 199, 89, 0.22);
}

.child-node {
  margin-left: -58rpx;
  margin-top: -58rpx;
  animation: child-in 0.25s ease-out forwards;
}

.child-body {
  width: 116rpx;
  height: 116rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.child-icon {
  color: var(--text-main);
}

.child-title {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-primary);
}

.child-mastery {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
}

.info-grid {
  display: grid;
  gap: 18rpx;
  margin-top: 20rpx;
}

.legend-items,
.path-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.legend-item,
.path-item {
  display: flex;
  align-items: center;
}

.legend-item {
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.legend-dot {
  margin-right: 12rpx;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
}

.legend-dot.weak {
  background: var(--danger);
}

.legend-dot.learning {
  background: var(--warning);
}

.legend-dot.solid {
  background: var(--primary);
}

.legend-dot.master {
  background: var(--success);
}

.legend-text,
.weak-copy,
.weak-next,
.path-time {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.weak-summary {
  display: flex;
  align-items: baseline;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.weak-count {
  font-size: 56rpx;
  line-height: 1;
  font-weight: 800;
  color: var(--purple-light, #ce82ff);
}

.weak-next {
  margin-top: 14rpx;
  line-height: 1.6;
}

.path-item {
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 18rpx 18rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.path-index {
  width: 68rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-secondary);
}

.path-meta {
  flex: 1;
}

.path-name {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.path-time {
  margin-top: 6rpx;
}

.floating-panel {
  position: fixed;
  left: 20rpx;
  right: 20rpx;
  bottom: calc(20rpx + env(safe-area-inset-bottom));
  z-index: 120;
  padding: 18rpx 22rpx 22rpx;
  border-radius: 32rpx;
  animation: panel-in 0.22s ease-out;
}

.panel-handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 auto 16rpx;
}

.panel-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}

.panel-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-title-area {
  flex: 1;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.panel-subtitle {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.panel-close {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background);
  color: var(--text-primary);
  font-size: 36rpx;
}

.panel-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.panel-stat {
  padding: 16rpx;
  border-radius: 22rpx;
  text-align: center;
}

.panel-stat-value {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--purple-light, #ce82ff);
}

.panel-stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

.panel-actions {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  margin-top: 18rpx;
}

.panel-btn + .panel-btn {
  margin-left: 12rpx;
}

.panel-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 10rpx;
  border-radius: 999rpx;
  background: var(--background);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  color: var(--text-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.panel-btn.primary {
  background: var(--purple-light, #ce82ff);
  border-color: #b065e6;
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #a458d9;
}

.bottom-spacer {
  height: 220rpx;
}

.nav-back:active,
.nav-refresh:active,
.quick-action:active,
.node-body:active,
.child-body:active,
.weak-card:active,
.panel-btn:active,
.panel-close:active,
.center-node:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 48%, var(--background) 100%);
}

.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 16% 12%, rgba(10, 132, 255, 0.2) 0%, transparent 32%),
    radial-gradient(circle at 84% 18%, rgba(69, 159, 255, 0.12) 0%, transparent 26%),
    radial-gradient(circle at 50% 82%, rgba(32, 83, 170, 0.16) 0%, transparent 32%);
}

.dark-mode .hero-card,
.dark-mode .graph-card,
.dark-mode .legend-card,
.dark-mode .weak-card,
.dark-mode .path-card,
.dark-mode .loading-card,
.dark-mode .floating-panel,
.dark-mode .center-node,
.dark-mode .node-body,
.dark-mode .child-body,
.dark-mode .hero-stat,
.dark-mode .quick-action,
.dark-mode .path-item,
.dark-mode .panel-stat,
.dark-mode .panel-btn,
.dark-mode .panel-close,
.dark-mode .nav-back,
.dark-mode .nav-refresh {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .graph-stage {
  background:
    radial-gradient(circle at 50% 50%, rgba(10, 132, 255, 0.16) 0%, transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .progress-bar,
.dark-mode .panel-handle {
  background: rgba(255, 255, 255, 0.12);
}

.dark-mode .node-connector {
  background: linear-gradient(90deg, rgba(10, 132, 255, 0.04) 0%, rgba(10, 132, 255, 0.44) 100%);
}

.dark-mode .panel-btn.primary {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes node-in {
  from {
    opacity: 0;
    transform: scale(0.86);
  }

  to {
    opacity: 1;
  }
}

@keyframes child-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }

  to {
    opacity: 1;
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(30rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 知识引擎增强：推荐学习 & 学习路径 */
.recommended-topic {
  margin: 20rpx 30rpx;
  padding: 30rpx;
}
.recommended-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.recommended-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}
.recommended-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.recommended-body {
  padding-left: 48rpx;
}
.recommended-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}
.recommended-reason {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
  display: block;
}
.recommended-mastery-bar {
  width: 100%;
  height: 8rpx;
  background: var(--bg-tertiary);
  border-radius: 4rpx;
  overflow: hidden;
  margin-top: 16rpx;
}
.recommended-mastery-fill {
  height: 100%;
  border-radius: 4rpx;
  background: linear-gradient(90deg, var(--primary), var(--success));
  transition: width 0.6s ease;
}
.recommended-mastery-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 6rpx;
}

.study-path-section {
  margin: 20rpx 30rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
}
.study-path-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.path-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary);
}
.path-status-blocked {
  opacity: 0.5;
}
.path-status-mastered {
  opacity: 0.7;
}
.path-index {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  background: var(--primary);
  color: var(--text-inverse);
}
.path-status-blocked .path-index {
  background: var(--text-tertiary);
}
.path-status-mastered .path-index {
  background: var(--success);
}
.path-content {
  flex: 1;
}
.path-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}
.path-mastery-bar {
  width: 100%;
  height: 6rpx;
  background: var(--bg-tertiary);
  border-radius: 3rpx;
  overflow: hidden;
  margin-top: 8rpx;
}
.path-mastery-fill {
  height: 100%;
  border-radius: 3rpx;
  background: var(--primary);
  transition: width 0.6s ease;
}
.path-badge-text {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.badge-mastered {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}
.badge-ready {
  background: rgba(0, 122, 255, 0.15);
  color: var(--primary);
}
.badge-blocked {
  background: rgba(142, 142, 147, 0.15);
  color: var(--text-tertiary);
}
</style>
