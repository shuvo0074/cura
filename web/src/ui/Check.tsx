import styles from './ui.module.css';

export function Check({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled ?? false}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className={styles.checkLabel}>{label}</span>
        {description && <span className={styles.checkHint}>{description}</span>}
      </span>
    </label>
  );
}
