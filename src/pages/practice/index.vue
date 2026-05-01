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
              <text class="signal-value">{{ loadedBankCount }}</text>
              <text class="signal-label">已加载</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ totalQuestions }}</text>
              <text class="signal-label">可训练题</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ trackCount }}</text>
              <text class="signal-label">公共课轨道</text>
            </view>
          </view>

          <view class="practice-command-row">
            <view
              class="practice-command primary"
              hover-class="btn-hover"
              @tap="hasBank ? goDoQuiz() : chooseImportSource()"
            >
              <text>{{ hasBank ? '进入限时训练' : '导入资料解析' }}</text>
            </view>
            <view class="practice-command secondary" hover-class="btn-hover" @tap="chooseImportSource">
              <text>题库发布台</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!hasPublishedBanks" class="section">
        <view class="release-guard-card">
          <view class="release-guard-copy">
            <text class="release-guard-kicker">PUBLIC RELEASE GUARD</text>
            <text class="release-guard-title">官方真题题库暂未公开</text>
            <text class="release-guard-desc">
              当前仅开放公共课轨道和知识地图预览。题源证据、答案 hash、解析校验全部通过后，题库才会进入训练流。
            </text>
          </view>
          <view class="release-guard-grid">
            <view v-for="item in releaseGuardItems" :key="item.code" class="release-guard-step">
              <text class="release-guard-step-code">{{ item.code }}</text>
              <text class="release-guard-step-label">{{ item.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="focusedKnowledgeNode" class="section">
        <view class="focus-card">
          <view class="focus-copy">
            <text class="focus-kicker">KNOWLEDGE LINK</text>
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
            <text class="section-title">公共课导航</text>
            <text class="section-hint">科目 / 版本 / 训练模式</text>
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
            <text class="section-title">{{ selectedTrack?.label || '公共课' }}</text>
            <text class="section-hint">{{ selectedModeLabel }}</text>
          </view>
          <text class="section-meta">{{ selectedTrackReleaseLabel }}</text>
        </view>

        <view v-if="isKnowledgeGraphMode" id="knowledge-graph-section" class="knowledge-map-panel">
          <view class="knowledge-map-head">
            <view>
              <text class="knowledge-map-kicker">KNOWLEDGE MAP</text>
              <text class="knowledge-map-title">{{ knowledgeGraphSummaryText }}</text>
            </view>
            <view class="knowledge-map-track-badge">
              <text>{{ selectedTrack?.code || 'PUBLIC' }}</text>
            </view>
          </view>

          <view class="knowledge-map-status-row">
            <view v-for="item in knowledgeGraphLegend" :key="item.state" class="knowledge-map-status">
              <view class="knowledge-map-status-dot" :class="`state-${item.state}`" />
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view class="knowledge-map-path">
            <view
              v-for="module in knowledgeGraphModules"
              :key="module.id"
              class="knowledge-module-card"
              :class="{ focused: module.focused }"
            >
              <view class="knowledge-module-rail">
                <view class="knowledge-module-dot" :class="`state-${module.state}`" />
                <view v-if="!module.isLast" class="knowledge-module-line" />
              </view>
              <view class="knowledge-module-body">
                <view class="knowledge-module-top">
                  <view class="knowledge-module-copy">
                    <text class="knowledge-module-name">{{ module.label }}</text>
                    <text class="knowledge-module-meta">{{ module.metaText }}</text>
                  </view>
                  <text class="knowledge-module-state">{{ module.stateLabel }}</text>
                </view>
                <view class="knowledge-topic-row">
                  <view v-for="topic in module.topics" :key="topic.id" class="knowledge-topic-chip">
                    <text>{{ topic.label }}</text>
                  </view>
                  <view v-if="module.extraTopicCount > 0" class="knowledge-topic-chip muted">
                    <text>+{{ module.extraTopicCount }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-else-if="selectedBanks.length > 0" class="bank-list">
          <view v-for="bank in selectedBanks" :key="bank.id" class="card bank-card">
            <view class="bank-info">
              <text class="bank-track">{{ bank.year }} PAST EXAM</text>
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
          <view class="empty-track-stats">
            <view v-for="item in selectedTrackStats" :key="item.label" class="empty-track-stat">
              <text class="empty-track-stat-value">{{ item.value }}</text>
              <text class="empty-track-stat-label">{{ item.label }}</text>
            </view>
          </view>
          <view class="empty-track-action" hover-class="btn-hover" @tap="selectMode('knowledge_graph')">
            <text>查看知识地图</text>
          </view>
        </view>

        <view v-if="pendingBanks.length > 0" class="pending-list">
          <text class="pending-title">清洗队列</text>
          <view v-for="bank in pendingBanks" :key="bank.id" class="pending-item">
            <text class="pending-name">{{ bank.name }}</text>
            <text class="pending-reason">{{ bank.disabledReason || '等待答案校验' }}</text>
          </view>
        </view>
      </view>

      <!-- 已加载统计 + 操作按钮 -->
      <view class="section">
        <view v-if="hasBank" class="card status-card">
          <text class="status-text">已加载 {{ totalQuestions }} 题</text>
          <view class="progress-mini">
            <view class="progress-bar-sm">
              <view class="progress-fill-sm" :style="{ width: progressPercent + '%' }" />
            </view>
            <text class="progress-label">已做 {{ progressPercent }}%</text>
          </view>
        </view>

        <!-- 开始刷题 -->
        <view v-if="hasBank" class="action-btn primary-btn" hover-class="btn-hover" @tap="goDoQuiz">
          <text class="action-btn-text">开始刷题</text>
        </view>

        <!-- 智能复习 -->
        <view v-if="hasBank" class="action-btn secondary-btn" hover-class="btn-hover" @tap="goSmartReview">
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
  getKnowledgeNodeTrail,
  KNOWLEDGE_NODES,
  PUBLIC_COURSE_TRACKS,
  resolveQuestionKnowledge
} from '@/config/knowledge-graph.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';

const KNOWLEDGE_MAP_LEGEND = [
  { state: 'strong', label: '已掌握' },
  { state: 'watch', label: '需复盘' },
  { state: 'unknown', label: '待训练' }
];

function knowledgeStateLabel(state = '') {
  if (state === 'strong') return '当前定位';
  if (state === 'watch') return '重点复盘';
  return '待训练';
}

export default {
  components: { CustomTabbar },

  setup() {
    const dynamicMixinHelper = useDynamicMixin();
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

    practiceHeroKicker() {
      return this.hasPublishedBanks ? 'TRAINING CONTROL' : 'RELEASE REVIEW';
    },

    practiceHeroTitle() {
      return this.hasPublishedBanks ? '真题训练中枢' : '题库校验中';
    },

    practiceHeroSubtitle() {
      if (this.hasPublishedBanks) {
        return '按公共课、考试版本和训练模式进入题库。错题、速度和复习间隔会同步进知识地图。';
      }
      return '公共课导航和知识地图已就绪；正式真题会在题源、答案和解析校验完成后开放训练。';
    },

    bankAvailabilityText() {
      return this.hasPublishedBanks ? `${this.availableBankCount} 个可用题库` : '题库校验中';
    },

    releaseGuardItems() {
      return [
        { code: '01', label: '题源证据' },
        { code: '02', label: '答案校验' },
        { code: '03', label: '真机验收' }
      ];
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

    pendingBanks() {
      return this.selectedTrack?.pendingBanks || [];
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

    selectedTrackReleaseLabel() {
      const coverage = this.selectedTrackCoverage;
      if (!coverage) return this.selectedModeLabel;
      if (coverage.publishedCount > 0) {
        return `${coverage.publishedCount}/${coverage.requiredCount} 已发布`;
      }
      if (coverage.pendingCount > 0) {
        return `${coverage.pendingCount} 套清洗中`;
      }
      return '等待入库';
    },

    selectedTrackStats() {
      const coverage = this.selectedTrackCoverage || {};
      return [
        { label: '已发布', value: coverage.publishedCount || 0 },
        { label: '清洗中', value: coverage.pendingCount || 0 },
        { label: '待入库年份', value: coverage.missingYears?.length || 0 }
      ];
    },

    emptyTrackTitle() {
      if (this.pendingBanks.length > 0) return '该轨道正在清洗';
      return '该轨道等待入库';
    },

    emptyTrackDesc() {
      if (this.pendingBanks.length > 0) {
        return '题目、答案和解析未完成校验前不会发布到刷题中心，避免错误答案污染复习轨迹。';
      }
      return '当前轨道还没有进入 Source Manifest 的可校验资料，先用知识地图确认考试范围和知识层级。';
    },

    isKnowledgeGraphMode() {
      return this.selectedModeId === 'knowledge_graph';
    },

    knowledgeGraphModel() {
      const profile = { tracks: [this.selectedTrack?.id].filter(Boolean) };
      return buildKnowledgeGraph(profile);
    },

    knowledgeGraphLegend() {
      return KNOWLEDGE_MAP_LEGEND;
    },

    knowledgeGraphModules() {
      const focusTrailIds = new Set((this.focusedKnowledgeNode?.trail || []).map((item) => item.id));
      const focusNodeId = this.focusedKnowledgeNode?.nodeId || '';
      const nodes = this.knowledgeGraphModel.nodes;
      const topicsByModule = new Map();
      const microByTopic = new Map();

      nodes
        .filter((node) => node.type === 'topic')
        .forEach((topic) => {
          const list = topicsByModule.get(topic.parentId) || [];
          list.push(topic);
          topicsByModule.set(topic.parentId, list);
        });

      nodes
        .filter((node) => node.type === 'micro')
        .forEach((micro) => {
          const list = microByTopic.get(micro.parentId) || [];
          list.push(micro);
          microByTopic.set(micro.parentId, list);
        });

      const modules = nodes.filter((node) => node.type === 'module');

      return modules.map((module, index) => {
        const topics = topicsByModule.get(module.id) || [];
        const focused = module.id === focusNodeId || focusTrailIds.has(module.id);
        const weakCandidate =
          !focused && topics.some((topic) => topic.id === focusNodeId || focusTrailIds.has(topic.id));
        const state = focused ? 'strong' : weakCandidate ? 'watch' : 'unknown';
        const microCount = topics.reduce((sum, topic) => sum + (microByTopic.get(topic.id)?.length || 0), 0);
        const visibleTopics = topics.slice(0, 4);

        return {
          id: module.id,
          state,
          focused,
          label: module.label,
          stateLabel: knowledgeStateLabel(state),
          metaText: `${topics.length} 个专题 · ${microCount} 个微知识点`,
          topics: visibleTopics,
          extraTopicCount: Math.max(0, topics.length - visibleTopics.length),
          isLast: index === modules.length - 1
        };
      });
    },

    knowledgeGraphSummaryText() {
      const trackLabel = this.selectedTrack?.label || '公共课';
      return `${trackLabel} · ${this.knowledgeGraphModules.length} 个模块`;
    },

    focusedKnowledgeTrailText() {
      const trail = this.focusedKnowledgeNode?.trail || [];
      return trail.length ? trail.map((item) => item.label).join(' / ') : '已从答题结果定位到当前节点';
    }
  },

  onLoad() {
    this.initLayout();
    this.refreshBankStatus();
    this.restoreFocusedKnowledgeNode();
    this.ensureNavigationSelection();
    this.preloadPracticeSubPackage();
  },

  onShow() {
    // 每次切回刷新题库状态（可能在do-quiz中答了题）
    this.refreshBankStatus();
    this.restoreFocusedKnowledgeNode();
    this.ensureNavigationSelection();
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

    chooseImportSource() {
      const cached = this.dynamicMethodsCache?.chooseImportSource;
      if (typeof cached === 'function') {
        return cached();
      }
      safeNavigateTo('/pages/practice-sub/question-bank');
      return undefined;
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
      const trackMeta = PUBLIC_COURSE_TRACKS.find((item) => item.id === trackId);
      const subjectId = subjectNode?.id?.replace('subject:', '') || trackMeta?.subject || '';

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
      const subject = this.navigationTree.find((item) => item.id === subjectId);
      const track = subject?.tracks?.find((item) => item.banks.length > 0) || subject?.tracks?.[0];
      this.selectedTrackId = track?.id || '';
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectTrack(trackId) {
      this.selectedTrackId = trackId;
      const track = this.selectedSubject?.tracks?.find((item) => item.id === trackId);
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectMode(modeId) {
      this.selectedModeId = modeId;
      if (modeId === 'knowledge_graph') {
        this.scrollKnowledgeGraphIntoView();
      }
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
      } catch (e) {
        logger.error('[Practice] load bank failed:', e);
        uni.showToast({ title: '加载失败，请重试', icon: 'none' });
      } finally {
        this.loadingBankId = null;
      }
    },

    goDoQuiz() {
      safeNavigateTo('/pages/practice-sub/do-quiz');
    },

    goSmartReview() {
      // 智能复习：跳转到 do-quiz 的复习模式
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
    },

    startKnowledgeNodeTraining() {
      if (!this.focusedKnowledgeNode?.nodeId) return;
      const bank = storageService.get('v30_bank', []);
      const profile = { tracks: [this.selectedTrack?.id].filter(Boolean) };
      const targetNodeId = this.focusedKnowledgeNode.nodeId;
      const matchedIds = bank
        .filter((question) => {
          const nodeIds = resolveQuestionKnowledge(question, profile);
          return nodeIds.some((nodeId) => getKnowledgeNodeTrail(nodeId).some((node) => node.id === targetNodeId));
        })
        .map((question) => question.id || question._id)
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

.release-guard-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 30rpx;
  border-radius: 30rpx;
  background: #182015;
  box-shadow: 0 18rpx 42rpx rgba(20, 32, 23, 0.14);
}

.release-guard-copy {
  flex: 1;
  min-width: 0;
  padding-right: 22rpx;
}

.release-guard-kicker {
  display: block;
  color: rgba(234, 251, 226, 0.58);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.8rpx;
}

.release-guard-title {
  display: block;
  margin-top: 10rpx;
  color: #f7fff1;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.2;
}

.release-guard-desc {
  display: block;
  margin-top: 10rpx;
  color: rgba(247, 255, 241, 0.72);
  font-size: 23rpx;
  line-height: 1.48;
}

.release-guard-grid {
  flex-shrink: 0;
  width: 196rpx;
  display: flex;
  flex-direction: column;
}

.release-guard-step {
  display: flex;
  align-items: center;
  min-height: 48rpx;
  padding: 8rpx 10rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.08);
}

.release-guard-step + .release-guard-step {
  margin-top: 10rpx;
}

.release-guard-step-code {
  width: 38rpx;
  color: $primary;
  font-size: 20rpx;
  font-weight: 900;
}

.release-guard-step-label {
  flex: 1;
  min-width: 0;
  color: rgba(247, 255, 241, 0.86);
  font-size: 22rpx;
  font-weight: 800;
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

.knowledge-map-track-badge {
  flex-shrink: 0;
  min-width: 84rpx;
  padding: 13rpx 18rpx;
  border-radius: 999rpx;
  background: $primary-deep;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  text-align: center;
}

.knowledge-map-status-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 22rpx;
}

.knowledge-map-status {
  display: flex;
  align-items: center;
  margin-right: 18rpx;
  margin-bottom: 10rpx;
  color: $text-sub;
  font-size: 22rpx;
  font-weight: 700;
}

.knowledge-map-status-dot,
.knowledge-module-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  border: 3rpx solid rgba(20, 32, 23, 0.1);
}

.knowledge-map-status-dot {
  margin-right: 8rpx;
}

.state-strong {
  background: $primary;
}

.state-watch {
  background: #ffd166;
}

.state-unknown {
  background: #dfe8dc;
}

.knowledge-map-path {
  margin-top: 8rpx;
}

.knowledge-module-card {
  display: flex;
  align-items: stretch;
  min-height: 132rpx;
}

.knowledge-module-rail {
  position: relative;
  width: 34rpx;
  display: flex;
  justify-content: center;
  padding-top: 30rpx;
}

.knowledge-module-line {
  position: absolute;
  top: 54rpx;
  bottom: -12rpx;
  left: 50%;
  width: 3rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.12);
  transform: translateX(-50%);
}

.knowledge-module-body {
  flex: 1;
  min-width: 0;
  margin-left: 14rpx;
  margin-bottom: 16rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(20, 32, 23, 0.06);
  box-shadow: 0 8rpx 22rpx rgba(20, 32, 23, 0.05);
}

.knowledge-module-card.focused .knowledge-module-body {
  background: rgba(248, 255, 243, 0.95);
  border-color: rgba(24, 169, 87, 0.22);
}

.knowledge-module-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.knowledge-module-copy {
  flex: 1;
  min-width: 0;
}

.knowledge-module-name {
  display: block;
  color: $primary-deep;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 1.28;
}

.knowledge-module-meta {
  display: block;
  margin-top: 8rpx;
  color: $text-weak;
  font-size: 22rpx;
  line-height: 1.35;
}

.knowledge-module-state {
  flex-shrink: 0;
  margin-left: 18rpx;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
  color: rgba(20, 32, 23, 0.64);
  font-size: 21rpx;
  font-weight: 850;
}

.knowledge-module-card.focused .knowledge-module-state {
  background: rgba(159, 232, 112, 0.36);
  color: $primary-deep;
}

.knowledge-topic-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.knowledge-topic-chip {
  margin-right: 10rpx;
  margin-bottom: 10rpx;
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.055);
  color: $text-sub;
  font-size: 22rpx;
  font-weight: 720;
}

.knowledge-topic-chip.muted {
  color: $text-weak;
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

.empty-track-stats {
  display: flex;
  margin-top: 22rpx;
}

.empty-track-stat {
  flex: 1;
  padding: 16rpx 12rpx;
  border-radius: 18rpx;
  background: rgba(20, 32, 23, 0.045);
}

.empty-track-stat + .empty-track-stat {
  margin-left: 10rpx;
}

.empty-track-stat-value {
  display: block;
  color: $primary-deep;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.empty-track-stat-label {
  display: block;
  margin-top: 8rpx;
  color: $text-weak;
  font-size: 20rpx;
  font-weight: 750;
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

.pending-list {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(20, 32, 23, 0.045);
}

.pending-title {
  display: block;
  color: rgba(20, 32, 23, 0.46);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 1.2rpx;
}

.pending-item {
  display: flex;
  flex-direction: column;
  margin-top: 14rpx;
}

.pending-name {
  color: $text-main;
  font-size: 25rpx;
  font-weight: 800;
}

.pending-reason {
  margin-top: 5rpx;
  color: $text-weak;
  font-size: 22rpx;
  line-height: 1.4;
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
