/**
 * B004/P007: 轻量级性能监控工具
 * 
 * 功能：
 * 1. 云函数执行耗时追踪
 * 2. 慢查询告警（超过阈值自动 warn）
 * 3. 内存中滚动统计（最近 N 次调用的 p50/p95/p99）
 * 4. 异常率追踪
 * 
 * 用法：
 *   import { perfMonitor } from '../utils/perf-monitor'
 *   const end = perfMonitor.start('proxy-ai', 'generate_questions')
 *   // ... 业务逻辑
 *   end() // 或 end({ error: true }) 标记失败
 * 
 * @version 1.0.0
 */

// ==================== 配置 ====================

const CONFIG = {
  /** 慢请求阈值（毫秒） */
  slowThresholdMs: 5000,
  /** AI 类请求慢阈值（更宽松） */
  aiSlowThresholdMs: 15000,
  /** 每个函数保留的最近 N 次耗时记录（用于百分位计算） */
  maxSamples: 200,
  /** 统计窗口（毫秒），超过此时间的样本会被清理 */
  windowMs: 10 * 60 * 1000, // 10 分钟
  /** AI 类函数前缀 */
  aiPrefixes: ['proxy-ai', 'ai-photo-search', 'voice-service']
}

// ==================== 内存存储 ====================

interface Sample {
  duration: number
  timestamp: number
  error: boolean
}

interface FunctionStats {
  samples: Sample[]
  totalCalls: number
  totalErrors: number
}

const _stats: Map<string, FunctionStats> = new Map()

function _getStats(key: string): FunctionStats {
  if (!_stats.has(key)) {
    _stats.set(key, { samples: [], totalCalls: 0, totalErrors: 0 })
  }
  return _stats.get(key)!
}

function _cleanOldSamples(stats: FunctionStats) {
  const cutoff = Date.now() - CONFIG.windowMs
  stats.samples = stats.samples.filter(s => s.timestamp > cutoff)
  // 限制最大样本数
  if (stats.samples.length > CONFIG.maxSamples) {
    stats.samples = stats.samples.slice(-CONFIG.maxSamples)
  }
}

// ==================== 百分位计算 ====================

function _percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

// ==================== 公开 API ====================

export const perfMonitor = {
  /**
   * 开始计时，返回结束函数
   * @param functionName 云函数名称
   * @param action 操作类型（可选）
   */
  start(functionName: string, action?: string): (opts?: { error?: boolean }) => number {
    const startTime = Date.now()
    const key = action ? `${functionName}:${action}` : functionName

    return (opts?: { error?: boolean }) => {
      const duration = Date.now() - startTime
      const isError = opts?.error ?? false
      const stats = _getStats(key)

      stats.totalCalls++
      if (isError) stats.totalErrors++
      stats.samples.push({ duration, timestamp: Date.now(), error: isError })
      _cleanOldSamples(stats)

      // 慢请求告警
      const isAI = CONFIG.aiPrefixes.some(p => functionName.startsWith(p))
      const threshold = isAI ? CONFIG.aiSlowThresholdMs : CONFIG.slowThresholdMs
      if (duration > threshold) {
        console.warn(`[PerfMonitor] ⚠️ 慢请求: ${key} 耗时 ${duration}ms (阈值 ${threshold}ms)`)
      }

      return duration
    }
  },

  /**
   * 获取指定函数的性能统计
   */
  getStats(functionName: string, action?: string) {
    const key = action ? `${functionName}:${action}` : functionName
    const stats = _getStats(key)
    _cleanOldSamples(stats)

    const durations = stats.samples.map(s => s.duration).sort((a, b) => a - b)
    const recentErrors = stats.samples.filter(s => s.error).length

    return {
      key,
      totalCalls: stats.totalCalls,
      totalErrors: stats.totalErrors,
      recentSamples: stats.samples.length,
      recentErrors,
      errorRate: stats.samples.length > 0 ? (recentErrors / stats.samples.length * 100).toFixed(1) + '%' : '0%',
      p50: _percentile(durations, 50),
      p95: _percentile(durations, 95),
      p99: _percentile(durations, 99),
      avg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      max: durations.length > 0 ? durations[durations.length - 1] : 0
    }
  },

  /**
   * 获取所有函数的性能概览
   */
  getAllStats() {
    const result: Record<string, ReturnType<typeof perfMonitor.getStats>> = {}
    for (const key of _stats.keys()) {
      result[key] = this.getStats(key)
    }
    return result
  },

  /**
   * 重置统计数据
   */
  reset() {
    _stats.clear()
  }
}
