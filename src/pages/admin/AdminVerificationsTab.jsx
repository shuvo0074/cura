import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, IdCard, Check, X, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import Photo from '../../components/ui/Photo';

function when(ts) {
  return ts ? new Date(ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

// One doctor's request: who signed up, the BMDC number to check, and (for a
// claim) the existing listing they say is theirs.
function RequestCard({ v, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const d = v.details || {};
  const bmdcMismatch = v.kind === 'claim' && v.listing_bmdc_no && v.listing_bmdc_no.toUpperCase() !== v.bmdc_no;

  async function act(path, body) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/verifications/${v.id}/${path}`, body);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 text-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{d.name || v.account_name}</p>
          {d.degrees?.length > 0 && <p className="text-xs text-gray-600">{d.degrees.join(', ')}</p>}
          <p className="text-xs text-gray-500">{d.specialty}{d.designation && ` · ${d.designation}`}{d.workplace && ` · ${d.workplace}`}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
          ${v.kind === 'claim' ? 'bg-action/10 text-action' : 'bg-accent/20 text-amber-800'}`}>
          {v.kind === 'claim' ? 'Claims listing' : 'New doctor'}
        </span>
      </div>

      <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
        <IdCard size={16} className="text-primary" />
        <span className="text-xs text-gray-500">BMDC</span>
        <span className="font-mono font-semibold text-gray-900 select-all">{v.bmdc_no}</span>
      </div>

      <div className="text-xs text-gray-600 flex flex-col gap-1">
        <span className="flex items-center gap-1.5"><Mail size={12} /> {v.email}</span>
        {v.phone && <span className="flex items-center gap-1.5"><Phone size={12} /> <a href={`tel:${v.phone}`} className="hover:underline">{v.phone}</a></span>}
        <span className="text-gray-400">Submitted {when(v.submitted_at)}</span>
      </div>

      {v.kind === 'claim' && v.doctor_id && (
        <div className="border border-gray-100 rounded-lg p-2.5 flex items-center gap-3">
          <Photo src={v.listing_photo} alt={v.listing_name} iconSize={18} className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400">Existing listing</p>
            <p className="font-medium text-gray-800 truncate">{v.listing_name}</p>
            <p className="text-xs text-gray-500 truncate">{v.listing_specialty}{v.listing_hospital && ` · ${v.listing_hospital}`}</p>
          </div>
          <Link to={`/doctors/${v.doctor_id}`} target="_blank" className="text-gray-400 hover:text-action" title="Open listing">
            <ExternalLink size={14} />
          </Link>
        </div>
      )}
      {bmdcMismatch && <p className="text-xs text-red-600">Listing has BMDC {v.listing_bmdc_no}; approving replaces it.</p>}

      {v.status === 'pending' ? (
        rejecting ? (
          <div className="flex flex-col gap-2">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} autoFocus
              placeholder="Reason shown to the doctor, e.g. BMDC number doesn't match the name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(false)} disabled={busy}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600">Cancel</button>
              <button type="button" onClick={() => act('reject', { note })} disabled={busy || note.trim().length < 5}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-50">Reject</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setRejecting(true)} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
              <X size={13} /> Reject
            </button>
            <button type="button" onClick={() => act('approve')} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white disabled:opacity-50">
              <Check size={13} /> Approve
            </button>
          </div>
        )
      ) : (
        <p className="text-xs text-gray-500">
          {v.status === 'approved' ? 'Approved' : 'Rejected'} {when(v.reviewed_at)}{v.reviewed_by_name && ` by ${v.reviewed_by_name}`}
          {v.review_note && <span className="block mt-0.5 text-gray-600">“{v.review_note}”</span>}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function AdminVerificationsTab() {
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState(null);

  const load = useCallback(() => {
    api.get(`/admin/verifications?status=${status}`).then(setRequests).catch(() => setRequests([]));
  }, [status]);

  useEffect(load, [load]);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        Check each BMDC number against the doctor&apos;s name before approving. Approving shows the
        &ldquo;BMDC verified&rdquo; badge publicly and gives the account access to that listing&apos;s appointments.
      </p>
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize
              ${status === s ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {requests?.length === 0 && <p className="text-center text-gray-400 py-10 col-span-full">No {status} requests.</p>}
        {requests?.map(v => <RequestCard key={v.id} v={v} onDone={load} />)}
      </div>
    </div>
  );
}
