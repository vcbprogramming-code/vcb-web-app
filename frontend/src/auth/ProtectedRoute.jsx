import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/** Gates routes behind authentication and (optionally) a set of roles. */
export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, authError, retry } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <span>กำลังโหลด…</span>
      </div>
    );
  }

  // We have a token but couldn't reach the server (network / cold start / 5xx).
  // Don't bounce to login and lose the session — offer a retry.
  if (authError && !user) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-base font-semibold text-slate-700">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</p>
          <p className="text-sm text-slate-500">{authError}</p>
        </div>
        <button onClick={retry} className="btn-primary">ลองใหม่อีกครั้ง</button>
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
