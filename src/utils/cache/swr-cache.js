import { storageService } from '@/services/storageService.js';

const SWR_PREFIX = 'swr_';
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 min — fresh
const DEFAULT_STALE_AGE = 30 * 60 * 1000; // 30 min — stale but usable

function cacheKey(key) {
  return `${SWR_PREFIX}${key}`;
}

function readCache(key) {
  return storageService.get(cacheKey(key), null);
}

function writeCache(key, data) {
  storageService.save(cacheKey(key), { data, ts: Date.now() }, true);
}

/**
 * Stale-While-Revalidate fetch.
 * - Fresh (< maxAge): return cache, skip network
 * - Stale (maxAge..staleAge): return cache immediately, revalidate in background
 * - Expired (> staleAge): await fresh fetch
 *
 * @param {string} key - unique cache key
 * @param {() => Promise<any>} fetcher - async data fetcher
 * @param {object} [options]
 * @param {number} [options.maxAge] - ms before data is considered stale
 * @param {number} [options.staleAge] - ms before data is considered expired
 * @param {(data: any) => void} [options.onUpdate] - called when background revalidation completes
 * @returns {Promise<any>}
 */
export async function swrFetch(key, fetcher, options = {}) {
  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE;
  const staleAge = options.staleAge ?? DEFAULT_STALE_AGE;
  const onUpdate = options.onUpdate;

  const cached = readCache(key);
  if (cached) {
    const age = Date.now() - cached.ts;

    // Fresh — return immediately, no fetch
    if (age < maxAge) return cached.data;

    // Stale — return cache, revalidate in background
    if (age < staleAge) {
      fetcher()
        .then((fresh) => {
          writeCache(key, fresh);
          if (onUpdate) onUpdate(fresh);
        })
        .catch(() => {});
      return cached.data;
    }
  }

  // Expired or no cache — await fresh data
  const data = await fetcher();
  writeCache(key, data);
  return data;
}

/** Force-clear a cached entry. */
export function invalidateCache(key) {
  storageService.remove(cacheKey(key), true);
}

/** Warm the cache without blocking the caller. */
export function prefetch(key, fetcher) {
  fetcher()
    .then((data) => writeCache(key, data))
    .catch(() => {});
}
