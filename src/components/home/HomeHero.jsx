import { useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function HomeHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function handleSearch() {
    if (query.trim()) navigate(`/search-results?q=${encodeURIComponent(query)}`);
  }

  const actions = [
    { icon: Stethoscope, label: 'Find Doctor', path: '/doctors' },
    { icon: Building2, label: 'Find Hospital', path: '/hospitals' },
  ];

  return (
    // -mt-6 cancels <main>'s top padding so the navy band meets the header.
    // pb-20 sm:pb-24 reserves space for the floating search bar (half hangs below).
    <div className="relative -mt-6 mb-10">
      <div className="hero-bleed bg-primary pt-4 pb-20 sm:pb-24">
        {/* Quick-link pills */}
        <div className="flex items-center gap-2">
          {actions.map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className="flex items-center gap-2 text-white text-sm font-medium rounded-full px-4 py-2.5 border border-white/30 hover:bg-white/10 transition-colors">
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Hero text */}
        <h1 className="text-white text-2xl sm:text-4xl font-bold mt-6 sm:mt-10 leading-snug">
          Find the right doctor,<br className="hidden sm:block" /> right away
        </h1>
        <p className="text-white/80 text-sm sm:text-xl mt-2">
          Search doctors, specialities and hospitals across Bangladesh
        </p>
      </div>

      {/* Floating search bar — straddles the hero bottom edge */}
      <div className="absolute inset-x-0 bottom-0 translate-y-1/2 px-0">
        <div className="bg-accent rounded-xl p-1 flex gap-1 shadow-lg">
          <label className="flex-1 flex items-center gap-2.5 bg-white rounded-lg px-3 h-12 cursor-text min-w-0">
            <Search size={18} className="text-gray-400 flex-shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t('search_placeholder')}
              className="flex-1 min-w-0 text-sm outline-none bg-transparent text-[#1a1a1a] placeholder:text-gray-400"
            />
          </label>
          <button
            onClick={handleSearch}
            className="bg-action hover:bg-[#0057b8] text-white text-sm font-semibold rounded-lg px-4 sm:px-7 h-12 flex-shrink-0 transition-colors">
            <span className="hidden sm:inline">Search</span>
            <Search size={18} className="sm:hidden" />
          </button>
        </div>
      </div>
    </div>
  );
}
