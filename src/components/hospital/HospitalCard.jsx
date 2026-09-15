import { Phone, Globe, Navigation, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HospitalCard({ hospital }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function openMaps() {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`, '_blank');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <img src={hospital.photo} alt={hospital.name} className="w-full h-36 object-cover" />
      <div className="p-4">
        <h3 className="font-semibold text-gray-800">{hospital.name}</h3>
        <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
          <MapPin size={11} /> {t('location')}: {hospital.location}
        </p>
        <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
          <Phone size={11} /> {t('hotline')}: {hospital.hotline}
        </p>

        <div className="flex gap-2 mt-3">
          <a href={`tel:${hospital.hotline}`}
            className="flex-1 flex items-center justify-center gap-1 bg-primary text-white text-xs py-1.5 rounded-lg font-medium">
            <Phone size={12} /> {t('call')}
          </a>
          <a href={hospital.website} target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 border border-gray-300 text-gray-600 text-xs py-1.5 rounded-lg font-medium">
            <Globe size={12} /> {t('website')}
          </a>
          <button onClick={openMaps}
            className="flex-1 flex items-center justify-center gap-1 border border-gray-300 text-gray-600 text-xs py-1.5 rounded-lg font-medium">
            <Navigation size={12} /> {t('direction')}
          </button>
        </div>

        <button onClick={() => navigate(`/hospitals/${hospital.id}`)}
          className="w-full mt-3 flex items-center justify-center gap-1 border border-primary text-primary text-xs py-2 rounded-lg font-medium">
          {t('show_all_doctors')} <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
