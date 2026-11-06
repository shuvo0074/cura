import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, Clock, MapPin, Navigation, Phone, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { normalizeBdPhone } from '../../utils/authValidation';
import { dhakaInputToIso, pickupRange, requestErrorKey } from '../../utils/ambulanceRequests';
import { telHref } from '../../utils/pharmacyFilters';
import { phoneDigits } from '../../utils/phone';

const locale = lang => (lang === 'bn' ? 'bn-BD' : 'en-GB');
const formatWhen = (iso, lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
const vendorName = (vendor, lang) => (lang === 'bn' && vendor.name_bn) || vendor.name;
// "+8801712345678" → "01712345678".
const nationalPhone = phone => String(phone ?? '').replace(/^\+?88(?=01)/, '');

const STATUS_STYLE = {
  new: 'bg-amber-50 text-amber-700',
  accepted: 'bg-green-50 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function RequestStatus({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[status] ?? STATUS_STYLE.new}`}>
      {t(`ar_status_${status}`)}
    </span>
  );
}

function CallLink({ phone, label }) {
  const { i18n } = useTranslation();
  return (
    <a href={telHref(phone)}
      className="min-h-10 inline-flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-primary hover:bg-primary/5">
      <Phone size={14} /> {label} · <span dir="ltr">{phoneDigits(nationalPhone(phone), i18n.language)}</span>
    </a>
  );
}

// One ambulance request the patient sent, with its status and the owner's message.
export function AmbulanceRequestCard({ request, busy, onCancel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const phone = request.ambulance.phones?.[0];
  return (
    <article className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2" data-testid="ambulance-request">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><Ambulance size={16} className="text-primary flex-shrink-0" /> {vendorName(request.ambulance, lang)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('ar_sent_at', { when: formatWhen(request.created_at, lang) })}</p>
        </div>
        <RequestStatus status={request.status} />
      </div>
      <div className="text-sm text-gray-700 space-y-1">
        <p className="flex items-start gap-1.5"><Clock size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
          {request.pickup_at ? t('ar_pickup_at', { when: formatWhen(request.pickup_at, lang) }) : t('ar_pickup_now')}</p>
        <p className="flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />{request.pickup_address}</p>
        {request.destination && <p className="flex items-start gap-1.5"><Navigation size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />{request.destination}</p>}
      </div>
      {request.status === 'new' && <p className="text-sm text-amber-800">{t('ar_new_note')}</p>}
      {request.status === 'accepted' && <p className="text-sm font-medium text-green-700">{t('ar_accepted_note')}</p>}
      {request.owner_message && (
        <p className={`text-sm rounded-lg px-3 py-2 ${request.status === 'declined' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          {t('ar_owner_says', { message: request.owner_message })}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-1">
        {phone && <CallLink phone={phone} label={t('ar_call')} />}
        {(request.status === 'new' || request.status === 'accepted') && (
          <button type="button" disabled={busy} onClick={() => onCancel(request)}
            className="min-h-10 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {t('ar_cancel')}
          </button>
        )}
      </div>
    </article>
  );
}

const FIELD = 'field border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none';

// Ask one ambulance service to come. Visitors who are not logged in as a patient are asked to log in.
export function RequestAmbulanceDialog({ vendor, onClose, onSent }) {
  const { t, i18n } = useTranslation();
  const { user, hasRole } = useAuth();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [phone, setPhone] = useState(() => user?.phone ?? '');
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('now');
  const [later, setLater] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCloseRef.current(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Typing again clears an old error.
  const edit = setter => e => { setter(e.target.value); setError(''); };
  const name = vendorName(vendor, i18n.language);
  const isPatient = hasRole('patient');
  const range = pickupRange();
  const redirect = `/ambulances?request=${encodeURIComponent(vendor.id)}`;

  async function send(e) {
    e.preventDefault();
    if (pickup.trim().length < 5) { setError(t('ar_err_pickup')); return; }
    const contact = normalizeBdPhone(phone);
    if (!contact) { setError(t('ar_err_phone')); return; }
    const pickupAt = when === 'later' ? dhakaInputToIso(later) : null;
    if (when === 'later' && !pickupAt) { setError(t('ar_err_time')); return; }
    setBusy(true);
    setError('');
    try {
      const request = await api.post('/my-ambulance-requests', {
        ambulance_id: vendor.id, pickup_address: pickup, destination, contact_phone: contact, note, pickup_at: pickupAt,
      });
      onSent(request);
    } catch (err) {
      setError(t(requestErrorKey(err)));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="request-ambulance-title">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <form onSubmit={send} noValidate
        className="absolute inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
          <h2 id="request-ambulance-title" className="font-semibold text-gray-900">{t('ar_title', { name })}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('close')} className="text-gray-500 p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
          <div className="rounded-xl bg-red-50 text-red-800 text-sm px-3 py-2 flex flex-col gap-2">
            <p>{t('ar_emergency_note')}</p>
            {vendor.phones?.[0] && <div><CallLink phone={vendor.phones[0]} label={t('ar_call_now')} /></div>}
          </div>

          {!user ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-700">{t('ar_login_needed')}</p>
              <div className="flex flex-wrap gap-2">
                <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="min-h-11 px-4 inline-flex items-center rounded-xl bg-primary text-white text-sm font-semibold">{t('login')}</Link>
                <Link to="/register" className="min-h-11 px-4 inline-flex items-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('ar_register')}</Link>
              </div>
            </div>
          ) : !isPatient ? (
            <p className="text-sm text-gray-700">{t('ar_patients_only')}</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">{t('ar_intro')}</p>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500">{t('ar_pickup')} *</span>
                <textarea value={pickup} onChange={edit(setPickup)} maxLength={300} rows={2} required
                  placeholder={t('ar_pickup_placeholder')} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500">{t('ar_destination')}</span>
                <input value={destination} onChange={edit(setDestination)} maxLength={200}
                  placeholder={t('ar_destination_placeholder')} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500">{t('ar_phone')} *</span>
                <input value={phone} onChange={edit(setPhone)} inputMode="tel" autoComplete="tel" required
                  placeholder="01712345678" className={FIELD} dir="ltr" />
                <span className="text-xs text-gray-500">{t('ar_phone_hint')}</span>
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs font-semibold text-gray-500 mb-1">{t('ar_when')}</legend>
                <div className="flex flex-wrap gap-2">
                  {['now', 'later'].map(option => (
                    <label key={option} className={`min-h-10 px-3 inline-flex items-center gap-2 rounded-lg border text-sm cursor-pointer ${when === option ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-gray-200 text-gray-700'}`}>
                      <input type="radio" name="when" value={option} checked={when === option} onChange={() => { setWhen(option); setError(''); }} className="accent-primary" />
                      {t(option === 'now' ? 'ar_when_now' : 'ar_when_later')}
                    </label>
                  ))}
                </div>
                {when === 'later' && (
                  <input type="datetime-local" value={later} min={range.min} max={range.max} onChange={edit(setLater)}
                    aria-label={t('ar_when_later_label')} className={`${FIELD} mt-1`} />
                )}
              </fieldset>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-500">{t('ar_note')}</span>
                <textarea value={note} onChange={edit(setNote)} maxLength={500} rows={2}
                  placeholder={t('ar_note_placeholder')} className={FIELD} />
              </label>
              {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('ar_close')}</button>
          {user && isPatient && (
            <button type="submit" disabled={busy}
              className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              <Send size={15} /> {busy ? t('ar_sending') : t('ar_send')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
