import { useParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import DoctorFilterSidebar from '../components/doctor/DoctorFilterSidebar';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import symptoms from '../data/symptoms.json';

export default function SymptomFilterPage() {
  const { slug } = useParams();
  const { filterParams, setFilterParams } = useFilter();
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const symptom = symptoms.find(s => s.slug === slug);

  useEffect(() => {
    api.get('/doctors').then(setDoctors).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (symptom) setFilterParams(p => ({ ...p, symptom: [symptom.name] }));
  }, [slug]);

  const symptomNames = useMemo(() => symptoms.map(s => s.name), []);
  const cityNames = useMemo(
    () => [...new Set(doctors.map(d => d.city).filter(Boolean))].sort(),
    [doctors]
  );

  const filtered = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchSymptom = !filterParams.symptom.length || filterParams.symptom.some(sym => {
        const s = sym.toLowerCase();
        return d.specialty?.toLowerCase().includes(s) ||
          d.name?.toLowerCase().includes(s) ||
          d.about?.toLowerCase().includes(s);
      });
      return matchQ && matchCity && matchSymptom;
    });
  }, [doctors, query, filterParams]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <DoctorFilterSidebar cities={cityNames} symptomNames={symptomNames} mode="symptom" />

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl text-gray-800">
            {filterParams.symptom.length ? filterParams.symptom.join(', ') : symptom?.name || slug}{' '}
            <span className="text-gray-400 text-lg">({filtered.length})</span>
          </h1>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-full sm:w-72">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search doctor"
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No results found</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(d => <DoctorCardWide key={d.id} doctor={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
