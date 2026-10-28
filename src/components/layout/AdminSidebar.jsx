import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, UserRound, CalendarCheck, Ambulance, Tags, Stethoscope, Thermometer, House, Languages, Images, BadgeCheck } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/admin/hospitals',    label: 'Hospitals',     icon: Building2 },
  { path: '/admin/doctors',      label: 'Doctors',       icon: UserRound },
  { path: '/admin/specialties',  label: 'Specialties',   icon: Stethoscope },
  { path: '/admin/symptoms',     label: 'Symptoms',      icon: Thermometer },
  { path: '/admin/ambulances',   label: 'Ambulances',    icon: Ambulance },
  { path: '/admin/sample-prices', label: 'Sample prices', icon: Tags },
  { path: '/admin/home-page',    label: 'Home page',     icon: House },
  { path: '/admin/site-text',    label: 'Site text',     icon: Languages },
  { path: '/admin/photo-credits', label: 'Photo credits', icon: Images },
  { path: '/admin/appointments', label: 'Appointments',  icon: CalendarCheck },
  { path: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
];

export default function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-full md:w-44 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-sm p-4 mt-2 md:sticky md:top-24 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
        <div className="flex items-center gap-2 mb-5">
          <LayoutDashboard size={15} className="text-primary" />
          <span className="font-semibold text-gray-800 text-sm">Admin Panel</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors
                  ${active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 font-medium'}`}
              >
                <Icon size={15} className={active ? 'text-primary' : 'text-gray-400'} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
