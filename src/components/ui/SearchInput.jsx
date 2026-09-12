import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, onSearch, placeholder }) {
  function handleKey(e) {
    if (e.key === 'Enter' && onSearch) onSearch();
  }
  return (
    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 gap-2 shadow-sm">
      <Search size={16} className="text-gray-400 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
      />
    </div>
  );
}
