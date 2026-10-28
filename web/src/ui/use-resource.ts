import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../app/services';

/**
 * Loads a resource once and exposes a reload.
 *
 * The query object is a fresh literal on every render, so it is serialised for
 * the dependency list — otherwise the effect would re-run forever.
 */
export function useResource<T>(path: string, query: Record<string, string | undefined>) {
  const { http } = useServices();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const key = JSON.stringify(query);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const result = await http.request<T>(path, {
        query: JSON.parse(key) as Record<string, string>,
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;
      setLoading(false);
      if (result.ok) {
        setData(result.value);
        setError(null);
      } else {
        setError(result.error.message);
      }
    },
    [http, path, key],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
