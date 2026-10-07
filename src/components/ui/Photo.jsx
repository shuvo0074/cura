import { useState } from 'react';
import { UserRound, Building2 } from 'lucide-react';

const ICONS = { person: UserRound, building: Building2 };

// Photo with a built-in placeholder: a tinted box with an icon shows
// immediately and the image fades in over it once it has actually loaded.
// Slow, hanging or failed uploads therefore never leave a blank hole in the
// layout. `className` sizes and shapes the box (rounding, ring, shadow…).
export default function Photo({ src, alt, className = '', kind = 'person', iconSize = 28 }) {
  const [loadedSrc, setLoadedSrc] = useState(null);
  const [failedSrc, setFailedSrc] = useState(null);
  const Icon = ICONS[kind];
  const loaded = loadedSrc === src;

  return (
    <div role="img" aria-label={alt} className={`${className} relative overflow-hidden bg-primary/5 flex items-center justify-center`}>
      {!loaded && <Icon size={iconSize} className="text-primary/30" />}
      {src && failedSrc !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}
