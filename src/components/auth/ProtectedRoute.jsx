import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading, hasRole } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />;
  if (role && !hasRole(role)) return <Navigate to="/" replace />;

  return children;
}
