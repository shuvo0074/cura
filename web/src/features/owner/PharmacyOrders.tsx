import { useState } from 'react';
import { useT, type UseT } from '../../i18n';
import { Failed, Field, Loading, Modal, Panel, uiStyles as s, useMutation, useResource } from '../../ui';
import type { PharmacyOrder, PharmacyOrderStatus, PrescribedMedicine } from './owner-shared';

type Filter = 'open' | 'all';
const OPEN: PharmacyOrderStatus[] = ['new', 'ready'];

const dose = (n: number) => (n === 0.5 ? '½' : n === 0.25 ? '¼' : String(n));

/** "Tab Napa 500 mg · 1+0+1 · after meals · 5 days". */
function medicineLine(t: UseT['t'], item: PrescribedMedicine): string {
  return [
    [item.form, item.drug_name, item.strength].filter(Boolean).join(' '),
    `${dose(item.morning)}+${dose(item.noon)}+${dose(item.night)}`,
    item.meal_relation === 'before'
      ? t('owner.orders.beforeMeal')
      : item.meal_relation === 'after'
        ? t('owner.orders.afterMeal')
        : null,
    item.duration_days ? t('owner.orders.days', { count: item.duration_days }) : null,
    item.instruction,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Prescriptions patients sent to one pharmacy, and the buttons that move them along. */
export function PharmacyOrders({ pharmacyId }: { pharmacyId: string }) {
  const { data, error, loading, reload } = useResource<PharmacyOrder[]>(
    `/directory/my-pharmacies/${pharmacyId}/orders`,
    {},
  );
  const [filter, setFilter] = useState<Filter>('open');
  const [refusing, setRefusing] = useState<PharmacyOrder | null>(null);
  const move = useMutation();
  const { t, tm, fmt } = useT();

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const orders = (data ?? []).filter((order) => filter === 'all' || OPEN.includes(order.status));

  const setStatus = async (order: PharmacyOrder, status: 'ready' | 'collected' | 'cannot_fill', reason?: string) => {
    const ok = await move.run(`/directory/my-pharmacies/${pharmacyId}/orders/${order.id}`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    });
    // Reload either way: a 409 means someone else (or the patient) moved it first.
    await reload();
    return ok;
  };

  return (
    <Panel
      title={t('owner.orders.title')}
      description={t('owner.orders.description')}
      action={
        <button type="button" className={s.secondary} onClick={() => void reload()} disabled={loading}>
          {t('owner.orders.refresh')}
        </button>
      }
    >
      <div className={s.filters} role="tablist" aria-label={t('owner.orders.filter')}>
        {(['open', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            data-active={filter === f || undefined}
            onClick={() => setFilter(f)}
          >
            {f === 'open' ? t('owner.orders.open') : t('owner.orders.all')}
          </button>
        ))}
      </div>
      {move.error && (
        <p className={s.error} role="alert">
          {tm(move.error)}
        </p>
      )}

      {orders.length === 0 ? (
        <p className={s.muted}>{filter === 'open' ? t('owner.orders.empty') : t('owner.orders.emptyAll')}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('owner.orders.col.received')}</th>
              <th>{t('owner.orders.col.patient')}</th>
              <th>{t('owner.orders.col.medicines')}</th>
              <th>{t('owner.orders.col.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} data-testid="pharmacy-order">
                <td>{fmt.dateTime(order.created_at)}</td>
                <td>
                  <span className={s.staffName}>{order.patient_name}</span>
                  {order.patient_phone && (
                    <a className={s.staffMeta} href={`tel:${order.patient_phone}`}>
                      {order.patient_phone}
                    </a>
                  )}
                </td>
                <td>
                  {order.items.map((item, i) => (
                    <span key={`${item.drug_name}-${i}`} className={s.staffName}>
                      {medicineLine(t, item)}
                    </span>
                  ))}
                  <span className={s.staffMeta}>
                    {t('owner.orders.prescribedBy', {
                      doctor: order.doctor_name,
                      date: fmt.date(order.prescribed_at),
                    })}
                  </span>
                  {order.note && <span className={s.staffMeta}>{t('owner.orders.note', { note: order.note })}</span>}
                </td>
                <td>
                  {t(`owner.orders.status.${order.status}`)}
                  {order.reason && (
                    <span className={s.staffMeta}>{t('owner.orders.reason', { reason: order.reason })}</span>
                  )}
                </td>
                <td>
                  <div className={s.actions}>
                    {order.status === 'new' && (
                      <button
                        type="button"
                        className={s.linkButton}
                        disabled={move.busy}
                        onClick={() => void setStatus(order, 'ready')}
                      >
                        {t('owner.orders.markReady')}
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button
                        type="button"
                        className={s.linkButton}
                        disabled={move.busy}
                        onClick={() => void setStatus(order, 'collected')}
                      >
                        {t('owner.orders.markCollected')}
                      </button>
                    )}
                    {OPEN.includes(order.status) && (
                      <button
                        type="button"
                        className={s.linkDanger}
                        disabled={move.busy}
                        onClick={() => setRefusing(order)}
                      >
                        {t('owner.orders.markCannotFill')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {refusing && (
        <CannotFillModal
          busy={move.busy}
          onClose={() => setRefusing(null)}
          onConfirm={async (reason) => {
            await setStatus(refusing, 'cannot_fill', reason);
            setRefusing(null);
          }}
        />
      )}
    </Panel>
  );
}

function CannotFillModal({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const { t } = useT();
  return (
    <Modal
      title={t('owner.orders.cannotFillTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void onConfirm(reason.trim())}>
            {t('owner.orders.markCannotFill')}
          </button>
        </>
      }
    >
      <Field label={t('owner.orders.reasonLabel')} hint={t('owner.orders.reasonHint')}>
        <textarea
          className={`${s.input} ${s.textarea}`}
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
