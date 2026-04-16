/**
 * 通用内存缓存 — 共享模块
 *
 * 提供 Map + TTL + LRU 淘汰的轻量缓存方案。
 * 每个云函数通过 createMemoryCache() 创建独立实例，互不干扰。
 * 从 school-query.ts 提取，消除 3+ 处缓存系统重复实现。
 */

/** 缓存条目内部结构 */
interface CacheEntry<T = unknown> {
  /** 缓存值 */
  value: T;
  /** 过期时间戳（毫秒） */
  expireAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 命中次数（调试用） */
  hits: number;
}

/** 缓存实例配置 */
interface CacheOptions {
  /** 缓存最大条目数，超出后按 LRU 淘汰。默认 500 */
  maxSize?: number;
}

/** 缓存实例接口 */
export interface MemoryCache {
  /** 获取缓存，过期或不存在返回 null */
  get<T = unknown>(key: string): T | null;
  /** 设置缓存 */
  set(key: string, value: unknown, ttlMs: number): void;
  /** 使指定前缀的缓存失效 */
  invalidateByPrefix(prefix: string): void;
  /** 清理所有过期条目 */
  evictExpired(): void;
  /** 生成缓存键（将参数对象序列化为稳定的字符串） */
  buildKey(namespace: string, params?: Record<string, unknown>): string;
  /** 当前缓存条目数 */
  readonly size: number;
}

/**
 * 创建一个独立的内存缓存实例
 * @param options - 缓存配置
 * @returns 缓存实例
 */
export function createMemoryCache(options: CacheOptions = {}): MemoryCache {
  const maxSize = options.maxSize ?? 500;
  const store = new Map<string, CacheEntry>();

  function get<T = unknown>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expireAt) {
      store.delete(key);
      return null;
    }

    entry.hits = (entry.hits || 0) + 1;
    return entry.value as T;
  }

  function set(key: string, value: unknown, ttlMs: number): void {
    // 缓存已满时先清理过期条目
    if (store.size >= maxSize) {
      evictExpired();
      // 仍然满则淘汰最早插入的条目（Map 保持插入顺序，近似 LRU）
      if (store.size >= maxSize) {
        const firstKey = store.keys().next().value;
        if (firstKey !== undefined) {
          store.delete(firstKey);
        }
      }
    }

    store.set(key, {
      value,
      expireAt: Date.now() + ttlMs,
      createdAt: Date.now(),
      hits: 0
    });
  }

  function invalidateByPrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  }

  function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expireAt) {
        store.delete(key);
      }
    }
  }

  function buildKey(namespace: string, params: Record<string, unknown> = {}): string {
    const sortedParams = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${namespace}:${sortedParams}`;
  }

  return {
    get,
    set,
    invalidateByPrefix,
    evictExpired,
    buildKey,
    get size() {
      return store.size;
    }
  };
}
