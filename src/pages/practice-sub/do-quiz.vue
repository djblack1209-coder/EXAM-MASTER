<template>
  <view class="container" :class="{ 'dark-mode': isDark, 'screen-shake': screenShake }">
    <view class="aurora-bg" style="display:none;" />

    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
        <view class="back-area" hover-class="item-hover" @tap="handleExit">
          <text class="back-icon"> ← </text>
          <text id="e2e-quiz-progress" class="progress-text" @tap.stop="showAnswerSheet = true">
            {{ currentIndex + 1 }} / {{ questions.length }}
          </text>
        </view>
        <QuizProgress :total="questions.length" :current="currentIndex" :answered="answeredQuestions" />
        <!-- 单题计时器显示 -->
        <view class="timer-group">
          <view
            v-if="questionTimerEnabled && !hasAnswered"
            class="question-timer-box"
            :class="{ warning: showTimeWarning, danger: questionTimeRemaining <= 10 }"
          >
            <view class="timer-icon">
              <BaseIcon name="timer" :size="28" />
            </view>
            <text class="question-time">
              {{ formatTime(questionTimeRemaining) }}
            </text>
          </view>
          <view class="timer-box">
            <text class="total-label"> 总 </text>
            <text>{{ formatTime(seconds) }}</text>
          </view>
        </view>
      </view>
    </view>

    <scroll-view
      id="e2e-quiz-scroll"
      scroll-y
      class="quiz-scroll"
      :style="{ paddingTop: navBarHeight + 'px' }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- Phase 3-4: 卡片堆叠 — 下一题预览（第二层） -->
      <view
        v-if="questions[currentIndex + 1] && cardStack"
        class="question-container stack-card"
        :style="cardStack.nextCardStyle.value"
      >
        <view class="glass-card question-card">
          <view class="q-header">
            <view class="q-tag">{{ questions[currentIndex + 1].type || '单选题' }}</view>
          </view>
          <view class="q-content-preview">{{ (questions[currentIndex + 1].question || '').substring(0, 60) }}...</view>
        </view>
      </view>

      <view
        v-if="currentQuestion"
        class="question-container"
        :class="[correctAnimationClass, wrongAnimationClass]"
        :style="
          cardStack && cardStack.deltaX.value
            ? cardStack.currentCardStyle.value
            : swipeDeltaX
              ? { transform: `translateX(${swipeDeltaX}px)`, transition: 'none' }
              : { transition: 'transform 0.3s ease' }
        "
      >
        <view v-if="currentQuestion" class="glass-card question-card">
          <view class="q-header">
            <view class="q-tag">
              {{ currentQuestion.type || '单选题' }}
            </view>
            <view class="q-actions">
              <!-- 笔记按钮 -->
              <view
                class="note-btn"
                :class="{ 'has-notes': currentQuestionNotes.length > 0 }"
                hover-class="item-hover"
                @tap.stop="handleOpenNote"
              >
                <view class="note-icon">
                  <BaseIcon name="note" :size="28" />
                </view>
                <text v-if="currentQuestionNotes.length > 0" class="note-count">
                  {{ currentQuestionNotes.length }}
                </text>
              </view>
              <!-- 收藏按钮 -->
              <view
                class="favorite-btn"
                :class="{ 'is-favorited': isCurrentFavorited }"
                hover-class="item-hover"
                @tap.stop="handleToggleFavorite"
              >
                <view class="favorite-icon">
                  <BaseIcon :name="isCurrentFavorited ? 'star' : 'star-outline'" :size="28" />
                </view>
              </view>
            </view>
          </view>
          <RichText class="q-content" :content="currentQuestion.question" />
        </view>

        <view v-if="currentQuestion && currentQuestion.options" class="options-list">
          <view
            v-for="(opt, idx) in currentQuestion.options"
            :id="`e2e-quiz-option-${idx}`"
            :key="idx"
            :class="[
              'glass-card',
              'option-item',
              {
                selected: userChoice === idx,
                correct: hasAnswered && isCorrectOption(idx),
                wrong: hasAnswered && userChoice === idx && !isCorrectOption(idx),
                disabled: isAnalyzing || (hasAnswered && userChoice !== idx)
              }
            ]"
            hover-class="option-hover"
            @tap="selectOption(idx)"
          >
            <view class="opt-index">
              {{ getOptionLabel(idx) }}
            </view>
            <RichText class="opt-text" :content="opt" />
            <view v-if="hasAnswered" class="select-indicator">
              <BaseIcon v-if="isCorrectOption(idx)" name="check" :size="28" />
              <BaseIcon v-else-if="userChoice === idx && !isCorrectOption(idx)" name="cross" :size="28" />
              <view v-else-if="userChoice === idx" class="indicator-circle" />
            </view>
          </view>
        </view>
      </view>

      <!-- ✅ [P0重构] AI分析已改为非阻塞，移除全屏遮罩 -->
      <!-- AI解析在结果弹窗内异步加载，用户可随时点击下一题 -->

      <!-- 结果弹窗 -->
      <view v-if="showResult" :class="['result-pop', resultStatus]" @tap.stop>
        <view class="result-header" @tap.stop>
          <!-- 左侧图标作为关闭按钮 -->
          <view class="result-icon-btn" @tap.stop="closeResult">
            <view class="result-icon">
              <BaseIcon :name="resultStatus === 'correct' ? 'check' : 'cross'" :size="36" />
            </view>
          </view>
          <text class="status-title">
            {{ resultStatus === 'correct' ? 'PASS' : 'LOGIC ERROR' }}
          </text>
        </view>

        <scroll-view v-if="resultStatus === 'wrong'" scroll-y class="ai-analysis-scroll">
          <view class="analysis-tag">
            <view class="sparkle-icon">
              <BaseIcon name="sparkle" :size="28" />
            </view>
            <text>智能深度诊断</text>
            <!-- ✅ [P0重构] 内联AI加载指示器 -->
            <text v-if="!aiComment" class="ai-loading-hint">分析中...</text>
          </view>
          <view class="answer-display">
            <text class="answer-label"> 正确答案： </text>
            <text class="answer-value">
              {{ currentQuestion ? currentQuestion.answer : 'A' }}
            </text>
          </view>
          <RichText
            class="analysis-body"
            :content="aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析')"
          />
        </scroll-view>

        <view v-else class="ai-analysis-brief">
          <text class="label"> 智能简评： </text>
          <RichText :content="aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析')" />
        </view>
        <!-- 新增: FSRS 记忆引擎状态展示 -->
        <MemoryStatsRow v-if="memoryState" :memory-state="memoryState" />

        <!-- 新增: AI Tutor 智能体辅导反馈 -->
        <TutorFeedbackCard v-if="tutorFeedback" :feedback="tutorFeedback" />

        <wd-button
          id="e2e-quiz-next-btn"
          block
          size="large"
          :disabled="isNavigating"
          :loading="isNavigating"
          @click="toNext"
        >
          {{ isNavigating ? '加载中...' : resultStatus === 'correct' ? '进入下一题' : '继续挑战' }}
        </wd-button>
      </view>

      <view class="footer-placeholder" />

      <!-- ✅ 连击特效显示 -->
      <view v-if="showComboEffect && comboDisplay" class="combo-effect">
        <view class="combo-content" :style="{ color: comboDisplay.color }">
          <text class="combo-count">
            {{ comboDisplay.count }}
          </text>
          <text class="combo-label"> 连击! </text>
          <text v-if="comboDisplay.message" class="combo-message">
            {{ comboDisplay.message }}
          </text>
        </view>
      </view>

      <!-- ✅ [体感革命] XP飞入动画 -->
      <view v-if="showXpToast" class="xp-flyout">
        <text class="xp-flyout-text">+{{ xpEarned }} XP{{ xpBoostActive ? ' 🔥2x' : '' }}</text>
      </view>

      <!-- ✅ [上瘾引擎] XP Boost激活指示器 -->
      <view v-if="xpBoostActive" class="xp-boost-indicator">
        <text class="xp-boost-text">2x XP</text>
        <text class="xp-boost-remaining">剩余 {{ xpBoostRemaining }} 题</text>
      </view>

      <!-- ✅ P0-2: 粒子特效 -->
      <view v-if="showParticles" class="particle-container">
        <view
          v-for="p in particles"
          :key="p.id"
          class="particle"
          :class="p.shape"
          :style="{
            '--angle': p.angle + 'deg',
            '--distance': p.distance + 'rpx',
            '--size': p.size + 'rpx',
            '--duration': p.duration + 's',
            '--delay': p.delay + 's',
            '--color': p.color
          }"
        />
      </view>

      <!-- ✅ XP 浮动文字（跨平台） -->
      <XpToast />
    </scroll-view>

    <!-- ✅ 自定义弹窗：题库为空 -->
    <CustomModal
      :visible="showEmptyBankModal"
      type="upload"
      title="题库空空如也"
      content="请先去资料库导入学习资料，智能将为您生成专属题目。"
      confirm-text="去导入"
      :show-cancel="false"
      :is-dark="isDark"
      @confirm="handleEmptyBankConfirm"
    />

    <!-- ✅ 自定义弹窗：恢复进度 -->
    <CustomModal
      :visible="showResumeModal"
      type="info"
      title="检测到未完成的练习"
      :content="resumeModalContent"
      confirm-text="继续答题"
      cancel-text="重新开始"
      :show-cancel="true"
      :is-dark="isDark"
      @confirm="handleResumeConfirm"
      @cancel="handleResumeCancel"
    />

    <!-- ✅ 自定义弹窗：确认退出 -->
    <CustomModal
      :visible="showExitModal"
      type="warning"
      title="确认退出？"
      :content="
        answeredQuestions.length > 0
          ? `已完成 ${answeredQuestions.length} 道题，进度将自动保存，下次可继续答题。`
          : '确定要退出吗？'
      "
      confirm-text="确认退出"
      cancel-text="继续答题"
      :show-cancel="true"
      :is-dark="isDark"
      @confirm="handleExitConfirm"
      @cancel="showExitModal = false"
    />

    <!-- ✅ [P1重构] 练习完成 — 内嵌AI一句话总结 + 薄弱点 + 继续刷题CTA -->
    <CustomModal
      :visible="showCompleteModal"
      type="success"
      title="练习完成"
      :content="completeModalContent"
      :confirm-text="diagnosisLoading ? '正在诊断...' : hasNextRecommendation ? '继续刷下一组' : '查看诊断报告'"
      cancel-text="返回"
      :show-cancel="!diagnosisLoading"
      :is-dark="isDark"
      @confirm="handleCompleteAction"
      @cancel="handleCompleteConfirm"
    />

    <!-- ✅ 笔记输入弹窗 -->
    <view v-if="showNoteModal" class="note-modal-overlay" @tap="showNoteModal = false">
      <view class="note-modal" @tap.stop>
        <view class="note-modal-header">
          <text class="note-modal-title"> 添加笔记 </text>
          <view class="note-modal-close" hover-class="item-hover" @tap="showNoteModal = false">
            <BaseIcon name="close" :size="28" />
          </view>
        </view>
        <textarea
          v-model="noteContent"
          class="note-textarea"
          placeholder="记录你的学习心得..."
          :maxlength="500"
        ></textarea>
        <view class="note-tags">
          <view
            v-for="tag in availableNoteTags"
            :key="tag.id"
            class="note-tag"
            :class="{ selected: selectedNoteTags.includes(tag.id) }"
            :style="{ borderColor: tag.color }"
            hover-class="item-hover"
            @tap="toggleNoteTag(tag.id)"
          >
            <text>{{ tag.icon }} {{ tag.name }}</text>
          </view>
        </view>
        <view class="note-modal-footer">
          <wd-button plain custom-class="note-cancel-btn" @click="showNoteModal = false">取消</wd-button>
          <wd-button custom-class="note-save-btn" @click="handleSaveNote">保存</wd-button>
        </view>
      </view>
    </view>

    <AnswerSheet
      :visible="showAnswerSheet"
      :questions="questions"
      :current-index="currentIndex"
      :answered-questions="answeredQuestions"
      @jump="handleJumpToQuestion"
      @close="showAnswerSheet = false"
    />
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import CustomModal from '@/components/common/CustomModal.vue';
// ✅ P0-3: 导入自动保存功能
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary
} from './useQuizAutoSave.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { getStatusBarHeight, getWindowInfo } from '@/utils/core/system.js';
// ✅ 检查点 5.3: 自适应学习引擎（懒加载：仅在 isAdaptiveMode 时动态导入）
// ✅ 导入题目收藏模块
import { toggleFavorite, isFavorited } from '@/utils/favorite/question-favorite.js';
// ✅ [P3] FSRS复习日程预览
import { scheduleMistakeReview } from '@/utils/practice/mistake-fsrs-scheduler.js';
// ✅ 导入滑动手势模块
import {
  initSwipeGesture,
  bindSwipeCallbacks,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd
} from './swipe-gesture.js';
// ✅ 导入答题动画模块
import { playCorrectAnimation, playWrongAnimation, getComboDisplay, resetAnimation } from './quiz-animation.js';
// ✅ [体感革命] 完成fanfare音效
import { playCompleteFanfare } from '@/utils/practice/quiz-sound.js';
// ✅ [上瘾引擎] XP/等级系统
import { useXPSystem } from '@/composables/useXPSystem.js';
// ✅ Phase 3-4: 卡片堆叠切换
import { useCardStack } from '@/composables/useCardStack.js';
// ✅ 导入单题计时器模块
import { startTimer as startQuestionTimer, stopTimer as stopQuestionTimer } from './question-timer.js';
// ✅ 智能组题与自适应学习模块
import { pickQuestions } from './utils/smart-question-picker.js';
import { generateAdaptiveSequence, getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
// ✅ 导入离线缓存模块
import { checkOfflineAvailability } from './offline-cache.js';
// ✅ 导入题目笔记模块
import { addQuestionNote, getNotesByQuestion, getNoteTags } from './question-note.js';
// ✅ P1: 提取的模块
import {
  saveToMistakes as saveMistake,
  updateMistakeWithAI as updateMistakeAI,
  generateMnemonic
} from './quiz-mistake-handler.js';
import { fetchAIDeepAnalysis as fetchAIAnalysis } from './quiz-ai-analysis.js';
import { recordAnswerToAnalytics as recordAnalytics } from './quiz-analytics-recorder.js';
// ✅ 游戏化桥接：XP / 成就 / 每日挑战 / 视觉反馈
import {
  onQuizSessionStart,
  onAnswerResult,
  onQuizSessionEnd,
  bindGamificationEvents
} from './quiz-gamification-bridge.js';
// ✅ AI 打字机效果
import { useTypewriter } from '@/composables/useTypewriter.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { lafService } from '@/services/lafService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import MemoryStatsRow from './components/quiz-result/MemoryStatsRow.vue';
import TutorFeedbackCard from './components/quiz-result/TutorFeedbackCard.vue';
import XpToast from './components/xp-toast/xp-toast.vue';
import RichText from '@/components/common/RichText.vue';
import AnswerSheet from './components/answer-sheet/answer-sheet.vue';
import QuizProgress from './components/quiz-progress/quiz-progress.vue';
// ✅ [P0重构] 核心引擎 composable
import { useQuizEngine } from '@/composables/useQuizEngine.js';

export default {
  components: {
    CustomModal,
    BaseIcon,
    MemoryStatsRow,
    TutorFeedbackCard,
    XpToast,
    RichText,
    AnswerSheet,
    QuizProgress
  },

  // ✅ [P0重构] 桥接 useQuizEngine — 核心状态和纯逻辑由 composable 管理
  setup() {
    const engine = useQuizEngine({ smartPicker: true, adaptiveMode: true });
    const xpSystem = useXPSystem();
    return {
      _engine: engine,
      engineGetOptionLabel: engine.getOptionLabel,
      engineIsCorrectOption: engine.isCorrectOption,
      // ✅ [上瘾引擎] XP系统
      xpSystem,
      xpCurrentLevel: xpSystem.currentLevel,
      xpLevelProgress: xpSystem.levelProgress
    };
  },
  data() {
    return {
      memoryState: null,
      tutorFeedback: '',
      statusBarHeight: 44,
      navBarHeight: 88, // 标准导航栏高度 = 44 + 44
      capsuleMargin: 100,
      questions: [],
      currentIndex: 0,
      userChoice: null,
      hasAnswered: false,
      seconds: 0,
      timer: null,
      isAnalyzing: false,
      showResult: false,
      resultStatus: '', // 'correct' or 'wrong'
      aiComment: '',
      // ✅ P0-3: 已答题目记录（用于断点续答）
      answeredQuestions: [],
      // ✅ 自定义弹窗状态
      showEmptyBankModal: false,
      showResumeModal: false,
      showExitModal: false,
      showCompleteModal: false,
      resumeModalContent: '',
      // AI诊断闭环状态
      diagnosisLoading: false,
      sessionId: '', // 刷题会话ID（用于AI诊断）
      diagnosisId: '', // 诊断报告ID
      diagnosisReady: false, // 诊断是否完成
      diagnosisSummary: '', // 诊断摘要
      hasNextRecommendation: false, // ✅ [P1] AI是否已推荐下一组题目
      nextRecommendationIds: [], // ✅ [P1] AI推荐的下一组题目ID
      isDark: false,
      // ✅ 防重复点击状态
      isNavigating: false, // 防止快速连续点击"下一题"
      // ✅ 检查点 5.3: 自适应学习状态
      isAdaptiveMode: true, // 是否启用自适应模式
      currentReviewQuestion: null, // 当前复习题
      answerStartTime: 0, // 答题开始时间（用于计算用时）
      // ✅ 收藏状态
      isCurrentFavorited: false, // 当前题目是否已收藏
      // ✅ 滑动手势状态
      swipeDeltaX: 0, // 滑动偏移量
      isSwipeAnimating: false, // 是否正在滑动动画
      // ✅ Phase 3-4: 卡片堆叠切换
      cardStack: null, // useCardStack() 实例
      // ✅ 答题动画状态
      comboDisplay: null, // 连击显示数据
      showComboEffect: false, // 是否显示连击特效
      correctAnimationClass: '', // 正确答案动画类
      wrongAnimationClass: '', // 错误答案动画类
      screenShake: false, // ✅ [体感革命] 屏幕微震
      xpEarned: 0, // ✅ [体感革命] 本次获得的XP
      xpBoostActive: false, // ✅ [上瘾引擎] 2x XP boost激活
      xpBoostRemaining: 0, // ✅ [上瘾引擎] boost剩余题数
      // ✅ P0-2: 粒子特效状态
      particles: [],
      showParticles: false,
      // ✅ 单题计时器状态
      questionTimeLimit: 120, // 当前题目时限（秒）
      questionTimeRemaining: 120, // 剩余时间
      showTimeWarning: false, // 是否显示时间警告
      questionTimerEnabled: true, // 是否启用单题计时
      // ✅ 智能组题状态
      smartPickerEnabled: true, // 是否启用智能组题
      currentQuestionDifficulty: 2, // 当前题目难度
      // ✅ 离线缓存状态
      isOfflineMode: false, // 是否处于离线模式
      offlineAvailable: false, // 是否有离线数据可用
      // ✅ 题目笔记状态
      currentQuestionNotes: [], // 当前题目的笔记
      showNoteModal: false, // 是否显示笔记弹窗
      noteContent: '', // 笔记内容
      selectedNoteTags: [], // 选中的笔记标签
      showAnswerSheet: false // 答题卡显示状态
    };
  },
  computed: {
    completeModalContent() {
      const total = this.questions.length;
      const correct = this.answeredQuestions ? this.answeredQuestions.filter((a) => a.isCorrect).length : 0;
      const wrong = total - correct;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const base = `本次完成 ${total} 题，正确率 ${accuracy}%`;

      // ✅ [P3] 复习日程预览 — 让用户感知"这个App在帮我安排"
      let scheduleHint = '';
      if (wrong > 0) {
        try {
          // 模拟一次 "Again" 评分，预测下次复习时间
          const mockMistake = { fsrs_due: Date.now() };
          const result = scheduleMistakeReview(mockMistake, 'again');
          if (result.fsrs_due) {
            const nextDue = result.fsrs_due - Date.now();
            const mins = Math.round(nextDue / 60000);
            if (mins < 60) {
              scheduleHint = `\n${wrong} 道错题已加入复习计划，约 ${mins} 分钟后首次复习`;
            } else {
              const hours = Math.round(nextDue / 3600000);
              scheduleHint = `\n${wrong} 道错题已加入复习计划，约 ${hours} 小时后首次复习`;
            }
          }
        } catch (_e) {
          // 静默，不影响主流程
        }
      }

      if (this.diagnosisLoading) return `${base}\n\nAI 正在分析你的答题数据...`;
      if (this.diagnosisReady && this.diagnosisSummary) return `${base}\n\n${this.diagnosisSummary}${scheduleHint}`;
      if (this.hasNextRecommendation) return `${base}${scheduleHint}\n\nAI 已根据薄弱点为你准备了下一组练习`;
      return `${base}${scheduleHint}\n\n点击查看 AI 诊断报告`;
    },
    currentQuestion() {
      const q = this.questions[this.currentIndex];
      if (!q) return null;

      // 确保数据格式完整
      return {
        id: q.id || `q_${this.currentIndex}`,
        question: q.question || q.title || '题目加载中...',
        options: Array.isArray(q.options) ? q.options : [],
        answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
        desc: q.desc || q.description || q.analysis || '暂无解析',
        category: q.category || '未分类',
        type: q.type || '单选',
        difficulty: q.difficulty || 2
      };
    },
    isCorrectOption() {
      return (idx) => {
        if (!this.currentQuestion) return false;
        const correctAnswer = this.currentQuestion.answer;
        const optionLabel = this.getOptionLabel(idx);

        // 支持 answer 为 'A'/'B'/'C'/'D'
        if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
          return optionLabel === correctAnswer;
        }

        // 兼容选项内容匹配（如果answer不是A/B/C/D，可能是选项内容）
        const optionText = this.currentQuestion.options[idx] || '';
        return optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer);
      };
    },
    // ✅ 可用的笔记标签
    availableNoteTags() {
      return getNoteTags();
    }
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: '智能刷题 - Exam-Master 考研备考',
      path: '/pages/practice/index'
    };
  },

  onLoad() {
    this.initSystemUI();

    // ✅ 生成刷题会话ID（用于AI诊断闭环）
    this.sessionId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // ✅ F024: 统一使用 storageService 读取主题
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';

    // E005: 注册主题监听一次（在 onLoad 而非 onShow，避免重复绑定）
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // ✅ 初始化滑动手势
    this.initSwipeGesture();

    // ✅ Phase 3-4: 初始化卡片堆叠切换
    this.cardStack = useCardStack({
      onSwipeLeft: () => {
        if (!this.hasAnswered && this.currentIndex < this.questions.length - 1) {
          this.goToNextQuestion();
        }
      },
      onSwipeRight: () => {
        if (!this.hasAnswered && this.currentIndex > 0) {
          this.goToPrevQuestion();
        }
      }
    });

    // 读取页面参数（uni-app onLoad 接收 query 对象）
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage?.$page?.options || currentPage?.options || {};
    if (query.mode === 'single') {
      this._singleMode = true;
    }
    // ✅ [闭环核心] 智能复习模式：从smart-review页传入的复习题目
    if (query.mode === 'smart_review') {
      this._smartReviewMode = true;
    }

    // E005: 延迟重计算，让 UI 先渲染
    setTimeout(() => {
      this.loadQuestions();

      // ✅ P0-3: 检查是否有未完成的进度
      this.checkUnfinishedProgress();

      // ✅ 检查点 5.1: 追踪开始刷题事件
      analytics.trackStartPractice({
        questionCount: this.questions.length,
        mode: this.isAdaptiveMode ? 'adaptive' : 'normal'
      });

      // ✅ 游戏化：会话开始（连续学习检查 + 每日挑战 + 首次练习XP）
      onQuizSessionStart();
      this._gamificationCleanup = bindGamificationEvents();
    }, 16);
  },
  onShow() {
    // 主题监听已在 onLoad 注册，仅刷新当前值
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';
    // ✅ P1-1: 恢复计时器（onHide 时已暂停）
    if (this.questions && this.questions.length > 0 && !this.timer) {
      this.startTimer();
    }
  },
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    stopQuestionTimer();
    // 移除主题事件监听，避免重复绑定
    uni.$off('themeUpdate', this._themeHandler);

    // ✅ 游戏化：会话结束（学习时长成就 + 全对奖励 + 清理事件）
    onQuizSessionEnd();
    if (this._gamificationCleanup) {
      this._gamificationCleanup();
    }

    // ✅ P0-3: 页面卸载时保存进度
    this.saveCurrentProgress(true);

    // ✅ FIX: 错题复习模式结束后恢复原题库
    this._restoreQuestionBankIfReview();

    // ✅ 重置答题动画状态
    resetAnimation();
  },

  // ✅ P0-3: 页面隐藏时也保存进度（应对小程序被杀死的情况）
  onHide() {
    // ✅ P1-1: 暂停计时器，避免后台持续计时
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    stopQuestionTimer();
    this.saveCurrentProgress(true);
  },
  methods: {
    // ✅ FIX: 恢复错题复习模式前的题库
    _restoreQuestionBankIfReview() {
      try {
        const isReview = storageService.get('is_review_mode', false);
        if (isReview) {
          const backup = storageService.get('v30_bank_backup', []);
          if (backup.length > 0) {
            storageService.save('v30_bank', backup);
          }
          storageService.remove('is_review_mode');
          storageService.remove('v30_bank_backup');
          storageService.remove('temp_review_questions');
        }
      } catch (_e) {
        // 静默处理，不影响页面退出
      }
    },
    // ✅ P0-3: 检查未完成的进度
    checkUnfinishedProgress() {
      if (hasUnfinishedProgress()) {
        const summary = getProgressSummary();
        if (summary && summary.currentIndex > 0) {
          // ✅ 使用自定义弹窗
          this.resumeModalContent = `上次答到第 ${summary.currentIndex + 1} 题，用时 ${summary.formattedTime}（${summary.timeAgo}保存）。是否继续？`;
          this.showResumeModal = true;
        } else {
          this.startTimer();
        }
      } else {
        this.startTimer();
      }
    },

    // ✅ P0-3: 恢复进度
    restoreProgress() {
      const progress = loadQuizProgress();
      if (progress) {
        this.currentIndex = progress.currentIndex || 0;
        this.seconds = progress.seconds || 0;
        this.answeredQuestions = progress.answeredQuestions || [];
        this.aiComment = progress.aiComment || '';

        // 如果上次已作答但未进入下一题，重置作答状态
        this.hasAnswered = false;
        this.userChoice = null;
        this.showResult = false;

        logger.log('[do-quiz] ✅ 进度已恢复:', {
          currentIndex: this.currentIndex,
          seconds: this.seconds,
          answeredCount: this.answeredQuestions.length
        });

        uni.showToast({
          title: '进度已恢复',
          icon: 'success',
          duration: 1500
        });
      }
      this.startTimer();
    },

    // ✅ P0-3: 保存当前进度
    saveCurrentProgress(immediate = false) {
      // 只有在有题目且已开始答题时才保存
      if (this.questions.length === 0 || (this.currentIndex === 0 && !this.hasAnswered)) {
        return;
      }

      // 如果已完成所有题目，清除进度
      if (this.currentIndex >= this.questions.length - 1 && this.hasAnswered) {
        clearQuizProgress();
        logger.log('[do-quiz] 练习已完成，清除进度');
        return;
      }

      const success = saveQuizProgress(
        {
          currentIndex: this.currentIndex,
          userChoice: this.userChoice,
          hasAnswered: this.hasAnswered,
          seconds: this.seconds,
          aiComment: this.aiComment,
          answeredQuestions: this.answeredQuestions
        },
        immediate
      );

      if (success) {
        logger.log('[do-quiz] ✅ 进度已自动保存');
      }
    },

    initSystemUI() {
      // 统一计算：状态栏高度
      this.statusBarHeight = getStatusBarHeight();
      // 标准导航栏高度 = 状态栏高度 + 44px
      this.navBarHeight = this.statusBarHeight + 44;

      // #ifdef MP-WEIXIN
      try {
        const capsule = uni.getMenuButtonBoundingClientRect();
        if (capsule && capsule.width > 0) {
          const winInfo = getWindowInfo();
          const windowWidth = winInfo.windowWidth || winInfo.screenWidth;
          this.capsuleMargin = windowWidth - capsule.left + 10;
        } else {
          this.capsuleMargin = 100;
        }
      } catch (e) {
        logger.log('获取胶囊按钮信息失败', e);
        this.capsuleMargin = 100;
      }
      // #endif
      // #ifndef MP-WEIXIN
      this.capsuleMargin = 20;
      // #endif
    },
    async loadQuestions() {
      // ✅ mode=single：从收藏页传入的单题练习
      if (this._singleMode) {
        const singleQ = storageService.get('temp_practice_question', null);
        if (singleQ) {
          this.questions = [
            {
              id: singleQ.id || 'single_q',
              question: singleQ.question,
              options:
                Array.isArray(singleQ.options) && singleQ.options.length >= 4
                  ? singleQ.options
                  : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
              answer: (singleQ.answer || 'A').toString().toUpperCase().charAt(0),
              desc: singleQ.desc || '暂无解析',
              category: singleQ.category || '未分类',
              type: '单选',
              difficulty: 2
            }
          ];
          storageService.remove('temp_practice_question');
          this.startTimer();
          return;
        }
      }

      // ✅ [零摩擦] mode=temp_bank：从拍照搜题直接进入练习
      if (this.mode === 'temp_bank') {
        const tempQuestions = storageService.get('temp_practice_questions', []);
        if (tempQuestions.length > 0) {
          this.questions = tempQuestions.map((q, index) => ({
            id: q.id || `temp_${index}`,
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : [],
            answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
            desc: q.desc || '暂无解析',
            category: q.category || '拍照搜题',
            type: '单选',
            difficulty: q.difficulty || 2,
            source: q.source || 'temp'
          }));
          storageService.remove('temp_practice_questions');
          this.startTimer();
          return;
        }
      }

      // ✅ [闭环核心] mode=smart_review：从智能复习页传入的复习题目
      if (this._smartReviewMode) {
        const reviewIds = uni.getStorageSync('smart_review_ids') || [];
        if (reviewIds.length > 0) {
          const bank = storageService.get('v30_bank', []);
          const reviewQuestions = reviewIds
            .map((id) => bank.find((q) => (q.id || q._id) === id))
            .filter(Boolean)
            .map((q, index) => ({
              id: q.id || q._id || `review_${index}`,
              question: q.question || q.title || `题目 ${index + 1}`,
              options:
                Array.isArray(q.options) && q.options.length >= 4
                  ? q.options
                  : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
              answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
              desc: q.desc || q.description || q.analysis || '暂无解析',
              category: q.category || '未分类',
              type: q.type || '单选',
              difficulty: q.difficulty || 2
            }));
          if (reviewQuestions.length > 0) {
            this.questions = reviewQuestions;
            uni.removeStorageSync('smart_review_ids');
            this.startTimer();
            return;
          }
        }
        // 没找到复习题目，回退到普通模式
        uni.showToast({ title: '复习题目加载失败，已切换普通模式', icon: 'none' });
      }

      // 从本地存储读取题库
      const bank = storageService.get('v30_bank', []);

      if (!bank || bank.length === 0) {
        // ✅ 使用自定义弹窗
        this.showEmptyBankModal = true;
        return;
      }

      // 验证并标准化题目数据
      let questions = bank
        .map((q, index) => ({
          id: q.id || `q_${index}`,
          question: q.question || q.title || `题目 ${index + 1}`,
          options:
            Array.isArray(q.options) && q.options.length >= 4
              ? q.options
              : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
          answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
          desc: q.desc || q.description || q.analysis || '暂无解析',
          category: q.category || '未分类',
          type: q.type || '单选',
          difficulty: q.difficulty || 2
        }))
        .filter((q) => q.question && !/^题目 \d+$/.test(q.question)); // 过滤无效占位题目

      // ✅ 使用智能组题算法优化题目序列（懒加载）
      if (this.smartPickerEnabled && questions.length > 0) {
        questions = pickQuestions(questions, {
          count: Math.min(questions.length, 20),
          mode: 'adaptive',
          includeReview: true,
          reviewRatio: 0.2
        });
        logger.log('[do-quiz] ✅ 智能组题模式已启用');
      } else if (this.isAdaptiveMode && questions.length > 0) {
        // 降级到自适应学习引擎
        questions = generateAdaptiveSequence(questions, {
          insertReviewQuestions: true,
          prioritizeWeak: true,
          maxReviewRatio: 0.3
        });
        logger.log('[do-quiz] ✅ 自适应学习模式已启用，题目序列已优化');
      }

      this.questions = questions;

      if (this.questions.length === 0) {
        // ✅ 使用自定义弹窗
        this.showEmptyBankModal = true;
      }

      // ✅ 记录答题开始时间
      this.answerStartTime = Date.now();

      // ✅ 更新当前题目的收藏状态
      this.updateFavoriteStatus();

      // ✅ 启动单题计时器
      this.startQuestionTimer();
    },
    // 从选项文本中提取标签（如 "A. 选项内容" -> "A"）
    getOptionLabel(idx) {
      if (!this.currentQuestion || !this.currentQuestion.options) return '';
      const option = this.currentQuestion.options[idx] || '';
      // 提取第一个字母作为标签
      const match = option.match(/^([A-D])\./);
      if (match) {
        return match[1].toUpperCase();
      }
      // 如果没有 "A." 格式，使用索引对应
      return ['A', 'B', 'C', 'D'][idx] || 'A';
    },
    startTimer() {
      // 防重入：清除已有定时器，避免多次调用导致计时加速
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.timer = setInterval(() => {
        this.seconds++;
      }, 1000);
    },
    formatTime(s) {
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m < 10 ? '0' + m : m}:${rs < 10 ? '0' + rs : rs}`;
    },
    async selectOption(idx) {
      if (this.isAnalyzing || this.showResult || this.hasAnswered) return;

      this.userChoice = idx;
      this.hasAnswered = true;

      // ✅ 停止单题计时器并记录用时
      const timerResult = stopQuestionTimer();
      const timeSpent = timerResult.elapsed * 1000; // 转换为毫秒

      // 判断答案是否正确
      const isCorrect = this.isCorrectOption(idx);

      // ✅ 记录已答题目
      this.answeredQuestions.push({
        questionId: this.currentQuestion?.id,
        index: this.currentIndex,
        userChoice: idx,
        isCorrect,
        timeSpent
      });

      // ✅ 记录答题数据到各个分析模块
      this.recordAnswerToAnalytics(isCorrect, timeSpent).catch((_err) => {
        /* silent analytics failure */
      });

      // ✅ 游戏化：记录答题结果（XP / 成就 / 每日挑战 / 视觉反馈）
      onAnswerResult({ isCorrect, timeSpent });

      if (isCorrect) {
        // ✅ 播放正确答案动画
        this.playCorrectEffect();

        // 正确时：震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed on correct answer', e);
        }

        // ✅ 延迟解锁防重复点击（300ms后允许再次点击）
        setTimeout(() => {
          this.isNavigating = false;
        }, 300);

        this.resultStatus = 'correct';
        this.updateStudyStats();
        this.showResult = true;
      } else {
        // ✅ 播放错误答案动画
        this.playWrongEffect();

        this.resultStatus = 'wrong';
        // ✅ [P0重构] 非阻塞AI分析：先立即显示结果（题目自带解析），AI异步增强
        this.aiComment = ''; // 清空，让模板先显示 currentQuestion.desc
        this.updateStudyStats();
        this.showResult = true; // 立即显示结果弹窗，不等AI

        // 错误时：先保存到错题本（不含智能解析）
        this.saveToMistakes().catch((_err) => {
          /* silent save failure */
        });
        // AI深度解析异步执行，完成后自动替换解析内容（打字机效果）
        this.fetchAIDeepAnalysis(this.currentQuestion, this.currentQuestion.options[idx]).catch((aiErr) => {
          logger.warn('[do-quiz] AI深度解析失败，不影响答题流程:', aiErr);
        });
        // ✅ [差异化壁垒] 异步生成记忆口诀/助记符（不阻塞）
        generateMnemonic({
          currentQuestion: this.currentQuestion,
          correctAnswer: this.currentQuestion.answer
        }).catch(() => {
          /* silent */
        });
      }
    },
    // ✅ [P0重构] AI深度解析 — 非阻塞：不再显示全屏遮罩，异步增强已显示的解析内容
    async fetchAIDeepAnalysis(question, userChoice) {
      // 不再设置 isAnalyzing = true（不阻塞UI）

      // 初始化打字机（懒创建）
      if (!this._typewriter) {
        this._typewriter = useTypewriter({
          speed: 25,
          initialDelay: 100,
          onChar: (text) => {
            this.aiComment = text;
          }
        });
      }

      try {
        const result = await fetchAIAnalysis({ question, userChoice });

        if (result.success) {
          // 将智能解析同步保存到错题本（用完整文本）
          this.updateMistakeWithAI(result.comment);
        }

        // 用打字机效果逐字显示 AI 回复（替换题目自带解析）
        await this._typewriter.startTyping(result.comment);
      } catch (e) {
        // 静默失败，用户已经能看到题目自带解析
        logger.warn('[do-quiz] AI解析异步增强失败:', e);
      }
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    async saveToMistakes() {
      await saveMistake({
        currentQuestion: this.currentQuestion,
        userChoice: this.userChoice,
        aiComment: this.aiComment
      });
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    updateMistakeWithAI(aiAnalysis) {
      updateMistakeAI({
        currentQuestion: this.currentQuestion,
        aiAnalysis
      });
    },
    updateStudyStats() {
      // 更新学习热力图数据
      const today = new Date().toISOString().split('T')[0];
      const stats = storageService.get('study_stats', {});
      stats[today] = (stats[today] || 0) + 1;
      storageService.save('study_stats', stats);
    },
    async toNext() {
      // ✅ 防重复点击保护
      if (this.isNavigating) {
        return;
      }
      this.isNavigating = true;

      // 重置状态
      this.showResult = false;
      this.isAnalyzing = false;

      // 停止打字机效果（如果正在进行）
      if (this._typewriter) {
        this._typewriter.stopTyping();
      }

      if (this.currentIndex < this.questions.length - 1) {
        // ✅ 检查点 5.3: 检查是否需要插入复习题
        if (this.isAdaptiveMode) {
          const recommendation = getNextRecommendedQuestion(this.currentIndex, this.questions);
          if (recommendation && recommendation.isReview) {
            // 插入复习题
            this.questions.splice(this.currentIndex + 1, 0, recommendation.question);
            logger.log('[do-quiz] ✅ 插入复习题:', recommendation.reason);

            // 显示复习提示
            uni.showToast({
              title: '复习时间到！',
              icon: 'none',
              duration: 1500
            });
          }
        }

        this.currentIndex++;
        this.hasAnswered = false;
        this.userChoice = null;
        this.showResult = false;
        this.aiComment = '';

        // ✅ 重置答题开始时间
        this.answerStartTime = Date.now();

        // ✅ P0-3: 进入下一题时保存进度
        this.saveCurrentProgress();

        // 震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed on next question', e);
        }

        // ✅ 延迟解锁防重复点击（300ms后允许再次点击）
        setTimeout(() => {
          this.isNavigating = false;
        }, 300);
      } else {
        // ✅ P0-3: 练习完成，清除进度
        clearQuizProgress();

        // ✅ 检查点 5.1: 追踪完成练习事件
        analytics.trackConversion('COMPLETE_SESSION', {
          totalQuestions: this.questions.length,
          correctCount: this.answeredQuestions.filter((a) => a.isCorrect).length,
          totalTime: this.seconds
        });

        // ✅ [闭环核心] 自动触发AI诊断（不等用户点击）
        this.showCompleteModal = true;
        // ✅ [上瘾引擎] 完成session，全对额外奖励
        const isPerfect = this.answeredQuestions.every((a) => a.isCorrect);
        const sessionBonus = this.xpSystem.completeSession(isPerfect);
        if (sessionBonus > 0) {
          this.xpEarned = sessionBonus;
          this.showXpToast = true;
          setTimeout(() => {
            this.showXpToast = false;
          }, 2000);
        }
        // ✅ [体感革命] 完成fanfare + confetti
        playCompleteFanfare();
        import('canvas-confetti')
          .then((mod) => {
            const confetti = mod.default || mod;
            if (confetti) {
              const end = Date.now() + 2000;
              const frame = () => {
                confetti({
                  particleCount: 4,
                  angle: 60,
                  spread: 55,
                  origin: { x: 0 },
                  colors: ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50']
                });
                confetti({
                  particleCount: 4,
                  angle: 120,
                  spread: 55,
                  origin: { x: 1 },
                  colors: ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50']
                });
                if (Date.now() < end) requestAnimationFrame(frame);
              };
              frame();
            }
          })
          .catch(() => {});
        this.autoDiagnose();
      }
    },
    handleExit() {
      // ✅ 使用自定义弹窗
      this.showExitModal = true;
    },

    // ✅ 处理退出确认
    handleExitConfirm() {
      this.showExitModal = false;
      // P0-3: 退出前保存进度
      this.saveCurrentProgress();

      if (this.timer) {
        clearInterval(this.timer);
      }
      stopQuestionTimer();
      uni.navigateBack();
    },

    // ✅ 处理题库为空确认
    handleEmptyBankConfirm() {
      this.showEmptyBankModal = false;
      safeNavigateTo('/pages/practice-sub/import-data');
    },

    // ✅ 处理恢复进度确认
    handleResumeConfirm() {
      this.showResumeModal = false;
      this.restoreProgress();
    },

    // ✅ 处理恢复进度取消（重新开始）
    handleResumeCancel() {
      this.showResumeModal = false;
      clearQuizProgress();
      this.startTimer();
    },

    // ✅ [闭环核心] 自动诊断 + AI推荐下一组 — 刷题结束后台自动触发
    async autoDiagnose() {
      if (!this.sessionId || this.answeredQuestions.length < 3) {
        return;
      }
      this.diagnosisLoading = true;
      try {
        // 并行：诊断 + 获取下一组推荐
        const [diagRes, recRes] = await Promise.allSettled([
          lafService.generateDiagnosis(this.sessionId),
          lafService.getSmartRecommendations(10)
        ]);

        // 处理诊断结果
        if (diagRes.status === 'fulfilled' && diagRes.value.code === 0 && diagRes.value.data) {
          this.diagnosisId = diagRes.value.data._id;
          const d = diagRes.value.data.diagnosis || {};
          this.diagnosisReady = true;
          const weakStr = (d.weakPoints || [])
            .slice(0, 3)
            .map((w) => w.knowledgePoint)
            .join('、');
          this.diagnosisSummary = d.overallLevel
            ? `${d.overallLevel}（${d.accuracy || 0}%）${weakStr ? '\n薄弱点：' + weakStr : ''}\n${d.encouragement || ''}`
            : '诊断完成';
        }

        // 处理推荐结果 — AI自动推荐下一组
        if (recRes.status === 'fulfilled' && recRes.value.code === 0 && recRes.value.data) {
          const ids = (recRes.value.data.questions || recRes.value.data || [])
            .map((q) => q.id || q._id)
            .filter(Boolean);
          if (ids.length > 0) {
            this.nextRecommendationIds = ids;
            this.hasNextRecommendation = true;
          }
        }
      } catch (e) {
        logger.warn('[do-quiz] 自动诊断失败:', e);
      } finally {
        this.diagnosisLoading = false;
      }
    },

    // ✅ [P1重构] 完成弹窗主按钮 — 根据是否有推荐决定行为
    handleCompleteAction() {
      if (this.hasNextRecommendation && this.nextRecommendationIds.length > 0) {
        // AI已推荐下一组，直接开始
        this.showCompleteModal = false;
        uni.setStorageSync('smart_review_ids', this.nextRecommendationIds);
        uni.redirectTo({ url: '/pages/practice-sub/do-quiz?mode=smart_review' });
      } else {
        // 没有推荐，查看诊断报告
        this.viewDiagnosisReport();
      }
    },

    // ✅ 查看诊断报告
    viewDiagnosisReport() {
      this.showCompleteModal = false;
      if (this.diagnosisId) {
        uni.navigateTo({
          url: `/pages/practice-sub/diagnosis-report?diagnosisId=${this.diagnosisId}&sessionId=${this.sessionId}`
        });
      } else if (this.diagnosisLoading) {
        // 还在诊断中，等一下
        uni.showToast({ title: 'AI 正在分析中，请稍候...', icon: 'none' });
        this.showCompleteModal = true;
      } else {
        // 诊断失败，直接返回
        uni.navigateBack();
      }
    },

    // ✅ 处理练习完成确认
    handleCompleteConfirm() {
      this.showCompleteModal = false;
      this.isNavigating = false;
      uni.navigateBack();
    },

    // ✅ [闭环核心] AI智能诊断 — 刷题结束后触发
    async handleDiagnosis() {
      if (this.diagnosisLoading) return;
      if (!this.sessionId) {
        uni.showToast({ title: '会话数据不足，无法诊断', icon: 'none' });
        this.handleCompleteConfirm();
        return;
      }

      this.diagnosisLoading = true;
      try {
        const res = await lafService.generateDiagnosis(this.sessionId);
        if (res.code === 0 && res.data) {
          this.showCompleteModal = false;
          const diagnosisId = res.data._id;
          uni.navigateTo({
            url: `/pages/practice-sub/diagnosis-report?diagnosisId=${diagnosisId}&sessionId=${this.sessionId}`,
            fail: () => {
              const d = res.data.diagnosis || {};
              uni.showModal({
                title: `诊断结果：${d.overallLevel || '完成'}`,
                content: `正确率 ${d.accuracy || 0}%\n${d.encouragement || '继续加油！'}\n\n薄弱点：${(d.weakPoints || []).map((w) => w.knowledgePoint).join('、') || '无'}\n\n建议：${d.studyPlan?.immediate || '复习错题'}`,
                confirmText: '开始复习',
                cancelText: '返回',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    uni.navigateTo({ url: '/pages/mistake/index' });
                  } else {
                    uni.navigateBack();
                  }
                }
              });
            }
          });
        } else {
          uni.showToast({ title: res.message || '诊断失败', icon: 'none' });
        }
      } catch (e) {
        logger.warn('[do-quiz] AI诊断失败:', e);
        uni.showToast({ title: '诊断失败，请稍后重试', icon: 'none' });
      } finally {
        this.diagnosisLoading = false;
      }
    },

    closeResult() {
      if (this.hasAnswered) {
        this.toNext();
        return;
      }
      this.showResult = false;
      this.isAnalyzing = false;
    },

    // ==================== 滑动手势相关方法 ====================

    // ✅ 初始化滑动手势
    initSwipeGesture() {
      initSwipeGesture();

      // 绑定滑动回调
      bindSwipeCallbacks({
        onSwipeLeft: (_data) => {
          // 向左滑动 = 下一题
          if (!this.hasAnswered && this.currentIndex < this.questions.length - 1) {
            this.goToNextQuestion();
          }
        },
        onSwipeRight: (_data) => {
          // 向右滑动 = 上一题
          if (!this.hasAnswered && this.currentIndex > 0) {
            this.goToPrevQuestion();
          }
        },
        onSwipeMove: (data) => {
          // 滑动过程中更新偏移量
          if (!this.hasAnswered) {
            this.swipeDeltaX = data.deltaX;
          }
        },
        onSwipeEnd: (_data) => {
          // 滑动结束，重置偏移量
          this.swipeDeltaX = 0;
        },
        onBoundaryReached: (data) => {
          // 到达边界时的反馈已在模块内处理
          logger.log('[do-quiz] 到达边界:', data.boundary);
        }
      });

      logger.log('[do-quiz] ✅ 滑动手势已初始化');
    },

    // ✅ 触摸开始
    onTouchStart(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchStart(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠触摸
      if (this.cardStack) this.cardStack.onTouchStart(event);
    },

    // ✅ 触摸移动
    onTouchMove(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchMove(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠跟随
      if (this.cardStack) this.cardStack.onTouchMove(event);
    },

    // ✅ 触摸结束
    onTouchEnd(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchEnd(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠释放
      if (this.cardStack) this.cardStack.onTouchEnd(event);
    },

    // ✅ 获取滑动上下文
    getSwipeContext() {
      return {
        currentIndex: this.currentIndex,
        totalQuestions: this.questions.length,
        hasAnswered: this.hasAnswered
      };
    },

    // ✅ 跳转到上一题
    goToPrevQuestion() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到上一题:', this.currentIndex);
      }
    },

    // ✅ 跳转到下一题
    goToNextQuestion() {
      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到下一题:', this.currentIndex);
      }
    },

    // ✅ 重置题目状态
    resetQuestionState() {
      this.hasAnswered = false;
      this.userChoice = null;
      this.showResult = false;
      this.aiComment = '';
      this.answerStartTime = Date.now();
      this.correctAnimationClass = '';
      this.wrongAnimationClass = '';
      this.showTimeWarning = false;

      // ✅ 重新启动单题计时器
      this.startQuestionTimer();

      // ✅ 更新当前题目的笔记
      this.updateQuestionNotes();
    },

    // ==================== 收藏功能相关方法 ====================

    // ✅ 切换收藏状态
    handleToggleFavorite() {
      if (!this.currentQuestion) return;

      const result = toggleFavorite(this.currentQuestion);
      this.isCurrentFavorited = !this.isCurrentFavorited;

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' });
        }
      } catch {
        /* ignore */
      }

      logger.log('[do-quiz] ✅ 收藏状态切换:', result);
    },

    // ✅ 更新当前题目的收藏状态
    updateFavoriteStatus() {
      if (this.currentQuestion) {
        this.isCurrentFavorited = isFavorited(this.currentQuestion.id || this.currentQuestion.question);
      }
    },

    // ==================== 答题动画相关方法 ====================

    // ✅ 播放正确答案动画
    playCorrectEffect() {
      const animData = playCorrectAnimation();
      if (animData) {
        this.correctAnimationClass = 'quiz-correct-animation';

        // ✅ [上瘾引擎] 真实XP奖励 + 2x boost机制
        let xpMultiplier = 1;
        if (this.xpBoostActive && this.xpBoostRemaining > 0) {
          xpMultiplier = 2;
          this.xpBoostRemaining--;
          if (this.xpBoostRemaining <= 0) this.xpBoostActive = false;
        }
        const xpResult = this.xpSystem.earnXP({
          combo: animData.combo || 0,
          difficulty: this.currentQuestion?.difficulty || 2,
          isReview: this.mode === 'smart_review'
        });
        const finalXP = Math.round(xpResult.xpEarned * xpMultiplier);
        if (xpMultiplier > 1) {
          // 补偿boost差额
          const bonus = xpResult.xpEarned;
          this.xpSystem.state.value.totalXP += bonus;
          this.xpSystem.state.value.todayXP += bonus;
        }
        this.xpEarned = finalXP;
        this.showXpToast = true;
        setTimeout(() => {
          this.showXpToast = false;
        }, 1800);

        // ✅ [上瘾引擎] 5连击触发2x XP boost（3题有效）
        if ((animData.combo || 0) === 5 && !this.xpBoostActive) {
          this.xpBoostActive = true;
          this.xpBoostRemaining = 3;
          setTimeout(() => {
            uni.showToast({ title: '2x XP Boost! 接下来3题双倍经验', icon: 'none', duration: 2000 });
          }, 500);
        }

        // ✅ [上瘾引擎] 升级提示
        if (xpResult.levelUp && xpResult.newLevel) {
          setTimeout(() => {
            uni.showToast({ title: `升级！${xpResult.newLevel.title}`, icon: 'none', duration: 2500 });
          }, 800);
        }

        // ✅ P0-2: 激活粒子特效（canvas-confetti已在quiz-animation.js中触发）
        if (animData.particles && animData.particles.length > 0) {
          this.particles = animData.particles;
          this.showParticles = true;
          setTimeout(() => {
            this.showParticles = false;
            this.particles = [];
          }, 1000);
        }

        // 更新连击显示
        this.comboDisplay = getComboDisplay();
        if (this.comboDisplay && this.comboDisplay.count >= 3) {
          this.showComboEffect = true;
          setTimeout(() => {
            this.showComboEffect = false;
          }, 2000);
        }

        // 动画结束后清除类名
        setTimeout(() => {
          this.correctAnimationClass = '';
        }, 600);
      }
    },

    // ✅ [体感革命] 播放错误答案动画 — 屏幕微震+红色脉冲
    playWrongEffect() {
      const animData = playWrongAnimation();
      if (animData) {
        this.wrongAnimationClass = 'quiz-wrong-animation';

        // ✅ [体感革命] 屏幕微震效果
        this.screenShake = true;
        setTimeout(() => {
          this.screenShake = false;
        }, 500);

        // 重置连击显示
        this.comboDisplay = null;
        this.showComboEffect = false;

        // 动画结束后清除类名
        setTimeout(() => {
          this.wrongAnimationClass = '';
        }, 500);
      }
    },

    // ==================== 单题计时器相关方法 ====================

    // ✅ 启动单题计时器
    startQuestionTimer() {
      if (!this.questionTimerEnabled || !this.currentQuestion) return;

      const difficulty = this.currentQuestion.difficulty || 2;
      this.currentQuestionDifficulty = difficulty;

      const timerResult = startQuestionTimer({
        difficulty,
        onTick: (data) => {
          this.questionTimeRemaining = data.remaining;
          this.showTimeWarning = data.progress >= 0.8;
        },
        onWarning: (data) => {
          if (data.level === 'warning') {
            uni.showToast({
              title: data.message,
              icon: 'none',
              duration: 2000
            });
          }
        },
        onTimeout: (_data) => {
          // 超时处理
          if (!this.hasAnswered) {
            uni.showToast({
              title: '时间到！',
              icon: 'none',
              duration: 2000
            });
          }
        }
      });

      this.questionTimeLimit = timerResult.timeLimit;
      this.questionTimeRemaining = timerResult.remaining;

      logger.log('[do-quiz] ✅ 单题计时器已启动:', {
        timeLimit: timerResult.timeLimit,
        difficulty
      });
    },

    // ==================== 数据分析记录方法 ====================

    // ✅ P1: 委托给 quiz-analytics-recorder.js（组件状态更新保留在组件内）
    async recordAnswerToAnalytics(isCorrect, timeSpent) {
      const questionData = await recordAnalytics({
        currentQuestion: this.currentQuestion,
        isCorrect,
        timeSpent,
        userChoice: this.userChoice,
        questionTimeLimit: this.questionTimeLimit,
        getOptionLabel: (idx) => this.getOptionLabel(idx),
        sessionId: this.sessionId
      });

      // 添加到已答题目列表（组件状态，不可外移）
      if (questionData) {
        this.answeredQuestions.push({
          questionId: this.currentQuestion.id,
          isCorrect,
          timeSpent,
          timestamp: Date.now()
        });
      }
    },

    // ==================== 离线缓存相关方法 ====================

    // ✅ 检查离线数据可用性
    checkOfflineData() {
      const status = checkOfflineAvailability();
      this.offlineAvailable = status.available;
      this.isOfflineMode = !status.isOnline && status.available;

      if (this.isOfflineMode) {
        uni.showToast({
          title: '已切换到离线模式',
          icon: 'none',
          duration: 2000
        });
      }

      logger.log('[do-quiz] 离线状态:', status);
    },

    // ==================== 题目笔记相关方法 ====================

    // ✅ 打开笔记弹窗
    handleOpenNote() {
      if (!this.currentQuestion) return;

      // 加载当前题目的笔记
      this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

      // 重置输入状态
      this.noteContent = '';
      this.selectedNoteTags = [];
      this.showNoteModal = true;
    },

    // ✅ 切换笔记标签
    toggleNoteTag(tagId) {
      const index = this.selectedNoteTags.indexOf(tagId);
      if (index >= 0) {
        this.selectedNoteTags.splice(index, 1);
      } else {
        this.selectedNoteTags.push(tagId);
      }
    },

    // ✅ 保存笔记
    handleSaveNote() {
      if (!this.noteContent.trim()) {
        uni.showToast({
          title: '请输入笔记内容',
          icon: 'none'
        });
        return;
      }

      const result = addQuestionNote({
        questionId: this.currentQuestion.id || this.currentQuestion.question,
        questionContent: this.currentQuestion.question,
        content: this.noteContent.trim(),
        tags: this.selectedNoteTags,
        category: this.currentQuestion.category
      });

      if (result.success) {
        uni.showToast({
          title: '笔记已保存',
          icon: 'success'
        });

        // 更新当前题目的笔记列表
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

        this.showNoteModal = false;
        this.noteContent = '';
        this.selectedNoteTags = [];
      } else {
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    },

    // ✅ 更新当前题目的笔记
    updateQuestionNotes() {
      if (this.currentQuestion) {
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);
      }
    },

    // ✅ 答题卡跳转到指定题目
    handleJumpToQuestion(index) {
      this.showAnswerSheet = false;
      this.currentIndex = index;
      this.resetQuestionState();
      this.updateFavoriteStatus();
      logger.log('[do-quiz] ✅ 跳转到题目:', index);
    }
  }
};
</script>

<style lang="scss" scoped>
/* 容器样式 */
.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
  position: relative;
  overflow: hidden;
}

/* 极光背景 */
.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 600rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

/* 导航栏 */
.nav-header {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-glass);
  /* backdrop-filter: blur(20px); removed */ background-color: rgba(28, 28, 30, 0.95);
  
}
.nav-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}
.back-area {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
}
.back-icon {
  font-size: 36rpx;
  color: var(--text-primary);
  font-weight: bold;
}
.progress-text {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary);
}
.timer-box {
  font-size: 24rpx;
  color: var(--text-sub);
  background: var(--bg-secondary);
  padding: 4rpx 20rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  @include em-flex-gap(8rpx, row);
}
.timer-icon {
  font-size: 24rpx;
}

/* 计时器组 */
.timer-group {
  display: flex;
  align-items: center;
  @include em-flex-gap(12rpx, row);
}

.total-label {
  font-size: 20rpx;
  color: var(--text-sub);
  opacity: 0.7;
}

/* 单题计时器 */
.question-timer-box {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--text-primary);
  background: var(--primary);
  padding: 6rpx 24rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  @include em-flex-gap(8rpx, row);
  transition: all 0.3s ease;
}

.question-timer-box .timer-icon {
  font-size: 26rpx;
}

.question-timer-box .question-time {
  min-width: 80rpx;
  text-align: center;
}

/* 时间警告状态 */
.question-timer-box.warning {
  background: linear-gradient(135deg, var(--ds-color-warning, #ff9800), #f57c00);
  animation: timerPulse 1s ease-in-out infinite;
}

/* 时间危险状态 */
.question-timer-box.danger {
  background: linear-gradient(135deg, var(--ds-color-error, #f44336), #d32f2f);
  animation: timerShake 0.5s ease-in-out infinite;
}

@keyframes timerPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes timerShake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4rpx);
  }
  75% {
    transform: translateX(4rpx);
  }
}

/* 滚动区域 */
.quiz-scroll {
  height: 100%;
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 玻璃卡片通用样式 */
.glass-card {
  background: var(--bg-glass);
  /* backdrop-filter: blur(20px); removed */ background-color: rgba(28, 28, 30, 0.95);
  
  border: 1px solid var(--border);
  border-radius: 40rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
}

/* Phase 3-4: 卡片堆叠样式 */
.stack-card {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  pointer-events: none;
}
.stack-card .glass-card {
  opacity: 0.7;
}
.q-content-preview {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  max-height: 80rpx;
}

/* 题目卡片 */
.question-card .q-tag {
  display: inline-block;
  background: var(--primary);
  color: var(--text-primary-foreground);
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}
.question-card .q-content {
  font-size: 34rpx;
  font-weight: bold;
  line-height: 1.6;
  color: var(--text-primary);
  display: block;
}

/* 选项列表 */
.options-list {
  margin-top: 20rpx;
}
.option-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  transition: all 0.2s;
  position: relative;
}
.option-item.selected {
  border-color: var(--primary);
  background: var(--success-light);
}
.option-item.correct {
  border-color: var(--primary);
  background: var(--success-light);
}
.option-item.wrong {
  border-color: var(--danger);
  background: var(--danger-light);
}
.option-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.opt-index {
  width: 50rpx;
  font-weight: 900;
  color: var(--primary);
  font-size: 32rpx;
  flex-shrink: 0;
}
.opt-text {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-sub);
  line-height: 1.5;
  word-break: break-all;
}
.select-indicator {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--primary);
  flex-shrink: 0;
}

/* 智能反馈图层动画 */
.ai-feedback-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  background: var(--overlay);
  /* backdrop-filter: blur(10px); removed */ background-color: rgba(28, 28, 30, 0.95);
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6rpx;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  will-change: transform, opacity;
  animation: scanMove 2s infinite;
}
@keyframes scanMove {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh);
    opacity: 0;
  }
}

.thinking-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  @include em-flex-gap(30rpx);
}
.pulse-ring {
  width: 140rpx;
  height: 140rpx;
  border: 4rpx solid var(--primary);
  border-radius: 50%;
  animation: ringPulse 1.5s infinite;
}
@keyframes ringPulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
.ai-text {
  margin-top: 20rpx;
  font-weight: bold;
  color: var(--primary);
  font-size: 28rpx;
}

/* 结果弹窗 */
.result-pop {
  position: fixed;
  /* 适配 iPhone 14/15 Pro 底部安全区域：使用 env() 动态计算 bottom 值 */
  bottom: calc(40rpx + constant(safe-area-inset-bottom));
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  left: 30rpx;
  right: 30rpx;
  z-index: 300;
  padding: 40rpx;
  border-radius: 40rpx;
  background-color: rgba(28, 28, 30, 0.95); /* removed blur for performance */
  
  box-shadow: var(--shadow-xl, 0 8px 32px rgba(0, 0, 0, 0.12));
  animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.result-pop.correct {
  background: var(--success);
  color: var(--text-primary-foreground);
}
.result-pop.wrong {
  background: var(--danger);
  color: var(--text-primary-foreground);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  @include em-flex-gap(20rpx, row);
  margin-bottom: 20rpx;
  position: relative;
}

.result-icon-btn {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--overlay);
  /* backdrop-filter: blur(10px); removed */ background-color: rgba(28, 28, 30, 0.95);
  
  transition: all 0.3s;
  flex-shrink: 0;
}

.result-icon-btn:active {
  background: var(--bg-secondary);
  transform: scale(0.95);
}

.result-icon {
  font-size: 60rpx;
  font-weight: bold;
  color: var(--text-primary-foreground);
}

.status-title {
  font-size: 36rpx;
  font-weight: 800;
  flex: 1;
  text-align: center;
}

/* 智能深度诊断区域 */
.ai-analysis-scroll {
  max-height: 400rpx;
  margin-bottom: 30rpx;
  padding: 20rpx 0;
}
.analysis-tag {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
  margin-bottom: 20rpx;
  padding: 10rpx 20rpx;
  background: var(--overlay);
  border-radius: 20rpx;
}
.sparkle-icon {
  font-size: 28rpx;
}
.analysis-tag text {
  font-size: 24rpx;
  font-weight: 600;
  opacity: 0.9;
}
.analysis-body {
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
  display: block;
  padding: 0 20rpx;
}
.answer-display {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
  margin-bottom: 20rpx;
  padding: 0 20rpx;
}
.answer-label {
  font-size: 24rpx;
  color: var(--text-sub);
}
.answer-value {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--success-light);
}

.ai-analysis-brief {
  font-size: 26rpx;
  margin-bottom: 30rpx;
  line-height: 1.5;
}
.ai-analysis-brief .label {
  font-weight: bold;
  margin-right: 10rpx;
}

.footer-placeholder {
  height: 300rpx;
  /* 适配 iPhone 底部安全区域 */
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ==================== 新增样式：收藏按钮 ==================== */
.q-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.q-actions {
  display: flex;
  align-items: center;
  @include em-flex-gap(16rpx, row);
}

.favorite-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
}

.favorite-btn:active {
  transform: scale(0.9);
}

.favorite-btn.is-favorited {
  background: linear-gradient(135deg, #ffd700, #ffa500);
}

.favorite-btn.is-favorited .favorite-icon {
  color: #fff;
}

.favorite-icon {
  font-size: 32rpx;
  color: var(--text-sub);
  transition: all 0.3s ease;
}

/* ==================== 新增样式：连击特效 ==================== */
.combo-effect {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 500;
  pointer-events: none;
  animation: comboPopIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.combo-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.3);
}

.combo-count {
  font-size: 120rpx;
  font-weight: 900;
  line-height: 1;
}

.combo-label {
  font-size: 36rpx;
  font-weight: bold;
  margin-top: -10rpx;
}

.combo-message {
  font-size: 28rpx;
  font-weight: 600;
  margin-top: 10rpx;
  padding: 8rpx 24rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
}

/* ==================== [体感革命] 屏幕微震 ==================== */
.screen-shake {
  animation: screenShake 0.4s ease-out;
}

@keyframes screenShake {
  0%,
  100% {
    transform: translateX(0);
  }
  10% {
    transform: translateX(-6px) rotate(-0.5deg);
  }
  20% {
    transform: translateX(6px) rotate(0.5deg);
  }
  30% {
    transform: translateX(-5px);
  }
  40% {
    transform: translateX(5px);
  }
  50% {
    transform: translateX(-3px);
  }
  60% {
    transform: translateX(3px);
  }
  70% {
    transform: translateX(-1px);
  }
}

/* ==================== [体感革命] XP飞入动画 ==================== */
.xp-flyout {
  position: fixed;
  top: 35%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 600;
  pointer-events: none;
  animation: xpFlyUp 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.xp-flyout-text {
  font-size: 52rpx;
  font-weight: 800;
  color: #ffd700;
  text-shadow:
    0 2px 8px rgba(255, 215, 0, 0.5),
    0 0 20px rgba(255, 215, 0, 0.3);
  font-variant-numeric: tabular-nums;
}

@keyframes xpFlyUp {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(20px) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1.2);
  }
  40% {
    transform: translateX(-50%) translateY(-10px) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-80px) scale(0.8);
  }
}

/* ==================== [上瘾引擎] XP Boost指示器 ==================== */
.xp-boost-indicator {
  position: fixed;
  top: 120px;
  right: 16px;
  z-index: 550;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 16rpx;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 107, 53, 0.15));
  border: 1rpx solid rgba(255, 215, 0, 0.4);
  border-radius: 16rpx;
  animation: boostPulse 1.5s ease-in-out infinite;
}

.xp-boost-text {
  font-size: 24rpx;
  font-weight: 800;
  color: #ffd700;
  text-shadow: 0 1px 4px rgba(255, 215, 0, 0.4);
}

.xp-boost-remaining {
  font-size: 18rpx;
  color: rgba(255, 215, 0, 0.7);
  margin-top: 2rpx;
}

@keyframes boostPulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.2);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 12px 4px rgba(255, 215, 0, 0.15);
  }
}

/* ==================== 新增样式：答题动画 ==================== */
@keyframes correctPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  30% {
    transform: scale(1.05);
  }
  60% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes wrongShake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-8rpx);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(8rpx);
  }
}

@keyframes comboPopIn {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.3) rotate(10deg);
  }
  70% {
    transform: translate(-50%, -50%) scale(0.9) rotate(-5deg);
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.quiz-correct-animation {
  animation: correctPulse 0.6s ease-out;
}

.quiz-wrong-animation {
  animation: wrongShake 0.5s ease-out;
}

/* ==================== 新增样式：滑动提示 ==================== */
.swipe-hint {
  position: absolute;
  bottom: 200rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24rpx;
  color: var(--text-sub);
  opacity: 0.6;
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
}

.swipe-hint-icon {
  font-size: 28rpx;
}

/* ==================== 新增样式：笔记按钮 ==================== */
.note-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  position: relative;
}

.note-btn:active {
  transform: scale(0.9);
}

.note-btn.has-notes {
  background: linear-gradient(135deg, #2196f3, #03a9f4);
}

.note-btn.has-notes .note-icon {
  filter: brightness(1.2);
}

.note-icon {
  font-size: 28rpx;
}

.note-count {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 28rpx;
  height: 28rpx;
  background: var(--danger);
  color: #fff;
  font-size: 20rpx;
  font-weight: bold;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

/* ==================== 新增样式：笔记弹窗 ==================== */
.note-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.note-modal {
  width: 100%;
  max-width: 600rpx;
  background: var(--bg-card);
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: var(--shadow-xl);
}

.note-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30rpx;
}

.note-modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary);
}

.note-modal-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--text-sub);
}

.note-textarea {
  width: 100%;
  height: 200rpx;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  box-sizing: border-box;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  @include em-flex-gap(16rpx, row);
  margin-bottom: 30rpx;
}

.note-tag {
  padding: 10rpx 20rpx;
  border: 2rpx solid var(--border);
  border-radius: 20rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.note-tag.selected {
  background: var(--primary);
  color: var(--text-primary-foreground);
  border-color: var(--primary);
}

.note-modal-footer {
  display: flex;
  @include em-flex-gap(20rpx, row);
}

.note-cancel-btn {
  flex: 1;
  height: 80rpx;
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: 28rpx;
  border-radius: 16rpx;
  border: none;
}

.note-save-btn {
  flex: 1;
  height: 80rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 28rpx;
  font-weight: bold;
  border-radius: 16rpx;
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* hover-class 反馈 */
.item-hover {
  opacity: 0.7;
}

.option-hover {
  opacity: 0.85;
  transform: scale(0.98);
}

/* ✅ P0-2: 粒子特效 */
.particle-container {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 200;
  pointer-events: none;
}
.particle {
  position: absolute;
  width: var(--size);
  height: var(--size);
  background: var(--color);
  animation: particleBurst var(--duration) ease-out var(--delay) forwards;
  opacity: 0;
}
.particle.circle {
  border-radius: 50%;
}
.particle.star {
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}
@keyframes particleBurst {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(cos(var(--angle)) * var(--distance)), calc(sin(var(--angle)) * var(--distance))) scale(0);
    opacity: 0;
  }
}
</style>
