import { useLocation } from 'react-router-dom';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AdminAppointmentsTab from './AdminAppointmentsTab';
import AdminDoctorsTab from './AdminDoctorsTab';
import AdminHospitalsTab from './AdminHospitalsTab';

export default function AdminDashboardPage() {
  const { pathname } = useLocation();

  function renderContent() {
    if (pathname === '/admin/appointments') return <AdminAppointmentsTab />;
    if (pathname === '/admin/doctors')      return <AdminDoctorsTab />;
    if (pathname === '/admin/hospitals')    return <AdminHospitalsTab />;
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-2">
        <p className="text-base font-medium text-gray-600">Welcome to the Admin Dashboard</p>
        <p>Select a section from the sidebar to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <AdminSidebar />
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Admin Dashboard</h1>
        {renderContent()}
      </div>
    </div>
  );
}
