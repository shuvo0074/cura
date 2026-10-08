import { FlaskConical } from 'lucide-react';
import Photo from '../ui/Photo';

// A diagnostic centre's photo when it has a verified one; otherwise a branded
// banner rather than a photo of some other building, so nothing shown claims
// to be a branch it isn't. Real photos can be uploaded through admin.
export default function CentreBanner({ centre, className = '' }) {
  if (centre.photo) {
    return <Photo src={centre.photo} alt={centre.name} kind="building" iconSize={40} className={className} />;
  }
  const brand = centre.name.split(',')[0];
  return (
    <div role="img" aria-label={centre.name}
      className={`${className} relative overflow-hidden bg-gradient-to-br from-primary to-action flex items-center justify-center`}>
      <FlaskConical aria-hidden="true" className="absolute -right-6 -bottom-8 text-white/10" size={150} strokeWidth={1.25} />
      <div className="relative flex items-center gap-3 px-5 text-white">
        <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <FlaskConical size={22} />
        </span>
        <span className="font-semibold text-lg leading-tight">{brand}</span>
      </div>
    </div>
  );
}
