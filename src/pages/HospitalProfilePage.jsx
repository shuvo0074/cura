import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { Phone, Globe, Navigation, ArrowLeft, MapPin, Map as MapIcon, Star, Users, Search, Ticket, DoorOpen, Building2, X, Clock, Wallet, Siren, Video } from 'lucide-react';
import { api } from '../api/client';
import { getDhakaNow, parseTimeRangeToMinutes } from '../utils/dhakaTime';
import { withDivision } from '../utils/place';
import Photo from '../components/ui/Photo';
import { ServicesSection, TestPricesSection } from '../components/hospital/HospitalServices';
import { is24x7 } from '../components/hospital/hospitalCatalogue';

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';
const PAGE = 20;
const FRIDAY = 5;
const ON_DUTY = '__on_duty__';

// Session state of a doctor's hours at this hospital, from Dhaka's clock:
// 'now' while a session is running, otherwise the start (minutes) of their
// next session later today, for sorting. Fridays are closed.
function dutyState(venueSchedule, now) {
  if (now.dow === FRIDAY || !venueSchedule?.length) return { onDuty: false, nextStart: Infinity };
  let nextStart = Infinity;
  for (const s of venueSchedule) {
    const { start, end } = parseTimeRangeToMinutes(s.time);
    if (start == null || end == null) continue;
    if (now.minutes >= start && now.minutes < end) return { onDuty: true, nextStart: start };
    if (start > now.minutes) nextStart = Math.min(nextStart, start);
  }
  return { onDuty: false, nextStart };
}

// "Ground Floor, Chamber 16, Band Road, Barishal" → "Ground Floor, Chamber 16":
// the part of a chamber address that says where inside the hospital it is.
function roomWithin(chamberAddress, hospitalAddress) {
  if (!chamberAddress) return null;
  const tail = hospitalAddress ? `, ${hospitalAddress}` : '';
  const room = tail && chamberAddress.endsWith(tail) ? chamberAddress.slice(0, -tail.length) : chamberAddress;
  return room === hospitalAddress ? null : room;
}

function Stat({ label, value, highlight }) {
  return (
    <div className="py-3 px-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-base font-bold mt-0.5 ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</dd>
    </div>
  );
}

function Chip({ active, onClick, children, tone = 'primary' }) {
  const on = tone === 'green' ? 'bg-green-600 border-green-600 text-white' : 'bg-primary border-primary text-white';
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm border transition-colors
        ${active ? `${on} font-medium` : 'bg-white border-gray-200 text-gray-700 hover:border-primary'}`}>
      {children}
    </button>
  );
}

function DoctorRow({ doc, hospital }) {
  const { t } = useTranslation();
  const room = roomWithin(doc.venue_schedule?.[0]?.address, hospital.address);
  return (
    <li className={`border rounded-xl p-4 transition-colors ${doc.onDuty ? 'border-green-200 bg-green-50/40' : 'border-gray-100 hover:border-primary/40'}`}>
      <div className="flex items-start gap-3.5">
        <Link to={`/doctors/${doc.id}`} className="flex-shrink-0">
          <Photo src={doc.photo} alt={doc.name} iconSize={22} className="w-14 h-14 rounded-full" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/doctors/${doc.id}`} className="font-semibold text-gray-900 hover:text-primary leading-snug">{doc.name}</Link>
              <p className="text-primary text-sm">{doc.specialty}</p>
            </div>
            {doc.onDuty && (
              <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" /> {t('on_duty_now')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            <span>{doc.experience}</span>
            {doc.rating && <span className="flex items-center gap-1"><Star size={11} className="fill-amber-500 text-amber-500" /> {doc.rating}</span>}
            {doc.fees != null && <span className="font-medium text-gray-700">৳{doc.fees}</span>}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {doc.venue_schedule?.map(s => (
              <span key={s.time} title={s.note} className="text-xs bg-gray-50 text-gray-700 rounded-md px-2 py-1 whitespace-nowrap">{s.time}</span>
            ))}
          </div>
          {room && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
              <DoorOpen size={13} className="text-gray-400 flex-shrink-0" /> {room}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 sm:pl-[70px]">
        <Link to={`/doctors/${doc.id}#book-serial`}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">
          <Ticket size={14} /> {t('book_serial')}
        </Link>
        <Link to={`/doctors/${doc.id}`}
          className="flex-1 sm:flex-none flex items-center justify-center h-9 px-4 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary hover:text-primary">
          {t('view_details')}
        </Link>
      </div>
    </li>
  );
}

function Badge({ tone = 'gray', icon: Icon, children }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${tones[tone]}`}>
      {Icon && <Icon size={12} />} {children}
    </span>
  );
}

// Street map of the hospital, embedded so patients can see where it is
// without leaving the page; "Get directions" hands off to Google Maps for
// turn-by-turn navigation. Lazy-loaded, since it sits below the fold on phones.
function HospitalMap({ hospital }) {
  const { t } = useTranslation();
  const src = `https://maps.google.com/maps?q=${hospital.lat},${hospital.lng}&z=16&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-100 aspect-[4/3]">
        <iframe
          title={t('map_of', { name: hospital.name })}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
      <a href={directions} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
        <Navigation size={15} /> {t('get_directions')}
      </a>
    </div>
  );
}

// Hospital profile, ordered by what a patient comes here for: where it is
// and how to reach it, then which doctor they can see here and when (on duty
// now first, filterable by speciality), then the background. From lg, the
// visit card sits sticky on the right.
export default function HospitalProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null); // null = all, ON_DUTY, or a speciality
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    setLoading(true);
    setFilter(null);
    setQuery('');
    setShown(PAGE);
    Promise.all([
      api.get(`/hospitals/${id}`),
      api.get(`/hospitals/${id}/doctors`),
    ])
      .then(([h, d]) => { setHospital(h); setDoctors(d); })
      .catch(() => { setHospital(null); setDoctors([]); })
      .finally(() => setLoading(false));
  }, [id]);

  // A new search or filter starts the list from the top again.
  function changeQuery(next) { setQuery(next); setShown(PAGE); }
  function toggleFilter(next) { setFilter(f => (f === next ? null : next)); setShown(PAGE); }

  // On duty now first, then whoever starts soonest today, then by name.
  const ranked = useMemo(() => {
    const now = getDhakaNow();
    return doctors
      .map(d => ({ ...d, ...dutyState(d.venue_schedule, now) }))
      .sort((a, b) => (b.onDuty - a.onDuty) || (a.nextStart - b.nextStart) || a.name.localeCompare(b.name));
  }, [doctors]);

  // Specialities by how many doctors practise them here.
  const specialties = useMemo(() => {
    const counts = new Map();
    for (const d of doctors) counts.set(d.specialty, (counts.get(d.specialty) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [doctors]);

  const onDutyCount = ranked.filter(d => d.onDuty).length;
  const q = query.trim().toLowerCase();
  const visible = ranked.filter(d =>
    (filter === null || (filter === ON_DUTY ? d.onDuty : d.specialty === filter))
    && (!q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q)));

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">{t('loading')}</div>;
  }

  if (!hospital) return (
    <div className="flex items-center justify-center h-64 text-gray-400">{t('hospital_not_found')}</div>
  );

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/hospitals');
  }

  function scrollTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const online = hospital.type === 'online';
  const hasMap = !online && hospital.lat != null && hospital.lng != null;
  const emergency = (hospital.services || []).find(x => x.key === 'emergency');
  const jumps = [
    ['doctors-here', 'jump_doctors', true],
    ['services', 'jump_services', (hospital.services || []).length > 0],
    ['test-prices', 'jump_tests', (hospital.tests || []).length > 0],
    ['visit', 'jump_visit', true],
  ].filter(([, , show]) => show);

  const place = withDivision(hospital.location, hospital.location, hospital.division);

  return (
    <div>
      <button onClick={goBack}
        className="text-gray-500 hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 text-sm mb-4 px-3 py-1.5 -ml-3 rounded-lg transition-colors">
        <ArrowLeft size={16} /> {t('back')}
      </button>

      {/* Phones: one column (header → doctors → services → test prices →
          visit). From lg the visit card, with its map, sits sticky on the right. */}
      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="flex flex-col gap-5 lg:gap-6 min-w-0">

          {/* ── What this place is, and how to reach it ── */}
          <section className={`${CARD} overflow-hidden`}>
            <Photo src={hospital.photo} alt={hospital.name} kind="building" iconSize={48} className="w-full h-36 sm:h-48" />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hospital.type && <Badge icon={online ? Video : Building2}>{t(`htype_${hospital.type}`)}</Badge>}
                {is24x7(hospital.opening_hours) && <Badge tone="green" icon={Clock}>{t('open_24_hours')}</Badge>}
                {emergency && is24x7(emergency.hours) && <Badge tone="red" icon={Siren}>{t('emergency_24_7')}</Badge>}
              </div>
              <h1 className="font-bold text-gray-900 text-xl sm:text-2xl leading-tight">{hospital.name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1.5">
                <MapPin size={14} className="text-primary flex-shrink-0" /> {place}
              </p>

              <dl className="grid grid-cols-3 mt-4 border border-gray-100 rounded-xl divide-x divide-gray-100 text-center">
                <Stat label={t('stat_doctors')} value={doctors.length} />
                <Stat label={t('stat_specialities')} value={specialties.length} />
                <Stat label={t('stat_on_duty')} value={onDutyCount} highlight={onDutyCount > 0} />
              </dl>

              <div className="flex gap-2 mt-4">
                {hospital.hotline && (
                  <a href={`tel:${hospital.hotline}`}
                    className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-white text-sm font-semibold transition-colors
                      ${emergency ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}>
                    {emergency ? <Siren size={16} /> : <Phone size={16} />} {t(emergency ? 'call_emergency' : 'call_hotline')}
                  </a>
                )}
                {hasMap && (
                  <button onClick={() => scrollTo('visit')}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors">
                    <MapIcon size={16} /> {t('map')}
                  </button>
                )}
              </div>

              {jumps.length > 2 && (
                <nav aria-label={t('on_this_page')} className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-4 border-t border-gray-100 text-sm">
                  {jumps.map(([sectionId, label]) => (
                    <a key={sectionId} href={`#${sectionId}`} onClick={e => { e.preventDefault(); scrollTo(sectionId); }}
                      className="text-primary font-medium hover:underline">{t(label)}</a>
                  ))}
                </nav>
              )}
            </div>
          </section>

          {/* ── Which doctor, and when ── */}
          <section id="doctors-here" className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)]`}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Users size={18} className="text-primary" /> {t('doctors_here')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{t('doctors_here_hint')}</p>

            {doctors.length > 0 && (
              <>
                <label className="field mt-4 flex items-center gap-2 border border-gray-200 rounded-xl px-3 h-11 cursor-text">
                  <Search size={16} className="text-gray-400 flex-shrink-0" />
                  <input value={query} onChange={e => changeQuery(e.target.value)} placeholder={t('search_doctors_here')} aria-label={t('search_doctors_here')}
                    className="flex-1 min-w-0 text-sm outline-none bg-transparent" />
                  {query && (
                    <button type="button" onClick={() => changeQuery('')} aria-label={t('clear_search')} className="text-gray-400 p-1 -m-1"><X size={16} /></button>
                  )}
                </label>

                <div className="relative mt-3 -mx-5 sm:-mx-6">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 sm:px-6 pb-1">
                    <Chip active={filter === null} onClick={() => toggleFilter(null)}>{t('all')} <span className="opacity-70">{doctors.length}</span></Chip>
                    {onDutyCount > 0 && (
                      <Chip tone="green" active={filter === ON_DUTY} onClick={() => toggleFilter(ON_DUTY)}>
                        <span className={`w-1.5 h-1.5 rounded-full ${filter === ON_DUTY ? 'bg-white' : 'bg-green-500'}`} aria-hidden="true" />
                        {t('on_duty_now')} <span className="opacity-70">{onDutyCount}</span>
                      </Chip>
                    )}
                    {specialties.map(([name, count]) => (
                      <Chip key={name} active={filter === name} onClick={() => toggleFilter(name)}>
                        {name} <span className="opacity-70">{count}</span>
                      </Chip>
                    ))}
                    <span className="flex-shrink-0 w-2" aria-hidden="true" />
                  </div>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
                </div>
              </>
            )}

            {visible.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">{doctors.length ? t('no_doctors_match') : t('no_results')}</p>
            ) : (
              <ul className="flex flex-col gap-3 mt-4">
                {visible.slice(0, shown).map(doc => <DoctorRow key={doc.id} doc={doc} hospital={hospital} />)}
              </ul>
            )}

            {visible.length > shown && (
              <button type="button" onClick={() => setShown(n => n + PAGE)}
                className="mt-4 w-full h-11 rounded-xl border border-gray-200 text-sm font-medium text-primary hover:border-primary transition-colors">
                {t('show_n_more', { count: Math.min(PAGE, visible.length - shown) })}
              </button>
            )}
          </section>

          <ServicesSection hospital={hospital} id="services" />
          <TestPricesSection key={hospital.id} hospital={hospital} id="test-prices" />
        </div>

        {/* ── Visit: map, address, hours, contact, payment, about ── */}
        <aside id="visit" className={`${CARD} p-5 sm:p-6 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:max-h-[calc(100dvh-var(--header-h)-2rem)] lg:overflow-y-auto flex flex-col gap-4 scroll-mt-[calc(var(--header-h)+1rem)]`}>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Building2 size={18} className="text-primary" /> {t('visit')}
          </h2>
          {hasMap && <HospitalMap hospital={hospital} />}
          <dl className="flex flex-col gap-3 text-sm">
            {hospital.address && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">{t('location')}</dt>
                <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <dd className="text-gray-700">{hospital.address}{hospital.division ? `, ${t('division_label', { name: hospital.division })}` : ''}</dd>
              </div>
            )}
            {hospital.opening_hours && (
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">{t('opening_hours')}</dt>
                  <dd className="text-gray-700">{is24x7(hospital.opening_hours) ? t('open_24_hours') : hospital.opening_hours}</dd>
                </div>
              </div>
            )}
            {hospital.visiting_hours && (
              <div className="flex items-start gap-2.5">
                <Users size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">{t('visiting_hours')}</dt>
                  <dd className="text-gray-700">{hospital.visiting_hours}</dd>
                </div>
              </div>
            )}
            {hospital.hotline && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">{t('hotline')}</dt>
                <Phone size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <dd><a href={`tel:${hospital.hotline}`} className="text-primary font-medium hover:underline">{hospital.hotline}</a></dd>
              </div>
            )}
            {hospital.website && (
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">{t('website')}</dt>
                <Globe size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <dd className="min-w-0"><a href={hospital.website} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{hospital.website.replace(/^https?:\/\//, '')}</a></dd>
              </div>
            )}
            {hospital.payment_methods?.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Wallet size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500 mb-1">{t('payment_methods')}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {hospital.payment_methods.map(m => (
                      <span key={m} className="text-xs font-medium text-gray-700 bg-gray-100 rounded-md px-2 py-0.5">{t(`pay_${m}`)}</span>
                    ))}
                  </dd>
                </div>
              </div>
            )}
          </dl>
          {hospital.description && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('about')}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{hospital.description}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
