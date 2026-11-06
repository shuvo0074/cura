import { useState } from 'react';
import { Failed, Loading, uiStyles as s, useResource } from '../../ui';
import { useT } from '../../i18n';
import { FeedbackCard } from './FeedbackCard';
import { RecordFeedbackDialog } from './RecordFeedbackDialog';
import { stars, type FeedbackFilter, type FeedbackResponse } from './feedback-shared';
import styles from './feedback.module.css';

const FILTERS: readonly FeedbackFilter[] = ['all', 'unanswered', 5, 4, 3, 2, 1];

/**
 * Feedback Management (spec 2.2): patient ratings of their visits and the
 * practice's replies.
 *
 * The summary always reflects every rating; the filter narrows only the list,
 * so a "1 ★" view never makes the practice average look worse than it is.
 */
export function FeedbackView({ practiceId, canWrite }: { practiceId: string; canWrite: boolean }) {
  const { t, fmt } = useT();
  const [filter, setFilter] = useState<FeedbackFilter>('all');
  const [recording, setRecording] = useState(false);
  const { data, error, loading, reload } = useResource<FeedbackResponse>('/engagement/feedback', {
    practiceId,
    rating: typeof filter === 'number' ? String(filter) : undefined,
    unanswered: filter === 'unanswered' ? 'true' : undefined,
  });

  const summary = data?.summary;
  const peak = Math.max(1, ...(summary?.distribution ?? [0]));

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <div>
          <h1 className={s.title}>{t('patients.fb.title')}</h1>
          <p className={s.hint}>{t('patients.fb.hint')}</p>
        </div>
        {canWrite && (
          <button type="button" className={s.primary} onClick={() => setRecording(true)}>
            {t('patients.fb.record')}
          </button>
        )}
      </header>

      {summary && (
        <section className={styles.summary} aria-label={t('patients.fb.summary')}>
          <div className={styles.average}>
            <span className={styles.averageValue}>{summary.average !== null
                ? fmt.number(summary.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : '–'}</span>
            <span className={styles.averageStars} aria-hidden="true">
              {stars(Math.round(summary.average ?? 0))}
            </span>
            <span className={s.muted}>
              {t('patients.fbRatings', { count: summary.count })}
            </span>
          </div>
          <ul className={styles.distribution}>
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.distribution[star - 1] ?? 0;
              return (
                <li key={star}>
                  <span className={styles.distLabel}>{t('patients.fb.stars', { n: star })}</span>
                  <span className={styles.distTrack}>
                    <span className={styles.distBar} style={{ width: `${(n / peak) * 100}%` }} />
                  </span>
                  <span className={styles.distCount}>{fmt.number(n)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className={s.filters} role="tablist" aria-label={t('patients.fb.filterLabel')}>
        {FILTERS.map((f) => (
          <button
            key={String(f)}
            type="button"
            role="tab"
            aria-selected={filter === f}
            data-active={filter === f || undefined}
            onClick={() => setFilter(f)}
          >
            {typeof f === 'number' ? t('patients.fb.stars', { n: f }) : t(`patients.fb.filter.${f}`)}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <Failed message={error} />
      ) : data && data.items.length === 0 ? (
        <p className={styles.empty}>
          {filter === 'all' ? t('patients.fb.empty') : t('patients.fb.noMatch')}
        </p>
      ) : (
        <ul className={styles.list}>
          {data?.items.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              practiceId={practiceId}
              canReply={canWrite}
              onReplied={() => void reload()}
            />
          ))}
        </ul>
      )}

      {recording && (
        <RecordFeedbackDialog
          practiceId={practiceId}
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
