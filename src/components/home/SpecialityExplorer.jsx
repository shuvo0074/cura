import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import specialties from '../../data/specialties.json';
import specialtyDetails from '../../data/specialtyDetails.json';
import ImageTile from './ImageTile';

const VISIBLE_COUNT = 4;
const SWIPE_THRESHOLD = 40;
const DRAG_CAPTURE_THRESHOLD = 8;

export default function SpecialityExplorer() {
  const navigate = useNavigate();
  const [startIndex, setStartIndex] = useState(0);
  const dragStartX = useRef(null);
  const dragged = useRef(false);

  const total = specialties.length;
  const visible = Array.from({ length: VISIBLE_COUNT }, (_, i) => specialties[(startIndex + i) % total]);

  function pageBy(delta) {
    setStartIndex((startIndex + delta + total) % total);
  }

  function handlePointerDown(e) {
    dragStartX.current = e.clientX;
    dragged.current = false;
  }

  // Capture the pointer only once it's clearly a drag, so a plain click still lands on the tile.
  function handlePointerMove(e) {
    if (dragStartX.current == null || dragged.current) return;
    if (Math.abs(e.clientX - dragStartX.current) > DRAG_CAPTURE_THRESHOLD) {
      dragged.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    }
  }

  function handlePointerUp(e) {
    if (dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (dx > SWIPE_THRESHOLD) pageBy(-1);
    else if (dx < -SWIPE_THRESHOLD) pageBy(1);
  }

  function openSpecialty(slug) {
    if (dragged.current) { dragged.current = false; return; }
    navigate(`/specialties/${slug}`);
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-[#1a1a1a] mb-4">Explore by Speciality</h2>

      <div className="relative">
        <button
          onClick={() => pageBy(-1)}
          aria-label="Previous specialities"
          className="flex items-center justify-center absolute -left-[18px] top-[100px] z-10 w-9 h-9 rounded-full bg-white text-[#1a1a1a] shadow-md border border-gray-200 hover:bg-gray-50">
          <ChevronLeft size={18} />
        </button>

        <div
          key={startIndex}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragStartX.current = null; }}
          style={{ touchAction: 'pan-y' }}
          className="fade-slide grid grid-cols-4 gap-4 select-none">
          {visible.map(s => {
            const detail = specialtyDetails[s.name] || {};
            return (
              <ImageTile
                key={s.id}
                image={`https://images.unsplash.com/photo-${detail.image}?w=600&h=480&fit=crop`}
                title={s.name}
                description={detail.description}
                cta="Find Doctor"
                onClick={() => openSpecialty(s.slug)}
              />
            );
          })}
        </div>

        <button
          onClick={() => pageBy(1)}
          aria-label="Next specialities"
          className="flex items-center justify-center absolute -right-[18px] top-[100px] z-10 w-9 h-9 rounded-full bg-white text-[#1a1a1a] shadow-md border border-gray-200 hover:bg-gray-50">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={() => navigate('/specialties')} className="text-primary text-sm">View All</button>
      </div>
    </section>
  );
}
