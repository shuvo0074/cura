import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import specialties from '../../data/specialties.json';
import specialtyDetails from '../../data/specialtyDetails.json';
import ImageTile from './ImageTile';

const GAP_PX = 16;

export default function SpecialityExplorer() {
  const navigate = useNavigate();
  const trackRef = useRef(null);

  function scrollByCards(delta) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('[data-tile="true"]');
    const cardWidth = card ? card.getBoundingClientRect().width : el.clientWidth / 4;
    el.scrollBy({ left: delta * (cardWidth + GAP_PX), behavior: 'smooth' });
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-[#1a1a1a] mb-4">Explore by Speciality</h2>

      <div className="relative">
        <button
          onClick={() => scrollByCards(-1)}
          aria-label="Previous specialities"
          className="hidden md:flex items-center justify-center absolute -left-[18px] top-[100px] z-10 w-9 h-9 rounded-full bg-white text-[#1a1a1a] shadow-md border border-gray-200 hover:bg-gray-50">
          <ChevronLeft size={18} />
        </button>

        <div
          ref={trackRef}
          className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory">
          {specialties.map(s => {
            const detail = specialtyDetails[s.name] || {};
            return (
              <div key={s.id} data-tile="true"
                className="shrink-0 snap-start w-52 md:w-[calc((100%-3rem)/4)]">
                <ImageTile
                  image={`https://images.unsplash.com/photo-${detail.image}?w=600&h=480&fit=crop`}
                  title={s.name}
                  description={detail.description}
                  cta="Find Doctor"
                  onClick={() => navigate(`/specialties/${s.slug}`)}
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={() => scrollByCards(1)}
          aria-label="Next specialities"
          className="hidden md:flex items-center justify-center absolute -right-[18px] top-[100px] z-10 w-9 h-9 rounded-full bg-white text-[#1a1a1a] shadow-md border border-gray-200 hover:bg-gray-50">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={() => navigate('/specialties')} className="text-primary text-sm">View All</button>
      </div>
    </section>
  );
}
