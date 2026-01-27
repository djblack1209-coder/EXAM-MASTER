/**
 * 日志工具库
 * 
 * 生产环境只记录 WARN 和 ERROR，避免大量 INFO 日志淹没关键错误信息。
 * 
 * 日志级别：
 * - debug: 调试信息（仅开发环境）
 * - info: 一般信息（仅开发环境）
 * - warn: 警告信息（生产环境可见）
 * - error: 错误信息（始终可见）
 * 
 * 环境变量：
 * - NODE_ENV: 'production' | 'development'
 * - LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

// ==================== 环境配置 ====================

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// 日志级别优先级
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// 获取当前日志级别
// 生产环境默认 warn，开发环境默认 info
const currentLevel = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')
const currentLevelPriority = LOG_LEVELS[currentLevel] || LOG_LEVELS.info

// ==================== 日志格式化 ====================

/**
 * 格式化日志消息
 */
function formatMessage(level: string, requestId: string | null, ...args: any[]): string {
  const timestamp = new Date().toISOString()
  const prefix = requestId ? `[${requestId}]` : ''
  const levelTag = `[${level.toUpperCase()}]`
  
  // 将参数转换为字符串
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')
  
  return `${timestamp} ${levelTag} ${prefix} ${message}`.trim()
}

/**
 * 安全地序列化错误对象
 */
function serializeError(error: any): object {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack
    }
  }
  return { message: String(error) }
}

// ==================== 日志类 ====================

export class Logger {
  private requestId: string | null = null
  
  constructor(requestId?: string) {
    this.requestId = requestId || null
  }
  
  /**
   * 设置请求ID
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId
  }
  
  /**
   * 调试日志（仅开发环境）
   */
  debug(...args: any[]): void {
    if (currentLevelPriority <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', this.requestId, ...args))
    }
  }
  
  /**
   * 信息日志（仅开发环境）
   */
  info(...args: any[]): void {
    if (currentLevelPriority <= LOG_LEVELS.info) {
      console.log(formatMessage('info', this.requestId, ...args))
    }
  }
  
  /**
   * 警告日志（生产环境可见）
   */
  warn(...args: any[]): void {
    if (currentLevelPriority <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', this.requestId, ...args))
    }
  }
  
  /**
   * 错误日志（始终可见）
   */
  error(...args: any[]): void {
    // 错误日志始终输出
    const processedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return serializeError(arg)
      }
      return arg
    })
    console.error(formatMessage('error', this.requestId, ...processedArgs))
  }
  
  /**
   * 记录请求开始
   */
  requestStart(action: string, params?: object): void {
    this.info(`请求开始: ${action}`, params ? JSON.stringify(params) : '')
  }
  
  /**
   * 记录请求结束
   */
  requestEnd(action: string, duration: number, success: boolean): void {
    if (success) {
      this.info(`请求完成: ${action}, 耗时: ${duration}ms`)
    } else {
      this.warn(`请求失败: ${action}, 耗时: ${duration}ms`)
    }
  }
  
  /**
   * 记录数据库操作
   */
  dbOperation(operation: string, collection: string, count?: number): void {
    this.debug(`DB ${operation}: ${collection}`, count !== undefined ? `(${count} 条)` : '')
  }
}

// ==================== 简化的日志函数 ====================

/**
 * 创建带请求ID的日志实例
 */
export function createLogger(requestId?: string): Logger {
  return new Logger(requestId)
}

/**
 * 默认日志实例（无请求ID）
 */
export const logger = new Logger()

/**
 * 简化的日志函数（兼容旧代码）
 */
export const log = {
  debug: (...args: any[]) => logger.debug(...args),
  info: (...args: any[]) => logger.info(...args),
  warn: (...args: any[]) => logger.warn(...args),
  error: (...args: any[]) => logger.error(...args)
}

// ==================== 性能监控 ====================

/**
 * 性能计时器
 */
export class Timer {
  private startTime: number
  private marks: Map<string, number> = new Map()
  
  constructor() {
    this.startTime = Date.now()
  }
  
  /**
   * 标记时间点
   */
  mark(name: string): void {
    this.marks.set(name, Date.now())
  }
  
  /**
   * 获取从开始到现在的耗时
   */
  elapsed(): number {
    return Date.now() - this.startTime
  }
  
  /**
   * 获取两个标记之间的耗时
   */
  between(start: string, end: string): number | null {
    const startTime = this.marks.get(start)
    const endTime = this.marks.get(end)
    if (startTime === undefined || endTime === undefined) return null
    return endTime - startTime
  }
  
  /**
   * 获取所有标记的耗时报告
   */
  report(): object {
    const result: Record<string, number> = {
      total: this.elapsed()
    }
    
    let prevTime = this.startTime
    for (const [name, time] of this.marks) {
      result[name] = time - prevTime
      prevTime = time
    }
    
    return result
  }
}

// ==================== 导出 ====================

export default {
  Logger,
  createLogger,
  logger,
  log,
  Timer,
  IS_PRODUCTION,
  currentLevel
}
