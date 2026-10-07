import DoctorCard from './DoctorCard';
import { useTranslation } from 'react-i18next';
import EmptyState from '../ui/EmptyState';

export default function DoctorGrid({ doctors }) {
  const { t } = useTranslation();
  if (!doctors || doctors.length === 0) {
    return <EmptyState title={t('no_results')} />;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {doctors.map(doc => <DoctorCard key={doc.id} doctor={doc} />)}
    </div>
  );
}
