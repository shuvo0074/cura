import { useLocation } from 'react-router-dom';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AdminAppointmentsTab from './AdminAppointmentsTab';
import AdminDoctorsTab from './AdminDoctorsTab';
import AdminHospitalsTab from './AdminHospitalsTab';
import AdminAmbulancesTab from './AdminAmbulancesTab';
import AdminSamplePricesTab from './AdminSamplePricesTab';
import AdminCatalogTab from './AdminCatalogTab';
import AdminHomePageTab from './AdminHomePageTab';
import AdminSiteTextTab from './AdminSiteTextTab';
import AdminPhotoCreditsTab from './AdminPhotoCreditsTab';
import AdminVerificationsTab from './AdminVerificationsTab';
import AdminOwnersTab from './AdminOwnersTab';
import AdminPharmaciesTab from './AdminPharmaciesTab';

export default function AdminDashboardPage() {
  const { pathname } = useLocation();

  function renderContent() {
    if (pathname === '/admin/appointments') return <AdminAppointmentsTab />;
    if (pathname === '/admin/doctors')      return <AdminDoctorsTab />;
    if (pathname === '/admin/hospitals')    return <AdminHospitalsTab />;
    if (pathname === '/admin/specialties')  return <AdminCatalogTab kind="specialties" />;
    if (pathname === '/admin/symptoms')     return <AdminCatalogTab kind="symptoms" />;
    if (pathname === '/admin/ambulances')   return <AdminAmbulancesTab />;
    if (pathname === '/admin/pharmacies')   return <AdminPharmaciesTab />;
    if (pathname === '/admin/home-page')    return <AdminHomePageTab />;
    if (pathname === '/admin/site-text')    return <AdminSiteTextTab />;
    if (pathname === '/admin/photo-credits') return <AdminPhotoCreditsTab />;
    if (pathname === '/admin/sample-prices') return <AdminSamplePricesTab />;
    if (pathname === '/admin/verifications') return <AdminVerificationsTab />;
    if (pathname === '/admin/owners')       return <AdminOwnersTab />;
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
