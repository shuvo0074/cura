import { Phone, Globe, Navigation, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withDivision } from '../../utils/place';
import Photo from '../ui/Photo';

import PlaceShareButton from './PlaceShareButton';

export default function HospitalCard({ hospital }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function openMaps(e) {
    e.stopPropagation();
    // Without coordinates, route to the name and address instead of "undefined,undefined".
    const destination = hospital.lat != null && hospital.lng != null
      ? `${hospital.lat},${hospital.lng}`
      : encodeURIComponent([hospital.name, hospital.address].filter(Boolean).join(', '));
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  }

  return (
    <div
      onClick={() => navigate(`/hospitals/${hospital.id}`)}
      className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform">
      <div className="relative">
      <PlaceShareButton place={hospital} overlay />
      <Photo src={hospital.photo} alt={hospital.name} kind="building" iconSize={40} className="w-full h-36" />
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 leading-tight">{hospital.name}</h3>
        <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
          <MapPin size={11} className="text-primary" />
          {withDivision(hospital.location, hospital.location, hospital.division)}
        </p>
        <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
          <Phone size={11} className="text-primary" />
          {t('hotline')}: {hospital.hotline}
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 border-t border-gray-100">
        <a
          href={`tel:${hospital.hotline}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-3 bg-green-50 text-green-700 text-xs font-semibold border-r border-gray-100 active:bg-green-100 transition-colors">
          <Phone size={13} fill="currentColor" className="text-green-600" />
          {t('call')}
        </a>
        <a
          href={hospital.website}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-3 text-primary text-xs font-semibold border-r border-gray-100 active:bg-primary/5 transition-colors">
          <Globe size={13} />
          {t('website')}
        </a>
        <button
          onClick={openMaps}
          className="flex items-center justify-center gap-1.5 py-3 text-gray-600 text-xs font-semibold active:bg-gray-50 transition-colors">
          <Navigation size={13} />
          {t('direction')}
        </button>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={e => { e.stopPropagation(); navigate(`/hospitals/${hospital.id}`); }}
          className="w-full flex items-center justify-center gap-1.5 bg-primary/5 text-primary text-sm font-semibold rounded-xl py-2.5 active:bg-primary/10 transition-colors">
          {t('show_all_doctors')} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
