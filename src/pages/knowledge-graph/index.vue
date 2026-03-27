<template>
  <view :class="['knowledge-graph-page', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="handleBack">
          <text class="back-icon"> ← </text>
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
          <text class="recommended-icon">🎯</text>
          <text class="recommended-title">推荐下一步学习</text>
        </view>
        <view class="recommended-body">
          <text class="recommended-name">{{ recommendedTopic.knowledgePoint }}</text>
          <text class="recommended-reason">{{ recommendedTopic.reason }}</text>
          <view class="recommended-mastery-bar">
            <view class="recommended-mastery-fill" :style="{ width: recommendedTopic.mastery + '%' }" />
          </view>
          <text class="recommended-mastery-label">当前掌握度 {{ recommendedTopic.mastery }}%</text>
        </view>
      </view>

      <!-- 学习路径 -->
      <view v-if="studyPath.length > 0" class="study-path-section">
        <text class="section-title">📚 学习路径</text>
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
                <view class="path-mastery-fill" :style="{ width: item.mastery + '%' }" />
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
          style="display: flex; gap: 16rpx; padding-right: 24rpx; align-items: center; white-space: nowrap"
        >
          <wd-button size="small" type="primary" plain @click="showMasteryStats">
            <BaseIcon name="chart-bar" :size="24" style="margin-right: 4rpx" />掌握分布
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
          <text>×</text>
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
        <view class="detail-actions" style="display: flex; gap: 16rpx">
          <wd-button block style="flex: 1" @click="goPractice(activeNodeData)">普通练习</wd-button>
          <wd-button type="warning" block style="flex: 1" @click="summonAITutor(activeNodeData)">
            召唤 AI 特训
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<script>
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
  getStrongConnections,
  MASTERY_LEVELS
} from './knowledge-graph.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { getSmartStudyPath, getKnowledgeMapData, getNextRecommendedTopic } from '@/services/knowledge-engine.js';

export default {
  components: { BaseIcon },
  data() {
    return {
      detailModalVisible: false,
      activeNodeData: null,
      statusBarHeight: 44,
      isDark: false,
      isLoading: true,
      isRefreshing: false,
      activeNodeId: null,
      selectedNode: null,
      expandedChildren: [],

      // 知识节点数据（从 knowledge-graph.js 加载）
      knowledgeNodes: [],

      // 图谱边数据
      graphEdges: [],

      // 薄弱知识点
      weakNodes: [],

      // 学习路径建议
      learningPath: [],

      // 掌握度分布
      masteryDistribution: null,

      // 知识关联分析
      connectionAnalysis: null,

      // 个性化学习计划
      personalizedPlan: null,

      // 显示模式：'graph' | 'list' | 'path' | 'plan'
      viewMode: 'graph',

      // 掌握度等级配置
      MASTERY_LEVELS,

      // 知识引擎增强数据
      studyPath: [],
      recommendedTopic: null,
      knowledgeMapNodes: [],
      knowledgeMapEdges: []
    };
  },

  computed: {
    totalNodes() {
      return this.knowledgeNodes.length;
    },

    totalQuestions() {
      // F016: 修复属性名 — 映射后的节点使用 count 而非 value/totalQuestions
      return this.knowledgeNodes.reduce((sum, node) => sum + (node.count || node.value || 0), 0);
    },

    // F016: 移除未使用的 sortedByMastery 计算属性
    weakNodesList() {
      return [...this.knowledgeNodes].sort(
        (a, b) => (a.correctRate || a.mastery || 0) - (b.correctRate || b.mastery || 0)
      );
    }
  },

  onLoad() {
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    this.initData();
    this.loadKnowledgeData();
  },

  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
  },

  methods: {
    async onPullRefresh() {
      this.isRefreshing = true;
      try {
        await this.loadKnowledgeData();
      } catch (_e) {
        /* silent */
      }
      this.isRefreshing = false;
    },
    summonAITutor(node) {
      if (!node) return;
      toast.loading('AI 导师组卷中...');
      setTimeout(() => {
        toast.hide();
        uni.navigateTo({
          url: `/pages/practice-sub/do-quiz?mode=ai_tutor&topic=${encodeURIComponent(node.title)}`
        });
        this.detailModalVisible = false;
      }, 1500);
    },
    initData() {
      this.statusBarHeight = getStatusBarHeight();
    },

    async loadKnowledgeData() {
      this.isLoading = true;

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

        // 转换节点数据格式
        this.knowledgeNodes = graphData.nodes.map((node, _index) => ({
          id: node.id,
          title: node.name,
          count: node.value || 0,
          icon: this.getCategoryIcon(node.category),
          mastery: node.accuracy || 0,
          color: node.itemStyle?.color || this.getMasteryColor(node.accuracy || 0),
          level: 1,
          correctRate: node.accuracy || 0,
          reviewCount: 0,
          masteryLevel: node.masteryLevel || 'weak',
          category: node.category
        }));

        // 获取边数据
        this.graphEdges = graphData.edges;

        // 获取薄弱知识点
        this.weakNodes = getWeakNodes(5);

        // 获取掌握度分布
        this.masteryDistribution = getMasteryDistribution();

        // 获取学习路径建议
        this.learningPath = getLearningPath();

        // 分析知识关联
        this.connectionAnalysis = analyzeKnowledgeConnections();

        // 生成个性化学习计划
        this.personalizedPlan = generatePersonalizedPlan({
          duration: 30,
          dailyTime: 2,
          focusAreas: Object.keys(
            this.knowledgeNodes.reduce((acc, node) => {
              acc[node.category] = true;
              return acc;
            }, {})
          )
        });

        // 如果没有数据，显示默认节点
        if (this.knowledgeNodes.length === 0) {
          this.knowledgeNodes = this.getDefaultNodes(questionBank.length, mistakes.length);
        }

        // 知识引擎增强：加载学习路径和推荐
        try {
          const allQuestions = storageService.get('v30_bank', []);
          this.studyPath = getSmartStudyPath(allQuestions);
          this.recommendedTopic = getNextRecommendedTopic(allQuestions);
          const mapData = getKnowledgeMapData(allQuestions);
          this.knowledgeMapNodes = mapData.nodes;
          this.knowledgeMapEdges = mapData.edges;
        } catch (e) {
          console.warn('[KnowledgeGraph] 知识引擎加载失败:', e);
        }

        logger.log('[KnowledgeGraph] 数据加载完成:', {
          nodes: this.knowledgeNodes.length,
          edges: this.graphEdges.length,
          weakNodes: this.weakNodes.length,
          distribution: this.masteryDistribution,
          connections: this.connectionAnalysis
        });
      } catch (error) {
        logger.error('[KnowledgeGraph] 加载数据失败:', error);
        // 降级到默认数据
        this.knowledgeNodes = this.getDefaultNodes(0, 0);
        toast.info('数据加载失败');
      } finally {
        this.isLoading = false;
      }
    },

    // 获取分类图标
    getCategoryIcon(category) {
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
    },

    // 根据掌握度获取颜色
    getMasteryColor(accuracy) {
      if (accuracy >= 80) return '#10B981'; // 已掌握 - 绿色
      if (accuracy >= 60) return '#3B82F6'; // 熟练 - 蓝色
      if (accuracy >= 40) return '#F59E0B'; // 学习中 - 橙色
      return '#EF4444'; // 薄弱 - 红色
    },

    // 获取默认节点数据
    getDefaultNodes(totalQuestions, mistakeCount) {
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
          count: Math.floor(totalQuestions * 0.3),
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
          count: totalQuestions,
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
          count: Math.floor(totalQuestions * 0.4),
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
          count: Math.floor(totalQuestions * 0.2),
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
          count: Math.floor(totalQuestions * 0.15),
          icon: 'books',
          mastery: Math.max(0, overallAccuracy - 15),
          color: '#EC4899',
          level: 1,
          correctRate: Math.max(0, overallAccuracy - 15),
          reviewCount: 0,
          category: '阅读理解'
        }
      ];
    },

    // 获取节点位置样式
    getNodeStyle(_node, index) {
      const total = this.knowledgeNodes.length;
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      const radius = 280; // 距离中心的半径

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
    },

    // 获取连接线样式
    getConnectorStyle(_node, index) {
      const total = this.knowledgeNodes.length;
      const angle = (index / total) * 360 - 90;

      return {
        transform: `rotate(${angle}deg)`,
        width: '200rpx'
      };
    },

    // 获取子节点样式
    getChildNodeStyle(child, index) {
      const angle = (index / this.expandedChildren.length) * 2 * Math.PI - Math.PI / 2;
      const radius = 150;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      return {
        transform: `translate(${x}rpx, ${y}rpx)`,
        animationDelay: `${index * 50}ms`
      };
    },

    handleBack() {
      safeNavigateBack();
    },

    handleRefresh() {
      toast.loading('刷新中...');
      this.loadKnowledgeData()
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
    },

    handleCenterClick() {
      // 震动反馈
      try {
        uni.vibrateShort();
      } catch (_e) {
        /* vibrateShort not supported on this device */
      }

      toast.info(`共 ${this.totalNodes} 个知识点`);
    },

    handleNodeClick(node) {
      if (this.activeNodeId === node.id) {
        this.activeNodeId = null;
        this.activeNodeData = null;
        this.detailModalVisible = false;
      } else {
        this.activeNodeId = node.id;
        this.activeNodeData = node;
        this.detailModalVisible = true;
        this.refreshChart(node);
      }
    },

    handleChildClick(child) {
      logger.log('[KnowledgeGraph] 子节点点击:', child.title);
      toast.info(child.title);
    },

    startPractice(node) {
      logger.log('[KnowledgeGraph] 开始练习:', node.title);

      // 定义路由映射：tabBar 页面和普通页面分开处理
      const tabBarPages = [
        '/pages/practice/index',
        '/pages/profile/index',
        '/pages/index/index',
        '/pages/school/index'
      ];

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
    },

    viewDetails(node) {
      logger.log('[KnowledgeGraph] 查看详情:', node.title);

      // 获取节点详情（包含关联节点）
      const detail = knowledgeGraphManager.getNodeDetail(node.id);

      const content = detail
        ? `题目数量：${detail.totalQuestions || node.count}\n掌握度：${detail.accuracy || node.mastery}%\n正确率：${node.correctRate || 0}%\n复习次数：${node.reviewCount || 0}\n关联知识点：${detail.relatedCount || 0}个`
        : `题目数量：${node.count}\n掌握度：${node.mastery}%\n正确率：${node.correctRate || 0}%\n复习次数：${node.reviewCount || 0}`;

      uni.showModal({
        title: node.title,
        content,
        showCancel: false,
        confirmText: '知道了'
      });
    },

    // 切换视图模式
    switchViewMode(mode) {
      this.viewMode = mode;
      try {
        uni.vibrateShort();
      } catch (_e) {
        /* vibrateShort not supported on this device */
      }
    },

    // 显示学习路径
    showLearningPath() {
      if (this.learningPath.length === 0) {
        toast.info('暂无学习建议');
        return;
      }

      const pathText = this.learningPath
        .map((item, index) => `${index + 1}. ${item.node.name} (${item.estimatedTime})`)
        .join('\n');

      uni.showModal({
        title: '推荐学习路径',
        content: pathText,
        showCancel: false,
        confirmText: '开始学习'
      });
    },

    // 显示掌握度分布
    showMasteryStats() {
      if (!this.masteryDistribution) {
        toast.info('暂无统计数据');
        return;
      }

      const { percentages } = this.masteryDistribution;
      const content = `已掌握 (≥80%): ${percentages.master}%\n熟练 (60-79%): ${percentages.proficient}%\n学习中 (40-59%): ${percentages.learning}%\n薄弱 (<40%): ${percentages.weak}%`;

      uni.showModal({
        title: '知识掌握度分布',
        content,
        showCancel: false,
        confirmText: '知道了'
      });
    },

    // 显示薄弱知识点
    showWeakNodes() {
      if (this.weakNodes.length === 0) {
        toast.info('暂无薄弱知识点');
        return;
      }

      const weakText = this.weakNodes
        .map(
          (node, index) =>
            `${index + 1}. ${node.name} (${node.accuracy}%)\n   ${node.improvementSuggestion || '建议多做练习'}`
        )
        .join('\n\n');

      uni.showModal({
        title: '薄弱知识点',
        content: weakText,
        confirmText: '生成学习计划',
        cancelText: '开始练习',
        success: (res) => {
          if (res.confirm) {
            // 生成学习计划
            this.generateLearningPlan();
          } else if (res.cancel && this.weakNodes.length > 0) {
            // 跳转到练习页面
            uni.switchTab({
              url: '/pages/practice/index',
              fail: () => uni.reLaunch({ url: '/pages/practice/index' })
            });
          }
        }
      });
    },

    // 显示知识关联分析
    showConnectionAnalysis() {
      if (!this.connectionAnalysis) {
        toast.info('暂无关联数据');
        return;
      }

      const { totalEdges, edgeTypes, strongConnections, isolatedNodes } = this.connectionAnalysis;
      const edgeTypesText = Object.entries(edgeTypes)
        .map(([type, count]) => `${type}: ${count}个`)
        .join('\n');

      const content = `总关联数：${totalEdges}个\n\n关联类型：\n${edgeTypesText}\n\n强关联：${strongConnections.length}个\n孤立知识点：${isolatedNodes.length}个`;

      uni.showModal({
        title: '知识关联分析',
        content,
        showCancel: false,
        confirmText: '知道了'
      });
    },

    // 显示个性化学习计划
    showPersonalizedPlan() {
      if (!this.personalizedPlan) {
        toast.info('暂无学习计划');
        return;
      }

      const { title, duration, dailyTime, milestones } = this.personalizedPlan;
      const milestonesText = milestones
        .map(
          (milestone, index) => `${index + 1}. ${milestone.title} (${milestone.days}天)\n   ${milestone.description}`
        )
        .join('\n\n');

      const content = `计划时长：${duration}天\n每天学习：${dailyTime}小时\n\n里程碑：\n${milestonesText}`;

      uni.showModal({
        title,
        content,
        confirmText: '查看详情',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            this.switchViewMode('plan');
          }
        }
      });
    },

    // 显示节点的强关联
    showNodeConnections(node) {
      const connections = getStrongConnections(node.id, 3);
      if (connections.length === 0) {
        toast.info('暂无关联知识点');
        return;
      }

      const connectionsText = connections
        .map((conn, index) => `${index + 1}. ${conn.node.name} (强度: ${conn.strength})\n   关系: ${conn.relationship}`)
        .join('\n\n');

      uni.showModal({
        title: `${node.title} 的关联知识点`,
        content: connectionsText,
        showCancel: false,
        confirmText: '知道了'
      });
    },

    // 加载节点的子节点（关联知识点）
    loadExpandedChildren(node) {
      const connections = getStrongConnections(node.id, 5);
      if (connections.length > 0) {
        this.expandedChildren = connections.map((conn, idx) => ({
          id: `child_${node.id}_${idx}`,
          title: conn.node.name,
          icon: this.getCategoryIcon(conn.node.category),
          mastery: conn.node.accuracy || 0,
          parentId: node.id
        }));
      } else {
        // 没有关联数据时，根据同类别节点生成子节点
        const sameCategory = this.knowledgeNodes.filter((n) => n.category === node.category && n.id !== node.id);
        this.expandedChildren = sameCategory.slice(0, 4).map((n, idx) => ({
          id: `child_${node.id}_${idx}`,
          title: n.title,
          icon: n.icon,
          mastery: n.mastery,
          parentId: node.id
        }));
      }
    },

    // 生成学习计划
    generateLearningPlan() {
      toast.loading('生成学习计划...');

      setTimeout(() => {
        try {
          const plan = generatePersonalizedPlan({
            duration: 30,
            dailyTime: 2,
            focusAreas: this.weakNodes.map((node) => node.name),
            learningStyle: 'balanced'
          });

          this.personalizedPlan = plan;
          toast.hide();
          toast.success('学习计划生成成功');
          this.showPersonalizedPlan();
        } catch (error) {
          toast.hide();
          logger.error('[KnowledgeGraph] 生成学习计划失败:', error);
          toast.info('生成失败，请重试');
        }
      }, 1000);
    }
  }
};
</script>

<style lang="scss" scoped>
.knowledge-graph-page {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 54%,
    var(--page-gradient-bottom) 100%
  );
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
    radial-gradient(circle at 16% 12%, rgba(107, 208, 150, 0.28) 0%, transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(255, 255, 255, 0.34) 0%, transparent 24%),
    radial-gradient(circle at 50% 82%, rgba(72, 190, 128, 0.18) 0%, transparent 28%);
  filter: blur(34px);
  pointer-events: none;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 38%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
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
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
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
  font-weight: 650;
  color: var(--text-main);
}

.nav-subtitle {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-sub);
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
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
  font-weight: 700;
  color: var(--text-main);
}

.hero-subtitle {
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-sub);
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
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.hero-stat {
  padding: 18rpx 16rpx;
  border-radius: 22rpx;
  text-align: center;
}

.hero-stat-value {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-main);
}

.hero-stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-sub);
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
  border: 4rpx solid rgba(52, 199, 89, 0.16);
  border-top-color: rgba(52, 199, 89, 0.88);
  animation: spin 1s linear infinite;
}

.loading-title {
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 650;
  color: var(--text-main);
}

.loading-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-sub);
}

.section-header {
  margin-bottom: 22rpx;
}

.section-header.compact {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 650;
  color: var(--text-main);
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
  background: rgba(52, 199, 89, 0.18);
}

.graph-glow-b {
  right: 90rpx;
  bottom: 180rpx;
  width: 260rpx;
  height: 260rpx;
  background: rgba(10, 132, 255, 0.12);
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 44%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.82) 0%, rgba(240, 250, 243, 0.5) 100%);
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow: 0 18rpx 48rpx rgba(32, 76, 44, 0.16);
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
  font-weight: 680;
  color: var(--text-main);
}

.center-subtitle {
  width: 150rpx;
  text-align: center;
  font-size: 20rpx;
  line-height: 1.4;
  color: var(--text-sub);
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
  background: linear-gradient(90deg, rgba(52, 199, 89, 0.06) 0%, rgba(52, 199, 89, 0.55) 100%);
  transform-origin: right center;
}

.node-body {
  width: 176rpx;
  min-height: 176rpx;
  padding: 18rpx 14rpx;
  border-radius: 38rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, transparent 44%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.82) 0%, rgba(244, 248, 245, 0.52) 100%);
  border: 2rpx solid;
  box-shadow: var(--apple-shadow-surface);
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
  font-weight: 620;
  line-height: 1.3;
  text-align: center;
  color: var(--text-main);
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
  font-size: 19rpx;
  color: var(--text-sub);
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
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.44);
  box-shadow: var(--apple-shadow-surface);
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
  font-size: 18rpx;
  line-height: 1.2;
  color: var(--text-main);
}

.child-mastery {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: var(--text-sub);
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
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
}

.legend-dot.weak {
  background: #ef4444;
}

.legend-dot.learning {
  background: #f59e0b;
}

.legend-dot.solid {
  background: #3b82f6;
}

.legend-dot.master {
  background: #10b981;
}

.legend-text,
.weak-copy,
.weak-next,
.path-time {
  font-size: 24rpx;
  color: var(--text-sub);
}

.weak-summary {
  display: flex;
  align-items: baseline;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.weak-count {
  font-size: 56rpx;
  line-height: 1;
  font-weight: 720;
  color: var(--ds-color-error, #ff3b30);
}

.weak-next {
  margin-top: 14rpx;
  line-height: 1.6;
}

.path-item {
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 18rpx 18rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
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
  font-weight: 620;
  color: var(--text-main);
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
  font-weight: 680;
  color: var(--text-main);
}

.panel-subtitle {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: var(--text-sub);
}

.panel-close {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.56);
  color: var(--text-main);
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
  font-weight: 700;
  color: var(--text-main);
}

.panel-stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-sub);
}

.panel-actions {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  margin-top: 18rpx;
}

.panel-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  color: var(--text-main);
  font-size: 24rpx;
  font-weight: 620;
}

.panel-btn.primary {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
  color: var(--cta-primary-text);
  box-shadow: var(--cta-primary-shadow);
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
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
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
  color: white;
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
  background: rgba(52, 199, 89, 0.15);
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
