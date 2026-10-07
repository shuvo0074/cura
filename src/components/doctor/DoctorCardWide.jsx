import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ChevronRight, Share2, MapPin, Star } from 'lucide-react';
import { withDivision } from '../../utils/place';
import SharePopover from './SharePopover';
import CallPopover from './CallPopover';
import { getDhakaNow } from '../../utils/dhakaTime';
import Photo from '../ui/Photo';

export default function DoctorCardWide({ doctor }) {
  const navigate = useNavigate();
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
      <div className="flex gap-4 p-4">
        <Photo
          src={doctor.photo}
          alt={doctor.name}
          className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 leading-tight">{doctor.name}</h3>
              <p className="text-primary text-sm font-medium mt-0.5">
                {doctor.specialty}{doctor.department ? ` · ${doctor.department}` : ''}
              </p>
            </div>
            <button onClick={toggleShare} aria-label="Share doctor"
              className="text-gray-400 hover:text-primary hover:bg-primary/5 rounded-full p-2.5 -mt-2.5 -mr-2.5 flex-shrink-0">
              <Share2 size={15} />
            </button>
          </div>

          <p className="text-gray-500 text-sm mt-1">{doctor.experience} · <span className="text-primary font-semibold">৳{doctor.fees}</span></p>

          <div className="flex items-center gap-1 mt-1.5">
            <MapPin size={12} className="text-primary flex-shrink-0" />
            <p className="text-gray-500 text-sm truncate">
              {withDivision(`${doctor.hospital_name ? `${doctor.hospital_name}, ` : ''}${doctor.city}`, doctor.city, doctor.division)}
            </p>
          </div>

          <div className="flex items-center gap-0.5 mt-1.5">
            <Star size={13} fill="#F59E0B" className="text-amber-400" />
            <span className="text-xs text-gray-500 font-medium">4.8 · Verified</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          onClick={toggleCall}
          className="flex items-center justify-center gap-2 py-3.5 bg-green-50 text-green-700 text-sm font-semibold border-r border-gray-100 active:bg-green-100 transition-colors">
          <Phone size={15} fill="currentColor" className="text-green-600" />
          Call Now
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${doctor.id}`); }}
          className="flex items-center justify-center gap-1.5 py-3.5 bg-primary/5 text-primary text-sm font-semibold active:bg-primary/10 transition-colors">
          View Details
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
