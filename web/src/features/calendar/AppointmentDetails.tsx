import { useState } from 'react';
import {
  AppointmentStatus,
  canTransition,
  initials,
  visitTypePrefix,
  type Appointment,
  type Patient,
} from '@cura/shared';
import { useResource } from '../../ui';
import { useT, type TranslationKey } from '../../i18n';
import styles from './panes.module.css';


/** The four attendance actions, in queue order. Enablement follows `canTransition`. */
const ACTIONS: ReadonlyArray<{ label: TranslationKey; to: AppointmentStatus }> = [
  { label: 'calendar.action.checkIn', to: AppointmentStatus.WAITING },
  { label: 'calendar.action.engage', to: AppointmentStatus.ENGAGED },
  { label: 'calendar.action.checkOut', to: AppointmentStatus.DONE },
  { label: 'calendar.action.noShow', to: AppointmentStatus.NO_SHOW },
  { label: 'calendar.action.cancel', to: AppointmentStatus.CANCELLED },
];

/** The API starts the notes of a visit booked by the patient online with this (English, from Cura API). */
const WEBSITE_NOTE = 'Booked on Cura Website';

/** `datetime-local` wants wall-clock text, not UTC. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/**
 * Patient details box (spec: Right Part).
 *
 * The appointment carries only a patient summary, so email and the profile
 * completion flag are read from the patient record.
 */
export function AppointmentDetails({
  practiceId,
  appointment,
  doctorName,
  canReschedule,
  canChangeStatus,
  canCancel = false,
  onChangeStatus,
  onReschedule,
  onOpenPatient,
  onBack,
}: {
  practiceId: string;
  appointment: Appointment;
  /** Whose diary the visit is in; omitted while the doctor list loads. */
  doctorName?: string | undefined;
  canReschedule: boolean;
  canChangeStatus: boolean;
  /** APPOINTMENT_CANCEL: the front desk and administrators. */
  canCancel?: boolean;
  onChangeStatus: (status: AppointmentStatus) => void;
  onReschedule: (at: Date) => Promise<boolean>;
  onOpenPatient?: ((patientId: string, appointmentId?: string) => void) | undefined;
  onBack: () => void;
}) {
  const { t, fmt } = useT();
  const { data: patient } = useResource<Patient>(`/patients/${appointment.patient.id}`, { practiceId });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = new Date(appointment.scheduledAt);
  const status = appointment.status;
  const fromWebsite = appointment.notes?.startsWith(WEBSITE_NOTE) ?? false;

  const saveTime = async () => {
    if (!editing) return;
    setSaving(true);
    const ok = await onReschedule(new Date(editing));
    setSaving(false);
    if (ok) setEditing(null);
  };

  return (
    <div className={styles.details}>
      <button type="button" className={styles.back} onClick={onBack}>
        {t('calendar.backToList')}
      </button>

      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(appointment.patient.fullName)}
        </span>
        <div>
          <h2 className={styles.detailsName}>
            <span className={styles.prefix} data-visit={appointment.visitType.toLowerCase()}>
              {visitTypePrefix[appointment.visitType]}
            </span>
            {appointment.patient.fullName}
          </h2>
          <p className={styles.detailsMeta}>
            {appointment.patient.curaId}
            {appointment.tokenNumber !== null && t('calendar.token', { number: appointment.tokenNumber })}
          </p>
          {patient && (
            <span className={styles.profileFlag} data-complete={patient.profileComplete || undefined}>
              {patient.profileComplete ? t('calendar.profileComplete') : t('calendar.profileIncomplete')}
            </span>
          )}
        </div>
      </div>

      <span className={styles.statusPill} data-status={status.toLowerCase()}>
        {t(`calendar.pill.${status.toLowerCase() as Lowercase<AppointmentStatus>}`)}
      </span>
      {fromWebsite && <span className={styles.sourceTag}>{t('calendar.bookedOnWebsite')}</span>}

      {canChangeStatus && (
        <div className={styles.actions}>
          {ACTIONS.filter((action) => canCancel || action.to !== AppointmentStatus.CANCELLED).map((action) => (
            <button
              key={action.to}
              type="button"
              onClick={() => onChangeStatus(action.to)}
              disabled={!canTransition(status, action.to)}
            >
              {t(action.label)}
            </button>
          ))}
        </div>
      )}

      <dl className={styles.facts}>
        <dt>{t('calendar.phone')}</dt>
        <dd>{appointment.patient.mobile || t('calendar.notAvailable')}</dd>
        <dt>{t('calendar.email')}</dt>
        <dd>{patient?.email ?? t('calendar.notAvailable')}</dd>
        <dt>{t('calendar.appointed')}</dt>
        <dd>
          {editing !== null ? (
            <span className={styles.editTime}>
              <input
                type="datetime-local"
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
                aria-label={t('calendar.newTime')}
              />
              <button type="button" onClick={() => void saveTime()} disabled={saving || !editing}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
            </span>
          ) : (
            <>
              {t('calendar.appointedAt', {
                date: fmt.date(start, { weekday: 'short', day: 'numeric', month: 'short' }),
                time: fmt.time(start),
                minutes: appointment.durationMinutes,
              })}
              {canReschedule && status !== AppointmentStatus.DONE && (
                <button
                  type="button"
                  className={styles.inlineLink}
                  onClick={() => setEditing(toLocalInput(appointment.scheduledAt))}
                >
                  {t('common.edit')}
                </button>
              )}
            </>
          )}
        </dd>
        {doctorName && (
          <>
            <dt>{t('calendar.doctor')}</dt>
            <dd>{doctorName}</dd>
          </>
        )}
        <dt>{t('calendar.visit')}</dt>
        <dd>{t(`common.visitType.${appointment.visitType}`)}</dd>
        <dt>{t('calendar.planned')}</dt>
        <dd>{appointment.plannedProcedures.length ? appointment.plannedProcedures.join(', ') : t('calendar.notSpecified')}</dd>
        {appointment.notes && (
          <>
            <dt>{t('calendar.notes')}</dt>
            <dd>{appointment.notes}</dd>
          </>
        )}
      </dl>

      {onOpenPatient && (
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => onOpenPatient(appointment.patient.id, appointment.id)}
        >
          {t('calendar.openRecord')}
        </button>
      )}
    </div>
  );
}
