import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentCategory, businessRules } from '@cura/shared';
import { useServices } from '../../app/services';
import { UploadDialog } from './UploadDialog';
import { DocumentPreview } from './DocumentPreview';
import { CATEGORY_LABELS, formatBytes, isImage, isPdf } from './document-kit';
import styles from './documents.module.css';

export interface DocumentRow {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  capturedOn: string | null;
  encounterId: string | null;
  patient: { id: string; fullName: string; curaId: string } | null;
}

interface Page {
  items: DocumentRow[];
  nextCursor: string | null;
}

type Range = 'all' | '7' | '30' | '365';

const RANGES: ReadonlyArray<{ key: Range; label: string }> = [
  { key: 'all', label: 'All time' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '365', label: 'Last year' },
];

/**
 * Documents module.
 *
 * A practice-wide browser over everything uploaded: lab reports, external
 * prescriptions, certificates and the doctor's own profile scans. Filtering is
 * server-side because the list is cursor-paginated — narrowing a single loaded
 * page client-side would confidently show the wrong answer once a practice has
 * more documents than fit in one page.
 */
export function DocumentsView({
  practiceId,
  canWrite,
  onOpenPatient,
}: {
  practiceId: string;
  canWrite: boolean;
  onOpenPatient: (patientId: string) => void;
}) {
  const { http } = useServices();

  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [range, setRange] = useState<Range>('all');

  const [uploading, setUploading] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [preview, setPreview] = useState<DocumentRow | null>(null);
  const [pending, setPending] = useState<File[]>([]);

  const dragDepth = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const filters = useMemo(() => {
    const params: Record<string, string> = { practiceId };
    if (query) params.q = query;
    if (category) params.category = category;
    if (range !== 'all') {
      params.from = new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    }
    return params;
  }, [practiceId, query, category, range]);

  const load = useCallback(
    async (nextCursor: string | null, signal?: AbortSignal) => {
      setLoading(true);
      const result = await http.request<Page>('/documents', {
        query: { ...filters, ...(nextCursor ? { cursor: nextCursor } : {}) },
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;

      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      // Appending only when paging; a filter change replaces the list outright.
      setRows((current) => (nextCursor ? [...current, ...result.value.items] : result.value.items));
      setCursor(result.value.nextCursor);
    },
    [http, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => void load(null), [load]);

  const remove = async (row: DocumentRow) => {
    const result = await http.request(`/documents/${row.id}`, {
      method: 'DELETE',
      query: { practiceId },
      retry: false,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPreview(null);
    // Removed locally as well as refetched, so the card disappears immediately
    // rather than after the round trip.
    setRows((current) => current.filter((r) => r.id !== row.id));
    refresh();
  };

  // Whole-pane drag and drop. Depth counting is what stops the highlight from
  // flickering off as the pointer crosses child elements.
  const onDragEnter = (e: React.DragEvent) => {
    if (!canWrite || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDropping(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    setPending(files);
    setUploading(true);
  };

  return (
    <div
      className={styles.shell}
      data-dropping={dropping || undefined}
      onDragEnter={onDragEnter}
      onDragOver={(e) => canWrite && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className={styles.toolbar}>
        <input
          className={styles.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by file name or patient…"
          aria-label="Search documents"
        />

        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {Object.values(DocumentCategory).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          aria-label="Filter by date"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        <span className={styles.spacer} />

        {canWrite && (
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              setPending([]);
              setUploading(true);
            }}
          >
            Upload files
          </button>
        )}
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className={styles.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <p>{query || category || range !== 'all' ? 'No documents match these filters.' : 'No documents yet.'}</p>
          {canWrite && (
            <p className={styles.mutedSmall}>
              Drag files anywhere on this pane, or use Upload files. JPEG, PNG, WebP and PDF up to{' '}
              {Math.round(businessRules.uploads.maxFileBytes / 1024 / 1024)} MB.
            </p>
          )}
        </div>
      ) : (
        <>
          <ul className={styles.grid}>
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className={styles.card} onClick={() => setPreview(row)}>
                  <span className={styles.thumb} data-kind={kindOf(row.mimeType)} aria-hidden="true">
                    {isPdf(row.mimeType) ? 'PDF' : isImage(row.mimeType) ? 'IMG' : 'FILE'}
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.fileName} title={row.fileName}>
                      {row.fileName}
                    </span>
                    <span className={styles.meta}>
                      {CATEGORY_LABELS[row.category] ?? row.category} · {formatBytes(row.sizeBytes)}
                    </span>
                    <span className={styles.meta}>
                      {row.patient ? row.patient.fullName : 'My profile'} ·{' '}
                      {new Date(row.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {cursor && (
            <div className={styles.more}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void load(cursor)}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {dropping && (
        <div className={styles.dropOverlay} aria-hidden="true">
          Drop files to upload
        </div>
      )}

      {preview && (
        <DocumentPreview
          practiceId={practiceId}
          document={preview}
          canWrite={canWrite}
          onClose={() => setPreview(null)}
          onDelete={() => void remove(preview)}
          onOpenPatient={onOpenPatient}
        />
      )}

      {uploading && (
        <UploadDialog
          practiceId={practiceId}
          initialFiles={pending}
          onClose={() => {
            setUploading(false);
            setPending([]);
          }}
          onUploaded={refresh}
        />
      )}
    </div>
  );
}

function kindOf(mimeType: string): string {
  if (isPdf(mimeType)) return 'pdf';
  return isImage(mimeType) ? 'image' : 'other';
}
