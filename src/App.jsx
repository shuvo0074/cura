import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { FilterProvider } from './context/FilterContext';
import { SiteContentProvider } from './context/SiteContentContext';
import { AuthProvider } from './context/AuthContext';
import GlobalHeader from './components/layout/GlobalHeader';
import Footer from './components/layout/Footer';
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
import DiagnosticCentresPage from './pages/DiagnosticCentresPage';
import AppointmentsPage from './pages/AppointmentsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { doctorRegisterUrl } from './config/dashboard';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import DoctorDashboardPage from './pages/DoctorDashboardPage';
import MyClinicsPage from './pages/MyClinicsPage';
import DoctorProfileEditorPage from './pages/DoctorProfileEditorPage';
import DoctorQrCardPage from './pages/DoctorQrCardPage';
import CreditsPage from './pages/CreditsPage';
import AmbulancesPage from './pages/AmbulancesPage';

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
  return <ProtectedRoute role="super_admin">{children}</ProtectedRoute>;
}

// Doctors sign up on Cura Dashboard, so old links to this page still work.
function ToDashboardSignup() {
  useEffect(() => {
    window.location.replace(doctorRegisterUrl());
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SiteContentProvider>
        <FilterProvider>
          <GlobalHeader />
          <main className="app-container pt-4 pb-6 sm:pt-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/search-results" element={<SearchResultsPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
              <Route path="/doctors/:id" element={<DoctorProfilePage />} />
              <Route path="/dr/:slug" element={<DoctorProfilePage />} />
              <Route path="/specialties" element={<SpecialtiesPage />} />
              <Route path="/specialties/:slug" element={<SpecialtyPage />} />
              <Route path="/symptoms" element={<SymptomsPage />} />
              <Route path="/symptoms/:slug" element={<SymptomFilterPage />} />
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/hospitals/:id" element={<HospitalProfilePage />} />
              <Route path="/diagnostic-centres" element={<DiagnosticCentresPage />} />
              <Route path="/diagnostic-centres/:id" element={<HospitalProfilePage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/doctor" element={<ToDashboardSignup />} />
              <Route path="/staff-login" element={<Navigate to="/login" replace />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/doctors" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/hospitals" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/appointments" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/specialties" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/symptoms" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/home-page" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/site-text" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/photo-credits" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/ambulances" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/sample-prices" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/verifications" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/owners" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/my-clinics" element={<ProtectedRoute role="patient"><MyClinicsPage /></ProtectedRoute>} />
              <Route path="/doctor-dashboard" element={<ProtectedRoute role="doctor"><DoctorDashboardPage /></ProtectedRoute>} />
              <Route path="/doctor-dashboard/profile" element={<ProtectedRoute role="doctor"><DoctorProfileEditorPage /></ProtectedRoute>} />
              <Route path="/doctor-dashboard/card" element={<ProtectedRoute role="doctor"><DoctorQrCardPage /></ProtectedRoute>} />
              <Route path="/health-blogs" element={<PlaceholderPage titleKey="health_blogs" />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="/ambulances" element={<AmbulancesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </FilterProvider>
        </SiteContentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
