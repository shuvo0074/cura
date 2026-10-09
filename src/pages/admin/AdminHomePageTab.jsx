import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useSiteContent } from '../../context/SiteContentContext';
import AdminImageInput from './AdminImageInput';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';

function Card({ title, hint, onSubmit, saving, message, children }) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
      {message && <p role={message.error ? 'alert' : 'status'} className={`text-sm rounded-lg px-3 py-2 ${message.error ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="self-start bg-primary text-white min-h-11 px-6 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

const move = (list, i, by) => {
  const next = [...list];
  [next[i], next[i + by]] = [next[i + by], next[i]];
  return next;
};

// An ordered list of links to specialty or symptom pages, each with a short
// label in English and Bangla (the words patients use, e.g. "Child Specialist").
function ShortcutList({ items, onChange, pages, pageLabel }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="flex flex-col gap-2">
      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_100px] gap-2 text-xs font-medium text-gray-500">
        <span>{pageLabel} page</span><span>English label</span><span>Bangla label</span><span />
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_100px] gap-2 items-center border-b sm:border-0 pb-2 sm:pb-0">
          <select required value={item.slug} aria-label={`${pageLabel} page ${i + 1}`} className={INPUT}
            onChange={e => {
              const page = pages.find(p => p.slug === e.target.value);
              set(i, { slug: e.target.value, en: item.en || page?.name || '', bn: item.bn || page?.name_bn || '' });
            }}>
            <option value="">Choose…</option>
            {pages.map(p => <option key={p.slug} value={p.slug}>{p.name}{p.hidden ? ' (hidden)' : ''}</option>)}
          </select>
          <input required value={item.en} onChange={e => set(i, { en: e.target.value })} maxLength={40} aria-label={`English label ${i + 1}`} placeholder="English" className={INPUT} />
          <input required value={item.bn} onChange={e => set(i, { bn: e.target.value })} maxLength={40} aria-label={`Bangla label ${i + 1}`} placeholder="বাংলা" className={INPUT} />
          <div className="flex gap-1">
            <button type="button" disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label="Move up" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={15} /></button>
            <button type="button" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label="Move down" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={15} /></button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { slug: '', en: '', bn: '' }])}
        className="self-start flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5">
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

// The home page's picks, the division photos and the phone numbers shown
// across the site. Each card saves on its own and updates the site at once.
export default function AdminHomePageTab() {
  const site = useSiteContent();
  const [home, setHome] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [saving, setSaving] = useState('');
  const [messages, setMessages] = useState({});

  useEffect(() => {
    api.get('/admin/site-content').then(c => { setHome(c.home); setContacts(c.contacts); });
    api.get('/admin/specialties').then(setSpecialties);
    api.get('/admin/symptoms').then(setSymptoms);
  }, []);

  async function save(section, path, body) {
    setSaving(section);
    setMessages(m => ({ ...m, [section]: null }));
    try {
      const content = await api.put(path, body);
      site.apply(content);
      setMessages(m => ({ ...m, [section]: { text: 'Saved. The site shows the change now.' } }));
    } catch (err) {
      setMessages(m => ({ ...m, [section]: { error: true, text: err.message } }));
    } finally {
      setSaving('');
    }
  }

  if (!home || !contacts) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;
  const saveHome = section => e => { e.preventDefault(); save(section, '/admin/home-content', home); };
  const setDivision = (name, patch) => setHome(h => ({ ...h, divisions: h.divisions.map(d => (d.name === name ? { ...d, ...patch } : d)) }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-800">Home page</h2>

      <Card title="Phone numbers" saving={saving === 'contacts'} message={messages.contacts}
        hint="Used in the header, footer and emergency box. The labels around them are in Site text."
        onSubmit={e => { e.preventDefault(); save('contacts', '/admin/contacts', contacts); }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['emergency', 'Emergency (national)'], ['health_line', 'Health advice line'], ['hotline', 'Cura hotline']].map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <input required inputMode="tel" value={contacts[key]} onChange={e => setContacts(c => ({ ...c, [key]: e.target.value }))} className={INPUT} />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Popular specialties" saving={saving === 'specialties'} message={messages.specialties} onSubmit={saveHome('specialties')}
        hint="Shown as cards on the home page; the first six also appear under the search box. Up to 12.">
        <ShortcutList items={home.popular_specialties} pages={specialties} pageLabel="Specialty"
          onChange={popular_specialties => setHome(h => ({ ...h, popular_specialties }))} />
      </Card>

      <Card title="Common problems" saving={saving === 'problems'} message={messages.problems} onSubmit={saveHome('problems')}
        hint="Everyday problems in the words people use, each opening a symptom page. Up to 16.">
        <ShortcutList items={home.common_problems} pages={symptoms} pageLabel="Symptom"
          onChange={common_problems => setHome(h => ({ ...h, common_problems }))} />
      </Card>

      <Card title="Division photos" saving={saving === 'divisions'} message={messages.divisions} onSubmit={saveHome('divisions')}
        hint="One photo per division for the browse-by-location cards. Credit photos that need it in Photo credits.">
        <div className="flex flex-col gap-3">
          {home.divisions.map(d => (
            <div key={d.name} className="grid grid-cols-1 sm:grid-cols-[110px_130px_1fr] gap-2 items-start border-b border-gray-100 pb-3 last:border-0">
              <span className="text-sm font-medium text-gray-800 pt-2">{d.name}</span>
              <input required value={d.bn} onChange={e => setDivision(d.name, { bn: e.target.value })} aria-label={`${d.name} in Bangla`} className={INPUT} />
              <div className="flex flex-col gap-1.5 min-w-0">
                <AdminImageInput value={d.photo} onChange={photo => setDivision(d.name, { photo })} label={`${d.name} photo`} />
                <input value={d.alt ?? ''} onChange={e => setDivision(d.name, { alt: e.target.value })} maxLength={160} placeholder="What the photo shows (for screen readers)"
                  aria-label={`${d.name} photo description`} className={`${INPUT} text-xs`} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
