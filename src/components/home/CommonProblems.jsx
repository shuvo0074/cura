import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';
import { labelFor } from './landingData';
import { useSiteContent } from '../../context/SiteContentContext';

// Many patients know the problem, not the speciality — start from there.
export default function CommonProblems() {
  const { t, i18n } = useTranslation();
  const { home } = useSiteContent();
  if (!home?.common_problems.length) return null;
  return (
    <HomeSection title={t('home_problems_title')} linkTo="/symptoms" linkLabel={t('home_all_problems')}>
      <div className="flex flex-wrap gap-2">
        {home.common_problems.map(p => (
          <Link key={p.slug} to={`/symptoms/${p.slug}`}
            className="h-10 px-4 flex items-center rounded-full bg-white border border-gray-200 text-sm text-gray-800 hover:border-primary hover:text-primary transition-colors">
            {labelFor(p, i18n.language)}
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}
