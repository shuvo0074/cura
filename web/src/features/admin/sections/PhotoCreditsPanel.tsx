import { useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { Failed, Loading, Panel, SaveBar, uiStyles as s, useMutation, useResource } from '../../../ui';
import { ImageUpload, imageSrc } from './admin-kit';
import styles from './PhotoCreditsPanel.module.css';

export const SITE_IMAGES_PATH = '/directory/admin/site-images';

/**
 * An image for site content: upload a file or paste a link. `value` is the
 * image's address (an uploaded /api/directory/media/… path, a /landing/… file
 * or a web address).
 */
export function SiteImageField({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (address: string) => void;
  label: string;
}) {
  const { t } = useT();
  const src = imageSrc(value);
  return (
    <div className={styles.imageField}>
      {src ? <img className={styles.thumb} src={src} alt="" /> : <span className={styles.thumb} aria-hidden="true" />}
      <div className={styles.imageControls}>
        <input
          className={s.input}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('admin.photoCredits.imagePlaceholder')}
          aria-label={t('admin.photoCredits.imageAddress', { label })}
        />
        <ImageUpload path={SITE_IMAGES_PATH} label={t('admin.photoCredits.upload')} onUploaded={onChange} />
      </div>
    </div>
  );
}

type Credit = {
  file: string;
  caption: string;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  source: string | null;
  changes: string | null;
};
type DraftCredit = Credit & { id: number };

const BLANK: Credit = { file: '', caption: '', author: '', license: '', licenseUrl: '', source: '', changes: '' };

/**
 * Attribution for photos on the site (shown on the Photo credits page). CC BY
 * and CC BY-SA photos must be credited; give the author, licence and source.
 */
export function PhotoCreditsPanel() {
  const { t } = useT();
  const { data, error, loading, reload } = useResource<{ credits?: Credit[] }>('/directory/admin/site-content', {});
  const save = useMutation();
  const form = useRef<HTMLFormElement>(null);
  const nextId = useRef(0);
  const [draft, setDraft] = useState<DraftCredit[] | null>(null);
  const [search, setSearch] = useState('');
  const saved = useMemo(
    () => (data?.credits ?? []).map((c): DraftCredit => ({ ...c, id: nextId.current++ })),
    [data],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const credits = draft ?? saved;
  const edit = (change: (list: DraftCredit[]) => DraftCredit[]) => setDraft(change(credits));
  const set = (id: number, patch: Partial<Credit>) =>
    edit((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const q = search.trim().toLowerCase();
  const shown = credits.filter((c) => !q || [c.caption, c.author, c.file].some((v) => v?.toLowerCase().includes(q)));

  const submit = async () => {
    if (!draft) return;
    if (form.current && !form.current.reportValidity()) return;
    const body: Credit[] = draft.map(({ id: _id, ...credit }) => credit);
    if (await save.run('/directory/admin/photo-credits', { method: 'PUT', body })) {
      await reload();
      setDraft(null);
    }
  };

  return (
    <Panel
      title={t('admin.photoCredits.title', { count: credits.length })}
      description={t('admin.photoCredits.description')}
      action={
        <div className={styles.toolbar}>
          <input
            className={s.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.photoCredits.searchPlaceholder')}
            aria-label={t('admin.photoCredits.searchLabel')}
          />
          <button
            type="button"
            className={s.secondary}
            onClick={() => {
              setSearch('');
              edit((list) => [{ ...BLANK, id: nextId.current++ }, ...list]);
            }}
          >
            {t('admin.photoCredits.add')}
          </button>
        </div>
      }
    >
      <form ref={form} className={styles.credits} onSubmit={(e) => e.preventDefault()}>
        {shown.length === 0 && <p className={s.muted}>{q ? t('admin.photoCredits.noMatch') : t('admin.photoCredits.empty')}</p>}
        {shown.map((c) => {
          const n = credits.indexOf(c) + 1;
          return (
            <div key={c.id} className={styles.credit}>
              <SiteImageField value={c.file} onChange={(file) => set(c.id, { file })} label={t('admin.photoCredits.photoN', { n })} />
              <div className={styles.creditFields}>
                <input
                  className={s.input}
                  required
                  value={c.caption}
                  onChange={(e) => set(c.id, { caption: e.target.value })}
                  placeholder={t('admin.photoCredits.caption')}
                  aria-label={t('admin.photoCredits.captionN', { n })}
                />
                <input
                  className={s.input}
                  value={c.author ?? ''}
                  onChange={(e) => set(c.id, { author: e.target.value })}
                  placeholder={t('admin.photoCredits.author')}
                  aria-label={t('admin.photoCredits.authorN', { n })}
                />
                <input
                  className={s.input}
                  required
                  value={c.license}
                  onChange={(e) => set(c.id, { license: e.target.value })}
                  placeholder={t('admin.photoCredits.licence')}
                  aria-label={t('admin.photoCredits.licenceN', { n })}
                />
                <input
                  className={s.input}
                  type="url"
                  value={c.licenseUrl ?? ''}
                  onChange={(e) => set(c.id, { licenseUrl: e.target.value })}
                  placeholder={t('admin.photoCredits.licenceLink')}
                  aria-label={t('admin.photoCredits.licenceLinkN', { n })}
                />
                <input
                  className={s.input}
                  type="url"
                  value={c.source ?? ''}
                  onChange={(e) => set(c.id, { source: e.target.value })}
                  placeholder={t('admin.photoCredits.source')}
                  aria-label={t('admin.photoCredits.sourceN', { n })}
                />
                <input
                  className={s.input}
                  value={c.changes ?? ''}
                  onChange={(e) => set(c.id, { changes: e.target.value })}
                  placeholder={t('admin.photoCredits.changes')}
                  aria-label={t('admin.photoCredits.changesN', { n })}
                />
              </div>
              <button
                type="button"
                className={s.linkDanger}
                onClick={() => edit((list) => list.filter((x) => x.id !== c.id))}
                aria-label={t('admin.photoCredits.removeN', { n })}
              >
                {t('common.remove')}
              </button>
            </div>
          );
        })}
      </form>

      <SaveBar
        onSave={() => void submit()}
        busy={save.busy}
        saved={save.saved}
        error={save.error}
        dirty={draft !== null}
        label={t('admin.photoCredits.save')}
      >
        {draft && (
          <button type="button" className={s.linkButton} onClick={() => setDraft(null)}>
            {t('admin.photoCredits.discard')}
          </button>
        )}
      </SaveBar>
    </Panel>
  );
}
