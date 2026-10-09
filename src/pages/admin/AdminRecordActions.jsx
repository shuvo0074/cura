import { useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { api } from '../../api/client';

// Hide/show and permanent delete for a doctor or hospital, shown in its edit
// form. `path` is the record's admin path, e.g. /admin/doctors/12. Delete
// asks for a second click; the server refuses it while anything still
// refers to the record and says why.
export default function AdminRecordActions({ path, hidden, label, onHiddenChange, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); } catch (err) { setError(err.message); setConfirming(false); } finally { setBusy(false); }
  }

  const toggleHidden = () => run(async () => {
    const res = await api.patch(`${path}/hidden`, { hidden: !hidden });
    onHiddenChange(res.hidden);
  });

  const remove = () => {
    if (!confirming) { setConfirming(true); return; }
    run(async () => { await api.del(path); onDeleted(); });
  };

  return (
    <div className="col-span-full rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-700">
          {hidden
            ? <><span className="font-semibold text-amber-700">Hidden.</span> Patients can't see this {label}.</>
            : <>Visible to patients.</>}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={toggleHidden} disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg font-medium bg-white hover:bg-gray-50 disabled:opacity-50">
            {hidden ? <><Eye size={14} /> Show on site</> : <><EyeOff size={14} /> Hide from site</>}
          </button>
          <button type="button" onClick={remove} disabled={busy}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50
              ${confirming ? 'bg-red-600 text-white border border-red-600' : 'border border-red-200 text-red-600 bg-white hover:bg-red-50'}`}>
            <Trash2 size={14} /> {confirming ? 'Click again to delete for good' : 'Delete'}
          </button>
        </div>
      </div>
      {confirming && !busy && (
        <p className="text-xs text-gray-500">Deleting can't be undone. Hide it instead if it might come back.
          <button type="button" onClick={() => setConfirming(false)} className="ml-2 text-primary font-medium">Cancel</button></p>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
