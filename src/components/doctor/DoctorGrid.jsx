import DoctorCard from './DoctorCard';
import { useTranslation } from 'react-i18next';

export default function DoctorGrid({ doctors }) {
  const { t } = useTranslation();
  if (!doctors || doctors.length === 0) {
    return <p className="text-center text-gray-400 py-10">{t('no_results')}</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {doctors.map(doc => <DoctorCard key={doc.id} doctor={doc} />)}
    </div>
  );
}
