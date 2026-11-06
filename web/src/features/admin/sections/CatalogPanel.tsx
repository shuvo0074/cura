import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../../app/services';
import { useT, type TranslationKey } from '../../../i18n';
import { Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useResource } from '../../../ui';
import { ImageUpload, fromList, imageSrc, toList } from './admin-kit';
import { RecordActions } from './AmbulancesPanel';
import a from './AmbulancesPanel.module.css';
import c from './CatalogPanel.module.css';

type CatalogKind = 'specialties' | 'symptoms';

/** A specialty or symptom as the admin list returns it. */
interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  name_bn: string | null;
  icon?: string | null;
  description: string | null;
  tags: string[] | null;
  image: string | null;
  hidden: boolean;
  /** Specialties only: doctors listed under this specialty. */
  doctor_count?: number;
  /** Symptoms only: the specialties a symptom sends patients to. */
  specialties?: string[];
}

/** What a save answers: the record, plus how many doctors a specialty rename touched. */
type SavedItem = CatalogItem & { renamedDoctors?: number };

interface CatalogForm {
  name: string;
  name_bn: string;
  icon: string;
  description: string;
  tags: string;
  image: string;
  specialties: string[];
}

const KINDS: Record<CatalogKind, { path: string }> = {
  specialties: { path: '/specialties' },
  symptoms: { path: '/symptoms' },
};

/** The kind's own words: `admin.catalog.specialties.*` or `admin.catalog.symptoms.*`. */
const kindKey = (kind: CatalogKind, word: 'title' | 'description' | 'search' | 'add' | 'edit' | 'empty' | 'one') =>
  `admin.catalog.${kind}.${word}` as TranslationKey;

const BLANK: CatalogForm = { name: '', name_bn: '', icon: '', description: '', tags: '', image: '', specialties: [] };

const toForm = (item: CatalogItem): CatalogForm => ({
  name: item.name,
  name_bn: item.name_bn ?? '',
  icon: item.icon ?? '',
  description: item.description ?? '',
  tags: fromList(item.tags),
  image: item.image ?? '',
  specialties: item.specialties ?? [],
});

/**
 * Specialties and symptoms share this screen: the cards patients browse on Cura
 * Website (name in English and Bangla, description, tags, image), plus a
 * specialty's icon and the specialties a symptom sends patients to.
 */
export function CatalogPanel({ kind }: { kind: CatalogKind }) {
  // A fresh list per kind, so search and an open dialog do not carry over.
  return <CatalogList key={kind} kind={kind} />;
}

function CatalogList({ kind }: { kind: CatalogKind }) {
  const { t, tm, fmt } = useT();
  const { data, error, loading, reload } = useResource<CatalogItem[]>(`/directory/admin/${kind}`, {});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ item: CatalogItem | null; error?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Stable, so the dialog does not move focus when the list reloads behind it.
  const close = useCallback(() => setEditing(null), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((item) => !q || [item.name, item.name_bn].some((n) => n?.toLowerCase().includes(q)));
  }, [data, search]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;

  const open = (item: CatalogItem | null) => {
    setNotice(null);
    setEditing({ item });
  };

  return (
    <Panel
      title={t(kindKey(kind, 'title'))}
      description={t(kindKey(kind, 'description'), { count: visible.length })}
      action={
        <div className={c.imageButtons}>
          <input
            className={s.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(kindKey(kind, 'search'))}
            aria-label={t(kindKey(kind, 'search'))}
          />
          <button type="button" className={s.primary} onClick={() => open(null)}>
            {t(kindKey(kind, 'add'))}
          </button>
        </div>
      }
    >
      {notice && (
        <p className={c.notice} role="status">
          {notice}
        </p>
      )}
      {visible.length === 0 ? (
        <p className={s.muted}>{t(kindKey(kind, 'empty'))}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('admin.catalog.col.name')}</th>
              <th>{t('admin.catalog.col.nameBn')}</th>
              <th>{kind === 'specialties' ? t('admin.catalog.col.doctors') : t('admin.catalog.col.specialists')}</th>
              <th>{t('admin.catalog.col.visible')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className={c.nameCell}>
                    <span className={c.thumb} aria-hidden="true">
                      {item.image ? <img src={imageSrc(item.image)} alt="" /> : (item.icon ?? '')}
                    </span>
                    <span>
                      {item.name}
                      {!item.description && <span className={s.staffMeta}>{t('admin.catalog.noDescription')}</span>}
                    </span>
                  </span>
                </td>
                <td className={item.name_bn ? undefined : s.mutedCell}>{item.name_bn || t('admin.catalog.notAdded')}</td>
                <td>
                  {kind === 'specialties'
                    ? fmt.number(item.doctor_count ?? 0)
                    : item.specialties?.length
                      ? item.specialties.join(', ')
                      : <span className={s.mutedCell}>{t('admin.catalog.noneLinked')}</span>}
                </td>
                <td>{item.hidden ? t('admin.catalog.hidden') : t('common.yes')}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => open(item)}>
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <CatalogModal
          key={editing.item?.id ?? 'new'}
          kind={kind}
          existing={editing.item}
          initialError={editing.error ?? null}
          onClose={close}
          onChanged={() => void reload()}
          onSaved={(saved, uploadError) => {
            void reload();
            if (uploadError) {
              // The record exists now; reopen it so the image can be tried again.
              setEditing({ item: saved, error: t('admin.catalog.uploadFailed', { error: tm(uploadError) }) });
              return;
            }
            if (saved.renamedDoctors) {
              setNotice(t('admin.catalog.renamed', { name: saved.name, count: saved.renamedDoctors }));
            }
            setEditing(null);
          }}
          onDeleted={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}

function CatalogModal({
  kind,
  existing,
  initialError,
  onClose,
  onChanged,
  onSaved,
  onDeleted,
}: {
  kind: CatalogKind;
  existing: CatalogItem | null;
  initialError: string | null;
  onClose: () => void;
  onChanged: () => void;
  onSaved: (saved: SavedItem, uploadError: string | null) => void;
  onDeleted: () => void;
}) {
  const { t, tm } = useT();
  const { http } = useServices();
  const { path } = KINDS[kind];
  const [form, setForm] = useState<CatalogForm>(existing ? toForm(existing) : BLANK);
  const [hidden, setHidden] = useState(existing?.hidden ?? false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const set = (patch: Partial<CatalogForm>) => setForm((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body = { ...form, tags: toList(form.tags) };
    const result = existing
      ? await http.request<SavedItem>(`/directory/admin/${kind}/${existing.id}`, { method: 'PATCH', body, retry: false })
      : await http.request<SavedItem>(`/directory/admin/${kind}`, { method: 'POST', body, retry: false });
    if (!result.ok) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    const saved = result.value;
    let uploadError: string | null = null;
    if (pendingImage) {
      const upload = new FormData();
      upload.append('photo', pendingImage);
      const sent = await http.request<{ photo: string }>(`/directory/admin/${kind}/${saved.id}/photo`, {
        method: 'POST',
        body: upload,
        retry: false,
      });
      if (!sent.ok) uploadError = sent.error.message;
    }
    setBusy(false);
    onSaved(saved, uploadError);
  };

  const renaming =
    existing && kind === 'specialties' && form.name !== existing.name && (existing.doctor_count ?? 0) > 0;

  return (
    <Modal
      title={existing ? t(kindKey(kind, 'edit')) : t(kindKey(kind, 'add'))}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      {existing && !hidden && (
        <p className={s.muted}>
          {t('admin.catalog.pageOnWebsite', { path: `${path}/${existing.slug}` })}
        </p>
      )}
      {existing && (
        <RecordActions
          path={`/directory/admin/${kind}/${existing.id}`}
          hidden={hidden}
          label={t(kindKey(kind, 'one'))}
          onHiddenChange={(next) => {
            setHidden(next);
            onChanged();
          }}
          onDeleted={onDeleted}
        />
      )}

      <ImageField
        kind={kind}
        id={existing?.id ?? null}
        image={form.image}
        pendingImage={pendingImage}
        onPendingImage={setPendingImage}
        onImage={(image, stored) => {
          set({ image });
          // An upload or removal is already saved, so the list behind refreshes.
          if (stored) onChanged();
        }}
      />

      <Row cols={2}>
        <Field label={t('admin.catalog.name')} required>
          <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t('admin.catalog.nameBn')}>
          <input className={s.input} value={form.name_bn} onChange={(e) => set({ name_bn: e.target.value })} />
        </Field>
      </Row>
      {renaming && (
        <p className={c.warning}>
          {t('admin.catalog.renameWarning', { count: existing.doctor_count ?? 0 })}
        </p>
      )}
      {kind === 'specialties' && (
        <Field label={t('admin.catalog.icon')} hint={t('admin.catalog.iconHint')}>
          <input
            className={`${s.input} ${c.icon}`}
            maxLength={8}
            value={form.icon}
            onChange={(e) => set({ icon: e.target.value })}
          />
        </Field>
      )}
      <Field label={t('admin.catalog.tags')} hint={t('admin.catalog.tagsHint')}>
        <input
          className={s.input}
          value={form.tags}
          placeholder={t('admin.catalog.tagsPlaceholder')}
          onChange={(e) => set({ tags: e.target.value })}
        />
      </Field>
      <Field
        label={t('admin.catalog.description')}
        hint={
          kind === 'specialties' ? t('admin.catalog.descriptionHintSpecialty') : t('admin.catalog.descriptionHint')
        }
      >
        <textarea
          className={s.textarea}
          rows={3}
          maxLength={500}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
      {kind === 'symptoms' && (
        <SpecialtyPicker selected={form.specialties} onChange={(specialties) => set({ specialties })} />
      )}
    </Modal>
  );
}

/**
 * The record's image. Editing uploads straight away; adding keeps the chosen
 * file until the record exists (it needs an id), then the dialog uploads it.
 * An image can also be a web address instead of an upload.
 */
function ImageField({
  kind,
  id,
  image,
  pendingImage,
  onPendingImage,
  onImage,
}: {
  kind: CatalogKind;
  id: string | null;
  image: string;
  pendingImage: File | null;
  onPendingImage: (file: File | null) => void;
  onImage: (image: string, stored: boolean) => void;
}) {
  const { t, tm } = useT();
  const { http } = useServices();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (pendingImage ? URL.createObjectURL(pendingImage) : null), [pendingImage]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? (image ? imageSrc(image) : undefined);
  const uploaded = image.startsWith('/');
  const uploadPath = id ? `/directory/admin/${kind}/${id}/photo` : null;

  const remove = async () => {
    setError(null);
    if (!uploadPath) {
      onPendingImage(null);
      onImage('', false);
      return;
    }
    setBusy(true);
    const result = await http.request(uploadPath, { method: 'DELETE', retry: false });
    setBusy(false);
    if (result.ok) onImage('', true);
    else setError(result.error.message);
  };

  return (
    <>
      <div className={c.imageRow}>
        <div className={c.imageBox}>{shown ? <img src={shown} alt="" /> : t('admin.catalog.noImage')}</div>
        <div className={c.imageControls}>
          <span className={s.fieldLabel}>
            {pendingImage ? t('admin.catalog.imagePending') : t('admin.catalog.image')}
          </span>
          <div className={c.imageButtons}>
            {uploadPath ? (
              <ImageUpload
                path={uploadPath}
                label={shown ? t('admin.catalog.changeImage') : t('admin.kit.uploadImage')}
                onUploaded={(address) => onImage(address, true)}
              />
            ) : (
              <>
                <input
                  ref={picker}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) onPendingImage(file);
                  }}
                />
                <button type="button" className={s.secondary} onClick={() => picker.current?.click()}>
                  {shown ? t('admin.catalog.changeImage') : t('admin.kit.uploadImage')}
                </button>
              </>
            )}
            {shown && (
              <button type="button" className={s.linkDanger} disabled={busy} onClick={() => void remove()}>
                {t('common.remove')}
              </button>
            )}
          </div>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
        </div>
      </div>
      {!uploaded && !pendingImage && (
        <Field label={t('admin.catalog.imageLink')}>
          <input
            className={s.input}
            type="url"
            placeholder="https://…"
            value={image}
            onChange={(e) => onImage(e.target.value, false)}
          />
        </Field>
      )}
    </>
  );
}

/** Specialties a symptom sends patients to. */
function SpecialtyPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const { t } = useT();
  const { data, error } = useResource<CatalogItem[]>('/directory/admin/specialties', {});
  const [query, setQuery] = useState('');
  const names = (data ?? []).map((item) => item.name);
  const visible = names.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <h4 className={s.subtitle}>{t('admin.catalog.specialistsHeading', { count: selected.length })}</h4>
      <p className={s.muted}>{t('admin.catalog.specialistsNote')}</p>
      {error && <Failed message={error} />}
      <input
        className={`${s.input} ${a.areaSearch}`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('admin.catalog.specialties.search')}
        aria-label={t('admin.catalog.specialties.search')}
      />
      <div className={a.checkGrid}>
        {visible.map((name) => (
          <label key={name} className={s.check}>
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, name] : selected.filter((item) => item !== name))
              }
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </>
  );
}
