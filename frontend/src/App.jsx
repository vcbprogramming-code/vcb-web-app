import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import ModuleShell from './components/ModuleShell.jsx';
import Login from './pages/Login.jsx';
import Portal from './pages/Portal.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentRegister from './pages/ememo/DocumentRegister.jsx';
import DocumentDetail from './pages/ememo/DocumentDetail.jsx';
import VerifyDocument from './pages/ememo/VerifyDocument.jsx';
import EmemoSettings from './pages/ememo/EmemoSettings.jsx';
import Settings from './pages/admin/Settings.jsx';
import Performance from './pages/performance/Performance.jsx';
import CreditFacility from './pages/credit/CreditFacility.jsx';
import Onboarding from './pages/onboarding/Onboarding.jsx';
import MyProfile from './pages/MyProfile.jsx';
import NotFound from './pages/NotFound.jsx';
import { disabledPaths } from './config/nav.js';

/** Redirect to Portal if this module is soft-disabled (see config/nav.js). */
function Feature({ path, children }) {
  if (disabledPaths.includes(path)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* the old public token approval page is retired — approval is now login-gated
          in-app. Funnel any stale email link to login (then the register shows the
          approver's awaiting-me docs at the top). */}
      <Route path="/approve/:token" element={<Navigate to="/login" replace />} />
      {/* public document verification — reached by scanning the QR, no login */}
      <Route path="/verify/:token" element={<VerifyDocument />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Portal landing (no sidebar) — its own full header */}
        <Route index element={<Portal />} />

        {/* Module pages share a slim header with "back to Portal" */}
        <Route element={<ModuleShell />}>
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="memos" element={<DocumentRegister />} />
          <Route path="memos/:id" element={<DocumentDetail />} />
          <Route
            path="memos-settings"
            element={
              <ProtectedRoute roles={['admin']}>
                <EmemoSettings />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<MyProfile />} />

          <Route path="performance" element={<Feature path="/performance"><Performance /></Feature>} />

          <Route
            path="credit"
            element={
              <Feature path="/credit">
                <ProtectedRoute roles={['admin', 'executive']}>
                  <CreditFacility />
                </ProtectedRoute>
              </Feature>
            }
          />

          <Route path="onboarding" element={<Feature path="/onboarding"><Onboarding /></Feature>} />

          <Route
            path="admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
