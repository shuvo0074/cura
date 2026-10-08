import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';
import { COMMON_PROBLEMS, labelFor } from './landingData';

// Many patients know the problem, not the speciality — start from there.
export default function CommonProblems() {
  const { t, i18n } = useTranslation();
  return (
    <HomeSection title={t('home_problems_title')} linkTo="/symptoms" linkLabel={t('home_all_problems')}>
      <div className="flex flex-wrap gap-2">
        {COMMON_PROBLEMS.map(p => (
          <Link key={p.slug} to={`/symptoms/${p.slug}`}
            className="h-10 px-4 flex items-center rounded-full bg-white border border-gray-200 text-sm text-gray-800 hover:border-primary hover:text-primary transition-colors">
            {labelFor(p, i18n.language)}
          </Link>
        ))}
      </div>
    </HomeSection>
  );
}
