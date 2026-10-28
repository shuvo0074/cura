import { prescriptionSchema } from '../validation/schemas';
import { ViewModel } from './view-model';
import type {
  ClinicalApi,
  DrugSuggestion,
  EncounterPrescriptionItem,
  EncounterView,
  SettingsApi,
} from './clinical-services';

export interface PrescriptionRow extends EncounterPrescriptionItem {
  /** Local key so React can track rows across reorders without index keys. */
  key: string;
}

export interface PatientDashboardState {
  patientId: string;
  entries: EncounterView[];
  activeEncounter: EncounterView | null;
  rows: PrescriptionRow[];
  investigations: string[];
  followUpDate: string | null;

  drugQuery: string;
  drugSuggestions: DrugSuggestion[];
  /** Index of the row whose drug field currently owns the suggestion list. */
  suggestionRow: number | null;

  complaintSuggestions: string[];

  /** Draft vitals and clinical note for the open encounter. */
  vitals: VitalsDraft;
  note: NoteDraft;

  privacyWindowDays: number;
  hasLockedHistory: boolean;
  consentGrantedUntil: string | null;
  consentChallengeId: string | null;
  consentMaskedTarget: string | null;

  loading: boolean;
  saving: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

/** Vitals are held as strings so a half-typed "12" is not coerced to a number. */
export interface VitalsDraft {
  weightKg: string;
  systolic: string;
  diastolic: string;
  pulseBpm: string;
  temperatureC: string;
  respiratoryRate: string;
}

export interface NoteDraft {
  complaints: string[];
  observations: string[];
  diagnoses: string[];
  advice: string[];
  notes: string;
}

export type NoteListField = 'complaints' | 'observations' | 'diagnoses' | 'advice';

/** Collapses the API's per-field error arrays into one message each. */
const flatten = (errors: Record<string, string[]> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(errors ?? {}).map(([k, v]) => [k, v[0] ?? '']));

const emptyVitals = (): VitalsDraft => ({
  weightKg: '',
  systolic: '',
  diastolic: '',
  pulseBpm: '',
  temperatureC: '',
  respiratoryRate: '',
});

const emptyNote = (): NoteDraft => ({
  complaints: [],
  observations: [],
  diagnoses: [],
  advice: [],
  notes: '',
});

const emptyRow = (): PrescriptionRow => ({
  key: Math.random().toString(36).slice(2),
  drugName: '',
  strength: null,
  form: null,
  durationDays: null,
  morning: 0,
  noon: 0,
  night: 0,
  mealRelation: 'ANY',
  instruction: null,
});

/**
 * Patient dashboard: clinical timeline plus the prescription writer.
 *
 * Behaviour worth noting:
 *  - The prescription grid always keeps one blank trailing row, which is the
 *    spec's "smart grid" — the doctor never clicks "add row".
 *  - Drug and complaint lookups are debounced and cancellable, so fast typing
 *    does not queue a request per keystroke.
 *  - Locked history is surfaced explicitly rather than silently truncating the
 *    list, and the consent handshake is driven from here.
 */
export class PatientDashboardViewModel extends ViewModel<PatientDashboardState> {
  private timelineRequest: AbortController | null = null;
  private suggestRequest: AbortController | null = null;
  private suggestTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly clinical: ClinicalApi,
    private readonly settings: SettingsApi,
    private readonly practiceId: string,
    patientId: string,
  ) {
    super({
      patientId,
      entries: [],
      activeEncounter: null,
      rows: [emptyRow()],
      investigations: [],
      followUpDate: null,
      drugQuery: '',
      drugSuggestions: [],
      suggestionRow: null,
      complaintSuggestions: [],
      vitals: emptyVitals(),
      note: emptyNote(),
      privacyWindowDays: 90,
      hasLockedHistory: false,
      consentGrantedUntil: null,
      consentChallengeId: null,
      consentMaskedTarget: null,
      loading: false,
      saving: false,
      error: null,
      fieldErrors: {},
    });
  }

  async loadTimeline(): Promise<void> {
    this.timelineRequest?.abort();
    const controller = new AbortController();
    this.timelineRequest = controller;

    this.setState({ loading: true, error: null });
    const result = await this.clinical.timeline(
      this.practiceId,
      this.state.patientId,
      undefined,
      controller.signal,
    );
    if (controller.signal.aborted || this.isDisposed) return;

    if (!result.ok) {
      this.setState({ loading: false, error: result.error.message });
      return;
    }

    this.setState({
      loading: false,
      entries: result.value.entries,
      privacyWindowDays: result.value.privacyWindowDays,
      hasLockedHistory: result.value.hasLockedHistory,
      consentGrantedUntil: result.value.consentGrantedUntil,
    });
  }

  /** Opens the encounter for an appointment and loads any existing content. */
  async openEncounter(appointmentId: string): Promise<void> {
    this.setState({ saving: true, error: null });
    const result = await this.clinical.openEncounter(this.practiceId, appointmentId);
    if (this.isDisposed) return;
    this.setState({ saving: false });

    if (!result.ok) {
      this.setState({ error: result.error.message });
      return;
    }
    this.adoptEncounter(result.value);
  }

  // -- Prescription grid ----------------------------------------------------

  setRowField<K extends keyof EncounterPrescriptionItem>(
    index: number,
    field: K,
    value: EncounterPrescriptionItem[K],
  ): void {
    const rows = this.state.rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));

    // Keep exactly one blank trailing row so the grid grows as it is filled.
    const last = rows[rows.length - 1];
    if (last && last.drugName.trim() !== '') rows.push(emptyRow());

    this.setState({ rows, fieldErrors: {} });

    if (field === 'drugName') {
      this.scheduleDrugSearch(index, String(value ?? ''));
    }
  }

  removeRow(index: number): void {
    const rows = this.state.rows.filter((_, i) => i !== index);
    this.setState({ rows: rows.length > 0 ? rows : [emptyRow()] });
  }

  applyDrugSuggestion(index: number, suggestion: DrugSuggestion): void {
    const rows = this.state.rows.map((row, i) =>
      i === index
        ? {
            ...row,
            drugName: suggestion.name,
            strength: suggestion.strength,
            form: suggestion.form,
            instruction: suggestion.instruction,
          }
        : row,
    );
    const last = rows[rows.length - 1];
    if (last && last.drugName.trim() !== '') rows.push(emptyRow());

    this.setState({ rows, drugSuggestions: [], suggestionRow: null });
  }

  setInvestigations(values: string[]): void {
    this.setState({ investigations: values });
  }

  setFollowUpDate(value: string | null): void {
    this.setState({ followUpDate: value });
  }

  /** Loads the complaint catalog that backs the clinical-note checklist. */
  async loadComplaintSuggestions(): Promise<void> {
    const result = await this.settings.listCatalog(this.practiceId, 'COMPLAINT');
    if (this.isDisposed || !result.ok) return;
    this.setState({ complaintSuggestions: result.value.map((r) => r.value) });
  }

  async savePrescription(): Promise<void> {
    const encounter = this.state.activeEncounter;
    if (!encounter || this.state.saving) return;

    const items = this.state.rows
      .filter((row) => row.drugName.trim() !== '')
      .map(({ key: _key, ...item }) => item);

    const parsed = prescriptionSchema.safeParse({
      items,
      investigations: this.state.investigations,
      ...(this.state.followUpDate ? { followUpDate: this.state.followUpDate } : {}),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.') || 'form'] = issue.message;
      }
      this.setState({ fieldErrors });
      return;
    }

    this.setState({ saving: true, error: null, fieldErrors: {} });
    const result = await this.clinical.savePrescription(
      this.practiceId,
      encounter.id,
      parsed.data,
    );
    if (this.isDisposed) return;
    this.setState({ saving: false });

    if (!result.ok) {
      this.setState({ error: result.error.message });
      return;
    }
    this.adoptEncounter(result.value);
  }

  /** Signs the encounter — after this the record is immutable. */
  async signEncounter(): Promise<void> {
    const encounter = this.state.activeEncounter;
    if (!encounter) return;

    this.setState({ saving: true, error: null });
    const result = await this.clinical.sign(this.practiceId, encounter.id);
    if (this.isDisposed) return;
    this.setState({ saving: false });

    if (!result.ok) {
      this.setState({ error: result.error.message });
      return;
    }
    this.adoptEncounter(result.value);
    await this.loadTimeline();
  }

  // -- Consent --------------------------------------------------------------

  async requestConsent(): Promise<void> {
    this.setState({ saving: true, error: null });
    const result = await this.clinical.requestConsent(this.practiceId, this.state.patientId);
    if (this.isDisposed) return;
    this.setState({ saving: false });

    if (!result.ok) {
      this.setState({ error: result.error.message });
      return;
    }
    this.setState({
      consentChallengeId: result.value.challengeId,
      consentMaskedTarget: result.value.maskedDestination,
    });
  }

  async confirmConsent(code: string): Promise<void> {
    const challengeId = this.state.consentChallengeId;
    if (!challengeId) return;

    this.setState({ saving: true, error: null });
    const result = await this.clinical.confirmConsent(this.practiceId, challengeId, code);
    if (this.isDisposed) return;
    this.setState({ saving: false });

    if (!result.ok) {
      this.setState({ error: result.error.message });
      return;
    }

    this.setState({ consentChallengeId: null, consentMaskedTarget: null });
    await this.loadTimeline();
  }

  override dispose(): void {
    this.timelineRequest?.abort();
    this.suggestRequest?.abort();
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    super.dispose();
  }

  // -------------------------------------------------------------------------

  setVital(field: keyof VitalsDraft, value: string): void {
    this.setState({ vitals: { ...this.state.vitals, [field]: value } });
  }

  setNoteList(field: NoteListField, values: string[]): void {
    this.setState({ note: { ...this.state.note, [field]: values } });
  }

  setNoteText(value: string): void {
    this.setState({ note: { ...this.state.note, notes: value } });
  }

  /**
   * Saves vitals.
   *
   * Blank fields are omitted rather than sent as 0 — the schema treats every
   * reading as optional, and a zero pulse is a clinical claim, not "unknown".
   */
  async saveVitals(): Promise<void> {
    const encounter = this.state.activeEncounter;
    if (!encounter) return;

    const numeric = (raw: string): number | undefined => {
      const trimmed = raw.trim();
      if (trimmed === '') return undefined;
      const value = Number(trimmed);
      return Number.isFinite(value) ? value : undefined;
    };

    const body: Record<string, number> = {};
    for (const [key, raw] of Object.entries(this.state.vitals)) {
      const value = numeric(raw);
      if (value !== undefined) body[key] = value;
    }

    this.setState({ saving: true, error: null, fieldErrors: {} });
    const result = await this.clinical.saveVitals(this.practiceId, encounter.id, body);
    this.setState({ saving: false });

    if (result.ok) this.adoptEncounter(result.value);
    else this.setState({ error: result.error.message, fieldErrors: flatten(result.error.fieldErrors) });
  }

  async saveNote(): Promise<void> {
    const encounter = this.state.activeEncounter;
    if (!encounter) return;

    const { notes, ...lists } = this.state.note;
    this.setState({ saving: true, error: null, fieldErrors: {} });

    const result = await this.clinical.saveNote(this.practiceId, encounter.id, {
      ...lists,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    this.setState({ saving: false });

    if (result.ok) this.adoptEncounter(result.value);
    else this.setState({ error: result.error.message, fieldErrors: flatten(result.error.fieldErrors) });
  }

  private adoptEncounter(encounter: EncounterView): void {
    const rows: PrescriptionRow[] = (encounter.prescription?.items ?? []).map((item) => ({
      ...item,
      key: Math.random().toString(36).slice(2),
    }));
    rows.push(emptyRow());

    const v = encounter.vitals;
    const n = encounter.clinicalNote;

    this.setState({
      activeEncounter: encounter,
      rows,
      investigations: encounter.prescription?.investigations ?? [],
      followUpDate: encounter.prescription?.followUpDate ?? null,
      vitals: {
        // `?? ''` rather than `String(x ?? '')` so a stored 0 still renders.
        weightKg: v?.weightKg != null ? String(v.weightKg) : '',
        systolic: v?.systolic != null ? String(v.systolic) : '',
        diastolic: v?.diastolic != null ? String(v.diastolic) : '',
        pulseBpm: v?.pulseBpm != null ? String(v.pulseBpm) : '',
        temperatureC: v?.temperatureC != null ? String(v.temperatureC) : '',
        respiratoryRate: v?.respiratoryRate != null ? String(v.respiratoryRate) : '',
      },
      note: {
        complaints: n?.complaints ?? [],
        observations: n?.observations ?? [],
        diagnoses: n?.diagnoses ?? [],
        advice: n?.advice ?? [],
        notes: n?.notes ?? '',
      },
    });
  }

  private scheduleDrugSearch(rowIndex: number, term: string): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer);

    if (term.trim().length < 2) {
      this.setState({ drugSuggestions: [], suggestionRow: null });
      return;
    }

    this.suggestTimer = setTimeout(() => {
      void (async () => {
        this.suggestRequest?.abort();
        const controller = new AbortController();
        this.suggestRequest = controller;

        const result = await this.settings.searchDrugs(this.practiceId, term, controller.signal);
        if (controller.signal.aborted || this.isDisposed || !result.ok) return;

        this.setState({ drugSuggestions: result.value, suggestionRow: rowIndex });
      })();
    }, 200);
  }
}
