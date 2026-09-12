import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import symptoms from '../data/symptoms.json';
import SymptomCard from '../components/home/SymptomCard';

export default function SymptomsPage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return symptoms.filter(s => !q || s.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl text-gray-800">
          Browse All <span className="font-bold italic">Symptoms</span>{' '}
          <span className="text-gray-400 text-lg">({filtered.length})</span>
        </h1>
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white w-full sm:w-72">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Symptoms"
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No results found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => <SymptomCard key={s.id} symptom={s} />)}
        </div>
      )}
    </div>
  );
}
