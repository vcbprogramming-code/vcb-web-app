import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import ModuleShell from './components/ModuleShell.jsx';
import Login from './pages/Login.jsx';
import Portal from './pages/Portal.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DocumentRegister from './pages/ememo/DocumentRegister.jsx';
import DocumentDetail from './pages/ememo/DocumentDetail.jsx';
import ApprovalAction from './pages/ememo/ApprovalAction.jsx';
import Settings from './pages/admin/Settings.jsx';
import Performance from './pages/performance/Performance.jsx';
import CreditFacility from './pages/credit/CreditFacility.jsx';
import Onboarding from './pages/onboarding/Onboarding.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* public approval page — reached from the email link, no login */}
      <Route path="/approve/:token" element={<ApprovalAction />} />

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

          <Route path="performance" element={<Performance />} />

          <Route
            path="credit"
            element={
              <ProtectedRoute roles={['admin', 'executive']}>
                <CreditFacility />
              </ProtectedRoute>
            }
          />

          <Route path="onboarding" element={<Onboarding />} />

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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
