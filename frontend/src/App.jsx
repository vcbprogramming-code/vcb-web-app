import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ModulePlaceholder from './pages/ModulePlaceholder.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />

        <Route
          path="memos"
          element={
            <ModulePlaceholder
              moduleNo={1}
              title="ระบบบันทึกข้อความและอนุมัติอิเล็กทรอนิกส์"
              features={[
                'แบบฟอร์มขออนุมัติสำเร็จรูป (ทั่วไป / OT / จัดซื้อ-เบิกจ่าย)',
                'ออกเลขที่เอกสารอัตโนมัติ พร้อมแนบไฟล์',
                'เส้นทางอนุมัติแบบลำดับขั้น (ผู้ขอ → อนุมัติ 1 → 2 → …)',
                'แจ้งเตือนทางอีเมล พร้อมปุ่มอนุมัติ/ไม่อนุมัติ/ส่งกลับแก้ไข',
                'ลายเซ็นอิเล็กทรอนิกส์ + ตราเวลา',
                'Audit Trail และจัดเก็บเป็น PDF ค้นย้อนหลังได้',
              ]}
            />
          }
        />

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
              <ModulePlaceholder
                moduleNo={0}
                title="ตั้งค่าระบบ"
                features={[
                  'จัดการผู้ใช้และสิทธิ์การเข้าถึง',
                  'จัดการหน่วยงาน / แผนก / ตำแหน่ง',
                  'ตั้งค่าเส้นทางการอนุมัติ',
                ]}
              />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
