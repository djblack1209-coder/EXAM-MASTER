/**
 * 本地学习引擎 Store
 *
 * 这是离线业务闭环的聚合层：答题页把结果写入 studyProgress / mistake_book，
 * 这里再从同一份本地资产生成掌握度、错题聚类、学习计划和会话进度。
 * 不调用云函数、不恢复数据库，网络不可用时也能给页面稳定的数据契约。
 */
import { defineStore } from 'pinia';
import { useStudyStore } from '@/stores/modules/study.js';
import { storageService } from '@/services/storageService.js';

const STORAGE_KEY = 'study_engine_state_v1';
const MASTERY_CACHE_KEY = 'knowledge_mastery';
const CLUSTER_CACHE_KEY = 'error_clusters';
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

const MASTERY_LEVELS = [
  { id: 'unlearned', name: '未学习', threshold: 0, color: '#9CA3AF' },
  { id: 'weak', name: '薄弱', threshold: 0.01, color: '#EF4444' },
  { id: 'developing', name: '发展中', threshold: 30, color: '#F59E0B' },
  { id: 'proficient', name: '熟练', threshold: 60, color: '#3B82F6' },
  { id: 'mastered', name: '掌握', threshold: 85, color: '#10B981' }
];

function readArray(key) {
  const value = storageService.get(key, []);
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

function questionSubject(question = {}) {
  return normalizeKey(question.subject || question.category || '综合');
}

function masteryLevel(value) {
  let selected = MASTERY_LEVELS[0];
  for (const level of MASTERY_LEVELS) {
    if (value >= level.threshold) selected = level;
  }
  return selected;
}

function isMistakeMastered(mistake) {
  return Boolean(mistake?.is_mastered ?? mistake?.isMastered);
}

function mistakeCount(mistake) {
  const value = Number(mistake?.wrong_count ?? mistake?.wrongCount ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function correctStreak(mistake) {
  const value = Number(mistake?.correct_streak ?? mistake?.correctStreak ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function getMistakeErrorType(mistake) {
  return normalizeKey(mistake?.error_type || mistake?.errorType || 'unknown');
}

function getMistakeTimestamp(mistake) {
  return Number(
    mistake?.last_wrong_time ||
      mistake?.lastWrongTime ||
      mistake?.last_review ||
      mistake?.last_review_time ||
      mistake?.created_at ||
      mistake?.createdAt ||
      0
  );
}

function normalizeQuestionForReview(mistake, index) {
  const options =
    Array.isArray(mistake?.options) && mistake.options.length > 0
      ? mistake.options
      : Array.isArray(mistake?.choices) && mistake.choices.length > 0
        ? mistake.choices
        : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'];
  const answerValue = mistake?.answer ?? mistake?.correct_answer ?? mistake?.correctAnswer ?? 'A';
  const answer =
    typeof answerValue === 'number'
      ? ['A', 'B', 'C', 'D'][answerValue] || 'A'
      : String(answerValue).charAt(0).toUpperCase();
  return {
    id: mistake?.id || mistake?._id || `mistake_${index}`,
    question: mistake?.question || mistake?.question_content || mistake?.title || `错题 ${index + 1}`,
    options,
    answer: answer || 'A',
    category: mistake?.category || mistake?.subject || '综合',
    desc: mistake?.desc || mistake?.analysis || mistake?.explanation || '暂无解析'
  };
}

function readPersistedState() {
  const value = storageService.get(STORAGE_KEY, {});
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
    true
  );
}

export const useStudyEngineStore = defineStore('study-engine', {
  state: () => {
    const saved = readPersistedState();
    const currentSession =
      saved.currentSession && typeof saved.currentSession === 'object' ? saved.currentSession : null;
    return {
      currentSession,
      isStudying: Boolean(currentSession),
      sessionHistory: Array.isArray(saved.sessionHistory) ? saved.sessionHistory.slice(0, 50) : [],
      lastAnalysis: saved.lastAnalysis || null,
      lastClusters: Array.isArray(saved.lastClusters) ? saved.lastClusters : [],
      lastPlan: saved.lastPlan || null
    };
  },

  getters: {
    sessionCount: (state) => state.sessionHistory.length,
    hasActiveSession: (state) => Boolean(state.currentSession)
  },

  actions: {
    _persist() {
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
        accuracy: completed > 0 ? Math.round((correct / completed) * 1000) / 10 : 0,
        studyDays: Number(progress.studyDays || 0),
        studyMinutes: Number(progress.studyMinutes || 0),
        mistakes: mistakes.length,
        source: 'local'
      };
    },

    async analyzeMastery() {
      const studyStore = useStudyStore();
      studyStore.restoreProgress();
      const history = Array.isArray(studyStore.questionHistory) ? studyStore.questionHistory : [];
      const mistakes = readArray(MISTAKE_KEY);
      const map = new Map();

      const ensure = (key, subject = key) => {
        if (!map.has(key)) {
          map.set(key, {
            knowledgePoint: key,
            subject,
            totalQuestions: 0,
            correctCount: 0,
            wrongCount: 0,
            recent: [],
            errorTypes: {},
            avgRetrievability: 50
          });
        }
        return map.get(key);
      };

      // history 是答题页写入的唯一逐题答题流水，优先用于准确率和趋势。
      for (const item of history) {
        const key = questionCategory(item);
        const entry = ensure(key, questionSubject(item));
        const correct = item.isCorrect === true || item.correct === true;
        entry.totalQuestions += 1;
        if (correct) entry.correctCount += 1;
        else entry.wrongCount += 1;
        entry.recent.push({ timestamp: Number(item.timestamp || 0), correct });
      }

      // 错题本补充尚未出现在历史中的本地错题，以及 FSRS 可提取性信息。
      for (const mistake of mistakes) {
        const key = questionCategory(mistake);
        const entry = ensure(key, questionSubject(mistake));
        const wrong = mistakeCount(mistake);
        const streak = correctStreak(mistake);
        if (history.length === 0) {
          entry.totalQuestions += wrong + streak;
          entry.wrongCount += wrong;
          entry.correctCount += streak;
        } else if (entry.totalQuestions === 0) {
          entry.totalQuestions += wrong + streak;
          entry.wrongCount += wrong;
          entry.correctCount += streak;
        }
        const errorType = getMistakeErrorType(mistake);
        entry.errorTypes[errorType] = (entry.errorTypes[errorType] || 0) + 1;
        const stability = Number(mistake.stability || 0);
        const due = Number(mistake.due || mistake.next_review_time || 0);
        if (stability > 0 && due > 0) {
          entry.avgRetrievability = Math.max(0, Math.min(100, due >= Date.now() ? 80 : 30));
        }
      }

      const mastery = Array.from(map.values())
        .map((entry) => {
          const accuracy = entry.totalQuestions > 0 ? (entry.correctCount / entry.totalQuestions) * 100 : 0;
          const value = Math.round((0.4 * entry.avgRetrievability + 0.6 * accuracy) * 10) / 10;
          const recent = entry.recent
            .filter((item) => item.timestamp > 0)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);
          let recentTrend = 'stable';
          if (recent.length >= 3) {
            const recentAccuracy = recent.filter((item) => item.correct).length / recent.length;
            const overallAccuracy = accuracy / 100;
            if (recentAccuracy > overallAccuracy + 0.1) recentTrend = 'improving';
            else if (recentAccuracy < overallAccuracy - 0.1) recentTrend = 'declining';
          }
          return {
            knowledgePoint: entry.knowledgePoint,
            subject: entry.subject,
            totalQuestions: entry.totalQuestions,
            correctCount: entry.correctCount,
            wrongCount: entry.wrongCount,
            accuracy: Math.round(accuracy * 10) / 10,
            avgRetrievability: Math.round(entry.avgRetrievability * 10) / 10,
            mastery: value,
            masteryLevel: masteryLevel(value),
            isWeak: value < 60,
            prerequisites: [],
            prerequisitesMet: true,
            recentTrend,
            errorTypes: entry.errorTypes
          };
        })
        .sort((a, b) => a.mastery - b.mastery);

      const weak = mastery.filter((item) => item.isWeak);
      const data = {
        mastery,
        summary: {
          totalKnowledgePoints: mastery.length,
          weakCount: weak.length,
          masteredCount: mastery.filter((item) => item.mastery >= 85).length,
          avgMastery: mastery.length
            ? Math.round((mastery.reduce((sum, item) => sum + item.mastery, 0) / mastery.length) * 10) / 10
            : 0,
          weakestPoint: weak[0]?.knowledgePoint || null
        }
      };
      this.lastAnalysis = data;
      storageService.save(MASTERY_CACHE_KEY, mastery, true);
      this._persist();
      return { success: true, data, source: 'local' };
    },

    async getErrorClusters() {
      const mistakes = readArray(MISTAKE_KEY).filter((item) => !isMistakeMastered(item));
      const grouped = new Map();
      for (const mistake of mistakes) {
        const errorType = getMistakeErrorType(mistake);
        const category = questionCategory(mistake);
        const key = `${errorType}::${category}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(mistake);
      }

      const clusters = Array.from(grouped.entries())
        .map(([key, items]) => {
          const [errorType, category] = key.split('::');
          const questionCount = items.length;
          const severity = questionCount >= 10 ? 'high' : questionCount >= 5 ? 'medium' : 'low';
          const timestamps = items
            .map(getMistakeTimestamp)
            .filter(Boolean)
            .sort((a, b) => a - b);
          let trend = 'stable';
          if (timestamps.length >= 3) {
            const midpoint = timestamps[Math.floor(timestamps.length / 2)];
            const newer = timestamps.filter((time) => time >= midpoint).length;
            const older = timestamps.length - newer;
            if (newer > older * 1.5) trend = 'increasing';
            else if (older > newer * 1.5) trend = 'decreasing';
          }
          return {
            clusterId: `local_cluster_${errorType}_${category}`,
            errorType,
            errorTypeName: ERROR_TYPE_NAMES[errorType] || ERROR_TYPE_NAMES.unknown,
            knowledgePoints: [category],
            questionCount,
            examples: items.slice(0, 3).map((item, index) => {
              const q = normalizeQuestionForReview(item, index);
              return {
                questionContent: q.question,
                userAnswer: item.user_answer || item.userAnswer || '',
                correctAnswer: q.answer
              };
            }),
            severity,
            suggestion: `建议针对「${category}」进行${severity === 'high' ? '集中' : '专项'}复习，并在复习后立即重练。`,
            trend
          };
        })
        .sort((a, b) => b.questionCount - a.questionCount);

      const data = {
        clusters,
        summary: {
          totalClusters: clusters.length,
          highSeverity: clusters.filter((item) => item.severity === 'high').length,
          totalMistakes: clusters.reduce((sum, item) => sum + item.questionCount, 0),
          topErrorType: clusters[0]?.errorTypeName || null
        }
      };
      this.lastClusters = clusters;
      storageService.save(CLUSTER_CACHE_KEY, data, true);
      this._persist();
      return { success: true, data, source: 'local' };
    },

    async generateStudyPlan(examDate, dailyHours = 4) {
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
      const mastery = masteryResult.data.mastery || [];
      const weak = mastery.filter((item) => item.isWeak).slice(0, 3);
      const review = mastery.filter((item) => item.avgRetrievability < 70 && item.mastery >= 30).slice(0, 3);
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
            mastery: item.mastery,
            reason: `可提取性${item.avgRetrievability.toFixed(0)}%，有遗忘风险`
          });
          remainingMinutes -= durationMinutes;
        }
        for (const item of weak) {
          if (remainingMinutes <= 0) break;
          const durationMinutes = Math.min(60, remainingMinutes);
          tasks.push({
            knowledgePoint: item.knowledgePoint,
            subject: item.subject,
            action: item.mastery < 10 ? 'new_learn' : 'drill',
            durationMinutes,
            questionCount: Math.max(1, Math.ceil(durationMinutes / 4)),
            mastery: item.mastery,
            reason: `掌握度仅${item.mastery.toFixed(0)}%，需重点突破`
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
              ? `优先突破${weak.map((item) => item.knowledgePoint).join('、')}`
              : '保持刷题节奏，巩固已学内容'
          }
        ],
        summary: `已按本地答题记录生成未来${planDays}天计划，每日${Math.round((dailyMinutes / 60) * 10) / 10}小时。`
      };
      // 同时提供 data.plan 兼容旧计划页和 data.plans 兼容自适应计划页。
      const payload = { ...data, plan: data };
      this.lastPlan = payload;
      this._persist();
      return { success: true, data: payload, source: 'local' };
    }
  }
});
