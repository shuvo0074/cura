import { useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Building2, CalendarClock } from 'lucide-react';
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
    { icon: CalendarClock, label: 'My Appointments', path: '/appointments' },
  ];

  return (
    // -mt-6 cancels <main>'s top padding so the navy band meets the header;
    // the search bar straddles the band's bottom edge (translate-y-1/2), and mb-7 reserves its lower half.
    <div className="relative -mt-6 mb-7">
      <div className="hero-bleed bg-primary pt-4 pb-24">
        <div className="flex flex-wrap items-center gap-2">
          {actions.map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className="flex items-center gap-2 text-white text-sm font-medium rounded-full px-4 py-3 border border-transparent hover:bg-white/10 transition-colors">
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>

        <h1 className="text-white text-4xl font-bold mt-10">Find the right doctor, right away</h1>
        <p className="text-white text-xl mt-2">Search doctors, specialities and hospitals across Bangladesh</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
        <div className="bg-accent rounded-lg p-1 flex gap-1">
          <label className="flex-1 flex items-center gap-3 bg-white rounded px-4 h-[50px] cursor-text">
            <Search size={20} className="text-gray-500 flex-shrink-0" />
            <span className="flex flex-col justify-center flex-1 min-w-0">
              <span className="text-xs text-gray-600 leading-4">What are you looking for?</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={t('search_placeholder')}
                className="text-sm font-medium outline-none bg-transparent text-[#1a1a1a] placeholder:text-gray-500 placeholder:font-normal leading-5"
              />
            </span>
          </label>
          <button onClick={handleSearch}
            className="bg-action hover:bg-[#0057b8] text-white text-xl font-medium rounded px-8 h-[50px] transition-colors">
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
