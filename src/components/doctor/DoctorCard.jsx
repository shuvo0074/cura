import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Info, Share2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SharePopover from './SharePopover';

export default function DoctorCard({ doctor }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [shareAnchor, setShareAnchor] = useState(null);

  function toggleShare(e) {
    setShareAnchor(prev => (prev ? null : e.currentTarget));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex gap-3 relative">
      <img src={doctor.photo} alt={doctor.name}
        className="w-16 h-16 rounded-full object-cover flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">{doctor.name}</h3>
            <p className="text-primary text-xs font-medium">{doctor.specialty}</p>
            <p className="text-gray-500 text-xs">{doctor.experience} {t('experience')}</p>
            <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {doctor.chamber}
            </p>
            <p className="text-gray-700 text-xs font-medium mt-1">
              {t('fees')}: ৳{doctor.fees}
            </p>
          </div>
          <button onClick={toggleShare} className="text-gray-400 hover:text-primary">
            <Share2 size={16} />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <a href={`tel:${doctor.phone}`}
            className="flex-1 flex items-center justify-center gap-1 bg-primary text-white text-xs py-1.5 rounded-lg font-medium">
            <Phone size={12} /> {t('call_now')}
          </a>
          <button onClick={() => navigate(`/doctors/${doctor.id}`)}
            className="flex-1 flex items-center justify-center gap-1 border border-primary text-primary text-xs py-1.5 rounded-lg font-medium">
            <Info size={12} /> {t('view_details')}
          </button>
        </div>
      </div>

      {shareAnchor && (
        <SharePopover doctor={doctor} anchorEl={shareAnchor} onClose={() => setShareAnchor(null)} />
      )}
    </div>
  );
}
