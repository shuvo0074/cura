import { useEffect } from 'react';
import { Modal } from '../../ui';
import { useDocumentFile } from './use-document-file';
import { CATEGORY_LABELS, formatBytes, isImage, isPdf } from './document-kit';
import type { DocumentRow } from './DocumentsView';
import styles from './documents.module.css';

/**
 * Document preview.
 *
 * Bytes are fetched with the access token and rendered from a blob URL. Two
 * things keep that from reintroducing the stored-XSS hole the upload guard
 * closes:
 *
 *  - Only image and PDF types are rendered. Anything else is offered as a
 *    download, never handed to the renderer.
 *  - The PDF viewer is a sandboxed iframe with no `allow-scripts`. A blob URL
 *    inherits this page's origin, so an un-sandboxed frame would let a crafted
 *    PDF's JavaScript run with our origin's privileges — same-origin access to
 *    the session it is displaying.
 */
export function DocumentPreview({
  practiceId,
  document,
  canWrite,
  onClose,
  onDelete,
  onOpenPatient,
}: {
  practiceId: string;
  document: DocumentRow;
  canWrite: boolean;
  onClose: () => void;
  onDelete: () => void;
  onOpenPatient: (patientId: string) => void;
}) {
  const { file, loading, error, load, download } = useDocumentFile(practiceId);

  const renderable = isImage(document.mimeType) || isPdf(document.mimeType);

  useEffect(() => {
    if (renderable) void load(document.id);
  }, [renderable, document.id, load]);

  return (
    <Modal
      title={document.fileName}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={styles.error} role="alert">
              {error}
            </span>
          )}
          {canWrite && (
            <button type="button" className={styles.danger} onClick={onDelete}>
              Delete
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void download(document.id, document.fileName)}
          >
            Download
          </button>
          <button type="button" className={styles.primary} onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <dl className={styles.details}>
        <dt>Category</dt>
        <dd>{CATEGORY_LABELS[document.category] ?? document.category}</dd>
        <dt>Patient</dt>
        <dd>
          {document.patient ? (
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                onClose();
                onOpenPatient(document.patient!.id);
              }}
            >
              {document.patient.fullName} ({document.patient.curaId})
            </button>
          ) : (
            'My profile'
          )}
        </dd>
        <dt>Size</dt>
        <dd>
          {formatBytes(document.sizeBytes)} · {document.mimeType}
        </dd>
        <dt>Uploaded</dt>
        <dd>{new Date(document.createdAt).toLocaleString()}</dd>
      </dl>

      <div className={styles.viewer}>
        {!renderable ? (
          <p className={styles.muted}>
            This file type cannot be previewed in the browser. Use Download to open it.
          </p>
        ) : loading ? (
          <p className={styles.muted}>Loading preview…</p>
        ) : !file ? (
          <p className={styles.muted}>{error ?? 'Preview unavailable.'}</p>
        ) : isImage(document.mimeType) ? (
          <img className={styles.image} src={file.objectUrl} alt={document.fileName} />
        ) : (
          <iframe
            className={styles.frame}
            src={file.objectUrl}
            title={document.fileName}
            sandbox=""
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </Modal>
  );
}
