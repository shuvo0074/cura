// Standard page title row: bold title with an optional muted count, and an
// optional control (usually a SearchInput) on the right from `sm` up. Pages
// whose sticky FilterBar carries the search on phones pass
// controlsOnMobile={false} so it isn't shown twice.
export default function PageHeader({ title, count, children, controlsOnMobile = true }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
        {title}
        {count != null && <span className="ml-2 text-base sm:text-lg font-normal text-gray-400">({count})</span>}
      </h1>
      {children && (
        <div className={`w-full sm:w-72 flex-shrink-0 ${controlsOnMobile ? '' : 'hidden md:block'}`}>{children}</div>
      )}
    </div>
  );
}
