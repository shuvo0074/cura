// Single-select pill row. On phones it bleeds to the screen edges and fades
// out on the right, so a pill cut off at the edge reads as "scroll for more".
export default function PillCarousel({ items, onSelect, selected }) {
  return (
    <div className="relative -mx-6 sm:mx-0">
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-6 sm:px-0 scroll-px-6 sm:scroll-px-0 pb-1 snap-x" role="radiogroup">
        {items.map(item => (
          <button
            key={item.id}
            role="radio"
            aria-checked={selected?.id === item.id}
            onClick={() => onSelect(item)}
            className={`flex-shrink-0 snap-start flex items-center gap-1 h-10 px-4 rounded-full text-sm font-medium border transition-colors
              ${selected?.id === item.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 active:bg-gray-50'}`}>
            {item.icon && <span>{item.icon}</span>}
            {item.name}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-secondary to-transparent sm:hidden" aria-hidden="true" />
    </div>
  );
}
