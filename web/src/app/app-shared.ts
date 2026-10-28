/** Types shared by the app router. */

import type { AuthenticatedUser } from '@cura/shared';
import type { RouteKey } from '../features/shell/navigation';
import type { SettingsKey } from '../features/settings/settings-nav';

export type SessionState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser };

/**
 * A patient record is opened *over* whichever module you were in, and closing
 * it returns you there — so jumping to a chart from the calendar does not lose
 * your place, which is the whole point of the four-pane layout.
 */
export interface Location {
  route: RouteKey;
  patient?: { id: string; appointmentId?: string | undefined } | undefined;
  /** Deep-link target inside Settings, set by the profile menu. */
  settingsSection?: SettingsKey | undefined;
}
