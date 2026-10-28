import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDownRight, QrCode, Award, Star } from 'lucide-react';
import { api } from '../../api/client';

// Change against the previous 30 days, or null when there's nothing to compare.
function delta(now, prev) {
  if (!prev) return null;
  return Math.round(((now - prev) / prev) * 100);
}

function Metric({ label, value, prev }) {
  const { t } = useTranslation();
  const d = delta(value, prev);
  return (
    <div>
      <dd className="text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums text-gray-950">{value.toLocaleString('en-IN')}</dd>
      <dt className="text-xs text-gray-500 mt-0.5">{label}</dt>
      {d !== null && d !== 0 && (
        <p className={`mt-1 inline-flex items-center gap-0.5 text-xs font-medium ${d > 0 ? 'text-green-700' : 'text-gray-500'}`}>
          {d > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {t('di_vs_prev', { pct: Math.abs(d) })}
        </p>
      )}
    </div>
  );
}

// Daily profile views as bars, with call taps marked on top.
function Bars({ series }) {
  const max = Math.max(1, ...series.map(s => s.views));
  return (
    <div className="flex items-end gap-[3px] h-16" aria-hidden>
      {series.map(s => (
        <div key={s.day} className="flex-1 flex flex-col justify-end h-full" title={`${s.day}: ${s.views} views, ${s.calls} calls`}>
          <div className={`rounded-sm ${s.calls > 0 ? 'bg-gray-950' : 'bg-gray-300'}`}
            style={{ height: `${Math.max(s.views ? 8 : 3, (s.views / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

// The doctor's reach on Cura over the last 30 days: what makes keeping the
// profile up to date worth it.
export default function InsightsCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/doctors/me/insights').then(setData).catch(() => {}); }, []);
  if (!data) return null;
  const quiet = data.views + data.calls + data.shares === 0;

  return (
    <section className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-950">{t('di_title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('di_period', { count: data.days })}</p>
        </div>
        <Link to="/doctor-dashboard/card"
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <QrCode size={14} /> {t('di_card_button')}
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-4">
        <Metric label={t('di_views')} value={data.views} prev={data.views_prev} />
        <Metric label={t('di_calls')} value={data.calls} prev={data.calls_prev} />
        <Metric label={t('di_shares')} value={data.shares} prev={data.shares_prev} />
      </dl>

      <div className="mt-5">
        <Bars series={data.series} />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
          <span>{t('di_days_ago', { count: data.days })}</span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-gray-300" /> {t('di_views')}</span>
            <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-gray-950" /> {t('di_day_with_calls')}</span>
          </span>
          <span>{t('di_today')}</span>
        </div>
      </div>

      {quiet && <p className="mt-4 text-[13px] text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">{t('di_quiet_hint')}</p>}

      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-gray-700">
        <span className="inline-flex items-center gap-1.5">
          <Award size={15} className="text-gray-400" /> {t('di_recognised', { count: data.peers })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Star size={15} className="text-gray-400" />
          {data.reviews.count > 0
            ? t('di_reviews', { count: data.reviews.count, avg: data.reviews.average.toFixed(1) })
            : t('di_no_reviews')}
        </span>
      </div>
    </section>
  );
}
