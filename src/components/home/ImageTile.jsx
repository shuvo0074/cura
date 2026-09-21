import { ArrowRight } from 'lucide-react';

// Booking.com-style tile: rounded image with the description + CTA overlaid on a dark gradient,
// title (and optional subtitle) underneath. The whole tile is the click target.
export default function ImageTile({ image, title, subtitle, description, cta, onClick }) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="cursor-pointer group">
      <div className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '5 / 4' }}>
        <img src={image} alt={title} draggable={false} className="w-full h-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-3 pb-3 pt-10 bg-gradient-to-t from-black/85 via-black/60 to-transparent">
          <p className="text-xs text-white leading-snug line-clamp-3">{description}</p>
          <span className="flex items-center justify-center gap-1.5 bg-white text-primary text-xs font-medium rounded-full py-1.5">
            {cta} <ArrowRight size={13} />
          </span>
        </div>
      </div>
      <h3 className="mt-3 text-base font-bold text-[#1a1a1a] group-hover:underline">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
