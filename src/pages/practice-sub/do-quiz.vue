<template>
  <view class="container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark, 'screen-shake': screenShake }">
    <view class="aurora-bg" />

    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
        <view class="back-area" hover-class="item-hover" @tap="handleExit">
          <BaseIcon name="arrow-left" :size="36" />
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

    <!-- 学习节奏管理：连续学习休息提醒 -->
    <view v-if="showBreakReminder" class="break-reminder-bar">
      <text class="break-reminder-text">你已连续学习 {{ Math.floor(seconds / 60) }} 分钟，适当休息效率更高</text>
      <view class="break-reminder-actions">
        <text class="break-dismiss" @tap="showBreakReminder = false">继续</text>
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
        <view
          v-if="currentQuestion"
          :class="[
            'glass-card',
            'question-card',
            {
              'card-answered': showResult,
              'card-correct': showResult && resultStatus === 'correct',
              'card-wrong': showResult && resultStatus === 'wrong'
            }
          ]"
        >
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
          <!-- combo ≥5 火焰特效：题目右上角缩放+淡出 -->
          <image
            v-if="showComboEffect && comboDisplay && comboDisplay.count >= 5"
            class="combo-fire-badge"
            src="./static/effects/combo-fire.png"
            :mode="'aspectFit'"
            alt=""
          />
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

      <!-- 结果弹窗背景遮罩 -->
      <view v-if="showResult" class="result-backdrop" @tap.stop="closeResult" />

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
            {{ resultStatus === 'correct' ? '回答正确' : '再想想' }}
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
          <!-- AI 个人历史微反馈 — 基于错题历史的一句话上下文提醒 -->
          <view v-if="personalHint" class="personal-hint-bar">
            <text class="personal-hint-text">{{ personalHint }}</text>
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

        <!-- 答错时：一键问AI — 跳转上下文感知对话 -->
        <view v-if="resultStatus === 'wrong'" class="ask-ai-btn" @tap="askAIAboutThis">
          <text class="ask-ai-text">还是不懂？问 AI 导师</text>
          <BaseIcon name="chevron-right" :size="20" class="a<REDACTED_SECRET>" />
        </view>

        <!-- FSRS 智能评分 -->
        <view v-if="fsrsPreview" class="fsrs-rating-row">
          <template v-if="resultStatus === 'correct'">
            <view class="fsrs-rating-btn fsrs-good" @tap="rateAndNext(3)">
              <text class="fsrs-rating-label">还行</text>
              <text class="fsrs-rating-interval">{{ formatFsrsInterval(fsrsPreview.good.intervalDays) }}</text>
            </view>
            <view class="fsrs-rating-btn fsrs-easy" @tap="rateAndNext(4)">
              <text class="fsrs-rating-label">简单</text>
              <text class="fsrs-rating-interval">{{ formatFsrsInterval(fsrsPreview.easy.intervalDays) }}</text>
            </view>
          </template>
          <template v-else>
            <view class="fsrs-rating-btn fsrs-again" @tap="rateAndNext(1)">
              <text class="fsrs-rating-label">没印象</text>
              <text class="fsrs-rating-interval">{{ formatFsrsInterval(fsrsPreview.again.intervalDays) }}</text>
            </view>
            <view class="fsrs-rating-btn fsrs-hard" @tap="rateAndNext(2)">
              <text class="fsrs-rating-label">有点印象</text>
              <text class="fsrs-rating-interval">{{ formatFsrsInterval(fsrsPreview.hard.intervalDays) }}</text>
            </view>
          </template>
        </view>
        <!-- 无 FSRS 数据时的降级按钮 -->
        <wd-button
          v-else
          id="e2e-quiz-next-btn"
          block
          size="large"
          :disabled="isNavigating"
          :loading="isNavigating"
          @click="rateAndNext(3)"
        >
          {{ isNavigating ? '加载中...' : resultStatus === 'correct' ? '进入下一题' : '继续挑战' }}
        </wd-button>
      </view>

      <view class="footer-placeholder" />

      <!-- ✅ 连击特效显示 -->
      <view v-if="showComboEffect && comboDisplay" class="combo-effect" @animationend="showComboEffect = false">
        <view class="combo-content" :style="{ color: comboDisplay.color }">
          <!-- 连击火焰特效 -->
          <image
            v-if="comboDisplay.count >= 5"
            class="combo-fire-icon"
            src="./static/effects/combo-fire.png"
            :mode="'aspectFit'"
            alt=""
          />
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
      <view v-if="showXpToast" class="xp-flyout" @animationend="showXpToast = false">
        <!-- XP金币特效 -->
        <image class="xp-coins-icon" src="./static/effects/xp-coins.png" mode="aspectFit" alt="" />
        <text class="xp-flyout-text">+{{ xpEarned }} XP{{ xpBoostActive ? ' 2x加速' : '' }}</text>
      </view>

      <!-- ✅ [上瘾引擎] XP Boost激活指示器 -->
      <view v-if="xpBoostActive" class="xp-boost-indicator">
        <text class="xp-boost-text">2x XP</text>
        <text class="xp-boost-remaining">剩余 {{ xpBoostRemaining }} 题</text>
      </view>

      <!-- ✅ 升级箭头特效 -->
      <view v-if="showLevelUp" class="level-up-overlay" @animationend="showLevelUp = false">
        <image class="level-up-icon" src="./static/effects/level-up-arrow.png" mode="aspectFit" alt="" />
        <text class="level-up-text">LEVEL UP!</text>
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

    <!-- ✅ [P1重构] 练习完成 — 全屏结果页（含AI诊断+推荐下一步） -->
    <QuizResult
      :visible="showCompleteModal"
      :questions="questions"
      :answered-questions="answeredQuestions"
      :total-time="seconds * 1000"
      :is-dark="isDark"
      :diagnosis-summary="diagnosisSummary"
      :has-next-recommendation="hasNextRecommendation"
      @view-report="viewDiagnosisReport"
      @close="handleCompleteConfirm"
      @continue-next="handleCompleteAction"
      @go-mistakes="navigateFromResult('/pages/mistake/index')"
      @go-weak-training="navigateFromResult('/pages/practice-sub/smart-review')"
      @go-new-practice="handleCompleteConfirm"
      @go-a-i-plan="navigateFromResult('/pages/practice-sub/smart-review')"
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

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="0" />
  </view>
</template>

<script>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import { safeImport } from '@/utils/helpers/safe-import.js';
import CustomModal from '@/components/common/CustomModal.vue';

// ✅ P0-3: 导入自动保存功能
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary
} from '@/composables/useQuizAutoSave.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { getStatusBarHeight, getWindowInfo } from '@/utils/core/system.js';
// ✅ 检查点 5.3: 自适应学习引擎（懒加载：仅在 isAdaptiveMode 时动态导入）
// ✅ 导入题目收藏模块（通过 Store，自动走后端或本地）
import { useFavoriteStore } from '@/stores/modules/favorite.js';
// ✅ [P3] FSRS复习日程预览
import { scheduleMistakeReview } from './utils/mistake-fsrs-scheduler.js';
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
import { playCompleteFanfare } from './utils/quiz-sound.js';
// ✅ [上瘾引擎] XP/等级系统
import { useXPSystem } from './composables/useXPSystem.js';
// ✅ Phase 3-4: 卡片堆叠切换
import { useCardStack } from './composables/useCardStack.js';
// ✅ 导入单题计时器模块
import { startTimer as startQuestionTimer, stopTimer as stopQuestionTimer } from './question-timer.js';
// ✅ 智能组题与自适应学习模块
import { pickQuestions } from './utils/smart-question-picker.js';
import { generateAdaptiveSequence, getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
// 离线缓存：使用统一的离线缓存服务
import { checkOfflineAvailability } from './services/offline-cache-service.js';
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
import { useTypewriter } from './composables/useTypewriter.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

import { useReviewStore } from '@/stores/modules/review.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
// 静态资源 CDN 映射（大图已迁出主包）
import { ASSETS } from '@/config/static-assets.js';
import MemoryStatsRow from './components/quiz-result/MemoryStatsRow.vue';
import TutorFeedbackCard from './components/quiz-result/TutorFeedbackCard.vue';
import QuizResult from './components/quiz-result/quiz-result.vue';
import XpToast from './components/xp-toast/xp-toast.vue';
import RichText from './components/RichText.vue';
import AnswerSheet from './components/answer-sheet/answer-sheet.vue';
import QuizProgress from './components/quiz-progress/quiz-progress.vue';
// ✅ [P0重构] 核心引擎 composable
import { useQuizEngine } from './composables/useQuizEngine.js';
import {
  scheduleAndSave,
  previewSchedule,
  formatInterval,
  loadCardState,
  createNewCard
} from '@/services/fsrs-service.js';
import { triggerOptimization } from './services/fsrs-optimizer-client.js';

export default {
  components: {
    CustomModal,
    BaseIcon,
    MemoryStatsRow,
    TutorFeedbackCard,
    QuizResult,
    XpToast,
    RichText,
    AnswerSheet,
    QuizProgress
  },

  // ✅ [P0重构] 桥接 useQuizEngine — 核心状态和纯逻辑由 composable 管理
  setup() {
    const engine = useQuizEngine({ smartPicker: true, adaptiveMode: true });
    const xpSystem = useXPSystem();
    const reviewStore = useReviewStore();
    return {
      _engine: engine,
      engineGetOptionLabel: engine.getOptionLabel,
      engineIsCorrectOption: engine.isCorrectOption,
      // ✅ [上瘾引擎] XP系统
      xpSystem,
      xpCurrentLevel: xpSystem.currentLevel,
      xpLevelProgress: xpSystem.levelProgress,
      // ✅ reviewStore — 替代页面直接调用 lafService
      reviewStore
    };
  },
  data() {
    return {
      memoryState: null,
      fsrsPreview: null, // { again: {intervalDays}, hard: {intervalDays}, good: {intervalDays}, easy: {intervalDays} }
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
      personalHint: '', // 基于个人历史的AI微反馈
      showBreakReminder: false, // 休息提醒显示状态
      breakReminderShown: false, // 是否已提醒过（每次练习只提醒一次）
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
      showXpToast: false, // ✅ [体感革命] 是否显示XP飞入动画
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
      showAnswerSheet: false, // 答题卡显示状态
      showLevelUp: false, // 升级特效显示状态
      pendingTimers: [] // [AUDIT FIX R264] setTimeout 追踪，防止内存泄漏
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
          // 模拟一次 \"Again\" 评分，预测下次复习时间
          const previewMistake = { fsrs_due: Date.now() };
          const result = scheduleMistakeReview(previewMistake, 'again');
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
    // ✅ 完美全对检测（用于庆祝动画）
    isPerfectScore() {
      return (
        this.showCompleteModal && this.answeredQuestions.length > 0 && this.answeredQuestions.every((a) => a.isCorrect)
      );
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
      path: '/pages/practice/index',
      imageUrl: ASSETS.appShareCover
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
    this._safeTimeout(() => {
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

    // [AUDIT FIX R264] 清理所有未完成的 setTimeout，防止内存泄漏
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];

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
    // [AUDIT FIX R264] 安全的 setTimeout 包装，组件卸载时自动清理
    _safeTimeout(fn, delay) {
      const id = setTimeout(() => {
        this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
        fn();
      }, delay);
      this.pendingTimers.push(id);
      return id;
    },
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

        toast.success('进度已恢复');
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
        toast.info('复习题目加载失败，已切换普通模式');
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
        // 学习节奏管理：连续45分钟提醒休息（仅提醒一次）
        if (this.seconds === 2700 && !this.breakReminderShown) {
          this.breakReminderShown = true;
          this.showBreakReminder = true;
        }
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

      // FSRS 预览：计算 4 种评分的下次复习时间，显示在评分按钮上
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        try {
          const card = loadCardState(questionId) || createNewCard();
          this.fsrsPreview = previewSchedule(card);
        } catch (err) {
          logger.warn('[DoQuiz] FSRS preview failed:', err);
          this.fsrsPreview = null;
        }
      }

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
        this._safeTimeout(() => {
          this.isNavigating = false;
        }, 300);

        this.resultStatus = 'correct';
        this.personalHint = '';
        this.updateStudyStats();
        this.showResult = true;
      } else {
        // ✅ 播放错误答案动画
        this.playWrongEffect();

        this.resultStatus = 'wrong';
        // ✅ [P0重构] 非阻塞AI分析：先立即显示结果（题目自带解析），AI异步增强
        this.aiComment = ''; // 清空，让模板先显示 currentQuestion.desc
        this.personalHint = this._buildPersonalHint(); // 生成个人历史微反馈
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
    async updateStudyStats() {
      // 更新学习热力图数据
      const today = new Date().toISOString().split('T')[0];
      const stats = storageService.get('study_stats', {});
      stats[today] = (stats[today] || 0) + 1;
      storageService.save('study_stats', stats);
      // 更新今日答题计数（驱动首页每日目标环）
      const todayCount = parseInt(uni.getStorageSync('today_answer_count') || '0');
      const todayDate = uni.getStorageSync('today_answer_date') || '';
      if (todayDate !== today) {
        // 日期变更，重置计数
        uni.setStorageSync('today_answer_count', '1');
        uni.setStorageSync('today_answer_date', today);
      } else {
        uni.setStorageSync('today_answer_count', String(todayCount + 1));
      }
      // 上报后端统计（异步，不阻塞本地保存）
      try {
        const { useStatsStore } = await import('@/stores/modules/stats.js');
        const statsStore = useStatsStore();
        // 每次答题算1分钟学习时长（近似）
        statsStore.reportStudyTime(1);
        // 每日首次答题时更新连续学习天数
        statsStore.reportStreak();
      } catch (_e) {
        // 上报失败不影响答题流程
      }
    },
    formatFsrsInterval(days) {
      return formatInterval(days);
    },
    rateAndNext(rating) {
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        scheduleAndSave(questionId, rating).catch((err) => {
          logger.warn('[DoQuiz] FSRS schedule failed:', err);
        });
      }
      // 每 50 次答题触发一次 FSRS 参数优化（非阻塞）
      const reviewCount = parseInt(uni.getStorageSync('fsrs_review_count') || '0') + 1;
      uni.setStorageSync('fsrs_review_count', String(reviewCount));
      if (reviewCount % 50 === 0) {
        triggerOptimization().catch(() => {
          /* no-op */
        });
      }
      this.fsrsPreview = null;
      this.toNext();
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
            toast.info('复习时间到！', 1500);
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
        this._safeTimeout(() => {
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
          this._safeTimeout(() => {
            this.showXpToast = false;
          }, 2000);
        }
        // ✅ [体感革命] 完成fanfare + confetti
        playCompleteFanfare();
        safeImport(import('canvas-confetti'))
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
          .catch((error) => {
            logger.warn('[do-quiz] save mistake summary failed:', error);
          });
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
      safeNavigateBack();
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
          this.reviewStore.generateDiagnosis({ sessionId: this.sessionId }),
          this.reviewStore.fetchSmartRecommendations({ count: 10 })
        ]);

        // 处理诊断结果
        if (diagRes.status === 'fulfilled' && diagRes.value.success && diagRes.value.data) {
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
        if (recRes.status === 'fulfilled' && recRes.value.success && recRes.value.data) {
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
        toast.info('AI 正在分析中，请稍候...');
        this.showCompleteModal = true;
      } else {
        // 诊断失败，直接返回
        safeNavigateBack();
      }
    },

    // ✅ 处理练习完成确认
    handleCompleteConfirm() {
      this.showCompleteModal = false;
      this.isNavigating = false;
      safeNavigateBack();
    },

    // ✅ AI推荐下一步 → 跳转到指定页面
    navigateFromResult(url) {
      this.showCompleteModal = false;
      safeNavigateTo(url);
    },

    /**
     * 答错后"问AI导师" — 保存题目上下文，跳转到AI聊天页
     * 聊天页会自动读取上下文并发送第一条消息
     */
    askAIAboutThis() {
      if (!this.currentQuestion) return;
      const q = this.currentQuestion;
      // 构建上下文消息
      const contextMsg = `我刚刚做错了一道${q.category || ''}的题目，帮我解释一下：\n\n题目：${(q.question || '').substring(0, 300)}\n\n我选了错误答案，正确答案是${q.answer}。\n\n请用简单易懂的方式帮我理解为什么正确答案是${q.answer}，以及这道题考查的核心知识点。`;

      storageService.save('chat_context_question', contextMsg);
      safeNavigateTo('/pages/chat/chat?context=question');
    },

    /**
     * 基于个人历史生成一句话AI微反馈（纯本地，零延迟）
     * 在用户答错时调用，根据该知识点的历史错误次数给出上下文提醒
     */
    _buildPersonalHint() {
      if (!this.currentQuestion) return '';
      const cat = this.currentQuestion.category || '';
      if (!cat) return '';

      // 统计本次练习中该知识点的错误次数
      const catWrongCount = this.answeredQuestions.filter(
        (a) => !a.isCorrect && this.questions[a.index]?.category === cat
      ).length;

      // 统计总体该知识点的历史错误
      const mistakes = storageService.get('mistake_book', []);
      const catMistakes = mistakes.filter((m) => (m.category || m.knowledge_point || '') === cat);
      const totalWrong = catMistakes.length;

      if (totalWrong >= 5) {
        return `你在「${cat}」上已累计错${totalWrong}题，建议做完后去错题本集中突破这个知识点。`;
      }
      if (catWrongCount >= 2) {
        return `本次在「${cat}」已错${catWrongCount}题，这可能是你的薄弱点。`;
      }
      if (totalWrong >= 2) {
        return `「${cat}」是你的高频易错知识点（累计${totalWrong}次），注意审题。`;
      }
      return `记住这道题的考点：「${cat}」`;
    },

    // ✅ [闭环核心] AI智能诊断 — 刷题结束后触发
    async handleDiagnosis() {
      if (this.diagnosisLoading) return;
      if (!this.sessionId) {
        toast.info('会话数据不足，无法诊断');
        this.handleCompleteConfirm();
        return;
      }

      this.diagnosisLoading = true;
      try {
        const res = await this.reviewStore.generateDiagnosis({ sessionId: this.sessionId });
        if (res.success && res.data) {
          this.showCompleteModal = false;
          const diagnosisId = res.data._id;
          uni.navigateTo({
            url: `/pages/practice-sub/diagnosis-report?diagnosisId=${diagnosisId}&sessionId=${this.sessionId}`,
            fail: () => {
              const d = res.data.diagnosis || {};
              modal.show({
                title: `诊断结果：${d.overallLevel || '完成'}`,
                content: `正确率 ${d.accuracy || 0}%\n${d.encouragement || '继续加油！'}\n\n薄弱点：${(d.weakPoints || []).map((w) => w.knowledgePoint).join('、') || '无'}\n\n建议：${d.studyPlan?.immediate || '复习错题'}`,
                confirmText: '开始复习',
                cancelText: '返回',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    uni.navigateTo({ url: '/pages/mistake/index' });
                  } else {
                    safeNavigateBack();
                  }
                }
              });
            }
          });
        } else {
          toast.info(res.message || '诊断失败');
        }
      } catch (e) {
        logger.warn('[do-quiz] AI诊断失败:', e);
        toast.info('诊断失败，请稍后重试');
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

    // ✅ 切换收藏状态（通过 Store，登录时走后端）
    async handleToggleFavorite() {
      if (!this.currentQuestion) return;

      const favoriteStore = useFavoriteStore();
      const result = await favoriteStore.toggleFavorite(this.currentQuestion);
      this.isCurrentFavorited = result.isFavorited;

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
    async updateFavoriteStatus() {
      if (this.currentQuestion) {
        const favoriteStore = useFavoriteStore();
        this.isCurrentFavorited = await favoriteStore.checkIsFavorited(
          this.currentQuestion.id || this.currentQuestion.question
        );
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
        this._safeTimeout(() => {
          this.showXpToast = false;
        }, 1800);

        // ✅ [上瘾引擎] 5连击触发2x XP boost（3题有效）
        if ((animData.combo || 0) === 5 && !this.xpBoostActive) {
          this.xpBoostActive = true;
          this.xpBoostRemaining = 3;
          this._safeTimeout(() => {
            toast.info('2x XP Boost! 接下来3题双倍经验');
          }, 500);
        }

        // ✅ [上瘾引擎] 升级提示
        if (xpResult.levelUp && xpResult.newLevel) {
          this._safeTimeout(() => {
            toast.info(`升级！${xpResult.newLevel.title}`, 2500);
            this.showLevelUp = true;
            this._safeTimeout(() => {
              this.showLevelUp = false;
            }, 2000);
          }, 800);
        }

        // ✅ P0-2: 激活粒子特效（canvas-confetti已在quiz-animation.js中触发）
        if (animData.particles && animData.particles.length > 0) {
          this.particles = animData.particles;
          this.showParticles = true;
          this._safeTimeout(() => {
            this.showParticles = false;
            this.particles = [];
          }, 1000);
        }

        // 更新连击显示
        this.comboDisplay = getComboDisplay();
        if (this.comboDisplay && this.comboDisplay.count >= 3) {
          this.showComboEffect = true;
          this._safeTimeout(() => {
            this.showComboEffect = false;
          }, 2000);
        }

        // 动画结束后清除类名
        this._safeTimeout(() => {
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
        this._safeTimeout(() => {
          this.screenShake = false;
        }, 500);

        // 重置连击显示
        this.comboDisplay = null;
        this.showComboEffect = false;

        // 动画结束后清除类名
        this._safeTimeout(() => {
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
            toast.info(data.message);
          }
        },
        onTimeout: (_data) => {
          // 超时处理
          if (!this.hasAnswered) {
            toast.info('时间到！');
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
        toast.info('已切换到离线模式');
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
        toast.info('请输入笔记内容');
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
        toast.success('笔记已保存');

        // 更新当前题目的笔记列表
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

        this.showNoteModal = false;
        this.noteContent = '';
        this.selectedNoteTags = [];
      } else {
        toast.info('保存失败');
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
/* [AUDIT FIX R135] */
/* 容器样式 */
.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
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
  background: var(--bg-card);
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
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
  font-weight: 700;
  color: var(--text-primary);
}
.timer-box {
  font-size: 24rpx;
  color: var(--info);
  background: rgba(28, 176, 246, 0.12);
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
  font-size: 24rpx;
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
  background: linear-gradient(135deg, var(--ds-color-warning, #ff9800), var(--warning));
  animation: timerPulse 1s ease-in-out infinite;
}

/* 时间危险状态 */
.question-timer-box.danger {
  background: linear-gradient(135deg, var(--ds-color-error, #f44336), var(--danger));
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
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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

/* 3D 卡片翻转效果 */
.question-container {
  perspective: 1200rpx;
}

.question-card {
  position: relative;
  overflow: visible;
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.question-card.card-answered {
  animation: cardFlipPulse 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.question-card.card-correct {
  animation:
    cardFlipPulse 0.5s cubic-bezier(0.32, 0.72, 0, 1),
    correctGlow 0.6s ease-out;
}

.question-card.card-wrong {
  animation:
    cardFlipPulse 0.5s cubic-bezier(0.32, 0.72, 0, 1),
    wrongGlow 0.6s ease-out;
}

@keyframes cardFlipPulse {
  0% {
    transform: rotateY(0deg) scale(1);
  }
  30% {
    transform: rotateY(12deg) scale(0.97);
  }
  60% {
    transform: rotateY(-6deg) scale(1.01);
  }
  100% {
    transform: rotateY(0deg) scale(1);
  }
}

@keyframes correctGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.5);
  }
  50% {
    box-shadow: 0 0 40rpx 10rpx rgba(52, 199, 89, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
  }
}

@keyframes wrongGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.5);
  }
  50% {
    box-shadow: 0 0 40rpx 10rpx rgba(255, 59, 48, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
  }
}

/* 题目卡片 */
.question-card .q-tag {
  display: inline-block;
  background: rgba(28, 176, 246, 0.12);
  color: var(--info);
  font-size: 24rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}
.question-card .q-content {
  font-size: 34rpx;
  font-weight: 700;
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
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  border-radius: 20rpx;
  transition: all 0.2s;
  position: relative;
}
.option-item:active {
  transform: scale(0.98);
}
.option-item.selected {
  border-color: var(--info);
  background: rgba(28, 176, 246, 0.08);
}
.option-item.correct {
  border-color: #58cc02;
  background: rgba(88, 204, 2, 0.08);
}
.option-item.wrong {
  border-color: var(--danger);
  background: rgba(255, 75, 75, 0.08);
}
.option-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.opt-index {
  font-weight: 800;
  color: var(--text-primary);
  background: var(--bg-secondary);
  font-size: 32rpx;
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-right: 20rpx;
}
.opt-text {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-primary);
  font-weight: 600;
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
  background: var(--bg-card);
  border-radius: 28rpx;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.1);
  animation: slideUpResult 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;

  /* FSRS 按钮色彩变量 — 基于全局语义色的半透明变体 */
  --fsrs-again-bg: color-mix(in srgb, var(--danger) 30%, transparent);
  --fsrs-again-border: color-mix(in srgb, var(--danger) 50%, transparent);
  --fsrs-hard-bg: color-mix(in srgb, var(--warning) 30%, transparent);
  --fsrs-hard-border: color-mix(in srgb, var(--warning) 50%, transparent);
  --fsrs-good-bg: color-mix(in srgb, var(--success) 25%, transparent);
  --fsrs-good-border: color-mix(in srgb, var(--success) 40%, transparent);
  --fsrs-easy-bg: color-mix(in srgb, var(--info) 25%, transparent);
  --fsrs-easy-border: color-mix(in srgb, var(--info) 40%, transparent);
}
@keyframes slideUpResult {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 结果弹窗背景遮罩 */
.result-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay, rgba(0, 0, 0, 0.3));
  z-index: 299;
  animation: fadeInBackdrop 0.2s ease forwards;
}
@keyframes fadeInBackdrop {
  from {
    opacity: 0;
  }
  to {
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
/* AI个人历史微反馈 */
.personal-hint-bar {
  margin: 8rpx 20rpx 16rpx;
  padding: 12rpx 16rpx;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border-radius: 12rpx;
  border-left: 4rpx solid var(--warning, #f59e0b);
}
.personal-hint-text {
  font-size: 24rpx;
  color: var(--warning, #b45309);
  line-height: 1.5;
}
.dark-mode .personal-hint-bar {
  background: rgba(245, 158, 11, 0.15);
}
.dark-mode .personal-hint-text {
  color: var(--warning, #fbbf24);
}
/* 学习节奏：休息提醒条 */
.break-reminder-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12));
  border-bottom: 1rpx solid rgba(99, 102, 241, 0.2);
}
.break-reminder-text {
  font-size: 24rpx;
  color: var(--text-accent, #6366f1);
  flex: 1;
}
.break-dismiss {
  font-size: 24rpx;
  color: var(--text-accent, #6366f1);
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: 12rpx;
  background: rgba(99, 102, 241, 0.15);
}
.dark-mode .break-reminder-text {
  color: var(--text-accent, #a78bfa);
}
.dark-mode .break-dismiss {
  color: var(--text-accent, #a78bfa);
  background: rgba(99, 102, 241, 0.2);
}
/* 答错时问AI导师按钮 */
.ask-ai-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12rpx 20rpx 0;
  padding: 18rpx 24rpx;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(6, 182, 212, 0.1));
  border: 1rpx solid rgba(52, 211, 153, 0.25);
  border-radius: 16rpx;
}
.ask-ai-btn:active {
  opacity: 0.8;
  transform: scale(0.98);
}
.ask-ai-text {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--success, #059669);
}
.a<REDACTED_SECRET> {
  font-size: 32rpx;
  color: var(--success, #059669);
}
.dark-mode .ask-ai-text {
  color: var(--success, #34d399);
}
.dark-mode .a<REDACTED_SECRET> {
  color: var(--success, #34d399);
}
.dark-mode .ask-ai-btn {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(6, 182, 212, 0.12));
  border-color: rgba(52, 211, 153, 0.3);
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
  background: rgba(255, 150, 0, 0.12);
  transition: all 0.3s ease;
}

.favorite-btn:active {
  transform: scale(0.9);
}

.favorite-btn.is-favorited {
  background: rgba(255, 150, 0, 0.2);
}

.favorite-btn.is-favorited .favorite-icon {
  color: var(--warning);
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
  color: var(--warning);
  text-shadow: 0 4rpx 20rpx rgba(255, 150, 0, 0.3);
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
  display: flex;
  align-items: center;
}

.xp-flyout-text {
  font-size: 52rpx;
  font-weight: 800;
  color: var(--warning);
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
  color: var(--warning);
  text-shadow: 0 1px 4px rgba(255, 215, 0, 0.4);
}

.xp-boost-remaining {
  font-size: 22rpx;
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
  background: linear-gradient(135deg, var(--primary), var(--primary));
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
  color: var(--text-inverse, #fff);
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
  background: var(--overlay, rgba(0, 0, 0, 0.5));
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
/* FSRS 智能评分按钮（答对/答错各显示2个） */
.fsrs-rating-row {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 20rpx;
}
.fsrs-rating-btn + .fsrs-rating-btn {
  margin-left: 16rpx;
}

.fsrs-rating-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx 8rpx;
  border-radius: 20rpx;
  min-height: 100rpx;
  transition:
    transform 0.15s,
    opacity 0.15s;
}

.fsrs-rating-btn:active {
  transform: scale(0.95);
  opacity: 0.85;
}

.fsrs-again {
  background: rgba(255, 75, 75, 0.12);
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 0 #e04343;
}

.fsrs-hard {
  background: rgba(255, 150, 0, 0.12);
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 0 #d98000;
}

.fsrs-good {
  background: rgba(88, 204, 2, 0.12);
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 0 #46a302;
}

.fsrs-easy {
  background: rgba(28, 176, 246, 0.12);
  border: 2rpx solid transparent;
  box-shadow: 0 4rpx 0 var(--info-dark, #1899d6);
}

.fsrs-rating-label {
  font-size: 28rpx;
  font-weight: 700;
}

.fsrs-again .fsrs-rating-label {
  color: var(--danger);
}
.fsrs-hard .fsrs-rating-label {
  color: var(--warning);
}
.fsrs-good .fsrs-rating-label {
  color: #58cc02;
}
.fsrs-easy .fsrs-rating-label {
  color: var(--info);
}

.fsrs-rating-interval {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
}

/* ✅ 完成庆祝动画 */
@keyframes celebrateScale {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes celebrateStars {
  0% {
    transform: rotate(0deg) scale(0);
    opacity: 0;
  }
  50% {
    transform: rotate(180deg) scale(1.2);
    opacity: 1;
  }
  100% {
    transform: rotate(360deg) scale(1);
    opacity: 0.8;
  }
}

.complete-celebrate {
  animation: celebrateScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* 完美全对时的特殊效果 */
.perfect-score-glow {
  position: relative;
}
.perfect-score-glow::after {
  content: '';
  position: absolute;
  inset: -20rpx;
  border-radius: 50rpx;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
  animation: celebrateStars 2s ease-in-out infinite;
  pointer-events: none;
}

/* ==================== 连击火焰特效图标 ==================== */
.combo-fire-icon {
  width: 64rpx;
  height: 64rpx;
  animation: combo-fire-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes combo-fire-pulse {
  from {
    transform: scale(0.9);
  }
  to {
    transform: scale(1.15);
  }
}

/* ==================== combo ≥5 火焰徽章：题目右上角缩放+淡出 ==================== */
.combo-fire-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 80rpx;
  height: 80rpx;
  z-index: 10;
  pointer-events: none;
  animation: combo-fire-burst 1.2s ease-out forwards;
}
@keyframes combo-fire-burst {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(-15deg);
  }
  20% {
    opacity: 1;
    transform: scale(1.5) rotate(8deg);
  }
  40% {
    transform: scale(1.1) rotate(-4deg);
  }
  60% {
    opacity: 1;
    transform: scale(1.25) rotate(2deg);
  }
  80% {
    opacity: 0.7;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.6) translateY(-30rpx);
  }
}

/* ==================== XP金币特效图标 ==================== */
.xp-coins-icon {
  width: 48rpx;
  height: 48rpx;
  margin-right: 8rpx;
}

/* ==================== 升级箭头特效 ==================== */
.level-up-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 999;
  animation: level-up-appear 2s ease-out forwards;
  pointer-events: none;
}
.level-up-icon {
  width: 160rpx;
  height: 160rpx;
}
.level-up-text {
  font-size: 48rpx;
  font-weight: 900;
  color: var(--warning);
  text-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.3);
  margin-top: 16rpx;
}
@keyframes level-up-appear {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
  30% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -70%) scale(0.8);
  }
}

/* ==================== 暗色模式：特效降低亮度 ==================== */
.dark-mode .combo-effect,
.dark-mode .xp-flyout,
.dark-mode .level-up-overlay,
.dark-mode .combo-fire-badge {
  opacity: 0.85;
}
</style>
