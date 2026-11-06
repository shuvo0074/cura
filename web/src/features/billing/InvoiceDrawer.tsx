import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../ui';
import { PAYMENT_METHODS, isInvoiceStatus, isPaymentMethod, money, toMinor } from './billing-kit';
import { useT } from '../../i18n';
import type { InvoiceSummary } from './BillingView';
import styles from './billing.module.css';

interface InvoiceDetail {
  id: string;
  number: string;
  status: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  notes: string | null;
  createdAt: string;
  items: Array<{
    description: string;
    quantity: number;
    unitMinor: number;
    discountMinor: number;
    totalMinor: number;
  }>;
}

interface Payment {
  id: string;
  amountMinor: number;
  method: string;
  reference: string | null;
  receivedAt: string;
}

/** Full invoice: line items, payment history, and collection. */
export function InvoiceDrawer({
  practiceId,
  summary,
  canWrite,
  onClose,
  onChanged,
  onOpenPatient,
}: {
  practiceId: string;
  summary: InvoiceSummary;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenPatient: (patientId: string) => void;
}) {
  const { http } = useServices();
  const { t, tm, fmt, locale } = useT();
  const statusLabel = (status: string) => (isInvoiceStatus(status) ? t(`billing.status.${status}`) : status);
  const methodLabel = (m: string) => (isPaymentMethod(m) ? t(`billing.method.${m}`) : m);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const reload = async () => {
    const [detail, history] = await Promise.all([
      http.request<InvoiceDetail>(`/billing/invoices/${summary.id}`, { query: { practiceId } }),
      http.request<Payment[]>(`/billing/invoices/${summary.id}/payments`, { query: { practiceId } }),
    ]);
    if (detail.ok) setInvoice(detail.value);
    else setError(detail.error.message);
    if (history.ok) setPayments(history.value);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.id, practiceId]);

  const outstanding = invoice ? invoice.totalMinor - invoice.paidMinor : 0;

  const collect = async () => {
    const amountMinor = toMinor(amount);
    if (amountMinor <= 0) {
      setError(t('billing.amountPositive'));
      return;
    }
    if (invoice && amountMinor > outstanding) {
      // Checked here as well as on the server so the amount is shown in the reader's language.
      setError(
        t('billing.exceedsBalance', {
          amount: locale === 'en' ? (outstanding / 100).toFixed(2) : money(outstanding, locale),
        }),
      );
      return;
    }

    setBusy(true);
    setError(null);
    const result = await http.request(`/billing/invoices/${summary.id}/payments`, {
      method: 'POST',
      body: { practiceId, amountMinor, method, reference: reference.trim() || undefined },
      retry: false,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setAmount('');
    setReference('');
    await reload();
    onChanged();
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const result = await http.request(`/billing/invoices/${summary.id}/cancel`, {
      method: 'POST',
      body: { practiceId },
      retry: false,
    });
    setBusy(false);
    setConfirmCancel(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await reload();
    onChanged();
  };

  const settled = invoice?.status === 'PAID' || invoice?.status === 'CANCELLED';

  return (
    <Modal
      title={t('billing.invoiceTitle', { number: summary.number })}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          {canWrite && invoice && !settled && (
            <button
              type="button"
              className={styles.dangerLink}
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
            >
              {t('billing.cancelInvoice')}
            </button>
          )}
          <button type="button" className={s.primary} onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <div className={styles.detailHead}>
        <div>
          <span className={styles.badge} data-status={(invoice?.status ?? summary.status).toLowerCase()}>
            {statusLabel(invoice?.status ?? summary.status)}
          </span>
          <p className={styles.muted}>
            {t('billing.raised', { date: fmt.dateTime(summary.createdAt) })}
          </p>
        </div>
        {summary.patient && (
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              onClose();
              onOpenPatient(summary.patient!.id);
            }}
          >
            {summary.patient.fullName} ({summary.patient.curaId}) →
          </button>
        )}
      </div>

      {!invoice ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : (
        <>
          <table className={styles.lineTable}>
            <thead>
              <tr>
                <th>{t('billing.col.treatment')}</th>
                <th className={styles.numeric}>{t('billing.col.qty')}</th>
                <th className={styles.numeric}>{t('billing.col.unit')}</th>
                <th className={styles.numeric}>{t('billing.col.discount')}</th>
                <th className={styles.numeric}>{t('billing.col.total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className={styles.numeric}>{fmt.number(item.quantity)}</td>
                  <td className={styles.numeric}>{money(item.unitMinor, locale)}</td>
                  <td className={styles.numeric}>{money(item.discountMinor, locale)}</td>
                  <td className={styles.numeric}>{money(item.totalMinor, locale)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{t('billing.subtotal')}</td>
                <td className={styles.numeric}>{money(invoice.subtotalMinor, locale)}</td>
              </tr>
              {invoice.discountMinor > 0 && (
                <tr>
                  <td colSpan={4}>{t('billing.invoiceDiscount')}</td>
                  <td className={styles.numeric}>−{money(invoice.discountMinor, locale)}</td>
                </tr>
              )}
              {invoice.taxMinor > 0 && (
                <tr>
                  <td colSpan={4}>{t('billing.tax')}</td>
                  <td className={styles.numeric}>{money(invoice.taxMinor, locale)}</td>
                </tr>
              )}
              <tr className={styles.totalRow}>
                <td colSpan={4}>{t('billing.col.total')}</td>
                <td className={styles.numeric}>{money(invoice.totalMinor, locale)}</td>
              </tr>
              <tr>
                <td colSpan={4}>{t('billing.col.paid')}</td>
                <td className={styles.numeric}>{money(invoice.paidMinor, locale)}</td>
              </tr>
              <tr className={styles.totalRow}>
                <td colSpan={4}>{t('billing.balanceDue')}</td>
                <td className={styles.numeric}>
                  {invoice.status === 'CANCELLED' ? '—' : money(outstanding, locale)}
                </td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && <p className={styles.notes}>{invoice.notes}</p>}

          <h4 className={s.subtitle}>{t('billing.payments')}</h4>
          {payments.length === 0 ? (
            <p className={styles.muted}>{t('billing.nothingCollected')}</p>
          ) : (
            <ul className={styles.payments}>
              {payments.map((p) => (
                <li key={p.id}>
                  <span>{money(p.amountMinor, locale)}</span>
                  <span className={styles.muted}>
                    {methodLabel(p.method)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className={styles.muted}>{fmt.dateTime(p.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}

          {canWrite && outstanding > 0 && invoice.status !== 'CANCELLED' && (
            <>
              <h4 className={s.subtitle}>{t('billing.collectPayment')}</h4>
              <Row>
                <Field label={t('billing.amountBdt')}>
                  <input
                    className={s.input}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={money(outstanding, locale)}
                  />
                </Field>
                <Field label={t('billing.method')}>
                  <select className={s.input} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`billing.method.${m}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('billing.reference')} hint={t('billing.referenceHint')}>
                  <input
                    className={s.input}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
              </Row>
              <div className={styles.collectActions}>
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setAmount((outstanding / 100).toFixed(2))}
                >
                  {t('billing.payInFull')}
                </button>
                <button type="button" className={s.primary} onClick={() => void collect()} disabled={busy}>
                  {busy ? t('billing.recording') : t('billing.recordPayment')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {confirmCancel && (
        <div className={styles.confirm} role="alertdialog" aria-label={t('billing.confirmCancelLabel')}>
          <p>{t('billing.confirmCancel', { number: summary.number })}</p>
          <div className={styles.collectActions}>
            <button type="button" className={s.secondary} onClick={() => setConfirmCancel(false)}>
              {t('billing.keepIt')}
            </button>
            <button type="button" className={styles.danger} onClick={() => void cancel()} disabled={busy}>
              {t('billing.cancelInvoice')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
