/**
 * PK 答题流程 Mixin
 *
 * 职责：对战开始、倒计时、答题选择、对手模拟、题目切换、定时器管理、中途退出
 * 使用方式：在 pk-battle.vue 中通过 mixins: [pkGameplayMixin] 合并
 *
 * @module composables/usePKGameplay
 */
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { safeNavigateBack } from '@/utils/safe-navigate';

export const pkGameplayMixin = {
  data() {
    return {
      // 题目与答题核心状态
      currentIndex: 0,
      questions: [],
      myScore: 0,
      opponentScore: 0,
      userChoice: null,
      opponentChoice: null,
      opponentAnswered: false,
      showAns: false,
      // 对手动画与定时器
      opponentRushing: false,
      opponentTimers: [],
      questionTimer: null,
      timeLeft: 30,
      showRedWarning: false,
      // 答题时间记录
      questionStartTime: 0,
      answerTimes: [],
      // 进度条
      myProgress: 0,
      opProgress: 0
    };
  },

  computed: {
    /**
     * 当前题目（规范化后的安全对象）
     * 自动处理 options 格式异常、数量不足等情况
     */
    currentQuestion() {
      const q = this.questions[this.currentIndex];
      if (!q) {
        logger.warn('[PK] 当前题目不存在:', {
          currentIndex: this.currentIndex,
          questionsLength: this.questions.length
        });
        return { question: '加载中...', options: [] };
      }

      // 数据规范化：确保题目格式正确
      let options = q.options || [];

      // 修复智能回传格式问题：确保options是数组且格式正确
      if (!Array.isArray(options)) {
        logger.warn('[PK] options不是数组，尝试转换:', options);
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            logger.error('[PK] 无法解析options字符串:', e);
            options = [];
          }
        } else if (typeof options === 'object' && options !== null) {
          options = Object.values(options);
        } else {
          options = [];
        }
      }

      // 确保每个选项都是字符串，且去除前后空格
      options = options
        .map((opt) => {
          if (typeof opt === 'string') {
            return opt.trim();
          } else if (typeof opt === 'object' && opt !== null) {
            return (opt.text || opt.content || opt.label || String(opt)).trim();
          }
          return String(opt).trim();
        })
        .filter((opt) => opt.length > 0);

      // 如果选项数量不足4个，补充空选项（安全上限防止无限循环）
      let _safetyCounter = 0;
      while (options.length < 4 && _safetyCounter++ < 10) {
        options.push(`选项${options.length + 1}`);
      }

      // 限制选项数量为4个
      options = options.slice(0, 4);

      return {
        question: (q.question || q.title || '题目加载中...').trim(),
        options: options,
        answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
        type: q.type || '单选',
        id: q.id || `q_${this.currentIndex}`
      };
    },

    /**
     * 判断某个选项是否为正确答案
     * 返回一个函数，接收选项索引
     */
    isCorrectOption() {
      return (idx) => {
        if (!this.currentQuestion || !this.showAns) return false;
        const correctAnswer = this.currentQuestion.answer;
        if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
          return ['A', 'B', 'C', 'D'][idx] === correctAnswer;
        }
        const opt = this.currentQuestion.options?.[idx];
        return opt === correctAnswer || (opt?.startsWith(correctAnswer) ?? false);
      };
    }
  },

  methods: {
    /**
     * 开始 bot 对战
     * 重置分数标志、初始化第一题、启动机器人答题和倒计时
     */
    startBattle() {
      this.isScoreUploaded = false;
      this.currentIndex = 0;

      if (this.questions.length === 0) {
        logger.error('[PK] 题目为空，无法开始对战');
        toast.info('题目加载失败');
        return;
      }

      this.simulateOpponentAnswer(0);
      this.questionStartTime = Date.now();
      this.answerTimes = [];
      this.startQuestionTimer();
    },

    /**
     * Phase 3-2: 真人对战开始（使用轮询同步对手状态）
     */
    startRealBattle() {
      this.isScoreUploaded = false;
      this.currentIndex = 0;
      this.questionStartTime = Date.now();
      this.answerTimes = [];
      this.startQuestionTimer();

      // 启动对手状态同步
      this.syncOpponentFromRoom();
    },

    /**
     * Phase 3-2: 从房间状态同步对手分数和进度
     * 每 500ms 轮询一次 pkRoom 的对手数据
     */
    syncOpponentFromRoom() {
      if (this._opponentSyncTimer) clearInterval(this._opponentSyncTimer);

      this._opponentSyncTimer = setInterval(() => {
        if (!this.pkRoom || !this.isRealMatch) {
          clearInterval(this._opponentSyncTimer);
          return;
        }

        const op = this.pkRoom.opponent.value;
        if (op) {
          this.opponentScore = op.score || 0;
          this.opProgress = op.current_index || 0;

          // 对手答完了
          if (op.finished && this.pkRoom.roomStatus.value === 'finished') {
            clearInterval(this._opponentSyncTimer);
          }
        }
      }, 500);
    },

    /**
     * 启动题目倒计时（每题30秒）
     * @param {boolean} resetTime - 是否重置剩余时间为30秒，默认 true
     */
    startQuestionTimer(resetTime = true) {
      // 清除之前的倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 重置倒计时和红光警告
      if (resetTime || !Number.isFinite(this.timeLeft) || this.timeLeft <= 0) {
        this.timeLeft = 30;
      }
      this.showRedWarning = false;

      // 启动倒计时
      this.questionTimer = setInterval(() => {
        this.timeLeft--;

        // 最后5秒显示红光警告
        if (this.timeLeft <= 5 && this.timeLeft > 0) {
          this.showRedWarning = true;
        } else if (this.timeLeft > 5) {
          this.showRedWarning = false;
        }

        // 时间到了，自动判定错误
        if (this.timeLeft <= 0) {
          this.showRedWarning = false;
          this.handleTimeOut();
        }
      }, 1000);
    },

    /**
     * 答题超时处理
     * 自动判定为错误，1.5秒后进入下一题
     */
    handleTimeOut() {
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 如果已经显示答案，不再处理
      if (this.showAns) {
        return;
      }

      // 自动判定为错误（选择 -1 表示超时）
      this.userChoice = -1;
      this.showAns = true;

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('Vibrate feedback failed during answer timeout', e);
      }

      toast.info('答题超时');

      // 1.5秒后进入下一题
      setTimeout(() => {
        this.goToNextQuestion();
      }, 1500);
    },

    /**
     * 切换到下一题
     * 重置答题状态，如果还有题则继续，否则结束对局
     */
    goToNextQuestion() {
      this.showAns = false;
      this.userChoice = null;
      this.opponentChoice = null;
      this.opponentAnswered = false;

      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        // 开始下一题的机器人答题
        this.simulateOpponentAnswer(this.currentIndex);
        // 记录下一题开始时间
        this.questionStartTime = Date.now();
        // 启动新题目的倒计时
        this.startQuestionTimer();
      } else {
        this.finishGame();
      }
    },

    /**
     * 模拟机器人对手答题
     * 根据对手配置的正确率和速度，在随机延时后给出答案
     * @param {number} questionIndex - 当前题目索引
     */
    simulateOpponentAnswer(questionIndex) {
      // 检查游戏状态，如果已经结束则不再答题
      if (questionIndex >= this.questions.length || this.gameState !== 'battle') {
        logger.warn('[PK] 对手答题被跳过:', {
          questionIndex: questionIndex,
          questionsLength: this.questions.length,
          gameState: this.gameState
        });
        return;
      }

      const question = this.questions[questionIndex];
      if (!question) {
        logger.error('[PK] 题目不存在，无法模拟对手答题:', questionIndex);
        return;
      }

      // 规范化正确答案：确保格式为 A/B/C/D
      const correctAnswerRaw = question.answer;
      const correctAnswer = correctAnswerRaw.toString().toUpperCase().charAt(0);
      const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);

      // 根据智能对手配置计算答题时间
      let answerTimeBase = 5000; // 默认5秒
      if (this.opponent.speed === 'fast') {
        answerTimeBase = 3000;
      } else if (this.opponent.speed === 'slow') {
        answerTimeBase = 7000;
      }
      const answerTime = Math.random() * 2000 + answerTimeBase;

      // 使用智能对手配置的正确率
      const accuracy = this.opponent.accuracy || 0.7;
      const willAnswerCorrectly = Math.random() < accuracy;

      const timer = setTimeout(() => {
        // 再次检查游戏状态，防止在答题过程中游戏已结束
        if (this.gameState !== 'battle') {
          logger.warn('[PK] 游戏已结束，取消对手答题:', {
            questionIndex: questionIndex,
            gameState: this.gameState
          });
          return;
        }

        // 对手答题
        this.opponentAnswered = true;

        // 确定对手选择的选项
        if (willAnswerCorrectly && correctIndex >= 0) {
          this.opponentChoice = correctIndex;
        } else if (willAnswerCorrectly && correctIndex < 0) {
          this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
        } else {
          const wrongOptions = [0, 1, 2, 3].filter((i) => i !== correctIndex);
          if (wrongOptions.length > 0) {
            this.opponentChoice = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
          } else {
            this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
          }
        }

        // 判断对手是否正确
        const isOpponentCorrect = correctIndex >= 0 && this.opponentChoice === correctIndex;

        if (isOpponentCorrect) {
          this.opponentScore += 20;
          this.opponentRushing = true;
          setTimeout(() => {
            this.opponentRushing = false;
          }, 500);
        }

        // 更新对手进度条
        this.opProgress = ((questionIndex + 1) / this.questions.length) * 100;
      }, answerTime);

      this.opponentTimers.push(timer);
    },

    /**
     * 用户选择答案
     * 处理答题判定、震动反馈、真人对战提交、进度更新
     * @param {number} idx - 选项索引 (0-3)
     */
    handleSelect(idx) {
      vibrateLight();
      if (this.gameState !== 'battle') {
        logger.warn('[PK] 当前不在对战状态，无法答题:', {
          gameState: this.gameState
        });
        return;
      }

      if (this.showAns) {
        return; // 显示答案时禁止点击
      }

      if (!this.currentQuestion || !this.currentQuestion.options || this.currentQuestion.options.length === 0) {
        logger.error('[PK] 题目数据不完整，无法答题:', {
          currentQuestion: this.currentQuestion
        });
        toast.info('题目加载中，请稍候');
        return;
      }

      // 记录真实答题时间
      if (this.questionStartTime > 0) {
        this.answerTimes.push(Date.now() - this.questionStartTime);
      }

      this.userChoice = idx;
      this.showAns = true;

      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('Vibrate feedback failed during option selection', e);
      }

      // 判断是否正确
      const isCorrect = this.isCorrectOption(idx);
      if (isCorrect) {
        this.myScore += 20;
      }

      // Phase 3-2: 真人对战模式下，提交答案到房间
      if (this.isRealMatch && this.pkRoom) {
        const answerLetter = String.fromCharCode(65 + idx); // 0→A, 1→B, ...
        const duration = this.questionStartTime > 0 ? Math.round((Date.now() - this.questionStartTime) / 1000) : 0;
        this.pkRoom.submitAnswer(this.currentIndex, answerLetter, duration).catch((error) => {
          logger.warn('[PK] submit answer failed', error);
        });
      }

      // 更新我的进度条
      this.myProgress = ((this.currentIndex + 1) / this.questions.length) * 100;

      // 清除倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 1.5秒后进入下一题
      setTimeout(() => {
        this.goToNextQuestion();
      }, 1500);
    },

    /**
     * 清除所有定时器
     * 包括：对手答题、题目倒计时、匹配相关、实时PK轮询
     */
    clearAllTimers() {
      // 清除对手答题定时器
      this.opponentTimers.forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
      this.opponentTimers = [];
      // 清除题目倒计时
      if (this.questionTimer) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
      }

      // 清除匹配相关定时器
      if (this.matchingTimer) {
        clearTimeout(this.matchingTimer);
        this.matchingTimer = null;
      }
      if (this.matchingTimeoutTimer) {
        clearTimeout(this.matchingTimeoutTimer);
        this.matchingTimeoutTimer = null;
      }
      this.stopMatchingStatusUpdate();

      // Phase 3-2: 清理实时PK相关
      if (this.realMatchPollWatcher) {
        clearInterval(this.realMatchPollWatcher);
        this.realMatchPollWatcher = null;
      }
      if (this._opponentSyncTimer) {
        clearInterval(this._opponentSyncTimer);
        this._opponentSyncTimer = null;
      }
      if (this.pkRoom) {
        this.pkRoom.stopPolling();
      }
    },

    /**
     * 对战阶段中途退出
     * 弹窗确认后清理所有定时器并返回首页
     */
    handleQuit() {
      vibrateLight();
      uni.showModal({
        title: '退出对战',
        content: '中途退出将视为放弃本局，确定吗？',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            this.clearAllTimers();
            uni.switchTab({
              url: '/pages/index/index',
              fail: () => {
                safeNavigateBack();
              }
            });
          }
        }
      });
    }
  }
};
