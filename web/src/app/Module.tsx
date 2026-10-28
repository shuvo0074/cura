import { Permission } from '@cura/shared';
import { CalendarView } from '../features/calendar/CalendarView';
import { PatientsView } from '../features/patients/PatientsView';
import { SettingsView } from '../features/settings/SettingsView';
import { ReportsView } from '../features/reports/ReportsView';
import { DocumentsView } from '../features/documents/DocumentsView';
import { BillingView } from '../features/billing/BillingView';
import { ProfileView } from '../features/profile/ProfileView';
import { QueueView } from '../features/queue/QueueView';
import { CommunicationsView } from '../features/communications/CommunicationsView';
import { FeedbackView } from '../features/feedback/FeedbackView';
import { IntegrationsView } from '../features/integrations/IntegrationsView';
import { PremiumPanel } from '../features/settings/panels/PremiumPanel';
import type { RouteKey } from '../features/shell/navigation';
import type { SettingsKey } from '../features/settings/settings-nav';
import { NotBuilt } from './NotBuilt';

/** Routes a nav key to its module screen. */
export function Module({
  route,
  practiceId,
  settingsSection,
  permissions,
  onOpenPatient,
  onAddWalkIn,
  onOpenSettings,
}: {
  route: RouteKey;
  practiceId: string;
  settingsSection: SettingsKey | undefined;
  permissions: readonly Permission[];
  onOpenPatient: (patientId: string, appointmentId?: string) => void;
  /** Opens the intake modal at `at` (an empty calendar slot), or now. */
  onAddWalkIn: (at?: Date, doctorId?: string) => void;
  onOpenSettings: (section: SettingsKey) => void;
}) {
  switch (route) {
    case 'calendar':
      return (
        <CalendarView
          practiceId={practiceId}
          onOpenPatient={onOpenPatient}
          // Booking is front-desk work: a doctor sees the diary but cannot add
          // to it, so the walk-in button and slot booking are withheld rather
          // than shown failing. Rescheduling is the same permission.
          {...(permissions.includes(Permission.APPOINTMENT_WRITE) ? { onAddWalkIn } : {})}
          canReschedule={permissions.includes(Permission.APPOINTMENT_WRITE)}
          canChangeStatus={permissions.includes(Permission.APPOINTMENT_STATUS_WRITE)}
          canManageSettings={permissions.includes(Permission.SETTINGS_MANAGE)}
          canViewStaff={permissions.includes(Permission.STAFF_MANAGE)}
          {...(permissions.includes(Permission.SETTINGS_MANAGE)
            ? { onOpenCalendarSettings: () => onOpenSettings('calendar') }
            : {})}
        />
      );
    case 'patients':
      return <PatientsView practiceId={practiceId} onOpenPatient={onOpenPatient} />;
    case 'settings':
      // Keyed on the deep-link target so choosing "Account settings" from the
      // profile menu re-opens Settings on that sub-module even when Settings is
      // already the active route.
      return <SettingsView key={settingsSection ?? 'default'} practiceId={practiceId} initial={settingsSection} />;
    case 'reports':
      return <ReportsView practiceId={practiceId} />;
    case 'billing':
      return (
        <BillingView
          practiceId={practiceId}
          canWrite={permissions.includes(Permission.BILLING_WRITE)}
          onOpenPatient={onOpenPatient}
        />
      );
    case 'documents':
      return (
        <DocumentsView
          practiceId={practiceId}
          canWrite={permissions.includes(Permission.PATIENT_WRITE)}
          onOpenPatient={onOpenPatient}
        />
      );
    case 'profile':
      return <ProfileView />;
    case 'queue':
      return (
        <QueueView
          practiceId={practiceId}
          canMove={permissions.includes(Permission.APPOINTMENT_STATUS_WRITE)}
          onOpenPatient={onOpenPatient}
        />
      );
    case 'communications':
      return (
        <CommunicationsView
          practiceId={practiceId}
          canManage={permissions.includes(Permission.SETTINGS_MANAGE)}
          onOpenPatient={onOpenPatient}
        />
      );
    case 'feedback':
      return <FeedbackView practiceId={practiceId} canWrite={permissions.includes(Permission.PATIENT_WRITE)} />;
    case 'integrations':
      return <IntegrationsView />;
    case 'prime':
      // Prime Services is the subscription itself; Settings → Premium is the
      // same screen, surfaced here because the spec gives it a sidebar slot.
      return <PremiumPanel practiceId={practiceId} />;
    default:
      return <NotBuilt route={route} />;
  }
}
