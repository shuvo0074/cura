import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import specialties from '../../data/specialties.json';
import SpecialtyCard from './SpecialtyCard';

const VISIBLE_COUNT = 3;
const SWIPE_THRESHOLD = 40;

export default function SpecialityExplorer() {
  const navigate = useNavigate();
  const [startIndex, setStartIndex] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const dragStartX = useRef(null);

  const total = specialties.length;
  const visible = Array.from({ length: VISIBLE_COUNT }, (_, i) => specialties[(startIndex + i) % total]);

  function pageBy(delta) {
    const next = (startIndex + delta + total) % total;
    setStartIndex(next);
    setHighlighted(next);
  }

  function handlePointerDown(e) {
    dragStartX.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no-op */ }
  }

  function handlePointerUp(e) {
    if (dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (dx > SWIPE_THRESHOLD) pageBy(-1);
    else if (dx < -SWIPE_THRESHOLD) pageBy(1);
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

        <div
          key={startIndex}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragStartX.current = null; }}
          style={{ touchAction: 'pan-y' }}
          className="fade-slide grid grid-cols-1 md:grid-cols-3 gap-4 cursor-grab active:cursor-grabbing select-none">
          {visible.map((s, i) => {
            const actualIndex = (startIndex + i) % total;
            return (
              <SpecialtyCard
                key={s.id}
                specialty={s}
                highlighted={highlighted === actualIndex}
                onSelect={() => setHighlighted(actualIndex)}
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
