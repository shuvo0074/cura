import { useMemo, useRef, useState } from 'react';
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
  const src = imageSrc(value);
  return (
    <div className={styles.imageField}>
      {src ? <img className={styles.thumb} src={src} alt="" /> : <span className={styles.thumb} aria-hidden="true" />}
      <div className={styles.imageControls}>
        <input
          className={s.input}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image link or uploaded file"
          aria-label={`${label} address`}
        />
        <ImageUpload path={SITE_IMAGES_PATH} label="Upload" onUploaded={onChange} />
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
      title={`Photo credits (${credits.length})`}
      description="Shown on the Photo credits page. Photos under CC BY or CC BY-SA must be credited with the author, licence and source."
      action={
        <div className={styles.toolbar}>
          <input
            className={s.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search caption or author"
            aria-label="Search credits"
          />
          <button
            type="button"
            className={s.secondary}
            onClick={() => {
              setSearch('');
              edit((list) => [{ ...BLANK, id: nextId.current++ }, ...list]);
            }}
          >
            Add credit
          </button>
        </div>
      }
    >
      <form ref={form} className={styles.credits} onSubmit={(e) => e.preventDefault()}>
        {shown.length === 0 && <p className={s.muted}>{q ? 'No credits match.' : 'No credits yet.'}</p>}
        {shown.map((c) => {
          const n = credits.indexOf(c) + 1;
          return (
            <div key={c.id} className={styles.credit}>
              <SiteImageField value={c.file} onChange={(file) => set(c.id, { file })} label={`Credit ${n} photo`} />
              <div className={styles.creditFields}>
                <input
                  className={s.input}
                  required
                  value={c.caption}
                  onChange={(e) => set(c.id, { caption: e.target.value })}
                  placeholder="Caption (what and where)"
                  aria-label={`Credit ${n} caption`}
                />
                <input
                  className={s.input}
                  value={c.author ?? ''}
                  onChange={(e) => set(c.id, { author: e.target.value })}
                  placeholder="Author (if known)"
                  aria-label={`Credit ${n} author`}
                />
                <input
                  className={s.input}
                  required
                  value={c.license}
                  onChange={(e) => set(c.id, { license: e.target.value })}
                  placeholder="Licence, e.g. CC BY-SA 4.0"
                  aria-label={`Credit ${n} licence`}
                />
                <input
                  className={s.input}
                  type="url"
                  value={c.licenseUrl ?? ''}
                  onChange={(e) => set(c.id, { licenseUrl: e.target.value })}
                  placeholder="Licence link"
                  aria-label={`Credit ${n} licence link`}
                />
                <input
                  className={s.input}
                  type="url"
                  value={c.source ?? ''}
                  onChange={(e) => set(c.id, { source: e.target.value })}
                  placeholder="Source page"
                  aria-label={`Credit ${n} source page`}
                />
                <input
                  className={s.input}
                  value={c.changes ?? ''}
                  onChange={(e) => set(c.id, { changes: e.target.value })}
                  placeholder="Changes, e.g. Cropped"
                  aria-label={`Credit ${n} changes`}
                />
              </div>
              <button
                type="button"
                className={s.linkDanger}
                onClick={() => edit((list) => list.filter((x) => x.id !== c.id))}
                aria-label={`Remove credit ${n}`}
              >
                Remove
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
        label="Save credits"
      >
        {draft && (
          <button type="button" className={s.linkButton} onClick={() => setDraft(null)}>
            Discard changes
          </button>
        )}
      </SaveBar>
    </Panel>
  );
}
