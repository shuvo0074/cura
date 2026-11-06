import { useRef, useState, type ReactNode } from 'react';
import { useT, type TranslationKey } from '../../../i18n';
import { Failed, Loading, Panel, Row, Field, SaveBar, uiStyles as s, useMutation, useResource } from '../../../ui';
import { divisionLabel } from './data/divisions-hospitals';
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

const PHONES: ReadonlyArray<readonly [keyof Contacts, TranslationKey]> = [
  ['emergency', 'admin.homePage.phone.emergency'],
  ['health_line', 'admin.homePage.phone.healthLine'],
  ['hotline', 'admin.homePage.phone.hotline'],
];

type HomeDraft = Partial<HomeContent>;

/**
 * The home page's picks, the division photos and the phone numbers shown
 * across the Cura Website. Each section saves on its own.
 */
export function HomePagePanel() {
  const { t } = useT();
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
    <Panel title={t('admin.homePage.title')} description={t('admin.homePage.description')}>
      <Section
        title={t('admin.homePage.phones.title')}
        hint={t('admin.homePage.phones.hint')}
        mutation={contactsSave}
        dirty={contactsDraft !== null}
        onSave={saveContacts}
        onDiscard={() => setContactsDraft(null)}
      >
        <Row cols={3}>
          {PHONES.map(([key, label]) => (
            <Field key={key} label={t(label)} required>
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
        title={t('admin.homePage.specialties.title')}
        hint={t('admin.homePage.specialties.hint', { max: 12 })}
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
          kind="specialty"
          max={12}
        />
      </Section>

      <Section
        title={t('admin.homePage.problems.title')}
        hint={t('admin.homePage.problems.hint', { max: 16 })}
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
          kind="symptom"
          max={16}
        />
      </Section>

      <Section
        title={t('admin.homePage.divisions.title')}
        hint={t('admin.homePage.divisions.hint')}
        mutation={divisionsSave}
        dirty={'divisions' in homeDraft}
        onSave={() => saveHome('divisions', divisionsSave)}
        onDiscard={() => discardHome('divisions')}
      >
        <table className={`${s.table} ${styles.divisions}`}>
          <thead>
            <tr>
              <th>{t('admin.homePage.divisions.division')}</th>
              <th>{t('admin.homePage.divisions.banglaName')}</th>
              <th>{t('admin.homePage.divisions.photo')}</th>
            </tr>
          </thead>
          <tbody>
            {home.divisions.map((d) => (
              <tr key={d.name}>
                <td>{divisionLabel(t, d.name)}</td>
                <td>
                  <input
                    className={s.input}
                    required
                    value={d.bn}
                    onChange={(e) => setDivision(d.name, { bn: e.target.value })}
                    aria-label={t('admin.homePage.divisions.inBangla', { name: divisionLabel(t, d.name) })}
                    lang="bn"
                  />
                </td>
                <td>
                  <div className={styles.photoCell}>
                    <SiteImageField
                      value={d.photo}
                      onChange={(photo) => setDivision(d.name, { photo })}
                      label={t('admin.homePage.divisions.photoOf', { name: divisionLabel(t, d.name) })}
                    />
                    <input
                      className={s.input}
                      value={d.alt ?? ''}
                      onChange={(e) => setDivision(d.name, { alt: e.target.value })}
                      maxLength={160}
                      placeholder={t('admin.homePage.divisions.altPlaceholder')}
                      aria-label={t('admin.homePage.divisions.altLabel', { name: divisionLabel(t, d.name) })}
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
  const { t } = useT();
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
            {t('admin.homePage.discard')}
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
  kind,
  max,
}: {
  items: Shortcut[];
  onChange: (items: Shortcut[]) => void;
  pages: CatalogPage[];
  pagesError: string | null;
  kind: 'specialty' | 'symptom';
  max: number;
}) {
  const { t, tm } = useT();
  const set = (i: number, patch: Partial<Shortcut>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <>
      {pagesError && (
        <p className={s.error}>{t(`admin.homePage.${kind}.loadFailed`, { error: tm(pagesError) })}</p>
      )}
      {items.length === 0 ? (
        <p className={s.muted}>{t('admin.homePage.noneYet')}</p>
      ) : (
        <table className={`${s.table} ${styles.shortcuts}`}>
          <thead>
            <tr>
              <th>{t(`admin.homePage.${kind}.page`)}</th>
              <th>{t('admin.homePage.englishLabel')}</th>
              <th>{t('admin.homePage.banglaLabel')}</th>
              <th aria-label={t('admin.homePage.order')} />
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
                    aria-label={t(`admin.homePage.${kind}.pageN`, { n: i + 1 })}
                    onChange={(e) => {
                      const page = pages.find((p) => p.slug === e.target.value);
                      set(i, {
                        slug: e.target.value,
                        en: item.en || page?.name || '',
                        bn: item.bn || page?.name_bn || '',
                      });
                    }}
                  >
                    <option value="">{t('admin.homePage.choose')}</option>
                    {/* Keep a saved pick visible even if its page is missing from the list. */}
                    {item.slug && !pages.some((p) => p.slug === item.slug) && (
                      <option value={item.slug}>{item.slug}</option>
                    )}
                    {pages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                        {p.hidden ? t('admin.homePage.hiddenSuffix') : ''}
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
                    placeholder={t('admin.homePage.englishPlaceholder')}
                    aria-label={t('admin.homePage.englishLabelN', { n: i + 1 })}
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
                    aria-label={t('admin.homePage.banglaLabelN', { n: i + 1 })}
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
                      aria-label={t('admin.homePage.moveUp', { n: i + 1 })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={s.iconButton}
                      disabled={i === items.length - 1}
                      onClick={() => onChange(move(items, i, 1))}
                      aria-label={t('admin.homePage.moveDown', { n: i + 1 })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={s.linkDanger}
                      onClick={() => onChange(items.filter((_, j) => j !== i))}
                      aria-label={t('admin.homePage.removeN', { n: i + 1 })}
                    >
                      {t('common.remove')}
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
        {t('common.add')}
      </button>
    </>
  );
}
