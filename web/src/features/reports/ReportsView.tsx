import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../app/services';
import styles from './reports.module.css';
import { Metric } from '../../ui';
import { useT } from '../../i18n';

type Kind = 'income' | 'appointments' | 'procedures' | 'demographics';

const KINDS: readonly Kind[] = ['income', 'appointments', 'procedures', 'demographics'];

const RANGES = [7, 30, 90, 365] as const;

interface ReportResponse {
  rows: Array<Record<string, string | number>>;
  totals?: { invoicedMinor: number; collectedMinor: number; invoiceCount: number };
}

/** Columns Cura API returns, each with a `reports.col.*` heading. */
const COLUMNS = [
  'day',
  'invoicedMinor',
  'collectedMinor',
  'invoiceCount',
  'total',
  'done',
  'cancelled',
  'name',
  'count',
  'revenueMinor',
  'bucket',
] as const;
const isKnownColumn = (c: string): c is (typeof COLUMNS)[number] => (COLUMNS as readonly string[]).includes(c);

/** "2026-11-06" as a local calendar date, so no time zone can shift it by a day. */
const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Statistics (spec: Reports / Statistics module).
 *
 * Aggregation happens in the database; this screen only picks a range and
 * renders what comes back. The bar chart is plain CSS — no charting library,
 * which keeps the bundle small for a view that renders a handful of rows.
 */
export function ReportsView({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const { t, tm, fmt } = useT();
  const money = (minor: number) => fmt.number(minor / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const heading = (c: string) =>
    isKnownColumn(c)
      ? t(`reports.col.${c}`)
      : c.replace(/Minor$/, ' (BDT)').replace(/([a-z])([A-Z])/g, '$1 $2');
  const cell = (c: string, value: string | number | undefined): string => {
    if (typeof value === 'number') return c.endsWith('Minor') ? money(value) : fmt.number(value);
    if (value === undefined) return '';
    const day = isoDay.exec(value);
    if (day) return fmt.date(new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
    if (c === 'bucket') {
      // Age groups such as "18-34" and "55+", or "Unknown".
      return value === 'Unknown'
        ? t('reports.bucket.Unknown')
        : value.replace(/\d+/g, (n) => fmt.number(Number(n), { useGrouping: false }));
    }
    return value;
  };
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
        <div className={styles.tabs} role="tablist" aria-label={t('reports.reportType')}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              data-active={kind === k || undefined}
              onClick={() => setKind(k)}
            >
              {t(`reports.kind.${k}`)}
            </button>
          ))}
        </div>
        <span className={styles.spacer} />
        <label className={styles.rangeLabel}>
          {t('reports.range')}
          <select
            className={styles.select}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {RANGES.map((n) => (
              <option key={n} value={n}>
                {t(`reports.range.${n}`)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {data?.totals && (
        <div className={styles.summary}>
          <Metric label={t('reports.invoiced')} value={t('reports.bdt', { amount: money(data.totals.invoicedMinor) })} />
          <Metric label={t('reports.collected')} value={t('reports.bdt', { amount: money(data.totals.collectedMinor) })} />
          <Metric
            label={t('reports.outstanding')}
            value={t('reports.bdt', { amount: money(data.totals.invoicedMinor - data.totals.collectedMinor) })}
          />
          <Metric label={t('reports.invoices')} value={fmt.number(data.totals.invoiceCount)} />
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {tm(error)}
        </p>
      )}

      {loading ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className={styles.muted}>{t('reports.noData')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className={typeof data.rows[0]?.[c] === 'number' ? styles.numeric : undefined}>
                  {heading(c)}
                </th>
              ))}
              <th aria-label={t('reports.relativeSize')} />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => {
              const firstNumber = Object.values(row).find((v): v is number => typeof v === 'number') ?? 0;
              return (
                <tr key={i}>
                  {columns.map((c) => {
                    const value = row[c];
                    return (
                      <td key={c} className={typeof value === 'number' ? styles.numeric : undefined}>
                        {cell(c, value)}
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
