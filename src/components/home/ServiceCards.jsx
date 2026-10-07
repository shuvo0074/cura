import { Link } from 'react-router-dom';
import { ArrowRight, PhoneCall, Siren } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';

function PhotoCard({ to, photo, alt, title, desc }) {
  return (
    <Link to={to} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex sm:flex-col hover:shadow-md transition-shadow">
      <img src={photo} alt={alt} loading="lazy" className="w-28 sm:w-full h-auto sm:h-40 object-cover flex-shrink-0" />
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 flex items-center justify-between gap-2">
          {title}
          <ArrowRight size={18} className="text-primary flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
        </h3>
        <p className="text-sm text-gray-600 mt-1">{desc}</p>
      </div>
    </Link>
  );
}

// The two main jobs (book a serial, find a hospital) plus a clearly separated
// emergency route — Cura isn't an emergency service, so point to 999/16263.
export default function ServiceCards() {
  const { t } = useTranslation();
  return (
    <HomeSection title={t('home_services_title')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <PhotoCard to="/doctors" photo="/landing/service-clinic.jpg" alt="A community clinic in rural Bangladesh"
          title={t('home_svc_serial_title')} desc={t('home_svc_serial_desc')} />
        <PhotoCard to="/hospitals" photo="/landing/service-hospital.jpg" alt="Mugda Medical College Hospital, Dhaka"
          title={t('home_svc_hospital_title')} desc={t('home_svc_hospital_desc')} />
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 sm:p-5 flex flex-col sm:col-span-2 lg:col-span-1">
          <h3 className="font-semibold text-red-800 flex items-center gap-2"><Siren size={20} /> {t('home_emergency_title')}</h3>
          <p className="text-sm text-red-900/80 mt-1.5">{t('home_emergency_desc')}</p>
          <div className="mt-auto pt-4 flex flex-col gap-2">
            <a href="tel:999" className="flex items-center justify-center gap-2 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
              <PhoneCall size={18} /> {t('home_call_999')}
            </a>
            <a href="tel:16263" className="flex items-center justify-center gap-2 h-11 rounded-xl border border-red-200 bg-white text-red-800 text-sm font-medium">
              <PhoneCall size={16} /> {t('home_call_16263')}
            </a>
            <p className="text-xs text-red-900/60 text-center">{t('home_emergency_note')}</p>
          </div>
        </div>
      </div>
    </HomeSection>
  );
}
