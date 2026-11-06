import { useEffect, useRef, useState } from 'react';
import {
  BloodGroup,
  Gender,
  VisitType,
  businessRules,
  type Appointment,
  type BookableDoctor,
  type Patient,
} from '@cura/shared';
import { useServices } from '../../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../../ui';
import { useT } from '../../../i18n';
import styles from './header.module.css';

/**
 * Patient Intake Action (spec 6.3.3).
 *
 * A modal, not a route: the doctor registers a patient without losing their
 * place on the calendar or an open record. Registering and booking happen in
 * one request — the appointment endpoint accepts inline patient details and
 * creates both, so a failure cannot leave a patient with no appointment.
 */
export function PatientIntakeModal({
  practiceId,
  defaultDoctorId,
  defaultAt,
  onClose,
  onCreated,
}: {
  practiceId: string;
  /** Preselected doctor; otherwise the practice's lead consultant. */
  defaultDoctorId?: string | undefined;
  /** Walk-ins default to now; a slot click passes the slot's time. */
  defaultAt?: Date;
  onClose: () => void;
  /** Carries the new appointment so the record opens ready to chart it. */
  onCreated: (patientId: string, appointmentId: string) => void;
}) {
  const { http, appointments } = useServices();
  const { t, tm, rich } = useT();
  const [doctors, setDoctors] = useState<BookableDoctor[] | null>(null);
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? '');

  useEffect(() => {
    let cancelled = false;
    void appointments.listDoctors(practiceId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDoctors(result.value);
      // Keep the preselection only if it is a doctor here; else the lead.
      setDoctorId((current) =>
        result.value.some((d) => d.id === current) ? current : (result.value[0]?.id ?? ''),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [appointments, practiceId]);
  const [form, setForm] = useState(() => {
    const at = defaultAt ?? new Date();
    // datetime-local wants wall-clock text, so the offset is removed rather
    // than using toISOString(), which would shift the value to UTC.
    const local = new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    return {
      mobile: '',
      fullName: '',
      gender: '',
      ageYears: '',
      dateOfBirth: '',
      bloodGroup: '',
      email: '',
      address: '',
      visitType: VisitType.NEW as string,
      scheduledAt: local,
      durationMinutes: businessRules.calendar.defaultSlotMinutes as number,
      notes: '',
    };
  });
  const [matches, setMatches] = useState<Patient[]>([]);
  const [linked, setLinked] = useState<Patient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Real-time identification (spec): as the mobile or name is typed, look for
  // an existing profile so the same person is not registered twice.
  useEffect(() => {
    if (linked) return;
    const probe = form.mobile.trim().length >= 4 ? form.mobile.trim() : form.fullName.trim();
    if (probe.length < businessRules.search.minQueryLength) {
      setMatches([]);
      return;
    }

    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;

    const timer = setTimeout(async () => {
      const result = await http.request<Patient[]>('/patients/search', {
        query: { practiceId, q: probe },
        signal: controller.signal,
      });
      if (!controller.signal.aborted && result.ok) setMatches(result.value);
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.mobile, form.fullName, linked, http, practiceId]);

  /** Auto-fill from an existing profile; scheduling and notes stay blank. */
  const adopt = (patient: Patient) => {
    setLinked(patient);
    setMatches([]);
    setForm((f) => ({
      ...f,
      mobile: patient.mobile,
      fullName: patient.fullName,
      gender: patient.gender ?? '',
      dateOfBirth: patient.dateOfBirth ?? '',
      bloodGroup: patient.bloodGroup ?? '',
      email: patient.email ?? '',
      // A returning patient is a follow-up by default, not a new visit.
      visitType: VisitType.FOLLOW_UP,
    }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);

    const scheduledAt = new Date(form.scheduledAt);
    const body = {
      practiceId,
      doctorId,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: form.durationMinutes,
      visitType: form.visitType,
      plannedProcedures: [],
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(linked
        ? { patientId: linked.id }
        : {
            patient: {
              mobile: form.mobile.trim(),
              fullName: form.fullName.trim(),
              ...(form.gender ? { gender: form.gender } : {}),
              ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
              ...(form.ageYears ? { ageYears: Number(form.ageYears) } : {}),
              ...(form.bloodGroup ? { bloodGroup: form.bloodGroup } : {}),
              ...(form.email.trim() ? { email: form.email.trim() } : {}),
              ...(form.address.trim() ? { address: form.address.trim() } : {}),
            },
          }),
    };

    const result = await http.request<Appointment>('/appointments', {
      method: 'POST',
      body,
      retry: false,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onCreated(result.value.patientId, result.value.id);
  };

  return (
    <Modal
      title={linked ? t('patients.intake.titleExisting', { name: linked.fullName }) : t('patients.intake.titleNew')}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={s.primary}
            onClick={() => void submit()}
            disabled={busy || !doctorId || form.fullName.trim() === '' || form.mobile.trim() === ''}
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      {linked && (
        <div className={styles.linked}>
          {rich('patients.intake.bookingFor', { id: linked.curaId }, { name: <strong>{linked.fullName}</strong> })}
          <button
            type="button"
            className={s.linkButton}
            onClick={() => {
              setLinked(null);
              setForm((f) => ({ ...f, visitType: VisitType.NEW }));
            }}
          >
            {t('patients.intake.registerNew')}
          </button>
        </div>
      )}

      <Row cols={2}>
        <Field label={t('patients.intake.mobile')} required hint={t('patients.intake.mobileHint')}>
          <input
            className={s.input}
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label={t('patients.intake.name')} required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
      </Row>

      {!linked && matches.length > 0 && (
        <div className={styles.matches}>
          <p>{t('patients.intake.matches')}</p>
          <ul>
            {matches.map((patient) => (
              <li key={patient.id}>
                <button type="button" onClick={() => adopt(patient)}>
                  <strong>{patient.fullName}</strong>
                  <span>
                    {patient.curaId} · {patient.mobile}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Row>
        <Field label={t('patients.field.gender')}>
          <select className={s.input} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            {Object.values(Gender).map((g) => (
              <option key={g} value={g}>
                {t(`common.gender.${g}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('patients.field.dateOfBirth')}>
          <input
            className={s.input}
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </Field>
        <Field label={t('patients.intake.age')}>
          <input
            className={s.input}
            inputMode="numeric"
            value={form.ageYears}
            onChange={(e) => set('ageYears', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
      </Row>

      <Row>
        <Field label={t('patients.field.bloodGroup')}>
          <select className={s.input} value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
            <option value="">—</option>
            {Object.values(BloodGroup).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('patients.field.email')}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label={t('patients.intake.visitType')}>
          <select className={s.input} value={form.visitType} onChange={(e) => set('visitType', e.target.value)}>
            <option value={VisitType.NEW}>{t('common.visitType.NEW')}</option>
            <option value={VisitType.FOLLOW_UP}>{t('common.visitType.FOLLOW_UP')}</option>
            <option value={VisitType.OLD}>{t('patients.intake.reportShow')}</option>
          </select>
        </Field>
      </Row>

      <Row>
        <Field label={t('patients.intake.doctor')} required>
          <select
            className={s.input}
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={!doctors}
          >
            {!doctors && <option value="">{t('common.loading')}</option>}
            {doctors?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('patients.intake.scheduledOn')} required>
          <input
            className={s.input}
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set('scheduledAt', e.target.value)}
          />
        </Field>
        <Field label={t('patients.intake.duration')}>
          <select
            className={s.input}
            value={form.durationMinutes}
            onChange={(e) => set('durationMinutes', Number(e.target.value))}
          >
            {businessRules.calendar.allowedSlotMinutes.map((n) => (
              <option key={n} value={n}>
                {t('common.minutes', { count: n })}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <Field label={t('patients.intake.address')}>
        <input className={s.input} value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>

      <Field label={t('patients.intake.notes')} hint={t('patients.intake.notesHint')}>
        <textarea
          className={s.textarea}
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={t('patients.intake.notesPlaceholder')}
        />
      </Field>
    </Modal>
  );
}
