import { useEffect } from 'react';
import { Modal } from '../../ui';
import { useDocumentFile } from './use-document-file';
import { categoryLabel, formatBytes, isImage, isPdf } from './document-kit';
import { useT } from '../../i18n';
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
  const { t, tm, fmt } = useT();
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
              {tm(error)}
            </span>
          )}
          {canWrite && (
            <button type="button" className={styles.danger} onClick={onDelete}>
              {t('common.delete')}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void download(document.id, document.fileName)}
          >
            {t('patients.doc.download')}
          </button>
          <button type="button" className={styles.primary} onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <dl className={styles.details}>
        <dt>{t('patients.doc.category')}</dt>
        <dd>{categoryLabel(document.category, t)}</dd>
        <dt>{t('patients.field.patient')}</dt>
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
            t('patients.doc.myProfile')
          )}
        </dd>
        <dt>{t('patients.doc.size')}</dt>
        <dd>
          {formatBytes(document.sizeBytes, fmt)} · {document.mimeType}
        </dd>
        <dt>{t('patients.doc.uploaded')}</dt>
        <dd>{fmt.dateTime(document.createdAt)}</dd>
      </dl>

      <div className={styles.viewer}>
        {!renderable ? (
          <p className={styles.muted}>
            {t('patients.doc.noPreview')}
          </p>
        ) : loading ? (
          <p className={styles.muted}>{t('patients.doc.loadingPreview')}</p>
        ) : !file ? (
          <p className={styles.muted}>{tm(error) ?? t('patients.doc.previewUnavailable')}</p>
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
