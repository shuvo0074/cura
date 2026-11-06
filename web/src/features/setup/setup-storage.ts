/**
 * What this browser remembers about one clinic's setup checklist. Whether a
 * step is done always comes from the API; only the owner's choices live here.
 */
export interface SetupMemory {
  /** "Hide for now" was chosen. */
  hidden: boolean;
  /** The checklist was shown with work left, so finishing it earns the message. */
  seenIncomplete: boolean;
  /** "Your clinic is ready" was already shown. */
  celebrated: boolean;
}

const EMPTY: SetupMemory = { hidden: false, seenIncomplete: false, celebrated: false };

const keyFor = (practiceId: string) => `cura.setup-checklist.${practiceId}`;

export function readSetupMemory(practiceId: string): SetupMemory {
  try {
    const raw = localStorage.getItem(keyFor(practiceId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SetupMemory>;
    return {
      hidden: parsed.hidden === true,
      seenIncomplete: parsed.seenIncomplete === true,
      celebrated: parsed.celebrated === true,
    };
  } catch {
    return EMPTY;
  }
}

export function writeSetupMemory(practiceId: string, patch: Partial<SetupMemory>): void {
  try {
    localStorage.setItem(keyFor(practiceId), JSON.stringify({ ...readSetupMemory(practiceId), ...patch }));
  } catch {
    // Storage blocked (private window, quota): the card just shows again next time.
  }
}

/** "Setup checklist" in the profile menu: show it again, ready message included. */
export function revealSetupChecklist(practiceId: string): void {
  writeSetupMemory(practiceId, { hidden: false, seenIncomplete: true, celebrated: false });
}
