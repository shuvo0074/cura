import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/staff-login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
