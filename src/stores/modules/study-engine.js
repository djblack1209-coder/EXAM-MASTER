/**
 * 本地学习引擎 Store
 *
 * 这是离线业务闭环的聚合层：答题页把结果写入 studyProgress / mistake_book，
 * 旧资产仅保留历史口径；当前学习状态与计划从可追溯学习核心读取。
 * 不调用云函数、不恢复数据库，网络不可用时也能给页面稳定的数据契约。
 */
import { defineStore } from 'pinia';
import { useStudyStore } from '@/stores/modules/study.js';
import { storageService } from '@/services/storageService.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { summarizeLearning, knowledgeScope, questionKey } from '@/services/learning/learning-domain.js';
import {
  summarizeQuizProgress,
  normalizeLegacyReviewQuestion,
  legacyReviewQuestionIdentity,
  createQuizAttemptId,
  LEGACY_REVIEW_HANDOFF_KEY
} from '@/services/quiz-session-contract.js';
import { getUserId, captureSession, checkSession, assertSession } from '@/services/auth-storage.js';

const STORAGE_KEY = 'study_engine_state_v1';
const BANK_KEY = 'v30_bank';
const MISTAKE_KEY = 'mistake_book';
const DAY_MS = 86400000;

const ERROR_TYPE_NAMES = {
  concept_confusion: '概念混淆',
  calculation_error: '计算失误',
  memory_lapse: '记忆遗忘',
  logic_error: '逻辑推理错误',
  careless_mistake: '粗心大意',
  knowledge_gap: '知识盲区',
  time_pressure: '时间不足',
  unknown: '未分类'
};

function readArray(key, migrateLegacy = true) {
  const value = storageService.get(key, [], { migrateLegacy });
  return Array.isArray(value) ? value : [];
}

function formatDate(date) {
  const local = new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function normalizeKey(value) {
  return String(value || '').trim() || '综合';
}

function questionCategory(question = {}) {
  return normalizeKey(
    question.knowledgePoint ||
      question.knowledge_point ||
      question.sub_category ||
      question.subCategory ||
      question.category ||
      question.subject
  );
}

function isMistakeMastered(mistake) {
  return (mistake?.is_mastered ?? mistake?.isMastered) === true;
}

function getMistakeErrorType(mistake) {
  const value = mistake?.error_type || mistake?.errorType;
  return Object.prototype.hasOwnProperty.call(ERROR_TYPE_NAMES, value) ? value : 'unknown';
}

function legacyGroupId(mistake) {
  return JSON.stringify([getMistakeErrorType(mistake), questionCategory(mistake)]);
}

function readPersistedState(session) {
  const value = storageService.get(STORAGE_KEY, {}, { session, migrateLegacy: false });
  assertSession(session);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function persistState(state) {
  storageService.save(
    STORAGE_KEY,
    {
      currentSession: state.currentSession,
      sessionHistory: state.sessionHistory.slice(0, 50),
      lastAnalysis: state.lastAnalysis,
      lastClusters: state.lastClusters,
      lastPlan: state.lastPlan
    },
    true,
    state._session
  );
}

function restoredEngineState(session, saved = {}, recordReadState = 'ready') {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const currentSession = saved.currentSession && typeof saved.currentSession === 'object' ? saved.currentSession : null;
  return {
    _session: session,
    recordReadState,
    currentSession,
    isStudying: Boolean(currentSession),
    sessionHistory: Array.isArray(saved.sessionHistory) ? saved.sessionHistory.slice(0, 50) : [],
    lastAnalysis: saved.lastAnalysis || null,
    lastClusters: Array.isArray(saved.lastClusters) ? saved.lastClusters : [],
    lastPlan: saved.lastPlan || null
  };
}
const studyEngineStore = defineStore('study-engine', {
  state: () => {
    const session = captureSession();
    const result = storageService.read(STORAGE_KEY, {}, { session, migrateLegacy: false });
    return restoredEngineState(
      session,
      result.status === 'ready' ? result.value : {},
      result.status === 'ready' ? 'ready' : 'pending'
    );
  },

  getters: {
    sessionCount: (state) => state.sessionHistory.length,
    hasActiveSession: (state) => Boolean(state.currentSession)
  },

  actions: {
    _persist() {
      assertSession(this._session);
      persistState(this);
    },

    async startSession(options = {}) {
      if (this.currentSession) {
        return { success: true, data: this.currentSession, source: 'local', reused: true };
      }
      const now = Date.now();
      const bank = readArray(BANK_KEY);
      const session = {
        id: `local_session_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        mode: options.mode || 'practice',
        questionCount: Number(options.questionCount || bank.length || 0),
        startedAt: now,
        answeredCount: 0,
        correctCount: 0
      };
      this.currentSession = session;
      this.isStudying = true;
      this._persist();
      return { success: true, data: session, source: 'local' };
    },

    async endSession(summary = {}) {
      if (!this.currentSession) {
        return { success: false, data: null, source: 'local', message: '没有进行中的学习会话' };
      }
      const endedAt = Date.now();
      const session = {
        ...this.currentSession,
        ...summary,
        endedAt,
        durationMs: Math.max(0, endedAt - Number(this.currentSession.startedAt || endedAt))
      };
      this.sessionHistory.unshift(session);
      this.sessionHistory = this.sessionHistory.slice(0, 50);
      this.currentSession = null;
      this.isStudying = false;
      this._persist();
      return { success: true, data: session, source: 'local' };
    },

    async getProgress() {
      const studyStore = useStudyStore();
      studyStore.restoreProgress();
      const progress = studyStore.studyProgress || {};
      const bank = readArray(BANK_KEY);
      const mistakes = readArray(MISTAKE_KEY);
      const total = Math.max(Number(progress.totalQuestions || 0), bank.length);
      const completed = Number(progress.completedQuestions || 0);
      const correct = Number(progress.correctQuestions || 0);
      return {
        total,
        completed,
        correct,
        accuracy: null,
        legacyAccuracy: studyStore.accuracy,
        legacyGradedCount: studyStore.legacySummary.legacyGradedCount,
        scoringAuthority: false,
        studyDays: Number(progress.studyDays || 0),
        studyMinutes: Number(progress.studyMinutes || 0),
        mistakes: mistakes.length,
        source: 'local'
      };
    },

    async analyzeMastery() {
      const state = learningRepository.read();
      const reliable = summarizeLearning(state);
      const canPractice = (attemptId) => {
        const attempt = state.attempts.find((item) => item.id === attemptId);
        return Boolean(
          attempt && state.conversations.some((session) => session.id === attempt.conversationId && !session.stopped)
        );
      };
      const mastery = Object.entries(reliable.knowledge).map(([scope, evidence]) => ({
        knowledgePoint: scope,
        subject: state.questions.find((question) => knowledgeScope(question) === scope)?.subject || '综合',
        status: evidence.status,
        evidenceIds: [...evidence.evidenceIds],
        needsRetest: evidence.status === '待复测',
        needsHelp: evidence.status === '需提示',
        canPractice: canPractice(evidence.evidenceIds.at(-1))
      }));
      const reviewTargets = reliable.due
        .filter((review) => canPractice(review.attemptId))
        .map((review) => {
          const question = state.questions.find((question) => questionKey(question) === review.questionKey);
          return {
            knowledgePoint: knowledgeScope(question),
            subject: question?.subject || '综合',
            questionKey: review.questionKey,
            due: review.due,
            evidenceIds: [review.attemptId]
          };
        });
      const studyStore = useStudyStore();
      studyStore.restoreProgress();
      const history = Array.isArray(studyStore.questionHistory) ? studyStore.questionHistory : [];
      const legacyHistory = summarizeQuizProgress({
        answeredQuestions: history.map((item, index) => ({ ...item, index }))
      });
      const data = {
        contract: 'learning-evidence-summary-v1',
        mastery,
        reviewTargets,
        legacyHistory,
        summary: {
          totalKnowledgePoints: mastery.length,
          independentCount: mastery.filter((item) => item.status === '可独立完成').length,
          retestCount: mastery.filter((item) => item.needsRetest).length,
          needsHelpCount: mastery.filter((item) => item.needsHelp).length,
          // 不再把旧匹配、题量或预设记忆值拼成能力百分比。
          avgMastery: null,
          masteredCount: null,
          weakCount: null,
          weakestPoint: null,
          reliableAnswers: reliable.totalReliableAnswers,
          pending: reliable.pending
        }
      };
      this.lastAnalysis = data;
      // 只读分析不回写或清空旧 knowledge_mastery/原作答缓存。
      return { success: true, data, source: 'learning-core' };
    },

    async getErrorClusters() {
      const raw = readArray(MISTAKE_KEY, false).filter(
        (item) => item && typeof item === 'object' && !Array.isArray(item)
      );
      const counts = new Map();
      for (const item of raw) {
        const key = String(item.id ?? item._id);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const mistakes = raw.filter((item) => !isMistakeMastered(item));
      const grouped = new Map();
      for (const mistake of mistakes) {
        const key = legacyGroupId(mistake);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(mistake);
      }
      const clusters = Array.from(grouped.entries())
        .map(([key, items]) => {
          const [errorType, category] = JSON.parse(key);
          const questionCount = items.length;
          return {
            clusterId: key,
            source: 'legacy',
            scoringAuthority: false,
            errorType,
            errorTypeName: ERROR_TYPE_NAMES[errorType] || ERROR_TYPE_NAMES.unknown,
            knowledgePoints: [category],
            questionCount,
            countBand: questionCount >= 10 ? 'high' : questionCount >= 5 ? 'medium' : 'low',
            reviewableCount: items.filter(
              (item) => normalizeLegacyReviewQuestion(item) && counts.get(String(item.id ?? item._id)) === 1
            ).length,
            examples: items.slice(0, 3).map((item) => ({
              questionContent:
                typeof (item.question ?? item.question_content ?? item.title) === 'string'
                  ? (item.question ?? item.question_content ?? item.title)
                  : '',
              userAnswer: ['string', 'number'].includes(typeof (item.user_answer ?? item.userAnswer))
                ? String(item.user_answer ?? item.userAnswer)
                : '',
              referenceAnswer: ['string', 'number'].includes(
                typeof (item.answer ?? item.correct_answer ?? item.correctAnswer)
              )
                ? String(item.answer ?? item.correct_answer ?? item.correctAnswer)
                : ''
            }))
          };
        })
        .sort((a, b) => b.questionCount - a.questionCount);
      const data = {
        contract: 'legacy-error-groups-v1',
        ownerId: getUserId() || '',
        scoringAuthority: false,
        clusters,
        summary: {
          totalClusters: clusters.length,
          totalMistakes: clusters.reduce((sum, item) => sum + item.questionCount, 0),
          reviewableCount: clusters.reduce((sum, item) => sum + item.reviewableCount, 0)
        }
      };
      this.lastClusters = clusters;
      // 只读分组：不回写旧 error_clusters，不生成诊断、严重度或虚构日趋势。
      return { success: true, data, source: 'legacy' };
    },

    prepareLegacyReview({
      clusterId,
      recordIds,
      expectedQuestions,
      referenceViewedIds = [],
      expectedOwnerId = getUserId() || ''
    } = {}) {
      const ownerId = getUserId() || '';
      if (ownerId !== expectedOwnerId) return { success: false, message: '账户已变化，请重新打开历史记录' };
      if (clusterId !== undefined && typeof clusterId !== 'string') return { success: false };
      if (
        recordIds !== undefined &&
        (!Array.isArray(recordIds) ||
          recordIds.length === 0 ||
          recordIds.some((id) => !['string', 'number'].includes(typeof id)))
      )
        return { success: false };
      const ids = recordIds && new Set(recordIds.map(String));
      const raw = readArray(MISTAKE_KEY, false).filter(
        (item) => item && typeof item === 'object' && !Array.isArray(item)
      );
      const selected = raw.filter(
        (item) =>
          (!clusterId || (!isMistakeMastered(item) && legacyGroupId(item) === clusterId)) &&
          (!ids || ids.has(String(item.id ?? item._id)))
      );
      const counts = new Map();
      for (const item of raw) {
        const key = String(item.id ?? item._id);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const complete = selected
        .map(normalizeLegacyReviewQuestion)
        .filter((item) => item && counts.get(String(item.id)) === 1);
      if (expectedQuestions !== undefined) {
        if (!Array.isArray(expectedQuestions) || !ids || !expectedQuestions.length)
          return { success: false, message: '请重新选择原条目' };
        const expected = new Map(
          expectedQuestions.map((q) => [String(q?.id ?? q?._id), legacyReviewQuestionIdentity(q)])
        );
        if (
          [...ids].some((id) => !expected.has(id)) ||
          complete.some((q) => expected.get(String(q.id)) !== legacyReviewQuestionIdentity(q))
        )
          return { success: false, message: '原题或材料已变化，请重新打开历史记录' };
      }
      if (
        !Array.isArray(referenceViewedIds) ||
        referenceViewedIds.some((id) => !['string', 'number'].includes(typeof id))
      )
        return { success: false };
      const viewed = new Set(referenceViewedIds.map(String));
      const questions = complete.slice(0, 200).map((q) => ({
        ...q,
        legacyReviewContext: { contract: 'legacy-review-view-v1', referenceViewed: viewed.has(String(q.id)) }
      }));
      if (!questions.length) return { success: false, message: '这些旧条目暂不能重练，原记录已保留' };
      const handoff = JSON.parse(
        JSON.stringify({ contract: 'legacy-review-handoff-v1', id: createQuizAttemptId(), ownerId, questions })
      );
      if (
        (getUserId() || '') !== ownerId ||
        !storageService.save(LEGACY_REVIEW_HANDOFF_KEY, handoff, true, this._session)
      )
        return { success: false, message: '未保存重练入口，请重试' };
      return {
        success: true,
        count: questions.length,
        skipped: selected.length - complete.length,
        deferred: complete.length - questions.length,
        url: `/pages/practice-sub/do-quiz?mode=legacy_review&reviewId=${encodeURIComponent(handoff.id)}`
      };
    },

    async generateStudyPlan(examDate, dailyHours = 4) {
      const session = this._session;
      if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(examDate))) {
        return { success: false, data: null, source: 'local', message: '请提供考试日期（YYYY-MM-DD）' };
      }
      const examTimestamp = new Date(`${examDate}T23:59:59`).getTime();
      if (!Number.isFinite(examTimestamp)) {
        return { success: false, data: null, source: 'local', message: '考试日期无效' };
      }
      const now = new Date();
      // Count calendar preparation days; the exam day's final hour adds no day.
      const examDay = new Date(examTimestamp);
      const daysRemaining = Math.max(
        1,
        Math.round(
          (Date.UTC(examDay.getFullYear(), examDay.getMonth(), examDay.getDate()) -
            Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
            DAY_MS
        )
      );
      const dailyMinutes = Math.max(30, Math.min(720, Math.round(Number(dailyHours || 4) * 60)));
      const masteryResult = await this.analyzeMastery();
      assertSession(session);
      const mastery = masteryResult.data.mastery || [];
      const weak = mastery.filter((item) => item.canPractice && (item.needsRetest || item.needsHelp)).slice(0, 3);
      const review = masteryResult.data.reviewTargets.slice(0, 3);
      const plans = [];
      const planDays = Math.min(7, daysRemaining);

      for (let index = 0; index < planDays; index += 1) {
        let remainingMinutes = dailyMinutes;
        const tasks = [];
        for (const item of review) {
          if (remainingMinutes <= 0) break;
          const durationMinutes = Math.min(30, remainingMinutes);
          tasks.push({
            knowledgePoint: item.knowledgePoint,
            subject: item.subject,
            action: 'review',
            durationMinutes,
            questionCount: Math.max(1, Math.ceil(durationMinutes / 3)),
            questionKey: item.questionKey,
            evidenceIds: item.evidenceIds,
            reason: '已有复习安排到期'
          });
          remainingMinutes -= durationMinutes;
        }
        for (const item of weak) {
          if (remainingMinutes <= 0) break;
          const durationMinutes = Math.min(60, remainingMinutes);
          tasks.push({
            knowledgePoint: item.knowledgePoint,
            subject: item.subject,
            action: 'drill',
            durationMinutes,
            questionCount: Math.max(1, Math.ceil(durationMinutes / 4)),
            evidenceIds: item.evidenceIds,
            reason: item.needsHelp ? '此前使用过提示，可另题练习' : '此前作答需要复测'
          });
          remainingMinutes -= durationMinutes;
        }
        if (remainingMinutes > 20) {
          tasks.push({
            knowledgePoint: '综合练习',
            subject: 'mixed',
            action: index % 3 === 0 ? 'mock' : 'drill',
            durationMinutes: remainingMinutes,
            questionCount: Math.max(1, Math.ceil(remainingMinutes / 3)),
            reason: index % 3 === 0 ? '定期检验学习效果' : '巩固已学内容'
          });
          remainingMinutes = 0;
        }
        plans.push({
          date: formatDate(addDays(now, index)),
          tasks,
          totalMinutes: dailyMinutes - remainingMinutes
        });
      }

      const phaseName = daysRemaining >= 90 ? '基础夯实' : daysRemaining >= 30 ? '强化突破' : '极限冲刺';
      const data = {
        plans,
        phases: [
          {
            name: phaseName,
            startDate: formatDate(now),
            endDate: formatDate(addDays(now, Math.max(0, Math.min(daysRemaining - 1, 6)))),
            focus: weak.length
              ? `先复测${weak.map((item) => item.knowledgePoint).join('、')}`
              : '保持刷题节奏，巩固已学内容'
          }
        ],
        summary: `已按可靠作答依据与可用时间生成未来${planDays}天计划，每日${Math.round((dailyMinutes / 60) * 10) / 10}小时。`
      };
      // 同时提供 data.plan 兼容旧计划页和 data.plans 兼容自适应计划页。
      const payload = { ...data, plan: data };
      this.lastPlan = payload;
      this._persist();
      return { success: true, data: payload, source: 'local' };
    }
  }
});

const studyEngineBindings = new WeakSet();
export function useStudyEngineStore(...args) {
  const store = studyEngineStore(...args);
  if (!studyEngineBindings.has(store)) {
    studyEngineBindings.add(store);
    let resetDepth = 0;
    const apply = (next) => {
      resetDepth++;
      try {
        store.$patch((state) => Object.assign(state, next));
      } finally {
        resetDepth--;
      }
    };
    const ensure = () => {
      if (resetDepth) throw Object.assign(new Error('学习状态正在重新加载'), { code: 'CONTEXT_CHANGED' });
      const status = checkSession(store._session);
      if (status === 'unavailable') assertSession(store._session);
      if (status === 'changed') apply(restoredEngineState(captureSession(), {}, 'pending'));
      if (store.recordReadState === 'pending') {
        const session = captureSession();
        apply(restoredEngineState(session, readPersistedState(session)));
      }
      assertSession(store._session);
    };
    const stopIdentity = storageService.onIdentityChange(() => {
      try {
        ensure();
      } catch {
        /* Retry after an unavailable read. */
      }
    });
    const stopActions = store.$onAction(() => ensure());
    const dispose = store.$dispose.bind(store);
    store.$dispose = () => {
      stopIdentity();
      stopActions();
      dispose();
    };
  }
  return store;
}
