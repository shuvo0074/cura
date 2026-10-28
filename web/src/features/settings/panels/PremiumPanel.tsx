import { useState } from 'react';
import {
  Failed,
  Field,
  Loading,
  Panel,
  Row,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

export function PremiumPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<{ plan: string; status: string; expiresAt: string | null }>(
    '/settings/subscription',
    { practiceId },
  );
  const mutate = useMutation();
  const [months, setMonths] = useState(12);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const premium = data?.plan === 'PREMIUM';

  const change = async (plan: 'FREE' | 'PREMIUM') => {
    await mutate.run('/settings/subscription', { method: 'PUT', body: { practiceId, plan, months } });
    await reload();
  };

  return (
    <Panel title="Premium" description="Subscription plan for this practice.">
      <div className={s.planRow}>
        <div className={s.plan} data-current={!premium || undefined}>
          <h3>Free</h3>
          <p>Calendar, patients, prescriptions, invoicing and the full settings suite.</p>
          {!premium && <span className={s.badge}>Current plan</span>}
        </div>
        <div className={s.plan} data-current={premium || undefined}>
          <h3>Premium</h3>
          <p>Adds consent forms, charting templates, custom printout pads and priority support.</p>
          {premium && (
            <span className={s.badge}>
              Current plan
              {data?.expiresAt && ` · renews ${new Date(data.expiresAt).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>

      {mutate.error && <Failed message={mutate.error} />}

      <Row cols={2}>
        <Field label="Term">
          <select className={s.input} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={1}>1 month</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </Field>
      </Row>

      <div className={s.saveBar}>
        {premium ? (
          <button type="button" className={s.secondary} onClick={() => void change('FREE')} disabled={mutate.busy}>
            Downgrade to Free
          </button>
        ) : (
          <button type="button" className={s.primary} onClick={() => void change('PREMIUM')} disabled={mutate.busy}>
            {mutate.busy ? 'Working…' : 'Upgrade to Premium'}
          </button>
        )}
      </div>
    </Panel>
  );
}
