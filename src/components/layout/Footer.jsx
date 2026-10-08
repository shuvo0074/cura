import { Link } from 'react-router-dom';
import { PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EXPLORE = [
  { to: '/doctors', key: 'find_a_doctor' },
  { to: '/hospitals', key: 'browse_hospitals' },
  { to: '/diagnostic-centres', key: 'diagnostic_centres' },
  { to: '/specialties', key: 'browse_specialities' },
  { to: '/symptoms', key: 'home_problems_title' },
  { to: '/appointments', key: 'my_appointments' },
];

// Site footer: navigation, help numbers (emergency 999 and the government
// health line 16263 alongside Cura's own hotline), photo credits, and the
// demo notice.
export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-12 bg-primary text-white">
      <div className="app-container py-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <p className="text-2xl font-bold">Cura</p>
          <p className="text-sm text-white/75 mt-2 max-w-xs">{t('footer_tagline')}</p>
        </div>
        <nav aria-label={t('footer_explore')}>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-3">{t('footer_explore')}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {EXPLORE.map(l => <li key={l.to}><Link to={l.to} className="hover:underline">{t(l.key)}</Link></li>)}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-3">{t('footer_help')}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li><a href="tel:999" className="inline-flex items-center gap-2 font-semibold hover:underline"><PhoneCall size={14} /> {t('footer_emergency')}</a></li>
            <li><a href="tel:16263" className="inline-flex items-center gap-2 hover:underline"><PhoneCall size={14} /> {t('footer_health_line')}</a></li>
            <li><a href="tel:16966" className="inline-flex items-center gap-2 hover:underline"><PhoneCall size={14} /> {t('footer_hotline')}</a></li>
            <li><Link to="/credits" className="hover:underline">{t('footer_credits')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="app-container py-4 text-xs text-white/60 flex flex-col sm:flex-row gap-1 justify-between">
          <span>{t('footer_demo')}</span>
          <span>© {new Date().getFullYear()} Cura</span>
        </div>
      </div>
    </footer>
  );
}
