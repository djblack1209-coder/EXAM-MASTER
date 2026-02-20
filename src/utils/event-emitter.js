/**
 * 简易事件发射器混入
 *
 * 从 checkin-streak.js / achievement-engine.js / streak-recovery.js / practice-sub/ranking-socket.js
 * 中提取的公共事件系统，消除 4 处重复实现。
 *
 * 用法（在 class 中混入）：
 *   import { mixinEventEmitter } from '@/utils/event-emitter.js';
 *   class MyService { constructor() { mixinEventEmitter(this); } }
 *   // 之后可使用 this.on() / this.off() / this._emit()
 *
 * 或直接继承：
 *   import { SimpleEventEmitter } from '@/utils/event-emitter.js';
 *   class MyService extends SimpleEventEmitter { ... }
 *
 * @module utils/event-emitter
 */

import { logger } from './logger.js';

export class SimpleEventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * 添加事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 要移除的回调函数
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  /**
   * 触发事件，安全地调用所有监听器
   * @param {string} event - 事件名称
   * @param {*} data - 传递给监听器的数据
   */
  _emit(event, data) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          logger.error(`[EventEmitter] Handler error for "${event}":`, e);
        }
      });
    }
  }
}

/**
 * 将事件发射器方法混入到已有实例上
 * 适用于不方便改继承链的场景
 * @param {Object} target - 目标对象
 */
export function mixinEventEmitter(target) {
  const emitter = new SimpleEventEmitter();
  target.on = emitter.on.bind(emitter);
  target.off = emitter.off.bind(emitter);
  target._emit = emitter._emit.bind(emitter);
  // 暴露内部 listeners 以便子类访问（兼容旧代码中 this.listeners 的引用）
  target.listeners = emitter._listeners;
}

export default SimpleEventEmitter;
