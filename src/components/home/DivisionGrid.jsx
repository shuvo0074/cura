import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFilter } from '../../context/FilterContext';
import { EMPTY_FILTERS } from '../../utils/doctorFilters';
import HomeSection from './HomeSection';
import { DIVISIONS } from './landingData';

// Location-first browsing: one card per division with a photo taken there.
// Opens the doctor list filtered to that division.
export default function DivisionGrid({ counts }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setFilterParams } = useFilter();

  function open(division) {
    setFilterParams({ ...EMPTY_FILTERS, division: [division] });
    navigate('/doctors');
  }

  return (
    <HomeSection title={t('home_divisions_title')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {DIVISIONS.map(d => (
          <button key={d.name} type="button" onClick={() => open(d.name)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden text-left focus-visible:ring-4 focus-visible:ring-primary/40">
            <img src={d.photo} alt={d.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <span className="absolute left-3 right-3 bottom-2.5 text-white">
              <span className="block font-semibold leading-tight">{i18n.language === 'bn' ? d.bn : d.name}</span>
              {counts?.[d.name] != null && <span className="block text-xs text-white/85">{t('n_doctors', { count: counts[d.name] })}</span>}
            </span>
          </button>
        ))}
      </div>
    </HomeSection>
  );
}
