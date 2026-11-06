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
import { useT } from '../../../i18n';

export function PremiumPanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<{ plan: string; status: string; expiresAt: string | null }>(
    '/settings/subscription',
    { practiceId },
  );
  const { t, fmt } = useT();
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
    <Panel title={t('settings.nav.premium')} description={t('settings.premium.description')}>
      <div className={s.planRow}>
        <div className={s.plan} data-current={!premium || undefined}>
          <h3>{t('settings.premium.free')}</h3>
          <p>{t('settings.premium.freeBody')}</p>
          {!premium && <span className={s.badge}>{t('settings.premium.currentPlan')}</span>}
        </div>
        <div className={s.plan} data-current={premium || undefined}>
          <h3>{t('settings.nav.premium')}</h3>
          <p>{t('settings.premium.premiumBody')}</p>
          {premium && (
            <span className={s.badge}>
              {data?.expiresAt
                ? t('settings.premium.currentPlanRenews', { date: fmt.date(data.expiresAt) })
                : t('settings.premium.currentPlan')}
            </span>
          )}
        </div>
      </div>

      {mutate.error && <Failed message={mutate.error} />}

      <Row cols={2}>
        <Field label={t('settings.premium.term')}>
          <select className={s.input} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {t('settings.premium.months', { count: n })}
              </option>
            ))}
          </select>
        </Field>
      </Row>

      <div className={s.saveBar}>
        {premium ? (
          <button type="button" className={s.secondary} onClick={() => void change('FREE')} disabled={mutate.busy}>
            {t('settings.premium.downgrade')}
          </button>
        ) : (
          <button type="button" className={s.primary} onClick={() => void change('PREMIUM')} disabled={mutate.busy}>
            {mutate.busy ? t('settings.premium.working') : t('settings.premium.upgrade')}
          </button>
        )}
      </div>
    </Panel>
  );
}
