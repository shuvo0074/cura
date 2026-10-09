import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { AMBULANCE_CATEGORIES } from '../../utils/ambulanceFilters';

const INPUT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white';
const TEST_CATEGORIES = ['blood', 'imaging', 'cardiac'];

// One card with its own Save, so each list saves on its own.
function Card({ title, hint, onSubmit, saving, message, children }) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
      </div>
      {children}
      {message && <p role={message.error ? 'alert' : 'status'} className={`text-sm rounded-lg px-3 py-2 ${message.error ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="self-start bg-primary text-white min-h-11 px-6 rounded-lg text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

// Sample prices fill gaps until real ones exist: the shared ambulance fare
// ranges, and test prices for common diagnostic tests. Both are labelled as
// sample on the site.
export default function AdminSamplePricesTab() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState('');
  const [messages, setMessages] = useState({});

  useEffect(() => { api.get('/admin/sample-prices').then(setData); }, []);

  async function save(section, body) {
    setSaving(section);
    setMessages(m => ({ ...m, [section]: null }));
    try {
      setData(await api.patch('/admin/sample-prices', body));
      setMessages(m => ({ ...m, [section]: { text: 'Saved.' } }));
    } catch (err) {
      setMessages(m => ({ ...m, [section]: { error: true, text: err.message } }));
    } finally {
      setSaving('');
    }
  }

  if (!data) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;
  const setFare = (category, key, value) =>
    setData(d => ({ ...d, ambulanceFares: { ...d.ambulanceFares, [category]: { ...d.ambulanceFares[category], [key]: value } } }));
  const setTest = (i, patch) => setData(d => ({ ...d, testPrices: d.testPrices.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-800">Sample prices</h2>

      <Card title="Ambulance fares" saving={saving === 'fares'} message={messages.fares}
        hint="Shown, labelled as sample, for any ambulance type a vendor offers without its own fare. One way within Dhaka, in taka."
        onSubmit={e => { e.preventDefault(); save('fares', { ambulanceFares: data.ambulanceFares }); }}>
        <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[180px_160px_160px] gap-2 items-center">
          <span className="text-xs font-medium text-gray-500">Type</span><span className="text-xs font-medium text-gray-500">From (৳)</span><span className="text-xs font-medium text-gray-500">To (৳)</span>
          {AMBULANCE_CATEGORIES.map(category => (
            <div key={category} className="contents">
              <span className="text-sm text-gray-800">{t(`ambulance_category_${category}`)}</span>
              {['min', 'max'].map(key => (
                <input key={key} required type="number" min="0" step="1" inputMode="numeric" value={data.ambulanceFares?.[category]?.[key] ?? ''}
                  onChange={e => setFare(category, key, e.target.value)} aria-label={`${category} ${key === 'min' ? 'lowest' : 'highest'} sample fare`} className={INPUT} />
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Diagnostic test prices" saving={saving === 'tests'} message={messages.tests}
        hint="Fill empty prices for these tests at diagnostic centres, labelled as sample. Published and entered prices always come first."
        onSubmit={e => { e.preventDefault(); save('tests', { testPrices: data.testPrices, showTestPrices: data.showTestPrices }); }}>
        <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
          <input type="checkbox" checked={data.showTestPrices} onChange={e => setData(d => ({ ...d, showTestPrices: e.target.checked }))} className="accent-primary mt-0.5" />
          <span>Show sample test prices on the site<span className="block text-xs text-gray-500">Turn off once centres have enough real prices; empty prices then show "Price not published".</span></span>
        </label>
        <div className="flex flex-col gap-2">
          {data.testPrices.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_36px] sm:grid-cols-[1fr_140px_110px_36px] gap-2 items-center">
              <input required value={x.name} onChange={e => setTest(i, { name: e.target.value })} placeholder="Test name" aria-label="Test name" className={`${INPUT} min-w-0`} />
              <button type="button" onClick={() => setData(d => ({ ...d, testPrices: d.testPrices.filter((_, j) => j !== i) }))} aria-label={`Remove ${x.name || 'test'}`}
                className="sm:order-last w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
              <select value={x.category} onChange={e => setTest(i, { category: e.target.value })} aria-label="Category" className={INPUT}>
                {TEST_CATEGORIES.map(c => <option key={c} value={c}>{t(`test_cat_${c}`)}</option>)}
              </select>
              <input required type="number" min="0" step="1" inputMode="numeric" value={x.price ?? ''} onChange={e => setTest(i, { price: e.target.value })}
                placeholder="৳" aria-label="Price in taka" className={INPUT} />
            </div>
          ))}
          <button type="button" onClick={() => setData(d => ({ ...d, testPrices: [...d.testPrices, { name: '', category: 'blood', price: '' }] }))}
            className="self-start flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5">
            <Plus size={14} /> Add test
          </button>
        </div>
      </Card>
    </div>
  );
}
