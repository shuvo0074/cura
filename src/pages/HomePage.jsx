import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import HomeHero from '../components/home/HomeHero';
import SpecialityExplorer from '../components/home/SpecialityExplorer';
import SymptomExplorer from '../components/home/SymptomExplorer';
import FaqAccordion from '../components/home/FaqAccordion';
import HospitalCard from '../components/hospital/HospitalCard';
import { api } from '../api/client';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    api.get('/hospitals').then(setHospitals);
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <HomeHero />

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Clinical Care You Can Trust</h2>
        <p className="text-gray-500 text-sm max-w-3xl">
          Cura connects you with experienced doctors across specialities and hospitals near you.
          Search by symptom or speciality, compare doctors, and book a visit in minutes — this is
          a demo build, so no real medical services are delivered here, but the browsing and
          booking flow is fully functional.
        </p>
      </section>

      <SpecialityExplorer />

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">Our Hospitals</h2>
          <button onClick={() => navigate('/hospitals')} className="text-primary text-sm">{t('view_all')}</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {hospitals.slice(0, 4).map(h => <HospitalCard key={h.id} hospital={h} />)}
        </div>
      </section>

      <SymptomExplorer />

      <FaqAccordion />
    </div>
  );
}
