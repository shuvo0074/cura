import { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, Pill, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { filterPharmacies, orderErrorKey, telHref } from '../../utils/pharmacyFilters';
import { phoneDigits } from '../../utils/phone';

const locale = lang => (lang === 'bn' ? 'bn-BD' : 'en-GB');
const formatWhen = (iso, lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

const ORDER_STATUS_STYLE = {
  new: 'bg-amber-50 text-amber-700',
  ready: 'bg-green-50 text-green-700',
  collected: 'bg-gray-100 text-gray-600',
  cannot_fill: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function OrderStatus({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.new}`}>
      {t(`po_status_${status}`)}
    </span>
  );
}

// One prescription the patient sent to a pharmacy, with its status.
export function PharmacyOrderCard({ order, busy, onCancel }) {
  const { t, i18n } = useTranslation();
  const { pharmacy } = order;
  const place = [pharmacy.address, pharmacy.city].filter(Boolean).join(', ');
  const phone = pharmacy.phones?.[0];
  return (
    <article className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2" data-testid="pharmacy-order">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><Pill size={16} className="text-primary flex-shrink-0" /> {pharmacy.name}</p>
          {place && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={12} className="flex-shrink-0" /> {place}</p>}
          <p className="text-xs text-gray-500 mt-0.5">{t('po_sent_at', { when: formatWhen(order.created_at, i18n.language) })}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>
      <p className="text-sm text-gray-700">
        {order.items.map(item => [item.drug_name, item.strength].filter(Boolean).join(' ')).join(', ')}
      </p>
      {order.status === 'ready' && <p className="text-sm font-medium text-green-700">{t('po_ready_note')}</p>}
      {order.reason && <p className="text-sm text-red-700">{t('po_reason', { reason: order.reason })}</p>}
      {order.note && <p className="text-xs text-gray-500">{t('po_your_note', { note: order.note })}</p>}
      <div className="flex flex-wrap gap-2 mt-1">
        {phone && (
          <a href={telHref(phone)} className="min-h-10 inline-flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-primary hover:bg-primary/5">
            <Phone size={14} /> {t('pharmacy_call_button')} · <span dir="ltr">{phoneDigits(phone, i18n.language)}</span>
          </a>
        )}
        {order.status === 'new' && (
          <button type="button" disabled={busy} onClick={() => onCancel(order)}
            className="min-h-10 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {t('po_cancel')}
          </button>
        )}
      </div>
    </article>
  );
}

// Choose a pharmacy and send one prescription to it.
export function SendToPharmacyDialog({ prescriptionId, onClose, onSent }) {
  const { t } = useTranslation();
  const [pharmacies, setPharmacies] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    let active = true;
    api.get('/pharmacies').then(list => { if (active) setPharmacies(list); }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

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

  async function send() {
    if (!pharmacyId) { setError(t('po_choose_first')); return; }
    setBusy(true);
    setError('');
    try {
      const order = await api.post('/my-pharmacy-orders', { prescription_id: prescriptionId, pharmacy_id: pharmacyId, note });
      onSent(order);
    } catch (err) {
      setError(t(orderErrorKey(err)));
      setBusy(false);
    }
  }

  const visible = pharmacies ? filterPharmacies(pharmacies, { query }) : [];
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="send-rx-title">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
          <h2 id="send-rx-title" className="font-semibold text-gray-900">{t('po_send_title')}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('close')} className="text-gray-500 p-2 -mr-2 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
          <p className="text-sm text-gray-600">{t('po_send_intro')}</p>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('po_search')} aria-label={t('po_search')}
            className="field border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 mb-1">{t('po_choose')}</legend>
            {loadError ? <p className="text-sm text-red-600">{t('pharmacy_load_error')}</p>
              : !pharmacies ? <p className="text-sm text-gray-500">{t('loading')}</p>
                : visible.length === 0 ? <p className="text-sm text-gray-500">{t('po_none')}</p>
                  : (
                    <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                      {visible.map(pharmacy => (
                        <li key={pharmacy.id}>
                          <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${pharmacyId === pharmacy.id ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                            <input type="radio" name="pharmacy" value={pharmacy.id} checked={pharmacyId === pharmacy.id}
                              onChange={() => setPharmacyId(pharmacy.id)} className="mt-1 accent-primary" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-900">{pharmacy.name}</span>
                              <span className="block text-xs text-gray-500">{[pharmacy.address, pharmacy.city].filter(Boolean).join(', ')}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">{t('po_note')}</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t('po_note_placeholder')}
              className="field border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('po_dialog_cancel')}</button>
          <button type="button" onClick={send} disabled={busy}
            className="min-h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            <Send size={15} /> {busy ? t('po_sending') : t('po_send_button')}
          </button>
        </div>
      </div>
    </div>
  );
}
