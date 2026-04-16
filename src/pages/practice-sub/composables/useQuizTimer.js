/**
 * 刷题计时器 Composable
 *
 * 封装总计时、单题倒计时、休息提醒、答题耗时统计等计时相关逻辑。
 * 从 do-quiz.vue Options API 提取，供 <script setup> 迁移使用。
 *
 * @module composables/useQuizTimer
 * @example
 *   const timer = useQuizTimer();
 *   timer.startTotalTimer();
 *   timer.startQuestionCountdown(30, () => handleTimeout());
 *   timer.markAnswerStart();
 *   const ms = timer.getAnswerDuration();
 */

import { ref, onUnmounted } from 'vue';

/** 休息提醒触发间隔（秒）—— 45 分钟 */
const BREAK_REMINDER_INTERVAL = 2700;

/** 单题倒计时警告阈值（秒） */
const TIME_WARNING_THRESHOLD = 10;

/**
 * 刷题计时器 composable
 *
 * @returns {{
 *   seconds: import('vue').Ref<number>,
 *   questionTimeLimit: import('vue').Ref<number>,
 *   questionTimeRemaining: import('vue').Ref<number>,
 *   showTimeWarning: import('vue').Ref<boolean>,
 *   questionTimerEnabled: import('vue').Ref<boolean>,
 *   showBreakReminder: import('vue').Ref<boolean>,
 *   breakReminderShown: import('vue').Ref<boolean>,
 *   answerStartTime: import('vue').Ref<number>,
 *   startTotalTimer: () => void,
 *   stopTotalTimer: () => void,
 *   formatTime: (totalSeconds: number) => string,
 *   startQuestionCountdown: (timeLimit: number, onTimeout?: () => void) => void,
 *   stopQuestionCountdown: () => void,
 *   markAnswerStart: () => void,
 *   getAnswerDuration: () => number,
 *   dismissBreakReminder: () => void,
 *   cleanup: () => void,
 * }}
 */
export function useQuizTimer() {
  // ---- 响应式状态 ----

  /** 总计时（秒） */
  const seconds = ref(0);

  /** 单题时限（秒） */
  const questionTimeLimit = ref(0);

  /** 单题剩余时间（秒） */
  const questionTimeRemaining = ref(0);

  /** 是否显示时间警告（剩余 ≤ 10 秒） */
  const showTimeWarning = ref(false);

  /** 是否启用单题计时 */
  const questionTimerEnabled = ref(false);

  /** 是否显示休息提醒弹窗 */
  const showBreakReminder = ref(false);

  /** 本次会话是否已触发过休息提醒 */
  const breakReminderShown = ref(false);

  /** 当前题目的答题开始时间戳（毫秒） */
  const answerStartTime = ref(0);

  // ---- 内部定时器 ID ----

  /** @type {ReturnType<typeof setInterval>|null} 总计时器 ID */
  let totalTimerId = null;

  /** @type {ReturnType<typeof setInterval>|null} 单题倒计时器 ID */
  let questionTimerId = null;

  // ---- 方法 ----

  /**
   * 启动总计时器
   * 每秒累加；每 45 分钟触发一次休息提醒
   */
  function startTotalTimer() {
    // 先清除已有计时器，防止重复启动
    if (totalTimerId !== null) {
      clearInterval(totalTimerId);
    }

    totalTimerId = setInterval(() => {
      seconds.value++;

      // 每 45 分钟提醒一次休息，且本轮只提醒一次
      if (seconds.value > 0 && seconds.value % BREAK_REMINDER_INTERVAL === 0 && !breakReminderShown.value) {
        showBreakReminder.value = true;
        breakReminderShown.value = true;
      }
    }, 1000);
  }

  /** 停止总计时器 */
  function stopTotalTimer() {
    if (totalTimerId !== null) {
      clearInterval(totalTimerId);
      totalTimerId = null;
    }
  }

  /**
   * 将秒数格式化为 MM:SS 字符串
   *
   * @param {number} totalSeconds - 总秒数
   * @returns {string} 格式化后的时间，如 "03:45"
   */
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * 启动单题倒计时
   *
   * @param {number} timeLimit - 时限（秒）
   * @param {() => void} [onTimeout] - 超时回调（倒计时归零时调用）
   */
  function startQuestionCountdown(timeLimit, onTimeout) {
    // 清除已有的单题倒计时
    stopQuestionCountdown();

    questionTimeLimit.value = timeLimit;
    questionTimeRemaining.value = timeLimit;
    questionTimerEnabled.value = true;
    showTimeWarning.value = false;

    questionTimerId = setInterval(() => {
      questionTimeRemaining.value--;

      // 剩余 ≤ 10 秒：显示警告
      if (questionTimeRemaining.value <= TIME_WARNING_THRESHOLD) {
        showTimeWarning.value = true;
      }

      // 倒计时归零：停止计时并触发超时回调
      if (questionTimeRemaining.value <= 0) {
        stopQuestionCountdown();
        if (typeof onTimeout === 'function') {
          onTimeout();
        }
      }
    }, 1000);
  }

  /** 停止单题倒计时 */
  function stopQuestionCountdown() {
    if (questionTimerId !== null) {
      clearInterval(questionTimerId);
      questionTimerId = null;
    }
    questionTimerEnabled.value = false;
    showTimeWarning.value = false;
  }

  /** 标记当前题目的答题开始时间 */
  function markAnswerStart() {
    answerStartTime.value = Date.now();
  }

  /**
   * 获取当前题目的答题耗时
   *
   * @returns {number} 答题耗时（毫秒）
   */
  function getAnswerDuration() {
    return Date.now() - answerStartTime.value;
  }

  /** 关闭休息提醒弹窗 */
  function dismissBreakReminder() {
    showBreakReminder.value = false;
  }

  /** 清除所有定时器（总计时 + 单题倒计时） */
  function cleanup() {
    stopTotalTimer();
    stopQuestionCountdown();
  }

  // 组件卸载时自动清理，防止内存泄漏
  onUnmounted(cleanup);

  return {
    // 响应式状态
    seconds,
    questionTimeLimit,
    questionTimeRemaining,
    showTimeWarning,
    questionTimerEnabled,
    showBreakReminder,
    breakReminderShown,
    answerStartTime,

    // 方法
    startTotalTimer,
    stopTotalTimer,
    formatTime,
    startQuestionCountdown,
    stopQuestionCountdown,
    markAnswerStart,
    getAnswerDuration,
    dismissBreakReminder,
    cleanup
  };
}
