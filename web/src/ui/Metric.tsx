import styles from './ui.module.css';

/** Single headline figure. Shared by Billing and Statistics. */
export function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}
