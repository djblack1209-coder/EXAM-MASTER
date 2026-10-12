<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">刷题中心</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view
      scroll-y
      scroll-with-animation
      class="main-scroll"
      :scroll-into-view="scrollIntoViewId"
      :style="{ paddingTop: statusBarHeight + 44 + 'px' }"
    >
      <!-- 可用题库列表 -->
      <view class="section practice-hero-section">
        <view class="practice-hero">
          <text class="practice-kicker">{{ practiceHeroKicker }}</text>
          <text class="practice-title">{{ practiceHeroTitle }}</text>
          <text class="practice-subtitle">{{ practiceHeroSubtitle }}</text>
          <view class="practice-signal-row">
            <view class="practice-signal">
              <text class="signal-value">{{ primaryBankMetricValue }}</text>
              <text class="signal-label">{{ primaryBankMetricLabel }}</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ totalQuestions }}</text>
              <text class="signal-label">{{ questionMetricLabel }}</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ trackCount }}</text>
              <text class="signal-label">学习轨道</text>
            </view>
          </view>

          <view class="practice-command-row">
            <view
              class="practice-command primary"
              hover-class="btn-hover"
              @tap="handlePracticePrimaryAction"
            >
              <text>{{ practicePrimaryActionText }}</text>
            </view>
            <view class="practice-command secondary" hover-class="btn-hover" @tap="chooseImportSource">
              <text>题库</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!hasPublishedBanks" class="section">
        <view class="quiet-empty-card">
          <text class="quiet-empty-title">暂无可练真题</text>
          <text class="quiet-empty-desc">可以先体验示例题，或查看完整知识体系。</text>
          <view class="quiet-empty-actions">
            <view class="quiet-empty-action primary" hover-class="btn-hover" @tap="handlePracticePrimaryAction">
              <text>体验示例题</text>
            </view>
            <view class="quiet-empty-action" hover-class="btn-hover" @tap="selectMode('knowledge_graph')">
              <text>看知识图谱</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="focusedKnowledgeNode" class="section">
        <view class="focus-card">
          <view class="focus-copy">
            <text class="focus-kicker">知识定位</text>
            <text class="focus-title">{{ focusedKnowledgeNode.label }}</text>
            <text class="focus-trail">{{ focusedKnowledgeTrailText }}</text>
          </view>
          <view class="focus-actions">
            <view class="focus-action primary" hover-class="btn-hover" @tap="startKnowledgeNodeTraining">
              <text>节点强化</text>
            </view>
            <view class="focus-action ghost" hover-class="btn-hover" @tap="clearFocusedKnowledgeNode">
              <text>关闭</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head navigator-head">
          <view>
            <text class="section-title">学习导航</text>
            <text class="section-hint">选择科目和训练方式</text>
          </view>
          <text class="section-meta">{{ bankAvailabilityText }}</text>
        </view>

        <view class="subject-tabs">
          <view
            v-for="subject in navigationTree"
            :key="subject.id"
            class="subject-tab"
            :class="{ active: selectedSubject?.id === subject.id }"
            @tap="selectSubject(subject.id)"
          >
            <text>{{ subject.label }}</text>
          </view>
        </view>

        <view class="track-rail">
          <view
            v-for="track in selectedSubject?.tracks || []"
            :key="track.id"
            class="track-pill"
            :class="{ active: selectedTrack?.id === track.id }"
            @tap="selectTrack(track.id)"
          >
            <text class="track-code">{{ track.code }}</text>
            <text class="track-label">{{ track.label }}</text>
            <text class="track-count">{{ track.banks.length }}</text>
          </view>
        </view>

        <view class="mode-row">
          <view
            v-for="mode in selectedModes"
            :key="mode.id"
            class="mode-chip"
            :class="{ active: selectedModeId === mode.id }"
            @tap="selectMode(mode.id)"
          >
            <text>{{ mode.label }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">{{ currentPracticeSectionTitle }}</text>
            <text class="section-hint">{{ selectedModeLabel }}</text>
          </view>
          <text class="section-meta">{{ currentPracticeSectionMeta }}</text>
        </view>

        <view v-if="isKnowledgeGraphMode" id="knowledge-graph-section" class="knowledge-map-panel">
          <view class="knowledge-map-head">
            <view>
              <text class="knowledge-map-kicker">知识图谱</text>
              <text class="knowledge-map-title">{{ knowledgeGraphSummaryText }}</text>
            </view>
            <view class="knowledge-map-controls">
              <view class="knowledge-map-control" hover-class="btn-hover" @tap="zoomKnowledgeGraph(-1)">
                <text>-</text>
              </view>
              <text class="knowledge-map-zoom">{{ knowledgeGraphZoomLabel }}</text>
              <view class="knowledge-map-control" hover-class="btn-hover" @tap="zoomKnowledgeGraph(1)">
                <text>+</text>
              </view>
            </view>
          </view>

          <scroll-view class="knowledge-system-scroll" scroll-x scroll-y>
            <view
              class="knowledge-system-canvas"
              :style="{
                width: knowledgeSystemGraph.width + 'rpx',
                height: knowledgeSystemGraph.height + 'rpx',
                transform: `scale(${knowledgeGraphZoom})`
              }"
            >
              <view
                v-for="line in knowledgeSystemGraph.lines"
                :key="line.id"
                class="knowledge-system-line"
                :style="line.style"
              />
              <view
                v-for="node in knowledgeSystemGraph.nodes"
                :key="node.id"
                class="knowledge-system-node"
                :class="[`level-${node.level}`, `state-${node.state}`, { active: activeKnowledgeNode?.id === node.id }]"
                :style="node.style"
                @tap="selectKnowledgeGraphNode(node)"
              >
                <text v-if="!node.atomic" class="knowledge-system-label">{{ node.label }}</text>
                <view v-else class="knowledge-atom-dot" />
              </view>
            </view>
          </scroll-view>

          <view v-if="activeKnowledgeNode" class="knowledge-node-detail">
            <view>
              <text class="knowledge-node-detail-title">{{ activeKnowledgeNode.label }}</text>
              <text class="knowledge-node-detail-path">{{ activeKnowledgeNode.pathText }}</text>
            </view>
            <view
              v-if="activeKnowledgeNode.trainable"
              class="knowledge-node-detail-action"
              hover-class="btn-hover"
              @tap="startKnowledgeNodeTraining"
            >
              <text>练习</text>
            </view>
          </view>

          <view v-else class="knowledge-map-hint">
            <text>左右拖动查看全图；点一下末端小点查看细节。</text>
          </view>
        </view>

        <view v-else-if="selectedBanks.length > 0" class="bank-list">
          <view v-for="bank in selectedBanks" :key="bank.id" class="card bank-card">
            <view class="bank-info">
              <text class="bank-track">{{ bank.year }} 历年真题</text>
              <text class="bank-name">{{ bank.name }}</text>
              <text class="bank-desc">{{ bank.description }}</text>
            </view>
            <view
              v-if="!isBankLoaded(bank.id)"
              class="bank-btn load-btn"
              hover-class="btn-hover"
              @tap="handleLoadBank(bank.id)"
            >
              <text class="bank-btn-text">{{ loadingBankId === bank.id ? '加载中' : '加载' }}</text>
            </view>
            <view v-else class="bank-loaded">
              <text class="bank-loaded-text">已加载</text>
            </view>
          </view>
        </view>

        <view v-else class="empty-track-card">
          <text class="empty-track-title">{{ emptyTrackTitle }}</text>
          <text class="empty-track-desc">{{ emptyTrackDesc }}</text>
          <view class="empty-track-action" hover-class="btn-hover" @tap="selectMode('knowledge_graph')">
            <text>查看知识地图</text>
          </view>
        </view>
      </view>

      <!-- 已加载统计 + 操作按钮 -->
      <view class="section">
        <view v-if="hasBank" class="card status-card">
          <text class="status-text">{{ bankStatusText }}</text>
          <view class="progress-mini">
            <view class="progress-bar-sm">
              <view class="progress-fill-sm" :style="{ width: progressPercent + '%' }" />
            </view>
            <text class="progress-label">已做 {{ progressPercent }}%</text>
          </view>
        </view>

        <!-- 开始刷题 -->
        <view v-if="hasBank" class="action-btn primary-btn" hover-class="btn-hover" @tap="handleLoadedBankAction">
          <text class="action-btn-text">{{ bottomPracticeActionText }}</text>
        </view>

        <!-- 智能复习 -->
        <view
          v-if="hasBank && isPublishedRegistryBank"
          class="action-btn secondary-btn"
          hover-class="btn-hover"
          @tap="goSmartReview"
        >
          <text class="action-btn-text secondary-text">智能复习</text>
        </view>
      </view>

      <!-- 底部占位 -->
      <view :style="{ height: tabBarHeight + 96 + 'px' }" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="1" />
  </view>
</template>

<script>
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import { useFlashcardBank } from '@/composables/useFlashcardBank.js';
import { useBankStatus } from '@/composables/useBankStatus.js';
import { useDynamicMixin } from '@/composables/useDynamicMixin.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import {
  buildKnowledgeGraph,
  deriveKnowledgeVisualState,
  getKnowledgeTrackMeta,
  getKnowledgeNodeTrail,
  KNOWLEDGE_NODES,
  resolveQuestionKnowledge
} from '@/config/knowledge-graph.js';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store.js';
import { storageService } from '@/services/storageService.js';
import { getQuizQuestionId, isReleasedPracticeBankSource } from '@/services/quiz-session-contract.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { safeImport } from '@/utils/helpers/safe-import.js';
import { startGuestDemoPractice } from '@/utils/practice/demo-bank.js';
import { logger } from '@/utils/logger.js';

const KNOWLEDGE_GRAPH_ZOOM_LEVELS = [0.72, 0.9, 1.08];
const KNOWLEDGE_GRAPH_LEVEL_X = [32, 258, 510, 762, 1014];
const KNOWLEDGE_GRAPH_NODE_SIZE = {
  0: { width: 170, height: 70 },
  1: { width: 156, height: 64 },
  2: { width: 164, height: 58 },
  3: { width: 146, height: 52 },
  4: { width: 34, height: 34 }
};
const KNOWLEDGE_GRAPH_MIN_HEIGHT = 520;

function averageLayout(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function graphStateForNode(node, nodeStates = {}, focusedIds = new Set()) {
  if (focusedIds.has(node.id)) return 'strong';
  return deriveKnowledgeVisualState(nodeStates[node.id] || {}).state;
}

function majorLabelFromProfile(profile = {}) {
  return profile.major || profile.targetMajor || profile.examTrack || '考研备考';
}

function knowledgePathLabelForNode(item, tracks = []) {
  if (!item) return '';

  const trackId = item.type === 'track' ? item.id?.replace('track:', '') : '';
  if (trackId === 'law_illegal') return '专业课';
  if (trackId && tracks.includes(trackId)) return getKnowledgeTrackMeta(trackId)?.label || item.label;

  if (item.type === 'subject') {
    const itemTracks = Array.isArray(item.tracks) ? item.tracks : [];
    const matchingTracks = tracks.filter((candidateTrackId) => itemTracks.includes(candidateTrackId));
    if (matchingTracks.length === 1) {
      const selectedTrackId = matchingTracks[0];
      if (selectedTrackId === 'law_illegal') return '专业课';
      return getKnowledgeTrackMeta(selectedTrackId)?.label || item.label;
    }
  }

  return item.label;
}

function buildNodePathText(node, rootLabel, tracks = []) {
  if (!node?.sourceId) return rootLabel;
  const trail = getKnowledgeNodeTrail(node.sourceId)
    .map((item) => knowledgePathLabelForNode(item, tracks))
    .filter((label, index, labels) => label && label !== labels[index - 1]);
  return [rootLabel, ...trail].filter(Boolean).join(' / ');
}

function buildKnowledgeSystemGraph({ graph, profile, nodeStates, focusedNode }) {
  const sourceNodes = graph.nodes || [];
  const byParent = new Map();
  sourceNodes.forEach((nodeItem) => {
    if (!nodeItem.parentId) return;
    const list = byParent.get(nodeItem.parentId) || [];
    list.push(nodeItem);
    byParent.set(nodeItem.parentId, list);
  });

  const rootLabel = majorLabelFromProfile(profile);
  const focusedIds = new Set((focusedNode?.trail || []).map((item) => item.id));
  if (focusedNode?.nodeId) focusedIds.add(focusedNode.nodeId);
  const layoutNodes = [];
  const nodeMeta = new Map();
  let cursorY = 76;

  function childrenOf(parentId, type) {
    return (byParent.get(parentId) || []).filter((item) => !type || item.type === type);
  }

  function addLayoutNode(source, level, centerY, options = {}) {
    const size = KNOWLEDGE_GRAPH_NODE_SIZE[level] || KNOWLEDGE_GRAPH_NODE_SIZE[3];
    const sourceId = source.sourceId || source.id;
    const node = {
      id: source.id,
      sourceId,
      label: source.label,
      level,
      atomic: level >= 4,
      trainable: Boolean(sourceId && level > 0),
      state: source.sourceNode ? graphStateForNode(source.sourceNode, nodeStates, focusedIds) : 'unknown',
      pathText: '',
      style: {
        left: `${KNOWLEDGE_GRAPH_LEVEL_X[level]}rpx`,
        top: `${centerY - size.height / 2}rpx`,
        width: `${size.width}rpx`,
        height: `${size.height}rpx`
      },
      ...options
    };
    node.pathText = buildNodePathText(node, rootLabel, graph.tracks);
    layoutNodes.push(node);
    nodeMeta.set(node.id, {
      x: KNOWLEDGE_GRAPH_LEVEL_X[level],
      y: centerY,
      width: size.width
    });
    return node;
  }

  function addSourceNode(sourceNode, level, centerY) {
    return addLayoutNode(
      {
        id: sourceNode.id,
        sourceId: sourceNode.id,
        label: sourceNode.label,
        sourceNode
      },
      level,
      centerY
    );
  }

  const courseItems = (graph.tracks || [])
    .map((trackId) => {
      const trackMeta = getKnowledgeTrackMeta(trackId);
      const sourceNode =
        sourceNodes.find((item) => item.id === `track:${trackId}`) ||
        sourceNodes.find((item) => item.type === 'subject' && item.tracks?.includes(trackId));
      if (!sourceNode) return null;
      return {
        id: `course:${trackId}`,
        sourceId: sourceNode.id,
        label: trackId === 'law_illegal' ? '专业课' : trackMeta?.label || sourceNode.label,
        trackId,
        sourceNode
      };
    })
    .filter(Boolean);

  const courses = [];
  const lines = [];

  courseItems.forEach((course) => {
    const courseAnchorY = 118 + courses.length * 92;
    const modules = sourceNodes.filter((item) => item.type === 'module' && item.tracks?.includes(course.trackId));
    const moduleYs = [];

    modules.forEach((moduleNode) => {
      const topics = childrenOf(moduleNode.id, 'topic');
      const topicYs = [];

      topics.forEach((topicNode) => {
        const microNodes = childrenOf(topicNode.id, 'micro');
        const microYs = [];

        if (microNodes.length) {
          microNodes.forEach((microNode) => {
            const microY = cursorY;
            addSourceNode(microNode, 4, microY);
            microYs.push(microY);
            cursorY += 44;
          });
        } else {
          microYs.push(cursorY);
          cursorY += 56;
        }

        const topicY = averageLayout(microYs);
        addSourceNode(topicNode, 3, topicY);
        topicYs.push(topicY);
      });

      const moduleY = topicYs.length ? averageLayout(topicYs) : cursorY;
      addSourceNode(moduleNode, 2, moduleY);
      moduleYs.push(moduleY);
      if (!topicYs.length) cursorY += 70;
      cursorY += 18;
    });

    const courseY = moduleYs.length ? averageLayout(moduleYs) : courseAnchorY;
    courses.push(addLayoutNode(course, 1, courseAnchorY));
    if (!moduleYs.length) cursorY += 82;
    cursorY = Math.max(cursorY + 28, courseY + 76);
  });

  const rootY = averageLayout(courses.map((item) => nodeMeta.get(item.id)?.y || 0)) || 110;
  const rootNode = addLayoutNode({ id: 'major:current', label: rootLabel, sourceId: '' }, 0, rootY, {
    trainable: false,
    state: 'strong'
  });

  layoutNodes.forEach((node) => {
    if (node.id === rootNode.id) return;
    const source = sourceNodes.find((item) => item.id === node.sourceId);
    let parentId = '';
    if (node.level === 1) parentId = rootNode.id;
    else if (node.level === 2 && source?.tracks?.length) {
      const parentCourse = courseItems.find((course) => source.tracks.includes(course.trackId));
      parentId = parentCourse?.id || '';
    }
    else if (source?.parentId) parentId = source.parentId;
    const from = nodeMeta.get(parentId);
    const to = nodeMeta.get(node.id);
    if (!from || !to) return;
    const x1 = from.x + from.width;
    const y1 = from.y;
    const x2 = to.x;
    const y2 = to.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    lines.push({
      id: `${parentId}->${node.id}`,
      style: {
        left: `${x1}rpx`,
        top: `${y1}rpx`,
        width: `${length}rpx`,
        transform: `rotate(${Math.atan2(dy, dx)}rad)`
      }
    });
  });

  return {
    nodes: layoutNodes,
    lines,
    width: 1120,
    height: Math.max(KNOWLEDGE_GRAPH_MIN_HEIGHT, cursorY + 80)
  };
}

function buildDueReviewIds(allQuestions = [], getDueCards, limit = 20) {
  if (!Array.isArray(allQuestions) || typeof getDueCards !== 'function') return [];
  return getDueCards(allQuestions).map(getQuizQuestionId).filter(Boolean).slice(0, limit);
}

const TRAINING_MODE_META = {
  past_exam: {
    routeMode: '',
    primaryText: '进入历年真题',
    bottomText: '开始历年真题'
  },
  timed_sprint: {
    routeMode: 'timed_sprint',
    primaryText: '进入限时冲刺',
    bottomText: '开始限时冲刺'
  },
  weakness: {
    routeMode: 'smart_review',
    primaryText: '开始薄弱点强化',
    bottomText: '开始薄弱点强化'
  },
  knowledge_graph: {
    routeMode: '',
    primaryText: '查看知识地图',
    bottomText: '查看知识地图'
  }
};

function getTrainingModeMeta(modeId) {
  return TRAINING_MODE_META[modeId] || TRAINING_MODE_META.past_exam;
}

export default {
  components: { CustomTabbar },

  setup() {
    const dynamicMixinHelper = useDynamicMixin();
    const learningTrajectoryStore = useLearningTrajectoryStore();
    const { loading, availableBanks, loadedBankIds: loadedIds, loadFlashcardBank } = useFlashcardBank();

    const { hasBank, totalQuestions, progressPercent, isPageLoading, refreshBankStatus } = useBankStatus();

    return {
      loading,
      availableBanks,
      loadedIds,
      loadFlashcardBank,
      hasBank,
      totalQuestions,
      progressPercent,
      isPageLoading,
      refreshBankStatus,
      learningTrajectoryStore,
      dynamicMixinHelper,
      dynamicMethodsCache: dynamicMixinHelper.dynamicMethodsCache
    };
  },

  data() {
    return {
      statusBarHeight: 44,
      tabBarHeight: 90,
      loadingBankId: null,
      selectedSubjectKey: '',
      selectedTrackId: '',
      selectedModeId: 'past_exam',
      focusedKnowledgeNode: null,
      activeKnowledgeNode: null,
      knowledgeGraphZoomIndex: 1,
      bankSource: null,
      scrollIntoViewId: ''
    };
  },

  computed: {
    navigationTree() {
      const profile = storageService.get('exam_profile', null) || {};
      return getPracticeNavigationTree(profile);
    },

    availableBankCount() {
      return this.navigationTree.reduce((sum, subject) => {
        return sum + subject.tracks.reduce((trackSum, track) => trackSum + track.banks.length, 0);
      }, 0);
    },

    loadedBankCount() {
      return this.loadedIds?.size || 0;
    },

    trackCount() {
      return this.navigationTree.reduce((sum, subject) => sum + subject.tracks.length, 0);
    },

    hasPublishedBanks() {
      return this.availableBankCount > 0;
    },

    isGuestDemoBank() {
      return this.hasBank && this.bankSource?.type === 'guest_demo';
    },

    isPublishedRegistryBank() {
      return this.hasBank && this.bankSource?.type === 'published_registry';
    },

    primaryBankMetricValue() {
      if (this.isGuestDemoBank) return this.totalQuestions;
      if (this.isPublishedRegistryBank) return this.loadedBankCount;
      return this.totalQuestions;
    },

    primaryBankMetricLabel() {
      if (this.isGuestDemoBank) return '示例题';
      if (this.isPublishedRegistryBank) return '可练';
      return '未开放';
    },

    questionMetricLabel() {
      if (this.isGuestDemoBank) return '示例题';
      if (this.isPublishedRegistryBank) return '可训练题';
      return '本地题';
    },

    practiceHeroKicker() {
      if (this.isGuestDemoBank) return '示例练习';
      return this.hasPublishedBanks ? '训练' : '练习';
    },

    practiceHeroTitle() {
      if (this.isGuestDemoBank) return '示例题体验';
      return this.hasPublishedBanks ? '刷题中心' : '先熟悉答题节奏';
    },

    practiceHeroSubtitle() {
      if (this.isGuestDemoBank) {
        return '用一组示例题快速熟悉做题、计时和复习入口。';
      }
      if (this.hasPublishedBanks) {
        return '选择科目和训练方式，错题会自动进入复习。';
      }
      return '先看知识体系，也可以用示例题体验完整流程。';
    },

    bankAvailabilityText() {
      if (this.isGuestDemoBank) return '示例模式';
      return this.hasPublishedBanks ? `${this.availableBankCount} 套可练` : '暂无真题';
    },

    practicePrimaryActionText() {
      if (this.isGuestDemoBank) return '继续示例练习';
      if (this.isPublishedRegistryBank) return this.selectedTrainingModeMeta.primaryText;
      if (this.hasBank) return '查看题库';
      if (this.hasPublishedBanks) return '查看可用题库';
      return '体验示例题';
    },

    bankStatusText() {
      if (this.isGuestDemoBank) return `示例题 ${this.totalQuestions} 题`;
      if (this.isPublishedRegistryBank) return `可训练题 ${this.totalQuestions} 题`;
      return `本地题库 ${this.totalQuestions} 题，暂不可练`;
    },

    bottomPracticeActionText() {
      if (this.isGuestDemoBank) return '继续示例题';
      if (this.isPublishedRegistryBank) return this.selectedTrainingModeMeta.bottomText;
      return '查看题库';
    },

    selectedSubject() {
      return (
        this.navigationTree.find((subject) => subject.id === this.selectedSubjectKey) || this.navigationTree[0] || null
      );
    },

    selectedTrack() {
      const tracks = this.selectedSubject?.tracks || [];
      return tracks.find((track) => track.id === this.selectedTrackId) || tracks[0] || null;
    },

    selectedBanks() {
      return this.selectedTrack?.banks || [];
    },

    selectedTrackCoverage() {
      return this.selectedTrack?.coverage || null;
    },

    selectedModes() {
      return this.selectedTrack?.modes || [];
    },

    selectedModeLabel() {
      return this.selectedModes.find((mode) => mode.id === this.selectedModeId)?.label || '历年真题';
    },

    selectedTrainingModeMeta() {
      return getTrainingModeMeta(this.selectedModeId);
    },

    selectedTrackReleaseLabel() {
      const coverage = this.selectedTrackCoverage;
      if (!coverage) return this.selectedModeLabel;
      if (coverage.publishedCount > 0) {
        return `${coverage.publishedCount} 套可练`;
      }
      return '暂无真题';
    },

    currentPracticeSectionTitle() {
      if (this.isKnowledgeGraphMode) return majorLabelFromProfile(this.knowledgeGraphProfile);
      return this.selectedTrack?.label || '学习内容';
    },

    currentPracticeSectionMeta() {
      if (this.isKnowledgeGraphMode) return `${this.knowledgeGraphModel.tracks.length} 条主线`;
      return this.selectedTrackReleaseLabel;
    },

    emptyTrackTitle() {
      return '暂无可练真题';
    },

    emptyTrackDesc() {
      return '先查看知识体系，或切换到示例题体验完整流程。';
    },

    isKnowledgeGraphMode() {
      return this.selectedModeId === 'knowledge_graph';
    },

    knowledgeGraphProfile() {
      const examProfile = storageService.get('exam_profile', null) || {};
      const schoolInfo = storageService.get('user_school_info', null) || {};
      return {
        ...examProfile,
        major: examProfile.major || examProfile.targetMajor || schoolInfo.major || examProfile.examTrack || '考研备考'
      };
    },

    knowledgeGraphModel() {
      return buildKnowledgeGraph(this.knowledgeGraphProfile);
    },

    knowledgeSystemGraph() {
      return buildKnowledgeSystemGraph({
        graph: this.knowledgeGraphModel,
        profile: this.knowledgeGraphProfile,
        nodeStates: this.learningTrajectoryStore?.nodeStates || {},
        focusedNode: this.focusedKnowledgeNode
      });
    },

    knowledgeGraphSummaryText() {
      return `${majorLabelFromProfile(this.knowledgeGraphProfile)}知识体系`;
    },

    knowledgeGraphZoom() {
      return KNOWLEDGE_GRAPH_ZOOM_LEVELS[this.knowledgeGraphZoomIndex] || 0.9;
    },

    knowledgeGraphZoomLabel() {
      return `${Math.round(this.knowledgeGraphZoom * 100)}%`;
    },

    focusedKnowledgeTrailText() {
      const trail = this.focusedKnowledgeNode?.trail || [];
      return trail.length ? trail.map((item) => item.label).join(' / ') : '已从答题结果定位到当前节点';
    }
  },

  onLoad() {
    this.initLayout();
    this.refreshBankStatus();
    this.refreshBankSource();
    this.restoreFocusedKnowledgeNode();
    this.ensureNavigationSelection();
    this.consumePreferredMode();
    this.preloadPracticeSubPackage();
  },

  onShow() {
    // 每次切回刷新题库状态（可能在do-quiz中答了题）
    this.refreshBankStatus();
    this.refreshBankSource();
    this.restoreFocusedKnowledgeNode();
    this.ensureNavigationSelection();
    this.consumePreferredMode();
  },

  onReady() {
    if (this.isKnowledgeGraphMode) {
      this.scrollKnowledgeGraphIntoView();
    }
  },

  onShareAppMessage() {
    return {
      title: 'EXAM-MASTER — 刷题中心',
      path: '/pages/practice/index'
    };
  },

  methods: {
    async _invokeDynamicMethod(methodName, args = [], options = {}) {
      const { silent = false } = options;
      let cached = this.dynamicMethodsCache?.[methodName];

      if (typeof cached !== 'function' && this._mixinReady) {
        await this._mixinReady;
        cached = this.dynamicMethodsCache?.[methodName];
      }

      if (typeof cached === 'function') {
        return cached(...args);
      }

      if (!silent) {
        uni.showToast({ title: '功能初始化失败，请稍后重试', icon: 'none' });
      }

      return undefined;
    },

    async _loadAIGenerationMixin() {
      this.dynamicMethodsCache = this.dynamicMethodsCache || {};
      const helper = this.dynamicMixinHelper || useDynamicMixin();
      await helper.loadAIGenerationMixin(this);
      this._mixinLoaded = true;
    },

    preloadPracticeSubPackage() {
      const helper = this.dynamicMixinHelper;
      if (!helper || typeof helper.ensurePracticeSubPackageLoaded !== 'function') return;

      helper.ensurePracticeSubPackageLoaded().catch((e) => {
        logger.warn('[Practice] preload practice subpackage failed:', e);
      });
    },

    refreshBankSource() {
      this.bankSource = storageService.get('v30_bank_source', null);
    },

    chooseImportSource() {
      const cached = this.dynamicMethodsCache?.chooseImportSource;
      if (typeof cached === 'function') {
        return cached();
      }
      safeNavigateTo('/pages/practice-sub/question-bank');
      return undefined;
    },

    handlePracticePrimaryAction() {
      if (this.isGuestDemoBank) {
        this.goDoQuiz();
        return;
      }

      if (this.isPublishedRegistryBank) {
        this.handleLoadedBankAction();
        return;
      }

      if (this.hasBank) {
        this.chooseImportSource();
        return;
      }

      if (!this.hasPublishedBanks) {
        startGuestDemoPractice({ destination: 'quiz' });
        return;
      }

      this.chooseImportSource();
    },

    hasReleasedPracticeBank() {
      return this.hasBank && isReleasedPracticeBankSource(this.bankSource);
    },

    ensureNavigationSelection() {
      const tree = this.navigationTree;
      if (!tree.length) return;

      if (this.focusedKnowledgeNode) {
        this.selectTrackForFocusedNode();
      }

      const preferredSubject =
        tree.find((subject) => subject.tracks.some((track) => track.banks.length > 0)) || tree[0];
      if (!this.selectedSubjectKey || !tree.some((subject) => subject.id === this.selectedSubjectKey)) {
        this.selectedSubjectKey = preferredSubject.id;
      }

      const subject = tree.find((item) => item.id === this.selectedSubjectKey) || preferredSubject;
      const preferredTrack = subject.tracks.find((track) => track.banks.length > 0) || subject.tracks[0];
      if (!this.selectedTrackId || !subject.tracks.some((track) => track.id === this.selectedTrackId)) {
        this.selectedTrackId = preferredTrack?.id || '';
      }

      const modes = preferredTrack?.modes || [];
      if (modes.length && !modes.some((mode) => mode.id === this.selectedModeId)) {
        this.selectedModeId = modes[0].id;
      }
    },

    restoreFocusedKnowledgeNode() {
      const focus = storageService.get('practice_focus_knowledge_node', null);
      if (!focus?.nodeId) {
        this.focusedKnowledgeNode = null;
        return;
      }

      const node = KNOWLEDGE_NODES.find((item) => item.id === focus.nodeId);
      const trail = focus.trail?.length ? focus.trail : getKnowledgeNodeTrail(focus.nodeId);
      this.focusedKnowledgeNode = {
        nodeId: focus.nodeId,
        label: focus.label || node?.label || '知识节点',
        tracks: Array.isArray(focus.tracks) && focus.tracks.length ? focus.tracks : node?.tracks || [],
        trail,
        fromQuestionId: focus.fromQuestionId || ''
      };
      this.selectedModeId = 'knowledge_graph';
      this.selectTrackForFocusedNode();
    },

    selectKnowledgeGraphNode(node) {
      this.activeKnowledgeNode = node;
    },

    zoomKnowledgeGraph(direction) {
      const nextIndex = this.knowledgeGraphZoomIndex + Number(direction || 0);
      this.knowledgeGraphZoomIndex = Math.max(0, Math.min(KNOWLEDGE_GRAPH_ZOOM_LEVELS.length - 1, nextIndex));
    },

    selectTrackForFocusedNode() {
      if (!this.focusedKnowledgeNode) return;
      const trail = this.focusedKnowledgeNode.trail || [];
      const node = KNOWLEDGE_NODES.find((item) => item.id === this.focusedKnowledgeNode.nodeId);
      const trackNode = trail.find((item) => item.type === 'track');
      const subjectNode = trail.find((item) => item.type === 'subject');
      const candidateTracks = [
        trackNode?.id?.replace('track:', ''),
        ...(this.focusedKnowledgeNode.tracks || []),
        ...(node?.tracks || []),
        ...trail.flatMap((item) => item.tracks || [])
      ].filter(Boolean);
      const availableTracks = this.navigationTree.flatMap((subject) => subject.tracks.map((track) => track.id));
      const trackId =
        candidateTracks.find((id) => id === this.selectedTrackId) ||
        candidateTracks.find((id) => availableTracks.includes(id)) ||
        '';
      const trackMeta = getKnowledgeTrackMeta(trackId);
      const subjectFromTrail = subjectNode?.id?.replace('subject:', '');
      const subjectId =
        trackMeta?.subject || (subjectFromTrail === 'law_illegal' ? 'professional' : subjectFromTrail) || '';

      if (subjectId && this.navigationTree.some((subject) => subject.id === subjectId)) {
        this.selectedSubjectKey = subjectId;
      }

      const selectedSubject = this.navigationTree.find((subject) => subject.id === this.selectedSubjectKey);
      if (trackId && selectedSubject?.tracks?.some((track) => track.id === trackId)) {
        this.selectedTrackId = trackId;
      }
      this.selectedModeId = 'knowledge_graph';
    },

    selectSubject(subjectId) {
      this.selectedSubjectKey = subjectId;
      this.activeKnowledgeNode = null;
      const subject = this.navigationTree.find((item) => item.id === subjectId);
      const track = subject?.tracks?.find((item) => item.banks.length > 0) || subject?.tracks?.[0];
      this.selectedTrackId = track?.id || '';
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectTrack(trackId) {
      this.selectedTrackId = trackId;
      this.activeKnowledgeNode = null;
      const track = this.selectedSubject?.tracks?.find((item) => item.id === trackId);
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectMode(modeId) {
      this.selectedModeId = modeId;
      if (modeId === 'knowledge_graph') {
        this.scrollKnowledgeGraphIntoView();
      }
    },

    consumePreferredMode() {
      const preferredMode = storageService.get('practice_preferred_mode', '');
      if (preferredMode !== 'knowledge_graph') return;
      storageService.remove('practice_preferred_mode');
      this.selectedModeId = 'knowledge_graph';
      this.activeKnowledgeNode = null;
      this.scrollKnowledgeGraphIntoView();
    },

    scrollKnowledgeGraphIntoView() {
      this.scrollIntoViewId = '';
      this.$nextTick(() => {
        this.scrollIntoViewId = 'knowledge-graph-section';
      });
    },

    isBankLoaded(bankId) {
      return Boolean(this.loadedIds?.has?.(bankId));
    },

    initLayout() {
      try {
        const info = uni.getWindowInfo();
        const statusBarHeight = Number(info.statusBarHeight || 0);
        this.statusBarHeight = statusBarHeight > 0 ? statusBarHeight : 16;
        const safeBottom = info.safeAreaInsets?.bottom || 0;
        this.tabBarHeight = 60 + 12 + safeBottom;
      } catch (_e) {
        logger.warn('[Practice] layout init failed');
      }
    },

    async handleLoadBank(bankId) {
      try {
        this.loadingBankId = bankId;
        await this.loadFlashcardBank(bankId);
        this.refreshBankStatus();
        this.refreshBankSource();
      } catch (e) {
        logger.error('[Practice] load bank failed:', e);
        uni.showToast({ title: '加载失败，请重试', icon: 'none' });
      } finally {
        this.loadingBankId = null;
      }
    },

    goDoQuiz() {
      if (!this.hasReleasedPracticeBank()) {
        this.chooseImportSource();
        return;
      }

      const routeMode = this.selectedTrainingModeMeta.routeMode;
      const query = routeMode && routeMode !== 'smart_review' ? `?mode=${routeMode}` : '';
      safeNavigateTo(`/pages/practice-sub/do-quiz${query}`);
    },

    handleLoadedBankAction() {
      if (this.selectedModeId === 'weakness') {
        this.goSmartReview();
        return;
      }
      if (this.selectedModeId === 'knowledge_graph') {
        this.scrollKnowledgeGraphIntoView();
        return;
      }
      this.goDoQuiz();
    },

    goSmartReview() {
      if (!this.hasReleasedPracticeBank()) {
        this.chooseImportSource();
        return;
      }

      const allQuestions = storageService.get('v30_bank', []);
      safeImport(import('@/services/fsrs-service.js'))
        .then((fsrsMod) => {
          const getDueCards = fsrsMod.getDueCards || fsrsMod.default?.getDueCards;
          const reviewIds = buildDueReviewIds(allQuestions, getDueCards);

          if (reviewIds.length > 0) {
            uni.setStorageSync('smart_review_ids', reviewIds);
            safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
            return;
          }

          safeNavigateTo('/pages/mistake/index?mode=review');
        })
        .catch(() => {
          safeNavigateTo('/pages/mistake/index?mode=review');
        });
    },

    startKnowledgeNodeTraining() {
      const targetNodeId = this.activeKnowledgeNode?.sourceId || this.focusedKnowledgeNode?.nodeId;
      if (!targetNodeId) return;
      if (!this.hasReleasedPracticeBank()) {
        uni.showToast({ title: '当前暂无可练题', icon: 'none' });
        this.chooseImportSource();
        return;
      }

      const bank = storageService.get('v30_bank', []);
      const profile = this.knowledgeGraphProfile;
      const matchedIds = bank
        .filter((question) => {
          const nodeIds = resolveQuestionKnowledge(question, profile);
          return nodeIds.some((nodeId) => getKnowledgeNodeTrail(nodeId).some((node) => node.id === targetNodeId));
        })
        .map(getQuizQuestionId)
        .filter(Boolean);

      if (!matchedIds.length) {
        uni.showToast({ title: '该节点暂无可训练题', icon: 'none' });
        return;
      }

      uni.setStorageSync('smart_review_ids', matchedIds.slice(0, 20));
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
    },

    clearFocusedKnowledgeNode() {
      storageService.remove('practice_focus_knowledge_node');
      this.focusedKnowledgeNode = null;
      this.activeKnowledgeNode = null;
      this.selectedModeId = 'past_exam';
    }
  }
};
</script>

<style lang="scss" scoped>
$primary: #9fe870;
$primary-light: #eafbe2;
$primary-deep: #142017;
$action-green: #18a957;
$bg: #f5f7f1;
$card-bg: #ffffff;
$text-main: #1a1d26;
$text-sub: #5f6672;
$text-weak: #9ca3af;
$radius-lg: 24rpx;
$radius-sm: 12rpx;
$spacing-page: 32rpx;
$spacing-card: 32rpx;
$spacing-section: 24rpx;

.page {
  @include em-mobile-canvas;
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  @include em-mobile-topbar;
}
.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 $spacing-page;
}
.nav-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-deep;
}

.main-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.section {
  padding: 0 $spacing-page;
  margin-bottom: $spacing-section;
}
.section:first-child {
  padding-top: 28rpx;
}

.practice-hero {
  @include em-mobile-deep-panel(38rpx, 36rpx);
}

.practice-hero::after {
  content: '';
  position: absolute;
  right: -72rpx;
  top: -88rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(117, 221, 255, 0.2) 0%, rgba(117, 221, 255, 0) 68%);
}

.practice-kicker {
  position: relative;
  z-index: 1;
  display: block;
  color: rgba(255, 255, 255, 0.48);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 2.2rpx;
}

.practice-title {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.94);
  font-size: 52rpx;
  font-weight: 900;
  line-height: 1.08;
}

.practice-subtitle {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 590rpx;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.66);
  font-size: 26rpx;
  line-height: 1.55;
}

.practice-signal-row {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: 30rpx;
}

.practice-signal {
  flex: 1;
  padding: 18rpx 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.practice-signal + .practice-signal {
  margin-left: 12rpx;
}

.signal-value {
  @include em-mobile-number;
  display: block;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}

.signal-label {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.56);
  font-size: 21rpx;
  font-weight: 600;
}

.practice-command-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  margin-top: 30rpx;
}

.practice-command {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  padding: 22rpx 32rpx;
  border-radius: 999rpx;
  font-size: 27rpx;
  font-weight: 900;
}

.practice-command.primary {
  @include em-mobile-primary-action;
}

.practice-command.secondary {
  margin-left: 14rpx;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.quiet-empty-card {
  padding: 28rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(20, 32, 23, 0.06);
  box-shadow: 0 12rpx 30rpx rgba(20, 32, 23, 0.06);
}

.quiet-empty-title {
  display: block;
  color: $primary-deep;
  font-size: 30rpx;
  font-weight: 850;
  line-height: 1.2;
}

.quiet-empty-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-sub;
  font-size: 23rpx;
  line-height: 1.42;
}

.quiet-empty-actions {
  display: flex;
  margin-top: 20rpx;
}

.quiet-empty-action {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
  color: $primary-deep;
  font-size: 24rpx;
  font-weight: 820;
}

.quiet-empty-action + .quiet-empty-action {
  margin-left: 12rpx;
}

.quiet-empty-action.primary {
  @include em-mobile-primary-action;
}

.focus-card {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-radius: 30rpx;
  @include em-mobile-glass-surface(30rpx, 30rpx);
}

.focus-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 22rpx;
  bottom: 22rpx;
  width: 8rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, $primary 0%, $action-green 100%);
}

.focus-copy {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  padding-left: 8rpx;
}

.focus-kicker {
  display: block;
  color: rgba(20, 32, 23, 0.42);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.8rpx;
}

.focus-title {
  display: block;
  margin-top: 8rpx;
  color: $primary-deep;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.22;
}

.focus-trail {
  display: block;
  margin-top: 8rpx;
  color: $text-sub;
  font-size: 23rpx;
  line-height: 1.42;
}

.focus-actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 144rpx;
  margin-left: 22rpx;
}

.focus-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  border-radius: 999rpx;
  font-size: 23rpx;
  font-weight: 850;
  transition:
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 160ms ease;
}

.focus-action.primary {
  color: #ffffff;
  background: $primary-deep;
  box-shadow: 0 10rpx 24rpx rgba(20, 32, 23, 0.16);
}

.focus-action.ghost {
  margin-top: 12rpx;
  color: rgba(20, 32, 23, 0.64);
  background: rgba(255, 255, 255, 0.68);
  border: 1rpx solid rgba(20, 32, 23, 0.07);
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.navigator-head {
  align-items: flex-start;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 16rpx;
  display: block;
}

.section-head .section-title {
  margin-bottom: 0;
}

.section-meta {
  color: $text-weak;
  font-size: 23rpx;
}

.section-hint {
  display: block;
  margin-top: 6rpx;
  color: $text-weak;
  font-size: 22rpx;
}

.subject-tabs {
  display: flex;
  padding: 8rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.38);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.54);
}

.subject-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  border-radius: 22rpx;
  color: $text-sub;
  font-size: 26rpx;
  font-weight: 750;
}

.subject-tab.active {
  background: rgba(255, 255, 255, 0.9);
  color: $primary-deep;
  box-shadow: 0 10rpx 24rpx rgba(20, 32, 23, 0.08);
}

.track-rail {
  display: flex;
  margin-top: 18rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.track-pill {
  @include em-mobile-glass-surface(26rpx, 18rpx 20rpx);
  display: inline-flex;
  align-items: center;
  min-width: 212rpx;
  margin-right: 14rpx;
}

.track-pill.active {
  background: $primary-deep;
  box-shadow: 0 14rpx 32rpx rgba(20, 32, 23, 0.16);
}

.track-code {
  color: rgba(20, 32, 23, 0.42);
  font-size: 21rpx;
  font-weight: 900;
}

.track-label {
  margin-left: 10rpx;
  color: $text-main;
  font-size: 25rpx;
  font-weight: 850;
}

.track-count {
  margin-left: 12rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(159, 232, 112, 0.2);
  color: $primary-deep;
  font-size: 20rpx;
  font-weight: 900;
}

.track-pill.active .track-code,
.track-pill.active .track-label {
  color: #f8fff2;
}

.track-pill.active .track-count {
  background: $primary;
  color: $primary-deep;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.mode-chip {
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 13rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
  color: $text-sub;
  font-size: 23rpx;
  font-weight: 700;
}

.mode-chip.active {
  background: rgba(159, 232, 112, 0.3);
  color: $primary-deep;
}

.knowledge-map-panel {
  overflow: hidden;
  @include em-mobile-glass-surface(30rpx, 30rpx 28rpx 24rpx);
}

.knowledge-map-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.knowledge-map-kicker {
  display: block;
  color: rgba(20, 32, 23, 0.42);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.8rpx;
}

.knowledge-map-title {
  display: block;
  margin-top: 8rpx;
  color: $primary-deep;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.18;
}

.knowledge-map-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 18rpx;
  padding: 6rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
}

.knowledge-map-control {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
  color: $primary-deep;
  font-size: 32rpx;
  font-weight: 900;
}

.knowledge-map-zoom {
  min-width: 76rpx;
  color: rgba(20, 32, 23, 0.58);
  font-size: 21rpx;
  font-weight: 850;
  text-align: center;
}

.knowledge-system-scroll {
  width: 100%;
  height: 560rpx;
  margin-top: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, rgba(248, 255, 244, 0.86), rgba(255, 255, 255, 0.72));
  border: 1rpx solid rgba(20, 32, 23, 0.06);
  overflow: hidden;
}

.knowledge-system-canvas {
  position: relative;
  transform-origin: 0 0;
}

.knowledge-system-line {
  position: absolute;
  height: 3rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.12);
  transform-origin: 0 50%;
}

.knowledge-system-node {
  @include em-mobile-pressable;
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 2rpx solid rgba(20, 32, 23, 0.08);
  box-shadow: 0 10rpx 24rpx rgba(20, 32, 23, 0.07);
  transition:
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.knowledge-system-node.active {
  border-color: rgba(24, 169, 87, 0.42);
  box-shadow: 0 14rpx 32rpx rgba(24, 169, 87, 0.16);
  transform: scale(1.04);
}

.knowledge-system-node.level-0 {
  border-radius: 28rpx;
  background: $primary-deep;
  border-color: transparent;
}

.knowledge-system-node.level-1 {
  background: rgba(159, 232, 112, 0.94);
}

.knowledge-system-node.level-2 {
  background: rgba(255, 255, 255, 0.96);
}

.knowledge-system-node.level-3 {
  background: rgba(250, 252, 247, 0.96);
}

.knowledge-system-node.level-4 {
  width: 34rpx;
  height: 34rpx;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.knowledge-system-node.state-strong {
  border-color: rgba(24, 169, 87, 0.35);
}

.knowledge-system-node.state-watch {
  border-color: rgba(255, 184, 77, 0.46);
}

.knowledge-system-node.state-weak {
  border-color: rgba(255, 90, 95, 0.42);
}

.knowledge-system-label {
  display: -webkit-box;
  max-width: 100%;
  padding: 0 16rpx;
  overflow: hidden;
  color: $primary-deep;
  font-size: 23rpx;
  font-weight: 850;
  line-height: 1.18;
  text-align: center;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.knowledge-system-node.level-0 .knowledge-system-label {
  color: #ffffff;
  font-size: 25rpx;
}

.knowledge-atom-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 999rpx;
  background: #dfe8dc;
  border: 5rpx solid rgba(255, 255, 255, 0.94);
  box-shadow: 0 5rpx 14rpx rgba(20, 32, 23, 0.14);
}

.knowledge-system-node.state-strong .knowledge-atom-dot {
  background: $primary;
}

.knowledge-system-node.state-watch .knowledge-atom-dot {
  background: #ffd166;
}

.knowledge-system-node.state-weak .knowledge-atom-dot {
  background: #ff5a5f;
}

.knowledge-node-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.84);
  border: 1rpx solid rgba(20, 32, 23, 0.06);
}

.knowledge-node-detail-title {
  display: block;
  color: $primary-deep;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.2;
}

.knowledge-node-detail-path {
  display: block;
  max-width: 510rpx;
  margin-top: 8rpx;
  color: $text-sub;
  font-size: 21rpx;
  line-height: 1.35;
}

.knowledge-node-detail-action {
  @include em-mobile-pressable;
  flex-shrink: 0;
  margin-left: 18rpx;
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: $primary-deep;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 850;
}

.knowledge-map-hint {
  margin-top: 16rpx;
  color: $text-weak;
  font-size: 22rpx;
  line-height: 1.45;
}

.card {
  @include em-mobile-glass-surface($radius-lg, $spacing-card);
}

/* 题库列表 */
.bank-list {
  display: flex;
  flex-direction: column;
}

.bank-card {
  @include em-mobile-pressable;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  transition-property: transform, opacity;
  transition-duration: 160ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.bank-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: 20rpx;
}

.bank-name {
  font-size: 30rpx;
  font-weight: 800;
  color: $text-main;
}

.bank-track {
  color: rgba(22, 51, 0, 0.38);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.4rpx;
  margin-bottom: 8rpx;
}

.bank-desc {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 6rpx;
}

.bank-btn {
  @include em-mobile-pressable;
  padding: 12rpx 28rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.load-btn {
  background: $primary-deep;
}

.bank-btn-text {
  font-size: 26rpx;
  font-weight: 500;
  color: #ffffff;
}

.bank-loaded {
  padding: 12rpx 28rpx;
}

.bank-loaded-text {
  font-size: 26rpx;
  color: $action-green;
  font-weight: 500;
}

.empty-track-card {
  @include em-mobile-glass-surface($radius-lg, 32rpx);
}

.empty-track-title {
  display: block;
  color: $text-main;
  font-size: 30rpx;
  font-weight: 850;
}

.empty-track-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-sub;
  font-size: 24rpx;
  line-height: 1.5;
}

.empty-track-action {
  @include em-mobile-primary-action;
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  margin-top: 22rpx;
  border-radius: 20rpx;
  font-size: 25rpx;
  font-weight: 850;
}

.empty-track-action text {
  color: $primary-deep;
}

/* 状态卡片 */
.status-card {
  margin-bottom: 24rpx;
}

.status-text {
  @include em-mobile-number;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
  display: block;
  margin-bottom: 16rpx;
}

.progress-mini {
  display: flex;
  align-items: center;
}

.progress-bar-sm {
  flex: 1;
  height: 12rpx;
  background: rgba($primary, 0.12);
  border-radius: 99rpx;
  overflow: hidden;
}

.progress-fill-sm {
  height: 100%;
  background: $action-green;
  border-radius: 99rpx;
  transition: width 0.3s ease;
}

.progress-label {
  margin-left: 16rpx;
  font-size: 24rpx;
  color: $text-sub;
  white-space: nowrap;
}

/* 按钮 */
.action-btn {
  @include em-mobile-pressable;
  border-radius: $radius-sm;
  padding: 24rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 16rpx;
}

.primary-btn {
  @include em-mobile-primary-action;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.56);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.68);
}

.action-btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: $primary-deep;
}

.secondary-text {
  color: $primary-deep;
}

.btn-hover {
  opacity: 0.85;
  transform: scale(0.98);
}
</style>
