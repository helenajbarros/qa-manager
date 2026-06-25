import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30_000;

interface UseAsyncOptions {
  cacheKey?: string;
  ttl?: number;
  noCache?: boolean;
}

interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {}
): UseAsyncResult<T> {
  const { cacheKey, ttl = CACHE_TTL, noCache = false } = options;
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (force = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (!noCache && cacheKey && !force) {
      const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
      if (cached && Date.now() - cached.ts < (ttl || CACHE_TTL)) {
        setData(cached.data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
      if (!noCache && cacheKey) {
        cache.set(cacheKey, { data: result, ts: Date.now() });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  const refetch = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
    execute(true);
  }, [cacheKey, execute]);

  return { data, loading, error, refetch };
}

export function invalidateCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
