/**
 * 学习轨迹 Store
 */
import { defineStore } from 'pinia';
import { buildKnowledgeGraph, deriveKnowledgeVisualState, resolveQuestionKnowledge } from '@/config/knowledge-graph.js';
import { storageService } from '@/services/storageService.js';

const STORAGE_KEY = 'learning_trajectory_v1';
const DEFAULT_EXAM_PROFILE = {
  tracks: ['politics', 'english1', 'math1']
};

function readPersistedState() {
  try {
    const saved = storageService.get(STORAGE_KEY, null);
    if (!saved || typeof saved !== 'object') return {};
    return saved;
  } catch (_e) {
    return {};
  }
}

function normalizeProfile(profile = {}) {
  return {
    ...DEFAULT_EXAM_PROFILE,
    ...profile,
    tracks: Array.isArray(profile.tracks) && profile.tracks.length > 0 ? profile.tracks : DEFAULT_EXAM_PROFILE.tracks
  };
}

export const useLearningTrajectoryStore = defineStore('learning-trajectory', {
  state: () => {
    const saved = readPersistedState();
    return {
      trajectory: Array.isArray(saved.trajectory) ? saved.trajectory.slice(0, 500) : [],
      loading: false,
      examProfile: normalizeProfile(saved.examProfile),
      nodeStates: saved.nodeStates && typeof saved.nodeStates === 'object' ? saved.nodeStates : {}
    };
  },
  getters: {
    recentActivity: (state) => state.trajectory.slice(0, 20),
    weeklyStats: (state) => {
      const weekAgo = Date.now() - 7 * 86400000;
      const recent = state.trajectory.filter((item) => Number(item.timestamp || 0) >= weekAgo);
      return {
        days: new Set(recent.map((item) => new Date(item.timestamp).toDateString())).size,
        total: recent.length
      };
    },
    knowledgeGraph: (state) => buildKnowledgeGraph(state.examProfile),
    knowledgeNodesWithState: (state) => {
      const graph = buildKnowledgeGraph(state.examProfile);
      return graph.nodes.map((item) => ({
        ...item,
        visual: deriveKnowledgeVisualState(state.nodeStates[item.id])
      }));
    },
    masterySummary: (state) => {
      const values = Object.values(state.nodeStates);
      const attempted = values.filter((item) => item.attempts > 0);
      const strong = attempted.filter((item) => deriveKnowledgeVisualState(item).state === 'strong');
      const weak = attempted.filter((item) => deriveKnowledgeVisualState(item).state === 'weak');
      return {
        attempted: attempted.length,
        strong: strong.length,
        weak: weak.length,
        mastery: attempted.length ? Math.round((strong.length / attempted.length) * 100) : 0
      };
    }
  },
  actions: {
    persistTrajectory() {
      try {
        storageService.save(STORAGE_KEY, {
          trajectory: this.trajectory.slice(0, 500),
          examProfile: this.examProfile,
          nodeStates: this.nodeStates
        });
      } catch (_e) {
        // 学习轨迹是增强体验，持久化失败不应阻塞答题流程。
      }
    },
    restoreTrajectory() {
      const saved = readPersistedState();
      if (Array.isArray(saved.trajectory)) this.trajectory = saved.trajectory.slice(0, 500);
      if (saved.examProfile) this.examProfile = normalizeProfile(saved.examProfile);
      if (saved.nodeStates && typeof saved.nodeStates === 'object') this.nodeStates = saved.nodeStates;
      return {
        trajectory: this.trajectory,
        examProfile: this.examProfile,
        nodeStates: this.nodeStates
      };
    },
    setExamProfile(profile = {}) {
      this.examProfile = normalizeProfile({ ...this.examProfile, ...profile });
      this.persistTrajectory();
    },
    recordQuestionAttempt(question = {}, result = {}) {
      const isCorrect = Boolean(result.isCorrect ?? result.correct);
      const nodeIds = resolveQuestionKnowledge(question, this.examProfile);
      const timestamp = result.timestamp || Date.now();

      for (const nodeId of nodeIds) {
        const previous = this.nodeStates[nodeId] || {
          attempts: 0,
          correct: 0,
          streak: 0,
          totalTimeMs: 0,
          lastCorrect: undefined,
          lastPracticedAt: 0
        };

        const next = {
          attempts: previous.attempts + 1,
          correct: previous.correct + (isCorrect ? 1 : 0),
          streak: isCorrect ? previous.streak + 1 : 0,
          totalTimeMs: previous.totalTimeMs + Number(result.timeSpent || result.timeSpentMs || 0),
          lastCorrect: isCorrect,
          lastPracticedAt: timestamp,
          lastSpeedScore: Number(result.speedScore || 0),
          lastEloUserRating: Number(result.elo?.userRating || previous.lastEloUserRating || 0),
          lastEloQuestionRating: Number(result.elo?.questionRating || previous.lastEloQuestionRating || 0)
        };
        this.nodeStates[nodeId] = next;
      }

      const activity = {
        type: 'question_attempt',
        questionId: question.id || question._id || '',
        nodeIds,
        isCorrect,
        speedScore: Number(result.speedScore || 0),
        elo: result.elo || null,
        timestamp
      };
      this.trajectory.unshift(activity);
      this.trajectory = this.trajectory.slice(0, 500);
      this.persistTrajectory();
      return activity;
    },
    async recordActivity(activity = {}) {
      if (activity.question) {
        return this.recordQuestionAttempt(activity.question, activity.result || activity);
      }
      const normalized = { ...activity, timestamp: activity.timestamp || Date.now() };
      this.trajectory.unshift(normalized);
      this.trajectory = this.trajectory.slice(0, 500);
      this.persistTrajectory();
      return normalized;
    },
    async loadTrajectory() {
      return this.trajectory;
    },
    async getWeeklyReport() {
      return {
        stats: this.weeklyStats,
        mastery: this.masterySummary,
        recentActivity: this.recentActivity
      };
    },
    getNodeVisualState(nodeId) {
      return deriveKnowledgeVisualState(this.nodeStates[nodeId]);
    }
  }
});
