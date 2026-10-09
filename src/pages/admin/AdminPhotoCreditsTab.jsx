import { useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useSiteContent } from '../../context/SiteContentContext';
import AdminImageInput from './AdminImageInput';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';
const BLANK = { file: '', caption: '', author: '', license: '', licenseUrl: '', source: '', changes: '' };

// Attribution for photos on the site (shown on the Photo credits page). CC BY
// and CC BY-SA photos must be credited; give the author, licence and source.
export default function AdminPhotoCreditsTab() {
  const site = useSiteContent();
  const [credits, setCredits] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { api.get('/admin/site-content').then(c => setCredits(c.credits)); }, []);
  if (!credits) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;

  const set = (i, patch) => { setMessage(null); setCredits(list => list.map((c, j) => (j === i ? { ...c, ...patch } : c))); };
  const q = search.trim().toLowerCase();
  const shown = credits.map((c, i) => [c, i]).filter(([c]) => !q || [c.caption, c.author, c.file].some(v => v?.toLowerCase().includes(q)));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const content = await api.put('/admin/photo-credits', credits);
      site.apply(content);
      setCredits(content.credits);
      setMessage({ text: 'Saved. The Photo credits page shows the change now.' });
    } catch (err) {
      setMessage({ error: true, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">Photo credits <span className="text-gray-400 font-normal text-base">({credits.length})</span></h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-64">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search caption or author" className="flex-1 text-sm outline-none bg-transparent" />
          </div>
          <button type="button" onClick={() => { setSearch(''); setCredits(list => [{ ...BLANK }, ...list]); }}
            className="flex items-center gap-1 text-sm font-medium text-primary border border-primary rounded-lg px-3 py-2 bg-white whitespace-nowrap">
            <Plus size={14} /> Add credit
          </button>
        </div>
      </div>

      <div className="sticky top-16 z-10 bg-white/95 backdrop-blur rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="bg-primary text-white min-h-11 px-6 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save credits'}</button>
        {message && <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {shown.map(([c, i]) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_36px] gap-3 items-start">
            <AdminImageInput value={c.file} onChange={file => set(i, { file })} label={`Credit ${i + 1} photo`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input required value={c.caption} onChange={e => set(i, { caption: e.target.value })} placeholder="Caption (what and where)" aria-label="Caption" className={INPUT} />
              <input value={c.author ?? ''} onChange={e => set(i, { author: e.target.value })} placeholder="Author (if known)" aria-label="Author" className={INPUT} />
              <input required value={c.license} onChange={e => set(i, { license: e.target.value })} placeholder="Licence, e.g. CC BY-SA 4.0" aria-label="Licence" className={INPUT} />
              <input type="url" value={c.licenseUrl ?? ''} onChange={e => set(i, { licenseUrl: e.target.value })} placeholder="Licence link" aria-label="Licence link" className={INPUT} />
              <input type="url" value={c.source ?? ''} onChange={e => set(i, { source: e.target.value })} placeholder="Source page" aria-label="Source page" className={INPUT} />
              <input value={c.changes ?? ''} onChange={e => set(i, { changes: e.target.value })} placeholder="Changes, e.g. Cropped" aria-label="Changes" className={INPUT} />
            </div>
            <button type="button" onClick={() => setCredits(list => list.filter((_, j) => j !== i))} aria-label={`Remove credit ${i + 1}`}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </form>
  );
}
