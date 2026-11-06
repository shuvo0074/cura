import { useT } from '../../../i18n';
import { ActivityLog } from '../../audit/ActivityLog';

/** A clinic owner's activity log: this clinic only, including super admin reads of it. */
export function ActivityPanel({ practiceId }: { practiceId: string }) {
  const { t } = useT();
  return (
    <ActivityLog
      path="/audit-log"
      scope={{ practiceId }}
      title={t('settings.activity.title')}
      description={t('settings.activity.description')}
    />
  );
}
