import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import {
  Phone, Globe, Navigation, Share2, ArrowLeft, MapPin, ChevronDown, ChevronUp,
  Star, ShieldCheck, GraduationCap, Languages as LanguagesIcon, Clock, Stethoscope,
  ClipboardList,
} from 'lucide-react';
import { api } from '../api/client';
import { buildShareUrl } from '../utils/share';
import { getDhakaNow } from '../utils/dhakaTime';
import SharePopover from '../components/doctor/SharePopover';
import CallPopover from '../components/doctor/CallPopover';
import ScheduleBox from '../components/booking/ScheduleBox';
import ChamberList from '../components/booking/ChamberList';

function LinkedInIcon({ size = 16 }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className="inline-flex items-center justify-center rounded-[3px] bg-[#0A66C2] text-white font-bold leading-none"
    >
      in
    </span>
  );
}

const CARD = 'bg-white rounded-xl border border-gray-100 shadow-sm';

function SectionHeading({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
      <Icon size={13} className="text-primary" /> {children}
    </p>
  );
}

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareAnchor, setShareAnchor] = useState(null);
  const [callAnchor, setCallAnchor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // drives ScheduleBox selection + Chamber List's per-day view + Call popover

  useEffect(() => {
    setLoading(true);
    setSelectedDate(getDhakaNow().date); // default to Bangladesh's current date
    api.get(`/doctors/${id}`)
      .then(setDoctor)
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  if (!doctor) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Doctor not found</div>
  );

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

  function openLinkedIn() {
    const url = buildShareUrl(doctor);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
  }

  function openMaps() {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${doctor.lat},${doctor.lng}`, '_blank');
  }

  const aboutText = doctor.about || '';
  const truncated = aboutText.length > 150 && !aboutExpanded;
  const selectedDow = selectedDate != null ? selectedDate.getDay() : null;

  return (
    <div>
      <button onClick={() => navigate(-1)}
        className="text-gray-500 hover:text-primary hover:bg-primary/5 flex items-center gap-1.5 text-sm mb-4 px-3 py-1.5 -ml-3 rounded-lg transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full flex flex-col gap-5">
          <div className={`${CARD} overflow-hidden`}>
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-primary/10 px-6 py-6">
              <div className="flex items-start gap-5">
                <img src={doctor.photo} alt={doctor.name}
                  className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-md flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {doctor.bmdc_no && (
                        <p className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <ShieldCheck size={13} className="text-primary" /> {t('reg_no')}: BMDC-{doctor.bmdc_no}
                        </p>
                      )}
                      <h1 className="font-bold text-gray-900 text-2xl leading-tight">{doctor.name}</h1>
                      <p className="text-primary font-medium text-sm mt-0.5">{doctor.specialty} — {doctor.department}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full">
                          {doctor.experience} {t('experience')}
                        </span>
                        {doctor.rating && (
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-medium px-3 py-1 rounded-full">
                            <Star size={12} className="fill-amber-500 text-amber-500" /> {doctor.rating}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={toggleShare}
                      className="text-gray-400 hover:text-primary hover:bg-white rounded-full p-2 transition-colors flex-shrink-0">
                      <Share2 size={18} />
                    </button>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs">
                    {doctor.education && (
                      <div className="flex items-start gap-1.5">
                        <GraduationCap size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{doctor.education}</span>
                      </div>
                    )}
                    {doctor.languages && (
                      <div className="flex items-start gap-1.5">
                        <LanguagesIcon size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{doctor.languages}</span>
                      </div>
                    )}
                    {doctor.consulting_hours && (
                      <div className="flex items-start gap-1.5 sm:col-span-2">
                        <Clock size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{doctor.consulting_hours}</span>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-6 py-5">
              {[
                { icon: Phone, label: t('call'), action: toggleCall },
                { icon: Globe, label: t('website'), action: () => window.open(doctor.website, '_blank') },
                { icon: LinkedInIcon, label: t('linkedin'), action: openLinkedIn },
                { icon: Navigation, label: t('direction'), action: openMaps },
              ].map(({ icon: Icon, label, action }) => (
                <button key={label} onClick={action}
                  className="flex-1 flex flex-col items-center gap-1.5 border border-gray-200 rounded-xl py-3 text-xs text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm hover:-translate-y-0.5 transition-all">
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${CARD} p-6`}>
            <SectionHeading icon={MapPin}>{t('location')}</SectionHeading>
            <p className="text-sm font-medium text-gray-800">{doctor.chamber}</p>
            {doctor.address && <p className="text-xs text-gray-500 mt-1">{doctor.address}</p>}
            {doctor.phone && <p className="text-xs text-gray-500 mt-1">{doctor.phone}</p>}
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">{t('fees')}: <span className="text-gray-600 font-medium">৳{doctor.fees}</span></p>
          </div>

          <div className={`${CARD} p-6`}>
            <SectionHeading icon={Stethoscope}>{t('about')}</SectionHeading>
            <p className="text-sm text-gray-700 leading-relaxed">
              {truncated ? aboutText.slice(0, 150) + '...' : aboutText}
            </p>
            {aboutText.length > 150 && (
              <button onClick={() => setAboutExpanded(!aboutExpanded)}
                className="mt-2 flex items-center gap-1 text-primary text-xs font-medium hover:underline">
                {aboutExpanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> {t('view_more_text')}</>}
              </button>
            )}
          </div>

          {doctor.clinical_expertise?.length > 0 && (
            <div className={`${CARD} p-6`}>
              <SectionHeading icon={ClipboardList}>{t('clinical_expertise')}</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {doctor.clinical_expertise.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {doctor.treatments?.length > 0 && (
            <div className={`${CARD} p-6`}>
              <SectionHeading icon={ClipboardList}>{t('treatments_offered')}</SectionHeading>
              <ul className="text-sm text-gray-700 space-y-2">
                {doctor.treatments.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[534px] flex-shrink-0 lg:sticky lg:top-24 flex flex-col gap-5">
          <ScheduleBox selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <ChamberList schedule={doctor.weekly_schedule} selectedDow={selectedDow} />
        </div>
      </div>

      {shareAnchor && (
        <SharePopover doctor={doctor} anchorEl={shareAnchor} onClose={() => setShareAnchor(null)} />
      )}

      {callAnchor && (
        <CallPopover doctor={doctor} schedule={doctor.weekly_schedule} dow={selectedDow} anchorEl={callAnchor} onClose={() => setCallAnchor(null)} />
      )}
    </div>
  );
}
