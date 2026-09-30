import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import GlobalHeader from './components/layout/GlobalHeader';
import ProtectedRoute from './components/auth/ProtectedRoute';
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

function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">{title} — Coming Soon</div>
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
          <main className="app-container py-6">
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
              <Route path="/health-blogs" element={<PlaceholderPage title="Health Blogs" />} />
              <Route path="/ambulances" element={<PlaceholderPage title="Ambulances" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </FilterProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
