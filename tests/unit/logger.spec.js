/**
 * logger.js 单元测试
 *
 * 覆盖目标：Logger 类所有方法 + 级别控制
 * - debug / log / warn / error: 各级别阈值
 * - group / groupEnd / table: console 方法存在/不存在
 * - setLevel / enableAll / disableAll
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Logger', () => {
  let logger;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // 确保非生产环境
    process.env.NODE_ENV = 'development';

    const mod = await import('../../src/utils/logger.js');
    logger = mod.logger;
    // 确保从 DEBUG 级别开始
    logger.enableAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== 基本输出 ====================
  describe('基本输出方法', () => {
    it('debug 输出 [DEBUG] 前缀', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('test message');
      expect(spy).toHaveBeenCalledWith('[DEBUG]', 'test message');
    });

    it('log 直接输出', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('info message');
      expect(spy).toHaveBeenCalledWith('info message');
    });

    it('warn 使用 console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning');
      expect(spy).toHaveBeenCalledWith('warning');
    });

    it('error 使用 console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error msg');
      expect(spy).toHaveBeenCalledWith('error msg');
    });
  });

  // ==================== 级别控制 ====================
  describe('级别控制', () => {
    it('level=LOG 时 debug 被抑制', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.setLevel('LOG');
      logger.debug('should not appear');
      // debug 调用 console.log，但 level > DEBUG 所以不输出
      expect(spy).not.toHaveBeenCalled();
    });

    it('level=WARN 时 log 被抑制', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.setLevel('WARN');
      logger.log('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('level=ERROR 时 warn 被抑制', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.setLevel('ERROR');
      logger.warn('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('level=NONE 时 error 也被抑制', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.setLevel('NONE');
      logger.error('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('level=ERROR 时 error 仍然输出', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.setLevel('ERROR');
      logger.error('visible');
      expect(spy).toHaveBeenCalledWith('visible');
    });

    it('无效级别名 → 不改变级别', () => {
      logger.setLevel('DEBUG');
      const prevLevel = logger.level;
      logger.setLevel('INVALID');
      expect(logger.level).toBe(prevLevel);
    });
  });

  // ==================== enableAll / disableAll ====================
  describe('enableAll / disableAll', () => {
    it('enableAll 设置为 DEBUG 级别', () => {
      logger.disableAll();
      logger.enableAll();
      expect(logger.level).toBe(0); // DEBUG = 0
    });

    it('disableAll 设置为 NONE 级别', () => {
      logger.disableAll();
      expect(logger.level).toBe(4); // NONE = 4
    });
  });

  // ==================== group / groupEnd / table ====================
  describe('group / groupEnd / table', () => {
    it('group 调用 console.group', () => {
      const spy = vi.spyOn(console, 'group').mockImplementation(() => {});
      logger.group('test group');
      expect(spy).toHaveBeenCalledWith('test group');
    });

    it('groupEnd 调用 console.groupEnd', () => {
      const spy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      logger.groupEnd();
      expect(spy).toHaveBeenCalled();
    });

    it('table 调用 console.table', () => {
      const spy = vi.spyOn(console, 'table').mockImplementation(() => {});
      const data = [{ a: 1 }];
      logger.table(data);
      expect(spy).toHaveBeenCalledWith(data);
    });

    it('level > LOG 时 group/groupEnd/table 不输出', () => {
      logger.setLevel('ERROR');
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

      logger.group('test');
      logger.groupEnd();
      logger.table([]);

      expect(groupSpy).not.toHaveBeenCalled();
      expect(tableSpy).not.toHaveBeenCalled();
    });
  });

  // ==================== 多参数 ====================
  describe('多参数传递', () => {
    it('log 传递多个参数', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('a', 'b', 123);
      expect(spy).toHaveBeenCalledWith('a', 'b', 123);
    });

    it('error 传递 Error 对象', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('test');
      logger.error('failed:', err);
      expect(spy).toHaveBeenCalledWith('failed:', err);
    });
  });
});
