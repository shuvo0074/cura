import { useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { api } from '../../api/client';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';

// An image for site content: upload a file or paste a link. `value` is the
// image's address (an uploaded /api/directory/media/… path, a /landing/… file or a
// web address).
export default function AdminImageInput({ value, onChange, label = 'Photo' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      onChange((await api.upload('/admin/site-images', fd)).url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 min-w-0">
      {value
        ? <img src={value} alt="" className="w-16 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
        : <span className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><ImageIcon size={18} className="text-gray-300" /></span>}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="Image link or uploaded file" aria-label={`${label} address`}
            className={`${INPUT} flex-1 min-w-0 text-xs`} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="text-xs px-3 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 disabled:opacity-50 whitespace-nowrap">
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      </div>
    </div>
  );
}
