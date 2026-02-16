/**
 * 学习计时器 Composable
 * 解决检查点1.5：学习时长显示问题
 *
 * 功能：
 * 1. 实时计时（每分钟+1）
 * 2. 断线重连后累加
 * 3. 页面可见性检测
 * 4. 本地持久化
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// 存储键名
const STORAGE_KEYS = {
  TODAY_STUDY_TIME: 'today_study_time',
  STUDY_DATE: 'study_date',
  TOTAL_STUDY_TIME: 'total_study_time',
  SESSION_START: 'session_start_time',
  ACCUMULATED_TIME: 'accumulated_study_time'
};

/**
 * 学习计时器 Composable
 * @param {Object} options - 配置选项
 */
export function useStudyTimer(options = {}) {
  const {
    autoStart = true,
    syncInterval = 60000, // 同步间隔（毫秒）
    onMinuteUpdate = null,
    onSync = null
  } = options;

  // 响应式状态
  const todayStudyTime = ref(0); // 今日学习时长（分钟）
  const totalStudyTime = ref(0); // 总学习时长（分钟）
  const isRunning = ref(false);
  const sessionStartTime = ref(null);
  const lastSyncTime = ref(null);

  // 定时器引用
  let timerInterval = null;
  let syncTimeout = null;

  // 计算属性
  const formattedTodayTime = computed(() => {
    return formatTime(todayStudyTime.value);
  });

  const formattedTotalTime = computed(() => {
    return formatTime(totalStudyTime.value);
  });

  const todayHours = computed(() => {
    return Math.floor(todayStudyTime.value / 60);
  });

  const todayMinutes = computed(() => {
    return todayStudyTime.value % 60;
  });

  /**
   * 格式化时间
   * @param {number} minutes - 分钟数
   */
  function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  }

  /**
   * 初始化
   */
  function init() {
    // 检查日期是否变化
    const savedDate = storageService.get(STORAGE_KEYS.STUDY_DATE);
    const today = new Date().toISOString().split('T')[0];

    if (savedDate !== today) {
      // 新的一天，重置今日时长
      todayStudyTime.value = 0;
      storageService.save(STORAGE_KEYS.STUDY_DATE, today);
      storageService.save(STORAGE_KEYS.TODAY_STUDY_TIME, 0);
      logger.log('[StudyTimer] 新的一天，重置今日时长');
    } else {
      // 恢复今日时长
      todayStudyTime.value = storageService.get(STORAGE_KEYS.TODAY_STUDY_TIME, 0);
    }

    // 恢复总时长
    totalStudyTime.value = storageService.get(STORAGE_KEYS.TOTAL_STUDY_TIME, 0);

    // 检查是否有未完成的会话（断线重连）
    const savedSessionStart = storageService.get(STORAGE_KEYS.SESSION_START);
    if (savedSessionStart) {
      const elapsed = Math.floor((Date.now() - savedSessionStart) / 60000);
      if (elapsed > 0 && elapsed < 120) { // 最多补偿2小时
        logger.log('[StudyTimer] 断线重连，补偿时长:', elapsed, '分钟');
        todayStudyTime.value += elapsed;
        totalStudyTime.value += elapsed;
        saveProgress();
      }
    }

    logger.log('[StudyTimer] 初始化完成，今日:', todayStudyTime.value, '分钟');
  }

  /**
   * 开始计时
   */
  function start() {
    if (isRunning.value) return;

    isRunning.value = true;
    sessionStartTime.value = Date.now();

    // 保存会话开始时间（用于断线重连）
    storageService.save(STORAGE_KEYS.SESSION_START, sessionStartTime.value);

    // 启动定时器（每分钟更新）
    timerInterval = setInterval(() => {
      tick();
    }, 60000); // 1分钟

    // 启动同步定时器
    scheduleSyncTask();

    logger.log('[StudyTimer] 开始计时');
  }

  /**
   * 停止计时
   */
  function stop() {
    if (!isRunning.value) return;

    isRunning.value = false;

    // 清除定时器
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }

    // 计算本次会话时长
    if (sessionStartTime.value) {
      const sessionDuration = Math.floor((Date.now() - sessionStartTime.value) / 60000);
      logger.log('[StudyTimer] 本次会话时长:', sessionDuration, '分钟');
    }

    // 清除会话开始时间
    storageService.remove(STORAGE_KEYS.SESSION_START);
    sessionStartTime.value = null;

    // 保存进度
    saveProgress();

    logger.log('[StudyTimer] 停止计时');
  }

  /**
   * 计时器 tick
   */
  function tick() {
    todayStudyTime.value += 1;
    totalStudyTime.value += 1;

    // 触发回调
    if (onMinuteUpdate) {
      onMinuteUpdate(todayStudyTime.value);
    }

    // 保存进度
    saveProgress();

    logger.log('[StudyTimer] +1分钟，今日:', todayStudyTime.value);
  }

  /**
   * 保存进度
   */
  function saveProgress() {
    try {
      storageService.save(STORAGE_KEYS.TODAY_STUDY_TIME, todayStudyTime.value);
      storageService.save(STORAGE_KEYS.TOTAL_STUDY_TIME, totalStudyTime.value);
      storageService.save(STORAGE_KEYS.STUDY_DATE, new Date().toISOString().split('T')[0]);
    } catch (e) {
      console.error('[StudyTimer] 保存失败:', e);
    }
  }

  /**
   * 调度同步任务
   */
  function scheduleSyncTask() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(() => {
      syncToServer();
      scheduleSyncTask(); // 继续调度
    }, syncInterval);
  }

  /**
   * 同步到服务器
   */
  async function syncToServer() {
    lastSyncTime.value = Date.now();

    const syncData = {
      todayStudyTime: todayStudyTime.value,
      totalStudyTime: totalStudyTime.value,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };

    // 触发同步回调
    if (onSync) {
      try {
        await onSync(syncData);
        logger.log('[StudyTimer] 同步成功');
      } catch (e) {
        console.error('[StudyTimer] 同步失败:', e);
      }
    }

    // 发送全局事件
    uni.$emit('studyTime:sync', syncData);
  }

  /**
   * 处理页面可见性变化
   */
  function handleVisibilityChange() {
    // #ifdef H5
    if (document.hidden) {
      // 页面隐藏，暂停计时但保存状态
      if (isRunning.value) {
        storageService.save(STORAGE_KEYS.SESSION_START, sessionStartTime.value);
      }
    } else {
      // 页面显示，检查是否需要补偿时间
      const savedSessionStart = storageService.get(STORAGE_KEYS.SESSION_START);
      if (savedSessionStart && isRunning.value) {
        const elapsed = Math.floor((Date.now() - savedSessionStart) / 60000);
        const lastTick = Math.floor((Date.now() - (sessionStartTime.value || Date.now())) / 60000);
        const compensation = elapsed - lastTick;

        if (compensation > 0 && compensation < 30) { // 最多补偿30分钟
          todayStudyTime.value += compensation;
          totalStudyTime.value += compensation;
          saveProgress();
          logger.log('[StudyTimer] 页面恢复，补偿:', compensation, '分钟');
        }
      }
    }
    // #endif
  }

  /**
   * 手动添加时长
   * @param {number} minutes - 分钟数
   */
  function addTime(minutes) {
    if (minutes <= 0) return;

    todayStudyTime.value += minutes;
    totalStudyTime.value += minutes;
    saveProgress();

    logger.log('[StudyTimer] 手动添加:', minutes, '分钟');
  }

  /**
   * 重置今日时长
   */
  function resetToday() {
    todayStudyTime.value = 0;
    storageService.save(STORAGE_KEYS.TODAY_STUDY_TIME, 0);
    logger.log('[StudyTimer] 重置今日时长');
  }

  /**
   * 获取统计数据
   */
  function getStats() {
    return {
      todayStudyTime: todayStudyTime.value,
      totalStudyTime: totalStudyTime.value,
      isRunning: isRunning.value,
      sessionStartTime: sessionStartTime.value,
      lastSyncTime: lastSyncTime.value
    };
  }

  // 生命周期
  onMounted(() => {
    init();

    if (autoStart) {
      start();
    }

    // 监听页面可见性
    // #ifdef H5
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // #endif

    // 监听应用进入前台/后台
    uni.onAppShow(() => {
      if (autoStart && !isRunning.value) {
        start();
      }
    });

    uni.onAppHide(() => {
      // 保存当前状态
      if (isRunning.value) {
        storageService.save(STORAGE_KEYS.SESSION_START, sessionStartTime.value);
      }
    });
  });

  onUnmounted(() => {
    stop();

    // #ifdef H5
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    // #endif
  });

  return {
    // 状态
    todayStudyTime,
    totalStudyTime,
    isRunning,

    // 计算属性
    formattedTodayTime,
    formattedTotalTime,
    todayHours,
    todayMinutes,

    // 方法
    start,
    stop,
    addTime,
    resetToday,
    getStats,
    syncToServer
  };
}

export default useStudyTimer;
