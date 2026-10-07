import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

function readSavedPage(key) {
  try {
    return parseInt(sessionStorage.getItem(`page:${key}`), 10) || 1;
  } catch {
    return 1;
  }
}

function savePage(key, page) {
  try {
    sessionStorage.setItem(`page:${key}`, String(page));
  } catch {
    // storage unavailable (private mode etc.) — remembering is best-effort
  }
}

// Client-side pagination with the current page kept in the URL (?page=N),
// so returning from a profile page restores the same page. The last page is
// also remembered per `storageKey` for the browser tab, so arriving from the
// menu (a plain /doctors link) brings the user back to where they left off.
// Whenever `resetKey` changes (e.g. search text or filters), we jump back to
// page 1.
export function usePagination(items, pageSize, resetKey, storageKey) {
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requested = parseInt(searchParams.get('page'), 10) || 1;
  const page = Math.min(Math.max(requested, 1), totalPages);

  function setPage(next, { replace = next <= 1 } = {}) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next <= 1) params.delete('page');
      else params.set('page', String(next));
      return params;
    }, { replace });
  }

  // On arrival without ?page=, restore the remembered page. `replace` keeps
  // this out of history so Back still leaves the list in one step.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !storageKey) return;
    restored.current = true;
    if (searchParams.has('page')) return;
    const saved = readSavedPage(storageKey);
    if (saved > 1) setPage(saved, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the page once the list has loaded (while it's still empty the
  // page is clamped to 1, which must not overwrite the saved value).
  useEffect(() => {
    if (storageKey && items.length) savePage(storageKey, page);
  }, [storageKey, page, items.length]);

  const prevKey = useRef(resetKey);
  useEffect(() => {
    if (prevKey.current === resetKey) return;
    prevKey.current = resetKey;
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const start = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    setPage,
    pageItems: items.slice(start, start + pageSize),
    rangeStart: items.length ? start + 1 : 0,
    rangeEnd: Math.min(start + pageSize, items.length),
  };
}
