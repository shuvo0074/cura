import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BANNERS = [
  { id: 1, image: '/banners/banner-1.jpg', alt: 'Find the Right Doctor, Right Away' },
  { id: 2, image: '/banners/banner-2.jpg', alt: 'Trusted Hospitals Near You' },
  { id: 3, image: '/banners/banner-3.jpg', alt: 'Not Feeling Well? Search Doctors By Symptom' },
  { id: 4, image: '/banners/banner-4.jpg', alt: 'Your First Booking is Free' },
];

const AUTO_SLIDE_MS = 4000;

export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  function pageBy(delta) {
    setIndex(prev => (prev + delta + BANNERS.length) % BANNERS.length);
  }

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % BANNERS.length);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timerRef.current);
  }, [paused]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative w-full aspect-[1056/285]">
        {BANNERS.map((banner, i) => (
          <img
            key={banner.id}
            src={banner.image}
            alt={banner.alt}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>

      <button
        onClick={() => pageBy(-1)}
        aria-label="Previous banner"
        className="flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-md transition-colors">
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => pageBy(1)}
        aria-label="Next banner"
        className="flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-md transition-colors">
        <ChevronRight size={18} />
      </button>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {BANNERS.map((banner, i) => (
          <button
            key={banner.id}
            onClick={() => setIndex(i)}
            aria-label={`Go to banner ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </div>
  );
}
