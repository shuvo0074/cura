import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isRemote } from './chambers';

// A chamber's title block: a coloured icon tile (the chamber's tone, shared
// with the other card on the page), its name — linked to the hospital page
// when it matches one — and its address, plus an optional badge on the right.
export default function ChamberHeading({ chamber, tone, hospitalId, trailing }) {
  const { t } = useTranslation();
  const remote = isRemote(chamber);
  const Icon = remote ? Video : Building2;
  const name = remote ? t('phone_consultation') : chamber.venue;

  return (
    <div className="flex items-start gap-3">
      <span className={`w-10 h-10 flex-shrink-0 rounded-xl shadow-sm flex items-center justify-center ${tone.tile}`} aria-hidden="true">
        <Icon size={19} />
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        {hospitalId && !remote ? (
          <Link to={`/hospitals/${hospitalId}`}
            className="group text-[15px] font-bold text-gray-900 leading-snug hover:text-primary">
            {name}
            <ChevronRight size={16} className="inline -mt-0.5 ml-0.5 text-gray-400 group-hover:text-primary" />
          </Link>
        ) : (
          <p className="text-[15px] font-bold text-gray-900 leading-snug">{name}</p>
        )}
        {!remote && chamber.address && <p className="text-xs text-gray-500 mt-0.5">{chamber.address}</p>}
      </div>
      {trailing}
    </div>
  );
}
