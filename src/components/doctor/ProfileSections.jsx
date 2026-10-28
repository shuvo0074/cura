import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Check, Plus, ArrowUpRight, ChevronDown } from 'lucide-react';
import { api } from '../../api/client';
import { degreeRows } from '../../utils/doctorProfile';

// The profile's credential record: one panel, a row per topic with the label
// in a left column, rows split by hairlines. Neutral greys; colour is kept
// for actions (blue) and verification (green).

// A record row that starts closed, showing a one-line summary in place of its
// content. Opens when its tab is followed (#id), so the tabs still land somewhere.
export function CollapsibleRow({ id, label, summary, children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    const openIfTargeted = () => { if (window.location.hash === `#${id}`) setOpen(true); };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    return () => window.removeEventListener('hashchange', openIfTargeted);
  }, [id]);

  return (
    <div id={id} className="scroll-mt-[calc(var(--header-h)+3.5rem)]">
      <h2>
        <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
          className="w-full grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[11rem_minmax(0,1fr)_auto] items-center gap-x-8 px-5 sm:px-8 py-5 text-left hover:bg-gray-50/70 transition-colors">
          <span className="text-[13px] font-semibold text-gray-950">{label}</span>
          <span className={`hidden md:block truncate text-sm text-gray-500 ${open ? 'invisible' : ''}`}>{summary}</span>
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      {open && <div className="min-w-0 px-5 sm:px-8 md:pl-[15rem] pb-6 -mt-1">{children}</div>}
    </div>
  );
}

export function RecordRow({ id, label, children }) {
  return (
    <div id={id} className="scroll-mt-[calc(var(--header-h)+3.5rem)] grid md:grid-cols-[11rem_minmax(0,1fr)] gap-x-8 gap-y-3 px-5 sm:px-8 py-6">
      <h2 className="text-[13px] font-semibold text-gray-950 md:pt-0.5">{label}</h2>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// A line item: what on the left, when on the right.
function Entry({ title, subtitle, when, children }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-gray-950 leading-snug">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 leading-snug mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {when && <span className="text-sm tabular-nums text-gray-500 whitespace-nowrap flex-shrink-0">{when}</span>}
    </li>
  );
}

export function QualificationsRow({ items, fallback }) {
  const { t } = useTranslation();
  const rows = degreeRows(items, fallback);
  if (!rows.length) return null;
  return (
    <CollapsibleRow id="qualifications" label={t('dp_qualifications')} summary={rows.map(r => r.title).join(', ')}>
      <ul>
        {rows.map(r => <Entry key={r.key} title={r.title} subtitle={r.institution} when={r.year} />)}
      </ul>
    </CollapsibleRow>
  );
}

function span(item, t) {
  if (!item.start_year) return item.end_year ? String(item.end_year) : null;
  const end = item.is_current ? t('dp_present') : item.end_year;
  return end && end !== item.start_year ? `${item.start_year} – ${end}` : String(item.start_year);
}

export function PositionsRow({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <RecordRow id="experience" label={t('dp_positions')}>
      <ul>
        {items.map(i => (
          <Entry key={i.id} title={i.title} subtitle={[i.organization, i.location].filter(Boolean).join(', ')} when={span(i, t)}>
            {i.description && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{i.description}</p>}
          </Entry>
        ))}
      </ul>
    </RecordRow>
  );
}

export function PublicationsRow({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <RecordRow label={t('dp_publications')}>
      <ul>
        {items.map(p => (
          <Entry key={p.id} title={p.title} subtitle={p.organization} when={p.end_year}>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-0.5 text-[13px] font-medium text-action hover:underline mt-1">
                {t('dp_view_publication')} <ArrowUpRight size={13} />
              </a>
            )}
          </Entry>
        ))}
      </ul>
    </RecordRow>
  );
}

export function MembershipsRow({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <RecordRow label={t('dp_memberships')}>
      <ul>{items.map(i => <Entry key={i.id} title={i.organization || i.title} subtitle={i.organization ? i.title : null} when={i.start_year && t('dp_since', { year: i.start_year })} />)}</ul>
    </RecordRow>
  );
}

export function AwardsRow({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <RecordRow label={t('dp_awards')}>
      <ul>{items.map(i => <Entry key={i.id} title={i.title} subtitle={i.organization} when={i.end_year} />)}</ul>
    </RecordRow>
  );
}

// Areas of expertise with how many BMDC-verified doctors recognise each.
// A verified colleague can tap one to add or withdraw their recognition.
export function ExpertiseRow({ doctorId, endorsements, canEndorse, onChange }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(null);
  if (!endorsements?.length) return null;

  async function toggle(e) {
    setPending(e.skill);
    try {
      if (e.endorsedByMe) await api.del(`/doctors/${doctorId}/endorsements?skill=${encodeURIComponent(e.skill)}`);
      else await api.post(`/doctors/${doctorId}/endorsements`, { skill: e.skill });
      await onChange();
    } finally {
      setPending(null);
    }
  }

  const anyRecognised = endorsements.some(e => e.count > 0);
  return (
    <CollapsibleRow id="expertise" label={t('dp_expertise_endorsed')} summary={endorsements.map(e => e.skill).join(', ')}>
      <ul className="flex flex-wrap gap-2">
        {endorsements.map(e => {
          const names = e.endorsers.map(d => d.name).join(', ');
          const title = e.count > 0 ? `${t('dp_peer_count', { count: e.count })}${names ? `: ${names}` : ''}` : undefined;
          const body = (
            <>
              {e.skill}
              {e.count > 0 && <span className={`tabular-nums ${e.endorsedByMe ? 'text-white/70' : 'text-gray-500'}`}>{e.count}</span>}
            </>
          );
          return (
            <li key={e.skill}>
              {canEndorse ? (
                <button type="button" onClick={() => toggle(e)} disabled={pending === e.skill} aria-pressed={e.endorsedByMe} title={title}
                  className={`inline-flex items-center gap-1.5 text-[13px] font-medium rounded-md pl-2 pr-2.5 py-1.5 transition-colors disabled:opacity-50
                    ${e.endorsedByMe ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                  {e.endorsedByMe ? <Check size={13} /> : <Plus size={13} className="text-gray-500" />}
                  {body}
                </button>
              ) : (
                <span title={title} className="inline-flex items-center gap-1.5 text-[13px] font-medium rounded-md px-2.5 py-1.5 bg-gray-100 text-gray-800">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {(canEndorse || anyRecognised) && (
        <p className="text-xs text-gray-500 mt-3">{canEndorse ? t('dp_recognise_hint') : t('dp_expertise_hint')}</p>
      )}
    </CollapsibleRow>
  );
}

export function Stars({ value, size = 14, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'text-amber-400' : 'text-gray-200'} fill="currentColor" />
      ))}
    </span>
  );
}

export function ReviewsRow({ reviews }) {
  const { t, i18n } = useTranslation();
  if (!reviews) return null;
  const fmt = new Intl.DateTimeFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', { month: 'short', year: 'numeric' });
  return (
    <RecordRow id="reviews" label={t('dp_patient_reviews')}>
      {reviews.count === 0 ? (
        <p className="text-sm text-gray-500">{t('dp_no_reviews')} {t('dp_reviews_hint')}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-gray-950">{reviews.average.toFixed(1)}</span>
            <div>
              <Stars value={reviews.average} size={14} />
              <p className="text-xs text-gray-500">{t('dp_reviews_count', { count: reviews.count })}</p>
            </div>
          </div>
          <ul className="mt-5 divide-y divide-gray-100">
            {reviews.recent.map(r => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} size={12} />
                  <span className="text-xs text-gray-500">{t('dp_verified_patient')} · {fmt.format(new Date(r.created_at))}</span>
                </div>
                {r.comment && <p className="text-[15px] text-gray-800 mt-1 whitespace-pre-line">{r.comment}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-4">{t('dp_reviews_hint')}</p>
        </>
      )}
    </RecordRow>
  );
}
