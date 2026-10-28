import type { ReactNode } from 'react';
import styles from './onboarding.module.css';

/** Labelled field with inline validation, styled for the wizard card. */
export function OnboardingField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}
