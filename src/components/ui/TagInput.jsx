import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { splitDegrees } from '../../utils/doctorProfile';

// Chips with an input. Enter, or a comma outside brackets, adds what's typed;
// pasting "MBBS, FCPS (Medicine)" adds both. Backspace on empty removes the last.
export default function TagInput({ label, hint, tags, onChange, max, maxLen, placeholder }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  function addAll(values) {
    const next = [...tags];
    for (const raw of values) {
      const v = raw.trim().slice(0, maxLen);
      if (v && next.length < max && !next.some(x => x.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    if (next.length !== tags.length) onChange(next);
  }

  function handleChange(value) {
    const parts = splitDegrees(value);
    const open = (value.match(/[([]/g) || []).length > (value.match(/[)\]]/g) || []).length;
    if (!open && /[,;]\s*$/.test(value)) {
      addAll(parts);
      setDraft('');
    } else if (parts.length > 1) {
      addAll(parts.slice(0, -1));
      setDraft(parts[parts.length - 1]);
    } else {
      setDraft(value);
    }
  }

  function commit() {
    addAll([draft]);
    setDraft('');
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      <div className="field flex flex-wrap gap-1.5 border border-gray-200 rounded-xl px-2 py-2 bg-white">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1 py-1 rounded-full">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== tag))} aria-label={t('pe_remove_tag', { tag })}
              className="rounded-full p-0.5 hover:bg-primary/15"><X size={12} /></button>
          </span>
        ))}
        {tags.length < max && (
          <input value={draft} onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
            }}
            onBlur={commit} placeholder={placeholder || t('pe_add_tag_ph')} aria-label={label}
            className="flex-1 min-w-[10rem] text-sm outline-none bg-transparent px-1 py-0.5 placeholder:text-gray-400" />
        )}
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1.5">{hint} <span className="text-gray-400">({tags.length}/{max})</span></p>}
    </div>
  );
}
