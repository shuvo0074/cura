import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Phone, CheckCircle2, ShieldAlert, Hourglass, Pencil, ExternalLink, BadgeCheck } from 'lucide-react';
import Photo from '../components/ui/Photo';
import InsightsCard from '../components/doctor/InsightsCard';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Shown until an admin links the account to a listing: where their
// verification stands, and why if it was turned down.
function VerificationStatus({ verification }) {
  const { t, i18n } = useTranslation();
  const rejected = verification?.status === 'rejected';
  const submitted = verification && new Intl.DateTimeFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' })
    .format(new Date(verification.submitted_at));
  return (
    <div className={`rounded-2xl border p-6 max-w-2xl ${rejected ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
      <div className="flex gap-4">
        <span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0
          ${rejected ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
          {rejected ? <ShieldAlert size={22} /> : <Hourglass size={22} />}
        </span>
        <div>
          <h2 className="font-bold text-gray-900">{t(rejected ? 'dv_rejected_title' : 'dv_pending_title')}</h2>
          <p className="text-sm text-gray-700 mt-1">
            {rejected ? t('dv_rejected_reason', { note: verification.review_note }) : t('dv_pending_body', { no: verification?.bmdc_no })}
          </p>
          <p className="text-xs text-gray-500 mt-3">
            {submitted && <>{t('dv_submitted_on', { date: submitted })} · </>}{t('dv_help')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  if (!user.doctorId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Doctor Dashboard</h1>
        <VerificationStatus verification={user.verification} />
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Doctor Dashboard</h1>
      <ProfileCard />
      <InsightsCard />
      <Appointments />
    </div>
  );
}

// The doctor's public profile at a glance: how complete it is and the
// next thing to add, with links to edit and to view it as patients do.
function ProfileCard() {
  const { t } = useTranslation();
  const [p, setP] = useState(null);
  useEffect(() => { api.get('/doctors/me/profile').then(setP).catch(() => {}); }, []);
  if (!p) return null;
  const { percent, missing } = p.completeness;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Photo src={p.photo} alt={p.name} iconSize={24} className="w-16 h-16 rounded-full ring-4 ring-primary/5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('dd_profile_card_title')}</p>
          <p className="font-semibold text-gray-900 truncate flex items-center gap-1">
            {p.name} {p.bmdc_verified_at && <BadgeCheck size={16} className="text-green-600 flex-shrink-0" />}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 rounded-full bg-gray-100 flex-1 max-w-[12rem] overflow-hidden">
              <div className={`h-full rounded-full ${percent === 100 ? 'bg-green-600' : 'bg-action'}`} style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs font-semibold text-gray-700">{percent}%</span>
          </div>
          {missing[0] && <p className="text-xs text-gray-500 mt-1">{t('pe_next_step', { step: t(`pe_missing_${missing[0]}`) })}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <Link to={`/dr/${p.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
          <ExternalLink size={14} /> {t('pe_view_public')}
        </Link>
        <Link to="/doctor-dashboard/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary rounded-lg px-3 py-2 hover:bg-primary/90">
          <Pencil size={14} /> {t('dp_edit_profile')}
        </Link>
      </div>
    </section>
  );
}

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  function reload() {
    api.get('/doctors/me/appointments').then(setAppointments).finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleComplete(id) {
    const updated = await api.patch(`/doctors/me/appointments/${id}/complete`);
    setAppointments(prev => prev.map(a => (a.id === id ? updated : a)));
  }

  const filtered = status ? appointments.filter(a => a.status === status) : appointments;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize
              ${status === s ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No appointments.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-start">
                <div>
                  {a.serial_no && <p className="text-xs font-bold text-primary">Serial #{a.serial_no}</p>}
                  <h3 className="font-semibold text-gray-800 text-sm">{a.patient_name || a.patient_phone}</h3>
                  <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {a.patient_phone}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                  ${a.status === 'confirmed' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {a.status}
                </span>
              </div>
              <p className="text-gray-500 text-xs flex items-center gap-1 mt-2">
                <Calendar size={11} /> {a.appointment_date.slice(0, 10)}
                <Clock size={11} className="ml-2" /> {a.session_time || a.appointment_time.slice(0, 5)}
              </p>
              {a.venue && <p className="text-gray-500 text-xs mt-0.5">{a.venue}{a.estimated_arrival && ` · ~${a.estimated_arrival}`}</p>}
              {a.notes && <p className="text-gray-500 text-xs mt-1">Note: {a.notes}</p>}
              {a.status === 'confirmed' && (
                <button onClick={() => handleComplete(a.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle2 size={12} /> Mark Completed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
