import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import {
  CLINIC_ROLE_LABELS,
  GRANTABLE_ROLES,
  ROLE_LABELS,
  type AdminClinic,
  type AdminUser,
  type ClinicRole,
} from './admin-types';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'super_admin', label: 'Super admins' },
  { value: 'ADMINISTRATOR', label: 'Clinic owners' },
  { value: 'DOCTOR', label: 'Doctors' },
  { value: 'DESK_STAFF', label: 'Clinic staff' },
  { value: 'ambulance_owner', label: 'Ambulance owners' },
  { value: 'pharmacy_owner', label: 'Pharmacy owners' },
  { value: 'patient', label: 'Patients' },
];

const PAGE_SIZE = 50;

export function rolesSummary(user: AdminUser): string {
  const parts = [
    ...(user.clinic_role ? [CLINIC_ROLE_LABELS[user.clinic_role]] : []),
    ...user.roles.filter((role) => role !== 'doctor').map((role) => ROLE_LABELS[role] ?? role),
  ];
  return parts.join(', ') || 'No role';
}

/** Every account: find one, then edit its details, roles and clinic access. */
export function UsersPanel() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useResource<{ items: AdminUser[]; total: number }>('/directory/admin/users', {
    q: search,
    role,
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Panel
      title="Users and roles"
      description="Give anyone any role, change it, or take it away. Changing someone's roles logs them out."
      action={
        <button type="button" className={s.primary} onClick={() => setCreating(true)}>
          New account
        </button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(query.trim());
        }}
      >
        <Row cols={2}>
          <Field label="Search by name, email or mobile">
            <input className={s.input} value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Field label="Role">
            <select
              className={s.input}
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value);
              }}
            >
              {FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>
      </form>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <Failed message={error} />
      ) : (
        <>
          <p className={s.muted}>{data?.total === 1 ? '1 account' : `${data?.total ?? 0} accounts`}</p>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email and mobile</th>
                <th>Roles</th>
                <th>Clinics</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{[user.email, user.mobile].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{rolesSummary(user)}</td>
                  <td>{user.clinics.map((clinic) => clinic.name).join(', ') || '—'}</td>
                  <td>{!user.is_active ? 'Deactivated' : user.has_login ? 'Active' : 'No login yet'}</td>
                  <td>
                    <button type="button" className={s.linkButton} onClick={() => setOpenId(user.id)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <p className={s.muted}>
              <button type="button" className={s.linkButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>{' '}
              Page {page} of {pages}{' '}
              <button type="button" className={s.linkButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </p>
          )}
        </>
      )}

      {openId && (
        <UserModal
          userId={openId}
          onClose={() => {
            setOpenId(null);
            void reload();
          }}
        />
      )}
      {creating && (
        <NewUserModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            void reload();
            setOpenId(id);
          }}
        />
      )}
    </Panel>
  );
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { http } = useServices();
  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', temporaryPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await http.request<AdminUser>('/directory/admin/users', {
      method: 'POST',
      body: { ...form, email: form.email.trim() || null, mobile: form.mobile.trim() || null },
      retry: false,
    });
    setBusy(false);
    if (result.ok) onCreated(result.value.id);
    else setError(result.error.message);
  };

  return (
    <Modal
      title="New account"
      onClose={onClose}
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {error}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <p className={s.muted}>The account starts with no role. Give it roles once it exists.</p>
      <Field label="Full name" required>
        <input className={s.input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label="Email">
          <input className={s.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <input className={s.input} value={form.mobile} placeholder="01XXXXXXXXX" onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
      </Row>
      <Field label="Temporary password" required hint="At least 10 characters, with upper- and lowercase letters and a number.">
        <input
          className={s.input}
          type="password"
          autoComplete="new-password"
          value={form.temporaryPassword}
          onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
        />
      </Field>
    </Modal>
  );
}

function UserModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const path = `/directory/admin/users/${userId}`;
  const { data: user, error, loading, setData } = useResource<AdminUser>(path, {});

  return (
    <Modal title={user ? user.full_name : 'Account'} onClose={onClose} wide>
      {loading && !user ? (
        <Loading />
      ) : error || !user ? (
        <Failed message={error ?? 'Not found'} />
      ) : (
        <>
          <DetailsSection user={user} path={path} onSaved={setData} />
          <RolesSection user={user} path={path} onSaved={setData} />
          <ClinicAccessSection user={user} path={path} onSaved={setData} />
          <BusinessesSection user={user} path={path} onSaved={setData} />
          <PasswordSection path={path} />
        </>
      )}
    </Modal>
  );
}

type Saved = (user: AdminUser) => void;

function DetailsSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { http } = useServices();
  const [form, setForm] = useState({ fullName: user.full_name, email: user.email ?? '', mobile: user.mobile ?? '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    const result = await http.request<AdminUser>(path, { method: 'PATCH', body, retry: false });
    setBusy(false);
    if (result.ok) {
      onSaved(result.value);
      setMessage(done);
    } else {
      setMessage(result.error.message);
    }
  };

  return (
    <>
      <h4 className={s.subtitle}>Details</h4>
      <Row cols={2}>
        <Field label="Full name">
          <input className={s.input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Status">
          <span>
            {user.is_active ? 'Active' : 'Deactivated'}{' '}
            <button
              type="button"
              className={user.is_active ? s.linkDanger : s.linkButton}
              disabled={busy}
              onClick={() => void patch({ isActive: !user.is_active }, user.is_active ? 'Deactivated.' : 'Activated.')}
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </span>
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Email">
          <input className={s.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Mobile">
          <input className={s.input} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
      </Row>
      <button
        type="button"
        className={s.secondary}
        disabled={busy}
        onClick={() =>
          void patch(
            { fullName: form.fullName, email: form.email.trim() || null, mobile: form.mobile.trim() || null },
            'Details saved.',
          )
        }
      >
        Save details
      </button>{' '}
      {message && <span className={s.muted}>{message}</span>}
    </>
  );
}

function RolesSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { http } = useServices();
  const [error, setError] = useState<string | null>(null);

  const toggle = async (role: string, on: boolean) => {
    setError(null);
    const result = await http.request<AdminUser>(`${path}/roles/${role}`, { method: on ? 'PUT' : 'DELETE', retry: false });
    if (result.ok) onSaved(result.value);
    else setError(result.error.message);
  };

  return (
    <>
      <h4 className={s.subtitle}>Roles</h4>
      {GRANTABLE_ROLES.map((role) => (
        <Check
          key={role}
          label={ROLE_LABELS[role] ?? role}
          checked={user.roles.includes(role)}
          onChange={(on) => void toggle(role, on)}
        />
      ))}
      {user.roles.includes('doctor') && <p className={s.muted}>Doctor on Cura Website: set by the clinic access below.</p>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function ClinicAccessSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { data: clinics } = useResource<AdminClinic[]>('/directory/admin/clinics', {});
  const save = useMutation();
  const { http } = useServices();
  const [role, setRole] = useState<ClinicRole | ''>(user.clinic_role ?? '');
  const [chosen, setChosen] = useState<string[]>(user.clinics.map((clinic) => clinic.id));
  const [specialty, setSpecialty] = useState(user.doctor?.specialty ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await http.request<AdminUser>(`${path}/clinic-access`, {
      method: 'PUT',
      body: { role: role || null, practiceIds: role ? chosen : [], specialty: specialty.trim() || null },
      retry: false,
    });
    if (result.ok) onSaved(result.value);
    else setError(result.error.message);
  };

  return (
    <>
      <h4 className={s.subtitle}>Clinic access</h4>
      <Row cols={2}>
        <Field label="Access level">
          <select className={s.input} value={role} onChange={(e) => setRole(e.target.value as ClinicRole | '')}>
            <option value="">None</option>
            {(Object.keys(CLINIC_ROLE_LABELS) as ClinicRole[]).map((value) => (
              <option key={value} value={value}>
                {CLINIC_ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        {role === 'DOCTOR' && (
          <Field label="Specialty" hint="Shown to patients on Cura Website.">
            <input className={s.input} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
        )}
      </Row>
      {role && (
        <>
          <p className={s.muted}>Clinics</p>
          {(clinics ?? []).map((clinic) => (
            <Check
              key={clinic.id}
              label={clinic.name}
              checked={chosen.includes(clinic.id)}
              onChange={(on) => setChosen(on ? [...chosen, clinic.id] : chosen.filter((id) => id !== clinic.id))}
            />
          ))}
        </>
      )}
      <button type="button" className={s.secondary} disabled={save.busy} onClick={() => void submit()}>
        Save clinic access
      </button>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function BusinessesSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { http } = useServices();
  const { data: vendors, reload } = useResource<{ id: string; name: string; owner_id: string | null }[]>(
    '/directory/admin/ambulances',
    {},
  );
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setOwner = async (vendorId: string, ownerId: string | null) => {
    setError(null);
    const result = await http.request(`/directory/admin/ambulances/${vendorId}/owner`, {
      method: 'PUT',
      body: { owner_id: ownerId },
      retry: false,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const fresh = await http.request<AdminUser>(path, {});
    if (fresh.ok) onSaved(fresh.value);
    setPick('');
    void reload();
  };

  const free = (vendors ?? []).filter((vendor) => vendor.owner_id !== user.id);
  return (
    <>
      <h4 className={s.subtitle}>Businesses</h4>
      <p className={s.muted}>
        Ambulance services: {(user.ambulances ?? []).length === 0 && 'none'}
      </p>
      {(user.ambulances ?? []).map((vendor) => (
        <p key={vendor.id}>
          {vendor.name}{' '}
          <button type="button" className={s.linkDanger} onClick={() => void setOwner(vendor.id, null)}>
            Unlink
          </button>
        </p>
      ))}
      <Row cols={2}>
        <Field label="Link an ambulance service" hint="Gives them the ambulance owner role if they lack it.">
          <select className={s.input} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose…</option>
            {free.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
                {vendor.owner_id ? ' (has an owner)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label=" ">
          <button type="button" className={s.secondary} disabled={!pick} onClick={() => void setOwner(pick, user.id)}>
            Link
          </button>
        </Field>
      </Row>
      <p className={s.muted}>
        Pharmacies: {(user.pharmacies ?? []).map((item) => item.name).join(', ') || 'none'}. Manage them under Pharmacies.
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function PasswordSection({ path }: { path: string }) {
  const save = useMutation();
  const [password, setPassword] = useState('');
  return (
    <>
      <h4 className={s.subtitle}>Password</h4>
      <Row cols={2}>
        <Field label="New temporary password" hint="Logs them out everywhere.">
          <input className={s.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label=" ">
          <button
            type="button"
            className={s.secondary}
            disabled={!password || save.busy}
            onClick={() =>
              void save.run(`${path}/password`, { method: 'POST', body: { temporaryPassword: password } }).then((ok) => {
                if (ok) setPassword('');
              })
            }
          >
            Reset password
          </button>
        </Field>
      </Row>
      {save.saved && <p className={s.muted}>Password reset.</p>}
      {save.error && (
        <p className={s.error} role="alert">
          {save.error}
        </p>
      )}
    </>
  );
}
