import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Globe, Navigation, ArrowLeft, MapPin, Star, Users, SlidersHorizontal, Search, X, FilterX } from 'lucide-react';
import FilterSheet from '../components/filters/FilterSheet';
import { api } from '../api/client';
import { getDhakaNow, parseTimeRangeToMinutes } from '../utils/dhakaTime';
import { withDivision } from '../utils/place';
import Photo from '../components/ui/Photo';

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';

function SectionHeading({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
      <Icon size={13} className="text-primary" /> {children}
    </p>
  );
}

// Opens the specialty filter bottom sheet on mobile; lives in the doctor list
// header so it sits next to what it filters rather than above the hospital.
function MobileFilterButton({ count, onClick }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="md:hidden flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg px-3 py-2 active:bg-gray-50">
      <SlidersHorizontal size={14} className="text-primary" />
      {t('filter_by')}
      {count > 0 && (
        <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
          {count}
        </span>
      )}
    </button>
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

// Page-local specialty filter — desktop sticky sidebar. Phones use FilterSheet.
function SpecialtyFilter({ specialties, selected, onToggle, onClear, search, onSearch }) {
  const { t } = useTranslation();
  const filtered = specialties.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  const checkboxList = (
    <div className="flex flex-col overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
      {filtered.map(item => (
        <label key={item} className="flex items-center gap-2.5 py-1 text-sm text-gray-600 hover:text-gray-900 cursor-pointer select-none">
          <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="accent-primary w-4 h-4 flex-shrink-0" />
          {item}
        </label>
      ))}
      {filtered.length === 0 && <p className="text-xs text-gray-400">No matches.</p>}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 md:sticky md:top-20">
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
              <SlidersHorizontal size={15} /> {t('filter_by')}
            </span>
            <button onClick={onClear} className="text-xs text-primary font-medium rounded-md px-2 py-1.5 -mr-2 hover:bg-primary/5">Clear All</button>
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-2">{t('specialities')}</p>
          <div className="field flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t('search_specialities')} aria-label={t('search_specialities')} className="flex-1 min-w-0 text-xs outline-none bg-transparent" />
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
  const [filterOpen, setFilterOpen] = useState(false);

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
            <Photo src={hospital.photo} alt={hospital.name} kind="building" iconSize={56} className="w-full h-56" />
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
            <div className="flex items-start justify-between gap-3">
              <SectionHeading icon={Users}>{t('our_doctors')} ({filteredDoctors.length})</SectionHeading>
              <MobileFilterButton count={specialtyFilter.length} onClick={() => setFilterOpen(true)} />
            </div>
            {specialtyFilter.length > 0 && (
              <div className="md:hidden flex flex-wrap gap-2 mb-3">
                {specialtyFilter.map(name => (
                  <button key={name} type="button" onClick={() => toggleSpecialty(name)} aria-label={t('remove_filter', { name })}
                    className="flex items-center gap-1 h-9 pl-3 pr-2 rounded-full text-sm bg-white border border-primary/30 text-primary font-medium">
                    {name} <X size={14} />
                  </button>
                ))}
                <button type="button" onClick={() => setSpecialtyFilter([])}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-gray-700 bg-white border border-gray-200 active:bg-gray-50">
                  <FilterX size={14} /> {t('clear')}
                </button>
              </div>
            )}

            {filteredDoctors.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">{t('no_results')}</p>
            )}

            <div className="flex flex-col gap-3">
              {filteredDoctors.map(doc => {
                const onDuty = isOnDutyNow(doc.venue_schedule);
                return (
                  <div key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-100 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                    <Photo src={doc.photo} alt={doc.name} iconSize={24} className="w-16 h-16 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{doc.name}</p>
                        {onDuty && (
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide bg-primary/10 px-2 py-0.5 rounded-full">
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

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('filters')}
        value={{ specialty: specialtyFilter }}
        onApply={draft => setSpecialtyFilter(draft.specialty)}
        emptyValue={{ specialty: [] }}
        countFor={draft => doctors.filter(d => !draft.specialty.length || draft.specialty.includes(d.specialty)).length}
        resultLabel={count => t('show_n_doctors', { count })}
        getSections={() => [
          { key: 'specialty', title: t('specialities'), options: specialtyNames, searchable: true, searchPlaceholder: t('search_specialities') },
        ]}
      />
    </div>
  );
}
