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
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="app-container flex items-center justify-between gap-6 py-3">
        <button onClick={() => navigate('/')} className="text-primary font-bold text-2xl tracking-tight flex-shrink-0">
          Cura
        </button>

        <nav className="hidden md:flex items-center gap-6 flex-1">
          {NAV_LINKS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? 'text-primary' : 'text-gray-600 hover:text-primary'}`
              }>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => navigate('/search-results')} className="text-gray-600 hover:text-primary" title="Search">
            <Search size={18} />
          </button>
          <a href="tel:16966" className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary rounded-lg px-3 py-1.5">
            <Phone size={13} /> 16966
          </a>
          <button onClick={toggleLang} className="text-xs font-semibold text-primary border border-primary rounded px-2 py-1">
            {i18n.language === 'en' ? 'বাং' : 'EN'}
          </button>
          <NavLink to={accountLink.path}
            className="text-sm font-medium bg-primary text-white rounded-lg px-3 py-1.5 whitespace-nowrap">
            {accountLink.label}
          </NavLink>
          {user && (
            <button onClick={handleLogout} className="text-sm font-medium text-gray-500 hover:text-red-500">
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
