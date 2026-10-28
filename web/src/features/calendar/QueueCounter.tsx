import { memo } from 'react';
import styles from './calendar.module.css';

export const Counter = memo(function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={styles.counter} data-tone={tone}>
      <span className={styles.counterValue}>{value}</span>
      <span className={styles.counterLabel}>{label}</span>
    </div>
  );
});
