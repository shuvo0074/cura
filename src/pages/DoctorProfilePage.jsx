import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Phone, Share2, ArrowLeft, Star, ShieldCheck, CalendarDays, Stethoscope, Briefcase, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { getDhakaNow } from '../utils/dhakaTime';
import SharePopover from '../components/doctor/SharePopover';
import CallPopover from '../components/doctor/CallPopover';
import DateStrip from '../components/booking/DateStrip';
import ChamberList from '../components/booking/ChamberList';
import ChamberOverview from '../components/booking/ChamberOverview';
import { useHospitalIdByName } from '../components/booking/chambers';
import { fromYmd } from '../utils/dates';
import Photo from '../components/ui/Photo';

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';
const ABOUT_PREVIEW = 300;
const FRIDAY = 5;

function SectionHeading({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
      <Icon size={18} className="text-primary" /> {children}
    </h2>
  );
}

function SubHeading({ children }) {
  return <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{children}</h3>;
}

// Default day for booking: today in Dhaka, or tomorrow when today is a Friday
// (chambers are closed), so the page never opens on an empty day.
function defaultBookingDate() {
  const d = getDhakaNow().date;
  if (d.getDay() === FRIDAY) d.setDate(d.getDate() + 1);
  return d;
}

// Doctor profile, ordered by what a patient needs: who the doctor is and what
// a visit costs, then booking a serial, then the background. On phones that's
// one column in that order; from lg the booking card sits sticky on the right.
export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareAnchor, setShareAnchor] = useState(null);
  const [callAnchor, setCallAnchor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(defaultBookingDate);
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const { hash } = useLocation();
  const hospitalIds = useHospitalIdByName();

  useEffect(() => {
    setLoading(true);
    // ?date=YYYY-MM-DD preselects a day (e.g. returning from login to book a serial).
    setSelectedDate(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? fromYmd(dateParam) : defaultBookingDate());
    api.get(`/doctors/${id}`)
      .then(setDoctor)
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));
  }, [id, dateParam]);

  // Arriving from a "Book serial" link (e.g. on a hospital page) lands on the
  // booking card once the profile has loaded.
  useEffect(() => {
    if (!loading && doctor && hash === '#book-serial') {
      document.getElementById('book-serial')?.scrollIntoView({ block: 'start' });
    }
  }, [loading, doctor, hash]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">{t('loading')}</div>;
  }

  if (!doctor) return (
    <div className="flex items-center justify-center h-64 text-gray-400">{t('doctor_not_found')}</div>
  );

  // Back within the app; someone who landed from a shared link goes to the
  // doctor list rather than off the site.
  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/doctors');
  }

  function toggleShare(e) {
    // Capture currentTarget now — it's nulled by the browser once the event
    // finishes dispatching, and StrictMode's double-invoke of this updater
    // in dev runs the second pass after that point, so reading e.currentTarget
    // inside the updater itself is unsafe.
    const target = e.currentTarget;
    setShareAnchor(prev => (prev ? null : target));
  }

  function toggleCall(e) {
    const target = e.currentTarget;
    setCallAnchor(prev => (prev ? null : target));
  }

  const aboutText = doctor.about || '';
  const truncated = aboutText.length > ABOUT_PREVIEW && !aboutExpanded;
  const hasBackground = doctor.education || doctor.languages;

  return (
    <div>
      <button onClick={goBack}
        className="text-gray-500 hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 text-sm mb-4 px-3 py-1.5 -ml-3 rounded-lg transition-colors">
        <ArrowLeft size={16} /> {t('back')}
      </button>

      {/* One column on phones (header → booking → chambers → about); from
          lg, booking spans all rows on the right. The 1fr last row soaks up
          the booking card's extra height so the left cards stay together. */}
      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-[auto_auto_1fr] items-start">

        {/* ── Who, and what a visit costs ── */}
        <section className={`${CARD} p-5 sm:p-6 lg:col-start-1`}>
          <div className="flex items-start gap-4 sm:gap-5">
            <Photo src={doctor.photo} alt={doctor.name} iconSize={40}
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-full ring-4 ring-primary/5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-xl sm:text-2xl leading-tight">{doctor.name}</h1>
              <p className="text-primary font-medium text-sm mt-1">{doctor.specialty}</p>
              <p className="text-sm text-gray-600 mt-1">{t('workplace')}: {doctor.workplace || doctor.hospital_name || doctor.chamber || '—'}</p>
              {doctor.department && <p className="text-gray-500 text-sm">{doctor.department}</p>}
              {doctor.bmdc_no && (
                <p className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1 mt-2">
                  <ShieldCheck size={13} /> {t('bmdc_verified', { no: doctor.bmdc_no })}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 mt-5 border border-gray-100 rounded-xl divide-x divide-gray-100 text-center">
            <div className="py-3 px-2">
              <dt className="flex items-center justify-center gap-1 text-xs text-gray-500"><Briefcase size={12} /> {t('experience')}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">{doctor.experience}</dd>
            </div>
            <div className="py-3 px-2">
              <dt className="flex items-center justify-center gap-1 text-xs text-gray-500"><Star size={12} /> {t('rating')}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">{doctor.rating || '—'}</dd>
            </div>
            <div className="py-3 px-2">
              <dt className="flex items-center justify-center gap-1 text-xs text-gray-500"><Wallet size={12} /> {t('fees')}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">{doctor.fees != null ? `৳${doctor.fees}` : '—'}</dd>
            </div>
          <div className="py-3 px-2"><dt className="text-xs text-gray-500">{t('followup_fees')}</dt><dd className="text-sm font-semibold mt-0.5">{doctor.followup_fees != null ? `৳${doctor.followup_fees}` : t('not_listed')}</dd></div>
          </dl>

          <div className="flex gap-2 mt-4">
            {/* Serials are booked by phone: this lists the day's chambers to call. */}
            <button onClick={toggleCall}
              className="flex-1 lg:flex-none lg:px-5 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Phone size={16} /> {t('call_for_booking')}
            </button>
            <button onClick={toggleShare} aria-label={t('share')}
              className="flex-shrink-0 lg:px-5 w-11 lg:w-auto flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors">
              <Share2 size={16} /> <span className="hidden lg:inline">{t('share')}</span>
            </button>
          </div>
        </section>

        {/* ── Call for booking: which chambers sit on a given day ── */}
        <section id="book-serial"
          className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)] lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:max-h-[calc(100dvh-var(--header-h)-2rem)] lg:overflow-y-auto`}>
          <SectionHeading icon={CalendarDays}>{t('call_for_booking')}</SectionHeading>
          <p className="text-xs text-gray-500 mt-1 mb-3">{t('call_for_booking_hint')}</p>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div className="mt-4">
            <ChamberList doctor={doctor} selectedDate={selectedDate} hospitalIds={hospitalIds} />
          </div>
        </section>

        {/* ── Where and when ── */}
        <div className="lg:col-start-1">
          <ChamberOverview doctor={doctor} hospitalIds={hospitalIds} />
        </div>

        {/* ── Background ── */}
        <section className={`${CARD} p-5 sm:p-6 lg:col-start-1 flex flex-col gap-5`}>
          <SectionHeading icon={Stethoscope}>{t('about')}</SectionHeading>

          {aboutText && (
            <div className="-mt-2">
              <p className="text-sm text-gray-700 leading-relaxed">
                {truncated ? `${aboutText.slice(0, ABOUT_PREVIEW)}…` : aboutText}
              </p>
              {aboutText.length > ABOUT_PREVIEW && (
                <button onClick={() => setAboutExpanded(v => !v)} className="mt-1 text-primary text-sm font-medium hover:underline">
                  {aboutExpanded ? t('show_less') : t('view_more_text')}
                </button>
              )}
            </div>
          )}

          {doctor.clinical_expertise?.length > 0 && (
            <div>
              <SubHeading>{t('clinical_expertise')}</SubHeading>
              <div className="flex flex-wrap gap-2">
                {doctor.clinical_expertise.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {doctor.treatments?.length > 0 && (
            <div>
              <SubHeading>{t('treatments_offered')}</SubHeading>
              <ul className="text-sm text-gray-700 space-y-1.5">
                {doctor.treatments.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasBackground && (
            <dl className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              {doctor.education && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('education')}</dt>
                  <dd className="text-sm text-gray-700">{doctor.education}</dd>
                </div>
              )}
              {doctor.languages && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('languages')}</dt>
                  <dd className="text-sm text-gray-700">{doctor.languages}</dd>
                </div>
              )}
            </dl>
          )}
        </section>
      </div>

      {shareAnchor && (
        <SharePopover doctor={doctor} anchorEl={shareAnchor} onClose={() => setShareAnchor(null)} />
      )}

      {callAnchor && (
        <CallPopover doctor={doctor} schedule={doctor.weekly_schedule} dow={selectedDate.getDay()} anchorEl={callAnchor} onClose={() => setCallAnchor(null)} />
      )}
    </div>
  );
}
