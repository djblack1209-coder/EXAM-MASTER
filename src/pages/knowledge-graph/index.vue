<template>
  <view class="knowledge-graph-container">
    <!-- 顶部导航栏 -->
    <view class="nav-header glassmorphism" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" hover-class="item-hover" @tap="handleBack">
          <text class="back-icon">
            ←
          </text>
        </view>
        <text class="nav-title">
          知识图谱
        </text>
        <view class="nav-actions">
          <view class="action-btn" hover-class="item-hover" @tap="showMasteryStats">
            <text class="action-icon">
              <BaseIcon name="chart-bar" :size="28" />
            </text>
          </view>
          <view class="action-btn" hover-class="item-hover" @tap="showLearningPath">
            <text class="action-icon">
              <BaseIcon name="path" :size="28" />
            </text>
          </view>
          <view class="action-btn" hover-class="item-hover" @tap="showConnectionAnalysis">
            <text class="action-icon">
              <BaseIcon name="link" :size="28" />
            </text>
          </view>
          <view class="action-btn" hover-class="item-hover" @tap="showPersonalizedPlan">
            <text class="action-icon">
              <BaseIcon name="note" :size="28" />
            </text>
          </view>
          <view class="action-btn" hover-class="item-hover" @tap="handleRefresh">
            <text class="action-icon">
              <BaseIcon name="refresh" :size="28" />
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-if="isLoading" class="loading-overlay">
      <view class="loading-spinner" />
      <text class="loading-text">
        正在构建知识图谱...
      </text>
    </view>

    <!-- 知识图谱主体 -->
    <scroll-view
      scroll-y
      scroll-x
      class="graph-scroll-view"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
    >
      <!-- 图谱容器 -->
      <view class="graph-container">
        <!-- 中心节点 -->
        <view class="center-node" hover-class="item-hover" @tap="handleCenterClick">
          <view class="center-glow" />
          <view class="center-content">
            <text class="center-icon">
              <BaseIcon name="target" :size="36" />
            </text>
            <text class="center-title">
              知识体系
            </text>
            <text class="center-subtitle">
              {{ totalNodes }} 个知识点 · {{ totalQuestions }} 题
            </text>
          </view>
        </view>

        <!-- 知识节点 -->
        <view
          v-for="(node, index) in knowledgeNodes"
          :key="node.id"
          :class="['knowledge-node', 'node-level-' + node.level, activeNodeId === node.id && 'node-active']"
          :style="getNodeStyle(node, index)"
          hover-class="item-hover"
          @tap="handleNodeClick(node)"
        >
          <!-- 连接线 -->
          <view class="node-connector" :style="getConnectorStyle(node, index)" />

          <!-- 节点内容 -->
          <view class="node-body" :style="{ borderColor: node.color }">
            <view
              class="node-glow"
              :style="{ background: `radial-gradient(circle, ${node.color}40 0%, transparent 70%)` }"
            />
            <text class="node-icon">
              <BaseIcon :name="node.icon" :size="28" />
            </text>
            <text class="node-title">
              {{ node.title }}
            </text>
            <view class="node-progress">
              <view class="progress-bar">
                <view class="progress-fill" :style="{ width: node.mastery + '%', backgroundColor: node.color }" />
              </view>
              <text class="progress-text">
                {{ node.mastery }}%
              </text>
            </view>
            <text class="node-count">
              {{ node.count }} 题
            </text>
          </view>
        </view>

        <!-- 子节点（展开时显示） -->
        <view
          v-for="(child, idx) in expandedChildren"
          :key="child.id"
          class="child-node"
          :style="getChildNodeStyle(child, idx)"
          hover-class="item-hover"
          @tap="handleChildClick(child)"
        >
          <view class="child-body">
            <text class="child-icon">
              <BaseIcon :name="child.icon" :size="22" />
            </text>
            <text class="child-title">
              {{ child.title }}
            </text>
            <text class="child-mastery">
              {{ child.mastery }}%
            </text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部信息面板 -->
    <view v-if="selectedNode" class="info-panel glassmorphism">
      <view class="panel-header">
        <view class="panel-icon" :style="{ backgroundColor: selectedNode.color + '20' }">
          <BaseIcon :name="selectedNode.icon" :size="32" />
        </view>
        <view class="panel-title-area">
          <text class="panel-title">
            {{ selectedNode.title }}
          </text>
          <text class="panel-subtitle">
            掌握度 {{ selectedNode.mastery }}%
          </text>
        </view>
        <view class="panel-close" hover-class="item-hover" @tap="selectedNode = null">
          <text>×</text>
        </view>
      </view>
      <view class="panel-stats">
        <view class="stat-item">
          <text class="stat-value">
            {{ selectedNode.count }}
          </text>
          <text class="stat-label">
            题目数
          </text>
        </view>
        <view class="stat-item">
          <text class="stat-value">
            {{ selectedNode.correctRate || 0 }}%
          </text>
          <text class="stat-label">
            正确率
          </text>
        </view>
        <view class="stat-item">
          <text class="stat-value">
            {{ selectedNode.reviewCount || 0 }}
          </text>
          <text class="stat-label">
            复习次数
          </text>
        </view>
      </view>
      <view class="panel-actions">
        <view class="panel-btn btn-primary" hover-class="item-hover" @tap="startPractice(selectedNode)">
          <text>开始练习</text>
        </view>
        <view class="panel-btn btn-outline" hover-class="item-hover" @tap="viewDetails(selectedNode)">
          <text>查看详情</text>
        </view>
      </view>
    </view>

    <!-- 图例说明 -->
    <view class="legend-panel glassmorphism">
      <text class="legend-title">
        掌握度
      </text>
      <view class="legend-items">
        <view class="legend-item">
          <view class="legend-dot" style="background: #ef4444" />
          <text>薄弱 (&lt;40%)</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot" style="background: #f59e0b" />
          <text>学习中 (40-59%)</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot" style="background: #3b82f6" />
          <text>熟练 (60-79%)</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot" style="background: #10b981" />
          <text>已掌握 (≥80%)</text>
        </view>
      </view>
    </view>

    <!-- 薄弱知识点提示 -->
    <view
      v-if="weakNodes.length > 0"
      class="weak-hint glassmorphism"
      hover-class="item-hover"
      @tap="showWeakNodes"
    >
      <text class="weak-icon">
        <BaseIcon name="warning" :size="28" />
      </text>
      <text class="weak-text">
        {{ weakNodes.length }} 个薄弱知识点需要加强
      </text>
      <text class="weak-arrow">
        ›
      </text>
    </view>
  </view>
</template>

<script>
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
import { safeNavigateTo } from '@/utils/safe-navigate';
import { getStatusBarHeight } from '@/utils/core/system.js';

export default {
  components: { BaseIcon },
  data() {
    return {
      statusBarHeight: 44,
      isLoading: true,
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
      MASTERY_LEVELS
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
    this.initData();
    this.loadKnowledgeData();
  },

  methods: {
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
        uni.showToast({ title: '数据加载失败', icon: 'none' });
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

      return {
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
      uni.navigateBack({
        delta: 1,
        fail: () => {
          uni.reLaunch({ url: '/pages/index/index' });
        }
      });
    },

    handleRefresh() {
      uni.showLoading({ title: '刷新中...' });
      this.loadKnowledgeData()
        .then(() => {
          uni.showToast({ title: '刷新成功', icon: 'success' });
        })
        .catch((error) => {
          logger.error('[KnowledgeGraph] 刷新失败:', error);
          uni.showToast({ title: '刷新失败', icon: 'none' });
        })
        .finally(() => {
          uni.hideLoading();
        });
    },

    handleCenterClick() {
      // 震动反馈
      try {
        uni.vibrateShort();
      } catch (_e) {
        /* vibrateShort not supported on this device */
      }

      uni.showToast({
        title: `共 ${this.totalNodes} 个知识点`,
        icon: 'none'
      });
    },

    handleNodeClick(node) {
      // 震动反馈
      try {
        uni.vibrateShort();
      } catch (_e) {
        /* vibrateShort not supported on this device */
      }

      // 如果点击的是已激活节点，收起子节点
      if (this.activeNodeId === node.id) {
        this.activeNodeId = null;
        this.selectedNode = null;
        this.expandedChildren = [];
        return;
      }

      this.activeNodeId = node.id;
      this.selectedNode = node;

      logger.log('[KnowledgeGraph] 节点点击:', node.title);

      // 展开关联子节点
      this.loadExpandedChildren(node);
    },

    handleChildClick(child) {
      logger.log('[KnowledgeGraph] 子节点点击:', child.title);
      uni.showToast({ title: child.title, icon: 'none' });
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
        uni.showToast({ title: '暂无学习建议', icon: 'none' });
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
        uni.showToast({ title: '暂无统计数据', icon: 'none' });
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
        uni.showToast({ title: '暂无薄弱知识点', icon: 'none' });
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
        uni.showToast({ title: '暂无关联数据', icon: 'none' });
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
        uni.showToast({ title: '暂无学习计划', icon: 'none' });
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
        uni.showToast({ title: '暂无关联知识点', icon: 'none' });
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
      uni.showLoading({ title: '生成学习计划...' });

      setTimeout(() => {
        try {
          const plan = generatePersonalizedPlan({
            duration: 30,
            dailyTime: 2,
            focusAreas: this.weakNodes.map((node) => node.name),
            learningStyle: 'balanced'
          });

          this.personalizedPlan = plan;
          uni.hideLoading();
          uni.showToast({ title: '学习计划生成成功', icon: 'success' });
          this.showPersonalizedPlan();
        } catch (error) {
          uni.hideLoading();
          logger.error('[KnowledgeGraph] 生成学习计划失败:', error);
          uni.showToast({ title: '生成失败，请重试', icon: 'none' });
        }
      }, 1000);
    }
  }
};
</script>

<style lang="scss" scoped>
.knowledge-graph-container {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%);
  position: relative;
  overflow: hidden;
}

// 导航栏
.nav-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 32rpx;
    height: 88rpx;
  }

  .nav-back {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);

    .back-icon {
      font-size: 40rpx;
      color: #fff;
    }
  }

  .nav-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #fff;
  }

  .nav-actions {
    display: flex;
    gap: 16rpx;

    .action-btn {
      width: 72rpx;
      height: 72rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);

      .action-icon {
        font-size: 36rpx;
        color: #fff;
      }
    }
  }
}

// 加载状态
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 26, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;

  .loading-spinner {
    width: 80rpx;
    height: 80rpx;
    border: 4rpx solid rgba(0, 242, 255, 0.2);
    border-top-color: #00f2ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    margin-top: 32rpx;
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.7);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 图谱滚动区域
.graph-scroll-view {
  width: 100%;
  height: 100%;
}

// 图谱容器
.graph-container {
  position: relative;
  width: 750rpx;
  height: 1200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 中心节点
.center-node {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
  border: 3rpx solid rgba(0, 242, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  .center-glow {
    position: absolute;
    width: 300rpx;
    height: 300rpx;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 242, 255, 0.3) 0%, transparent 70%);
    animation: pulse 2s ease-in-out infinite;
  }

  .center-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 1;

    .center-icon {
      font-size: 48rpx;
    }

    .center-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #fff;
      margin-top: 8rpx;
    }

    .center-subtitle {
      font-size: 22rpx;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 4rpx;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

// 知识节点
.knowledge-node {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-left: -80rpx;
  margin-top: -80rpx;
  animation: fadeIn 0.5s ease-out forwards;
  opacity: 0;

  .node-connector {
    position: absolute;
    top: 50%;
    right: 100%;
    height: 2rpx;
    background: linear-gradient(90deg, rgba(0, 242, 255, 0.1) 0%, rgba(0, 242, 255, 0.5) 100%);
    transform-origin: right center;
  }

  .node-body {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: rgba(26, 26, 46, 0.9);
    border: 2rpx solid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 0.3s ease;

    .node-glow {
      position: absolute;
      width: 200rpx;
      height: 200rpx;
      border-radius: 50%;
      opacity: 0.5;
    }

    .node-icon {
      font-size: 36rpx;
      z-index: 1;
    }

    .node-title {
      font-size: 22rpx;
      color: #fff;
      margin-top: 8rpx;
      z-index: 1;
    }

    .node-progress {
      display: flex;
      align-items: center;
      gap: 8rpx;
      margin-top: 8rpx;
      z-index: 1;

      .progress-bar {
        width: 60rpx;
        height: 6rpx;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3rpx;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          border-radius: 3rpx;
          transition: width 0.5s ease;
        }
      }

      .progress-text {
        font-size: 20rpx;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .node-count {
      font-size: 20rpx;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 4rpx;
      z-index: 1;
    }
  }

  &.node-active .node-body {
    transform: scale(1.1);
    box-shadow: 0 0 30rpx rgba(0, 242, 255, 0.5);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(0, 0) scale(0.5);
  }
  to {
    opacity: 1;
  }
}

// 子节点
.child-node {
  position: absolute;
  animation: childFadeIn 0.3s ease-out forwards;

  .child-body {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background: rgba(26, 26, 46, 0.8);
    border: 1rpx solid rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .child-icon {
      font-size: 28rpx;
    }

    .child-title {
      font-size: 20rpx;
      color: #fff;
      margin-top: 4rpx;
    }

    .child-mastery {
      font-size: 20rpx;
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

@keyframes childFadeIn {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
  }
}

// 信息面板
.info-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  z-index: 100;
  animation: slideUp 0.3s ease-out;

  .panel-header {
    display: flex;
    align-items: center;
    gap: 20rpx;

    .panel-icon {
      width: 80rpx;
      height: 80rpx;
      border-radius: 20rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40rpx;
    }

    .panel-title-area {
      flex: 1;

      .panel-title {
        display: block;
        font-size: 32rpx;
        font-weight: 600;
        color: #fff;
      }

      .panel-subtitle {
        display: block;
        font-size: 24rpx;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 4rpx;
      }
    }

    .panel-close {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40rpx;
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .panel-stats {
    display: flex;
    justify-content: space-around;
    margin-top: 32rpx;
    padding: 24rpx 0;
    border-top: 1rpx solid rgba(255, 255, 255, 0.1);
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

    .stat-item {
      text-align: center;

      .stat-value {
        display: block;
        font-size: 36rpx;
        font-weight: 600;
        color: #00f2ff;
      }

      .stat-label {
        display: block;
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 8rpx;
      }
    }
  }

  .panel-actions {
    display: flex;
    gap: 24rpx;
    margin-top: 32rpx;

    .panel-btn {
      flex: 1;
      height: 88rpx;
      border-radius: 44rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
      font-weight: 500;

      &.btn-primary {
        background: linear-gradient(135deg, #00f2ff 0%, #00b4d8 100%);
        color: #000;
      }

      &.btn-outline {
        background: transparent;
        border: 2rpx solid rgba(0, 242, 255, 0.5);
        color: #00f2ff;
      }
    }
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

// 图例面板
.legend-panel {
  position: fixed;
  top: 200rpx;
  right: 24rpx;
  background: rgba(26, 26, 46, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16rpx;
  padding: 20rpx;
  z-index: 50;

  .legend-title {
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 12rpx;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 12rpx;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .legend-dot {
        width: 16rpx;
        height: 16rpx;
        border-radius: 50%;
      }

      text {
        font-size: 20rpx;
        color: rgba(255, 255, 255, 0.6);
      }
    }
  }
}

// 薄弱知识点提示
.weak-hint {
  position: fixed;
  bottom: calc(32rpx + constant(safe-area-inset-bottom));
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  right: 24rpx;
  background: rgba(239, 68, 68, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  z-index: 50;

  .weak-icon {
    font-size: 32rpx;
  }

  .weak-text {
    flex: 1;
    font-size: 26rpx;
    color: #fff;
  }

  .weak-arrow {
    font-size: 32rpx;
    color: rgba(255, 255, 255, 0.7);
  }
}

// 玻璃态效果
.glassmorphism {
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* hover-class 反馈 */
.item-hover {
  opacity: 0.7;
}
</style>
