const CONFIG = {
  slowThresholdMs: 5000,
  aiSlowThresholdMs: 15000,
  maxSamples: 200,
  windowMs: 10 * 60 * 1000,
  aiPrefixes: ['proxy-ai', 'ai-photo-search', 'voice-service']
};

interface Sample {
  duration: number;
  timestamp: number;
  error: boolean;
}

interface FunctionStats {
  samples: Sample[];
  totalCalls: number;
  totalErrors: number;
}

const statsMap: Map<string, FunctionStats> = new Map();

function getStatsRecord(key: string): FunctionStats {
  if (!statsMap.has(key)) {
    statsMap.set(key, { samples: [], totalCalls: 0, totalErrors: 0 });
  }
  return statsMap.get(key)!;
}

function cleanOldSamples(stats: FunctionStats) {
  const cutoff = Date.now() - CONFIG.windowMs;
  stats.samples = stats.samples.filter((s) => s.timestamp > cutoff);
  if (stats.samples.length > CONFIG.maxSamples) {
    stats.samples = stats.samples.slice(-CONFIG.maxSamples);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export const perfMonitor = {
  start(functionName: string, action?: string): (opts?: { error?: boolean }) => number {
    const startTime = Date.now();
    const key = action ? `${functionName}:${action}` : functionName;

    return (opts?: { error?: boolean }) => {
      const duration = Date.now() - startTime;
      const isError = opts?.error ?? false;
      const stats = getStatsRecord(key);

      stats.totalCalls++;
      if (isError) stats.totalErrors++;
      stats.samples.push({ duration, timestamp: Date.now(), error: isError });
      cleanOldSamples(stats);

      const isAI = CONFIG.aiPrefixes.some((prefix) => functionName.startsWith(prefix));
      const threshold = isAI ? CONFIG.aiSlowThresholdMs : CONFIG.slowThresholdMs;
      if (duration > threshold) {
        console.warn(`[PerfMonitor] Slow request: ${key} ${duration}ms (threshold ${threshold}ms)`);
      }

      return duration;
    };
  },

  getStats(functionName: string, action?: string) {
    const key = action ? `${functionName}:${action}` : functionName;
    const stats = getStatsRecord(key);
    cleanOldSamples(stats);

    const durations = stats.samples.map((s) => s.duration).sort((a, b) => a - b);
    const recentErrors = stats.samples.filter((s) => s.error).length;

    return {
      key,
      totalCalls: stats.totalCalls,
      totalErrors: stats.totalErrors,
      recentSamples: stats.samples.length,
      recentErrors,
      errorRate: stats.samples.length > 0 ? `${((recentErrors / stats.samples.length) * 100).toFixed(1)}%` : '0%',
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      avg: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      max: durations.length > 0 ? durations[durations.length - 1] : 0
    };
  },

  reset() {
    statsMap.clear();
  }
};
