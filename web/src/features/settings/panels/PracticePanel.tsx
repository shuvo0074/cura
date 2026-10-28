import { useState } from 'react';
import {
  Failed,
  Field,
  Loading,
  Panel,
  Row,
  SaveBar,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';

import { SessionSummary } from './SessionSummary';
import { TimingsModal } from './TimingsModal';
import { Practice, SPECIALIZATIONS } from './practice-shared';

export function PracticePanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading, reload } = useResource<Practice>('/settings/practice', { practiceId });
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<Practice>>({});
  const [timingsOpen, setTimingsOpen] = useState(false);

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const value = { ...data, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const set = <K extends keyof Practice>(k: K, v: Practice[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    const ok = await save.run('/settings/practice', {
      method: 'PUT',
      body: { practiceId, ...draft },
    });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  return (
    <Panel title="Practice Details" description="Appears on prescriptions, invoices and patient SMS.">
      <div className={s.logoRow}>
        <div className={s.logo} aria-hidden="true">
          {value.logoUrl ? <img src={value.logoUrl} alt="" /> : <span>Add Logo</span>}
        </div>
        <Field label="Logo URL" hint="Placed on the header of every printout for this clinic.">
          <input
            className={s.input}
            value={value.logoUrl ?? ''}
            onChange={(e) => set('logoUrl', e.target.value || null)}
            placeholder="https://…/logo.png"
          />
        </Field>
      </div>

      <Row>
        <Field label="Clinic Name" required>
          <input className={s.input} value={value.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Specialization" required>
          <select
            className={s.input}
            value={value.specialization ?? ''}
            onChange={(e) => set('specialization', e.target.value || null)}
          >
            <option value="">Select…</option>
            {SPECIALIZATIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field label="BIN" hint="Business Identification Number, printed on invoices.">
          <input
            className={s.input}
            value={value.binNumber ?? ''}
            onChange={(e) => set('binNumber', e.target.value || null)}
          />
        </Field>
      </Row>

      <Row>
        <Field label="Contact Number" required>
          <input
            className={s.input}
            value={value.contactNumber ?? ''}
            onChange={(e) => set('contactNumber', e.target.value || null)}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="Email">
          <input
            className={s.input}
            type="email"
            value={value.email ?? ''}
            onChange={(e) => set('email', e.target.value || null)}
          />
        </Field>
        <Field label="Website">
          <input
            className={s.input}
            value={value.website ?? ''}
            onChange={(e) => set('website', e.target.value || null)}
            placeholder="https://"
          />
        </Field>
      </Row>

      <h3 className={s.subtitle}>Address</h3>
      <Row cols={2}>
        <Field label="Address line 1" required>
          <input
            className={s.input}
            value={value.addressLine1 ?? ''}
            onChange={(e) => set('addressLine1', e.target.value || null)}
          />
        </Field>
        <Field label="Locality / Area">
          <input
            className={s.input}
            value={value.locality ?? ''}
            onChange={(e) => set('locality', e.target.value || null)}
          />
        </Field>
      </Row>
      <Row>
        <Field label="City / District">
          <input className={s.input} value={value.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
        </Field>
        <Field label="Country">
          <input className={s.input} value={value.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label="Post code">
          <input
            className={s.input}
            value={value.postCode ?? ''}
            onChange={(e) => set('postCode', e.target.value || null)}
          />
        </Field>
      </Row>
      <Row cols={2}>
        <Field label="Google Maps link" hint="Included in the appointment confirmation SMS.">
          <input
            className={s.input}
            value={value.mapsUrl ?? ''}
            onChange={(e) => set('mapsUrl', e.target.value || null)}
            placeholder="https://maps.app.goo.gl/…"
          />
        </Field>
        <Field label="Room number">
          <input
            className={s.input}
            value={value.roomNumber ?? ''}
            onChange={(e) => set('roomNumber', e.target.value || null)}
          />
        </Field>
      </Row>

      <div className={s.sectionHead}>
        <h3 className={s.subtitle}>Practice timings</h3>
        <button type="button" className={s.secondary} onClick={() => setTimingsOpen(true)}>
          Edit Practice Timings
        </button>
      </div>
      <SessionSummary sessions={data.sessions} />

      <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />

      {timingsOpen && (
        <TimingsModal
          practiceId={practiceId}
          sessions={data.sessions}
          onClose={() => setTimingsOpen(false)}
          onSaved={() => {
            setTimingsOpen(false);
            void reload();
          }}
        />
      )}
    </Panel>
  );
}
