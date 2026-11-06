import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { Activity, CalendarDays, Clock, FileText, HeartPulse, Pill, Printer, Receipt, Send, ShoppingBag, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { OrderStatus, PharmacyOrderCard, SendToPharmacyDialog } from '../components/pharmacy/PharmacyOrders';
import { isOpenOrder, latestOrderByPrescription, orderErrorKey } from '../utils/pharmacyFilters';

// Printing a prescription shows only that one card on the page.
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body * { visibility: hidden !important; }
  .rx-printing, .rx-printing * { visibility: visible !important; }
  .rx-printing { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
  .rx-printing .no-print { display: none !important; }
}`;

const DHAKA = 'Asia/Dhaka';
const locale = lang => (lang === 'bn' ? 'bn-BD' : 'en-GB');

// The calendar day in Dhaka, used to group visits.
const dhakaDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA }).format(new Date(iso));
const formatDay = (iso, lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: DHAKA, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
const formatTime = (iso, lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: DHAKA, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
// Date-only values (follow-up dates) are calendar days, not instants.
const formatDate = (ymd, lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T00:00:00Z`));
const money = (minor, lang) =>
  `৳ ${(minor / 100).toLocaleString(locale(lang), { maximumFractionDigits: 2 })}`;
const dose = n => (n === 0.5 ? '½' : n === 0.25 ? '¼' : String(n));

function SectionTitle({ icon: Icon, children, count }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      <Icon size={16} className="text-primary" /> {children}
      {count != null && <span className="font-normal">({count})</span>}
    </h2>
  );
}

function List({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <ul className="text-sm text-gray-800 list-disc pl-5">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Vitals({ vitals }) {
  const { t } = useTranslation();
  if (!vitals) return null;
  const rows = [
    vitals.weight_kg != null && [t('mh_weight'), `${vitals.weight_kg} kg`],
    vitals.systolic != null && vitals.diastolic != null && [t('mh_bp'), `${vitals.systolic}/${vitals.diastolic} mmHg`],
    vitals.pulse_bpm != null && [t('mh_pulse'), `${vitals.pulse_bpm} /min`],
    vitals.temperature_c != null && [t('mh_temperature'), `${vitals.temperature_c} °C`],
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Activity size={13} /> {t('mh_vitals')}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-secondary rounded-lg px-3 py-2">
            <dt className="text-[11px] text-gray-500">{label}</dt>
            <dd className="text-sm font-semibold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Prescription({ visit, onPrint, lastOrder, onSend }) {
  const { t, i18n } = useTranslation();
  const rx = visit.prescription;
  if (!rx || (!rx.items.length && !rx.investigations.length && !rx.follow_up_date)) return null;
  return (
    <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Pill size={15} className="text-primary" /> {t('mh_prescription')}</p>
        <div className="no-print flex items-center gap-1">
          {rx.id && rx.items.length > 0 && (
            <button type="button" onClick={() => onSend(rx.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-action px-2 py-1 rounded-lg hover:bg-gray-50">
              <Send size={15} /> {t('po_send')}
            </button>
          )}
          <button type="button" onClick={() => onPrint(visit.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-action px-2 py-1 rounded-lg hover:bg-gray-50">
            <Printer size={15} /> {t('mh_print')}
          </button>
        </div>
      </div>
      {lastOrder && (
        <p className="no-print text-xs text-gray-600 flex items-center gap-2 flex-wrap">
          {t('po_sent_to', { name: lastOrder.pharmacy.name })} <OrderStatus status={lastOrder.status} />
        </p>
      )}
      {rx.items.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rx.items.map((item, i) => (
            <li key={`${item.drug_name}-${i}`} className="bg-secondary rounded-lg px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">
                {i + 1}. {[item.form, item.drug_name, item.strength].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-gray-700 mt-0.5">
                <span className="font-semibold">{dose(item.morning)} + {dose(item.noon)} + {dose(item.night)}</span>
                <span className="text-xs text-gray-500 ml-1.5">({t('mh_morning')} + {t('mh_noon')} + {t('mh_night')})</span>
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {[
                  item.meal_relation === 'before' && t('mh_before_meal'),
                  item.meal_relation === 'after' && t('mh_after_meal'),
                  item.duration_days && t('mh_days', { count: item.duration_days }),
                ].filter(Boolean).join(' · ')}
              </p>
              {item.instruction && <p className="text-xs text-gray-600 mt-0.5">{item.instruction}</p>}
            </li>
          ))}
        </ol>
      )}
      <List label={t('mh_investigations')} items={rx.investigations} />
      {rx.follow_up_date && (
        <p className="text-sm text-gray-800">
          <span className="text-xs font-semibold text-gray-500">{t('mh_follow_up')}: </span>
          {formatDate(rx.follow_up_date, i18n.language)}
        </p>
      )}
    </div>
  );
}

function VisitCard({ visit, printing, onPrint, lastOrder, onSend }) {
  const { t, i18n } = useTranslation();
  return (
    <article className={`bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3 ${printing ? 'rx-printing' : ''}`}>
      <div>
        <p className="font-semibold text-gray-900 flex items-center gap-2">
          <Stethoscope size={16} className="text-primary flex-shrink-0" /> {visit.doctor_name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {visit.clinic_name} · {formatDay(visit.occurred_at, i18n.language)}, {formatTime(visit.occurred_at, i18n.language)}
        </p>
      </div>
      <List label={t('mh_complaints')} items={visit.complaints} />
      <List label={t('mh_diagnosis')} items={visit.diagnoses} />
      <Vitals vitals={visit.vitals} />
      <List label={t('mh_advice')} items={visit.advice} />
      <Prescription visit={visit} onPrint={onPrint} lastOrder={lastOrder} onSend={onSend} />
    </article>
  );
}

const STATUS_STYLE = {
  paid: 'bg-green-50 text-green-700',
  partially_paid: 'bg-amber-50 text-amber-700',
  issued: 'bg-primary/10 text-primary',
  cancelled: 'bg-gray-100 text-gray-500',
};

function InvoiceCard({ invoice }) {
  const { t, i18n } = useTranslation();
  const cancelled = invoice.status === 'cancelled';
  const due = Math.max(invoice.total_minor - invoice.paid_minor, 0);
  return (
    <article className={`bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3 ${cancelled ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{t('mh_invoice_no', { number: invoice.number })}</p>
          <p className="text-xs text-gray-500 mt-0.5">{invoice.clinic_name} · {formatDay(invoice.date, i18n.language)}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[invoice.status] ?? STATUS_STYLE.issued}`}>
          {t(`mh_status_${invoice.status}`)}
        </span>
      </div>
      {invoice.items.length > 0 && (
        <ul className="text-sm text-gray-700 flex flex-col gap-1">
          {invoice.items.map((item, i) => (
            <li key={`${item.description}-${i}`} className="flex justify-between gap-3">
              <span className="min-w-0">{item.description}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span>
              <span className="flex-shrink-0">{money(item.total_minor, i18n.language)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className={`text-sm border-t border-gray-100 pt-2 flex flex-col gap-1 ${cancelled ? 'line-through' : ''}`}>
        <div className="flex justify-between"><dt className="text-gray-500">{t('mh_total')}</dt><dd className="font-semibold text-gray-900">{money(invoice.total_minor, i18n.language)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-500">{t('mh_paid')}</dt><dd className="text-gray-900">{money(invoice.paid_minor, i18n.language)}</dd></div>
        {!cancelled && due > 0 && (
          <div className="flex justify-between"><dt className="text-gray-500">{t('mh_due')}</dt><dd className="font-semibold text-red-600">{money(due, i18n.language)}</dd></div>
        )}
      </dl>
    </article>
  );
}

// A patient's own records from the clinics they joined: visits with their
// prescriptions, upcoming clinic appointments and invoices. Read-only.
export default function MyHealthPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [printingId, setPrintingId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [sendingRx, setSendingRx] = useState(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderNotice, setOrderNotice] = useState('');

  const loadOrders = () => api.get('/my-pharmacy-orders').then(setOrders).catch(() => {});

  useEffect(() => {
    api.get('/my-health').then(setData).catch(err => setError(err.message));
    loadOrders();
  }, []);

  async function cancelOrder(order) {
    if (!window.confirm(t('po_cancel_confirm'))) return;
    setOrderBusy(true);
    setOrderNotice('');
    try {
      await api.post(`/my-pharmacy-orders/${order.id}/cancel`, {});
    } catch (err) {
      setOrderNotice(t(orderErrorKey(err)));
    }
    await loadOrders();
    setOrderBusy(false);
  }

  useEffect(() => {
    const done = () => setPrintingId(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  function printPrescription(id) {
    flushSync(() => setPrintingId(id));
    window.print();
  }

  if (error) {
    return <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>;
  }
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">{t('loading')}</div>;

  const { visits, invoices, upcoming_appointments: upcoming } = data;
  const isEmpty = !visits.length && !invoices.length && !upcoming.length && !orders.length;
  const lastOrders = latestOrderByPrescription(orders);
  // Open orders first, each group newest first (the API sends newest first).
  const sortedOrders = [...orders.filter(isOpenOrder), ...orders.filter(o => !isOpenOrder(o))];

  // Visits arrive newest first; group them by their day in Dhaka.
  const days = [];
  for (const visit of visits) {
    const day = dhakaDay(visit.occurred_at);
    if (days.at(-1)?.day !== day) days.push({ day, at: visit.occurred_at, visits: [] });
    days.at(-1).visits.push(visit);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <style>{PRINT_CSS}</style>
      <PageHeader title={t('mh_title')} />
      <p className="text-sm text-gray-500 -mt-1 sm:-mt-4 mb-3">{t('mh_sub')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-6 text-sm font-semibold text-action">
        <Link to="/appointments" className="hover:underline">{t('my_appointments')}</Link>
        <Link to="/my-clinics" className="hover:underline">{t('mc_title')}</Link>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={HeartPulse}
          title={t('mh_empty')}
          message={t('mh_empty_msg')}
          actions={[{ label: t('mc_title'), to: '/my-clinics' }]}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {orders.length > 0 && (
            <section aria-labelledby="pharmacy-orders-title">
              <div id="pharmacy-orders-title"><SectionTitle icon={ShoppingBag} count={orders.length}>{t('po_title')}</SectionTitle></div>
              {orderNotice && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{orderNotice}</p>}
              <div className="flex flex-col gap-3">
                {sortedOrders.map(order => <PharmacyOrderCard key={order.id} order={order} busy={orderBusy} onCancel={cancelOrder} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <SectionTitle icon={CalendarDays} count={upcoming.length}>{t('mh_upcoming')}</SectionTitle>
              <div className="flex flex-col gap-3">
                {upcoming.map(a => (
                  <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
                    <p className="font-semibold text-gray-900 text-sm">{a.doctor_name}</p>
                    <p className="text-xs text-gray-500">{a.clinic_name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-700">
                      <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-primary" /> {formatDay(a.scheduled_at, i18n.language)}</span>
                      <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary" /> {formatTime(a.scheduled_at, i18n.language)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle icon={FileText} count={visits.length}>{t('mh_visits')}</SectionTitle>
            {visits.length === 0 ? (
              <p className="text-sm text-gray-500">{t('mh_no_visits')}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {days.map(({ day, at, visits: dayVisits }) => (
                  <div key={day}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{formatDay(at, i18n.language)}</h3>
                    <div className="flex flex-col gap-3">
                      {dayVisits.map(visit => (
                        <VisitCard key={visit.id} visit={visit} printing={printingId === visit.id} onPrint={printPrescription}
                          lastOrder={visit.prescription?.id ? lastOrders[visit.prescription.id] : null} onSend={setSendingRx} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon={Receipt} count={invoices.length}>{t('mh_invoices')}</SectionTitle>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500">{t('mh_no_invoices')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {invoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} />)}
              </div>
            )}
          </section>
        </div>
      )}

      {sendingRx && (
        <SendToPharmacyDialog
          prescriptionId={sendingRx}
          onClose={() => setSendingRx(null)}
          onSent={order => {
            setSendingRx(null);
            setOrders(current => [order, ...current]);
            setOrderNotice('');
          }}
        />
      )}
    </div>
  );
}
