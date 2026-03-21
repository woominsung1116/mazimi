// ---------------------------------------------------------------------------
// Persistent cache layer — AsyncStorage backed, TTL-aware.
//
// All cache entries are stored as JSON under a namespaced key prefix so they
// can be bulk-cleared without touching unrelated AsyncStorage keys.
//
// Usage:
//   await cacheSet("programs:list", data, 30);
//   const hit = await cacheGet<ProgramListResponse>("programs:list");
//   await cachedFetch("programs:list", () => api.getPrograms(), TTL.PROGRAMS);
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY_PREFIX = "@wello_cache:";

/** Default TTL values (minutes) for each logical data type. */
export const TTL = {
  PROGRAMS: 30,
  PROGRAM_DETAIL: 60,
  DASHBOARD: 15,
  PROFILE: 120,
  RECOMMENDATIONS: 30,
} as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  /** Unix timestamp (ms) when this entry was written. */
  storedAt: number;
  /** TTL in minutes. */
  ttlMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prefixedKey(key: string): string {
  return `${CACHE_KEY_PREFIX}${key}`;
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  const ageMs = Date.now() - entry.storedAt;
  const ttlMs = entry.ttlMinutes * 60 * 1000;
  return ageMs > ttlMs;
}

// ---------------------------------------------------------------------------
// Primitive cache operations
// ---------------------------------------------------------------------------

/**
 * Read a value from AsyncStorage.
 *
 * Returns `null` when:
 *   - the key does not exist,
 *   - the stored JSON is malformed, or
 *   - the TTL has elapsed.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(prefixedKey(key));
    if (raw === null) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (isExpired(entry)) {
      // Evict lazily — fire-and-forget, don't block the caller.
      AsyncStorage.removeItem(prefixedKey(key)).catch(() => undefined);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Write a value to AsyncStorage with an explicit TTL.
 *
 * Silently swallows write errors so a full storage quota never breaks the app.
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttlMinutes: number
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      storedAt: Date.now(),
      ttlMinutes,
    };
    await AsyncStorage.setItem(prefixedKey(key), JSON.stringify(entry));
  } catch {
    // Quota exceeded or serialization failure — degrade gracefully.
  }
}

/**
 * Remove a single cache entry.
 */
export async function cacheClear(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(prefixedKey(key));
  } catch {
    // ignore
  }
}

/**
 * Remove all entries written by this cache layer (keys with the wello prefix).
 * Leaves all other AsyncStorage keys intact.
 */
export async function cacheInvalidateAll(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Cache-first fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Cache-first data fetcher.
 *
 * Resolution order:
 *   1. Fresh cache hit  → return cached data immediately (no network call).
 *   2. Cache miss / expired → call `fetchFn`.
 *      a. Success → update cache, return fresh data.
 *      b. Network error + stale cache exists → return stale data as fallback.
 *      c. Network error + no cache → rethrow so callers can handle it.
 *
 * @param key         Cache key (without prefix).
 * @param fetchFn     Async function that performs the actual network request.
 * @param ttlMinutes  How long a successful response should be considered fresh.
 */
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMinutes: number
): Promise<T> {
  // 1. Try fresh cache.
  const fresh = await cacheGet<T>(key);
  if (fresh !== null) {
    return fresh;
  }

  // 2. Attempt network fetch.
  try {
    const data = await fetchFn();
    // Write-through: update cache on success.
    await cacheSet(key, data, ttlMinutes);
    return data;
  } catch (networkError) {
    // 3. Network failed — try stale cache before giving up.
    const stale = await getStale<T>(key);
    if (stale !== null) {
      return stale;
    }
    throw networkError;
  }
}

// ---------------------------------------------------------------------------
// Internal — read stale (expired but still present) cache entries.
// ---------------------------------------------------------------------------

/**
 * Like `cacheGet` but returns the data even when the TTL has elapsed.
 * Used exclusively as an offline fallback inside `cachedFetch`.
 */
async function getStale<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(prefixedKey(key));
    if (raw === null) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}
