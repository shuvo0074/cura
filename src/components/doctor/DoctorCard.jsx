import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ChevronRight, Share2, MapPin, Star } from 'lucide-react';
import { withDivision } from '../../utils/place';
import { useTranslation } from 'react-i18next';
import SharePopover from './SharePopover';
import CallPopover from './CallPopover';
import { getDhakaNow } from '../../utils/dhakaTime';
import Photo from '../ui/Photo';

export default function DoctorCard({ doctor }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [shareAnchor, setShareAnchor] = useState(null);
  const [callAnchor, setCallAnchor] = useState(null);

  function toggleShare(e) {
    e.stopPropagation();
    setShareAnchor(prev => (prev ? null : e.currentTarget));
  }

  function toggleCall(e) {
    e.stopPropagation();
    setCallAnchor(prev => (prev ? null : e.currentTarget));
  }

  return (
    <div
      onClick={() => navigate(`/doctors/${doctor.id}`)}
      className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform">

      {/* Card body */}
      <div className="flex gap-3 p-4">
        <Photo
          src={doctor.photo}
          alt={doctor.name}
          className="w-[72px] h-[72px] rounded-xl flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{doctor.name}</h3>
              <p className="text-primary text-xs font-medium mt-0.5">{doctor.specialty}</p>
            </div>
            <button
              onClick={toggleShare}
              aria-label="Share doctor"
              className="text-gray-400 hover:text-primary hover:bg-primary/5 rounded-full p-2.5 -mt-2.5 -mr-2.5 flex-shrink-0">
              <Share2 size={15} />
            </button>
          </div>

          <p className="text-gray-600 text-xs mt-1">{t('workplace')}: {doctor.workplace || doctor.hospital_name || doctor.chamber || '—'}</p>
          <p className="text-gray-500 text-xs mt-1">{doctor.experience} {t('experience')}</p>

          <div className="flex items-center gap-1 mt-1">
            <MapPin size={10} className="text-primary flex-shrink-0" />
            <p className="text-gray-500 text-xs truncate">
              {withDivision(doctor.chamber, doctor.city, doctor.division)}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-primary text-sm font-bold">৳{doctor.fees}</span><span className="ml-2 text-xs text-gray-500">{t('followup_fees')}: {doctor.followup_fees != null ? `৳${doctor.followup_fees}` : t('not_listed')}</span>
            {doctor.rating && (
              <span className="flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                <Star size={11} fill="currentColor" /> {Number(doctor.rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          onClick={toggleCall}
          className="flex items-center justify-center gap-2 py-3 bg-green-50 text-green-700 text-sm font-semibold border-r border-gray-100 active:bg-green-100 transition-colors">
          <Phone size={15} fill="currentColor" className="text-green-600" />
          {t('call_now')}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${doctor.id}`); }}
          className="flex items-center justify-center gap-1.5 py-3 bg-primary/5 text-primary text-sm font-semibold active:bg-primary/10 transition-colors">
          Details
          <ChevronRight size={15} />
        </button>
      </div>

      {shareAnchor && (
        <SharePopover doctor={doctor} anchorEl={shareAnchor} onClose={() => setShareAnchor(null)} />
      )}
      {callAnchor && (
        <CallPopover doctor={doctor} schedule={doctor.weekly_schedule} dow={getDhakaNow().dow} anchorEl={callAnchor} onClose={() => setCallAnchor(null)} />
      )}
    </div>
  );
}
