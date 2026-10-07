import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Client-side pagination with the current page kept in the URL (?page=N),
// so returning from a profile page restores the same page. Whenever
// `resetKey` changes (e.g. search text or filters), we jump back to page 1.
export function usePagination(items, pageSize, resetKey) {
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requested = parseInt(searchParams.get('page'), 10) || 1;
  const page = Math.min(Math.max(requested, 1), totalPages);

  function setPage(next) {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next <= 1) params.delete('page');
      else params.set('page', String(next));
      return params;
    }, { replace: next <= 1 });
  }

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
