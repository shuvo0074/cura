import { useState } from 'react';
import { useServices } from '../../../app/services';
import { useT, type UseT } from '../../../i18n';
import { Failed, Loading, Panel, uiStyles as s, useResource } from '../../../ui';
import { imageSrc } from './admin-kit';
import v from './VerificationsPanel.module.css';

const BASE = '/directory/admin/verifications';

type Status = 'pending' | 'approved' | 'rejected';
const STATUSES: readonly Status[] = ['pending', 'approved', 'rejected'];

/** What the doctor typed when they asked to be verified. */
interface RequestDetails {
  name?: string;
  degrees?: string[];
  specialty?: string;
  designation?: string;
  workplace?: string;
}

/** A doctor's verification request as the admin API returns it. */
interface VerificationRequest {
  id: string;
  /** 'claim' for an existing listing, otherwise a new doctor. */
  kind: string;
  status: Status;
  bmdc_no: string;
  details: RequestDetails | null;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  email: string | null;
  phone: string | null;
  account_name: string | null;
  doctor_id: string | null;
  listing_name: string | null;
  listing_specialty: string | null;
  listing_photo: string | null;
  listing_bmdc_no: string | null;
  listing_hospital: string | null;
  reviewed_by_name: string | null;
}

const when = (fmt: UseT['fmt'], stamp: string | null): string => (stamp ? fmt.dateTime(stamp) : '');

/** Doctors asking for the "BMDC verified" badge, either on a new profile or on a listing they claim. */
export function VerificationsPanel() {
  const { t } = useT();
  const [status, setStatus] = useState<Status>('pending');
  const { data, error, loading, reload } = useResource<VerificationRequest[]>(BASE, { status });

  const requests = data ?? [];
  return (
    <Panel
      title={t('admin.verifications.title')}
      description={t('admin.verifications.description')}
    >
      <div className={s.filters}>
        {STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            data-active={status === option || undefined}
            onClick={() => setStatus(option)}
          >
            {t(`admin.verifications.status.${option}`)}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Failed message={error} />
      ) : requests.length === 0 ? (
        <p className={s.muted}>{t(`admin.verifications.empty.${status}`)}</p>
      ) : (
        <div className={v.grid}>
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onDone={() => void reload()} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/** One request: who signed up, the BMDC number to check and, for a claim, the listing they say is theirs. */
function RequestCard({ request, onDone }: { request: VerificationRequest; onDone: () => void }) {
  const { t, tm, fmt } = useT();
  const { http } = useServices();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const details = request.details ?? {};
  const isClaim = request.kind === 'claim';
  const bmdcMismatch =
    isClaim && request.listing_bmdc_no && request.listing_bmdc_no.toUpperCase() !== request.bmdc_no;
  const listingPhoto = imageSrc(request.listing_photo);
  const subtitle = [details.specialty, details.designation, details.workplace].filter(Boolean).join(' · ');

  const act = async (action: 'approve' | 'reject', body?: { note: string }) => {
    setBusy(true);
    setError(null);
    const result = await http.request(`${BASE}/${request.id}/${action}`, {
      method: 'POST',
      ...(body ? { body } : {}),
      retry: false,
    });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error.message);
    }
    onDone();
  };

  return (
    <article className={v.card}>
      <div className={v.head}>
        <div>
          <p className={v.name}>{details.name || request.account_name}</p>
          {details.degrees && details.degrees.length > 0 && <p className={v.meta}>{details.degrees.join(', ')}</p>}
          {subtitle && <p className={v.meta}>{subtitle}</p>}
        </div>
        <span className={v.kind} data-claim={isClaim || undefined}>
          {isClaim ? t('admin.verifications.claim') : t('admin.verifications.newDoctor')}
        </span>
      </div>

      <div className={v.bmdc}>
        <span className={v.meta}>BMDC</span>
        <strong>{request.bmdc_no}</strong>
      </div>

      <div className={v.contact}>
        {request.email && <span>{request.email}</span>}
        {request.phone && <a href={`tel:${request.phone}`}>{request.phone}</a>}
        <span className={v.meta}>{t('admin.verifications.submitted', { when: when(fmt, request.submitted_at) })}</span>
      </div>

      {isClaim && request.doctor_id && (
        <div className={v.listing}>
          {listingPhoto ? (
            <img className={v.photo} src={listingPhoto} alt="" />
          ) : (
            <span className={v.photo} aria-hidden="true" />
          )}
          <div>
            <p className={v.meta}>{t('admin.verifications.existingListing')}</p>
            <p>{request.listing_name}</p>
            <p className={v.meta}>
              {[request.listing_specialty, request.listing_hospital].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}
      {bmdcMismatch && (
        <p className={s.error}>{t('admin.verifications.bmdcMismatch', { bmdc: request.listing_bmdc_no ?? '' })}</p>
      )}

      {request.status === 'pending' ? (
        rejecting ? (
          <>
            <textarea
              className={s.textarea}
              rows={2}
              autoFocus
              aria-label={t('admin.verifications.reasonLabel')}
              placeholder={t('admin.verifications.reasonPlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className={v.buttons}>
              <button type="button" className={s.secondary} disabled={busy} onClick={() => setRejecting(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={v.danger}
                disabled={busy || note.trim().length < 5}
                onClick={() => void act('reject', { note })}
              >
                {t('admin.verifications.reject')}
              </button>
            </div>
          </>
        ) : (
          <div className={v.buttons}>
            <button type="button" className={s.secondary} disabled={busy} onClick={() => setRejecting(true)}>
              {t('admin.verifications.reject')}
            </button>
            <button type="button" className={s.primary} disabled={busy} onClick={() => void act('approve')}>
              {busy ? t('admin.verifications.approving') : t('admin.verifications.approve')}
            </button>
          </div>
        )
      ) : (
        <p className={v.meta}>
          {request.reviewed_by_name
            ? t(`admin.verifications.reviewedBy.${request.status === 'approved' ? 'approved' : 'rejected'}`, {
                when: when(fmt, request.reviewed_at),
                name: request.reviewed_by_name,
              })
            : t(`admin.verifications.reviewed.${request.status === 'approved' ? 'approved' : 'rejected'}`, {
                when: when(fmt, request.reviewed_at),
              })}
          {request.review_note && <span className={v.note}>“{request.review_note}”</span>}
        </p>
      )}
      {error && (
        <p className={s.error} role="alert">
          {tm(error)}
        </p>
      )}
    </article>
  );
}
