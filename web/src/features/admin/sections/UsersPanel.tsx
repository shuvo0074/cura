import { useState } from 'react';
import { useServices } from '../../../app/services';
import { useT, type TranslationKey, type UseT } from '../../../i18n';
import { Check, Failed, Field, Loading, Modal, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';
import {
  CLINIC_ROLE_LABELS,
  GRANTABLE_ROLES,
  ROLE_LABELS,
  type AdminClinic,
  type AdminUser,
  type ClinicRole,
} from './admin-types';

const FILTERS: { value: string; label: TranslationKey }[] = [
  { value: '', label: 'admin.users.filter.everyone' },
  { value: 'super_admin', label: 'admin.users.filter.superAdmins' },
  { value: 'ADMINISTRATOR', label: 'admin.users.filter.clinicOwners' },
  { value: 'DOCTOR', label: 'admin.users.filter.doctors' },
  { value: 'DESK_STAFF', label: 'admin.users.filter.clinicStaff' },
  { value: 'ambulance_owner', label: 'admin.users.filter.ambulanceOwners' },
  { value: 'pharmacy_owner', label: 'admin.users.filter.pharmacyOwners' },
  { value: 'hospital_owner', label: 'admin.users.filter.hospitalOwners' },
  { value: 'patient', label: 'admin.users.filter.patients' },
];

const PAGE_SIZE = 50;

/** A clinic access level's name in the current language. */
const clinicRoleLabel = (t: UseT['t'], role: ClinicRole): string =>
  role in CLINIC_ROLE_LABELS ? t(`admin.clinicRole.${role}`) : role;

/** A Cura-wide role's name in the current language; an unknown role is shown as it is. */
const roleLabel = (t: UseT['t'], role: string): string =>
  ROLE_LABELS[role] ? t(`admin.role.${role}` as TranslationKey) : role;

export function rolesSummary(t: UseT['t'], user: AdminUser): string {
  const parts = [
    ...(user.clinic_role ? [clinicRoleLabel(t, user.clinic_role)] : []),
    ...user.roles.filter((role) => role !== 'doctor').map((role) => roleLabel(t, role)),
  ];
  return parts.join(', ') || t('admin.users.noRole');
}

/** Every account: find one, then edit its details, roles and clinic access. */
export function UsersPanel() {
  const { t } = useT();
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
      title={t('admin.users.title')}
      description={t('admin.users.description')}
      action={
        <button type="button" className={s.primary} onClick={() => setCreating(true)}>
          {t('admin.users.newAccount')}
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
          <Field label={t('admin.users.search')}>
            <input className={s.input} value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Field label={t('admin.users.role')}>
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
                  {t(filter.label)}
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
          <p className={s.muted}>{t('admin.users.accounts', { count: data?.total ?? 0 })}</p>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('admin.users.col.name')}</th>
                <th>{t('admin.users.col.contact')}</th>
                <th>{t('admin.users.col.roles')}</th>
                <th>{t('admin.users.col.clinics')}</th>
                <th>{t('admin.users.col.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{[user.email, user.mobile].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{rolesSummary(t, user)}</td>
                  <td>{user.clinics.map((clinic) => clinic.name).join(', ') || '—'}</td>
                  <td>
                    {!user.is_active
                      ? t('admin.users.status.deactivated')
                      : user.has_login
                        ? t('admin.users.status.active')
                        : t('admin.users.status.noLogin')}
                  </td>
                  <td>
                    <button type="button" className={s.linkButton} onClick={() => setOpenId(user.id)}>
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <p className={s.muted}>
              <button type="button" className={s.linkButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('admin.users.previous')}
              </button>{' '}
              {t('admin.users.pageOf', { page, pages })}{' '}
              <button type="button" className={s.linkButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t('admin.users.next')}
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
  const { t, tm } = useT();
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
      title={t('admin.users.newAccount')}
      onClose={onClose}
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? t('admin.users.creating') : t('admin.users.create')}
          </button>
        </>
      }
    >
      <p className={s.muted}>{t('admin.users.newAccountNote')}</p>
      <Field label={t('admin.users.fullName')} required>
        <input className={s.input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </Field>
      <Row cols={2}>
        <Field label={t('admin.users.email')}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('admin.users.mobile')}>
          <input className={s.input} value={form.mobile} placeholder="01XXXXXXXXX" onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
      </Row>
      <Field label={t('admin.users.temporaryPassword')} required hint={t('admin.users.passwordHint')}>
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
  const { t } = useT();

  return (
    <Modal title={user ? user.full_name : t('admin.users.account')} onClose={onClose} wide>
      {loading && !user ? (
        <Loading />
      ) : error || !user ? (
        <Failed message={error ?? t('admin.users.notFound')} />
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
  const { t, tm } = useT();
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
      setMessage(tm(result.error.message));
    }
  };

  return (
    <>
      <h4 className={s.subtitle}>{t('admin.users.details')}</h4>
      <Row cols={2}>
        <Field label={t('admin.users.fullName')}>
          <input className={s.input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label={t('admin.users.col.status')}>
          <span>
            {user.is_active ? t('admin.users.status.active') : t('admin.users.status.deactivated')}{' '}
            <button
              type="button"
              className={user.is_active ? s.linkDanger : s.linkButton}
              disabled={busy}
              onClick={() =>
                void patch(
                  { isActive: !user.is_active },
                  user.is_active ? t('admin.users.deactivatedDone') : t('admin.users.activatedDone'),
                )
              }
            >
              {user.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
            </button>
          </span>
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('admin.users.email')}>
          <input className={s.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('admin.users.mobile')}>
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
            t('admin.users.detailsSaved'),
          )
        }
      >
        {t('admin.users.saveDetails')}
      </button>{' '}
      {message && <span className={s.muted}>{message}</span>}
    </>
  );
}

function RolesSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { t, tm } = useT();
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
      <h4 className={s.subtitle}>{t('admin.users.col.roles')}</h4>
      {GRANTABLE_ROLES.map((role) => (
        <Check
          key={role}
          label={roleLabel(t, role)}
          checked={user.roles.includes(role)}
          onChange={(on) => void toggle(role, on)}
        />
      ))}
      {user.roles.includes('doctor') && <p className={s.muted}>{t('admin.users.doctorRoleNote')}</p>}
      {error && (
        <p className={s.error} role="alert">
          {tm(error)}
        </p>
      )}
    </>
  );
}

function ClinicAccessSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { data: clinics } = useResource<AdminClinic[]>('/directory/admin/clinics', {});
  const { t, tm } = useT();
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
      <h4 className={s.subtitle}>{t('admin.users.clinicAccess')}</h4>
      <Row cols={2}>
        <Field label={t('admin.users.accessLevel')}>
          <select className={s.input} value={role} onChange={(e) => setRole(e.target.value as ClinicRole | '')}>
            <option value="">{t('admin.users.none')}</option>
            {(Object.keys(CLINIC_ROLE_LABELS) as ClinicRole[]).map((value) => (
              <option key={value} value={value}>
                {clinicRoleLabel(t, value)}
              </option>
            ))}
          </select>
        </Field>
        {role === 'DOCTOR' && (
          <Field label={t('admin.users.specialty')} hint={t('admin.users.specialtyHint')}>
            <input className={s.input} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </Field>
        )}
      </Row>
      {role && (
        <>
          <p className={s.muted}>{t('admin.users.col.clinics')}</p>
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
        {t('admin.users.saveClinicAccess')}
      </button>
      {error && (
        <p className={s.error} role="alert">
          {tm(error)}
        </p>
      )}
    </>
  );
}

function BusinessesSection({ user, path, onSaved }: { user: AdminUser; path: string; onSaved: Saved }) {
  const { t } = useT();
  const { http } = useServices();
  const refresh = async () => {
    const fresh = await http.request<AdminUser>(path, {});
    if (fresh.ok) onSaved(fresh.value);
  };

  return (
    <>
      <h4 className={s.subtitle}>{t('admin.users.businesses')}</h4>
      <LinkedPlaces
        userId={user.id}
        linked={user.ambulances ?? []}
        title={t('admin.users.ambulanceServices')}
        listPath="/directory/admin/ambulances"
        ownerPath={(id) => `/directory/admin/ambulances/${id}/owner`}
        pickLabel={t('admin.users.linkAmbulance')}
        hint={t('admin.users.linkAmbulanceHint')}
        onChanged={refresh}
      />
      <LinkedPlaces
        userId={user.id}
        linked={user.hospitals ?? []}
        title={t('admin.users.hospitals')}
        listPath="/directory/admin/hospitals"
        ownerPath={(id) => `/directory/admin/hospitals/${id}/owner`}
        pickLabel={t('admin.users.linkHospital')}
        hint={t('admin.users.linkHospitalHint')}
        onChanged={refresh}
      />
      <p className={s.muted}>
        {t('admin.users.pharmacies', {
          names: (user.pharmacies ?? []).map((item) => item.name).join(', ') || t('admin.users.noneLower'),
        })}
      </p>
    </>
  );
}

/** Places linked to this account, and a picker to link one more. */
function LinkedPlaces({
  userId,
  linked,
  title,
  listPath,
  ownerPath,
  pickLabel,
  hint,
  onChanged,
}: {
  userId: string;
  linked: readonly { id: string; name: string }[];
  title: string;
  listPath: string;
  ownerPath: (id: string) => string;
  pickLabel: string;
  hint: string;
  onChanged: () => Promise<void>;
}) {
  const { t, tm } = useT();
  const { http } = useServices();
  const { data: places, reload } = useResource<{ id: string; name: string; owner_id: string | null }[]>(listPath, {});
  const [pick, setPick] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setOwner = async (placeId: string, ownerId: string | null) => {
    setError(null);
    const result = await http.request(ownerPath(placeId), { method: 'PUT', body: { owner_id: ownerId }, retry: false });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await onChanged();
    setPick('');
    void reload();
  };

  const free = (places ?? []).filter((place) => place.owner_id !== userId);
  return (
    <>
      <p className={s.muted}>
        {title}: {linked.length === 0 && t('admin.users.noneLower')}
      </p>
      {linked.map((place) => (
        <p key={place.id}>
          {place.name}{' '}
          <button type="button" className={s.linkDanger} onClick={() => void setOwner(place.id, null)}>
            {t('admin.users.unlink')}
          </button>
        </p>
      ))}
      <Row cols={2}>
        <Field label={pickLabel} hint={hint}>
          <select className={s.input} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{t('admin.users.choose')}</option>
            {free.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
                {place.owner_id ? ` ${t('admin.users.hasOwner')}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label=" ">
          <button type="button" className={s.secondary} disabled={!pick} onClick={() => void setOwner(pick, userId)}>
            {t('admin.users.link')}
          </button>
        </Field>
      </Row>
      {error && (
        <p className={s.error} role="alert">
          {tm(error)}
        </p>
      )}
    </>
  );
}

function PasswordSection({ path }: { path: string }) {
  const { t, tm } = useT();
  const save = useMutation();
  const [password, setPassword] = useState('');
  return (
    <>
      <h4 className={s.subtitle}>{t('admin.users.password')}</h4>
      <Row cols={2}>
        <Field label={t('admin.users.newTemporaryPassword')} hint={t('admin.users.newPasswordHint')}>
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
            {t('admin.users.resetPassword')}
          </button>
        </Field>
      </Row>
      {save.saved && <p className={s.muted}>{t('admin.users.passwordResetDone')}</p>}
      {save.error && (
        <p className={s.error} role="alert">
          {tm(save.error)}
        </p>
      )}
    </>
  );
}
