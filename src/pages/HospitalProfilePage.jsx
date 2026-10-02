import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Globe, Navigation, ArrowLeft, MapPin, Star, Users, SlidersHorizontal, Search, X } from 'lucide-react';
import { api } from '../api/client';
import { getDhakaNow, parseTimeRangeToMinutes } from '../utils/dhakaTime';
import { withDivision } from '../utils/place';

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

// Page-local specialty filter — mobile bottom sheet, desktop sticky sidebar.
function SpecialtyFilter({ specialties, selected, onToggle, onClear, search, onSearch }) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const filtered = specialties.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  const checkboxList = (
    <div className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
      {filtered.map(item => (
        <label key={item} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="accent-primary" />
          {item}
        </label>
      ))}
      {filtered.length === 0 && <p className="text-xs text-gray-400">No matches.</p>}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="md:hidden mb-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl px-4 py-2.5 shadow-sm active:bg-gray-50">
          <SlidersHorizontal size={15} className="text-primary" />
          {t('filter_by')}
          {selected.length > 0 && (
            <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
              {selected.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="font-semibold text-gray-900">{t('filter_by')}</span>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">{t('specialities')}</p>
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-3">
                <Search size={13} className="text-gray-400 flex-shrink-0" />
                <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t('specialities')} className="flex-1 text-xs outline-none bg-transparent" />
              </div>
              {checkboxList}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => { onClear(); }} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600 font-medium">Clear All</button>
              <button onClick={() => setMobileOpen(false)} className="flex-1 bg-primary text-white rounded-xl py-3 text-sm font-semibold">Show Results</button>
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 md:sticky md:top-20">
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <SlidersHorizontal size={15} /> {t('filter_by')}
            </span>
            <button onClick={onClear} className="text-xs text-primary font-medium">Clear All</button>
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-2">{t('specialities')}</p>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t('specialities')} className="flex-1 text-xs outline-none bg-transparent" />
          </div>
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">{checkboxList}</div>
        </div>
      </aside>
    </>
  );
}

export default function HospitalProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specialtyFilter, setSpecialtyFilter] = useState([]);
  const [specSearch, setSpecSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setSpecialtyFilter([]);
    Promise.all([
      api.get(`/hospitals/${id}`),
      api.get(`/hospitals/${id}/doctors`),
    ])
      .then(([h, d]) => { setHospital(h); setDoctors(d); })
      .catch(() => { setHospital(null); setDoctors([]); })
      .finally(() => setLoading(false));
  }, [id]);

  const specialtyNames = useMemo(
    () => [...new Set(doctors.map(d => d.specialty))].sort(),
    [doctors]
  );
  const filteredDoctors = specialtyFilter.length
    ? doctors.filter(d => specialtyFilter.includes(d.specialty))
    : doctors;

  function toggleSpecialty(item) {
    setSpecialtyFilter(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
  }

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

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <SpecialtyFilter
          specialties={specialtyNames}
          selected={specialtyFilter}
          onToggle={toggleSpecialty}
          onClear={() => setSpecialtyFilter([])}
          search={specSearch}
          onSearch={setSpecSearch}
        />

        <div className="flex-1 w-full flex flex-col gap-5">
          <div className={`${CARD} overflow-hidden`}>
            <img src={hospital.photo} alt={hospital.name} className="w-full h-56 object-cover" />
            <div className="p-6">
              <h1 className="font-bold text-gray-900 text-2xl leading-tight">{hospital.name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
                <MapPin size={14} className="text-primary" /> {withDivision(hospital.location, hospital.location, hospital.division)}
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
            <SectionHeading icon={Users}>{t('our_doctors')} ({filteredDoctors.length})</SectionHeading>

            {filteredDoctors.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">{t('no_results')}</p>
            )}

            <div className="flex flex-col gap-3">
              {filteredDoctors.map(doc => {
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
    </div>
  );
}
