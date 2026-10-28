import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HomeHero from '../components/home/HomeHero';
import TestCalculatorCta from '../components/home/TestCalculatorCta';
import ServiceCards from '../components/home/ServiceCards';
import HowItWorks from '../components/home/HowItWorks';
import PopularSpecialties from '../components/home/PopularSpecialties';
import CommonProblems from '../components/home/CommonProblems';
import DivisionGrid from '../components/home/DivisionGrid';
import HomeSection from '../components/home/HomeSection';
import FaqAccordion from '../components/home/FaqAccordion';
import BangladeshMap from '../components/home/BangladeshMap';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import { api } from '../api/client';

// Landing page, ordered for how patients in Bangladesh look for care: search
// or a popular speciality first; then the core job (book a serial) with a
// clear emergency route; then browse by speciality, everyday problem, or
// division; then top doctors and a district map of Bangladesh. Loads two
// small endpoints instead of the whole doctor directory (the map loads lazily).
export default function HomePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.get('/doctors/stats').then(setStats).catch(() => {});
    api.get('/doctors/featured?limit=6').then(setFeatured).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-9 sm:gap-12">
      <HomeHero stats={stats} />
      <ServiceCards />
      <BangladeshMap counts={stats?.byCity} />
      <TestCalculatorCta />
      <PopularSpecialties counts={stats?.bySpecialty} />
      <HowItWorks />
      <CommonProblems />
      <DivisionGrid counts={stats?.byDivision} />

      {featured.length > 0 && (
        <HomeSection title={t('home_featured_title')} linkTo="/doctors" linkLabel={t('view_all')}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* 4 on phones keeps the page short; 6 from lg up fills the grid. */}
            {featured.map((d, i) => (
              <div key={d.id} className={i >= 4 ? 'hidden lg:block' : ''}><DoctorCardWide doctor={d} /></div>
            ))}
          </div>
        </HomeSection>
      )}

      <FaqAccordion />
    </div>
  );
}
