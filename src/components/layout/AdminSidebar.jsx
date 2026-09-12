export default function AdminSidebar({ tab, setTab }) {
  const tabs = ['appointments', 'doctors', 'hospitals'];
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto">
      {tabs.map(tKey => (
        <button key={tKey} onClick={() => setTab(tKey)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border capitalize transition-colors
            ${tab === tKey ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}>
          {tKey}
        </button>
      ))}
    </div>
  );
}
