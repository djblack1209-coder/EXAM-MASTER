/**
 * 学习轨迹 Store（Composition API）
 * 解决检查点1.4：知识点气泡轨迹记录问题
 * ✅ H027: 从 Options API 迁移到 Composition API
 *
 * 功能：
 * 1. 学习轨迹记录（事件流：点击、答题、复习等）
 * 2. 学习路径分析（会话、连续天数）
 * 3. 知识点掌握度追踪（按知识点维度）
 * 4. 学习行为统计（今日/本周维度）
 *
 * 职责边界：
 * - learning-trajectory-store.js：细粒度事件流 + 知识点掌握度，面向学习路径分析
 * - study.js：聚合指标（总题数、正确率），面向首页/个人中心展示
 * 两者的 recordAnswer 语义不同：trajectory 记录事件流，study 更新聚合计数
 */

import { ref, shallowRef, triggerRef, computed } from 'vue';
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

export const useLearningTrajectoryStore = defineStore('learningTrajectory', () => {
  // ==================== 状态 ====================
  /** 学习轨迹事件流 — shallowRef 避免大数组(最多1000条)深度响应开销 */
  const trajectory = shallowRef([]);
  const knowledgeMastery = ref({});
  /** 学习会话列表 — shallowRef 避免大数组(最多100条)深度响应开销 */
  const sessions = shallowRef([]);
  const currentSession = ref(null);
  const isInitialized = ref(false);

  // 内部变量（非响应式，不暴露给外部）
  let _debouncedSaveTrajectory = () => saveTrajectory();

  // ==================== 计算属性 ====================

  /** 今日轨迹 */
  const todayTrajectory = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return trajectory.value.filter((t) => t.date === today);
  });

  /** 今日学习时长（分钟） */
  const todayStudyMinutes = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.value.filter((s) => s.date === today);
    return todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  });

  /** 本周学习天数 */
  const weekStudyDays = computed(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const studyDates = new Set(sessions.value.filter((s) => new Date(s.startTime) >= weekStart).map((s) => s.date));

    return studyDates.size;
  });

  /** 最常访问的知识点 */
  const topKnowledgePoints = computed(() => {
    const counts = {};
    trajectory.value
      .filter((t) => t.type === TRAJECTORY_EVENTS.BUBBLE_CLICK)
      .forEach((t) => {
        const key = t.data.bubbleId || t.data.title;
        counts[key] = (counts[key] || 0) + 1;
      });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count }));
  });

  /** 学习连续天数 */
  const streakDays = computed(() => {
    if (sessions.value.length === 0) return 0;

    const dates = [...new Set(sessions.value.map((s) => s.date))].sort().reverse();
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
  });

  // ==================== 方法 ====================

  /** 保存轨迹数据 */
  function saveTrajectory() {
    try {
      storageService.save(STORAGE_KEYS.TRAJECTORY, trajectory.value);
    } catch (e) {
      logger.error('[LearningTrajectory] 保存轨迹失败:', e);
    }
  }

  /** 保存掌握度数据 */
  function saveMastery() {
    try {
      storageService.save(STORAGE_KEYS.KNOWLEDGE_MASTERY, knowledgeMastery.value);
    } catch (e) {
      logger.error('[LearningTrajectory] 保存掌握度失败:', e);
    }
  }

  /** 保存会话数据 */
  function saveSessions() {
    try {
      // 只保留最近100个会话
      const sessionsToSave = sessions.value.slice(0, 100);
      storageService.save(STORAGE_KEYS.LEARNING_SESSIONS, sessionsToSave);
    } catch (e) {
      logger.error('[LearningTrajectory] 保存会话失败:', e);
    }
  }

  /**
   * 更新知识点掌握度
   * @param {string} knowledgeId - 知识点ID
   * @param {Object} updates - 更新数据
   */
  function updateMastery(knowledgeId, updates) {
    if (!knowledgeMastery.value[knowledgeId]) {
      knowledgeMastery.value[knowledgeId] = {
        mastery: 50,
        accessCount: 0,
        practiceCount: 0,
        correctCount: 0,
        firstAccess: Date.now()
      };
    }

    Object.assign(knowledgeMastery.value[knowledgeId], updates);
    saveMastery();
  }

  /**
   * 记录轨迹事件
   * @param {string} type - 事件类型
   * @param {Object} data - 事件数据
   */
  function recordEvent(type, data = {}) {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      data,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      sessionId: currentSession.value?.id
    };

    trajectory.value.unshift(event);
    // shallowRef 原地变更后手动触发响应式更新
    triggerRef(trajectory);

    // 限制记录数量
    if (trajectory.value.length > 1000) {
      trajectory.value = trajectory.value.slice(0, 1000);
    }

    _debouncedSaveTrajectory();

    logger.log('[LearningTrajectory] 记录事件:', type, data);
  }

  /**
   * 处理气泡点击事件
   * @param {Object} clickData - 点击数据
   */
  function handleBubbleClick(clickData) {
    recordEvent(TRAJECTORY_EVENTS.BUBBLE_CLICK, clickData);

    // 更新知识点掌握度
    if (clickData.bubbleId) {
      updateMastery(clickData.bubbleId, {
        lastAccess: Date.now(),
        accessCount: (knowledgeMastery.value[clickData.bubbleId]?.accessCount || 0) + 1
      });
    }
  }

  /**
   * 记录答题事件
   * @param {Object} answerData - 答题数据
   */
  function recordAnswer(answerData) {
    recordEvent(TRAJECTORY_EVENTS.QUESTION_ANSWER, answerData);

    // 更新相关知识点掌握度
    if (answerData.knowledgePoints) {
      answerData.knowledgePoints.forEach((kp) => {
        const currentMasteryVal = knowledgeMastery.value[kp] || { mastery: 50 };
        const delta = answerData.isCorrect ? 5 : -3;

        updateMastery(kp, {
          mastery: Math.max(0, Math.min(100, currentMasteryVal.mastery + delta)),
          lastPractice: Date.now(),
          practiceCount: (currentMasteryVal.practiceCount || 0) + 1,
          correctCount: (currentMasteryVal.correctCount || 0) + (answerData.isCorrect ? 1 : 0)
        });
      });
    }
  }

  /** 初始化 */
  function init() {
    if (isInitialized.value) return;

    try {
      trajectory.value = storageService.get(STORAGE_KEYS.TRAJECTORY, []);
      knowledgeMastery.value = storageService.get(STORAGE_KEYS.KNOWLEDGE_MASTERY, {});
      sessions.value = storageService.get(STORAGE_KEYS.LEARNING_SESSIONS, []);
      isInitialized.value = true;

      // 初始化 debounced save
      let _saveTimer = null;
      _debouncedSaveTrajectory = () => {
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
          saveTrajectory();
          _saveTimer = null;
        }, 2000);
      };

      logger.log('[LearningTrajectory] 初始化完成');
    } catch (e) {
      logger.error('[LearningTrajectory] 初始化失败:', e);
      // 初始化失败时设置默认状态，避免后续操作异常
      trajectory.value = [];
      knowledgeMastery.value = {};
      sessions.value = [];
      isInitialized.value = true; // 标记为已初始化（降级模式）
      _debouncedSaveTrajectory = () => saveTrajectory();
    }
  }

  /** 开始学习会话 */
  function startSession() {
    const session = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      date: new Date().toISOString().split('T')[0],
      events: [],
      duration: 0
    };

    currentSession.value = session;
    sessions.value.unshift(session);
    // shallowRef 原地变更后手动触发响应式更新
    triggerRef(sessions);

    logger.log('[LearningTrajectory] 开始会话:', session.id);

    return session;
  }

  /** 结束学习会话 */
  function endSession() {
    if (!currentSession.value) return null;

    const session = currentSession.value;
    session.endTime = Date.now();
    session.duration = Math.floor((session.endTime - session.startTime) / 60000); // 分钟

    // 更新会话列表
    const index = sessions.value.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      sessions.value[index] = session;
      // shallowRef 原地变更后手动触发响应式更新
      triggerRef(sessions);
    }

    saveSessions();

    logger.log('[LearningTrajectory] 结束会话:', session.id, '时长:', session.duration, '分钟');

    currentSession.value = null;
    return session;
  }

  /**
   * 获取学习报告
   * @param {string} period - 时间段 (today/week/month)
   */
  function getReport(period = 'today') {
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

    const filteredTrajectory = trajectory.value.filter((t) => new Date(t.timestamp) >= startDate);

    const filteredSessions = sessions.value.filter((s) => new Date(s.startTime) >= startDate);

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
      averageSessionMinutes: filteredSessions.length > 0 ? Math.round(totalMinutes / filteredSessions.length) : 0
    };
  }

  /**
   * 获取学习路径
   * @param {number} limit - 返回数量
   */
  function getLearningPath(limit = 20) {
    return trajectory.value
      .filter((t) =>
        [TRAJECTORY_EVENTS.BUBBLE_CLICK, TRAJECTORY_EVENTS.QUESTION_ANSWER, TRAJECTORY_EVENTS.KNOWLEDGE_VIEW].includes(
          t.type
        )
      )
      .slice(0, limit)
      .map((t) => ({
        type: t.type,
        title: t.data.title || t.data.questionType || '未知',
        timestamp: t.timestamp,
        result: t.data.isCorrect
      }));
  }

  /** 清除所有数据 */
  function clearAll() {
    trajectory.value = [];
    knowledgeMastery.value = {};
    sessions.value = [];
    currentSession.value = null;

    storageService.remove(STORAGE_KEYS.TRAJECTORY);
    storageService.remove(STORAGE_KEYS.KNOWLEDGE_MASTERY);
    storageService.remove(STORAGE_KEYS.LEARNING_SESSIONS);

    logger.log('[LearningTrajectory] 数据已清除');
  }

  /** 销毁store，清理事件监听（防止内存泄漏） */
  function destroy() {
    isInitialized.value = false;
  }

  return {
    // 状态
    trajectory,
    knowledgeMastery,
    sessions,
    currentSession,
    isInitialized,
    // 计算属性
    todayTrajectory,
    todayStudyMinutes,
    weekStudyDays,
    topKnowledgePoints,
    streakDays,
    // 方法
    init,
    recordEvent,
    handleBubbleClick,
    recordAnswer,
    updateMastery,
    startSession,
    endSession,
    getReport,
    getLearningPath,
    saveTrajectory,
    saveMastery,
    saveSessions,
    clearAll,
    destroy
  };
});

export default useLearningTrajectoryStore;
