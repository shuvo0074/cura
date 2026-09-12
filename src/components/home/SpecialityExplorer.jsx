import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import specialties from '../../data/specialties.json';
import SpecialtyCard from './SpecialtyCard';

const PILLS_PER_PAGE = 3;
const PAGE_COUNT = Math.ceil(specialties.length / PILLS_PER_PAGE);

export default function SpecialityExplorer() {
  const navigate = useNavigate();
  const [pillPage, setPillPage] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const visible = specialties.slice(pillPage * PILLS_PER_PAGE, pillPage * PILLS_PER_PAGE + PILLS_PER_PAGE);

  function pageBy(delta) {
    const next = (pillPage + delta + PAGE_COUNT) % PAGE_COUNT;
    setPillPage(next);
    setHighlighted(next * PILLS_PER_PAGE);
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">Explore by Speciality</h2>
        <button onClick={() => navigate('/specialties')} className="text-primary text-sm">View All</button>
      </div>

      <div className="relative">
        <button
          onClick={() => pageBy(-1)}
          aria-label="Previous specialities"
          className="flex items-center justify-center absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-white shadow-md hover:brightness-110">
          <ChevronLeft size={18} />
        </button>

        <div key={pillPage} className="fade-slide grid grid-cols-1 md:grid-cols-3 gap-4">
          {visible.map(s => {
            const i = specialties.findIndex(x => x.id === s.id);
            return (
              <SpecialtyCard
                key={s.id}
                specialty={s}
                highlighted={highlighted === i}
                onSelect={() => setHighlighted(i)}
              />
            );
          })}
        </div>

        <button
          onClick={() => pageBy(1)}
          aria-label="Next specialities"
          className="flex items-center justify-center absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-white shadow-md hover:brightness-110">
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
