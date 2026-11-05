import { useRef, useState, type ReactNode } from 'react';
import { Failed, Loading, Panel, Row, Field, SaveBar, uiStyles as s, useMutation, useResource } from '../../../ui';
import { SiteImageField } from './PhotoCreditsPanel';
import styles from './HomePagePanel.module.css';

type Shortcut = { slug: string; en: string; bn: string };
type Division = { name: string; bn: string; photo: string | null; alt: string | null };
type HomeContent = { popular_specialties: Shortcut[]; common_problems: Shortcut[]; divisions: Division[] };
type Contacts = { emergency: string; health_line: string; hotline: string };
type SiteContent = { home?: HomeContent; contacts?: Contacts };
type CatalogPage = { slug: string; name: string; name_bn?: string | null; hidden?: boolean };

/** What the Website shows before anything is saved. */
const DEFAULT_CONTACTS: Contacts = { emergency: '999', health_line: '16263', hotline: '16966' };
const DEFAULT_HOME: HomeContent = {
  popular_specialties: [],
  common_problems: [],
  divisions: [
    ['Dhaka', 'ঢাকা'],
    ['Chattogram', 'চট্টগ্রাম'],
    ['Rajshahi', 'রাজশাহী'],
    ['Khulna', 'খুলনা'],
    ['Sylhet', 'সিলেট'],
    ['Barishal', 'বরিশাল'],
    ['Rangpur', 'রংপুর'],
    ['Mymensingh', 'ময়মনসিংহ'],
  ].map(([name = '', bn = '']) => ({ name, bn, photo: null, alt: null })),
};

const PHONES: ReadonlyArray<readonly [keyof Contacts, string]> = [
  ['emergency', 'Emergency (national)'],
  ['health_line', 'Health advice line'],
  ['hotline', 'Cura hotline'],
];

type HomeDraft = Partial<HomeContent>;

/**
 * The home page's picks, the division photos and the phone numbers shown
 * across the Cura Website. Each section saves on its own.
 */
export function HomePagePanel() {
  const content = useResource<SiteContent>('/directory/admin/site-content', {});
  const specialties = useResource<CatalogPage[]>('/directory/admin/specialties', {});
  const symptoms = useResource<CatalogPage[]>('/directory/admin/symptoms', {});

  const contactsSave = useMutation();
  const specialtiesSave = useMutation();
  const problemsSave = useMutation();
  const divisionsSave = useMutation();

  const [contactsDraft, setContactsDraft] = useState<Contacts | null>(null);
  const [homeDraft, setHomeDraft] = useState<HomeDraft>({});

  if (content.loading && !content.data) return <Loading />;
  if (content.error && !content.data) return <Failed message={content.error} />;
  if (!content.data) return null;

  const savedHome = content.data.home ?? DEFAULT_HOME;
  const savedContacts = { ...DEFAULT_CONTACTS, ...content.data.contacts };
  const home: HomeContent = { ...savedHome, ...homeDraft };
  const contacts = contactsDraft ?? savedContacts;

  const setHome = <K extends keyof HomeContent>(key: K, value: HomeContent[K]) =>
    setHomeDraft((d) => ({ ...d, [key]: value }));
  const discardHome = (key: keyof HomeContent) =>
    setHomeDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  /** Saves one part of the home content; the other parts go as last saved. */
  const saveHome = async (key: keyof HomeContent, mutation: ReturnType<typeof useMutation>) => {
    const body: HomeContent = { ...savedHome, [key]: home[key] };
    if (await mutation.run('/directory/admin/home-content', { method: 'PUT', body })) {
      await content.reload();
      discardHome(key);
    }
  };

  const saveContacts = async () => {
    if (await contactsSave.run('/directory/admin/contacts', { method: 'PUT', body: contacts })) {
      await content.reload();
      setContactsDraft(null);
    }
  };

  const setDivision = (name: string, patch: Partial<Division>) =>
    setHome(
      'divisions',
      home.divisions.map((d) => (d.name === name ? { ...d, ...patch } : d)),
    );

  return (
    <Panel title="Home page" description="What the Cura Website home page shows. Each section saves on its own.">
      <Section
        title="Phone numbers"
        hint="Used in the header, footer and emergency box. The labels around them are in Site text."
        mutation={contactsSave}
        dirty={contactsDraft !== null}
        onSave={saveContacts}
        onDiscard={() => setContactsDraft(null)}
      >
        <Row cols={3}>
          {PHONES.map(([key, label]) => (
            <Field key={key} label={label} required>
              <input
                className={s.input}
                required
                inputMode="tel"
                value={contacts[key]}
                onChange={(e) => setContactsDraft({ ...contacts, [key]: e.target.value })}
              />
            </Field>
          ))}
        </Row>
      </Section>

      <Section
        title="Popular specialties"
        hint="Shown as cards on the home page; the first six also appear under the search box. Up to 12."
        mutation={specialtiesSave}
        dirty={'popular_specialties' in homeDraft}
        onSave={() => saveHome('popular_specialties', specialtiesSave)}
        onDiscard={() => discardHome('popular_specialties')}
      >
        <ShortcutList
          items={home.popular_specialties}
          onChange={(list) => setHome('popular_specialties', list)}
          pages={specialties.data ?? []}
          pagesError={specialties.error}
          pageLabel="Specialty"
          max={12}
        />
      </Section>

      <Section
        title="Common problems"
        hint="Everyday problems in the words people use, each opening a symptom page. Up to 16."
        mutation={problemsSave}
        dirty={'common_problems' in homeDraft}
        onSave={() => saveHome('common_problems', problemsSave)}
        onDiscard={() => discardHome('common_problems')}
      >
        <ShortcutList
          items={home.common_problems}
          onChange={(list) => setHome('common_problems', list)}
          pages={symptoms.data ?? []}
          pagesError={symptoms.error}
          pageLabel="Symptom"
          max={16}
        />
      </Section>

      <Section
        title="Division photos"
        hint="One photo per division for the browse-by-location cards. Credit photos that need it in Photo credits."
        mutation={divisionsSave}
        dirty={'divisions' in homeDraft}
        onSave={() => saveHome('divisions', divisionsSave)}
        onDiscard={() => discardHome('divisions')}
      >
        <table className={`${s.table} ${styles.divisions}`}>
          <thead>
            <tr>
              <th>Division</th>
              <th>Bangla name</th>
              <th>Photo</th>
            </tr>
          </thead>
          <tbody>
            {home.divisions.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>
                  <input
                    className={s.input}
                    required
                    value={d.bn}
                    onChange={(e) => setDivision(d.name, { bn: e.target.value })}
                    aria-label={`${d.name} in Bangla`}
                    lang="bn"
                  />
                </td>
                <td>
                  <div className={styles.photoCell}>
                    <SiteImageField
                      value={d.photo}
                      onChange={(photo) => setDivision(d.name, { photo })}
                      label={`${d.name} photo`}
                    />
                    <input
                      className={s.input}
                      value={d.alt ?? ''}
                      onChange={(e) => setDivision(d.name, { alt: e.target.value })}
                      maxLength={160}
                      placeholder="What the photo shows (for screen readers)"
                      aria-label={`${d.name} photo description`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </Panel>
  );
}

/** A titled part of the screen with its own save bar; checks required fields before saving. */
function Section({
  title,
  hint,
  mutation,
  dirty,
  onSave,
  onDiscard,
  children,
}: {
  title: string;
  hint: string;
  mutation: ReturnType<typeof useMutation>;
  dirty: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} className={styles.section} onSubmit={(e) => e.preventDefault()}>
      <h3 className={s.subtitle}>{title}</h3>
      <p className={s.hint}>{hint}</p>
      {children}
      <SaveBar
        onSave={() => {
          if (form.current && !form.current.reportValidity()) return;
          void onSave();
        }}
        busy={mutation.busy}
        saved={mutation.saved}
        error={mutation.error}
        dirty={dirty}
      >
        {dirty && (
          <button type="button" className={s.linkButton} onClick={onDiscard}>
            Discard changes
          </button>
        )}
      </SaveBar>
    </form>
  );
}

const move = <T,>(list: readonly T[], i: number, by: number): T[] => {
  const next = [...list];
  const a = next[i];
  const b = next[i + by];
  if (a === undefined || b === undefined) return next;
  next[i] = b;
  next[i + by] = a;
  return next;
};

/**
 * An ordered list of links to specialty or symptom pages, each with a short
 * label in English and Bangla (the words patients use, e.g. "Child Specialist").
 */
function ShortcutList({
  items,
  onChange,
  pages,
  pagesError,
  pageLabel,
  max,
}: {
  items: Shortcut[];
  onChange: (items: Shortcut[]) => void;
  pages: CatalogPage[];
  pagesError: string | null;
  pageLabel: string;
  max: number;
}) {
  const set = (i: number, patch: Partial<Shortcut>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <>
      {pagesError && <p className={s.error}>Could not load the {pageLabel.toLowerCase()} pages: {pagesError}</p>}
      {items.length === 0 ? (
        <p className={s.muted}>None yet.</p>
      ) : (
        <table className={`${s.table} ${styles.shortcuts}`}>
          <thead>
            <tr>
              <th>{pageLabel} page</th>
              <th>English label</th>
              <th>Bangla label</th>
              <th aria-label="Order" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>
                  <select
                    className={s.input}
                    required
                    value={item.slug}
                    aria-label={`${pageLabel} page ${i + 1}`}
                    onChange={(e) => {
                      const page = pages.find((p) => p.slug === e.target.value);
                      set(i, {
                        slug: e.target.value,
                        en: item.en || page?.name || '',
                        bn: item.bn || page?.name_bn || '',
                      });
                    }}
                  >
                    <option value="">Choose…</option>
                    {/* Keep a saved pick visible even if its page is missing from the list. */}
                    {item.slug && !pages.some((p) => p.slug === item.slug) && (
                      <option value={item.slug}>{item.slug}</option>
                    )}
                    {pages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                        {p.hidden ? ' (hidden)' : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className={s.input}
                    required
                    value={item.en}
                    onChange={(e) => set(i, { en: e.target.value })}
                    maxLength={40}
                    placeholder="English"
                    aria-label={`English label ${i + 1}`}
                  />
                </td>
                <td>
                  <input
                    className={s.input}
                    required
                    value={item.bn}
                    onChange={(e) => set(i, { bn: e.target.value })}
                    maxLength={40}
                    placeholder="বাংলা"
                    aria-label={`Bangla label ${i + 1}`}
                    lang="bn"
                  />
                </td>
                <td>
                  <div className={styles.moves}>
                    <button
                      type="button"
                      className={s.iconButton}
                      disabled={i === 0}
                      onClick={() => onChange(move(items, i, -1))}
                      aria-label={`Move ${i + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={s.iconButton}
                      disabled={i === items.length - 1}
                      onClick={() => onChange(move(items, i, 1))}
                      aria-label={`Move ${i + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={s.linkDanger}
                      onClick={() => onChange(items.filter((_, j) => j !== i))}
                      aria-label={`Remove ${i + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        type="button"
        className={`${s.secondary} ${styles.add}`}
        disabled={items.length >= max}
        onClick={() => onChange([...items, { slug: '', en: '', bn: '' }])}
      >
        Add
      </button>
    </>
  );
}
