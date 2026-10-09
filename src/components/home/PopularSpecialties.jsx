import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';
import { SPECIALTY_ICONS, altLabelFor, labelFor } from './landingData';
import { useSiteContent } from '../../context/SiteContentContext';
import { useCatalog } from '../../hooks/useCatalog';

export default function PopularSpecialties({ counts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { home } = useSiteContent();
  const specialties = useCatalog('specialties');
  const bySlug = Object.fromEntries((specialties ?? []).map(s => [s.slug, s]));
  if (!home?.popular_specialties.length) return null;
  return (
    <HomeSection title={t('home_specialties_title')} linkTo="/specialties" linkLabel={t('home_all_specialties')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {home.popular_specialties.map(s => {
          const Icon = SPECIALTY_ICONS[s.slug];
          const name = bySlug[s.slug]?.name;
          return (
          <Link key={s.slug} to={`/specialties/${s.slug}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 hover:border-primary/40 hover:shadow-md transition-all">
            <span className="w-11 h-11 flex-shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {Icon ? <Icon size={22} /> : <span className="text-xl" aria-hidden="true">{bySlug[s.slug]?.icon}</span>}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900 text-sm leading-tight">{labelFor(s, lang)}</span>
              <span className="block text-xs text-gray-500 truncate">{altLabelFor(s, lang)}</span>
              {counts?.[name] != null && <span className="block text-xs text-primary font-medium mt-0.5">{t('n_doctors', { count: counts[name] })}</span>}
            </span>
          </Link>
          );
        })}
      </div>
    </HomeSection>
  );
}
