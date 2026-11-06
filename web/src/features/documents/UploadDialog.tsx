import { useRef, useState } from 'react';
import { DocumentCategory } from '@cura/shared';
import { useServices } from '../../app/services';
import { Field, Modal, Row } from '../../ui';
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_MB,
  PROFILE_CATEGORIES,
  formatBytes,
  rejectionReason,
} from './document-kit';
import styles from './documents.module.css';
import { PatientPicker } from '../../ui';
import { useT } from '../../i18n';

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
  const { t, tm, fmt } = useT();

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
      title={t('patients.upload.title')}
      onClose={onClose}
      wide
      footer={
        <>
          {(fatal ?? (blocked && pendingCount > 0 ? t('patients.upload.selectPatient') : null)) && (
            <span className={styles.error} role="alert">
              {tm(fatal) ?? t('patients.upload.selectPatient')}
            </span>
          )}
          <button type="button" className={styles.secondary} onClick={onClose}>
            {queue.some((q) => q.status === 'done') ? t('common.done') : t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void upload()}
            disabled={busy || pendingCount === 0 || blocked}
          >
            {busy
              ? t('patients.upload.uploading')
              : pendingCount
                ? t('patients.upload.uploadCount', { count: pendingCount })
                : t('patients.upload.upload')}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label={t('patients.doc.category')} required>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.values(DocumentCategory).map((c) => (
              <option key={c} value={c}>
                {t(`patients.doc.cat.${c}`)}
              </option>
            ))}
          </select>
        </Field>

        {needsPatient ? (
          <Field label={t('patients.field.patient')} required hint={t('patients.upload.patientHint')}>
            <PatientPicker practiceId={practiceId} value={patient} onChange={setPatient} />
          </Field>
        ) : (
          <Field label={t('patients.upload.attachedTo')}>
            <p className={styles.muted}>
              {t('patients.upload.ownProfile')}
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
          {t('patients.upload.choose')}
        </button>
        <span className={styles.mutedSmall}>{t('patients.upload.types', { mb: MAX_UPLOAD_MB })}</span>
      </div>

      {queue.length === 0 ? (
        <p className={styles.muted}>{t('patients.upload.none')}</p>
      ) : (
        <ul className={styles.queue}>
          {queue.map((entry, i) => (
            <li key={`${entry.file.name}-${i}`} data-status={entry.status}>
              <span className={styles.queueName} title={entry.file.name}>
                {entry.file.name}
              </span>
              <span className={styles.queueMeta}>{formatBytes(entry.file.size, fmt)}</span>
              <span className={styles.queueStatus}>
                {entry.status === 'ready' && t('patients.upload.ready')}
                {entry.status === 'uploading' && t('patients.upload.uploading')}
                {entry.status === 'done' && t('patients.upload.done')}
                {(entry.status === 'failed' || entry.status === 'rejected') && tm(entry.message)}
              </span>
              {entry.status === 'ready' && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('patients.removeItem', { value: entry.file.name })}
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
