import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../../app/services';
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

const KINDS: Record<CatalogKind, { title: string; one: string; path: string }> = {
  specialties: { title: 'Specialties', one: 'specialty', path: '/specialties' },
  symptoms: { title: 'Symptoms', one: 'symptom', path: '/symptoms' },
};

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
  const { title, one } = KINDS[kind];
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
      title={title}
      description={`${visible.length} ${visible.length === 1 ? one : title.toLowerCase()}. Click one to edit, hide or delete it.`}
      action={
        <div className={c.imageButtons}>
          <input
            className={s.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            aria-label={`Search ${title.toLowerCase()}`}
          />
          <button type="button" className={s.primary} onClick={() => open(null)}>
            Add {one}
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
        <p className={s.muted}>No {title.toLowerCase()} match.</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Bangla name</th>
              <th>{kind === 'specialties' ? 'Doctors' : 'Specialists'}</th>
              <th>Visible</th>
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
                      {!item.description && <span className={s.staffMeta}>No description</span>}
                    </span>
                  </span>
                </td>
                <td className={item.name_bn ? undefined : s.mutedCell}>{item.name_bn || 'Not added yet'}</td>
                <td>
                  {kind === 'specialties'
                    ? (item.doctor_count ?? 0)
                    : item.specialties?.length
                      ? item.specialties.join(', ')
                      : <span className={s.mutedCell}>None linked</span>}
                </td>
                <td>{item.hidden ? 'Hidden' : 'Yes'}</td>
                <td>
                  <button type="button" className={s.linkButton} onClick={() => open(item)}>
                    Edit
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
              setEditing({ item: saved, error: `Saved, but the image didn't upload: ${uploadError}` });
              return;
            }
            if (saved.renamedDoctors) {
              setNotice(`Renamed to "${saved.name}" on ${saved.renamedDoctors} doctor(s).`);
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
  const { http } = useServices();
  const { one, path } = KINDS[kind];
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
      title={existing ? `Edit ${one}` : `Add ${one}`}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {existing && !hidden && (
        <p className={s.muted}>
          Page on Cura Website: {path}/{existing.slug}
        </p>
      )}
      {existing && (
        <RecordActions
          path={`/directory/admin/${kind}/${existing.id}`}
          hidden={hidden}
          label={one}
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
        <Field label="Name" required>
          <input className={s.input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Name in Bangla">
          <input className={s.input} value={form.name_bn} onChange={(e) => set({ name_bn: e.target.value })} />
        </Field>
      </Row>
      {renaming && (
        <p className={c.warning}>
          Renaming also changes the specialty on its {existing.doctor_count} doctor(s). The page address stays the
          same.
        </p>
      )}
      {kind === 'specialties' && (
        <Field label="Icon" hint="One emoji.">
          <input
            className={`${s.input} ${c.icon}`}
            maxLength={8}
            value={form.icon}
            onChange={(e) => set({ icon: e.target.value })}
          />
        </Field>
      )}
      <Field label="Tags" hint="Separate with commas, up to 6.">
        <input
          className={s.input}
          value={form.tags}
          placeholder="Heart check-up, ECG & echo"
          onChange={(e) => set({ tags: e.target.value })}
        />
      </Field>
      <Field
        label="Description"
        hint={
          kind === 'specialties'
            ? "Shown on the card, about three lines. Words here also help search find this specialty's doctors."
            : 'Shown on the card, about three lines.'
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
        <div className={c.imageBox}>{shown ? <img src={shown} alt="" /> : 'No image'}</div>
        <div className={c.imageControls}>
          <span className={s.fieldLabel}>Image{pendingImage ? ' (uploads when you save)' : ''}</span>
          <div className={c.imageButtons}>
            {uploadPath ? (
              <ImageUpload
                path={uploadPath}
                label={shown ? 'Change image' : 'Upload image'}
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
                  {shown ? 'Change image' : 'Upload image'}
                </button>
              </>
            )}
            {shown && (
              <button type="button" className={s.linkDanger} disabled={busy} onClick={() => void remove()}>
                Remove
              </button>
            )}
          </div>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
        </div>
      </div>
      {!uploaded && !pendingImage && (
        <Field label="Or an image link">
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
  const { data, error } = useResource<CatalogItem[]>('/directory/admin/specialties', {});
  const [query, setQuery] = useState('');
  const names = (data ?? []).map((item) => item.name);
  const visible = names.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <h4 className={s.subtitle}>Specialists for this symptom ({selected.length} selected)</h4>
      <p className={s.muted}>
        Doctors with these specialties are listed for the symptom, as well as any whose profile mentions it.
      </p>
      {error && <Failed message={error} />}
      <input
        className={`${s.input} ${a.areaSearch}`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search specialties"
        aria-label="Search specialties"
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
