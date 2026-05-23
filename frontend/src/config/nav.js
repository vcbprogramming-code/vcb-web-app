// Central navigation definition. `roles` (when present) limits visibility.
// Keep route paths in sync with the <Route> definitions in App.jsx.
export const navItems = [
  { to: '/', label: 'ภาพรวม', icon: '📊', end: true },
  {
    to: '/memos',
    label: 'บันทึก & อนุมัติ (E-Memo)',
    icon: '📝',
    module: 1,
  },
  {
    to: '/performance',
    label: 'รายงานการปฏิบัติงาน',
    icon: '📈',
    module: 2,
  },
  {
    to: '/credit',
    label: 'วงเงินสินเชื่อโครงการ',
    icon: '💳',
    module: 3,
    roles: ['admin', 'executive'], // financial data — restricted
  },
  {
    to: '/onboarding',
    label: 'แนะแนวพนักงานใหม่',
    icon: '🎓',
    module: 4,
  },
  {
    to: '/admin',
    label: 'ตั้งค่าระบบ',
    icon: '⚙️',
    roles: ['admin'],
  },
];

export const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  hr: 'เจ้าหน้าที่ HR',
};
