import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { UploadDialog } from '../documents/UploadDialog';
import { DocumentPreview } from '../documents/DocumentPreview';
import type { DocumentRow } from '../documents/DocumentsView';
import { categoryLabel, formatBytes } from '../documents/document-kit';
import { useT } from '../../i18n';
import styles from './patient.module.css';

/** Files attached to this patient (spec: Patient → Files). */
export function PatientFiles({
  practiceId,
  patientId,
  canWrite,
}: {
  practiceId: string;
  patientId: string;
  canWrite: boolean;
}) {
  const { http } = useServices();
  const { t, fmt } = useT();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<DocumentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // The practice-wide browse scoped to this patient, so the row carries the
    // same joined shape the Documents module renders.
    const result = await http.request<{ items: DocumentRow[] }>('/documents', {
      query: { practiceId, patientId },
    });
    setLoading(false);
    if (result.ok) setRows(result.value.items);
  }, [http, practiceId, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.card} aria-label={t('patients.tab.files')}>
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>{t('patients.tab.files')}</h3>
        {canWrite && (
          <button type="button" className={styles.ghost} onClick={() => setUploading(true)}>
            {t('patients.files.add')}
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>{t('patients.files.empty')}</p>
      ) : (
        <ul className={styles.fileList}>
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => setPreview(row)}>
                <span className={styles.fileName}>{row.fileName}</span>
                <span className={styles.muted}>
                  {categoryLabel(row.category, t)} · {formatBytes(row.sizeBytes, fmt)} · {fmt.date(row.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <DocumentPreview
          practiceId={practiceId}
          document={preview}
          canWrite={canWrite}
          onClose={() => setPreview(null)}
          onDelete={() => {
            setPreview(null);
            void load();
          }}
          onOpenPatient={() => setPreview(null)}
        />
      )}

      {uploading && (
        <UploadDialog
          practiceId={practiceId}
          initialFiles={[]}
          onClose={() => setUploading(false)}
          onUploaded={() => void load()}
        />
      )}
    </section>
  );
}
