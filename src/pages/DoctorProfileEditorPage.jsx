import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Camera, Lock, Briefcase, GraduationCap, BookOpen, Users, Award, Plus, Pencil, Trash2, X, Check,
  ExternalLink, Copy, Link2, Stethoscope, Sparkles, ArrowLeft,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Photo from '../components/ui/Photo';
import AuthField from '../components/auth/AuthField';
import TagInput from '../components/ui/TagInput';
import { CARD } from '../utils/doctorProfile';

const THIS_YEAR = new Date().getFullYear();
const BASIC_FIELDS = ['headline', 'practicingSince', 'fees', 'followupFees', 'workplace', 'languages', 'website', 'about', 'clinicalExpertise', 'treatments', 'slug'];

function basicsFrom(p) {
  return {
    headline: p.headline || '',
    practicingSince: p.practicing_since ? String(p.practicing_since) : '',
    fees: p.fees != null ? String(p.fees) : '',
    followupFees: p.followup_fees != null ? String(p.followup_fees) : '',
    workplace: p.workplace || '',
    languages: p.languages || '',
    website: p.website || '',
    about: p.about || '',
    clinicalExpertise: p.clinical_expertise || [],
    treatments: p.treatments || [],
    slug: p.slug || '',
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Small building blocks ──

function Card({ icon: Icon, title, hint, action, children }) {
  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Icon size={18} className="text-primary" /> {title}</h2>
          {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TextArea({ label, value, onChange, max, placeholder, rows = 5 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        <textarea value={value} onChange={onChange} rows={rows} maxLength={max} placeholder={placeholder}
          className="mt-1.5 block w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-gray-400" />
      </label>
      <p className="text-xs text-gray-400 text-right -mt-0.5">{value.length}/{max}</p>
    </div>
  );
}

// ── Strength meter ──

function Strength({ completeness }) {
  const { t } = useTranslation();
  const { percent, missing } = completeness;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-4">
        <svg width="84" height="84" viewBox="0 0 84 84" className="flex-shrink-0 -rotate-90" aria-hidden>
          <circle cx="42" cy="42" r={r} fill="none" stroke="#EEF2F7" strokeWidth="8" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={percent === 100 ? '#16a34a' : '#006CE4'} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className="transition-all duration-500" />
        </svg>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('pe_strength')}</p>
          <p className="text-3xl font-bold text-gray-900 leading-tight">{percent}%</p>
        </div>
      </div>
      {missing.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-green-700 mt-4"><Sparkles size={15} /> {t('pe_complete')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {missing.map((key, i) => (
            <li key={key} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-action' : 'bg-gray-300'}`} />
              {t(`pe_missing_${key}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Career entries ──

// Which fields each kind of entry has, and what they're called.
const KINDS = {
  position: {
    icon: Briefcase, title: 'dp_positions',
    fields: [['title', 'pe_f_position_title', 'pe_f_position_title_ph', true], ['organization', 'pe_f_position_org'], ['location', 'pe_f_location'],
      ['startYear', 'pe_f_start', null, true, 'year'], ['endYear', 'pe_f_end', null, false, 'year'], ['isCurrent', 'pe_f_current', null, false, 'check'],
      ['description', 'pe_f_description', null, false, 'text']],
  },
  qualification: {
    icon: GraduationCap, title: 'dp_qualifications',
    fields: [['title', 'pe_f_degree', 'pe_f_degree_ph', true], ['organization', 'pe_f_institution'], ['endYear', 'pe_f_year', null, false, 'year']],
  },
  publication: {
    icon: BookOpen, title: 'dp_publications',
    fields: [['title', 'pe_f_pub_title', null, true], ['organization', 'pe_f_journal'], ['endYear', 'pe_f_year', null, false, 'year'], ['url', 'pe_f_url', null, false, 'url']],
  },
  membership: {
    icon: Users, title: 'dp_memberships',
    fields: [['title', 'pe_f_role', 'pe_f_role_ph', true], ['organization', 'pe_f_society'], ['startYear', 'pe_f_since', null, false, 'year']],
  },
  award: {
    icon: Award, title: 'dp_awards',
    fields: [['title', 'pe_f_award', null, true], ['organization', 'pe_f_issuer'], ['endYear', 'pe_f_year', null, false, 'year'],
      ['description', 'pe_f_description', null, false, 'text']],
  },
};

const toForm = item => ({
  title: item?.title || '', organization: item?.organization || '', location: item?.location || '',
  startYear: item?.start_year ? String(item.start_year) : '', endYear: item?.end_year ? String(item.end_year) : '',
  isCurrent: Boolean(item?.is_current), url: item?.url || '', description: item?.description || '',
});

function ItemForm({ kind, item, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => toForm(item));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { kind, ...form };
      if (item) await api.patch(`/doctors/me/profile/items/${item.id}`, body);
      else await api.post('/doctors/me/profile/items', body);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-primary/20 bg-primary/[0.02] rounded-xl p-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {KINDS[kind].fields.map(([key, label, placeholder, required, type]) => {
          if (type === 'check') {
            return (
              <label key={key} className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isCurrent} onChange={set('isCurrent')} className="w-4 h-4 accent-primary" /> {t(label)}
              </label>
            );
          }
          if (type === 'text') {
            return (
              <div key={key} className="sm:col-span-2">
                <TextArea label={t(label)} value={form[key]} onChange={set(key)} max={600} rows={3} />
              </div>
            );
          }
          const isYear = type === 'year';
          return (
            <AuthField key={key} label={t(label)} optional={!required} required={required}
              className={isYear ? '' : 'sm:col-span-2'}
              type={isYear ? 'number' : type === 'url' ? 'url' : 'text'}
              inputMode={isYear ? 'numeric' : undefined} min={isYear ? 1950 : undefined} max={isYear ? THIS_YEAR + 1 : undefined}
              placeholder={placeholder ? t(placeholder) : type === 'url' ? 'https://' : undefined}
              disabled={key === 'endYear' && form.isCurrent}
              value={form[key]} onChange={set(key)} maxLength={isYear ? undefined : 160} />
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 bg-white">{t('pe_cancel')}</button>
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">
          {busy ? t('pe_saving') : t('pe_save')}
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, onEdit, onDeleted }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const years = item.kind === 'membership'
    ? (item.start_year ? t('dp_since', { year: item.start_year }) : '')
    : item.start_year ? `${item.start_year} – ${item.is_current ? t('dp_present') : item.end_year || ''}` : item.end_year || '';
  async function remove() {
    await api.del(`/doctors/me/profile/items/${item.id}`);
    await onDeleted();
  }
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
        <p className="text-xs text-gray-500">{[item.organization, years, item.location].filter(Boolean).join(' · ')}</p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-600 hidden sm:inline">{t('pe_delete_confirm')}</span>
          <button type="button" onClick={() => setConfirming(false)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label={t('pe_cancel')}><X size={15} /></button>
          <button type="button" onClick={remove} className="p-1.5 rounded-lg text-white bg-red-600" aria-label={t('pe_delete')}><Check size={15} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5" aria-label={t('pe_edit')}><Pencil size={15} /></button>
          <button type="button" onClick={() => setConfirming(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={t('pe_delete')}><Trash2 size={15} /></button>
        </div>
      )}
    </li>
  );
}

function ItemSection({ kind, items, onChange }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null); // null | 'new' | item id
  const { icon, title } = KINDS[kind];
  async function done() {
    await onChange();
    setEditing(null);
  }
  return (
    <Card icon={icon} title={t(title)}
      action={editing !== 'new' && (
        <button type="button" onClick={() => setEditing('new')}
          className="flex items-center gap-1 text-sm font-semibold text-action hover:bg-action/5 rounded-full px-3 py-1.5 flex-shrink-0">
          <Plus size={15} /> {t('pe_add')}
        </button>
      )}>
      {/* How the degrees read after the doctor's name, oldest first like the public profile. */}
      {kind === 'qualification' && items.length > 0 && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4">
          {t('pe_degree_line')}:{' '}
          <span className="font-medium text-gray-900">
            {[...items].sort((a, b) => (a.end_year ?? 9999) - (b.end_year ?? 9999) || a.id - b.id).map(i => i.title).join(', ')}
          </span>
        </p>
      )}
      {editing === 'new' && <div className="mb-4"><ItemForm kind={kind} onSaved={done} onCancel={() => setEditing(null)} /></div>}
      {items.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-gray-400">{t('pe_empty_section')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {items.map(item => (editing === item.id
            ? <li key={item.id} className="py-3"><ItemForm kind={kind} item={item} onSaved={done} onCancel={() => setEditing(null)} /></li>
            : <ItemRow key={item.id} item={item} onEdit={() => setEditing(item.id)} onDeleted={onChange} />))}
        </ul>
      )}
    </Card>
  );
}

// ── Page ──

export default function DoctorProfileEditorPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [basics, setBasics] = useState(null);
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: '', savedAt: 0 });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  // Reloads after photo and entry changes, leaving unsaved intro edits alone.
  async function load() {
    setProfile(await api.get('/doctors/me/profile'));
  }

  useEffect(() => {
    if (!user?.doctorId) return;
    api.get('/doctors/me/profile').then(p => {
      setProfile(p);
      setBasics(basicsFrom(p));
      setSaved(basicsFrom(p));
    }).catch(() => {});
  }, [user?.doctorId]);

  const dirty = basics && saved && !same(basics, saved);

  // The "Saved" note clears itself.
  useEffect(() => {
    if (!status.savedAt) return undefined;
    const id = setTimeout(() => setStatus(s => ({ ...s, savedAt: 0 })), 2500);
    return () => clearTimeout(id);
  }, [status.savedAt]);

  // Warn before leaving with unsaved introduction edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!user?.doctorId) return <Navigate to="/doctor-dashboard" replace />;
  if (!profile || !basics) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">{t('loading')}</div>;

  const set = key => e => setBasics(b => ({ ...b, [key]: e.target.value }));
  const publicUrl = `${window.location.origin}/dr/${saved.slug}`;

  async function save() {
    setStatus({ busy: true, error: '', savedAt: 0 });
    const changed = Object.fromEntries(BASIC_FIELDS.filter(k => !same(basics[k], saved[k])).map(k => [k, basics[k]]));
    for (const k of ['practicingSince', 'fees', 'followupFees']) {
      if (k in changed) changed[k] = changed[k] === '' ? null : Number(changed[k]);
    }
    try {
      const p = await api.patch('/doctors/me/profile', changed);
      setProfile(p);
      setBasics(basicsFrom(p));
      setSaved(basicsFrom(p));
      setStatus({ busy: false, error: '', savedAt: Date.now() });
    } catch (err) {
      setStatus({ busy: false, error: err.message, savedAt: 0 });
    }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.upload('/doctors/me/profile/photo', fd);
      await load();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await api.del('/doctors/me/profile/photo');
      await load();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable: the link is visible to copy by hand */ }
  }

  return (
    <div className="pb-24">
      <Link to="/doctor-dashboard" className="text-gray-500 hover:text-primary inline-flex items-center gap-1.5 text-sm mb-3">
        <ArrowLeft size={16} /> Doctor Dashboard
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pe_title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('pe_sub')}</p>
        </div>
        <Link to={`/dr/${saved.slug}`} target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/30 rounded-full px-4 py-2 hover:bg-primary/5">
          <ExternalLink size={15} /> {t('pe_view_public')}
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* Sidebar first in the DOM so phones see strength + link up top. */}
        <aside className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <Strength completeness={profile.completeness} />

          <div className={`${CARD} p-5`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Link2 size={16} className="text-primary" /> {t('pe_link')}</p>
            <p className="text-xs text-gray-500 mt-1 mb-3">{t('pe_link_hint')}</p>
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
              <span className="text-xs text-gray-700 truncate flex-1 font-mono">{publicUrl.replace(/^https?:\/\//, '')}</span>
              <button type="button" onClick={copyLink} className="flex items-center gap-1 text-xs font-semibold text-action flex-shrink-0">
                {copied ? <><Check size={13} /> {t('pe_copied')}</> : <><Copy size={13} /> {t('pe_copy')}</>}
              </button>
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Lock size={15} className="text-gray-400" /> {t('pe_locked_title')}</p>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div><dt className="text-xs text-gray-500">{t('auth_full_name')}</dt><dd className="font-medium text-gray-900">{profile.name}</dd></div>
              <div><dt className="text-xs text-gray-500">{t('dreg_specialty')}</dt><dd className="font-medium text-gray-900">{profile.specialty}</dd></div>
              <div><dt className="text-xs text-gray-500">{t('dreg_bmdc')}</dt><dd className="font-medium text-gray-900">{profile.bmdc_no || '—'}</dd></div>
            </dl>
            <p className="text-xs text-gray-500 mt-3">{t('pe_locked_hint')}</p>
          </div>
        </aside>

        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          {/* Photo */}
          <Card icon={Camera} title={t('pe_photo')} hint={t('pe_photo_hint')}>
            <div className="flex items-center gap-4">
              <Photo src={profile.photo} alt={profile.name} iconSize={32} className="w-24 h-24 rounded-full ring-4 ring-primary/5 flex-shrink-0" />
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">
                  {photoBusy ? t('pe_uploading') : profile.photo ? t('pe_change_photo') : t('pe_upload_photo')}
                </button>
                {profile.photo && (
                  <button type="button" onClick={removePhoto} disabled={photoBusy}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600">{t('pe_remove_photo')}</button>
                )}
              </div>
            </div>
            {photoError && <p role="alert" className="text-sm text-red-600 mt-3">{photoError}</p>}
          </Card>

          {/* Introduction */}
          <Card icon={Stethoscope} title={t('pe_basics')}>
            <div className="flex flex-col gap-4">
              <AuthField label={t('pe_headline')} placeholder={t('pe_headline_ph')} maxLength={120}
                value={basics.headline} onChange={set('headline')} hint={`${basics.headline.length}/120`} />
              <div className="grid sm:grid-cols-2 gap-4">
                <AuthField label={t('pe_practicing_since')} type="number" inputMode="numeric" min={1950} max={THIS_YEAR}
                  placeholder="2010" value={basics.practicingSince} onChange={set('practicingSince')} />
                <AuthField label={t('pe_languages')} placeholder={t('pe_languages_ph')} maxLength={120}
                  value={basics.languages} onChange={set('languages')} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <AuthField label={`${t('fees')} (৳)`} type="number" inputMode="numeric" min={0} max={100000} step={1}
                  placeholder="1000" value={basics.fees} onChange={set('fees')} />
                <AuthField label={`${t('followup_fees')} (৳)`} type="number" inputMode="numeric" min={0} max={100000} step={1}
                  placeholder="500" value={basics.followupFees} onChange={set('followupFees')} />
              </div>
              <AuthField label={t('pe_workplace')} placeholder={t('dreg_workplace_ph')} maxLength={160}
                value={basics.workplace} onChange={set('workplace')} />
              <AuthField label={t('pe_website')} optional type="url" placeholder="https://" maxLength={300}
                value={basics.website} onChange={set('website')} />
              <TextArea label={t('pe_about')} placeholder={t('pe_about_ph')} max={3000} rows={6}
                value={basics.about} onChange={set('about')} />
              <TagInput label={t('pe_expertise')} hint={t('pe_expertise_hint')} max={15} maxLen={60}
                tags={basics.clinicalExpertise} onChange={v => setBasics(b => ({ ...b, clinicalExpertise: v }))} />
              <TagInput label={t('pe_treatments')} max={30} maxLen={100}
                tags={basics.treatments} onChange={v => setBasics(b => ({ ...b, treatments: v }))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="pe-slug">{t('pe_link')}</label>
                <div className="field flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <span className="pl-3 text-sm text-gray-400 whitespace-nowrap">/dr/</span>
                  <input id="pe-slug" value={basics.slug} maxLength={60} spellCheck={false}
                    onChange={e => setBasics(b => ({ ...b, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    className="flex-1 min-w-0 text-sm outline-none bg-transparent py-2.5 pr-3" />
                </div>
              </div>
            </div>
          </Card>

          {Object.keys(KINDS).map(kind => (
            <ItemSection key={kind} kind={kind} items={profile.items[kind]} onChange={() => load()} />
          ))}
        </div>
      </div>

      {/* Save bar: appears while there are unsaved introduction edits. */}
      {Boolean(dirty || status.error || status.savedAt) && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="app-container flex items-center justify-between gap-3 py-3">
            <p className={`text-sm ${status.error ? 'text-red-600' : 'text-gray-700'}`}>
              {status.error || (dirty ? t('pe_unsaved') : t('pe_saved'))}
            </p>
            {dirty && (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setBasics(saved); setStatus({ busy: false, error: '', savedAt: 0 }); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 bg-white">{t('pe_cancel')}</button>
                <button type="button" onClick={save} disabled={status.busy}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">
                  {status.busy ? t('pe_saving') : t('pe_save')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
