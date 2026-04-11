/**
 * 学习计时器 composable（从 studyTimerMixin 迁移）
 * 提供学习时长的计时、恢复、保存、格式化等功能
 *
 * @module composables/useStudyTimer
 */
import { ref, onBeforeUnmount } from 'vue';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { today as getToday } from '@/utils/date.js';
import storageService from '@/services/storageService.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { toast } from '@/utils/toast.js';

export function useStudyTimer() {
  // ---- data → ref ----
  const todayStudyTime = ref(0);
  const studyTimerInterval = ref(null);
  const sessionStartTime = ref(null);

  // 内部变量（不需要暴露给模板）
  let _appHideHandler = null;

  // ---- methods → 普通函数 ----

  /**
   * 初始化学习计时器
   * 检查日期变化、恢复今日时长、补偿未保存时间
   */
  function initStudyTimer() {
    const savedDate = storageService.get('study_date');
    const today = getToday();

    if (savedDate !== today) {
      // 新的一天，重置今日时长
      todayStudyTime.value = 0;
      storageService.save('study_date', today);
      storageService.save('today_study_time', 0);
      storageService.remove('session_start_time');
      storageService.remove('last_active_time');
    } else {
      // 恢复今日时长（确保是数字类型）
      const savedTime = storageService.get('today_study_time');
      todayStudyTime.value = typeof savedTime === 'number' && savedTime >= 0 ? Math.floor(savedTime) : 0;

      // 检查是否有未保存的学习时间（应用异常退出时）
      const lastActiveTime = storageService.get('last_active_time');
      const savedSessionStart = storageService.get('session_start_time');
      if (lastActiveTime && savedSessionStart) {
        const unsavedMinutes = Math.floor((lastActiveTime - savedSessionStart) / 60000);
        if (unsavedMinutes > 0 && unsavedMinutes <= 5) {
          todayStudyTime.value += unsavedMinutes;
          logger.log('[useStudyTimer] 恢复未保存的学习时间:', unsavedMinutes, '分钟');
        }
        storageService.remove('last_active_time');
        storageService.remove('session_start_time');
      }
    }

    // 监听应用进入后台事件，保存当前时间
    if (_appHideHandler && typeof uni.offAppHide === 'function') {
      uni.offAppHide(_appHideHandler);
    }
    _appHideHandler = () => {
      if (sessionStartTime.value) {
        storageService.save('last_active_time', Date.now());
        saveStudyTime();
      }
    };
    uni.onAppHide && uni.onAppHide(_appHideHandler);

    logger.log('[useStudyTimer] 初始化完成，今日:', todayStudyTime.value, '分钟');
  }

  /**
   * 开始计时（恢复时长 + 监听刷题页面事件）
   */
  function startStudyTimer() {
    const savedTime = storageService.get('today_study_time');
    if (typeof savedTime === 'number' && savedTime >= 0) {
      todayStudyTime.value = Math.floor(savedTime);
    }

    logger.log('[useStudyTimer] 计时器状态检查，今日:', todayStudyTime.value, '分钟');
  }

  /**
   * 停止计时（清除定时器 + 保存时间 + 移除事件监听）
   */
  function stopStudyTimer() {
    if (studyTimerInterval.value) {
      clearInterval(studyTimerInterval.value);
      studyTimerInterval.value = null;
    }
    saveStudyTime();
    storageService.remove('session_start_time');
    storageService.remove('last_active_time');
    // 清理 onAppHide 监听
    if (_appHideHandler && uni.offAppHide) {
      uni.offAppHide(_appHideHandler);
      _appHideHandler = null;
    }
  }

  /**
   * 保存学习时长到本地存储
   */
  function saveStudyTime() {
    const timeToSave = Math.max(0, Math.floor(todayStudyTime.value || 0));
    storageService.save('today_study_time', timeToSave);
    storageService.save('study_date', getToday());
    logger.log('[useStudyTimer] 学习时长已保存:', timeToSave, '分钟');
  }

  /**
   * 格式化学习时长
   * @param {number} minutes - 分钟数
   * @returns {string} 格式化后的时长字符串
   */
  function formatStudyTime(minutes) {
    if (!minutes || minutes <= 0) {
      return '0 分钟';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  }

  /**
   * 今日学习时长点击处理 - 跳转到学习详情页
   */
  function handleStudyTimeClick() {
    try {
      if (typeof uni.vibrateShort === 'function') {
        uni.vibrateShort();
      }
    } catch (e) {
      logger.log('[useStudyTimer] 振动反馈失败:', e);
    }

    requireLogin(
      () =>
        safeNavigateTo('/pages/study-detail/index', {
          fail: (err) => {
            logger.error('[useStudyTimer] 跳转学习详情失败:', err);
            uni.switchTab({
              url: '/pages/profile/index',
              fail: () => {
                toast.info(`今日学习 ${formatStudyTime(todayStudyTime.value)}`);
              }
            });
          }
        }),
      { message: '请先登录后查看学习详情' }
    );
  }

  // ---- 组件卸载时自动清理（相当于 beforeDestroy） ----
  onBeforeUnmount(() => {
    stopStudyTimer();
  });

  // ---- 返回所有响应式数据和方法 ----
  return {
    // 响应式数据
    todayStudyTime,
    studyTimerInterval,
    sessionStartTime,
    // 方法
    initStudyTimer,
    startStudyTimer,
    stopStudyTimer,
    saveStudyTime,
    formatStudyTime,
    handleStudyTimeClick
  };
}

export default useStudyTimer;
