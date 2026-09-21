import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import DoctorCardWide from '../components/doctor/DoctorCardWide';
import DoctorFilterSidebar from '../components/doctor/DoctorFilterSidebar';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import specialties from '../data/specialties.json';

export default function SpecialtyPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { filterParams, setFilterParams } = useFilter();
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const specialty = specialties.find(s => s.slug === slug);

  useEffect(() => {
    api.get('/doctors').then(setDoctors).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (specialty) setFilterParams(p => ({ ...p, specialty: [specialty.name] }));
  }, [slug]);

  const specialtyNames = useMemo(
    () => [...new Set(doctors.map(d => d.specialty))].sort(),
    [doctors]
  );

  const filtered = useMemo(() => {
    return doctors.filter(d => {
      const q = query.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q);
      const matchCity = !filterParams.city.length || filterParams.city.includes(d.city);
      const matchDivision = !filterParams.division.length || filterParams.division.includes(d.division);
      const matchSpec = !filterParams.specialty.length || filterParams.specialty.includes(d.specialty);
      return matchQ && matchCity && matchDivision && matchSpec;
    });
  }, [doctors, query, filterParams]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <DoctorFilterSidebar specialtyNames={specialtyNames} />

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl text-gray-800">
            {filterParams.specialty.length ? filterParams.specialty.join(', ') : specialty?.name || slug}{' '}
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
