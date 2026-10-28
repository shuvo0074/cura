import { ageFromDateOfBirth, initials, type Patient } from '@cura/shared';
import styles from './patient.module.css';

/** Identity strip: who this record belongs to, and how to reach them. */
export function PatientHeader({
  patient,
  onEditProfile,
}: {
  patient: Patient | null;
  onEditProfile: () => void;
}) {
  if (!patient) return <div className={styles.identity} aria-busy="true" />;

  const age = ageFromDateOfBirth(patient.dateOfBirth);

  return (
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">
        {initials(patient.fullName)}
      </span>

      <div className={styles.identityMain}>
        <h1 className={styles.patientName}>
          {patient.fullName} <span className={styles.curaId}>({patient.curaId})</span>
        </h1>
        <p className={styles.biometrics}>
          {[
            patient.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : null,
            age !== null ? `${age} years` : null,
            patient.bloodGroup,
          ]
            .filter(Boolean)
            .join(' · ') || 'Profile incomplete'}
        </p>
      </div>

      <div className={styles.contact}>
        <span>{patient.mobile}</span>
        <span className={styles.muted}>{patient.email ?? 'No email on file'}</span>
      </div>

      <button type="button" className={styles.ghost} onClick={onEditProfile}>
        Edit profile
      </button>
    </div>
  );
}
