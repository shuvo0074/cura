import { memo, useState } from 'react';
import { uiStyles as s, useMutation } from '../../ui';
import { stars, type FeedbackItem } from './feedback-shared';
import styles from './feedback.module.css';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

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
        <span className={styles.cardStars} aria-label={`${item.rating} out of 5`}>
          {stars(item.rating)}
        </span>
        <span className={styles.cardWho}>
          {item.patient.fullName} <span className={s.muted}>· {item.patient.curaId}</span>
        </span>
        <span className={s.muted}>{when(item.createdAt)}</span>
      </header>

      {item.comment ? <p className={styles.comment}>{item.comment}</p> : <p className={s.muted}>No comment left.</p>}

      {item.reply ? (
        <blockquote className={styles.reply}>
          <strong>Your reply</strong>
          {item.repliedAt && <span className={s.muted}> · {when(item.repliedAt)}</span>}
          <p>{item.reply}</p>
        </blockquote>
      ) : canReply && draft === null ? (
        <button type="button" className={s.linkButton} onClick={() => setDraft('')}>
          Reply
        </button>
      ) : canReply ? (
        <div className={styles.replyBox}>
          <textarea
            className={s.textarea}
            rows={3}
            value={draft ?? ''}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`Reply to ${item.patient.fullName}`}
            autoFocus
          />
          <div className={styles.replyActions}>
            {mutate.error && (
              <span className={s.error} role="alert">
                {mutate.error}
              </span>
            )}
            <button type="button" className={s.secondary} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={s.primary}
              onClick={() => void send()}
              disabled={mutate.busy || !draft?.trim()}
            >
              {mutate.busy ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
});
