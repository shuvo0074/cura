import {  useState } from 'react';
import styles from './patient.module.css';

/**
 * Locked-history panel.
 *
 * Makes the privacy rule legible: the doctor is told records exist, why they
 * are withheld, and that the patient must approve access.
 */
export function ConsentPanel({
  windowDays,
  challengeOpen,
  maskedTarget,
  onRequest,
  onConfirm,
}: {
  windowDays: number;
  challengeOpen: boolean;
  maskedTarget: string | null;
  onRequest: () => void;
  onConfirm: (code: string) => void;
}) {
  const [code, setCode] = useState('');

  return (
    <div className={styles.consent}>
      <p className={styles.consentText}>
        Records older than {windowDays} days are locked. Ask the patient to approve access.
      </p>
      {!challengeOpen ? (
        <button type="button" className={styles.ghost} onClick={onRequest}>
          Request patient consent
        </button>
      ) : (
        <div className={styles.consentRow}>
          <span className={styles.muted}>Code sent to {maskedTarget}</span>
          <input
            className={styles.codeInput}
            value={code}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label="Consent code"
          />
          <button type="button" className={styles.primary} onClick={() => onConfirm(code)}>
            Unlock
          </button>
        </div>
      )}
    </div>
  );
}
