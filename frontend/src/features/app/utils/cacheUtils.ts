/**
 * Garden data caching utilities
 * Provides helpers for managing garden insight cache with TTL and invalidation
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Check if a cached entry is still valid (not expired)
 */
export function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttlMs = CACHE_TTL_MS): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < ttlMs;
}

/**
 * Get cached data if valid, otherwise return undefined
 */
export function getCachedData<T>(
  cache: Map<number, CacheEntry<T>>,
  key: number,
  ttlMs = CACHE_TTL_MS,
): T | undefined {
  const entry = cache.get(key);
  if (isCacheValid(entry, ttlMs)) {
    return entry?.data;
  }
  cache.delete(key);
  return undefined;
}

/**
 * Store data in cache with current timestamp
 */
export function setCachedData<T>(
  cache: Map<number, CacheEntry<T>>,
  key: number,
  data: T
): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear all caches for garden insights
 */
export function createClearAllCaches(
  ...cacheMaps: Map<number, unknown>[]
): () => void {
  return () => {
    for (const cache of cacheMaps) {
      cache.clear();
    }
  };
}

/**
 * Invalidate specific insight caches (for garden/bed/placement changes)
 */
export function createInvalidateCaches(
  ...cacheMaps: Map<number, unknown>[]
): (gardenId: number) => void {
  return (gardenId: number) => {
    for (const cache of cacheMaps) {
      cache.delete(gardenId);
    }
  };
}
