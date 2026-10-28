import { memo } from 'react';
import {
  
  
  type EncounterView,
} from '@cura/shared';
import styles from './patient.module.css';

export const TimelineEntry = memo(function TimelineEntry({ entry }: { entry: EncounterView }) {
  const date = new Date(entry.occurredAt).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className={styles.entry}>
      <header className={styles.entryHead}>
        <span className={styles.entryDate}>{date}</span>
        <span className={styles.entryDoctor}>{entry.doctorName}</span>
        {entry.signedAt && <span className={styles.signedDot} title="Signed" />}
      </header>

      {entry.vitals && (
        <p className={styles.entryLine}>
          <strong>Vitals</strong> {entry.vitals.weightKg ?? '—'} kg · {entry.vitals.systolic ?? '—'}/
          {entry.vitals.diastolic ?? '—'} · pulse {entry.vitals.pulseBpm ?? '—'}
        </p>
      )}
      {entry.clinicalNote && (
        <p className={styles.entryLine}>
          <strong>Diagnosis</strong> {entry.clinicalNote.diagnoses.join(', ') || '—'}
        </p>
      )}
      {entry.prescription && entry.prescription.items.length > 0 && (
        <ul className={styles.entryDrugs}>
          {entry.prescription.items.map((item, i) => (
            <li key={i}>
              {item.drugName} {item.strength ?? ''} — {item.morning}+{item.noon}+{item.night}
              {item.durationDays ? ` × ${item.durationDays}d` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});
