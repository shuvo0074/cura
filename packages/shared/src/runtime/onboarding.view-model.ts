import { businessRules } from '../config/app-config';
import {
  academicDetailsSchema,
  personalDetailsSchema,
  professionalDetailsSchema,
} from '../validation/schemas';
import { ViewModel } from './view-model';
import type { OnboardingApi } from './clinical-services';

export interface OnboardingState {
  step: number;
  completedSteps: number[];
  completed: boolean;
  values: Record<string, Record<string, unknown>>;
  fieldErrors: Record<string, string>;
  formError: string | null;
  submitting: boolean;
  loading: boolean;
  /** ISO timestamp of the last successful autosave, for the "Saved" hint. */
  lastSavedAt: string | null;
  saving: boolean;
}

const STEP_SCHEMAS = {
  1: personalDetailsSchema,
  2: professionalDetailsSchema,
  3: academicDetailsSchema,
} as const;

/**
 * The 4-step account-creation wizard.
 *
 * Mirrors the server rules so the UI can gate correctly, but never *relies* on
 * doing so — the API re-checks everything. Field edits schedule a debounced
 * autosave, which is what makes an accidental refresh non-destructive.
 */
export class OnboardingViewModel extends ViewModel<OnboardingState> {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: OnboardingApi,
    private readonly onFinished: () => void,
  ) {
    super({
      step: 1,
      completedSteps: [],
      completed: false,
      values: {},
      fieldErrors: {},
      formError: null,
      submitting: false,
      loading: true,
      lastSavedAt: null,
      saving: false,
    });
  }

  async initialise(): Promise<void> {
    const result = await this.api.getState();
    if (this.isDisposed) return;

    if (!result.ok) {
      this.setState({ loading: false, formError: result.error.message });
      return;
    }

    const { step, completedSteps, completed, draft } = result.value;

    // Rehydrate each step's fields from the server-side draft.
    const values: Record<string, Record<string, unknown>> = {};
    for (const key of Object.keys(draft)) {
      if (/^step[1-4]$/.test(key)) {
        values[key] = draft[key] as Record<string, unknown>;
      }
    }

    this.setState({ step: step || 1, completedSteps, completed, values, loading: false });
    if (completed) this.onFinished();
  }

  get totalSteps(): number {
    return businessRules.onboarding.totalSteps;
  }

  canSkip(step: number): boolean {
    return (businessRules.onboarding.skippableSteps as readonly number[]).includes(step);
  }

  /** True when the client believes the gate for `step` is satisfied. */
  canEnter(step: number): boolean {
    if (step === 1) return true;
    const required = step === 3 ? [1, 2] : [1];
    return required.every((r) => this.state.completedSteps.includes(r));
  }

  field(step: number, name: string): unknown {
    return this.state.values[`step${step}`]?.[name];
  }

  setField(step: number, name: string, value: unknown): void {
    const key = `step${step}`;
    const next = { ...(this.state.values[key] ?? {}), [name]: value };

    this.setState({
      values: { ...this.state.values, [key]: next },
      fieldErrors: { ...this.state.fieldErrors, [name]: '' },
      formError: null,
    });

    this.scheduleAutosave(step, next);
  }

  goToStep(step: number): void {
    if (!this.canEnter(step)) {
      this.setState({ formError: `Complete the earlier steps before opening step ${step}.` });
      return;
    }
    this.setState({ step, formError: null, fieldErrors: {} });
  }

  async submitCurrentStep(): Promise<void> {
    const { step, submitting } = this.state;
    if (submitting) return;

    const payload = this.state.values[`step${step}`] ?? {};
    const schema = STEP_SCHEMAS[step as 1 | 2 | 3];

    // Steps 1–3 validate locally first so the user sees field errors without a
    // round trip. Step 4 has no schema — documents are uploaded separately.
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          fieldErrors[key] ??= issue.message;
        }
        this.setState({ fieldErrors });
        return;
      }
    }

    this.setState({ submitting: true, formError: null, fieldErrors: {} });
    const result = await this.api.submitStep(step, payload);
    if (this.isDisposed) return;
    this.setState({ submitting: false });

    if (!result.ok) {
      this.setState({
        formError: result.error.message,
        fieldErrors: this.flattenFieldErrors(result.error.fieldErrors),
      });
      return;
    }

    this.applyServerState(result.value);
  }

  async skipCurrentStep(): Promise<void> {
    const { step } = this.state;
    if (!this.canSkip(step)) {
      this.setState({ formError: 'This step is required and cannot be skipped.' });
      return;
    }

    this.setState({ submitting: true, formError: null });
    const result = await this.api.skipStep(step);
    if (this.isDisposed) return;
    this.setState({ submitting: false });

    if (!result.ok) {
      this.setState({ formError: result.error.message });
      return;
    }
    this.applyServerState(result.value);
  }

  async finish(): Promise<void> {
    this.setState({ submitting: true, formError: null });
    const result = await this.api.finish();
    if (this.isDisposed) return;
    this.setState({ submitting: false });

    if (!result.ok) {
      this.setState({ formError: result.error.message });
      return;
    }
    this.applyServerState(result.value);
    if (result.value.completed) this.onFinished();
  }

  back(): void {
    this.setState({ step: Math.max(1, this.state.step - 1), formError: null });
  }

  override dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    super.dispose();
  }

  // -------------------------------------------------------------------------

  /**
   * Debounced autosave. Coalesces keystrokes into one request so typing a name
   * does not produce a write per character.
   */
  private scheduleAutosave(step: number, payload: Record<string, unknown>): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(() => {
      void (async () => {
        this.setState({ saving: true });
        const result = await this.api.saveDraft(step, payload);
        if (this.isDisposed) return;
        this.setState({
          saving: false,
          ...(result.ok ? { lastSavedAt: result.value.savedAt } : {}),
        });
      })();
    }, businessRules.onboarding.autosaveDebounceMs);
  }

  private applyServerState(next: {
    step: number;
    completedSteps: number[];
    completed: boolean;
  }): void {
    this.setState({
      step: Math.min(next.step, this.totalSteps),
      completedSteps: next.completedSteps,
      completed: next.completed,
    });
  }

  private flattenFieldErrors(errors?: Record<string, string[]>): Record<string, string> {
    if (!errors) return {};
    const out: Record<string, string> = {};
    for (const [key, messages] of Object.entries(errors)) {
      const field = key.split('.')[0] ?? key;
      out[field] ??= messages[0] ?? 'Invalid value';
    }
    return out;
  }
}
