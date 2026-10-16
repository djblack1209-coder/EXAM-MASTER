/**
 * global-error-handler 单元测试
 * 覆盖错误提取、去重、持久化、手动上报
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('globalErrorHandler', () => {
  beforeEach(() => {
    globalErrorHandler.clearErrorLogs();
    vi.clearAllMocks();
  });

  describe('report', () => {
    it('应记录 Error 对象', () => {
      const err = new Error('test error');
      globalErrorHandler.report('Test', err);
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('Application Error');
      expect(logs[0].message).toBe('应用操作失败');
      expect(logs[0].stack).toBe('');
    });

    it('应记录字符串错误', () => {
      globalErrorHandler.report('Runtime', 'something broke');
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('应用操作失败');
    });

    it('应记录对象错误（errMsg）', () => {
      globalErrorHandler.report('API', { errMsg: 'request:fail' });
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs[0].message).toBe('应用操作失败');
    });

    it('应记录对象错误（message）', () => {
      globalErrorHandler.report('API', { message: 'timeout' });
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs[0].message).toBe('应用操作失败');
    });

    it('null 应记录为 Unknown error', () => {
      globalErrorHandler.report('NullTest', null);
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const nullLog = logs.at(-1);
      expect(nullLog.message).toBe('应用操作失败');
    });

    it('undefined 应记录为 Unknown error', () => {
      globalErrorHandler.report('UndefTest', undefined);
      const logs = globalErrorHandler.getErrorLogs();
      const undefLog = logs.at(-1);
      expect(undefLog.message).toBe('应用操作失败');
    });

    it('应包含页面信息和时间戳', () => {
      globalErrorHandler.report('Test', 'err');
      const log = globalErrorHandler.getErrorLogs()[0];
      expect(log.page).toBeDefined();
      expect(log.timestamp).toBeDefined();
      expect(new Date(log.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('应持久化到 uni storage', () => {
      globalErrorHandler.report('Test', 'persist me');
      const stored = uni.getStorageSync('runtime_errors');
      expect(stored).toHaveLength(1);
      expect(stored[0].message).toBe('应用操作失败');
    });
  });

  describe('去重', () => {
    it('5秒内相同错误应只记录一次', () => {
      globalErrorHandler.report('Test', 'duplicate');
      globalErrorHandler.report('Test', 'duplicate');
      globalErrorHandler.report('Test', 'duplicate');
      expect(globalErrorHandler.getErrorLogs()).toHaveLength(1);
    });

    it('不同类型的相同消息不应去重', () => {
      globalErrorHandler.report('TypeA', 'same message');
      globalErrorHandler.report('TypeB', 'same message');
      expect(globalErrorHandler.getErrorLogs()).toHaveLength(2);
    });

    it('不同消息不应去重', () => {
      globalErrorHandler.report('Test', 'error 1');
      globalErrorHandler.report('Test', 'error 2');
      expect(globalErrorHandler.getErrorLogs()).toHaveLength(2);
    });
  });

  describe('init', () => {
    it('应接受 ignorePatterns 配置', () => {
      globalErrorHandler.init({
        ignorePatterns: [/Script error/i, /ResizeObserver/]
      });

      globalErrorHandler.report('Test', 'Script error.');
      globalErrorHandler.report('Test', 'ResizeObserver loop limit exceeded');
      globalErrorHandler.report('Test', 'real error');

      expect(globalErrorHandler.getErrorLogs()).toHaveLength(1);
      expect(globalErrorHandler.getErrorLogs()[0].message).toBe('应用操作失败');
    });

    it('应接受 onError 回调', () => {
      const onError = vi.fn();
      globalErrorHandler.init({ onError });

      globalErrorHandler.report('Test', 'callback test');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: '应用操作失败' }));
    });
  });

  describe('createVueErrorHandler', () => {
    it('应返回函数', () => {
      const handler = globalErrorHandler.createVueErrorHandler();
      expect(typeof handler).toBe('function');
    });

    it('调用后应记录 Vue Error', () => {
      const handler = globalErrorHandler.createVueErrorHandler();
      handler(new Error('vue error'), null, 'mounted');
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('Vue Error');
      expect(logs[0].message).toBe('应用操作失败');
    });
  });

  describe('getErrorLogs / clearErrorLogs', () => {
    it('getErrorLogs 应返回副本', () => {
      globalErrorHandler.report('Test', 'err1');
      const logs = globalErrorHandler.getErrorLogs();
      logs.push({ fake: true });
      expect(globalErrorHandler.getErrorLogs()).toHaveLength(1);
    });

    it('clearErrorLogs 应清空内存和存储', () => {
      globalErrorHandler.report('ClearTest', 'clear_err1');
      globalErrorHandler.report('ClearTest', 'clear_err2');
      expect(globalErrorHandler.getErrorLogs().length).toBeGreaterThanOrEqual(2);

      globalErrorHandler.clearErrorLogs();
      expect(globalErrorHandler.getErrorLogs()).toHaveLength(0);
      expect(uni.removeStorageSync).toHaveBeenCalledWith('runtime_errors');
    });
  });

  describe('内存日志上限', () => {
    it('超过50条应丢弃最早的', () => {
      // 先清空去重缓存（每条用不同消息）
      const entries = [];
      for (let i = 0; i < 55; i++) {
        globalErrorHandler.report('Test', `error_${i}`);
        entries.push(globalErrorHandler.getErrorLogs().at(-1));
      }
      const logs = globalErrorHandler.getErrorLogs();
      expect(logs.length).toBeLessThanOrEqual(50);
      // 最早的应该被丢弃
      expect(logs[0]).toBe(entries[5]);
    });
  });
});
