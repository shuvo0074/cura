import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';
import { POPULAR_SPECIALTIES, altLabelFor, labelFor } from './landingData';

export default function PopularSpecialties({ counts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <HomeSection title={t('home_specialties_title')} linkTo="/specialties" linkLabel={t('home_all_specialties')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {POPULAR_SPECIALTIES.map(s => (
          <Link key={s.slug} to={`/specialties/${s.slug}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 hover:border-primary/40 hover:shadow-md transition-all">
            <span className="w-11 h-11 flex-shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <s.icon size={22} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900 text-sm leading-tight">{labelFor(s, lang)}</span>
              <span className="block text-xs text-gray-500 truncate">{altLabelFor(s, lang)}</span>
              {counts?.[s.name] != null && <span className="block text-xs text-primary font-medium mt-0.5">{t('n_doctors', { count: counts[s.name] })}</span>}
            </span>
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}
