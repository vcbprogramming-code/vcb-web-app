import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/** Gates routes behind authentication and (optionally) a set of roles. */
export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        กำลังโหลด…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
