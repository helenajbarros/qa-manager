import { useState, useEffect, useCallback, useRef } from "react";

// Cache simples em memória — dura enquanto o browser estiver aberto
// Chave = string serializada da função + deps
const cache = new Map();
const CACHE_TTL = 30_000; // 30 segundos

export function useAsync(asyncFn, deps = [], options = {}) {
  const { cacheKey, ttl = CACHE_TTL, noCache = false } = options;
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const abortRef = useRef(null);

  const execute = useCallback(async (force = false) => {
    // Cancela requisição anterior se ainda estiver em andamento
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Verifica cache
    if (!noCache && cacheKey && !force) {
      const cached = cache.get(cacheKey);
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
      // Salva no cache
      if (!noCache && cacheKey) {
        cache.set(cacheKey, { data: result, ts: Date.now() });
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  // Invalida cache e refaz a requisição
  const refetch = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
    execute(true);
  }, [cacheKey, execute]);

  return { data, loading, error, refetch };
}

// Função utilitária para invalidar cache manualmente
export function invalidateCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}
