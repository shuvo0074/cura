import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../app/services';
import { InvoiceDrawer } from './InvoiceDrawer';
import { NewInvoiceDialog } from './NewInvoiceDialog';
import { STATUS_LABELS, money } from './billing-kit';
import styles from './billing.module.css';
import { Metric } from '../../ui';

export interface InvoiceSummary {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  paidMinor: number;
  createdAt: string;
  issuedAt: string | null;
  patient: { id: string; fullName: string; curaId: string; mobile: string } | null;
}

interface Ledger {
  items: InvoiceSummary[];
  nextCursor: string | null;
  outstandingMinor: number;
}

type Range = 'all' | '7' | '30' | '365';

const STATUS_FILTERS = ['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;

/**
 * Billing module.
 *
 * The ledger is server-filtered and cursor-paginated; the outstanding total
 * comes back aggregated over the whole filtered set rather than the visible
 * page, because a receivables figure that silently covered only 25 rows would
 * be actively misleading.
 */
export function BillingView({
  practiceId,
  canWrite,
  onOpenPatient,
}: {
  practiceId: string;
  canWrite: boolean;
  onOpenPatient: (patientId: string) => void;
}) {
  const { http } = useServices();

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('');
  const [range, setRange] = useState<Range>('30');

  const [open, setOpen] = useState<InvoiceSummary | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const filters = useMemo(() => {
    const params: Record<string, string> = { practiceId };
    if (query) params.q = query;
    if (status) params.status = status;
    if (range !== 'all') {
      params.from = new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    }
    return params;
  }, [practiceId, query, status, range]);

  const load = useCallback(
    async (cursor: string | null, signal?: AbortSignal) => {
      setLoading(true);
      const result = await http.request<Ledger>('/billing/invoices', {
        query: { ...filters, ...(cursor ? { cursor } : {}) },
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;

      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setLedger(result.value);
      setRows((current) => (cursor ? [...current, ...result.value.items] : result.value.items));
    },
    [http, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => void load(null), [load]);

  const collected = rows.reduce((sum, r) => sum + (r.status === 'CANCELLED' ? 0 : r.paidMinor), 0);

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <input
          className={styles.search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by invoice number or patient…"
          aria-label="Search invoices"
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? STATUS_LABELS[s] : 'All statuses'}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          aria-label="Filter by date"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="365">Last year</option>
          <option value="all">All time</option>
        </select>

        <span className={styles.spacer} />

        {canWrite && (
          <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
            New invoice
          </button>
        )}
      </header>

      <div className={styles.summary}>
        <Metric label="Outstanding" value={money(ledger?.outstandingMinor ?? 0)} tone="warn" />
        <Metric label="Collected (shown)" value={money(collected)} tone="good" />
        <Metric label="Invoices (shown)" value={String(rows.length)} />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className={styles.muted}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>No invoices match these filters.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Patient</th>
              <th>Date</th>
              <th>Status</th>
              <th className={styles.numeric}>Total</th>
              <th className={styles.numeric}>Paid</th>
              <th className={styles.numeric}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const balance = row.totalMinor - row.paidMinor;
              return (
                <tr key={row.id} onClick={() => setOpen(row)} className={styles.row} tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(row)}>
                  <td className={styles.number}>{row.number}</td>
                  <td>
                    {row.patient ? (
                      <>
                        <span className={styles.patientName}>{row.patient.fullName}</span>
                        <span className={styles.patientMeta}>{row.patient.curaId}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={styles.badge} data-status={row.status.toLowerCase()}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className={styles.numeric}>{money(row.totalMinor)}</td>
                  <td className={styles.numeric}>{money(row.paidMinor)}</td>
                  <td className={styles.numeric} data-due={balance > 0 && row.status !== 'CANCELLED' || undefined}>
                    {row.status === 'CANCELLED' ? '—' : money(balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ledger?.nextCursor && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void load(ledger.nextCursor)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {open && (
        <InvoiceDrawer
          practiceId={practiceId}
          summary={open}
          canWrite={canWrite}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onOpenPatient={onOpenPatient}
        />
      )}

      {creating && (
        <NewInvoiceDialog
          practiceId={practiceId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
