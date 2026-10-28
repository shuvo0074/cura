import {   useRef, useState } from 'react';
import { DocumentCategory } from '@cura/shared';
import { useServices } from '../../app/services';
import { Field, Modal, Row } from '../../ui';
import {
  ACCEPT_ATTRIBUTE,
  CATEGORY_LABELS,
  PROFILE_CATEGORIES,
  formatBytes,
  rejectionReason,
} from './document-kit';
import styles from './documents.module.css';
import { PatientPicker } from '../../ui';

type Status = 'ready' | 'rejected' | 'uploading' | 'done' | 'failed';

interface Queued {
  file: File;
  status: Status;
  message: string | null;
}

/**
 * Upload dialog.
 *
 * Files are uploaded one at a time rather than in parallel. The API buffers
 * each body in memory before validating it, so firing ten 10 MB uploads at once
 * would put 100 MB in the server's heap for no gain on a single connection.
 */
export function UploadDialog({
  practiceId,
  initialFiles,
  onClose,
  onUploaded,
}: {
  practiceId: string;
  initialFiles: File[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { http } = useServices();

  const [queue, setQueue] = useState<Queued[]>(() => initialFiles.map(describe));
  const [category, setCategory] = useState<string>(DocumentCategory.LAB_REPORT);
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const needsPatient = !PROFILE_CATEGORIES.includes(category);

  const add = (files: FileList | File[] | null) => {
    if (!files) return;
    setQueue((current) => [...current, ...[...files].map(describe)]);
  };

  const upload = async () => {
    setBusy(true);
    setFatal(null);

    let uploaded = 0;

    for (const [index, entry] of queue.entries()) {
      if (entry.status !== 'ready') continue;

      setQueue((current) =>
        current.map((q, i) => (i === index ? { ...q, status: 'uploading', message: null } : q)),
      );

      const body = new FormData();
      body.append('file', entry.file, entry.file.name);

      const result = await http.request(`/documents`, {
        method: 'POST',
        body,
        query: {
          practiceId,
          category,
          ...(needsPatient && patient ? { patientId: patient.id } : {}),
        },
        retry: false,
      });

      setQueue((current) =>
        current.map((q, i) =>
          i === index
            ? result.ok
              ? { ...q, status: 'done', message: null }
              : { ...q, status: 'failed', message: result.error.message }
            : q,
        ),
      );

      if (result.ok) uploaded += 1;
    }

    setBusy(false);
    if (uploaded > 0) onUploaded();
    // Left open when anything failed, so the reason stays on screen next to
    // the file it belongs to.
    if (uploaded === queue.length) onClose();
  };

  const pendingCount = queue.filter((q) => q.status === 'ready').length;
  const blocked = needsPatient && !patient;

  return (
    <Modal
      title="Upload documents"
      onClose={onClose}
      wide
      footer={
        <>
          {(fatal ?? (blocked && pendingCount > 0 ? 'Select a patient for this category.' : null)) && (
            <span className={styles.error} role="alert">
              {fatal ?? 'Select a patient for this category.'}
            </span>
          )}
          <button type="button" className={styles.secondary} onClick={onClose}>
            {queue.some((q) => q.status === 'done') ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void upload()}
            disabled={busy || pendingCount === 0 || blocked}
          >
            {busy ? 'Uploading…' : `Upload ${pendingCount || ''}`.trim()}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label="Category" required>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.values(DocumentCategory).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </Field>

        {needsPatient ? (
          <Field label="Patient" required hint="Search by name, mobile or Cura ID.">
            <PatientPicker practiceId={practiceId} value={patient} onChange={setPatient} />
          </Field>
        ) : (
          <Field label="Attached to">
            <p className={styles.muted}>
              Your own profile — this category is not linked to a patient.
            </p>
          </Field>
        )}
      </Row>

      <div className={styles.picker}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className={styles.hiddenInput}
          onChange={(e) => {
            add(e.target.files);
            // Reset so choosing the same file twice still fires a change event.
            e.target.value = '';
          }}
        />
        <button type="button" className={styles.secondary} onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <span className={styles.mutedSmall}>JPEG, PNG, WebP or PDF · up to 10 MB each</span>
      </div>

      {queue.length === 0 ? (
        <p className={styles.muted}>No files selected yet.</p>
      ) : (
        <ul className={styles.queue}>
          {queue.map((entry, i) => (
            <li key={`${entry.file.name}-${i}`} data-status={entry.status}>
              <span className={styles.queueName} title={entry.file.name}>
                {entry.file.name}
              </span>
              <span className={styles.queueMeta}>{formatBytes(entry.file.size)}</span>
              <span className={styles.queueStatus}>
                {entry.status === 'ready' && 'Ready'}
                {entry.status === 'uploading' && 'Uploading…'}
                {entry.status === 'done' && 'Uploaded'}
                {(entry.status === 'failed' || entry.status === 'rejected') && entry.message}
              </span>
              {entry.status === 'ready' && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Remove ${entry.file.name}`}
                  onClick={() => setQueue((c) => c.filter((_, index) => index !== i))}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function describe(file: File): Queued {
  const reason = rejectionReason(file);
  return reason
    ? { file, status: 'rejected', message: reason }
    : { file, status: 'ready', message: null };
}
