import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ModulePlaceholder from './pages/ModulePlaceholder.jsx';
import DocumentRegister from './pages/ememo/DocumentRegister.jsx';
import DocumentDetail from './pages/ememo/DocumentDetail.jsx';
import ApprovalAction from './pages/ememo/ApprovalAction.jsx';
import Settings from './pages/admin/Settings.jsx';

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
        <Route index element={<Dashboard />} />

        <Route path="memos" element={<DocumentRegister />} />
        <Route path="memos/:id" element={<DocumentDetail />} />

        <Route
          path="performance"
          element={
            <ModulePlaceholder
              moduleNo={2}
              title="ระบบรายงานและวิเคราะห์การปฏิบัติงาน"
              features={[
                'ทะเบียนหลัก: หน่วยงาน / แผนก / ตำแหน่ง / พนักงาน',
                'บันทึกการปฏิบัติงานรายวัน + ข้อมูล OT (ชม./อัตรา/เงิน/เหตุผล)',
                'โหมดกรอกเร็ว: หลายคน / คัดลอกวันก่อน / นำเข้า Excel',
                'แจ้งเตือนวันที่ยังไม่บันทึก และสถานะความครบถ้วน',
                'Dashboard รายเดือน เปรียบเทียบ 5 หน่วยงาน + กราฟ',
                'ส่งออกรายงาน Excel / PDF',
              ]}
            />
          }
        />

        <Route
          path="credit"
          element={
            <ProtectedRoute roles={['admin', 'executive']}>
              <ModulePlaceholder
                moduleNo={3}
                title="ระบบบันทึกข้อมูลวงเงินสินเชื่อโครงการ"
                features={[
                  'ทะเบียนโครงการ',
                  'วงเงินสินเชื่อรายโครงการ (หลายวงเงิน/หลายสถาบัน)',
                  'ติดตามการเบิกใช้ (Drawdown) และการชำระคืน',
                  'คำนวณวงเงินคงเหลืออัตโนมัติ',
                  'Audit Trail การแก้ไขข้อมูล',
                  'ควบคุมสิทธิ์การเข้าถึงข้อมูลการเงิน',
                ]}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="onboarding"
          element={
            <ModulePlaceholder
              moduleNo={4}
              title="ระบบแนะแนวและติดตามพนักงานใหม่ 90 วัน"
              features={[
                'คลังข้อมูลพนักงานใหม่ (นโยบาย/สวัสดิการ/คู่มือ/เอกสารลงนาม)',
                'แผนแนะแนว 30-60-90 วัน',
                'ติดตามผลความคืบหน้า',
                'แบบประเมินทดลองงาน',
              ]}
            />
          }
        />

        <Route
          path="admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
