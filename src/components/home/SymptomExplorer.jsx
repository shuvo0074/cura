import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import symptoms from '../../data/symptoms.json';
import SymptomCard from './SymptomCard';

const CARDS_PER_PAGE = 4;
const PAGE_COUNT = Math.ceil(symptoms.length / CARDS_PER_PAGE);

export default function SymptomExplorer() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const visible = symptoms.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);

  function pageBy(delta) {
    const next = (page + delta + PAGE_COUNT) % PAGE_COUNT;
    setPage(next);
    setHighlighted(next * CARDS_PER_PAGE);
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">Symptoms</h2>
        <button onClick={() => navigate('/symptoms')} className="text-primary text-sm">View More</button>
      </div>

      <div className="relative">
        <button
          onClick={() => pageBy(-1)}
          aria-label="Previous symptoms"
          className="flex items-center justify-center absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-white shadow-md hover:brightness-110">
          <ChevronLeft size={18} />
        </button>

        <div key={page} className="fade-slide grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visible.map(s => {
            const i = symptoms.findIndex(x => x.id === s.id);
            return (
              <SymptomCard
                key={s.id}
                symptom={s}
                highlighted={highlighted === i}
                onSelect={() => setHighlighted(i)}
              />
            );
          })}
        </div>

        <button
          onClick={() => pageBy(1)}
          aria-label="Next symptoms"
          className="flex items-center justify-center absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-primary text-white shadow-md hover:brightness-110">
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
