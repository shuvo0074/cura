import { memo } from 'react';
import type { EncounterView } from '@cura/shared';
import { useT } from '../../i18n';
import styles from './patient.module.css';

export const TimelineEntry = memo(function TimelineEntry({ entry }: { entry: EncounterView }) {
  const { t, fmt } = useT();
  const date = fmt.date(entry.occurredAt);
  const n = (value: number | null | undefined) => (value === null || value === undefined ? '—' : fmt.number(value));

  return (
    <article className={styles.entry}>
      <header className={styles.entryHead}>
        <span className={styles.entryDate}>{date}</span>
        <span className={styles.entryDoctor}>{entry.doctorName}</span>
        {entry.signedAt && <span className={styles.signedDot} title={t('patients.timeline.signed')} />}
      </header>

      {entry.vitals && (
        <p className={styles.entryLine}>
          <strong>{t('patients.timeline.vitals')}</strong> {n(entry.vitals.weightKg)} kg · {n(entry.vitals.systolic)}/
          {n(entry.vitals.diastolic)} · {t('patients.timeline.pulse', { value: n(entry.vitals.pulseBpm) })}
        </p>
      )}
      {entry.clinicalNote && (
        <p className={styles.entryLine}>
          <strong>{t('patients.timeline.diagnosis')}</strong> {entry.clinicalNote.diagnoses.join(', ') || '—'}
        </p>
      )}
      {entry.prescription && entry.prescription.items.length > 0 && (
        <ul className={styles.entryDrugs}>
          {entry.prescription.items.map((item, i) => (
            <li key={i}>
              {item.drugName} {item.strength ?? ''} — {n(item.morning)}+{n(item.noon)}+{n(item.night)}
              {item.durationDays ? ` ${t('patients.timeline.days', { count: item.durationDays })}` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});
