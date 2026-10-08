import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Landing-page section: heading with an optional "see all" link on the right.
export default function HomeSection({ title, linkTo, linkLabel, children, className = '' }) {
  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="flex-shrink-0 flex items-center gap-0.5 text-sm font-medium text-primary hover:underline py-1">
            {linkLabel} <ChevronRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
