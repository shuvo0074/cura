import { useState } from 'react';
import { Field, Panel, Row, uiStyles as s, useMutation, useResource } from '../../../ui';

interface Owner {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  clinics: { id: string; name: string }[];
}

const EMPTY = { clinicName: '', fullName: '', mobile: '', email: '', temporaryPassword: '' };

/** Creates a clinic and its owner together, as on Cura Website. */
export function OwnersPanel() {
  const { data, reload } = useResource<Owner[]>('/directory/admin/owners', {});
  const save = useMutation();
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const ok = await save.run('/directory/admin/owners', { method: 'POST', body: { ...form, email: form.email.trim() || null } });
    if (ok) {
      setForm(EMPTY);
      void reload();
    }
  };

  return (
    <Panel title="New clinic" description="Creates a clinic and the owner who runs it on Cura Dashboard.">
      <Row cols={2}>
        <Field label="Clinic name" required>
          <input className={s.input} value={form.clinicName} onChange={(e) => set('clinicName', e.target.value)} />
        </Field>
        <Field label="Owner's full name" required>
          <input className={s.input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Owner's mobile" required>
          <input className={s.input} value={form.mobile} placeholder="01XXXXXXXXX" onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="Owner's email">
          <input className={s.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </Row>
      <Field label="Temporary password" required hint="At least 10 characters, with upper- and lowercase letters and a number.">
        <input
          className={s.input}
          type="password"
          autoComplete="new-password"
          value={form.temporaryPassword}
          onChange={(e) => set('temporaryPassword', e.target.value)}
        />
      </Field>
      <button type="button" className={s.primary} disabled={save.busy} onClick={() => void submit()}>
        {save.busy ? 'Creating…' : 'Create clinic and owner'}
      </button>{' '}
      {save.saved && <span className={s.muted}>Created.</span>}
      {save.error && (
        <span className={s.error} role="alert">
          {save.error}
        </span>
      )}

      <h4 className={s.subtitle}>Clinic owners</h4>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email and mobile</th>
            <th>Clinics</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((owner) => (
            <tr key={owner.id}>
              <td>{owner.full_name}</td>
              <td>{[owner.email, owner.mobile].filter(Boolean).join(' · ')}</td>
              <td>{owner.clinics.map((clinic) => clinic.name).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
