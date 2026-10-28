import { useCallback, useEffect, useRef, useState } from 'react';
import type { BinaryPayload } from '@cura/shared';
import { useServices } from '../../app/services';

export interface LoadedFile extends BinaryPayload {
  /** Object URL for the blob. Valid only while this hook holds it. */
  objectUrl: string;
}

/**
 * Fetches a stored document and exposes it as an object URL.
 *
 * The download endpoint is bearer-authenticated and sends
 * `Content-Disposition: attachment`, so neither `<img src>` nor a plain link can
 * reach it — the bytes must be fetched with the token and wrapped locally.
 *
 * Every URL created here is revoked when it is replaced and again on unmount.
 * Object URLs are rooted in the document and are never garbage-collected on
 * their own, so an un-revoked preview pins the whole file in memory for the
 * lifetime of the tab; with 10 MB scans that adds up within a few clicks.
 */
export function useDocumentFile(practiceId: string) {
  const { http } = useServices();
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    if (current.current) {
      URL.revokeObjectURL(current.current);
      current.current = null;
    }
    setFile(null);
  }, []);

  const load = useCallback(
    async (documentId: string): Promise<LoadedFile | null> => {
      // Abort any in-flight fetch: clicking quickly through a list must not
      // leave an older, slower download to land and replace the newer one.
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;

      release();
      setLoading(true);
      setError(null);

      const result = await http.requestBinary(`/documents/${documentId}/content`, {
        query: { practiceId },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return null;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return null;
      }

      const objectUrl = URL.createObjectURL(result.value.blob);
      current.current = objectUrl;
      const loaded = { ...result.value, objectUrl };
      setFile(loaded);
      return loaded;
    },
    [http, practiceId, release],
  );

  /** Fetches and saves without disturbing whatever is currently previewed. */
  const download = useCallback(
    async (documentId: string, fallbackName: string) => {
      setError(null);
      const result = await http.requestBinary(`/documents/${documentId}/content`, {
        query: { practiceId },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      const url = URL.createObjectURL(result.value.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.value.fileName || fallbackName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Deferred: revoking synchronously can cancel the save in some browsers
      // before the download has actually been handed to the shell.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    [http, practiceId],
  );

  useEffect(
    () => () => {
      request.current?.abort();
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  return { file, loading, error, load, download, release };
}
