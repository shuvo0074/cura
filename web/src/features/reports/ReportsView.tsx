import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../app/services';
import styles from './reports.module.css';

type Kind = 'income' | 'appointments' | 'procedures' | 'demographics';

const KINDS: ReadonlyArray<{ key: Kind; label: string }> = [
  { key: 'income', label: 'Income' },
  { key: 'appointments', label: 'Appointment volume' },
  { key: 'procedures', label: 'Top procedures' },
  { key: 'demographics', label: 'Demographics' },
];

interface ReportResponse {
  rows: Array<Record<string, string | number>>;
  totals?: { invoicedMinor: number; collectedMinor: number; invoiceCount: number };
}

const money = (minor: number) => (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

/**
 * Statistics (spec: Reports / Statistics module).
 *
 * Aggregation happens in the database; this screen only picks a range and
 * renders what comes back. The bar chart is plain CSS — no charting library,
 * which keeps the bundle small for a view that renders a handful of rows.
 */
export function ReportsView({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const [kind, setKind] = useState<Kind>('income');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);

      const result = await http.request<ReportResponse>('/billing/reports', {
        query: {
          practiceId,
          kind,
          from: from.toISOString(),
          // Inclusive of today: the backend treats `to` as exclusive.
          to: new Date(to.getTime() + 86_400_000).toISOString(),
        },
        signal,
      });

      if (signal.aborted) return;
      setLoading(false);
      if (result.ok) setData(result.value);
      else setError(result.error.message);
    },
    [http, practiceId, kind, days],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const columns = useMemo(() => {
    const first = data?.rows[0];
    return first ? Object.keys(first) : [];
  }, [data]);

  const peak = useMemo(() => {
    if (!data?.rows.length) return 0;
    const numeric = data.rows.flatMap((r) =>
      Object.values(r).filter((v): v is number => typeof v === 'number'),
    );
    return Math.max(1, ...numeric);
  }, [data]);

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Report type">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              data-active={kind === k.key || undefined}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <label className={styles.rangeLabel}>
          Range
          <select
            className={styles.select}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </label>
      </header>

      {data?.totals && (
        <div className={styles.summary}>
          <Metric label="Invoiced" value={`BDT ${money(data.totals.invoicedMinor)}`} />
          <Metric label="Collected" value={`BDT ${money(data.totals.collectedMinor)}`} />
          <Metric
            label="Outstanding"
            value={`BDT ${money(data.totals.invoicedMinor - data.totals.collectedMinor)}`}
          />
          <Metric label="Invoices" value={String(data.totals.invoiceCount)} />
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : !data || data.rows.length === 0 ? (
        <p className={styles.muted}>No data for this range.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className={typeof data.rows[0]?.[c] === 'number' ? styles.numeric : undefined}>
                  {c.replace(/Minor$/, ' (BDT)').replace(/([a-z])([A-Z])/g, '$1 $2')}
                </th>
              ))}
              <th aria-label="Relative size" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => {
              const firstNumber = Object.values(row).find((v): v is number => typeof v === 'number') ?? 0;
              return (
                <tr key={i}>
                  {columns.map((c) => {
                    const value = row[c];
                    const isMoney = c.endsWith('Minor');
                    return (
                      <td key={c} className={typeof value === 'number' ? styles.numeric : undefined}>
                        {typeof value === 'number' && isMoney ? money(value) : String(value)}
                      </td>
                    );
                  })}
                  <td className={styles.barCell}>
                    <span
                      className={styles.bar}
                      style={{ width: `${Math.round((firstNumber / peak) * 100)}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}
