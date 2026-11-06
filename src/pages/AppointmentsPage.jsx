import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, LogIn, Ticket, X, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Photo from '../components/ui/Photo';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { getDhakaNow } from '../utils/dhakaTime';
import { formatYmd, toYmd } from '../utils/dates';

// Rating a completed visit. Only completed Cura visits can be reviewed, which
// is what makes the reviews on doctor profiles trustworthy.
function ReviewForm({ a, onReviewed }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (a.review_rating) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
        <span className="inline-flex">{[1, 2, 3, 4, 5].map(n => (
          <Star key={n} size={14} fill="currentColor" className={n <= a.review_rating ? 'text-amber-400' : 'text-gray-200'} />
        ))}</span>
        {t('rv_your_rating', { rating: a.review_rating })}
      </p>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/appointments/${a.id}/review`, { rating, comment });
      onReviewed(a.id, rating);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-gray-100 pt-3 flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-900">{t('rv_rate_visit')}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={t('rv_rate_visit')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t('rv_star', { count: n })}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="p-0.5">
            <Star size={26} fill="currentColor" className={n <= (hover || rating) ? 'text-amber-400' : 'text-gray-200'} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} maxLength={1000}
            placeholder={t('rv_comment_ph')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">
            {t('rv_submit')}
          </button>
        </>
      )}
    </form>
  );
}

function AppointmentCard({ a, onCancel, onReviewed }) {
  const { t, i18n } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const cancelled = a.status === 'cancelled';
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3 ${cancelled ? 'opacity-70' : ''}`}>
      <div className="flex gap-3">
        <Link to={`/doctors/${a.doctor_id}`} className="flex-shrink-0">
          <Photo src={a.doctor_photo} alt={a.doctor_name} iconSize={22} className="w-14 h-14 rounded-full" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/doctors/${a.doctor_id}`} className="font-semibold text-gray-900 text-sm hover:text-primary">{a.doctor_name}</Link>
          <p className="text-primary text-xs font-medium">{a.specialty}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize
            ${cancelled ? 'bg-gray-100 text-gray-500' : a.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-primary/10 text-primary'}`}>
            {a.status}
          </span>
        </div>
        {a.serial_no && (
          <div className="flex-shrink-0 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-400 leading-none">{t('serial')}</p>
            <p className={`text-2xl font-bold leading-tight ${cancelled ? 'text-gray-400 line-through' : 'text-primary'}`}>#{a.serial_no}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-gray-700 bg-secondary rounded-lg p-3">
        <p className="flex items-center gap-2"><CalendarDays size={14} className="text-primary flex-shrink-0" /> {formatYmd(a.appointment_date, i18n.language)}</p>
        <p className="flex items-center gap-2"><Clock size={14} className="text-primary flex-shrink-0" />
          {a.session_time || a.appointment_time.slice(0, 5)}
        </p>
        {(a.venue || a.chamber) && <p className="flex items-center gap-2"><MapPin size={14} className="text-primary flex-shrink-0" /> <span className="truncate">{a.venue || a.chamber}</span></p>}
        {a.estimated_arrival && !cancelled && (
          <p className="flex items-center gap-2 font-medium text-gray-900"><Ticket size={14} className="text-primary flex-shrink-0" /> {t('arrive_around', { time: a.estimated_arrival })}</p>
        )}
      </div>
      {a.notes && <p className="text-xs text-gray-500">{t('reason_for_visit')}: {a.notes}</p>}
      {a.status === 'completed' && <ReviewForm a={a} onReviewed={onReviewed} />}

      {onCancel && (confirming ? (
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <span className="text-sm text-gray-700">{t('cancel_confirm')}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700">{t('keep_it')}</button>
            <button type="button" onClick={() => onCancel(a.id)} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white font-medium">{t('cancel_serial')}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="self-start flex items-center gap-1 text-sm text-red-600 font-medium py-1">
          <X size={14} /> {t('cancel_serial')}
        </button>
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const { loading: authLoading, hasRole } = useAuth();
  const isPatient = hasRole('patient');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPatient) {
      setLoading(false);
      return;
    }
    api.get('/appointments/me')
      .then(setAppointments)
      .finally(() => setLoading(false));
  }, [isPatient]);

  function handleReviewed(id, rating) {
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, review_rating: rating } : a)));
  }

  async function handleCancel(id) {
    const updated = await api.patch(`/appointments/${id}/cancel`);
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">{t('loading')}</div>;
  }

  if (!isPatient) {
    return (
      <div>
        <PageHeader title={t('appointments')} />
        <EmptyState
          icon={LogIn}
          title={t('login_for_appointments')}
          actions={[
            { label: t('login'), to: '/login?redirect=/appointments' },
            { label: t('find_a_doctor'), to: '/doctors' },
          ]}
        />
      </div>
    );
  }

  // Upcoming = still confirmed and today or later (Dhaka time), soonest first.
  const today = toYmd(getDhakaNow().date);
  const isUpcoming = a => a.status === 'confirmed' && a.appointment_date >= today;
  const upcoming = appointments.filter(isUpcoming)
    .sort((x, y) => x.appointment_date.localeCompare(y.appointment_date) || x.appointment_time.localeCompare(y.appointment_time));
  const past = appointments.filter(a => !isUpcoming(a));

  return (
    <div>
      <PageHeader title={t('appointments')} count={appointments.length || null} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm font-semibold text-action">
        <Link to="/my-health" className="hover:underline">{t('mh_title')}</Link>
        <Link to="/my-clinics" className="hover:underline">{t('mc_title')}</Link>
      </div>
      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('no_appointments')}
          message={t('no_appointments_msg')}
          actions={[{ label: t('find_a_doctor'), to: '/doctors' }]}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {[[t('upcoming'), upcoming, true], [t('past_and_cancelled'), past, false]].map(([title, list, cancellable]) => list.length > 0 && (
            <section key={title}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title} <span className="font-normal">({list.length})</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {list.map(a => <AppointmentCard key={a.id} a={a} onCancel={cancellable ? handleCancel : null} onReviewed={handleReviewed} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
