import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

const BTN = 'text-sm font-medium rounded-lg px-4 py-2.5 transition-colors';
const STYLES = {
  primary: `${BTN} bg-primary text-white font-semibold hover:bg-primary/90`,
  secondary: `${BTN} border border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary`,
};

// Shared "nothing here" block: icon, title, optional explanation, and
// actions so the user always has a next step. Each action is
// { label, to } for a link or { label, onClick } for a button; the first
// one is styled as primary.
export default function EmptyState({ icon: Icon = SearchX, title, message, actions = [] }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
        <Icon size={26} className="text-primary/60" />
      </div>
      <p className="font-semibold text-gray-800">{title}</p>
      {message && <p className="text-sm text-gray-500 mt-1 max-w-sm">{message}</p>}
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map(({ label, to, onClick }, i) => {
            const cls = STYLES[i === 0 ? 'primary' : 'secondary'];
            return to
              ? <Link key={label} to={to} className={cls}>{label}</Link>
              : <button key={label} type="button" onClick={onClick} className={cls}>{label}</button>;
          })}
        </div>
      )}
    </div>
  );
}
