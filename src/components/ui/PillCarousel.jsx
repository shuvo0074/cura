export default function PillCarousel({ items, onSelect, selected }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
            ${selected?.id === item.id
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-600 border-gray-200'}`}>
          {item.icon && <span>{item.icon}</span>}
          {item.name}
        </button>
      ))}
    </div>
  );
}
