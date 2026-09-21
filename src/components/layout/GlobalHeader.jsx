import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Find Doctor', path: '/doctors' },
  { label: 'Find Hospital', path: '/hospitals' },
  { label: 'Read about Health', path: '/health-blogs' },
  { label: 'Find Ambulance', path: '/ambulances' },
];

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { user, logout } = useAuth();

  function toggleLang() {
    const next = i18n.language === 'en' ? 'bn' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('cura-lang', next);
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  let accountLink = { label: 'Login', path: '/login' };
  if (user?.role === 'patient') accountLink = { label: 'My Appointments', path: '/appointments' };
  if (user?.role === 'doctor') accountLink = { label: 'Doctor Dashboard', path: '/doctor-dashboard' };
  if (user?.role === 'admin') accountLink = { label: 'Admin Dashboard', path: '/admin' };

  return (
    <header className="sticky top-0 z-50 bg-primary text-white">
      <div className="app-container flex items-center justify-between gap-6 py-3">
        <button onClick={() => navigate('/')} className="text-white font-bold text-2xl tracking-tight flex-shrink-0">
          Cura
        </button>

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

        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => navigate('/search-results')} className="text-white hover:bg-white/10 rounded-full p-2" title="Search">
            <Search size={18} />
          </button>
          <a href="tel:16966" className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-white border border-white rounded px-3 py-1.5 hover:bg-white/10">
            <Phone size={13} /> 16966
          </a>
          <button onClick={toggleLang} className="text-xs font-semibold text-white border border-white rounded px-2 py-1.5 hover:bg-white/10">
            {i18n.language === 'en' ? 'বাং' : 'EN'}
          </button>
          <NavLink to={accountLink.path}
            className="text-sm font-medium bg-white text-action rounded px-3 py-1.5 whitespace-nowrap hover:bg-gray-100">
            {accountLink.label}
          </NavLink>
          {user && (
            <button onClick={handleLogout} className="text-sm font-medium text-white/80 hover:text-white">
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
