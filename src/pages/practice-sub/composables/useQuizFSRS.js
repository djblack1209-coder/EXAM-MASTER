/**
 * FSRS 复习调度与诊断 Mixin
 *
 * 职责：FSRS 间隔重复评分、复习日程预览、AI诊断报告、练习完成弹窗
 * 使用方式：在 do-quiz.vue 中通过 mixins: [quizFSRSMixin] 合并
 *
 * @module composables/useQuizFSRS
 */

import { scheduleMistakeReview } from '../utils/mistake-fsrs-scheduler.js';
import { scheduleAndSave, formatInterval } from '../services/fsrs-service.js';
import { triggerOptimization } from '../services/fsrs-optimizer-client.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';

export const quizFSRSMixin = {
  data() {
    return {
      // FSRS 记忆状态
      memoryState: null,
      fsrsPreview: null, // { again: {intervalDays}, hard: {intervalDays}, good: {intervalDays}, easy: {intervalDays} }
      tutorFeedback: '',

      // 诊断相关
      diagnosisLoading: false,
      sessionId: '', // 刷题会话ID（用于AI诊断）
      diagnosisId: '', // 诊断报告ID
      diagnosisReady: false, // 诊断是否完成
      diagnosisSummary: '', // 诊断摘要
      hasNextRecommendation: false, // AI是否已推荐下一组题目
      nextRecommendationIds: [], // AI推荐的下一组题目ID

      // 完成弹窗
      showCompleteModal: false
    };
  },

  computed: {
    // 完成弹窗内容（根据诊断状态动态生成）
    completeModalContent() {
      const total = this.questions.length;
      const correct = this.answeredQuestions ? this.answeredQuestions.filter((a) => a.isCorrect).length : 0;
      const wrong = total - correct;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const base = `本次完成 ${total} 题，正确率 ${accuracy}%`;

      // 复习日程预览 — 让用户感知"这个App在帮我安排"
      let scheduleHint = '';
      if (wrong > 0) {
        try {
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
    }
  },

  methods: {
    // ==================== FSRS 评分 ====================

    // 格式化FSRS间隔天数为可读文本
    formatFsrsInterval(days) {
      return formatInterval(days);
    },

    // FSRS评分并进入下一题
    rateAndNext(rating) {
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        scheduleAndSave(questionId, rating).catch((err) => {
          logger.warn('[DoQuiz] FSRS schedule failed:', err);
        });
      }

      // 每 50 次答题触发一次 FSRS 参数优化（非阻塞）
      const reviewCount = parseInt(storageService.get('fsrs_review_count', '0')) + 1;
      storageService.save('fsrs_review_count', String(reviewCount));
      if (reviewCount % 50 === 0) {
        triggerOptimization().catch((e) => {
          logger.warn('[do-quiz] FSRS优化触发失败:', e?.message || e);
        });
      }

      this.fsrsPreview = null;
      this.toNext();
    },

    // ==================== AI诊断 ====================

    // 自动诊断：刷题结束后台自动触发
    async autoDiagnose() {
      if (!this.sessionId || this.answeredQuestions.length < 3) {
        return;
      }
      this.diagnosisLoading = true;
      try {
        // 并行：诊断 + 获取下一组推荐
        const [diagRes, recRes] = await Promise.allSettled([
          this._reviewStore.generateDiagnosis({ sessionId: this.sessionId }),
          this._reviewStore.fetchSmartRecommendations({ limit: 10 })
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

    // ==================== 完成弹窗处理 ====================

    // 完成弹窗主按钮 — 根据是否有推荐决定行为
    handleCompleteAction() {
      if (this.hasNextRecommendation && this.nextRecommendationIds.length > 0) {
        // AI已推荐下一组，直接开始
        this.showCompleteModal = false;
        storageService.save('smart_review_ids', this.nextRecommendationIds);
        uni.redirectTo({ url: '/pages/practice-sub/do-quiz?mode=smart_review' });
      } else {
        // 没有推荐，查看诊断报告
        this.viewDiagnosisReport();
      }
    },

    // 查看诊断报告
    viewDiagnosisReport() {
      this.showCompleteModal = false;
      if (this.diagnosisId) {
        uni.navigateTo({
          url: `/pages/practice-sub/diagnosis-report?diagnosisId=${this.diagnosisId}&sessionId=${this.sessionId}`
        });
      } else if (this.diagnosisLoading) {
        toast.info('AI 正在分析中，请稍候...');
        this.showCompleteModal = true;
      } else {
        safeNavigateBack();
      }
    },

    // 处理练习完成确认（返回上一页）
    handleCompleteConfirm() {
      this.showCompleteModal = false;
      this.isNavigating = false;
      safeNavigateBack();
    },

    // AI智能诊断 — 手动触发
    async handleDiagnosis() {
      if (this.diagnosisLoading) return;
      if (!this.sessionId) {
        toast.info('会话数据不足，无法诊断');
        this.handleCompleteConfirm();
        return;
      }

      this.diagnosisLoading = true;
      try {
        const result = await this._reviewStore.generateDiagnosis({ sessionId: this.sessionId });
        if (result.success && result.data) {
          this.showCompleteModal = false;
          const diagnosisId = result.data._id;
          uni.navigateTo({
            url: `/pages/practice-sub/diagnosis-report?diagnosisId=${diagnosisId}&sessionId=${this.sessionId}`,
            fail: () => {
              const d = result.data.diagnosis || {};
              uni.showModal({
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
          toast.error(result.error?.message || '诊断失败');
        }
      } catch (e) {
        logger.warn('[do-quiz] AI诊断失败:', e);
        toast.info('诊断失败，请稍后重试');
      } finally {
        this.diagnosisLoading = false;
      }
    }
  }
};
