import { memo } from 'react';
import { useT } from '../../i18n';
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
  const { fmt } = useT();
  return (
    <div className={styles.counter} data-tone={tone}>
      <span className={styles.counterValue}>{fmt.number(value)}</span>
      <span className={styles.counterLabel}>{label}</span>
    </div>
  );
});
