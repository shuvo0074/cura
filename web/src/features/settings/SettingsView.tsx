import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import styles from './settings.module.css';

type Tab = 'practice' | 'staff' | 'drugs' | 'catalog' | 'pricing' | 'communications';

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'practice', label: 'Practice details' },
  { key: 'staff', label: 'Practice staff' },
  { key: 'drugs', label: 'Drug catalog' },
  { key: 'catalog', label: 'Clinical notes' },
  { key: 'pricing', label: 'Pricing catalog' },
  { key: 'communications', label: 'Communications' },
];

/**
 * Settings module (spec: secondary navigation with sub-modules).
 *
 * Each tab reads and writes the real endpoints. The sub-modules the API does
 * not expose a UI for yet (consent forms, charting templates, printouts, data
 * security, premium) are named at the bottom rather than omitted, so the gap is
 * visible instead of being mistaken for "not built at all".
 */
export function SettingsView({ practiceId }: { practiceId: string }) {
  const [tab, setTab] = useState<Tab>('practice');

  return (
    <div className={styles.shell}>
      <nav className={styles.tabs} aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            data-active={tab === t.key || undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <p className={styles.notBuilt}>
          Consent forms, charting templates, printouts, data security and premium
          exist as API endpoints but have no screen yet.
        </p>
      </nav>

      <section className={styles.panel}>
        {tab === 'practice' && <PracticePanel practiceId={practiceId} />}
        {tab === 'staff' && <StaffPanel practiceId={practiceId} />}
        {tab === 'drugs' && <DrugPanel practiceId={practiceId} />}
        {tab === 'catalog' && <CatalogPanel practiceId={practiceId} />}
        {tab === 'pricing' && <PricingPanel practiceId={practiceId} />}
        {tab === 'communications' && <CommunicationsPanel practiceId={practiceId} />}
      </section>
    </div>
  );
}

/** Shared fetch helper — every panel loads once and reports its own error. */
function usePanelData<T>(path: string, query: Record<string, string>) {
  const { http } = useServices();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await http.request<T>(path, { query });
    setLoading(false);
    if (result.ok) {
      setData(result.value);
      setError(null);
    } else {
      setError(result.error.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [http, path, JSON.stringify(query)]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

function PracticePanel({ practiceId }: { practiceId: string }) {
  const { data, error, loading } = usePanelData<{
    name: string;
    specialization: string | null;
    contactNumber: string | null;
    address: string | null;
    slotMinutes: number;
    sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  }>('/settings/practice', { practiceId });

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!data) return null;

  return (
    <>
      <h2 className={styles.title}>Practice details</h2>
      <dl className={styles.definitions}>
        <dt>Clinic name</dt>
        <dd>{data.name}</dd>
        <dt>Specialization</dt>
        <dd>{data.specialization ?? '—'}</dd>
        <dt>Contact</dt>
        <dd>{data.contactNumber ?? '—'}</dd>
        <dt>Address</dt>
        <dd>{data.address ?? '—'}</dd>
        <dt>Slot duration</dt>
        <dd>{data.slotMinutes} minutes</dd>
      </dl>

      <h3 className={styles.subtitle}>Weekly sessions</h3>
      {data.sessions.length === 0 ? (
        <p className={styles.muted}>No sessions configured.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Day</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s, i) => (
              <tr key={i}>
                <td>{DAYS[s.dayOfWeek]}</td>
                <td>{s.startTime}</td>
                <td>{s.endTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function StaffPanel({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const { data, error, loading, reload } = usePanelData<
    Array<{ userId: string; fullName: string; role: string; isActive: boolean; mobile: string | null }>
  >('/settings/staff', { practiceId });

  const toggle = async (userId: string, isActive: boolean) => {
    await http.request(`/settings/staff/${userId}/access`, {
      method: 'PUT',
      body: { practiceId, isActive },
      retry: false,
    });
    await reload();
  };

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <>
      <h2 className={styles.title}>Practice staff</h2>
      <p className={styles.hint}>
        Switching access off ends the member&rsquo;s active sessions immediately.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Mobile</th>
            <th>Access</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((s) => (
            <tr key={s.userId}>
              <td>{s.fullName}</td>
              <td>{s.role.replace('_', ' ').toLowerCase()}</td>
              <td>{s.mobile ?? '—'}</td>
              <td>
                <button
                  type="button"
                  className={styles.toggle}
                  data-on={s.isActive || undefined}
                  onClick={() => void toggle(s.userId, !s.isActive)}
                >
                  {s.isActive ? 'Active' : 'Disabled'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DrugPanel({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const [term, setTerm] = useState('a');
  const [rows, setRows] = useState<Array<{ id: string; name: string; strength: string | null; form: string | null }>>([]);
  const [name, setName] = useState('');

  const search = useCallback(
    async (q: string) => {
      const result = await http.request<typeof rows>('/settings/drugs', {
        query: { practiceId, q: q || 'a' },
      });
      if (result.ok) setRows(result.value);
    },
    [http, practiceId],
  );

  useEffect(() => {
    void search(term);
  }, [term, search]);

  const add = async () => {
    if (!name.trim()) return;
    await http.request('/settings/drugs', {
      method: 'POST',
      body: { practiceId, name: name.trim() },
      retry: false,
    });
    setName('');
    await search(term);
  };

  return (
    <>
      <h2 className={styles.title}>Drug catalog</h2>
      <p className={styles.hint}>Feeds the prescription auto-suggest.</p>

      <div className={styles.inlineForm}>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a drug (e.g. Napa 500mg)"
        />
        <button type="button" className={styles.primary} onClick={() => void add()}>
          Add
        </button>
      </div>

      <input
        className={styles.input}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search prefix…"
        aria-label="Search drugs"
      />

      <ul className={styles.chips}>
        {rows.map((d) => (
          <li key={d.id} className={styles.chip}>
            {d.name} {d.strength ?? ''} {d.form ? `· ${d.form}` : ''}
          </li>
        ))}
      </ul>
    </>
  );
}

function CatalogPanel({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const KINDS = ['COMPLAINT', 'OBSERVATION', 'DIAGNOSIS', 'ADVICE', 'NOTE'] as const;
  const [kind, setKind] = useState<(typeof KINDS)[number]>('COMPLAINT');
  const [rows, setRows] = useState<Array<{ id: string; value: string }>>([]);
  const [value, setValue] = useState('');

  const load = useCallback(async () => {
    const result = await http.request<typeof rows>('/settings/catalog', {
      query: { practiceId, kind },
    });
    if (result.ok) setRows(result.value);
  }, [http, practiceId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!value.trim()) return;
    await http.request('/settings/catalog', {
      method: 'POST',
      body: { practiceId, kind, value: value.trim() },
      retry: false,
    });
    setValue('');
    await load();
  };

  return (
    <>
      <h2 className={styles.title}>Clinical note catalog</h2>
      <div className={styles.filters}>
        {KINDS.map((k) => (
          <button key={k} type="button" data-active={kind === k || undefined} onClick={() => setKind(k)}>
            {k.charAt(0) + k.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className={styles.inlineForm}>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Add a ${kind.toLowerCase()}`}
        />
        <button type="button" className={styles.primary} onClick={() => void add()}>
          Add
        </button>
      </div>

      <ul className={styles.chips}>
        {rows.map((r) => (
          <li key={r.id} className={styles.chip}>
            {r.value}
          </li>
        ))}
      </ul>
    </>
  );
}

function PricingPanel({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const { data, error, loading, reload } = usePanelData<
    Array<{ id: string; name: string; priceMinor: number; notes: string | null }>
  >('/settings/pricing', { practiceId });

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const add = async () => {
    if (!name.trim() || !price) return;
    await http.request('/settings/pricing', {
      method: 'PUT',
      // Stored in minor units so no float ever touches a currency value.
      body: { practiceId, name: name.trim(), priceMinor: Math.round(Number(price) * 100), notes: null },
      retry: false,
    });
    setName('');
    setPrice('');
    await reload();
  };

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <>
      <h2 className={styles.title}>Pricing catalog</h2>
      <div className={styles.inlineForm}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Service name" />
        <input
          className={styles.inputSmall}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="BDT"
        />
        <button type="button" className={styles.primary} onClick={() => void add()}>
          Save
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Treatment</th>
            <th className={styles.numeric}>Price (BDT)</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className={styles.numeric}>{(p.priceMinor / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function CommunicationsPanel({ practiceId }: { practiceId: string }) {
  const { http } = useServices();
  const { data, error, loading, reload } = usePanelData<
    Array<{ category: string; type: string; smsEnabled: boolean; emailEnabled: boolean; offsetDays: number | null }>
  >('/settings/communications', { practiceId });

  const toggle = async (
    row: { category: string; type: string; smsEnabled: boolean; emailEnabled: boolean; offsetDays: number | null },
    channel: 'sms' | 'email',
  ) => {
    await http.request('/settings/communications', {
      method: 'PUT',
      body: {
        practiceId,
        category: row.category,
        type: row.type,
        smsEnabled: channel === 'sms' ? !row.smsEnabled : row.smsEnabled,
        emailEnabled: channel === 'email' ? !row.emailEnabled : row.emailEnabled,
        offsetDays: row.offsetDays,
      },
      retry: false,
    });
    await reload();
  };

  if (loading) return <p className={styles.muted}>Loading…</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <>
      <h2 className={styles.title}>Communications</h2>
      <p className={styles.hint}>Per-event SMS and email toggles.</p>
      {(data ?? []).length === 0 ? (
        <p className={styles.muted}>
          No notification rules configured yet. They are created the first time you save one.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th>SMS</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={`${r.category}-${r.type}`}>
                <td>{r.category.replace('_', ' ').toLowerCase()}</td>
                <td>{r.type.toLowerCase()}</td>
                <td>
                  <button type="button" className={styles.toggle} data-on={r.smsEnabled || undefined} onClick={() => void toggle(r, 'sms')}>
                    {r.smsEnabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td>
                  <button type="button" className={styles.toggle} data-on={r.emailEnabled || undefined} onClick={() => void toggle(r, 'email')}>
                    {r.emailEnabled ? 'On' : 'Off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
