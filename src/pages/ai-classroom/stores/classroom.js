/**
 * Classroom Store — AI 课堂状态管理
 *
 * 集中管理 AI 课堂课程/会话的后端调用，
 * 替代 ai-classroom/ 页面直接调用 lafService 的架构违规。
 *
 * 覆盖 8 个调用点:
 *   - getLessonList, createLesson, getLessonStatus, deleteLesson
 *   - startClassroom, sendClassroomMessage ×2, endClassroom
 *
 * @module stores/classroom
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  listLessons,
  createLesson as apiCreateLesson,
  getLessonStatus,
  deleteLesson as apiDeleteLesson,
  startClassroomSession,
  sendClassroomMessage,
  endClassroomSession
} from '@/services/api/domains/ai.api.js';
import { logger } from '@/utils/logger.js';

export const useClassroomStore = defineStore('classroom', () => {
  // ==================== State ====================
  const lessons = ref([]);
  const currentSession = ref(null);
  const messages = ref([]);
  const isSessionActive = computed(() => !!currentSession.value);

  // ==================== Lesson CRUD ====================

  /** 获取课程列表 */
  const fetchLessons = async (params = {}) => {
    try {
      const res = await listLessons(params);
      if (res.code === 0 && res.data) {
        lessons.value = Array.isArray(res.data) ? res.data : res.data.list || [];
        return { success: true, data: lessons.value };
      }
      throw new Error(res.message || '获取课程列表失败');
    } catch (error) {
      logger.error('[ClassroomStore] fetchLessons:', error);
      return { success: false, error };
    }
  };

  /** 创建课程 */
  const createLesson = async (lessonData) => {
    try {
      const res = await apiCreateLesson(lessonData);
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '创建课程失败');
    } catch (error) {
      logger.error('[ClassroomStore] createLesson:', error);
      return { success: false, error };
    }
  };

  /** 获取课程状态 */
  const fetchLessonStatus = async (lessonId) => {
    try {
      const res = await getLessonStatus(lessonId);
      if (res.code === 0 && res.data) {
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '获取课程状态失败');
    } catch (error) {
      logger.error('[ClassroomStore] fetchLessonStatus:', error);
      return { success: false, error };
    }
  };

  /** 删除课程 */
  const deleteLesson = async (lessonId) => {
    try {
      const res = await apiDeleteLesson(lessonId);
      if (res.code === 0) {
        lessons.value = lessons.value.filter((l) => l._id !== lessonId);
        return { success: true };
      }
      throw new Error(res.message || '删除课程失败');
    } catch (error) {
      logger.error('[ClassroomStore] deleteLesson:', error);
      return { success: false, error };
    }
  };

  // ==================== Session ====================

  /** 开始课堂会话 */
  const startSession = async (lessonId) => {
    try {
      const res = await startClassroomSession(lessonId);
      if (res.code === 0 && res.data) {
        currentSession.value = res.data;
        messages.value = [];
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '开始课堂失败');
    } catch (error) {
      logger.error('[ClassroomStore] startSession:', error);
      return { success: false, error };
    }
  };

  /** 发送课堂消息 */
  const sendMessage = async (content, sessionId = null) => {
    try {
      const sid = sessionId || currentSession.value?.sessionId;
      const res = await sendClassroomMessage(sid, content);
      if (res.code === 0 && res.data) {
        messages.value.push(res.data);
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '发送消息失败');
    } catch (error) {
      logger.error('[ClassroomStore] sendMessage:', error);
      return { success: false, error };
    }
  };

  /** 结束课堂 */
  const endSession = async (sessionId = null) => {
    try {
      const sid = sessionId || currentSession.value?.sessionId;
      const res = await endClassroomSession(sid);
      if (res.code === 0) {
        currentSession.value = null;
        return { success: true, data: res.data };
      }
      throw new Error(res.message || '结束课堂失败');
    } catch (error) {
      logger.error('[ClassroomStore] endSession:', error);
      return { success: false, error };
    }
  };

  /** 重置会话状态 */
  const resetSession = () => {
    currentSession.value = null;
    messages.value = [];
  };

  /**
   * 重置 store 全部状态到初始值（Setup Store 手动实现）
   */
  const $reset = () => {
    lessons.value = [];
    currentSession.value = null;
    messages.value = [];
  };

  return {
    // state
    lessons,
    currentSession,
    messages,
    // getters
    isSessionActive,
    // actions
    fetchLessons,
    createLesson,
    fetchLessonStatus,
    deleteLesson,
    startSession,
    sendMessage,
    endSession,
    resetSession,
    $reset
  };
});
