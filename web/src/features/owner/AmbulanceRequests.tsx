import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { Failed, Field, Loading, Modal, Panel, uiStyles as s, useMutation, useResource } from '../../ui';
import type { AmbulanceRequest, AmbulanceRequestStatus, AmbulanceVendor } from './owner-shared';

type Filter = 'open' | 'all';
const OPEN: AmbulanceRequestStatus[] = ['new', 'accepted'];
/** Patients may be waiting, so the list refreshes itself this often. */
const REFRESH_MS = 30_000;

/** "+8801712345678" → "01712345678", the way people read a number here. */
const nationalPhone = (phone: string) => phone.replace(/^\+?88(?=01)/, '');

/** Requests patients sent to this owner's ambulance services, and the buttons that answer them. */
export function AmbulanceRequests({ vendors }: { vendors: AmbulanceVendor[] }) {
  const { data, error, loading, reload } = useResource<AmbulanceRequest[]>('/directory/my-ambulances/requests', {});
  const [filter, setFilter] = useState<Filter>('open');
  const [vendorId, setVendorId] = useState<string>('all');
  const [answering, setAnswering] = useState<{
    request: AmbulanceRequest;
    status: 'accepted' | 'declined';
  } | null>(null);
  const move = useMutation();
  const { t, tm, fmt } = useT();

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const requests = (data ?? []).filter(
    (request) =>
      (filter === 'all' || OPEN.includes(request.status)) && (vendorId === 'all' || request.ambulance.id === vendorId),
  );

  const setStatus = async (
    request: AmbulanceRequest,
    status: 'accepted' | 'completed' | 'declined',
    message?: string,
  ) => {
    const ok = await move.run(`/directory/my-ambulances/${request.ambulance.id}/requests/${request.id}`, {
      method: 'PATCH',
      body: { status, ...(message ? { message } : {}) },
    });
    // Reload either way: a 409 means the patient cancelled (or someone else moved it) first.
    await reload();
    return ok;
  };

  return (
    <Panel
      title={t('owner.requests.title')}
      description={t('owner.requests.description')}
      action={
        <button type="button" className={s.secondary} onClick={() => void reload()} disabled={loading}>
          {t('owner.requests.refresh')}
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label={t('owner.requests.filter')}>
        {(['open', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            data-active={filter === f || undefined}
            onClick={() => setFilter(f)}
          >
            {f === 'open' ? t('owner.requests.open') : t('owner.requests.all')}
          </button>
        ))}
      </div>
      {vendors.length > 1 && (
        <div className={s.filters} role="tablist" aria-label={t('owner.requests.chooseAmbulance')}>
          {[{ id: 'all', name: t('owner.requests.allAmbulances') }, ...vendors].map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              role="tab"
              aria-selected={vendorId === vendor.id}
              data-active={vendorId === vendor.id || undefined}
              onClick={() => setVendorId(vendor.id)}
            >
              {vendor.name}
            </button>
          ))}
        </div>
      )}
      {move.error && (
        <p className={s.error} role="alert">
          {tm(move.error)}
        </p>
      )}

      {requests.length === 0 ? (
        <p className={s.muted}>{filter === 'open' ? t('owner.requests.empty') : t('owner.requests.emptyAll')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('owner.requests.col.received')}</th>
              <th>{t('owner.requests.col.patient')}</th>
              <th>{t('owner.requests.col.trip')}</th>
              <th>{t('owner.requests.col.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} data-testid="ambulance-request">
                <td>
                  <span className={s.staffName}>{fmt.dateTime(request.created_at)}</span>
                  {vendors.length > 1 && <span className={s.staffMeta}>{request.ambulance.name}</span>}
                </td>
                <td>
                  <span className={s.staffName}>{request.patient_name}</span>
                  <a className={s.staffMeta} href={`tel:${request.contact_phone}`}>
                    {nationalPhone(request.contact_phone)}
                  </a>
                </td>
                <td>
                  <span className={s.staffName}>
                    {request.pickup_at
                      ? t('owner.requests.pickupAt', {
                          when: fmt.dateTime(request.pickup_at),
                        })
                      : t('owner.requests.pickupNow')}
                  </span>
                  <span className={s.staffMeta}>
                    {t('owner.requests.from', {
                      place: request.pickup_address,
                    })}
                  </span>
                  {request.destination && (
                    <span className={s.staffMeta}>{t('owner.requests.to', { place: request.destination })}</span>
                  )}
                  {request.note && (
                    <span className={s.staffMeta}>{t('owner.requests.note', { note: request.note })}</span>
                  )}
                </td>
                <td>
                  {t(`owner.requests.status.${request.status}`)}
                  {request.owner_message && (
                    <span className={s.staffMeta}>
                      {t('owner.requests.message', {
                        message: request.owner_message,
                      })}
                    </span>
                  )}
                </td>
                <td>
                  <div className={s.actions}>
                    {request.status === 'new' && (
                      <button
                        type="button"
                        className={s.linkButton}
                        disabled={move.busy}
                        onClick={() => setAnswering({ request, status: 'accepted' })}
                      >
                        {t('owner.requests.accept')}
                      </button>
                    )}
                    {request.status === 'accepted' && (
                      <button
                        type="button"
                        className={s.linkButton}
                        disabled={move.busy}
                        onClick={() => void setStatus(request, 'completed')}
                      >
                        {t('owner.requests.complete')}
                      </button>
                    )}
                    {OPEN.includes(request.status) && (
                      <button
                        type="button"
                        className={s.linkDanger}
                        disabled={move.busy}
                        onClick={() => setAnswering({ request, status: 'declined' })}
                      >
                        {t('owner.requests.decline')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {answering && (
        <AnswerModal
          status={answering.status}
          busy={move.busy}
          onClose={() => setAnswering(null)}
          onConfirm={async (message) => {
            await setStatus(answering.request, answering.status, message);
            setAnswering(null);
          }}
        />
      )}
    </Panel>
  );
}

/** Accept with an optional arrival message, or decline with an optional reason. */
function AnswerModal({
  status,
  busy,
  onClose,
  onConfirm,
}: {
  status: 'accepted' | 'declined';
  busy: boolean;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const { t } = useT();
  const accepting = status === 'accepted';
  return (
    <Modal
      title={accepting ? t('owner.requests.acceptTitle') : t('owner.requests.declineTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void onConfirm(message.trim())}>
            {accepting ? t('owner.requests.accept') : t('owner.requests.decline')}
          </button>
        </>
      }
    >
      <Field
        label={accepting ? t('owner.requests.messageLabel') : t('owner.requests.reasonLabel')}
        hint={accepting ? t('owner.requests.messageHint') : t('owner.requests.reasonHint')}
      >
        <textarea
          className={`${s.input} ${s.textarea}`}
          rows={3}
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
