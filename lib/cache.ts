interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && now - entry.timestamp < ttlMs) {
    return entry.value as T;
  }

  const value = await fetcher();
  cache.set(key, { value, timestamp: now });
  return value;
}
