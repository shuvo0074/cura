import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { NewInvoiceDialog } from '../billing/NewInvoiceDialog';
import { useT } from '../../i18n';
import styles from './patient.module.css';

const STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
type InvoiceStatus = (typeof STATUSES)[number];
const isKnownStatus = (status: string): status is InvoiceStatus => (STATUSES as readonly string[]).includes(status);

interface Invoice {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  createdAt: string;
}

/**
 * This patient's invoices (spec: the Billing tab on the record).
 *
 * Shows the running balance the front desk needs at checkout, without leaving
 * the chart the doctor just wrote.
 */
export function PatientBilling({
  practiceId,
  patient,
  encounterId,
  canWrite,
}: {
  practiceId: string;
  patient: { id: string; fullName: string };
  encounterId?: string | undefined;
  canWrite: boolean;
}) {
  const { http } = useServices();
  const { t, fmt } = useT();
  /** Taka from poisha, with two decimals, as the billing screens show it. */
  const money = (minor: number) => fmt.number(minor / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await http.request<{ items: Invoice[] }>(
      `/billing/patients/${patient.id}/invoices`,
      { query: { practiceId } },
    );
    setLoading(false);
    if (result.ok) setRows(result.value.items);
  }, [http, practiceId, patient.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const outstanding = rows
    .filter((r) => r.status !== 'CANCELLED')
    .reduce((sum, r) => sum + (r.totalMinor - r.paidMinor), 0);

  return (
    <section className={styles.card} aria-label={t('patients.tab.billing')}>
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>
          {t('patients.tab.billing')}
          {outstanding > 0 && (
            <span className={styles.balanceDue}>{t('patients.bill.due', { amount: money(outstanding) })}</span>
          )}
        </h3>
        {canWrite && (
          <button type="button" className={styles.ghost} onClick={() => setCreating(true)}>
            {t('patients.bill.new')}
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>{t('patients.bill.empty')}</p>
      ) : (
        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>{t('patients.bill.invoice')}</th>
              <th>{t('patients.bill.date')}</th>
              <th>{t('patients.bill.status')}</th>
              <th className={styles.numeric}>{t('patients.bill.total')}</th>
              <th className={styles.numeric}>{t('patients.bill.balance')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{fmt.date(row.createdAt)}</td>
                <td>{isKnownStatus(row.status) ? t(`patients.bill.status.${row.status}`) : row.status}</td>
                <td className={styles.numeric}>{money(row.totalMinor)}</td>
                <td className={styles.numeric}>
                  {row.status === 'CANCELLED' ? '—' : money(row.totalMinor - row.paidMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <NewInvoiceDialog
          practiceId={practiceId}
          patient={patient}
          encounterId={encounterId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </section>
  );
}
