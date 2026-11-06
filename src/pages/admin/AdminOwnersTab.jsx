import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

const EMPTY = { fullName: '', clinicName: '', mobile: '', email: '', temporaryPassword: '' };
const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
      {label}
      {children}
    </label>
  );
}

// Super admin only: create a clinic and its owner, and grant owner roles.
export default function AdminOwnersTab() {
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [role, setRole] = useState({ identifier: '', role: 'ambulance_owner' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/admin/owners').then(setOwners).catch(err => setError(err.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function run(action, done) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(done);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createOwner(e) {
    e.preventDefault();
    if (await run(() => api.post('/admin/owners', form), `${form.clinicName} and its owner were created.`)) setForm(EMPTY);
  }

  async function changeRole(path, done) {
    if (await run(() => api.post(path, role), done)) setRole(r => ({ ...r, identifier: '' }));
  }

  return (
    <div className="flex flex-col gap-4">
      {message && <p role="status" className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <form onSubmit={createOwner} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">New clinic and owner</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Clinic name"><input className={inputClass} value={form.clinicName} onChange={set('clinicName')} required /></Field>
          <Field label="Owner's full name"><input className={inputClass} value={form.fullName} onChange={set('fullName')} required /></Field>
          <Field label="Owner's mobile"><input className={inputClass} value={form.mobile} onChange={set('mobile')} placeholder="01XXXXXXXXX" required /></Field>
          <Field label="Owner's email (optional)"><input className={inputClass} type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Temporary password"><input className={inputClass} type="password" autoComplete="new-password" value={form.temporaryPassword} onChange={set('temporaryPassword')} required /></Field>
        </div>
        <button type="submit" disabled={busy} className="self-start px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">Create</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">Ambulance, pharmacy and hospital owners</h2>
        <p className="text-xs text-gray-500">To link a hospital to its owner, use Cura Dashboard: Super Admin, then Users and roles.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Account's email or mobile">
            <input className={inputClass} value={role.identifier} onChange={e => setRole(r => ({ ...r, identifier: e.target.value }))} />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={role.role} onChange={e => setRole(r => ({ ...r, role: e.target.value }))}>
              <option value="ambulance_owner">Ambulance owner</option>
              <option value="pharmacy_owner">Pharmacy owner</option>
              <option value="hospital_owner">Hospital owner</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy || !role.identifier} onClick={() => changeRole('/admin/roles', 'Role granted.')}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-50">Grant</button>
          <button type="button" disabled={busy || !role.identifier} onClick={() => changeRole('/admin/roles/revoke', 'Role removed.')}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 disabled:opacity-50">Remove</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Clinic owners</h2>
        {owners.length === 0 && <p className="text-sm text-gray-500">No clinic owners yet.</p>}
        <ul className="flex flex-col divide-y divide-gray-100">
          {owners.map(owner => (
            <li key={owner.id} className="py-2 text-sm">
              <p className="font-medium text-gray-900">{owner.full_name}</p>
              <p className="text-xs text-gray-500">
                {[owner.mobile, owner.email, owner.clinics.map(c => c.name).join(', ')].filter(Boolean).join(' · ')}
              </p>
              {owner.roles?.length > 0 && <p className="text-xs text-action mt-0.5">Also: {owner.roles.join(', ').replace(/_/g, ' ')}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
