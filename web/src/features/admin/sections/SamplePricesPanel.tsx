import { useState, type FormEvent, type ReactNode } from 'react';
import { useServices } from '../../../app/services';
import { Check, Failed, Loading, Panel, uiStyles as s, useResource } from '../../../ui';
import { AMBULANCE_TYPES, type FareRange } from '../../owner/owner-shared';
import p from './SamplePricesPanel.module.css';

interface TestPrice {
  name: string;
  category: string;
  price: number | string;
}

interface SamplePrices {
  ambulanceFares: Record<string, FareRange>;
  testPrices: TestPrice[];
  showTestPrices: boolean;
}

/** The categories the API accepts for a sample test price. */
const TEST_CATEGORIES = [
  { key: 'blood', label: 'Blood and urine' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'cardiac', label: 'Heart' },
] as const;

type Section = 'fares' | 'tests';
type Message = { error: boolean; text: string };

/**
 * Sample prices fill gaps until real ones exist: the shared ambulance fare
 * ranges, and prices for common diagnostic tests. Cura Website labels both as
 * sample. Each card saves on its own.
 */
export function SamplePricesPanel() {
  const { http } = useServices();
  const { data, error, loading, setData } = useResource<SamplePrices>('/directory/admin/sample-prices', {});
  const [saving, setSaving] = useState<Section | null>(null);
  const [messages, setMessages] = useState<Partial<Record<Section, Message>>>({});

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const save = async (section: Section, body: Partial<SamplePrices>) => {
    setSaving(section);
    setMessages((m) => ({ ...m, [section]: undefined }));
    const result = await http.request<SamplePrices>('/directory/admin/sample-prices', {
      method: 'PATCH',
      body,
      retry: false,
    });
    setSaving(null);
    if (result.ok) {
      // The answer holds every list as stored, so the other card's edits are kept.
      setData((current) => (current ? { ...current, ...pick(result.value, section) } : result.value));
      setMessages((m) => ({ ...m, [section]: { error: false, text: 'Saved' } }));
    } else {
      setMessages((m) => ({ ...m, [section]: { error: true, text: result.error.message } }));
    }
  };

  const setFare = (category: string, edge: keyof FareRange, value: string) =>
    setData((current) =>
      current
        ? {
            ...current,
            ambulanceFares: {
              ...current.ambulanceFares,
              [category]: { min: '', max: '', ...current.ambulanceFares[category], [edge]: value },
            },
          }
        : current,
    );

  const setTests = (change: (tests: TestPrice[]) => TestPrice[]) =>
    setData((current) => (current ? { ...current, testPrices: change(current.testPrices) } : current));
  const setTest = (index: number, patch: Partial<TestPrice>) =>
    setTests((tests) => tests.map((test, i) => (i === index ? { ...test, ...patch } : test)));

  return (
    <Panel title="Sample prices" description="Prices Cura Website shows, labelled as sample, until real ones exist.">
      <Card
        title="Ambulance fares"
        hint="Shown for any ambulance type a vendor offers without its own fare. One way within Dhaka, in taka."
        busy={saving === 'fares'}
        message={messages.fares}
        onSubmit={() => void save('fares', { ambulanceFares: data.ambulanceFares })}
      >
        <div className={p.fareGrid}>
          <span className={p.head}>Type</span>
          <span className={p.head}>From (৳)</span>
          <span className={p.head}>To (৳)</span>
          {AMBULANCE_TYPES.map((type) => (
            <FareRow key={type.key} label={type.label}>
              {(['min', 'max'] as const).map((edge) => (
                <input
                  key={edge}
                  className={s.input}
                  required
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${type.label} ${edge === 'min' ? 'lowest' : 'highest'} sample fare`}
                  value={data.ambulanceFares[type.key]?.[edge] ?? ''}
                  onChange={(e) => setFare(type.key, edge, e.target.value)}
                />
              ))}
            </FareRow>
          ))}
        </div>
      </Card>

      <Card
        title="Diagnostic test prices"
        hint="Fill empty prices for these tests at diagnostic centres. Published and entered prices always come first."
        busy={saving === 'tests'}
        message={messages.tests}
        onSubmit={() => void save('tests', { testPrices: data.testPrices, showTestPrices: data.showTestPrices })}
      >
        <Check
          label="Show sample test prices on the site"
          description={'Turn off once centres have enough real prices. Empty prices then show "Price not published".'}
          checked={data.showTestPrices}
          onChange={(checked) => setData((current) => (current ? { ...current, showTestPrices: checked } : current))}
        />
        {data.testPrices.map((test, index) => (
          <div key={index} className={p.testRow}>
            <input
              className={s.input}
              required
              placeholder="Test name"
              aria-label="Test name"
              value={test.name}
              onChange={(e) => setTest(index, { name: e.target.value })}
            />
            <select
              className={s.input}
              aria-label="Category"
              value={test.category}
              onChange={(e) => setTest(index, { category: e.target.value })}
            >
              {TEST_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
            <input
              className={s.input}
              required
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="৳"
              aria-label="Price in taka"
              value={test.price}
              onChange={(e) => setTest(index, { price: e.target.value })}
            />
            <button
              type="button"
              className={s.linkDanger}
              aria-label={`Remove ${test.name || 'test'}`}
              onClick={() => setTests((tests) => tests.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={s.secondary}
          onClick={() => setTests((tests) => [...tests, { name: '', category: 'blood', price: '' }])}
        >
          Add test
        </button>
      </Card>
    </Panel>
  );
}

/** Keeps only the part of a save answer that the saved card owns. */
function pick(value: SamplePrices, section: Section): Partial<SamplePrices> {
  return section === 'fares'
    ? { ambulanceFares: value.ambulanceFares }
    : { testPrices: value.testPrices, showTestPrices: value.showTestPrices };
}

function FareRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className={p.type}>{label}</span>
      {children}
    </>
  );
}

/** One card with its own Save, so each list saves on its own. */
function Card({
  title,
  hint,
  busy,
  message,
  onSubmit,
  children,
}: {
  title: string;
  hint: string;
  busy: boolean;
  message: Message | undefined;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form className={p.card} onSubmit={submit}>
      <h3>{title}</h3>
      <p className={s.hint}>{hint}</p>
      {children}
      <div className={p.cardFoot}>
        <button type="submit" className={s.primary} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {message && (
          <span className={message.error ? s.error : s.saved} role={message.error ? 'alert' : 'status'}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
