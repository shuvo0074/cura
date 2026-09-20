import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import HomeHero from '../components/home/HomeHero';
import BannerCarousel from '../components/home/BannerCarousel';
import SpecialityExplorer from '../components/home/SpecialityExplorer';
import SymptomExplorer from '../components/home/SymptomExplorer';
import FaqAccordion from '../components/home/FaqAccordion';
import HospitalCard from '../components/hospital/HospitalCard';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import { api } from '../api/client';

const FEATURED_DOCTOR_COUNT = 20;

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    api.get('/hospitals').then(setHospitals);
    api.get('/doctors').then(setDoctors);
  }, []);

  // No admin curation exists yet for which doctors to feature on the home page,
  // so this is a placeholder: alphabetical by name, capped at 50. Swap for an
  // admin-controlled "featured" flag once that exists.
  const featuredDoctors = [...doctors].sort((a, b) => a.name.localeCompare(b.name)).slice(0, FEATURED_DOCTOR_COUNT);

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
        <h2 className="font-semibold text-gray-700 mb-3">Our Hospitals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {hospitals.slice(0, 4).map(h => <HospitalCard key={h.id} hospital={h} />)}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={() => navigate('/hospitals')} className="text-primary text-sm">{t('view_all')}</button>
        </div>
      </section>

      <SymptomExplorer />

      <BannerCarousel />

      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Meet Our Doctors</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {featuredDoctors.map(d => <DoctorCardWide key={d.id} doctor={d} />)}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={() => navigate('/doctors')} className="text-primary text-sm">{t('view_all')}</button>
        </div>
      </section>

      <FaqAccordion />
    </div>
  );
}
