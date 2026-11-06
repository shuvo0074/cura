import { memo, useState } from 'react';
import { uiStyles as s, useMutation } from '../../ui';
import { useT } from '../../i18n';
import { stars, type FeedbackItem } from './feedback-shared';
import styles from './feedback.module.css';

/** One rating with its reply, or an inline reply box when there is none. */
export const FeedbackCard = memo(function FeedbackCard({
  item,
  practiceId,
  canReply,
  onReplied,
}: {
  item: FeedbackItem;
  practiceId: string;
  canReply: boolean;
  onReplied: () => void;
}) {
  const { t, tm, fmt } = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const mutate = useMutation();

  const send = async () => {
    const ok = await mutate.run(`/engagement/feedback/${item.id}/reply`, {
      method: 'PUT',
      body: { practiceId, reply: draft ?? '' },
    });
    if (ok) {
      setDraft(null);
      onReplied();
    }
  };

  return (
    <li className={styles.card} data-low={item.rating <= 2 || undefined}>
      <header className={styles.cardHead}>
        <span className={styles.cardStars} aria-label={t('patients.fb.outOf5', { n: item.rating })}>
          {stars(item.rating)}
        </span>
        <span className={styles.cardWho}>
          {item.patient.fullName} <span className={s.muted}>· {item.patient.curaId}</span>
        </span>
        <span className={s.muted}>{fmt.date(item.createdAt)}</span>
      </header>

      {item.comment ? <p className={styles.comment}>{item.comment}</p> : <p className={s.muted}>{t('patients.fb.noComment')}</p>}

      {item.reply ? (
        <blockquote className={styles.reply}>
          <strong>{t('patients.fb.yourReply')}</strong>
          {item.repliedAt && <span className={s.muted}> · {fmt.date(item.repliedAt)}</span>}
          <p>{item.reply}</p>
        </blockquote>
      ) : canReply && draft === null ? (
        <button type="button" className={s.linkButton} onClick={() => setDraft('')}>
          {t('patients.fb.reply')}
        </button>
      ) : canReply ? (
        <div className={styles.replyBox}>
          <textarea
            className={s.textarea}
            rows={3}
            value={draft ?? ''}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t('patients.fb.replyTo', { name: item.patient.fullName })}
            autoFocus
          />
          <div className={styles.replyActions}>
            {mutate.error && (
              <span className={s.error} role="alert">
                {tm(mutate.error)}
              </span>
            )}
            <button type="button" className={s.secondary} onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={s.primary}
              onClick={() => void send()}
              disabled={mutate.busy || !draft?.trim()}
            >
              {mutate.busy ? t('patients.fb.sending') : t('patients.fb.sendReply')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
});
