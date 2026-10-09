import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { formatNumber, labelFor } from './landingData';
import { useSiteContent } from '../../context/SiteContentContext';

// True below Tailwind's `sm` breakpoint; used to pick a placeholder that fits.
function useIsNarrow() {
  const query = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = e => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

// Navy hero: the promise (find a doctor, get a serial without queuing),
// search, one-tap popular specialities, and the directory's size as a
// trust signal.
export default function HomeHero({ stats }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { home } = useSiteContent();
  const [query, setQuery] = useState('');
  const isNarrow = useIsNarrow();
  const lang = i18n.language;

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) navigate(`/search-results?q=${encodeURIComponent(query.trim())}`);
  }

  const figures = stats && [
    [stats.doctors, t('home_stat_doctors')],
    [stats.hospitals, t('home_stat_hospitals')],
    [stats.specialties, t('home_stat_specialties')],
    [stats.divisions, t('home_stat_divisions')],
  ];

  return (
    // -mt-4 / sm:-mt-6 cancel <main>'s top padding so the navy band meets the header.
    <section className="relative -mt-4 sm:-mt-6 hero-bleed bg-primary text-white pt-6 pb-6 sm:pt-12 sm:pb-10">
      {/* Soft colour glows give the frosted search, chips and stats something
          to blur. hero-bleed's clip-path makes the section a stacking context,
          so -z-10 keeps them above its navy background but under the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 right-0 w-72 h-72 sm:w-[30rem] sm:h-[30rem] rounded-full bg-action/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-40 sm:w-[26rem] sm:h-60 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-40 h-40 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <h1 className="text-2xl sm:text-4xl font-bold leading-tight max-w-2xl">{t('home_hero_title')}</h1>
      <p className="text-white/80 text-sm sm:text-lg mt-2 max-w-2xl">{t('home_hero_sub')}</p>

      <form onSubmit={handleSearch} role="search" className="mt-5 sm:mt-7 glass-on-dark rounded-2xl p-1.5 flex gap-1.5 shadow-lg shadow-black/20 max-w-3xl">
        <label className="flex-1 flex items-center gap-2.5 bg-white rounded-xl px-3 h-12 cursor-text min-w-0 transition-shadow focus-within:ring-2 focus-within:ring-primary/40">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t(isNarrow ? 'search_placeholder_short' : 'search_placeholder')}
            aria-label={t('search_placeholder')}
            className="flex-1 min-w-0 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
          />
        </label>
        <button type="submit" aria-label={t('search')}
          className="bg-action hover:bg-[#0057b8] text-white text-sm font-semibold rounded-xl px-4 sm:px-7 h-12 flex-shrink-0 transition-colors">
          <span className="hidden sm:inline">{t('search')}</span>
          <Search size={18} className="sm:hidden" />
        </button>
      </form>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap">
        <span className="text-white/70 text-sm flex-shrink-0">{t('home_popular')}</span>
        {(home?.popular_specialties ?? []).slice(0, 6).map(s => (
          <Link key={s.slug} to={`/specialties/${s.slug}`}
            className="flex-shrink-0 h-9 px-3.5 flex items-center rounded-full text-sm glass-on-dark hover:bg-white/20 transition-colors">
            {labelFor(s, lang)}
          </Link>
        ))}
      </div>

      {figures && (
        <dl className="mt-6 sm:mt-8 grid grid-cols-4 gap-2 max-w-xl glass-on-dark rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4">
          {figures.map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-xl sm:text-2xl font-bold leading-none">{formatNumber(n, lang)}</dd>
              <dd className="text-xs sm:text-sm text-white/70 mt-1">{label}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
