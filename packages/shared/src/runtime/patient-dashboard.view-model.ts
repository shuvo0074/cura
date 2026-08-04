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

  private adoptEncounter(encounter: EncounterView): void {
    const rows: PrescriptionRow[] = (encounter.prescription?.items ?? []).map((item) => ({
      ...item,
      key: Math.random().toString(36).slice(2),
    }));
    rows.push(emptyRow());

    this.setState({
      activeEncounter: encounter,
      rows,
      investigations: encounter.prescription?.investigations ?? [],
      followUpDate: encounter.prescription?.followUpDate ?? null,
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
