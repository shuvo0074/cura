import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Phone, Menu, X, ChevronRight, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Find Doctor', path: '/doctors' },
  { label: 'Find Hospital', path: '/hospitals' },
  { label: 'Diagnostic Centres', path: '/diagnostic-centres' },
  { label: 'Read about Health', path: '/health-blogs' },
  { label: 'Find Ambulance', path: '/ambulances' },
];

export default function GlobalHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const { user, logout, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Publish the header's real height as --header-h so sticky bars below it
  // (e.g. the filter bar) line up at every breakpoint, even when it wraps.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--header-h', `${entry.target.getBoundingClientRect().height}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [menuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function toggleLang() {
    const next = i18n.language === 'en' ? 'bn' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('cura-lang', next);
  }

  async function handleLogout() {
    await logout();
    navigate('/');
    setMenuOpen(false);
  }

  let accountLink = { label: 'Login', path: '/login' };
  if (hasRole('patient')) accountLink = { label: 'My Appointments', path: '/appointments' };
  if (hasRole('doctor')) accountLink = { label: 'Doctor Dashboard', path: '/doctor-dashboard' };
  if (hasRole('admin')) accountLink = null;

  return (
    <>
      <header className="sticky top-0 z-50 glass-nav text-white border-b border-white/10" ref={menuRef}>
        <div className="app-container flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="text-white font-bold text-2xl tracking-tight flex-shrink-0">
            Cura
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium rounded-full px-4 py-2.5 border transition-colors ${
                    isActive ? 'border-white' : 'border-transparent hover:bg-white/10'
                  }`
                }>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/search-results')} className="text-white hover:bg-white/10 rounded-full p-2" title="Search">
              <Search size={18} />
            </button>
            <a href="tel:16966" className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-white border border-white rounded px-3 py-1.5 hover:bg-white/10">
              <Phone size={13} /> 16966
            </a>
            <button onClick={toggleLang} className="text-xs font-semibold text-white border border-white rounded px-2 py-1.5 hover:bg-white/10">
              {i18n.language === 'en' ? 'বাং' : 'EN'}
            </button>
            {/* Desktop account link */}
            {accountLink && <NavLink to={accountLink.path}
              className="hidden md:inline-flex text-sm font-medium bg-white text-action rounded px-3 py-1.5 whitespace-nowrap hover:bg-gray-100">
              {accountLink.label}
            </NavLink>}
            {user && (
              <button onClick={handleLogout} className="hidden md:block text-sm font-medium text-white/80 hover:text-white">
                Logout
              </button>
            )}
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden text-white hover:bg-white/10 rounded-full p-2"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 animate-[slideDown_0.2s_ease-out]">
            <nav className="flex flex-col">
              {NAV_LINKS.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-5 py-4 text-sm font-medium border-b border-white/10 transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10'
                    }`
                  }>
                  {item.label}
                  <ChevronRight size={16} className="opacity-50" />
                </NavLink>
              ))}

              {/* Account row */}
              {accountLink && <NavLink
                to={accountLink.path}
                className="flex items-center justify-between px-5 py-4 text-sm font-medium border-b border-white/10 text-white/90 hover:bg-white/10 transition-colors">
                <span className="flex items-center gap-2.5">
                  <User size={16} className="opacity-70" />
                  {accountLink.label}
                </span>
                <ChevronRight size={16} className="opacity-50" />
              </NavLink>}

              {/* Phone */}
              <a
                href="tel:16966"
                className="flex items-center justify-between px-5 py-4 text-sm font-medium border-b border-white/10 text-white/90 hover:bg-white/10 transition-colors">
                <span className="flex items-center gap-2.5">
                  <Phone size={16} className="opacity-70" />
                  Hotline: 16966
                </span>
                <ChevronRight size={16} className="opacity-50" />
              </a>

              {/* Logout */}
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors w-full text-left">
                  <LogOut size={16} className="opacity-70" />
                  Logout
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 glass-scrim md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
