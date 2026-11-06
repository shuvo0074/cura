import { useT } from '../../../i18n';
import { ActivityLog } from '../../audit/ActivityLog';

/** Every audit row across Cura, with a clinic filter. */
export function ActivityLogPanel() {
  const { t } = useT();
  return (
    <ActivityLog
      path="/directory/admin/audit-log"
      title={t('admin.activity.title')}
      description={t('admin.activity.description')}
      allClinics
    />
  );
}
