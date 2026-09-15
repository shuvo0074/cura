import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Phone, Globe, Navigation, ArrowLeft, MapPin, Star, Users, Clock } from 'lucide-react';
import { api } from '../api/client';
import { getDhakaNow, parseTimeRangeToMinutes } from '../utils/dhakaTime';

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';

function SectionHeading({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
      <Icon size={13} className="text-primary" /> {children}
    </p>
  );
}

// A doctor is "on duty now" at this hospital if today isn't Friday (no
// doctor has Friday availability, per the fixed weekly pattern) and the
// current Dhaka time falls inside one of their slots at this specific venue.
function isOnDutyNow(venueSchedule) {
  const { dow, minutes } = getDhakaNow();
  if (dow === 5 || !venueSchedule?.length) return false;
  return venueSchedule.some(s => {
    const { start, end } = parseTimeRangeToMinutes(s.time);
    return start != null && end != null && minutes >= start && minutes < end;
  });
}

export default function HospitalProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/hospitals/${id}`),
      api.get(`/hospitals/${id}/doctors`),
    ])
      .then(([h, d]) => { setHospital(h); setDoctors(d); })
      .catch(() => { setHospital(null); setDoctors([]); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  if (!hospital) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Hospital not found</div>
  );

  function openMaps() {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`, '_blank');
  }

  return (
    <div>
      <button onClick={() => navigate(-1)}
        className="text-gray-500 hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 text-sm mb-4 px-3 py-1.5 -ml-3 rounded-lg transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-col gap-5 max-w-4xl">
        <div className={`${CARD} overflow-hidden`}>
          <img src={hospital.photo} alt={hospital.name} className="w-full h-56 object-cover" />
          <div className="p-6">
            <h1 className="font-bold text-gray-900 text-2xl leading-tight">{hospital.name}</h1>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
              <MapPin size={14} className="text-primary" /> {hospital.location}
            </p>
            {hospital.address && <p className="text-xs text-gray-400 mt-1">{hospital.address}</p>}

            {hospital.description && (
              <p className="text-sm text-gray-700 leading-relaxed mt-4 pt-4 border-t border-gray-100">
                {hospital.description}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <a href={`tel:${hospital.hotline}`}
                className="flex-1 flex flex-col items-center gap-1.5 border border-gray-200 rounded-xl py-3 text-xs text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm hover:-translate-y-0.5 transition-all">
                <Phone size={16} /> {t('call')}
              </a>
              {hospital.website && (
                <a href={hospital.website} target="_blank" rel="noreferrer"
                  className="flex-1 flex flex-col items-center gap-1.5 border border-gray-200 rounded-xl py-3 text-xs text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm hover:-translate-y-0.5 transition-all">
                  <Globe size={16} /> {t('website')}
                </a>
              )}
              <button onClick={openMaps}
                className="flex-1 flex flex-col items-center gap-1.5 border border-gray-200 rounded-xl py-3 text-xs text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm hover:-translate-y-0.5 transition-all">
                <Navigation size={16} /> {t('direction')}
              </button>
            </div>
          </div>
        </div>

        <div className={`${CARD} p-6`}>
          <SectionHeading icon={Users}>{t('our_doctors')} ({doctors.length})</SectionHeading>

          {doctors.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">{t('no_results')}</p>
          )}

          <div className="flex flex-col gap-3">
            {doctors.map(doc => {
              const onDuty = isOnDutyNow(doc.venue_schedule);
              return (
                <div key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                  <img src={doc.photo} alt={doc.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{doc.name}</p>
                      {onDuty && (
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full">
                          {t('on_duty_now')}
                        </span>
                      )}
                    </div>
                    <p className="text-primary text-xs font-medium mt-0.5">{doc.specialty} — {doc.department}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{doc.experience} {t('experience')}</span>
                      {doc.rating && (
                        <span className="flex items-center gap-1">
                          <Star size={11} className="fill-amber-500 text-amber-500" /> {doc.rating}
                        </span>
                      )}
                    </div>
                    {doc.venue_schedule?.length > 0 && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-gray-500">
                        <Clock size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <span>{doc.venue_schedule.map(s => s.time).join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate(`/doctors/${doc.id}`)}
                    className="flex-shrink-0 bg-primary text-white text-xs font-medium px-4 py-2 rounded-lg hover:shadow-sm hover:-translate-y-0.5 transition-all">
                    {t('view_details')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
