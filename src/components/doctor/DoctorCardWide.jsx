import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MapPin, Share2 } from 'lucide-react';
import SharePopover from './SharePopover';

export default function DoctorCardWide({ doctor }) {
  const navigate = useNavigate();
  const [shareAnchor, setShareAnchor] = useState(null);

  function toggleShare(e) {
    e.stopPropagation();
    setShareAnchor(prev => (prev ? null : e.currentTarget));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="flex gap-4 p-4">
        <img src={doctor.photo} alt={doctor.name}
          className="w-32 h-32 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 leading-tight">{doctor.name}</h3>
            <button onClick={toggleShare} aria-label="Share doctor"
              className="text-gray-400 hover:text-primary mt-0.5 flex-shrink-0">
              <Share2 size={15} />
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{doctor.specialty}{doctor.department ? ` · ${doctor.department}` : ''}</p>
          <p className="text-gray-600 text-sm mt-2">{doctor.experience} · Fees ৳{doctor.fees}</p>
          <div className="border-b border-gray-100 my-2 w-16" />
          <p className="text-gray-600 text-sm flex items-center gap-1">
            <MapPin size={13} className="text-primary flex-shrink-0" />
            {doctor.hospital_name ? `${doctor.hospital_name}, ` : ''}{doctor.city}
          </p>
        </div>
      </div>

      <div className="flex mt-auto border-t border-gray-100">
        <button onClick={() => navigate(`/doctors/${doctor.id}`)}
          className="flex-1 bg-primary text-white text-sm font-medium py-2.5">
          View Details
        </button>
        <a href={`tel:${doctor.phone}`}
          className="flex-1 flex items-center justify-center gap-1.5 border-l border-gray-100 text-primary text-sm font-medium py-2.5">
          <Phone size={14} /> Call Now
        </a>
      </div>

      {shareAnchor && (
        <SharePopover doctor={doctor} anchorEl={shareAnchor} onClose={() => setShareAnchor(null)} />
      )}
    </div>
  );
}
