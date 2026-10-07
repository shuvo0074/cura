import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, onSearch, placeholder, className = '' }) {
  function handleKey(e) {
    if (e.key === 'Enter' && onSearch) onSearch();
  }
  return (
    <div className={`field flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 gap-2 shadow-sm ${className}`}>
      <Search size={16} className="text-gray-400 flex-shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
      />
    </div>
  );
}
