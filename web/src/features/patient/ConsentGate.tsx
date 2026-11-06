import { useState } from 'react';
import { useT } from '../../i18n';
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
  const { t } = useT();
  const [code, setCode] = useState('');

  return (
    <div className={styles.consent}>
      <p className={styles.consentText}>
        {t('patients.consent.locked', { days: windowDays })}
      </p>
      {!challengeOpen ? (
        <button type="button" className={styles.ghost} onClick={onRequest}>
          {t('patients.consent.request')}
        </button>
      ) : (
        <div className={styles.consentRow}>
          <span className={styles.muted}>{t('patients.consent.codeSent', { to: maskedTarget ?? '' })}</span>
          <input
            className={styles.codeInput}
            value={code}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-label={t('patients.consent.codeLabel')}
          />
          <button type="button" className={styles.primary} onClick={() => onConfirm(code)}>
            {t('patients.consent.unlock')}
          </button>
        </div>
      )}
    </div>
  );
}
