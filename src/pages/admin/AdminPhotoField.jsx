import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';

// Photo picker for the doctor and hospital forms. Editing uploads straight
// away; adding keeps the chosen file in `pendingFile` until the record has
// been created (it needs an id), then the tab uploads it.
export default function AdminPhotoField({ photo, uploadPath, pendingFile, onPendingFile, onPhoto, placeholder, rounded = 'rounded-full' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : null), [pendingFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!uploadPath) { onPendingFile(file); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.upload(uploadPath, fd);
      onPhoto(res.photo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError('');
    if (!uploadPath) { onPendingFile(null); onPhoto(''); return; }
    setBusy(true);
    try {
      await api.del(uploadPath);
      onPhoto(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const shown = preview || photo;
  return (
    <div className="flex items-center gap-4">
      {shown
        ? <img src={shown} alt="" className={`w-16 h-16 ${rounded} object-cover border border-gray-200 flex-shrink-0`} />
        : <div className={`w-16 h-16 ${rounded} bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0`}>{placeholder}</div>}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-gray-500">Photo{pendingFile ? ' (uploads when you save)' : ''}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="text-xs px-3 py-1.5 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 disabled:opacity-50 transition-colors">
            {busy ? 'Uploading…' : shown ? 'Change photo' : 'Upload photo'}
          </button>
          {shown && (
            <button type="button" onClick={handleRemove} disabled={busy}
              className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              Remove
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
