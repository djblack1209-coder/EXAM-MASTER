/**
 * 答案提交与评分 Mixin
 *
 * 职责：选项选择、答案判定、AI解析、错题保存、答题动画、XP奖励、数据分析记录
 * 使用方式：在 do-quiz.vue 中通过 mixins: [quizSubmitMixin] 合并
 *
 * @module composables/useQuizSubmit
 */

import { stopTimer as stopQuestionTimer } from '../question-timer.js';
import { playCorrectAnimation, playWrongAnimation, getComboDisplay } from '../quiz-animation.js';
import {
  saveToMistakes as saveMistake,
  updateMistakeWithAI as updateMistakeAI,
  generateMnemonic
} from '../quiz-mistake-handler.js';
import { fetchAIDeepAnalysis as fetchAIAnalysis, fetchAIAnalysisStream } from '../quiz-ai-analysis.js';
import { recordAnswerToAnalytics as recordAnalytics } from '../quiz-analytics-recorder.js';
import { onAnswerResult } from '../quiz-gamification-bridge.js';
import { offlineCache } from '@/services/offline-cache-service.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import { loadCardState, createNewCard, previewSchedule } from '../services/fsrs-service.js';

export const quizSubmitMixin = {
  data() {
    return {
      // AI分析状态
      isAnalyzing: false,

      // 答题动画状态
      comboDisplay: null, // 连击显示数据
      showComboEffect: false, // 是否显示连击特效
      correctAnimationClass: '', // 正确答案动画类
      wrongAnimationClass: '', // 错误答案动画类
      screenShake: false, // 屏幕微震

      // XP / 经验值状态
      xpEarned: 0, // 本次获得的XP
      showXpToast: false, // 是否显示XP浮窗
      xpBoostActive: false, // 2x XP boost 是否激活
      xpBoostRemaining: 0, // boost 剩余题数

      // 粒子特效状态
      particles: [],
      showParticles: false
    };
  },

  methods: {
    // ==================== 选项选择与答案判定 ====================

    // 用户选择选项后的核心处理逻辑
    async selectOption(idx) {
      if (this.isAnalyzing || this.showResult || this.hasAnswered) return;

      this.userChoice = idx;
      this.hasAnswered = true;

      // 停止单题计时器并记录用时
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

      // 记录已答题目
      this.answeredQuestions.push({
        questionId: this.currentQuestion?.id,
        index: this.currentIndex,
        userChoice: idx,
        isCorrect,
        timeSpent
      });

      // 离线队列：无网络时将答题记录加入同步队列
      if (!offlineCache.isOnline) {
        offlineCache.addToSyncQueue('answer_submit', {
          questionId: this.currentQuestion?.id,
          userChoice: idx,
          isCorrect,
          timeSpent,
          timestamp: Date.now()
        });
      }

      // 记录答题数据到各个分析模块
      this.recordAnswerToAnalytics(isCorrect, timeSpent).catch((_err) => {
        /* 分析记录失败不影响答题流程 */
      });

      // 游戏化：记录答题结果（XP / 成就 / 每日挑战 / 视觉反馈）
      onAnswerResult({ isCorrect, timeSpent });

      if (isCorrect) {
        // 播放正确答案动画
        this.playCorrectEffect();

        // 正确时：震动反馈
        try {
          if (typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
          }
        } catch (e) {
          logger.warn('Vibrate feedback failed on correct answer', e);
        }

        // 延迟解锁防重复点击
        setTimeout(() => {
          this.isNavigating = false;
        }, 300);

        this.resultStatus = 'correct';
        this.updateStudyStats();
        this.showResult = true;
      } else {
        // 播放错误答案动画
        this.playWrongEffect();

        this.resultStatus = 'wrong';
        // 非阻塞AI分析：先立即显示结果（题目自带解析），AI异步增强
        this.aiComment = '';
        this.updateStudyStats();
        this.showResult = true;

        // 先保存到错题本（不含智能解析）
        this.saveToMistakes().catch((_err) => {
          /* 静默处理 */
        });
        // AI深度解析异步执行，完成后自动替换解析内容
        this.fetchAIDeepAnalysis(this.currentQuestion, this.currentQuestion.options[idx]).catch((aiErr) => {
          logger.warn('[do-quiz] AI深度解析失败，不影响答题流程:', aiErr);
        });
        // 异步生成记忆口诀/助记符（不阻塞）
        generateMnemonic({
          currentQuestion: this.currentQuestion,
          correctAnswer: this.currentQuestion.answer
        }).catch(() => {
          /* 静默处理 */
        });
      }
    },

    // ==================== AI深度解析 ====================

    // 真流式SSE AI解析，首字 < 500ms，逐字写入
    async fetchAIDeepAnalysis(question, userChoice) {
      this.aiComment = '';
      let fullText = '';

      try {
        await fetchAIAnalysisStream({
          question,
          userChoice,
          onChunk: (text) => {
            this.aiComment = text;
            fullText = text;
          },
          onDone: () => {
            if (fullText) {
              this.updateMistakeWithAI(fullText);
            }
          },
          onError: (err) => {
            logger.warn('[do-quiz] 流式AI解析失败，降级:', err);
            // 降级：用非流式兜底
            fetchAIAnalysis({ question, userChoice })
              .then((result) => {
                if (result.comment) {
                  this.aiComment = result.comment;
                  if (result.success) this.updateMistakeWithAI(result.comment);
                }
              })
              .catch((e) => {
                logger.warn('[do-quiz] AI解析fallback失败:', e?.message || e);
              });
          }
        });
      } catch (e) {
        logger.warn('[do-quiz] AI解析异步增强失败:', e);
      }
    },

    // ==================== 错题保存 ====================

    // 委托给 quiz-mistake-handler.js 保存错题
    async saveToMistakes() {
      await saveMistake({
        currentQuestion: this.currentQuestion,
        userChoice: this.userChoice,
        aiComment: this.aiComment
      });
    },

    // 委托给 quiz-mistake-handler.js 用AI解析更新错题记录
    updateMistakeWithAI(aiAnalysis) {
      updateMistakeAI({
        currentQuestion: this.currentQuestion,
        aiAnalysis
      });
    },

    // ==================== 答题动画 ====================

    // 播放正确答案动画 + XP奖励 + 连击特效
    playCorrectEffect() {
      const animData = playCorrectAnimation();
      if (animData) {
        this.correctAnimationClass = 'quiz-correct-animation';

        // XP奖励 + 2x boost机制
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
          const bonus = xpResult.xpEarned;
          this.xpSystem.state.value.totalXP += bonus;
          this.xpSystem.state.value.todayXP += bonus;
        }
        this.xpEarned = finalXP;
        this.showXpToast = true;
        setTimeout(() => {
          this.showXpToast = false;
        }, 1800);

        // 5连击触发2x XP boost（3题有效）
        if ((animData.combo || 0) === 5 && !this.xpBoostActive) {
          this.xpBoostActive = true;
          this.xpBoostRemaining = 3;
          setTimeout(() => {
            toast.info('2x XP Boost! 接下来3题双倍经验');
          }, 500);
        }

        // 升级提示
        if (xpResult.levelUp && xpResult.newLevel) {
          setTimeout(() => {
            toast.success(`升级！${xpResult.newLevel.title}`);
          }, 800);
        }

        // 激活粒子特效
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

    // 播放错误答案动画 — 屏幕微震 + 红色脉冲
    playWrongEffect() {
      const animData = playWrongAnimation();
      if (animData) {
        this.wrongAnimationClass = 'quiz-wrong-animation';

        // 屏幕微震效果
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

    // ==================== 数据分析记录 ====================

    // 委托给 quiz-analytics-recorder.js 记录答题数据
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

      // 添加到已答题目列表（组件状态，需通过 this 访问）
      if (questionData) {
        this.answeredQuestions.push({
          questionId: this.currentQuestion.id,
          isCorrect,
          timeSpent,
          timestamp: Date.now()
        });
      }
    }
  }
};
