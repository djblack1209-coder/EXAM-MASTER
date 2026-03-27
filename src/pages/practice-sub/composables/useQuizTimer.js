/**
 * 答题计时 Mixin
 *
 * 职责：总计时器管理、单题计时器管理、时间格式化
 * 使用方式：在 do-quiz.vue 中通过 mixins: [quizTimerMixin] 合并
 *
 * @module composables/useQuizTimer
 */

import { startTimer as startQuestionTimerModule, stopTimer as stopQuestionTimer } from '../question-timer.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export { stopQuestionTimer };

export const quizTimerMixin = {
  data() {
    return {
      // 总计时器
      seconds: 0, // 总用时（秒）
      timer: null, // 总计时器 interval ID

      // 单题计时器
      questionTimeLimit: 120, // 当前题目时限（秒）
      questionTimeRemaining: 120, // 剩余时间
      showTimeWarning: false, // 是否显示时间警告
      questionTimerEnabled: true, // 是否启用单题计时
      currentQuestionDifficulty: 2, // 当前题目难度

      // 答题开始时间（用于计算单题用时）
      answerStartTime: 0
    };
  },

  methods: {
    // 启动总计时器（防重入：自动清除已有定时器）
    startTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.timer = setInterval(() => {
        this.seconds++;
      }, 1000);
    },

    // 格式化秒数为 MM:SS 格式
    formatTime(s) {
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m < 10 ? '0' + m : m}:${rs < 10 ? '0' + rs : rs}`;
    },

    // 启动单题计时器（根据题目难度自动设定时限）
    startQuestionTimer() {
      if (!this.questionTimerEnabled || !this.currentQuestion) return;

      const difficulty = this.currentQuestion.difficulty || 2;
      this.currentQuestionDifficulty = difficulty;

      const timerResult = startQuestionTimerModule({
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
    }
  }
};
