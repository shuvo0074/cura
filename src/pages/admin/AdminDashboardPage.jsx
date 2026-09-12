import { useState } from 'react';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AdminAppointmentsTab from './AdminAppointmentsTab';
import AdminDoctorsTab from './AdminDoctorsTab';
import AdminHospitalsTab from './AdminHospitalsTab';

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('appointments');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Admin Dashboard</h1>
      <AdminSidebar tab={tab} setTab={setTab} />
      {tab === 'appointments' && <AdminAppointmentsTab />}
      {tab === 'doctors' && <AdminDoctorsTab />}
      {tab === 'hospitals' && <AdminHospitalsTab />}
    </div>
  );
}
