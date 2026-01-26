/**
 * 学习计时器同步 Worker
 * 解决检查点1.5：学习时长断线重连后累加问题
 * 
 * 功能：
 * 1. 后台计时
 * 2. 定期同步
 * 3. 断线重连处理
 * 4. 数据持久化
 * 
 * 注意：小程序环境不支持 Web Worker，此文件用于 H5/APP 环境
 * 小程序环境使用 study-timer-composable.js 的内置逻辑
 */

// Worker 消息类型
const MESSAGE_TYPES = {
  START: 'start',
  STOP: 'stop',
  TICK: 'tick',
  SYNC: 'sync',
  GET_STATE: 'get_state',
  SET_STATE: 'set_state',
  RECONNECT: 'reconnect'
};

// 状态
let state = {
  isRunning: false,
  todayStudyTime: 0,
  totalStudyTime: 0,
  sessionStartTime: null,
  lastTickTime: null,
  lastSyncTime: null,
  studyDate: null
};

// 定时器
let tickInterval = null;
let syncInterval = null;

// 配置
const CONFIG = {
  TICK_INTERVAL: 60000, // 1分钟
  SYNC_INTERVAL: 300000, // 5分钟
  MAX_OFFLINE_COMPENSATION: 120 // 最大离线补偿（分钟）
};

/**
 * 初始化 Worker
 */
function init() {
  console.log('[TimerWorker] 初始化');
  
  // 检查日期变化
  const today = new Date().toISOString().split('T')[0];
  if (state.studyDate !== today) {
    state.todayStudyTime = 0;
    state.studyDate = today;
  }
}

/**
 * 开始计时
 */
function start() {
  if (state.isRunning) return;
  
  state.isRunning = true;
  state.sessionStartTime = Date.now();
  state.lastTickTime = Date.now();
  
  // 启动 tick 定时器
  tickInterval = setInterval(() => {
    tick();
  }, CONFIG.TICK_INTERVAL);
  
  // 启动同步定时器
  syncInterval = setInterval(() => {
    sync();
  }, CONFIG.SYNC_INTERVAL);
  
  console.log('[TimerWorker] 开始计时');
  
  // 通知主线程
  postMessage({
    type: MESSAGE_TYPES.START,
    state: getState()
  });
}

/**
 * 停止计时
 */
function stop() {
  if (!state.isRunning) return;
  
  state.isRunning = false;
  
  // 清除定时器
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  // 计算最后一次 tick 到现在的时间
  if (state.lastTickTime) {
    const elapsed = Math.floor((Date.now() - state.lastTickTime) / 60000);
    if (elapsed > 0) {
      state.todayStudyTime += elapsed;
      state.totalStudyTime += elapsed;
    }
  }
  
  state.sessionStartTime = null;
  state.lastTickTime = null;
  
  console.log('[TimerWorker] 停止计时');
  
  // 通知主线程
  postMessage({
    type: MESSAGE_TYPES.STOP,
    state: getState()
  });
}

/**
 * 计时 tick
 */
function tick() {
  state.todayStudyTime += 1;
  state.totalStudyTime += 1;
  state.lastTickTime = Date.now();
  
  console.log('[TimerWorker] Tick, 今日:', state.todayStudyTime);
  
  // 通知主线程
  postMessage({
    type: MESSAGE_TYPES.TICK,
    state: getState()
  });
}

/**
 * 同步数据
 */
function sync() {
  state.lastSyncTime = Date.now();
  
  console.log('[TimerWorker] 同步数据');
  
  // 通知主线程进行同步
  postMessage({
    type: MESSAGE_TYPES.SYNC,
    state: getState()
  });
}

/**
 * 处理断线重连
 * @param {Object} savedState - 保存的状态
 */
function handleReconnect(savedState) {
  if (!savedState) return;
  
  const now = Date.now();
  
  // 恢复状态
  state.todayStudyTime = savedState.todayStudyTime || 0;
  state.totalStudyTime = savedState.totalStudyTime || 0;
  state.studyDate = savedState.studyDate;
  
  // 检查日期变化
  const today = new Date().toISOString().split('T')[0];
  if (state.studyDate !== today) {
    state.todayStudyTime = 0;
    state.studyDate = today;
  }
  
  // 计算离线时间补偿
  if (savedState.sessionStartTime && savedState.lastTickTime) {
    const offlineMinutes = Math.floor((now - savedState.lastTickTime) / 60000);
    
    if (offlineMinutes > 0 && offlineMinutes <= CONFIG.MAX_OFFLINE_COMPENSATION) {
      state.todayStudyTime += offlineMinutes;
      state.totalStudyTime += offlineMinutes;
      
      console.log('[TimerWorker] 离线补偿:', offlineMinutes, '分钟');
    }
  }
  
  console.log('[TimerWorker] 重连完成，今日:', state.todayStudyTime);
  
  // 通知主线程
  postMessage({
    type: MESSAGE_TYPES.RECONNECT,
    state: getState(),
    compensation: savedState.lastTickTime 
      ? Math.min(
          Math.floor((now - savedState.lastTickTime) / 60000),
          CONFIG.MAX_OFFLINE_COMPENSATION
        )
      : 0
  });
}

/**
 * 获取当前状态
 */
function getState() {
  return {
    isRunning: state.isRunning,
    todayStudyTime: state.todayStudyTime,
    totalStudyTime: state.totalStudyTime,
    sessionStartTime: state.sessionStartTime,
    lastTickTime: state.lastTickTime,
    lastSyncTime: state.lastSyncTime,
    studyDate: state.studyDate
  };
}

/**
 * 设置状态
 * @param {Object} newState - 新状态
 */
function setState(newState) {
  if (newState.todayStudyTime !== undefined) {
    state.todayStudyTime = newState.todayStudyTime;
  }
  if (newState.totalStudyTime !== undefined) {
    state.totalStudyTime = newState.totalStudyTime;
  }
  if (newState.studyDate !== undefined) {
    state.studyDate = newState.studyDate;
  }
  
  console.log('[TimerWorker] 状态已更新');
}

// 监听主线程消息
self.onmessage = function(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case MESSAGE_TYPES.START:
      start();
      break;
      
    case MESSAGE_TYPES.STOP:
      stop();
      break;
      
    case MESSAGE_TYPES.GET_STATE:
      postMessage({
        type: MESSAGE_TYPES.GET_STATE,
        state: getState()
      });
      break;
      
    case MESSAGE_TYPES.SET_STATE:
      setState(data);
      postMessage({
        type: MESSAGE_TYPES.SET_STATE,
        state: getState()
      });
      break;
      
    case MESSAGE_TYPES.RECONNECT:
      handleReconnect(data);
      break;
      
    default:
      console.warn('[TimerWorker] 未知消息类型:', type);
  }
};

// 初始化
init();

console.log('[TimerWorker] Worker 已启动');

/**
 * 使用示例（主线程）：
 * 
 * // 创建 Worker
 * const timerWorker = new Worker('/utils/timer-sync-worker.js');
 * 
 * // 监听消息
 * timerWorker.onmessage = (event) => {
 *   const { type, state, compensation } = event.data;
 *   
 *   switch (type) {
 *     case 'tick':
 *       console.log('今日学习时长:', state.todayStudyTime);
 *       break;
 *     case 'sync':
 *       // 同步到服务器
 *       syncToServer(state);
 *       break;
 *     case 'reconnect':
 *       console.log('重连补偿:', compensation, '分钟');
 *       break;
 *   }
 * };
 * 
 * // 开始计时
 * timerWorker.postMessage({ type: 'start' });
 * 
 * // 停止计时
 * timerWorker.postMessage({ type: 'stop' });
 * 
 * // 断线重连
 * timerWorker.postMessage({ 
 *   type: 'reconnect', 
 *   data: savedState 
 * });
 */
