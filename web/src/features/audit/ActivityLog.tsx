import { Fragment, useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { useT, type UseT } from '../../i18n';
import { Failed, Field, Loading, Panel, Row, uiStyles as s, useResource } from '../../ui';
import { actionLabel, actorRoleLabel, subjectLabel, toCsv, type AuditItem } from './audit-labels';
import styles from './ActivityLog.module.css';

interface Filters {
  from: string;
  to: string;
  action: string;
  actor: string;
  q: string;
  clinicId: string;
}

const EMPTY: Filters = { from: '', to: '', action: '', actor: '', q: '', clinicId: '' };
const PAGE_SIZE = 50;

/** Filters as Cura API reads them. Dates are whole local days. */
function toQuery(filters: Filters, scope: Record<string, string>): Record<string, string> {
  const query: Record<string, string> = { ...scope };
  if (filters.from) query.from = new Date(`${filters.from}T00:00:00`).toISOString();
  if (filters.to) query.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
  if (filters.action) query.action = filters.action;
  if (filters.actor.trim()) query.actor = filters.actor.trim();
  if (filters.q.trim()) query.q = filters.q.trim();
  if (filters.clinicId) query.clinicId = filters.clinicId;
  return query;
}

/**
 * The activity log, shared by Super Admin (every row) and a clinic owner's
 * Settings (one clinic). Cura API decides which rows the caller may see and
 * strips secrets from the details; this screen only shows them.
 */
export function ActivityLog({
  path,
  scope = {},
  title,
  description,
  allClinics = false,
}: {
  /** `/directory/admin/audit-log` or `/audit-log`. */
  path: string;
  /** Extra query every call carries, e.g. `{ practiceId }`. */
  scope?: Record<string, string>;
  title: string;
  description: string;
  /** Super admin: a clinic column and a clinic filter. */
  allClinics?: boolean;
}) {
  const { t, fmt, locale } = useT();
  const { http } = useServices();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const scopeKey = JSON.stringify(scope);
  const actions = useResource<string[]>(`${path}/actions`, scope);
  const clinics = useClinics(allClinics);

  const load = useCallback(
    async (filters: Filters, cursor: string | null, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      const query: Record<string, string> = { ...toQuery(filters, JSON.parse(scopeKey) as Record<string, string>), limit: String(PAGE_SIZE) };
      if (cursor) query.cursor = cursor;
      const result = await http.request<{ items: AuditItem[]; nextCursor: string | null }>(path, {
        query,
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setItems((current) => (cursor ? [...current, ...result.value.items] : result.value.items));
      setNextCursor(result.value.nextCursor);
    },
    [http, path, scopeKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(applied, null, controller.signal);
    return () => controller.abort();
  }, [load, applied]);

  const apply = (filters: Filters) => {
    setOpen(null);
    setExportNote(null);
    setApplied(filters);
  };

  const download = async () => {
    setExporting(true);
    setExportNote(null);
    const result = await http.request<{ items: AuditItem[]; truncated: boolean }>(`${path}/export`, {
      query: toQuery(applied, JSON.parse(scopeKey) as Record<string, string>),
    });
    setExporting(false);
    if (!result.ok) {
      setExportNote(result.error.message);
      return;
    }
    const csv = toCsv(result.value.items, t, allClinics);
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cura-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (result.value.truncated) setExportNote(t('settings.activity.exportTruncated', { count: result.value.items.length }));
  };

  const columns = allClinics ? 6 : 5;

  return (
    <Panel
      title={title}
      description={description}
      action={
        <button type="button" className={s.secondary} disabled={exporting} onClick={() => void download()}>
          {exporting ? t('settings.activity.exporting') : t('settings.activity.export')}
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <Row cols={3}>
          <Field label={t('settings.activity.from')}>
            <input className={s.input} type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </Field>
          <Field label={t('settings.activity.to')}>
            <input className={s.input} type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </Field>
          <Field label={t('settings.activity.action')}>
            <select className={s.input} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
              <option value="">{t('settings.activity.anyAction')}</option>
              {sortedActions(actions.data ?? [], t, locale).map((code) => (
                <option key={code} value={code}>
                  {actionLabel(t, code)}
                </option>
              ))}
            </select>
          </Field>
        </Row>
        <Row cols={3}>
          <Field label={t('settings.activity.person')}>
            <input
              className={s.input}
              value={draft.actor}
              placeholder={t('settings.activity.personHint')}
              onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
            />
          </Field>
          <Field label={t('settings.activity.search')}>
            <input
              className={s.input}
              value={draft.q}
              placeholder={t('settings.activity.searchHint')}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            />
          </Field>
          {allClinics && (
            <Field label={t('settings.activity.clinic')}>
              <select className={s.input} value={draft.clinicId} onChange={(e) => setDraft({ ...draft, clinicId: e.target.value })}>
                <option value="">{t('settings.activity.anyClinic')}</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Row>
        <div className={styles.filterActions}>
          <button type="submit" className={s.primary}>
            {t('settings.activity.apply')}
          </button>
          <button
            type="button"
            className={s.linkButton}
            onClick={() => {
              setDraft(EMPTY);
              apply(EMPTY);
            }}
          >
            {t('settings.activity.clear')}
          </button>
        </div>
      </form>

      {exportNote && <p className={s.muted}>{exportNote}</p>}

      {error ? (
        <Failed message={error} />
      ) : loading && items.length === 0 ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className={s.muted}>{t('settings.activity.empty')}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('settings.activity.col.time')}</th>
                  <th>{t('settings.activity.col.who')}</th>
                  <th>{t('settings.activity.col.action')}</th>
                  <th>{t('settings.activity.col.about')}</th>
                  {allClinics && <th>{t('settings.activity.col.clinic')}</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td className={styles.time}>{fmt.dateTime(item.at)}</td>
                      <td>
                        {item.actor ? (
                          <>
                            <span className={s.staffName}>{item.actor.fullName}</span>
                            <span className={s.staffMeta}>
                              {[item.actor.email, actorRoleLabel(t, item.actor)].filter(Boolean).join(' · ')}
                            </span>
                          </>
                        ) : (
                          <span className={s.mutedCell}>{t('settings.activity.noActor')}</span>
                        )}
                      </td>
                      <td>{actionLabel(t, item.action)}</td>
                      <td>{subjectLabel(t, item)}</td>
                      {allClinics && <td>{item.clinic ? (item.clinic.name ?? item.clinic.id.slice(0, 8)) : '—'}</td>}
                      <td>
                        <button
                          type="button"
                          className={s.linkButton}
                          aria-expanded={open === item.id}
                          onClick={() => setOpen(open === item.id ? null : item.id)}
                        >
                          {open === item.id ? t('settings.activity.hideDetails') : t('settings.activity.showDetails')}
                        </button>
                      </td>
                    </tr>
                    {open === item.id && (
                      <tr>
                        <td colSpan={columns} className={styles.detailsCell}>
                          <Details item={item} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.muted}>
            {t('settings.activity.shown', { count: items.length })}{' '}
            {nextCursor && (
              <button type="button" className={s.linkButton} disabled={loading} onClick={() => void load(applied, nextCursor)}>
                {loading ? t('settings.activity.loading') : t('settings.activity.loadMore')}
              </button>
            )}
          </p>
        </>
      )}
    </Panel>
  );
}

/** Stored details of one row. Cura API has already removed passwords, codes and tokens. */
function Details({ item }: { item: AuditItem }) {
  const { t } = useT();
  const hasDetails = item.details !== null && !(typeof item.details === 'object' && Object.keys(item.details as object).length === 0);
  return (
    <dl className={styles.details}>
      <dt>{t('settings.activity.code')}</dt>
      <dd>
        <code>{item.action}</code>
      </dd>
      {item.subject.id && (
        <>
          <dt>{t('settings.activity.subjectId')}</dt>
          <dd>
            <code>
              {item.subject.type} {item.subject.id}
            </code>
          </dd>
        </>
      )}
      {item.network && (
        <>
          <dt>{t('settings.activity.network')}</dt>
          <dd>
            <code>{item.network}</code>
          </dd>
        </>
      )}
      {item.userAgent && (
        <>
          <dt>{t('settings.activity.device')}</dt>
          <dd>{item.userAgent}</dd>
        </>
      )}
      {item.requestId && (
        <>
          <dt>{t('settings.activity.requestId')}</dt>
          <dd>
            <code>{item.requestId}</code>
          </dd>
        </>
      )}
      <dt>{t('settings.activity.details')}</dt>
      <dd>{hasDetails ? <pre className={styles.json}>{JSON.stringify(item.details, null, 2)}</pre> : t('settings.activity.noDetails')}</dd>
    </dl>
  );
}

/** Every clinic, for the super admin's clinic filter. */
function useClinics(enabled: boolean): { id: string; name: string }[] {
  const { http } = useServices();
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void http.request<{ id: string; name: string }[]>('/directory/admin/clinics', {}).then((result) => {
      if (live && result.ok) setClinics([...result.value].sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => {
      live = false;
    };
  }, [enabled, http]);
  return clinics;
}

function sortedActions(codes: string[], t: UseT['t'], locale: string): string[] {
  return [...codes].sort((a, b) => actionLabel(t, a).localeCompare(actionLabel(t, b), locale));
}
