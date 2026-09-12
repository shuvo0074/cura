import { useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Building2, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const MOSAIC_PHOTOS = [
  '1533105079780-92b9be482077',
  '1519501025264-65ba15a82390',
  '1485470733090-0aae1788d5af',
  '1500336624523-d727130c3328',
  '1500043357865-c6b8827edf10',
  '1439853949127-fa647821eba0',
  '1518098268026-4e89f1a2cd8e',
  '1502920917128-1aa500764cbd',
  '1533105079780-92b9be482077',
  '1485470733090-0aae1788d5af',
];

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
    <div className="relative rounded-2xl overflow-hidden mb-10 min-h-[440px]">
      <div className="absolute inset-0 grid grid-cols-5">
        {MOSAIC_PHOTOS.map((photo, i) => (
          <img key={i} src={`https://images.unsplash.com/photo-${photo}?w=300&h=300&fit=crop`} alt=""
            className="w-full h-full object-cover" />
        ))}
      </div>
      <div className="absolute inset-0 bg-primary/75" />

      <div className="relative flex flex-col items-center justify-center gap-6 px-4 py-16 text-center min-h-[440px]">
        <h1 className="text-white text-2xl sm:text-3xl font-bold max-w-xl">
          Find the right doctor, right away
        </h1>

        <div className="w-full max-w-xl flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-lg">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('search_placeholder')}
            className="flex-1 text-sm outline-none bg-transparent text-gray-700"
          />
          <button onClick={handleSearch} className="bg-primary text-white rounded-lg p-2 flex-shrink-0">
            <Search size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className="flex items-center gap-2 bg-white/95 hover:bg-white text-gray-800 text-sm font-medium rounded-full px-4 py-2 transition-colors">
              <Icon size={15} className="text-primary" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
