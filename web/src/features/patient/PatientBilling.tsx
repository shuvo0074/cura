import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { NewInvoiceDialog } from '../billing/NewInvoiceDialog';
import { STATUS_LABELS, money } from '../billing/billing-kit';
import styles from './patient.module.css';

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
    <section className={styles.card} aria-label="Billing">
      <div className={styles.cardHead}>
        <h3 className={styles.sectionTitle}>
          Billing
          {outstanding > 0 && <span className={styles.balanceDue}>{money(outstanding)} due</span>}
        </h3>
        {canWrite && (
          <button type="button" className={styles.ghost} onClick={() => setCreating(true)}>
            New invoice
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>No invoices raised for this patient.</p>
      ) : (
        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Status</th>
              <th className={styles.numeric}>Total</th>
              <th className={styles.numeric}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.number}</td>
                <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                <td>{STATUS_LABELS[row.status] ?? row.status}</td>
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
