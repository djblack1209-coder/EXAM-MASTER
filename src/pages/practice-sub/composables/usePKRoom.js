/**
 * 实时PK房间管理 composable
 * 基于Laf云函数轮询实现轻量级实时对战
 */
import { ref, onUnmounted } from 'vue';
import { pkBattle } from '@/services/api/domains/social.api.js';
import { logger } from '@/utils/logger.js';

const POLL_INTERVAL = 1000; // 1秒轮询

export function usePKRoom() {
  const roomId = ref(null);
  const roomStatus = ref('idle'); // idle, matching, ready, playing, finished, timeout
  const myRole = ref(null); // player1 | player2
  const me = ref(null);
  const opponent = ref(null);
  const questions = ref([]);
  const questionCount = ref(5);
  const isPolling = ref(false);
  const error = ref(null);

  let pollTimer = null;

  /**
   * 发起匹配
   */
  async function findMatch(category = '综合', count = 5) {
    error.value = null;
    roomStatus.value = 'matching';

    try {
      const res = await pkBattle({
        action: 'find_match',
        category,
        questionCount: count
      });

      if (res?.code !== 0 || !res.data) {
        error.value = res?.message || '匹配失败';
        roomStatus.value = 'idle';
        return false;
      }

      roomId.value = res.data.room_id;
      myRole.value = res.data.role;
      roomStatus.value = res.data.status;
      questionCount.value = res.data.question_count || count;

      if (res.data.player1) me.value = res.data.role === 'player1' ? res.data.player1 : res.data.player2;
      if (res.data.player2) opponent.value = res.data.role === 'player1' ? res.data.player2 : res.data.player1;
      if (res.data.questions) questions.value = res.data.questions;

      // 开始轮询
      startPolling();
      return true;
    } catch (e) {
      logger.error('[PKRoom] 匹配失败:', e);
      error.value = '网络错误，请重试';
      roomStatus.value = 'idle';
      return false;
    }
  }

  /**
   * 提交单题答案
   */
  async function submitAnswer(questionIndex, answer, duration = 0) {
    if (!roomId.value) return null;

    try {
      const res = await pkBattle({
        action: 'room_answer',
        room_id: roomId.value,
        question_index: questionIndex,
        answer,
        duration
      });

      if (res?.code === 0 && res.data) {
        return res.data;
      }
      return null;
    } catch (e) {
      logger.warn('[PKRoom] 提交答案失败:', e);
      return null;
    }
  }

  /**
   * 离开房间
   */
  async function leaveRoom() {
    stopPolling();
    if (roomId.value) {
      try {
        await pkBattle({
          action: 'leave_room',
          room_id: roomId.value
        });
      } catch (_e) {
        /* silent */
      }
    }
    resetState();
  }

  /**
   * 轮询房间状态
   */
  function startPolling() {
    if (isPolling.value) return;
    isPolling.value = true;

    pollTimer = setInterval(async () => {
      if (!roomId.value) return;

      try {
        const res = await pkBattle({
          action: 'poll_room',
          room_id: roomId.value
        });

        if (res?.code !== 0 || !res.data) return;

        const data = res.data;
        roomStatus.value = data.status;

        if (data.me) me.value = data.me;
        if (data.opponent) opponent.value = data.opponent;
        if (data.questions && data.questions.length > 0) questions.value = data.questions;

        // 房间结束或超时，停止轮询
        if (data.status === 'finished' || data.status === 'timeout' || data.status === 'expired') {
          stopPolling();
        }
      } catch (e) {
        logger.warn('[PKRoom] 轮询失败:', e);
      }
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    isPolling.value = false;
  }

  function resetState() {
    roomId.value = null;
    roomStatus.value = 'idle';
    myRole.value = null;
    me.value = null;
    opponent.value = null;
    questions.value = [];
    error.value = null;
  }

  onUnmounted(() => {
    stopPolling();
  });

  return {
    roomId,
    roomStatus,
    myRole,
    me,
    opponent,
    questions,
    questionCount,
    isPolling,
    error,
    findMatch,
    submitAnswer,
    leaveRoom,
    stopPolling
  };
}
