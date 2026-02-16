/**
 * 学习轨迹 Store
 * 解决检查点1.4：知识点气泡轨迹记录问题
 *
 * 功能：
 * 1. 学习轨迹记录
 * 2. 学习路径分析
 * 3. 知识点掌握度追踪
 * 4. 学习行为统计
 */

import { defineStore } from 'pinia';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// 存储键名
const STORAGE_KEYS = {
  TRAJECTORY: 'learning_trajectory',
  KNOWLEDGE_MASTERY: 'knowledge_mastery',
  LEARNING_SESSIONS: 'learning_sessions'
};

// 轨迹事件类型
export const TRAJECTORY_EVENTS = {
  BUBBLE_CLICK: 'bubble_click',
  QUESTION_ANSWER: 'question_answer',
  MISTAKE_REVIEW: 'mistake_review',
  KNOWLEDGE_VIEW: 'knowledge_view',
  PRACTICE_START: 'practice_start',
  PRACTICE_END: 'practice_end',
  PAGE_VIEW: 'page_view'
};

export const useLearningTrajectoryStore = defineStore('learningTrajectory', {
  state: () => ({
    // 学习轨迹记录
    trajectory: [],

    // 知识点掌握度
    knowledgeMastery: {},

    // 学习会话
    sessions: [],

    // 当前会话
    currentSession: null,

    // 是否已初始化
    isInitialized: false
  }),

  getters: {
    // 今日轨迹
    todayTrajectory: (state) => {
      const today = new Date().toISOString().split('T')[0];
      return state.trajectory.filter((t) => t.date === today);
    },

    // 今日学习时长（分钟）
    todayStudyMinutes: (state) => {
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = state.sessions.filter((s) => s.date === today);
      return todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    },

    // 本周学习天数
    weekStudyDays: (state) => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const studyDates = new Set(
        state.sessions
          .filter((s) => new Date(s.startTime) >= weekStart)
          .map((s) => s.date)
      );

      return studyDates.size;
    },

    // 最常访问的知识点
    topKnowledgePoints: (state) => {
      const counts = {};
      state.trajectory
        .filter((t) => t.type === TRAJECTORY_EVENTS.BUBBLE_CLICK)
        .forEach((t) => {
          const key = t.data.bubbleId || t.data.title;
          counts[key] = (counts[key] || 0) + 1;
        });

      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => ({ key, count }));
    },

    // 学习连续天数
    streakDays: (state) => {
      if (state.sessions.length === 0) return 0;

      const dates = [...new Set(state.sessions.map((s) => s.date))].sort().reverse();
      let streak = 0;
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const dateStr of dates) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((currentDate - date) / (1000 * 60 * 60 * 24));

        if (diffDays === streak) {
          streak++;
        } else if (diffDays > streak) {
          break;
        }
      }

      return streak;
    }
  },

  actions: {
    /**
     * 初始化
     */
    init() {
      if (this.isInitialized) return;

      try {
        this.trajectory = storageService.get(STORAGE_KEYS.TRAJECTORY, []);
        this.knowledgeMastery = storageService.get(STORAGE_KEYS.KNOWLEDGE_MASTERY, {});
        this.sessions = storageService.get(STORAGE_KEYS.LEARNING_SESSIONS, []);
        this.isInitialized = true;

        // 监听气泡点击事件
        this._bubbleClickHandler = this.handleBubbleClick.bind(this);
        uni.$on('bubble:clicked', this._bubbleClickHandler);

        logger.log('[LearningTrajectory] 初始化完成');
      } catch (e) {
        console.error('[LearningTrajectory] 初始化失败:', e);
        // 初始化失败时设置默认状态，避免后续操作异常
        this.trajectory = [];
        this.knowledgeMastery = {};
        this.sessions = [];
        this.isInitialized = true; // 标记为已初始化（降级模式）
      }
    },

    /**
     * 记录轨迹事件
     * @param {string} type - 事件类型
     * @param {Object} data - 事件数据
     */
    recordEvent(type, data = {}) {
      const event = {
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type,
        data,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        sessionId: this.currentSession?.id
      };

      this.trajectory.unshift(event);

      // 限制记录数量
      if (this.trajectory.length > 1000) {
        this.trajectory = this.trajectory.slice(0, 1000);
      }

      this.saveTrajectory();

      logger.log('[LearningTrajectory] 记录事件:', type, data);
    },

    /**
     * 处理气泡点击事件
     * @param {Object} clickData - 点击数据
     */
    handleBubbleClick(clickData) {
      this.recordEvent(TRAJECTORY_EVENTS.BUBBLE_CLICK, clickData);

      // 更新知识点掌握度
      if (clickData.bubbleId) {
        this.updateMastery(clickData.bubbleId, {
          lastAccess: Date.now(),
          accessCount: (this.knowledgeMastery[clickData.bubbleId]?.accessCount || 0) + 1
        });
      }
    },

    /**
     * 记录答题事件
     * @param {Object} answerData - 答题数据
     */
    recordAnswer(answerData) {
      this.recordEvent(TRAJECTORY_EVENTS.QUESTION_ANSWER, answerData);

      // 更新相关知识点掌握度
      if (answerData.knowledgePoints) {
        answerData.knowledgePoints.forEach((kp) => {
          const currentMastery = this.knowledgeMastery[kp] || { mastery: 50 };
          const delta = answerData.isCorrect ? 5 : -3;

          this.updateMastery(kp, {
            mastery: Math.max(0, Math.min(100, currentMastery.mastery + delta)),
            lastPractice: Date.now(),
            practiceCount: (currentMastery.practiceCount || 0) + 1,
            correctCount: (currentMastery.correctCount || 0) + (answerData.isCorrect ? 1 : 0)
          });
        });
      }
    },

    /**
     * 更新知识点掌握度
     * @param {string} knowledgeId - 知识点ID
     * @param {Object} updates - 更新数据
     */
    updateMastery(knowledgeId, updates) {
      if (!this.knowledgeMastery[knowledgeId]) {
        this.knowledgeMastery[knowledgeId] = {
          mastery: 50,
          accessCount: 0,
          practiceCount: 0,
          correctCount: 0,
          firstAccess: Date.now()
        };
      }

      Object.assign(this.knowledgeMastery[knowledgeId], updates);
      this.saveMastery();
    },

    /**
     * 开始学习会话
     */
    startSession() {
      const session = {
        id: `session_${Date.now()}`,
        startTime: Date.now(),
        date: new Date().toISOString().split('T')[0],
        events: [],
        duration: 0
      };

      this.currentSession = session;
      this.sessions.unshift(session);

      logger.log('[LearningTrajectory] 开始会话:', session.id);

      return session;
    },

    /**
     * 结束学习会话
     */
    endSession() {
      if (!this.currentSession) return null;

      const session = this.currentSession;
      session.endTime = Date.now();
      session.duration = Math.floor((session.endTime - session.startTime) / 60000); // 分钟

      // 更新会话列表
      const index = this.sessions.findIndex((s) => s.id === session.id);
      if (index !== -1) {
        this.sessions[index] = session;
      }

      this.saveSessions();

      logger.log('[LearningTrajectory] 结束会话:', session.id, '时长:', session.duration, '分钟');

      this.currentSession = null;
      return session;
    },

    /**
     * 获取学习报告
     * @param {string} period - 时间段 (today/week/month)
     */
    getReport(period = 'today') {
      let startDate;
      const now = new Date();

      switch (period) {
        case 'today':
          startDate = new Date(now.toISOString().split('T')[0]);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      const filteredTrajectory = this.trajectory.filter(
        (t) => new Date(t.timestamp) >= startDate
      );

      const filteredSessions = this.sessions.filter(
        (s) => new Date(s.startTime) >= startDate
      );

      // 统计各类事件
      const eventCounts = {};
      filteredTrajectory.forEach((t) => {
        eventCounts[t.type] = (eventCounts[t.type] || 0) + 1;
      });

      // 计算总学习时长
      const totalMinutes = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      // 计算学习天数
      const studyDays = new Set(filteredSessions.map((s) => s.date)).size;

      return {
        period,
        totalMinutes,
        studyDays,
        eventCounts,
        trajectoryCount: filteredTrajectory.length,
        sessionCount: filteredSessions.length,
        averageSessionMinutes: filteredSessions.length > 0
          ? Math.round(totalMinutes / filteredSessions.length)
          : 0
      };
    },

    /**
     * 获取学习路径
     * @param {number} limit - 返回数量
     */
    getLearningPath(limit = 20) {
      return this.trajectory
        .filter((t) => [
          TRAJECTORY_EVENTS.BUBBLE_CLICK,
          TRAJECTORY_EVENTS.QUESTION_ANSWER,
          TRAJECTORY_EVENTS.KNOWLEDGE_VIEW
        ].includes(t.type))
        .slice(0, limit)
        .map((t) => ({
          type: t.type,
          title: t.data.title || t.data.questionType || '未知',
          timestamp: t.timestamp,
          result: t.data.isCorrect
        }));
    },

    /**
     * 保存轨迹数据
     */
    saveTrajectory() {
      try {
        storageService.save(STORAGE_KEYS.TRAJECTORY, this.trajectory);
      } catch (e) {
        console.error('[LearningTrajectory] 保存轨迹失败:', e);
      }
    },

    /**
     * 保存掌握度数据
     */
    saveMastery() {
      try {
        storageService.save(STORAGE_KEYS.KNOWLEDGE_MASTERY, this.knowledgeMastery);
      } catch (e) {
        console.error('[LearningTrajectory] 保存掌握度失败:', e);
      }
    },

    /**
     * 保存会话数据
     */
    saveSessions() {
      try {
        // 只保留最近100个会话
        const sessionsToSave = this.sessions.slice(0, 100);
        storageService.save(STORAGE_KEYS.LEARNING_SESSIONS, sessionsToSave);
      } catch (e) {
        console.error('[LearningTrajectory] 保存会话失败:', e);
      }
    },

    /**
     * 清除所有数据
     */
    clearAll() {
      this.trajectory = [];
      this.knowledgeMastery = {};
      this.sessions = [];
      this.currentSession = null;

      storageService.remove(STORAGE_KEYS.TRAJECTORY);
      storageService.remove(STORAGE_KEYS.KNOWLEDGE_MASTERY);
      storageService.remove(STORAGE_KEYS.LEARNING_SESSIONS);

      logger.log('[LearningTrajectory] 数据已清除');
    },

    /**
     * 销毁store，清理事件监听（防止内存泄漏）
     */
    destroy() {
      if (this._bubbleClickHandler) {
        uni.$off('bubble:clicked', this._bubbleClickHandler);
        this._bubbleClickHandler = null;
      }
      this.isInitialized = false;
    }
  }
});

export default useLearningTrajectoryStore;
