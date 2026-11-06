import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { filterStock } from '../../utils/pharmacyFilters';

const locale = lang => (lang === 'bn' ? 'bn-BD' : 'en-GB');
// Whole taka without decimals; poisha always as two digits (৳ 1.50).
const price = (taka, lang) => {
  const digits = Number.isInteger(taka) ? 0 : 2;
  return `৳ ${taka.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

// Long lists get a search box; short ones are easy to scan.
const SEARCH_FROM = 6;

// A pharmacy's in-stock medicines, loaded when the patient opens the list.
export default function PharmacyStock({ pharmacy }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const listId = `stock-${pharmacy.id}`;

  function load() {
    setError(false);
    api.get(`/pharmacies/${pharmacy.id}/stock`).then(setItems).catch(() => setError(true));
  }

  function toggle() {
    if (!open && !items) load();
    setOpen(!open);
  }

  const visible = items ? filterStock(items, query) : [];
  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={listId}
        className="min-h-11 w-full flex items-center justify-between gap-2 text-sm font-semibold text-primary">
        {open ? t('pharmacy_stock_hide') : t('pharmacy_stock_show')}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div id={listId} className="flex flex-col gap-2 mt-1">
          {error ? (
            <p className="text-sm text-red-600">{t('pharmacy_stock_error')} <button type="button" onClick={load} className="underline">{t('retry')}</button></p>
          ) : !items ? (
            <p role="status" className="text-sm text-gray-500">{t('loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">{t('pharmacy_stock_empty')}</p>
          ) : (
            <>
              {items.length >= SEARCH_FROM && (
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('pharmacy_stock_search')} aria-label={t('pharmacy_stock_search')}
                  className="field border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              )}
              {visible.length === 0 ? <p className="text-sm text-gray-500">{t('pharmacy_stock_no_match')}</p> : (
                <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto" aria-label={t('pharmacy_stock_list', { name: pharmacy.name })}>
                  {visible.map(item => (
                    <li key={item.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        {(item.strength || item.form) && <span className="text-gray-500"> · {[item.strength, item.form].filter(Boolean).join(' · ')}</span>}
                      </span>
                      {item.price != null && <span className="flex-shrink-0 font-semibold text-gray-900">{price(item.price, i18n.language)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-500">{t('pharmacy_stock_note')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
