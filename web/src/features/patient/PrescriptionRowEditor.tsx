import { memo } from 'react';
import {
  
  
  type PrescriptionRow,
} from '@cura/shared';
import styles from './patient.module.css';

export const PrescriptionRowEditor = memo(function PrescriptionRowEditor({
  row,
  disabled,
  suggestionsOpen,
  suggestions,
  onField,
  onPick,
  onRemove,
}: {
  row: PrescriptionRow;
  index: number;
  disabled: boolean;
  suggestionsOpen: boolean;
  suggestions: Array<{ id: string; name: string; strength: string | null; form: string | null; instruction: string | null }>;
  /** `key` is a local render id, never a prescription field — excluded here. */
  onField: (field: Exclude<keyof PrescriptionRow, 'key'>, value: never) => void;
  onPick: (s: { id: string; name: string; strength: string | null; form: string | null; instruction: string | null }) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.gridRow} role="row">
      <div className={styles.suggestWrap}>
        <input
          className={styles.input}
          value={row.drugName}
          disabled={disabled}
          placeholder="Start typing…"
          onChange={(e) => onField('drugName', e.target.value as never)}
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPick(s)}>
                  <strong>{s.name}</strong>
                  {s.strength && <span> {s.strength}</span>}
                  {s.form && <em> · {s.form}</em>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        className={styles.input}
        value={row.strength ?? ''}
        disabled={disabled}
        onChange={(e) => onField('strength', (e.target.value || null) as never)}
      />
      <input
        className={styles.input}
        type="number"
        min={1}
        value={row.durationDays ?? ''}
        disabled={disabled}
        onChange={(e) => onField('durationDays', (e.target.value === '' ? null : Number(e.target.value)) as never)}
      />
      <div className={styles.doseGroup}>
        {(['morning', 'noon', 'night'] as const).map((slot) => (
          <input
            key={slot}
            className={styles.dose}
            type="number"
            min={0}
            step={0.5}
            aria-label={slot}
            value={row[slot]}
            disabled={disabled}
            onChange={(e) => onField(slot, Number(e.target.value) as never)}
          />
        ))}
      </div>
      <select
        className={styles.input}
        value={row.mealRelation}
        disabled={disabled}
        onChange={(e) => onField('mealRelation', e.target.value as never)}
      >
        <option value="ANY">Any</option>
        <option value="BEFORE">Before</option>
        <option value="AFTER">After</option>
      </select>
      <button type="button" className={styles.remove} onClick={onRemove} disabled={disabled} aria-label="Remove row">
        ×
      </button>
    </div>
  );
});
