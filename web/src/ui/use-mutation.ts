import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../app/services';

/** Wraps a write with pending / error / transient "Saved" state. */
export function useMutation() {
  const { http } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(
    async (
      path: string,
      init: {
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: unknown;
        query?: Record<string, string>;
      },
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const result = await http.request(path, { ...init, retry: false });
      setBusy(false);

      if (!result.ok) {
        setError(result.error.message);
        return false;
      }

      setSavedAt(Date.now());
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSavedAt(0), 2500);
      return true;
    },
    [http],
  );

  return { run, busy, error, saved: savedAt !== 0 };
}
