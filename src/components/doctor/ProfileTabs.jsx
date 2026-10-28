import { useEffect, useState } from 'react';

// Sticky in-page navigation for the profile: one tab per section that has
// content, the active one following the scroll position.
export default function ProfileTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const ids = tabs.map(tab => tab.id).join(',');

  useEffect(() => {
    const els = ids.split(',').map(id => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    // A section is "current" once its top passes the band just under the tabs.
    const observer = new IntersectionObserver(
      entries => {
        const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '-120px 0px -65% 0px' }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Profile sections"
      className="glass-bar sticky top-[var(--header-h)] z-10 -mx-4 sm:mx-0 px-4 sm:px-0">
      <ul className="flex gap-6 overflow-x-auto no-scrollbar border-b border-gray-200">
        {tabs.map(tab => (
          <li key={tab.id} className="flex-shrink-0">
            <a href={`#${tab.id}`} aria-current={active === tab.id ? 'true' : undefined}
              onClick={() => setActive(tab.id)}
              className={`block py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${active === tab.id ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
