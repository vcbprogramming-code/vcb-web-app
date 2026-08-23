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
import SharedDocument from './pages/ememo/SharedDocument.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Performance from './pages/performance/Performance.jsx';
import CreditFacility from './pages/credit/CreditFacility.jsx';
import Onboarding from './pages/onboarding/Onboarding.jsx';
import Sop from './pages/sop/Sop.jsx';
import SystemMap from './pages/sysmap/SystemMap.jsx';
import Meetings from './pages/meetings/Meetings.jsx';
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
      {/* read-only copy for a สำเนาเรียน (CC) recipient — link from their email,
          no login and no account needed. Opens that one document only. */}
      <Route path="/doc/:token" element={<SharedDocument />} />

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
          {/* admin-only: the overview aggregates the whole register and carries
              the Excel export. Hiding the menu entry is not a gate — this is,
              and /documents/stats + /documents/export enforce it server-side. */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute roles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="memos" element={<DocumentRegister />} />
          <Route path="memos/:id" element={<DocumentDetail />} />
          {/* One settings page now (the client asked for one place). The old
              paths still resolve so bookmarks and in-app links keep working. */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="memos-settings" element={<Navigate to="/settings?s=projects" replace />} />
          <Route path="profile" element={<Navigate to="/settings?s=signature" replace />} />

          <Route path="performance" element={<Feature path="/performance"><Performance /></Feature>} />

          <Route
            path="credit"
            element={
              <Feature path="/credit">
                <ProtectedRoute perm={['credit', 'view']}>
                  <CreditFacility />
                </ProtectedRoute>
              </Feature>
            }
          />

          <Route path="onboarding" element={<Feature path="/onboarding"><Onboarding /></Feature>} />

          <Route path="sop" element={<Feature path="/sop"><Sop /></Feature>} />

          <Route path="sysmap" element={<Feature path="/sysmap"><SystemMap /></Feature>} />

          <Route path="meetings" element={<Feature path="/meetings"><Meetings /></Feature>} />

          <Route path="admin" element={<Navigate to="/settings?s=users" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
