/* eslint-disable no-console */
/**
 * 统一日志工具
 *
 * 功能：
 * 1. 生产环境自动禁用所有日志输出
 * 2. 开发与正式环境均只输出静态操作标签和数值计数
 * 3. 支持日志级别控制
 *
 * 使用方法：
 * import { logger } from '@/utils/logger.js';
 * logger.log('[Module] 信息');
 * logger.warn('[Module] 警告');
 * logger.error('[Module] 错误');
 */

// 判断是否为生产环境
const isProduction = process.env.NODE_ENV === 'production';

// 日志级别配置
const LOG_LEVELS = {
  DEBUG: 0,
  LOG: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 当前日志级别（生产环境只显示错误，开发环境显示所有）
const currentLevel = isProduction ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;

// Labels are static at source call sites (covered by the privacy source audit).
// Never serialize arbitrary strings, objects, Error messages or stacks after the label.
const publicArgs = ([label, ...values]) => [
  typeof label === 'string' ? label : '[App] 诊断事件',
  ...values.filter((value) => typeof value === 'number' && Number.isFinite(value))
];

/**
 * 日志工具类
 */
class Logger {
  constructor() {
    this.isProduction = isProduction;
    this.level = currentLevel;
  }

  /**
   * 调试日志（仅开发环境）
   */
  debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...publicArgs(args));
    }
  }

  /**
   * 普通日志（仅开发环境）
   */
  log(...args) {
    if (this.level <= LOG_LEVELS.LOG) {
      console.log(...publicArgs(args));
    }
  }

  /**
   * 警告日志（仅开发环境）
   */
  warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(...publicArgs(args));
    }
  }

  /**
   * 错误日志（始终显示）
   */
  error(...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(...publicArgs(args));
    }
  }

  /**
   * 分组日志（仅开发环境）
   */
  group(label) {
    if (this.level <= LOG_LEVELS.LOG && console.group) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.level <= LOG_LEVELS.LOG && console.groupEnd) {
      console.groupEnd();
    }
  }

  /**
   * 表格日志（仅开发环境）
   */
  table() {
    if (this.level <= LOG_LEVELS.LOG && console.table) {
      console.table('[App] 表格诊断已省略');
    }
  }

  /**
   * 设置日志级别
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = LOG_LEVELS[level];
    }
  }

  /**
   * 临时启用所有日志（用于调试）
   */
  enableAll() {
    this.level = LOG_LEVELS.DEBUG;
  }

  /**
   * 禁用所有日志
   */
  disableAll() {
    this.level = LOG_LEVELS.NONE;
  }
}

// 导出单例
export const logger = new Logger();

// 默认导出
export default logger;
