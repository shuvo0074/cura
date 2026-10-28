import { Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Phone, Share2, ArrowLeft, BadgeCheck, CalendarDays, Pencil, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CARD, PANEL, yearsSince, degreeRows } from '../utils/doctorProfile';
import {
  RecordRow, CollapsibleRow, Stars, QualificationsRow, PositionsRow, ExpertiseRow, PublicationsRow, MembershipsRow, AwardsRow, ReviewsRow,
} from '../components/doctor/ProfileSections';
import { getDhakaNow } from '../utils/dhakaTime';
import SharePopover from '../components/doctor/SharePopover';
import CallPopover from '../components/doctor/CallPopover';
import DateStrip from '../components/booking/DateStrip';
import ChamberList from '../components/booking/ChamberList';
import ChamberOverview from '../components/booking/ChamberOverview';
import { useHospitalIdByName } from '../components/booking/chambers';
import { fromYmd } from '../utils/dates';
import Photo from '../components/ui/Photo';
import ProfileTabs from '../components/doctor/ProfileTabs';
import { VerificationCard, ShareCard, ClaimCard } from '../components/doctor/ProfileAside';
import { groupByVenue, isRemote } from '../components/booking/chambers';

const taka = n => `৳${Number(n).toLocaleString('en-IN')}`;

const FRIDAY = 5;

function SectionHeading({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
      <Icon size={18} className="text-primary" /> {children}
    </h2>
  );
}

// Default day for booking: today in Dhaka, or tomorrow when today is a Friday
// (chambers are closed), so the page never opens on an empty day.
function defaultBookingDate() {
  const d = getDhakaNow().date;
  if (d.getDay() === FRIDAY) d.setDate(d.getDate() + 1);
  return d;
}

// The day-by-day "Call for booking" card is hidden for now; flip this to
// bring it back at the top of the right-hand column.
const SHOW_BOOKING_CARD = false;

// Doctor profile, ordered by what a patient needs: who the doctor is and what
// a visit costs, then booking a serial, then the background. On phones that's
// one column in that order; from lg the booking card sits sticky on the right.
export default function DoctorProfilePage() {
  // /doctors/:id, or the shareable /dr/:slug.
  const { id, slug } = useParams();
  const { user, hasRole } = useAuth();
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    api.get(id ? `/doctors/${id}` : `/doctors/by-slug/${encodeURIComponent(slug)}`)
      .then(setDoctor)
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));
  }, [id, slug, dateParam]);

  // Career, endorsements and reviews; reloaded after endorsing, and when the
  // viewer changes (what they may do depends on who they are).
  const doctorId = doctor?.id;
  const loadProfile = useCallback(
    () => (doctorId ? api.get(`/doctors/${doctorId}/profile`).then(setProfile).catch(() => setProfile(null)) : Promise.resolve()),
    [doctorId]
  );
  useEffect(() => { loadProfile(); }, [loadProfile, user?.id]);

  // Count one profile view per doctor per day from this browser.
  useEffect(() => {
    if (!doctorId) return;
    const key = `cura_viewed_${doctorId}_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { /* storage blocked: count anyway */ }
    api.post(`/doctors/${doctorId}/view`).catch(() => {});
  }, [doctorId]);

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
  const items = profile?.items;
  const years = yearsSince(doctor.practicing_since);
  const isOwner = Boolean(user?.doctorId && user.doctorId === doctor.id);
  const workplace = doctor.workplace || doctor.hospital_name || doctor.chamber;
  // Workplaces often already end in their town ("Ibn Sina Hospital, Netrokona").
  const place = [workplace, !workplace?.includes(',') && doctor.city].filter(Boolean).join(', ');
  const chamberCount = groupByVenue(doctor.weekly_schedule ?? []).filter(v => !isRemote(v)).length;
  const hasExpertise = profile ? profile.endorsements?.length > 0 : doctor.clinical_expertise?.length > 0;
  const experienceValue = years > 0 ? t('dp_years_value', { count: years }) : doctor.experience;
  const facts = [
    experienceValue && {
      key: 'experience', value: experienceValue,
      label: years > 0 ? `${t('experience')} · ${t('dp_since_short', { year: doctor.practicing_since })}` : t('experience'),
    },
    // Ratings only from completed Cura visits, never the listing's seeded number.
    doctor.review_count > 0 && {
      key: 'rating', label: t('dp_reviews_count', { count: doctor.review_count }),
      value: <>{Number(doctor.review_average).toFixed(1)} <Stars value={doctor.review_average} size={13} /></>,
    },
    chamberCount > 0 && { key: 'chambers', value: chamberCount, label: t('dp_chambers_fact', { count: chamberCount }) },
    doctor.fees != null && { key: 'fees', value: taka(doctor.fees), label: t('fees') },
    doctor.fees != null && doctor.followup_fees != null && { key: 'followup', value: taka(doctor.followup_fees), label: t('followup_fees') },
  ].filter(Boolean).slice(0, 4);
  const tabs = [
    { id: 'overview', label: t('pt_overview') },
    chamberCount > 0 && { id: 'chambers', label: t('pt_chambers') },
    degreeRows(items?.qualification, doctor.education).length > 0 && { id: 'qualifications', label: t('pt_qualifications') },
    items?.position?.length > 0 && { id: 'experience', label: t('pt_experience') },
    hasExpertise && { id: 'expertise', label: t('pt_expertise') },
    profile && { id: 'reviews', label: t('pt_reviews') },
  ].filter(Boolean);
  const verifiedOn = doctor.bmdc_verified_at && new Date(doctor.bmdc_verified_at).toLocaleDateString('en-GB', { dateStyle: 'medium' });


  return (
    <div>
      <button onClick={goBack}
        className="text-gray-500 hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 text-sm mb-4 px-3 py-1.5 -ml-3 rounded-lg transition-colors">
        <ArrowLeft size={16} /> {t('back')}
      </button>

      {/* Main column (header → tabs → chambers → record) with a sticky
          sidebar from lg: what Cura verified, claiming, and the profile link.
          On phones the sidebar follows the main column. */}
      <div className="grid grid-cols-1 gap-5 lg:gap-6 items-start lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 flex flex-col gap-5 lg:gap-6">

        {/* ── Who they are, and the facts a patient checks first ── */}
        <section id="overview" className={`${PANEL} relative p-5 sm:p-8 scroll-mt-[calc(var(--header-h)+3.5rem)]`}>
          {/* Phones: large photo on top with everything centred under it. From sm: photo beside left-aligned details. */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <Photo src={doctor.photo} alt={doctor.name} iconSize={32}
              className="w-48 h-48 self-center sm:self-start sm:w-40 sm:h-40 rounded-2xl flex-shrink-0" />
            <div className="min-w-0 flex-1 w-full text-center sm:text-left">
              <div className="flex items-start justify-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[22px] sm:text-[30px] font-semibold tracking-tight text-gray-950 leading-tight">{doctor.name}</h1>
                  {/* Written the way doctors write it under their name. */}
                  {doctor.degrees && <p className="mt-1 text-[15px] sm:text-base text-gray-600 leading-snug">{doctor.degrees}</p>}
                </div>
                {isOwner && (
                  <Link to="/doctor-dashboard/profile" aria-label={t('dp_edit_profile')}
                    className="absolute top-4 right-4 sm:static flex-shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50">
                    <Pencil size={13} /> <span className="hidden sm:inline">{t('dp_edit_profile')}</span>
                  </Link>
                )}
              </div>

              <p className="mt-3 text-[15px] font-medium text-gray-950">{doctor.headline || doctor.specialty}</p>
              <p className="text-sm text-gray-500">
                {[doctor.headline ? doctor.specialty : (doctor.department !== doctor.specialty && doctor.department), place].filter(Boolean).join(' · ')}
              </p>

              {doctor.bmdc_no && (doctor.bmdc_verified_at ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700" title={t('dp_verified_tooltip', { date: verifiedOn })}>
                  <BadgeCheck size={16} className="flex-shrink-0" /> {t('bmdc_verified', { no: doctor.bmdc_no })}
                </p>
              ) : (
                <p className="mt-3 text-[13px] text-gray-500">
                  {t('bmdc_reg_no', { no: doctor.bmdc_no })} · {t('dp_bmdc_unverified_line')}
                </p>
              ))}
            </div>
          </div>

          {/* Key facts, value first and label under it; only the ones we know. */}
          {facts.length > 0 && (
            <dl className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-4 text-center sm:text-left">
              {facts.map(f => (
                <div key={f.key}>
                  <dd className="text-xl font-semibold tracking-tight tabular-nums text-gray-950 flex items-center justify-center sm:justify-start gap-1.5">{f.value}</dd>
                  <dt className="text-xs text-gray-500 mt-0.5">{f.label}</dt>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-6">
            {/* Serials are booked by phone: this lists the day's chambers to call. */}
            <button onClick={toggleCall}
              className="flex-1 sm:flex-none sm:px-5 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Phone size={16} /> {t('call_for_booking')}
            </button>
            <button onClick={toggleShare} aria-label={t('share')}
              className="flex-shrink-0 sm:px-4 w-11 sm:w-auto flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Share2 size={16} /> <span className="hidden sm:inline">{t('share')}</span>
            </button>
            {doctor.website && (
              <a href={doctor.website} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-0.5 h-11 px-2 text-sm font-medium text-action hover:underline">
                {t('dp_website')} <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </section>


        <ProfileTabs tabs={tabs} />

        {/* ── Where and when: what most patients came for, so it leads ── */}
        <div id="chambers" className="empty:hidden scroll-mt-[calc(var(--header-h)+3.5rem)]">
          <ChamberOverview doctor={doctor} hospitalIds={hospitalIds} />
        </div>

        {/* ── The record: credentials first, then practice, then what peers and patients say ── */}
        <section className={`${PANEL} divide-y divide-gray-100`}>
          <QualificationsRow items={items?.qualification} fallback={doctor.education} />
          <PositionsRow items={items?.position} />

          {aboutText && (
            <CollapsibleRow label={t('about')} summary={aboutText}>
              <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-line">{aboutText}</p>
            </CollapsibleRow>
          )}

          {profile ? (
            <ExpertiseRow doctorId={doctor.id} endorsements={profile.endorsements}
              canEndorse={profile.canEndorse} onChange={loadProfile} />
          ) : doctor.clinical_expertise?.length > 0 && (
            <CollapsibleRow id="expertise" label={t('clinical_expertise')} summary={doctor.clinical_expertise.join(', ')}>
              <ul className="flex flex-wrap gap-2">
                {doctor.clinical_expertise.map(tag => (
                  <li key={tag} className="text-[13px] font-medium rounded-md px-2.5 py-1.5 bg-gray-100 text-gray-800">{tag}</li>
                ))}
              </ul>
            </CollapsibleRow>
          )}

          {doctor.treatments?.length > 0 && (
            <RecordRow label={t('treatments_offered')}>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] text-gray-700">
                {doctor.treatments.map(item => <li key={item}>{item}</li>)}
              </ul>
            </RecordRow>
          )}

          {doctor.languages && (
            <RecordRow label={t('languages')}>
              <p className="text-[15px] text-gray-700">{doctor.languages}</p>
            </RecordRow>
          )}

          <PublicationsRow items={items?.publication} />
          <MembershipsRow items={items?.membership} />
          <AwardsRow items={items?.award} />
          <ReviewsRow reviews={profile?.reviews} />
        </section>

      </div>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        {/* ── Call for booking: which chambers sit on a given day ── */}
        {SHOW_BOOKING_CARD && (
        <section id="book-serial"
          className={`${CARD} p-5 sm:p-6 scroll-mt-[calc(var(--header-h)+1rem)]`}>
          <SectionHeading icon={CalendarDays}>{t('call_for_booking')}</SectionHeading>
          <p className="text-xs text-gray-500 mt-1 mb-3">{t('call_for_booking_hint')}</p>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <div className="mt-4">
            <ChamberList doctor={doctor} selectedDate={selectedDate} hospitalIds={hospitalIds} />
          </div>
        </section>
        )}
        <VerificationCard doctor={doctor} />
        {!doctor.is_managed && !hasRole('doctor') && <ClaimCard doctor={doctor} />}
        <ShareCard doctor={doctor} onShare={toggleShare} />
      </aside>
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
