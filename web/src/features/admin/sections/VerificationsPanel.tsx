import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Failed, Loading, Panel, uiStyles as s, useResource } from '../../../ui';
import { imageSrc } from './admin-kit';
import v from './VerificationsPanel.module.css';

const BASE = '/directory/admin/verifications';

type Status = 'pending' | 'approved' | 'rejected';
const STATUSES: { key: Status; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

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

const when = (stamp: string | null): string =>
  stamp ? new Date(stamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Doctors asking for the "BMDC verified" badge, either on a new profile or on a listing they claim. */
export function VerificationsPanel() {
  const [status, setStatus] = useState<Status>('pending');
  const { data, error, loading, reload } = useResource<VerificationRequest[]>(BASE, { status });

  const requests = data ?? [];
  return (
    <Panel
      title="Doctor verifications"
      description="Check each BMDC number against the doctor's name before approving. Approving shows the BMDC verified badge on Cura Website and gives the account access to that listing's appointments."
    >
      <div className={s.filters}>
        {STATUSES.map((option) => (
          <button
            key={option.key}
            type="button"
            data-active={status === option.key || undefined}
            onClick={() => setStatus(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Failed message={error} />
      ) : requests.length === 0 ? (
        <p className={s.muted}>No {status} requests.</p>
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
          {isClaim ? 'Claims listing' : 'New doctor'}
        </span>
      </div>

      <div className={v.bmdc}>
        <span className={v.meta}>BMDC</span>
        <strong>{request.bmdc_no}</strong>
      </div>

      <div className={v.contact}>
        {request.email && <span>{request.email}</span>}
        {request.phone && <a href={`tel:${request.phone}`}>{request.phone}</a>}
        <span className={v.meta}>Submitted {when(request.submitted_at)}</span>
      </div>

      {isClaim && request.doctor_id && (
        <div className={v.listing}>
          {listingPhoto ? (
            <img className={v.photo} src={listingPhoto} alt="" />
          ) : (
            <span className={v.photo} aria-hidden="true" />
          )}
          <div>
            <p className={v.meta}>Existing listing</p>
            <p>{request.listing_name}</p>
            <p className={v.meta}>
              {[request.listing_specialty, request.listing_hospital].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}
      {bmdcMismatch && (
        <p className={s.error}>Listing has BMDC {request.listing_bmdc_no}. Approving replaces it.</p>
      )}

      {request.status === 'pending' ? (
        rejecting ? (
          <>
            <textarea
              className={s.textarea}
              rows={2}
              autoFocus
              aria-label="Reason for rejecting"
              placeholder="Reason shown to the doctor, e.g. BMDC number does not match the name"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className={v.buttons}>
              <button type="button" className={s.secondary} disabled={busy} onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={v.danger}
                disabled={busy || note.trim().length < 5}
                onClick={() => void act('reject', { note })}
              >
                Reject
              </button>
            </div>
          </>
        ) : (
          <div className={v.buttons}>
            <button type="button" className={s.secondary} disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
            <button type="button" className={s.primary} disabled={busy} onClick={() => void act('approve')}>
              {busy ? 'Approving…' : 'Approve'}
            </button>
          </div>
        )
      ) : (
        <p className={v.meta}>
          {request.status === 'approved' ? 'Approved' : 'Rejected'} {when(request.reviewed_at)}
          {request.reviewed_by_name && ` by ${request.reviewed_by_name}`}
          {request.review_note && <span className={v.note}>“{request.review_note}”</span>}
        </p>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
