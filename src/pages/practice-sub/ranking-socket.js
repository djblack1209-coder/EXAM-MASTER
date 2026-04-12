/**
 * 排行榜WebSocket实时推送服务
 * 检查点4.1: 排行榜实时更新
 *
 * 功能：
 * - WebSocket连接管理（自动重连、心跳检测）
 * - 排行榜数据实时推送
 * - 排名变化事件通知
 * - 自己位置变化监听
 */

import { logger } from '@/utils/logger.js';
import { ref, reactive, computed } from 'vue';
// P006: 从中央配置读取 WebSocket 地址
import config from '@/config/index.js';

// WebSocket连接状态
const WS_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// 消息类型
const MESSAGE_TYPE = {
  RANKING_UPDATE: 'ranking_update', // 排行榜更新
  POSITION_CHANGE: 'position_change', // 位置变化
  SCORE_UPDATE: 'score_update', // 分数更新
  HEARTBEAT: 'heartbeat', // 心跳
  SUBSCRIBE: 'subscribe', // 订阅
  UNSUBSCRIBE: 'unsubscribe' // 取消订阅
};

class RankingSocketService {
  constructor() {
    this.socket = null;
    this.state = ref(WS_STATE.CLOSED);
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;
    this.manualClose = false;
    this._lastConnectOptions = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000;

    // 排行榜数据
    this.rankingData = reactive({
      list: [],
      total: 0,
      lastUpdate: null,
      type: 'daily' // daily, weekly, monthly, total
    });

    // 当前用户位置信息
    this.selfPosition = reactive({
      rank: 0,
      score: 0,
      previousRank: 0,
      change: 0, // 正数上升，负数下降
      highlighted: false
    });

    // 事件监听器
    this.listeners = new Map();

    // WebSocket服务器地址
    this.wsUrl = this._getWebSocketUrl();
  }

  /**
   * 获取WebSocket服务器地址
   */
  _getWebSocketUrl() {
    // P006: 从中央配置读取 WebSocket 地址
    const isDev = process.env.NODE_ENV === 'development';
    return isDev ? config.websocket.devUrl : config.websocket.prodUrl;
  }

  /**
   * 连接WebSocket
   * @param {Object} options - 连接选项
   * @param {string} [options.userId] - 用户ID
   * @param {string} [options.rankType] - 排行榜类型
   */
  connect(options = {}) {
    const { userId = '', rankType = 'daily' } = options;

    this.manualClose = false;

    // WebSocket 地址未配置时静默降级，不尝试连接
    if (!this.wsUrl) {
      logger.log('[RankingSocket] WebSocket 地址未配置，跳过连接（降级为 HTTP 轮询模式）');
      return Promise.reject(new Error('WebSocket 地址未配置，降级为普通模式'));
    }

    if (!userId) {
      return Promise.reject(new Error('连接失败：缺少 userId'));
    }

    // 保存连接参数，用于重连时恢复上下文
    if (userId) this._lastConnectOptions = options;

    if (this.socket && this.state.value === WS_STATE.OPEN) {
      logger.log('[RankingSocket] Already connected');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        // 构建连接URL（参数编码防止注入）
        const url = `${this.wsUrl}?userId=${encodeURIComponent(userId)}&type=${encodeURIComponent(rankType)}`;

        // #ifdef H5
        this.socket = new WebSocket(url);
        // #endif

        // #ifdef MP-WEIXIN || APP-PLUS
        this.socket = uni.connectSocket({
          url,
          complete: () => {
            /* noop */
          }
        });
        // #endif

        this.state.value = WS_STATE.CONNECTING;

        this._setupEventHandlers(resolve, reject);
      } catch (error) {
        logger.error('[RankingSocket] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * 设置事件处理器
   */
  _setupEventHandlers(resolve, reject) {
    // #ifdef H5
    this.socket.onopen = () => {
      this._onOpen();
      resolve();
    };

    this.socket.onmessage = (event) => {
      this._onMessage(event.data);
    };

    this.socket.onclose = (event) => {
      this._onClose(event);
    };

    this.socket.onerror = (error) => {
      this._onError(error);
      reject(error);
    };
    // #endif

    // #ifdef MP-WEIXIN || APP-PLUS
    this.socket.onOpen(() => {
      this._onOpen();
      resolve();
    });

    this.socket.onMessage((res) => {
      this._onMessage(res.data);
    });

    this.socket.onClose((event) => {
      this._onClose(event);
    });

    this.socket.onError((error) => {
      this._onError(error);
      reject(error);
    });
    // #endif
  }

  /**
   * 连接成功处理
   */
  _onOpen() {
    logger.log('[RankingSocket] Connected');
    this.state.value = WS_STATE.OPEN;
    this.reconnectAttempts = 0;

    // 启动心跳
    this._startHeartbeat();

    // 触发连接事件
    this._emit('connected');
  }

  /**
   * 消息处理
   */
  _onMessage(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      switch (message.type) {
        case MESSAGE_TYPE.RANKING_UPDATE:
          this._handleRankingUpdate(message.data);
          break;

        case MESSAGE_TYPE.POSITION_CHANGE:
          this._handlePositionChange(message.data);
          break;

        case MESSAGE_TYPE.SCORE_UPDATE:
          this._handleScoreUpdate(message.data);
          break;

        case MESSAGE_TYPE.HEARTBEAT:
          // 心跳响应，重置超时
          this._resetHeartbeatTimeout();
          break;

        default:
          logger.log('[RankingSocket] Unknown message type:', message.type);
      }

      // 触发原始消息事件
      this._emit('message', message);
    } catch (error) {
      logger.error('[RankingSocket] Message parse error:', error);
    }
  }

  /**
   * 处理排行榜更新
   */
  _handleRankingUpdate(data) {
    const { list, total, type } = data;

    // 更新排行榜数据
    this.rankingData.list = list || [];
    this.rankingData.total = total || 0;
    this.rankingData.type = type || 'daily';
    this.rankingData.lastUpdate = Date.now();

    // 触发更新事件
    this._emit('rankingUpdate', this.rankingData);

    logger.log('[RankingSocket] Ranking updated:', {
      count: list?.length,
      type
    });
  }

  /**
   * 处理位置变化
   */
  _handlePositionChange(data) {
    const { rank, previousRank, score, userId } = data;

    // 更新自己的位置
    this.selfPosition.previousRank = this.selfPosition.rank || previousRank;
    this.selfPosition.rank = rank;
    this.selfPosition.score = score;
    this.selfPosition.change = this.selfPosition.previousRank - rank;
    this.selfPosition.highlighted = true;

    // 3秒后取消高亮
    setTimeout(() => {
      this.selfPosition.highlighted = false;
    }, 3000);

    // 触发位置变化事件
    this._emit('positionChange', {
      ...this.selfPosition,
      userId
    });

    logger.log('[RankingSocket] Position changed:', {
      from: previousRank,
      to: rank,
      change: this.selfPosition.change
    });
  }

  /**
   * 处理分数更新
   */
  _handleScoreUpdate(data) {
    const { userId, score, delta } = data;

    // 更新列表中对应用户的分数
    const userIndex = this.rankingData.list.findIndex((item) => item.userId === userId);
    if (userIndex !== -1) {
      this.rankingData.list[userIndex].score = score;
    }

    // 触发分数更新事件
    this._emit('scoreUpdate', { userId, score, delta });
  }

  /**
   * 连接关闭处理
   */
  _onClose(event) {
    logger.log('[RankingSocket] Disconnected:', event?.code, event?.reason);
    this.state.value = WS_STATE.CLOSED;

    // 停止心跳
    this._stopHeartbeat();

    // 触发断开事件
    this._emit('disconnected', event);

    // 尝试重连
    if (!this.manualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }

  /**
   * 错误处理
   */
  _onError(error) {
    logger.error('[RankingSocket] Error:', error);
    this._emit('error', error);
  }

  /**
   * 启动心跳
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.state.value === WS_STATE.OPEN) {
        this.send({
          type: MESSAGE_TYPE.HEARTBEAT,
          timestamp: Date.now()
        });
      }
    }, this.heartbeatTimeout / 2);
  }

  /**
   * 停止心跳
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this._heartbeatTimeoutTimer) {
      clearTimeout(this._heartbeatTimeoutTimer);
      this._heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 重置心跳超时
   */
  _resetHeartbeatTimeout() {
    // 清除旧的超时检测定时器
    if (this._heartbeatTimeoutTimer) {
      clearTimeout(this._heartbeatTimeoutTimer);
    }
    // 如果在 heartbeatTimeout 时间内没有收到 pong，视为连接断开
    this._heartbeatTimeoutTimer = setTimeout(() => {
      logger.warn('[RankingSocket] Heartbeat timeout, connection may be dead');
      this._onClose({ code: 4000, reason: 'heartbeat_timeout' });
    }, this.heartbeatTimeout);
  }

  /**
   * 计划重连
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.log(`[RankingSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualClose && this.state.value === WS_STATE.CLOSED && this._lastConnectOptions?.userId) {
        this.connect(this._lastConnectOptions);
      }
    }, delay);
  }

  /**
   * 发送消息
   */
  send(data) {
    if (this.state.value !== WS_STATE.OPEN) {
      logger.warn('[RankingSocket] Cannot send, not connected');
      return false;
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);

    // #ifdef H5
    this.socket.send(message);
    // #endif

    // #ifdef MP-WEIXIN || APP-PLUS
    this.socket.send({ data: message });
    // #endif

    return true;
  }

  /**
   * 订阅排行榜类型
   */
  subscribe(rankType) {
    return this.send({
      type: MESSAGE_TYPE.SUBSCRIBE,
      data: { rankType }
    });
  }

  /**
   * 取消订阅
   */
  unsubscribe(rankType) {
    return this.send({
      type: MESSAGE_TYPE.UNSUBSCRIBE,
      data: { rankType }
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.manualClose = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this._stopHeartbeat();

    if (this.socket) {
      this.state.value = WS_STATE.CLOSING;

      // #ifdef H5
      this.socket.close();
      // #endif

      // #ifdef MP-WEIXIN || APP-PLUS
      this.socket.close({});
      // #endif

      this.socket = null;
    }

    this.state.value = WS_STATE.CLOSED;
  }

  /**
   * 添加事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // 返回取消监听函数
    return () => this.off(event, callback);
  }

  /**
   * 移除事件监听
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * 触发事件
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`[RankingSocket] Event handler error (${event}):`, error);
        }
      });
    }
  }

  /**
   * 获取连接状态
   */
  get isConnected() {
    return this.state.value === WS_STATE.OPEN;
  }

  /**
   * 获取排行榜数据
   */
  getRankingData() {
    return this.rankingData;
  }

  /**
   * 获取自己的位置信息
   */
  getSelfPosition() {
    return this.selfPosition;
  }
}

// 单例导出
export const rankingSocket = new RankingSocketService();

// 导出类供测试使用
export { RankingSocketService, WS_STATE, MESSAGE_TYPE };

// Vue组合式API Hook
export function useRankingSocket() {
  const isConnected = computed(() => rankingSocket.isConnected);
  const rankingData = computed(() => rankingSocket.getRankingData());
  const selfPosition = computed(() => rankingSocket.getSelfPosition());

  return {
    // 状态
    isConnected,
    rankingData,
    selfPosition,

    // 方法
    connect: (options) => rankingSocket.connect(options),
    disconnect: () => rankingSocket.disconnect(),
    subscribe: (type) => rankingSocket.subscribe(type),
    unsubscribe: (type) => rankingSocket.unsubscribe(type),
    on: (event, callback) => rankingSocket.on(event, callback),
    off: (event, callback) => rankingSocket.off(event, callback)
  };
}
