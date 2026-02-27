<template>
  <view class="container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
        <view class="back-area" hover-class="item-hover" @tap="handleExit">
          <text class="back-icon">
            ←
          </text>
          <text class="progress-text">
            {{ currentIndex + 1 }} / {{ questions.length }}
          </text>
        </view>
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
            <text class="total-label">
              总
            </text>
            <text>{{ formatTime(seconds) }}</text>
          </view>
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="quiz-scroll"
      :style="{ paddingTop: navBarHeight + 'px' }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <view v-if="currentQuestion" class="question-container" :class="[correctAnimationClass, wrongAnimationClass]">
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
          <text class="q-content">
            {{ currentQuestion.question }}
          </text>
        </view>

        <view v-if="currentQuestion && currentQuestion.options" class="options-list">
          <view
            v-for="(opt, idx) in currentQuestion.options"
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
            <text class="opt-text">
              {{ opt }}
            </text>
            <view v-if="hasAnswered" class="select-indicator">
              <BaseIcon v-if="isCorrectOption(idx)" name="check" :size="28" />
              <BaseIcon v-else-if="userChoice === idx && !isCorrectOption(idx)" name="cross" :size="28" />
              <view v-else-if="userChoice === idx" class="indicator-circle" />
            </view>
          </view>
        </view>
      </view>

      <!-- AI Loading 状态 -->
      <BaseLoading v-if="isAnalyzing" :text="'AI 正在深度解析逻辑...'" />

      <!-- AI 反馈图层动画 -->
      <view v-if="isAnalyzing" class="ai-feedback-layer">
        <view class="scan-line" />
        <view class="thinking-box">
          <view class="pulse-ring" />
          <text class="ai-text">
            AI 正在深度解析逻辑...
          </text>
        </view>
      </view>

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
            <text>AI 深度诊断</text>
          </view>
          <view class="answer-display">
            <text class="answer-label">
              正确答案：
            </text>
            <text class="answer-value">
              {{ currentQuestion ? currentQuestion.answer : 'A' }}
            </text>
          </view>
          <text class="analysis-body">
            {{ aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析') }}
          </text>
        </scroll-view>

        <view v-else class="ai-analysis-brief">
          <text class="label">
            AI 简评：
          </text>
          <text>{{ aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析') }}</text>
        </view>

        <button
          class="next-btn"
          hover-class="ds-hover-btn"
          :disabled="isNavigating"
          :class="{ 'btn-disabled': isNavigating }"
          @tap="toNext"
        >
          {{ isNavigating ? '加载中...' : resultStatus === 'correct' ? '进入下一题' : '继续挑战' }}
        </button>
      </view>

      <view class="footer-placeholder" />

      <!-- ✅ 连击特效显示 -->
      <view v-if="showComboEffect && comboDisplay" class="combo-effect">
        <view class="combo-content" :style="{ color: comboDisplay.color }">
          <text class="combo-count">
            {{ comboDisplay.count }}
          </text>
          <text class="combo-label">
            连击!
          </text>
          <text v-if="comboDisplay.message" class="combo-message">
            {{ comboDisplay.message }}
          </text>
        </view>
      </view>
    </scroll-view>

    <!-- ✅ 自定义弹窗：题库为空 -->
    <CustomModal
      :visible="showEmptyBankModal"
      type="upload"
      title="题库空空如也"
      content="请先去资料库导入学习资料，AI 将为您生成专属题目。"
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

    <!-- ✅ 自定义弹窗：练习完成 -->
    <CustomModal
      :visible="showCompleteModal"
      type="success"
      title="练习完成"
      :content="`本次共完成 ${questions.length} 道题目！`"
      confirm-text="返回"
      :show-cancel="false"
      :is-dark="isDark"
      @confirm="handleCompleteConfirm"
    />

    <!-- ✅ 笔记输入弹窗 -->
    <view v-if="showNoteModal" class="note-modal-overlay" @tap="showNoteModal = false">
      <view class="note-modal" @tap.stop>
        <view class="note-modal-header">
          <text class="note-modal-title">
            添加笔记
          </text>
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
          <button class="note-cancel-btn" hover-class="item-hover" @tap="showNoteModal = false">
            取消
          </button>
          <button class="note-save-btn" hover-class="item-hover" @tap="handleSaveNote">
            保存
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import BaseLoading from './components/base-loading/base-loading.vue';
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
import { toggleFavorite, isFavorited } from './utils/question-favorite.js';
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
// ✅ 导入单题计时器模块
import { startTimer as startQuestionTimer, stopTimer as stopQuestionTimer } from './question-timer.js';
// ✅ 智能组题模块（懒加载：仅在 smartPickerEnabled 时动态导入）
// ✅ 导入离线缓存模块
import { checkOfflineAvailability } from './offline-cache.js';
// ✅ 导入题目笔记模块
import { addQuestionNote, getNotesByQuestion, getNoteTags } from './question-note.js';
// ✅ P1: 提取的模块
import { saveToMistakes as saveMistake, updateMistakeWithAI as updateMistakeAI } from './quiz-mistake-handler.js';
import { fetchAIDeepAnalysis as fetchAIAnalysis } from './quiz-ai-analysis.js';
import { recordAnswerToAnalytics as recordAnalytics } from './quiz-analytics-recorder.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    BaseLoading,
    CustomModal,
    BaseIcon
  },
  data() {
    return {
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
      // ✅ 答题动画状态
      comboDisplay: null, // 连击显示数据
      showComboEffect: false, // 是否显示连击特效
      correctAnimationClass: '', // 正确答案动画类
      wrongAnimationClass: '', // 错误答案动画类
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
      selectedNoteTags: [] // 选中的笔记标签
    };
  },
  computed: {
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

    // ✅ F024: 统一使用 storageService 读取主题
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';

    // E005: 注册主题监听一次（在 onLoad 而非 onShow，避免重复绑定）
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // ✅ 初始化滑动手势
    this.initSwipeGesture();

    // 读取页面参数（uni-app onLoad 接收 query 对象）
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage?.$page?.options || currentPage?.options || {};
    if (query.mode === 'single') {
      this._singleMode = true;
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
    // 移除主题事件监听，避免重复绑定
    uni.$off('themeUpdate', this._themeHandler);

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
        const { pickQuestions } = await import('./utils/smart-question-picker.js');
        questions = pickQuestions(questions, {
          count: Math.min(questions.length, 20),
          mode: 'adaptive',
          includeReview: true,
          reviewRatio: 0.2
        });
        logger.log('[do-quiz] ✅ 智能组题模式已启用');
      } else if (this.isAdaptiveMode && questions.length > 0) {
        // 降级到自适应学习引擎（懒加载）
        const { generateAdaptiveSequence } = await import('./utils/adaptive-learning-engine.js');
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

      // ✅ 记录答题数据到各个分析模块
      this.recordAnswerToAnalytics(isCorrect, timeSpent).catch((_err) => {
        /* silent analytics failure */
      });

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
        // 错误时：先保存到错题本（不含 AI 解析）
        this.saveToMistakes().catch((_err) => {
          /* silent save failure */
        });
        // 然后触发 AI 深度解析（会自动更新错题本中的 AI 解析字段）
        await this.fetchAIDeepAnalysis(this.currentQuestion, this.currentQuestion.options[idx]);
        this.updateStudyStats();
        this.showResult = true;
      }
    },
    // ✅ P1: 委托给 quiz-ai-analysis.js（UI 状态管理保留在组件内）
    async fetchAIDeepAnalysis(question, userChoice) {
      // 开启扫描线动画
      this.isAnalyzing = true;
      this.aiComment = 'AI 导师正在审阅您的逻辑...';

      try {
        const result = await fetchAIAnalysis({ question, userChoice });
        this.aiComment = result.comment;

        if (result.success) {
          // 将 AI 解析同步保存到错题本
          this.updateMistakeWithAI(this.aiComment);
        }
        // AI 失败时不重复调用 saveToMistakes()，错题已在答题时保存
      } finally {
        this.isAnalyzing = false; // 关闭扫描动画

        // 震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed after AI analysis', e);
        }
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

      if (this.currentIndex < this.questions.length - 1) {
        // ✅ 检查点 5.3: 检查是否需要插入复习题
        if (this.isAdaptiveMode) {
          const { getNextRecommendedQuestion } = await import('./utils/adaptive-learning-engine.js');
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

        // ✅ 使用自定义弹窗
        this.showCompleteModal = true;
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

    // ✅ 处理练习完成确认
    handleCompleteConfirm() {
      this.showCompleteModal = false;
      this.isNavigating = false; // 重置防重复点击状态
      uni.navigateBack();
    },

    closeResult() {
      // 关闭结果弹窗，但不进入下一题
      // ⚠️ 不重置 hasAnswered 和 userChoice，防止用户重复作答同一题
      // 重复作答会导致 answeredQuestions 重复记录、analytics 双重计数、错题重复保存
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
    },

    // ✅ 触摸移动
    onTouchMove(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchMove(event, this.getSwipeContext());
    },

    // ✅ 触摸结束
    onTouchEnd(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchEnd(event, this.getSwipeContext());
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

        // 更新连击显示
        this.comboDisplay = getComboDisplay();
        if (this.comboDisplay && this.comboDisplay.count >= 3) {
          this.showComboEffect = true;
          // 2秒后隐藏连击特效
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

    // ✅ 播放错误答案动画
    playWrongEffect() {
      const animData = playWrongAnimation();
      if (animData) {
        this.wrongAnimationClass = 'quiz-wrong-animation';

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
        getOptionLabel: (idx) => this.getOptionLabel(idx)
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
    }
  }
};
</script>

<style lang="scss" scoped>
/* 容器样式 */
.container {
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
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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
  gap: 10rpx;
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
  gap: 8rpx;
}
.timer-icon {
  font-size: 24rpx;
}

/* 计时器组 */
.timer-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
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
  gap: 8rpx;
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
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 玻璃卡片通用样式 */
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 40rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
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

/* AI 反馈图层动画 */
.ai-feedback-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  background: var(--overlay);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
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
  gap: 30rpx;
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
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
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
  gap: 20rpx;
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
  backdrop-filter: blur(10px);
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

/* AI 深度诊断区域 */
.ai-analysis-scroll {
  max-height: 400rpx;
  margin-bottom: 30rpx;
  padding: 20rpx 0;
}
.analysis-tag {
  display: flex;
  align-items: center;
  gap: 10rpx;
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
  gap: 10rpx;
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
.next-btn {
  width: 100%;
  background: var(--bg-glass);
  color: var(--text-primary);
  font-weight: bold;
  border-radius: 20rpx;
  border: none;
  padding: 20rpx 0;
  font-size: 28rpx;
  margin-top: 20rpx;
}

.footer-placeholder {
  height: 300rpx;
  /* 适配 iPhone 底部安全区域 */
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
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
  gap: 16rpx;
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
  gap: 10rpx;
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
  gap: 16rpx;
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
  gap: 20rpx;
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
  background: var(--primary);
  color: var(--text-primary-foreground);
  font-size: 28rpx;
  font-weight: bold;
  border-radius: 16rpx;
  border: none;
}

/* hover-class 反馈 */
.item-hover {
  opacity: 0.7;
}

.option-hover {
  opacity: 0.85;
  transform: scale(0.98);
}
</style>
