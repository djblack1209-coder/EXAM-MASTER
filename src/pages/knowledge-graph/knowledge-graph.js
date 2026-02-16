/**
 * 知识图谱可视化模块 - 展示知识点之间的关联关系
 *
 * 核心功能：
 * 1. 知识点节点管理 - 添加、更新、删除知识点
 * 2. 关联关系管理 - 建立知识点之间的联系
 * 3. 掌握度可视化 - 根据正确率显示不同颜色
 * 4. 图谱数据导出 - 生成可视化所需的数据结构
 * 5. 知识关联分析 - 深度分析知识点之间的关联强度
 * 6. 个性化学习路径 - 基于掌握度和关联度的智能学习路径
 * 7. 动态路径调整 - 根据学习进度自动调整学习计划
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  KNOWLEDGE_NODES: 'knowledge_graph_nodes',
  KNOWLEDGE_EDGES: 'knowledge_graph_edges',
  GRAPH_SETTINGS: 'knowledge_graph_settings'
};

// 预定义的知识点分类（考研常见科目）
const PREDEFINED_CATEGORIES = {
  politics: {
    name: '政治',
    color: '#E53935',
    subcategories: ['马原', '毛中特', '史纲', '思修', '时政']
  },
  english: {
    name: '英语',
    color: '#1E88E5',
    subcategories: ['阅读理解', '完形填空', '翻译', '写作', '词汇语法']
  },
  math: {
    name: '数学',
    color: '#43A047',
    subcategories: ['高等数学', '线性代数', '概率统计']
  },
  professional: {
    name: '专业课',
    color: '#FB8C00',
    subcategories: ['基础理论', '核心概念', '应用实践']
  }
};

// 掌握度等级配置
const MASTERY_LEVELS = {
  master: { min: 80, color: '#4CAF50', label: '已掌握', icon: '✓' },
  proficient: { min: 60, color: '#2196F3', label: '熟练', icon: '◐' },
  learning: { min: 40, color: '#FF9800', label: '学习中', icon: '○' },
  weak: { min: 0, color: '#F44336', label: '薄弱', icon: '✗' }
};

/**
 * 知识图谱管理器
 */
class KnowledgeGraphManager {
  constructor() {
    this.nodes = new Map(); // 知识点节点
    this.edges = []; // 关联边
    this.settings = {
      showMasteryColors: true,
      showEdgeLabels: true,
      layoutType: 'force', // force | tree | radial
      nodeSize: 'dynamic' // dynamic | fixed
    };
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;
    this._loadNodes();
    this._loadEdges();
    this._loadSettings();
    this.isInitialized = true;
    logger.log('[KnowledgeGraph] 初始化完成');
  }

  /**
   * 添加或更新知识点
   * @param {Object} nodeData - 知识点数据
   * @returns {Object} 添加的节点
   */
  addNode(nodeData) {
    this.init();

    const node = {
      id: nodeData.id || this._generateId(),
      name: nodeData.name,
      category: nodeData.category || 'professional',
      subcategory: nodeData.subcategory || '',
      description: nodeData.description || '',
      // 学习数据
      totalQuestions: nodeData.totalQuestions || 0,
      correctQuestions: nodeData.correctQuestions || 0,
      accuracy: nodeData.accuracy || 0,
      masteryLevel: this._calculateMasteryLevel(nodeData.accuracy || 0),
      // 元数据
      createdAt: nodeData.createdAt || Date.now(),
      updatedAt: Date.now(),
      // 可视化属性
      x: nodeData.x || Math.random() * 300,
      y: nodeData.y || Math.random() * 300,
      size: nodeData.size || 30,
      color: this._getNodeColor(nodeData)
    };

    this.nodes.set(node.id, node);
    this._saveNodes();

    return node;
  }

  /**
   * 更新知识点学习数据
   * @param {string} nodeId - 节点ID
   * @param {Object} learningData - 学习数据
   */
  updateNodeLearning(nodeId, learningData) {
    this.init();

    const node = this.nodes.get(nodeId);
    if (!node) {
      console.warn('[KnowledgeGraph] 节点不存在:', nodeId);
      return null;
    }

    // 更新学习数据
    node.totalQuestions += learningData.questionsAnswered || 0;
    node.correctQuestions += learningData.correctAnswers || 0;
    node.accuracy = node.totalQuestions > 0
      ? Math.round((node.correctQuestions / node.totalQuestions) * 100)
      : 0;
    node.masteryLevel = this._calculateMasteryLevel(node.accuracy);
    node.color = this._getNodeColor(node);
    node.updatedAt = Date.now();

    this.nodes.set(nodeId, node);
    this._saveNodes();

    return node;
  }

  /**
   * 根据名称查找或创建知识点
   * @param {string} name - 知识点名称
   * @param {string} category - 分类
   * @returns {Object} 节点
   */
  findOrCreateNode(name, category = 'professional') {
    this.init();

    // 查找已存在的节点
    for (const node of this.nodes.values()) {
      if (node.name === name) {
        return node;
      }
    }

    // 创建新节点
    return this.addNode({ name, category });
  }

  /**
   * 添加知识点关联
   * @param {string} sourceId - 源节点ID
   * @param {string} targetId - 目标节点ID
   * @param {Object} edgeData - 边数据
   * @returns {Object} 添加的边
   */
  addEdge(sourceId, targetId, edgeData = {}) {
    this.init();

    // 检查节点是否存在
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      console.warn('[KnowledgeGraph] 节点不存在');
      return null;
    }

    // 检查边是否已存在
    const existingEdge = this.edges.find(
      (e) => (e.source === sourceId && e.target === targetId) ||
           (e.source === targetId && e.target === sourceId)
    );

    if (existingEdge) {
      // 更新已有边
      existingEdge.weight = (existingEdge.weight || 1) + 1;
      existingEdge.updatedAt = Date.now();
      this._saveEdges();
      return existingEdge;
    }

    // 创建新边
    const edge = {
      id: this._generateId(),
      source: sourceId,
      target: targetId,
      type: edgeData.type || 'related', // related | prerequisite | similar
      label: edgeData.label || '',
      weight: edgeData.weight || 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.edges.push(edge);
    this._saveEdges();

    return edge;
  }

  /**
   * 从题目数据自动构建知识图谱
   * @param {Array} questions - 题目数组
   * @param {Array} mistakeRecords - 错题记录
   */
  buildFromQuestions(questions, mistakeRecords = []) {
    this.init();

    // 统计每个知识点的数据
    const categoryStats = {};

    for (const q of questions) {
      const category = q.category || '未分类';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          total: 0,
          correct: 0,
          questions: []
        };
      }
      categoryStats[category].total++;
      categoryStats[category].questions.push(q);
    }

    // 统计错题
    for (const mistake of mistakeRecords) {
      const category = mistake.category || mistake.tags?.[0] || '未分类';
      if (categoryStats[category]) {
        // 错题不计入正确数
      }
    }

    // 创建节点
    const nodeMap = {};
    for (const [category, stats] of Object.entries(categoryStats)) {
      const node = this.findOrCreateNode(category);
      node.totalQuestions = stats.total;
      // 假设没有错题记录的都是正确的（简化处理）
      const mistakeCount = mistakeRecords.filter(
        (m) => (m.category || m.tags?.[0] || '未分类') === category
      ).length;
      node.correctQuestions = stats.total - mistakeCount;
      node.accuracy = node.totalQuestions > 0
        ? Math.round((node.correctQuestions / node.totalQuestions) * 100)
        : 0;
      node.masteryLevel = this._calculateMasteryLevel(node.accuracy);
      node.color = this._getNodeColor(node);

      this.nodes.set(node.id, node);
      nodeMap[category] = node;
    }

    // 自动建立关联（基于题目共现）
    this._buildEdgesFromCooccurrence(questions);

    this._saveNodes();
    this._saveEdges();

    return {
      nodesCount: this.nodes.size,
      edgesCount: this.edges.length
    };
  }

  /**
   * 获取图谱可视化数据
   * @returns {Object} 可视化数据
   */
  getGraphData() {
    this.init();

    const nodes = Array.from(this.nodes.values()).map((node) => ({
      id: node.id,
      name: node.name,
      category: node.category,
      value: node.totalQuestions,
      accuracy: node.accuracy,
      masteryLevel: node.masteryLevel,
      symbolSize: this._calculateNodeSize(node),
      itemStyle: {
        color: node.color
      },
      label: {
        show: true,
        formatter: node.name
      }
    }));

    const edges = this.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: edge.weight,
      lineStyle: {
        width: Math.min(edge.weight, 5),
        curveness: 0.2
      }
    }));

    return { nodes, edges };
  }

  /**
   * 获取知识点详情
   * @param {string} nodeId - 节点ID
   * @returns {Object} 节点详情
   */
  getNodeDetail(nodeId) {
    this.init();

    const node = this.nodes.get(nodeId);
    if (!node) return null;

    // 获取关联节点
    const relatedEdges = this.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );

    const relatedNodes = relatedEdges.map((edge) => {
      const relatedId = edge.source === nodeId ? edge.target : edge.source;
      return this.nodes.get(relatedId);
    }).filter(Boolean);

    return {
      ...node,
      relatedNodes,
      relatedCount: relatedNodes.length,
      masteryInfo: MASTERY_LEVELS[node.masteryLevel]
    };
  }

  /**
   * 获取薄弱知识点
   * @param {number} limit - 返回数量限制
   * @returns {Array} 薄弱知识点列表
   */
  getWeakNodes(limit = 5) {
    this.init();

    const nodes = Array.from(this.nodes.values())
      .filter((n) => n.totalQuestions >= 3) // 至少做过3题
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);

    return nodes.map((node) => ({
      ...node,
      masteryInfo: MASTERY_LEVELS[node.masteryLevel],
      improvementSuggestion: this._getImprovementSuggestion(node)
    }));
  }

  /**
   * 获取知识点掌握度分布
   * @returns {Object} 分布统计
   */
  getMasteryDistribution() {
    this.init();

    const distribution = {
      master: 0,
      proficient: 0,
      learning: 0,
      weak: 0
    };

    for (const node of this.nodes.values()) {
      if (node.totalQuestions >= 1) {
        distribution[node.masteryLevel]++;
      }
    }

    const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);

    return {
      distribution,
      total,
      percentages: {
        master: total > 0 ? Math.round((distribution.master / total) * 100) : 0,
        proficient: total > 0 ? Math.round((distribution.proficient / total) * 100) : 0,
        learning: total > 0 ? Math.round((distribution.learning / total) * 100) : 0,
        weak: total > 0 ? Math.round((distribution.weak / total) * 100) : 0
      },
      levels: MASTERY_LEVELS
    };
  }

  /**
   * 获取学习路径建议
   * @returns {Array} 学习路径
   */
  getLearningPath() {
    this.init();

    const nodes = Array.from(this.nodes.values())
      .filter((n) => n.totalQuestions >= 1);

    if (nodes.length === 0) {
      return [];
    }

    // 按掌握度和关联度排序
    const sortedNodes = nodes.sort((a, b) => {
      // 优先学习薄弱且有前置知识的
      const aScore = (100 - a.accuracy) + this._getPrerequisiteScore(a.id) + this._getConnectionScore(a.id);
      const bScore = (100 - b.accuracy) + this._getPrerequisiteScore(b.id) + this._getConnectionScore(b.id);
      return bScore - aScore;
    });

    return sortedNodes.slice(0, 5).map((node, index) => ({
      step: index + 1,
      node,
      reason: this._getLearningReason(node),
      estimatedTime: this._estimateLearningTime(node),
      prerequisites: this._getPrerequisites(node.id),
      connections: this._getStrongConnections(node.id, 2)
    }));
  }

  /**
   * 分析知识关联强度
   * @returns {Object} 关联分析结果
   */
  analyzeKnowledgeConnections() {
    this.init();

    const connections = {
      totalEdges: this.edges.length,
      edgeTypes: {},
      strongConnections: [],
      weakConnections: [],
      isolatedNodes: []
    };

    // 统计边类型
    for (const edge of this.edges) {
      connections.edgeTypes[edge.type] = (connections.edgeTypes[edge.type] || 0) + 1;
    }

    // 分析连接强度
    connections.strongConnections = this.edges
      .filter((e) => e.weight >= 3)
      .map((e) => ({
        ...e,
        sourceNode: this.nodes.get(e.source),
        targetNode: this.nodes.get(e.target)
      }));

    connections.weakConnections = this.edges
      .filter((e) => e.weight < 2)
      .map((e) => ({
        ...e,
        sourceNode: this.nodes.get(e.source),
        targetNode: this.nodes.get(e.target)
      }));

    // 找出孤立节点
    const connectedNodeIds = new Set(
      this.edges.flatMap((e) => [e.source, e.target])
    );
    connections.isolatedNodes = Array.from(this.nodes.values())
      .filter((n) => !connectedNodeIds.has(n.id));

    return connections;
  }

  /**
   * 生成个性化学习计划
   * @param {Object} options - 计划选项
   * @returns {Object} 学习计划
   */
  generatePersonalizedPlan(options = {}) {
    this.init();

    const {
      duration = 30, // 计划时长（天）
      dailyTime = 2, // 每天学习时间（小时）
      focusAreas = [], // 重点关注领域
      learningStyle = 'balanced' // balanced | intensive | relaxed
    } = options;

    // 获取学习路径
    const learningPath = this.getLearningPath();

    // 分析知识关联
    const _connectionAnalysis = this.analyzeKnowledgeConnections();

    // 生成学习计划
    const plan = {
      id: `plan_${Date.now()}`,
      title: `个性化学习计划 (${duration}天)`,
      duration,
      dailyTime,
      focusAreas,
      learningStyle,
      createdAt: Date.now(),
      milestones: this._generatePlanMilestones(duration, learningPath),
      weeklyGoals: this._generateWeeklyGoals(duration, learningPath),
      recommendedResources: this._generateResourceRecommendations(learningPath),
      progressTracking: {
        totalSteps: learningPath.length,
        completedSteps: 0,
        lastUpdated: Date.now()
      }
    };

    return plan;
  }

  /**
   * 获取知识点的强关联
   * @param {string} nodeId - 节点ID
   * @param {number} limit - 限制数量
   * @returns {Array} 强关联节点
   */
  getStrongConnections(nodeId, limit = 3) {
    this.init();

    return this._getStrongConnections(nodeId, limit);
  }

  /**
   * 获取知识点的前置依赖
   * @param {string} nodeId - 节点ID
   * @returns {Array} 前置依赖节点
   */
  getPrerequisites(nodeId) {
    this.init();

    return this._getPrerequisites(nodeId);
  }

  /**
   * 清空图谱数据
   */
  clear() {
    this.nodes.clear();
    this.edges = [];
    this._saveNodes();
    this._saveEdges();
  }

  // ==================== 私有方法 ====================

  /**
   * 计算掌握度等级
   */
  _calculateMasteryLevel(accuracy) {
    for (const [level, config] of Object.entries(MASTERY_LEVELS)) {
      if (accuracy >= config.min) {
        return level;
      }
    }
    return 'weak';
  }

  /**
   * 获取节点颜色
   */
  _getNodeColor(node) {
    if (this.settings.showMasteryColors && node.accuracy !== undefined) {
      const level = this._calculateMasteryLevel(node.accuracy);
      return MASTERY_LEVELS[level].color;
    }

    // 使用分类颜色
    const category = PREDEFINED_CATEGORIES[node.category];
    return category ? category.color : '#9E9E9E';
  }

  /**
   * 计算节点大小
   */
  _calculateNodeSize(node) {
    if (this.settings.nodeSize === 'fixed') {
      return 30;
    }

    // 动态大小：基于题目数量
    const baseSize = 20;
    const maxSize = 60;
    const scale = Math.log(node.totalQuestions + 1) * 10;
    return Math.min(maxSize, baseSize + scale);
  }

  /**
   * 基于共现构建边
   */
  _buildEdgesFromCooccurrence(questions) {
    // 简化实现：同一分类下的知识点建立关联
    const categories = new Set(questions.map((q) => q.category || '未分类'));
    const categoryArray = Array.from(categories);

    for (let i = 0; i < categoryArray.length; i++) {
      for (let j = i + 1; j < categoryArray.length; j++) {
        const node1 = this.findOrCreateNode(categoryArray[i]);
        const node2 = this.findOrCreateNode(categoryArray[j]);

        // 检查是否有共同出现在同一题目中的情况
        // 这里简化处理，假设所有知识点都有一定关联
        this.addEdge(node1.id, node2.id, { type: 'related', weight: 1 });
      }
    }
  }

  /**
   * 获取前置知识分数
   */
  _getPrerequisiteScore(nodeId) {
    const edges = this.edges.filter(
      (e) => e.target === nodeId && e.type === 'prerequisite'
    );
    return edges.length * 10;
  }

  /**
   * 获取学习原因
   */
  _getLearningReason(node) {
    if (node.accuracy < 40) {
      return '该知识点正确率较低，需要重点加强';
    } else if (node.accuracy < 60) {
      return '该知识点还需要更多练习来巩固';
    } else if (node.accuracy < 80) {
      return '该知识点已有一定基础，继续提升';
    } else {
      return '该知识点掌握良好，可以进行复习巩固';
    }
  }

  /**
   * 估算学习时间
   */
  _estimateLearningTime(node) {
    const baseTime = 30; // 基础30分钟
    const accuracyFactor = (100 - node.accuracy) / 100;
    const estimatedMinutes = Math.round(baseTime * (1 + accuracyFactor));

    if (estimatedMinutes < 60) {
      return `${estimatedMinutes}分钟`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
    }
  }

  /**
   * 获取提升建议
   */
  _getImprovementSuggestion(node) {
    if (node.accuracy < 30) {
      return '建议从基础概念开始，系统学习该知识点';
    } else if (node.accuracy < 50) {
      return '建议多做练习题，加深对知识点的理解';
    } else if (node.accuracy < 70) {
      return '建议针对错题进行专项复习';
    } else {
      return '建议定期复习，保持知识点的熟练度';
    }
  }

  /**
   * 生成唯一ID
   */
  _generateId() {
    return 'kg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * 加载节点
   */
  _loadNodes() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.KNOWLEDGE_NODES);
        if (saved && Array.isArray(saved)) {
          this.nodes = new Map(saved.map((n) => [n.id, n]));
        }
      }
    } catch (e) {
      console.warn('[KnowledgeGraph] 加载节点失败:', e);
    }
  }

  /**
   * 保存节点
   */
  _saveNodes() {
    try {
      if (typeof uni !== 'undefined') {
        const nodesArray = Array.from(this.nodes.values());
        storageService.save(STORAGE_KEYS.KNOWLEDGE_NODES, nodesArray);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph] 保存节点失败:', e);
    }
  }

  /**
   * 加载边
   */
  _loadEdges() {
    try {
      if (typeof uni !== 'undefined') {
        this.edges = storageService.get(STORAGE_KEYS.KNOWLEDGE_EDGES, []);
      }
    } catch (_e) {
      this.edges = [];
    }
  }

  /**
   * 保存边
   */
  _saveEdges() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.KNOWLEDGE_EDGES, this.edges);
      }
    } catch (e) {
      console.warn('[KnowledgeGraph] 保存边失败:', e);
    }
  }

  /**
   * 加载设置
   */
  _loadSettings() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.GRAPH_SETTINGS);
        if (saved) {
          this.settings = { ...this.settings, ...saved };
        }
      }
    } catch (e) {
      console.warn('[KnowledgeGraph] 加载设置失败:', e);
    }
  }

  /**
   * 获取连接分数
   */
  _getConnectionScore(nodeId) {
    const edges = this.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
    return edges.length * 5;
  }

  /**
   * 获取强关联节点
   */
  _getStrongConnections(nodeId, limit) {
    const relatedEdges = this.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );

    const connections = relatedEdges
      .map((edge) => {
        const relatedId = edge.source === nodeId ? edge.target : edge.source;
        return {
          node: this.nodes.get(relatedId),
          strength: edge.weight,
          relationship: edge.type
        };
      })
      .filter((conn) => conn.node)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);

    return connections;
  }

  /**
   * 获取前置依赖
   */
  _getPrerequisites(nodeId) {
    const prerequisiteEdges = this.edges.filter(
      (e) => e.target === nodeId && e.type === 'prerequisite'
    );

    return prerequisiteEdges.map((edge) => {
      return this.nodes.get(edge.source);
    }).filter(Boolean);
  }

  /**
   * 生成计划里程碑
   */
  _generatePlanMilestones(duration, learningPath) {
    const milestones = [];
    const milestonePoints = [0.25, 0.5, 0.75, 1.0];

    milestonePoints.forEach((point, index) => {
      const days = Math.round(duration * point);
      const progress = Math.round(point * 100);
      const milestone = {
        id: `milestone_${index}`,
        title: `里程碑 ${index + 1}`,
        days,
        progress,
        description: this._getMilestoneDescription(index, learningPath),
        targetNodes: learningPath.slice(0, Math.ceil(learningPath.length * point))
      };
      milestones.push(milestone);
    });

    return milestones;
  }

  /**
   * 生成周目标
   */
  _generateWeeklyGoals(duration, learningPath) {
    const weeklyGoals = [];
    const weeks = Math.ceil(duration / 7);

    for (let week = 1; week <= weeks; week++) {
      const startDay = (week - 1) * 7 + 1;
      const endDay = Math.min(week * 7, duration);
      const weekProgress = Math.round((endDay / duration) * 100);

      weeklyGoals.push({
        week,
        startDay,
        endDay,
        progress: weekProgress,
        goals: this._getWeeklyGoals(week, learningPath)
      });
    }

    return weeklyGoals;
  }

  /**
   * 生成资源推荐
   */
  _generateResourceRecommendations(learningPath) {
    const recommendations = [];

    for (const item of learningPath) {
      const resources = this._getResourceForNode(item.node);
      if (resources.length > 0) {
        recommendations.push({
          node: item.node,
          resources
        });
      }
    }

    return recommendations;
  }

  /**
   * 获取里程碑描述
   */
  _getMilestoneDescription(index, _learningPath) {
    const descriptions = [
      '完成基础知识学习，构建知识框架',
      '完成核心内容学习，掌握重点难点',
      '完成综合练习，提升解题能力',
      '完成全面复习，准备最终考试'
    ];
    return descriptions[index] || '完成阶段学习目标';
  }

  /**
   * 获取周目标
   */
  _getWeeklyGoals(week, learningPath) {
    const goals = [];
    const totalSteps = learningPath.length;
    const stepsPerWeek = Math.ceil(totalSteps / 4);
    const startStep = (week - 1) * stepsPerWeek;
    const endStep = Math.min(week * stepsPerWeek, totalSteps);

    for (let i = startStep; i < endStep; i++) {
      const item = learningPath[i];
      goals.push({
        step: i + 1,
        title: `学习 ${item.node.name}`,
        description: item.reason
      });
    }

    return goals;
  }

  /**
   * 获取节点的推荐资源
   */
  _getResourceForNode(node) {
    const resources = [];

    // 基于节点类型推荐资源
    if (node.category === 'math') {
      resources.push(
        '《高等数学辅导讲义》',
        '历年真题分类解析',
        '数学公式手册'
      );
    } else if (node.category === 'english') {
      resources.push(
        '《考研英语词汇闪过》',
        '阅读理解专项训练',
        '写作模板集锦'
      );
    } else if (node.category === 'politics') {
      resources.push(
        '《考研政治知识点精讲精练》',
        '时政热点汇总',
        '主观题答题技巧'
      );
    } else {
      resources.push(
        '专业课核心知识点总结',
        '历年真题解析',
        '模拟练习题集'
      );
    }

    return resources;
  }
}

// 创建单例
export const knowledgeGraphManager = new KnowledgeGraphManager();

// 便捷函数
export function initKnowledgeGraph() {
  return knowledgeGraphManager.init();
}

export function addKnowledgeNode(nodeData) {
  return knowledgeGraphManager.addNode(nodeData);
}

export function updateNodeLearning(nodeId, learningData) {
  return knowledgeGraphManager.updateNodeLearning(nodeId, learningData);
}

export function addKnowledgeEdge(sourceId, targetId, edgeData) {
  return knowledgeGraphManager.addEdge(sourceId, targetId, edgeData);
}

export function buildGraphFromQuestions(questions, mistakeRecords) {
  return knowledgeGraphManager.buildFromQuestions(questions, mistakeRecords);
}

export function getGraphData() {
  return knowledgeGraphManager.getGraphData();
}

export function getNodeDetail(nodeId) {
  return knowledgeGraphManager.getNodeDetail(nodeId);
}

export function getWeakNodes(limit) {
  return knowledgeGraphManager.getWeakNodes(limit);
}

export function getMasteryDistribution() {
  return knowledgeGraphManager.getMasteryDistribution();
}

export function getLearningPath() {
  return knowledgeGraphManager.getLearningPath();
}

export function analyzeKnowledgeConnections() {
  return knowledgeGraphManager.analyzeKnowledgeConnections();
}

export function generatePersonalizedPlan(options) {
  return knowledgeGraphManager.generatePersonalizedPlan(options);
}

export function getStrongConnections(nodeId, limit) {
  return knowledgeGraphManager.getStrongConnections(nodeId, limit);
}

export function getPrerequisites(nodeId) {
  return knowledgeGraphManager.getPrerequisites(nodeId);
}

export { PREDEFINED_CATEGORIES, MASTERY_LEVELS };
export default knowledgeGraphManager;
