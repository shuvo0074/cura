import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import GlobalHeader from './components/layout/GlobalHeader';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PageHeader from './components/ui/PageHeader';
import EmptyState from './components/ui/EmptyState';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import DoctorsPage from './pages/DoctorsPage';
import DoctorProfilePage from './pages/DoctorProfilePage';
import SpecialtyPage from './pages/SpecialtyPage';
import SpecialtiesPage from './pages/SpecialtiesPage';
import SymptomsPage from './pages/SymptomsPage';
import SymptomFilterPage from './pages/SymptomFilterPage';
import HospitalsPage from './pages/HospitalsPage';
import HospitalProfilePage from './pages/HospitalProfilePage';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientLoginPage from './pages/PatientLoginPage';
import DoctorAdminLoginPage from './pages/DoctorAdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import DoctorDashboardPage from './pages/DoctorDashboardPage';

function PlaceholderPage({ titleKey }) {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t(titleKey)} />
      <EmptyState
        icon={Construction}
        title={t('coming_soon')}
        message={t('coming_soon_msg')}
        actions={[
          { label: t('back_home'), to: '/' },
          { label: t('find_a_doctor'), to: '/doctors' },
        ]}
      />
    </div>
  );
}

function AdminRoute({ children }) {
  return <ProtectedRoute role="admin">{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FilterProvider>
          <GlobalHeader />
          <main className="app-container pt-4 pb-6 sm:pt-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/search-results" element={<SearchResultsPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
              <Route path="/doctors/:id" element={<DoctorProfilePage />} />
              <Route path="/specialties" element={<SpecialtiesPage />} />
              <Route path="/specialties/:slug" element={<SpecialtyPage />} />
              <Route path="/symptoms" element={<SymptomsPage />} />
              <Route path="/symptoms/:slug" element={<SymptomFilterPage />} />
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/hospitals/:id" element={<HospitalProfilePage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/login" element={<PatientLoginPage />} />
              <Route path="/staff-login" element={<DoctorAdminLoginPage />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/doctors" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/hospitals" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/appointments" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/doctor-dashboard" element={<ProtectedRoute role="doctor"><DoctorDashboardPage /></ProtectedRoute>} />
              <Route path="/health-blogs" element={<PlaceholderPage titleKey="health_blogs" />} />
              <Route path="/ambulances" element={<PlaceholderPage titleKey="ambulances" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
