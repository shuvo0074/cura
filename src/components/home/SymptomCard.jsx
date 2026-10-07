import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import symptomDetails from '../../data/symptomDetails.json';

export default function SymptomCard({ symptom, highlighted, onSelect }) {
  const navigate = useNavigate();
  const detail = symptomDetails[symptom.name] || {};

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col cursor-pointer transition-shadow
        ${highlighted ? 'ring-2 ring-primary' : ''}`}>
      <img
        src={`https://images.unsplash.com/photo-${detail.image}?w=400&h=220&fit=crop`}
        alt={symptom.name}
        className="w-full h-28 object-cover"
      />
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-primary font-bold text-sm mb-1">{symptom.name}</h3>
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 flex-1">
          {detail.description}
        </p>

        <div className="flex flex-wrap gap-1 mt-3">
          {(detail.tags || []).map(tag => (
            <span key={tag} className="text-xs font-medium text-gray-600 border border-gray-200 rounded-full px-2.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>

        <hr className="my-3 border-gray-100" />

        <button
          onClick={e => { e.stopPropagation(); navigate(`/symptoms/${symptom.slug}`); }}
          className="flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-medium rounded-full py-2">
          Find Doctor <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
