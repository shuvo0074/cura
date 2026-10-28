import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../ui';
import { PAYMENT_METHODS, STATUS_LABELS, money, toMinor } from './billing-kit';
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
      setError('Enter an amount greater than zero.');
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
      title={`Invoice ${summary.number}`}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
          {canWrite && invoice && !settled && (
            <button
              type="button"
              className={styles.dangerLink}
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
            >
              Cancel invoice
            </button>
          )}
          <button type="button" className={s.primary} onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className={styles.detailHead}>
        <div>
          <span className={styles.badge} data-status={(invoice?.status ?? summary.status).toLowerCase()}>
            {STATUS_LABELS[invoice?.status ?? summary.status]}
          </span>
          <p className={styles.muted}>
            Raised {new Date(summary.createdAt).toLocaleString()}
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
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          <table className={styles.lineTable}>
            <thead>
              <tr>
                <th>Treatment</th>
                <th className={styles.numeric}>Qty</th>
                <th className={styles.numeric}>Unit</th>
                <th className={styles.numeric}>Discount</th>
                <th className={styles.numeric}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className={styles.numeric}>{item.quantity}</td>
                  <td className={styles.numeric}>{money(item.unitMinor)}</td>
                  <td className={styles.numeric}>{money(item.discountMinor)}</td>
                  <td className={styles.numeric}>{money(item.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Subtotal</td>
                <td className={styles.numeric}>{money(invoice.subtotalMinor)}</td>
              </tr>
              {invoice.discountMinor > 0 && (
                <tr>
                  <td colSpan={4}>Invoice discount</td>
                  <td className={styles.numeric}>−{money(invoice.discountMinor)}</td>
                </tr>
              )}
              {invoice.taxMinor > 0 && (
                <tr>
                  <td colSpan={4}>Tax</td>
                  <td className={styles.numeric}>{money(invoice.taxMinor)}</td>
                </tr>
              )}
              <tr className={styles.totalRow}>
                <td colSpan={4}>Total</td>
                <td className={styles.numeric}>{money(invoice.totalMinor)}</td>
              </tr>
              <tr>
                <td colSpan={4}>Paid</td>
                <td className={styles.numeric}>{money(invoice.paidMinor)}</td>
              </tr>
              <tr className={styles.totalRow}>
                <td colSpan={4}>Balance due</td>
                <td className={styles.numeric}>
                  {invoice.status === 'CANCELLED' ? '—' : money(outstanding)}
                </td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && <p className={styles.notes}>{invoice.notes}</p>}

          <h4 className={s.subtitle}>Payments</h4>
          {payments.length === 0 ? (
            <p className={styles.muted}>Nothing collected yet.</p>
          ) : (
            <ul className={styles.payments}>
              {payments.map((p) => (
                <li key={p.id}>
                  <span>{money(p.amountMinor)}</span>
                  <span className={styles.muted}>
                    {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span className={styles.muted}>{new Date(p.receivedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}

          {canWrite && outstanding > 0 && invoice.status !== 'CANCELLED' && (
            <>
              <h4 className={s.subtitle}>Collect payment</h4>
              <Row>
                <Field label="Amount (BDT)">
                  <input
                    className={s.input}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={money(outstanding)}
                  />
                </Field>
                <Field label="Method">
                  <select className={s.input} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reference" hint="Transaction ID for a mobile-money payment.">
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
                  Pay in full
                </button>
                <button type="button" className={s.primary} onClick={() => void collect()} disabled={busy}>
                  {busy ? 'Recording…' : 'Record payment'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {confirmCancel && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirm cancellation">
          <p>
            Cancel invoice {summary.number}? It stays in the ledger and the audit trail, but stops
            counting towards receivables.
          </p>
          <div className={styles.collectActions}>
            <button type="button" className={s.secondary} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
            <button type="button" className={styles.danger} onClick={() => void cancel()} disabled={busy}>
              Cancel invoice
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
