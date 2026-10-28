import { useCallback, useEffect, useState } from 'react';
import { PatientDashboardViewModel, useViewModel, type Patient } from '@cura/shared';
import { useServices } from '../../app/services';
import { ConsentPanel } from './ConsentGate';
import { PatientHeader } from './PatientHeader';
import { PatientFiles } from './PatientFiles';
import { PatientBilling } from './PatientBilling';
import { VitalsEditor } from './VitalsEditor';
import { ClinicalNotesEditor } from './ClinicalNotesEditor';
import { PrescriptionEditor } from './PrescriptionEditor';
import { TimelineEntry } from './TimelineEntry';
import { EditPatientDialog } from './EditPatientDialog';
import styles from './patient.module.css';

type Tab = 'charting' | 'files' | 'billing';

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'charting', label: 'Charting' },
  { key: 'files', label: 'Files' },
  { key: 'billing', label: 'Billing' },
];

/**
 * Patient record.
 *
 * Left: the clinical timeline, with an explicit locked-history panel when
 * records fall outside the privacy window. Right: the working area for the open
 * encounter — vitals, notes and prescription — plus the files and billing tabs.
 */
export function PatientDashboardView({
  practiceId,
  patientId,
  appointmentId,
  canWrite = true,
  onClose,
}: {
  practiceId: string;
  patientId: string;
  appointmentId?: string | undefined;
  canWrite?: boolean;
  onClose: () => void;
}) {
  const { clinical, settings, http } = useServices();
  const [state, vm] = useViewModel(
    () => new PatientDashboardViewModel(clinical, settings, practiceId, patientId),
  );

  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>('charting');
  const [editing, setEditing] = useState(false);

  const loadPatient = useCallback(async () => {
    const result = await http.request<Patient>(`/patients/${patientId}`, { query: { practiceId } });
    if (result.ok) setPatient(result.value);
  }, [http, practiceId, patientId]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  useEffect(() => {
    void vm.loadTimeline();
    void vm.loadComplaintSuggestions();
    if (appointmentId) void vm.openEncounter(appointmentId);
  }, [vm, appointmentId]);

  const signed = state.activeEncounter !== null && state.activeEncounter.signedAt !== null;
  const editable = canWrite && !signed;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onClose}>
          ← Back
        </button>
        {state.saving && <span className={styles.busy}>Saving…</span>}
      </header>

      <PatientHeader patient={patient} onEditProfile={() => setEditing(true)} />

      <nav className={styles.tabs} role="tablist" aria-label="Record sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-active={tab === t.key || undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.columns}>
        <section className={styles.timeline} aria-label="Clinical timeline">
          <h2 className={styles.sectionTitle}>Timeline</h2>

          {state.hasLockedHistory && (
            <ConsentPanel
              windowDays={state.privacyWindowDays}
              challengeOpen={state.consentChallengeId !== null}
              maskedTarget={state.consentMaskedTarget}
              onRequest={() => void vm.requestConsent()}
              onConfirm={(code) => void vm.confirmConsent(code)}
            />
          )}

          {state.loading && <p className={styles.muted}>Loading history…</p>}
          {!state.loading && state.entries.length === 0 && (
            <p className={styles.muted}>
              No visits recorded in the last {state.privacyWindowDays} days.
            </p>
          )}

          {state.entries.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </section>

        <section className={styles.editor} aria-label={TABS.find((t) => t.key === tab)?.label}>
          {tab === 'charting' &&
            (!state.activeEncounter ? (
              <p className={styles.muted}>
                Open an appointment from the calendar to record this visit.
              </p>
            ) : (
              <>
                {signed && <span className={styles.signedBadge}>Signed — read only</span>}

                <VitalsEditor
                  vm={vm}
                  vitals={state.vitals}
                  disabled={!editable}
                  saving={state.saving}
                  fieldErrors={state.fieldErrors}
                />

                <ClinicalNotesEditor
                  vm={vm}
                  practiceId={practiceId}
                  note={state.note}
                  disabled={!editable}
                  saving={state.saving}
                />

                <PrescriptionEditor vm={vm} state={state} disabled={!editable} />
              </>
            ))}

          {tab === 'files' && (
            <PatientFiles practiceId={practiceId} patientId={patientId} canWrite={canWrite} />
          )}

          {tab === 'billing' && patient && (
            <PatientBilling
              practiceId={practiceId}
              patient={{ id: patient.id, fullName: patient.fullName }}
              encounterId={state.activeEncounter?.id}
              canWrite={canWrite}
            />
          )}
        </section>
      </div>

      {editing && patient && (
        <EditPatientDialog
          practiceId={practiceId}
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void loadPatient();
          }}
        />
      )}
    </div>
  );
}
