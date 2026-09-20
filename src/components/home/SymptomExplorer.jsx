import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import symptoms from '../../data/symptoms.json';
import SymptomCard from './SymptomCard';

const VISIBLE_COUNT = 4;
const SWIPE_THRESHOLD = 40;

export default function SymptomExplorer() {
  const navigate = useNavigate();
  const [startIndex, setStartIndex] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const dragStartX = useRef(null);

  const total = symptoms.length;
  const visible = Array.from({ length: VISIBLE_COUNT }, (_, i) => symptoms[(startIndex + i) % total]);

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

        <div
          key={startIndex}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragStartX.current = null; }}
          style={{ touchAction: 'pan-y' }}
          className="fade-slide grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 cursor-grab active:cursor-grabbing select-none">
          {visible.map((s, i) => {
            const actualIndex = (startIndex + i) % total;
            return (
              <SymptomCard
                key={s.id}
                symptom={s}
                highlighted={highlighted === actualIndex}
                onSelect={() => setHighlighted(actualIndex)}
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
