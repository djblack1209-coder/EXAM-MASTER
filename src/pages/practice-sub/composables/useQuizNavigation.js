/**
 * 题目切换与手势导航 Mixin
 *
 * 职责：滑动手势、题目前进/后退/跳转、退出处理、答题完成流程
 * 使用方式：在 do-quiz.vue 中通过 mixins: [quizNavigationMixin] 合并
 *
 * @module composables/useQuizNavigation
 */

import {
  initSwipeGesture as initSwipeModule,
  bindSwipeCallbacks,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd
} from '../swipe-gesture.js';
import { clearQuizProgress } from '@/composables/useQuizAutoSave.js';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
import { playCompleteFanfare } from '../utils/quiz-sound.js';
import { celebrateContinuous } from '@/utils/animations/mp-confetti.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { stopTimer as stopQuestionTimer } from '../question-timer.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export const quizNavigationMixin = {
  data() {
    return {
      // 滑动手势状态
      swipeDeltaX: 0, // 滑动偏移量
      isSwipeAnimating: false, // 是否正在滑动动画

      // 防重复点击
      isNavigating: false,

      // 答题卡 & 退出弹窗
      showAnswerSheet: false,
      showExitModal: false,

      // 卡片堆叠切换实例
      cardStack: null
    };
  },

  methods: {
    // ==================== 滑动手势 ====================

    // 初始化滑动手势模块并绑定回调
    initSwipeGesture() {
      initSwipeModule();

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
          // 滑动过程中更新偏移量（用于卡片跟随手指）
          if (!this.hasAnswered) {
            this.swipeDeltaX = data.deltaX;
          }
        },
        onSwipeEnd: (_data) => {
          this.swipeDeltaX = 0;
        },
        onBoundaryReached: (data) => {
          logger.log('[do-quiz] 到达边界:', data.boundary);
        }
      });

      logger.log('[do-quiz] ✅ 滑动手势已初始化');
    },

    // 触摸开始（同时传递给卡片堆叠模块）
    onTouchStart(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchStart(event, this.getSwipeContext());
      if (this.cardStack) this.cardStack.onTouchStart(event);
    },

    // 触摸移动
    onTouchMove(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchMove(event, this.getSwipeContext());
      if (this.cardStack) this.cardStack.onTouchMove(event);
    },

    // 触摸结束
    onTouchEnd(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchEnd(event, this.getSwipeContext());
      if (this.cardStack) this.cardStack.onTouchEnd(event);
    },

    // 获取滑动上下文（告诉手势模块当前状态）
    getSwipeContext() {
      return {
        currentIndex: this.currentIndex,
        totalQuestions: this.questions.length,
        hasAnswered: this.hasAnswered
      };
    },

    // ==================== 题目切换 ====================

    // 跳转到上一题
    goToPrevQuestion() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到上一题:', this.currentIndex);
      }
    },

    // 跳转到下一题
    goToNextQuestion() {
      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到下一题:', this.currentIndex);
      }
    },

    // 重置题目状态（切换题目时调用）
    resetQuestionState() {
      this.hasAnswered = false;
      this.userChoice = null;
      this.showResult = false;
      this.aiComment = '';
      this.answerStartTime = Date.now();
      this.correctAnimationClass = '';
      this.wrongAnimationClass = '';
      this.showTimeWarning = false;

      // 重新启动单题计时器
      this.startQuestionTimer();
      // 更新当前题目的笔记
      this.updateQuestionNotes();
    },

    // 答题卡跳转到指定题目
    handleJumpToQuestion(index) {
      this.showAnswerSheet = false;
      this.currentIndex = index;
      this.resetQuestionState();
      this.updateFavoriteStatus();
      logger.log('[do-quiz] ✅ 跳转到题目:', index);
    },

    // ==================== 下一题 / 完成逻辑 ====================

    // 进入下一题或完成练习
    async toNext() {
      // 防重复点击保护
      if (this.isNavigating) {
        return;
      }
      this.isNavigating = true;

      // 重置状态
      this.showResult = false;
      this.isAnalyzing = false;

      // 停止打字机效果
      if (this._typewriter) {
        this._typewriter.stopTyping();
      }

      if (this.currentIndex < this.questions.length - 1) {
        // 自适应模式：检查是否需要插入复习题
        if (this.isAdaptiveMode) {
          const recommendation = getNextRecommendedQuestion(this.currentIndex, this.questions);
          if (recommendation && recommendation.isReview) {
            this.questions.splice(this.currentIndex + 1, 0, recommendation.question);
            logger.log('[do-quiz] ✅ 插入复习题:', recommendation.reason);
            toast.info('复习时间到！');
          }
        }

        this.currentIndex++;
        this.hasAnswered = false;
        this.userChoice = null;
        this.showResult = false;
        this.aiComment = '';

        // 重置答题开始时间
        this.answerStartTime = Date.now();

        // 进入下一题时保存进度
        this.saveCurrentProgress();

        // 震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed on next question', e);
        }

        // 延迟解锁防重复点击
        setTimeout(() => {
          this.isNavigating = false;
        }, 300);
      } else {
        // 最后一题已答完 → 练习完成流程
        clearQuizProgress();

        // 追踪完成练习事件
        analytics.trackConversion('COMPLETE_SESSION', {
          totalQuestions: this.questions.length,
          correctCount: this.answeredQuestions.filter((a) => a.isCorrect).length,
          totalTime: this.seconds
        });

        // 显示完成弹窗
        this.showCompleteModal = true;

        // 完成session XP奖励
        const isPerfect = this.answeredQuestions.every((a) => a.isCorrect);
        const sessionBonus = this.xpSystem.completeSession(isPerfect);
        if (sessionBonus > 0) {
          this.xpEarned = sessionBonus;
          this.showXpToast = true;
          setTimeout(() => {
            this.showXpToast = false;
          }, 2000);
        }

        // 完成fanfare + confetti 庆祝效果
        playCompleteFanfare();
        celebrateContinuous({
          particleCount: 4,
          spread: 55,
          duration: 2000,
          colors: ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50']
        });

        // 自动触发AI诊断
        this.autoDiagnose();
      }
    },

    // 关闭解析面板（如果已答题则自动进入下一题）
    closeResult() {
      if (this.hasAnswered) {
        this.toNext();
        return;
      }
      this.showResult = false;
      this.isAnalyzing = false;
    },

    // ==================== 退出处理 ====================

    // 点击返回按钮 → 弹出退出确认
    handleExit() {
      this.showExitModal = true;
    },

    // 确认退出：保存进度后返回上一页
    handleExitConfirm() {
      this.showExitModal = false;
      this.saveCurrentProgress();

      if (this.timer) {
        clearInterval(this.timer);
      }
      stopQuestionTimer();
      safeNavigateBack();
    },

    // 返回首页
    goHome() {
      uni.switchTab({ url: '/pages/index/index' });
    }
  }
};
