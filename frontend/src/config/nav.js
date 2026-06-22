// Portal app catalog. Each entry is a card on the Portal landing page.
// `roles` (when present) limits visibility. `enabled: false` hides + blocks the
// module (soft launch — flip to true when ready to release that module).
// Keep `to` in sync with App.jsx.
export const apps = [
  {
    to: '/memos',
    title: 'บันทึก & อนุมัติ (E-Memo)',
    desc: 'จัดทำหนังสือ ออกเลขอัตโนมัติ และอนุมัติออนไลน์พร้อมลายเซ็น',
    icon: 'document',
    color: 'bg-blue-50 text-blue-600',
    enabled: true,
  },
  {
    to: '/performance',
    title: 'รายงานการปฏิบัติงาน',
    desc: 'บันทึกงานรายวัน + OT รายหน่วยงาน พร้อมแดชบอร์ดความครบถ้วน',
    icon: 'chart',
    color: 'bg-emerald-50 text-emerald-600',
    enabled: false, // soft-launch: เปิดเฉพาะ E-Memo ก่อน
  },
  {
    to: '/credit',
    title: 'วงเงินสินเชื่อโครงการ',
    desc: 'ติดตามวงเงิน การเบิกใช้ คำขออนุมัติ และแผนกระแสเงินสด',
    icon: 'card',
    color: 'bg-amber-50 text-amber-600',
    roles: ['admin', 'executive'], // financial data — restricted
    enabled: false,
  },
  {
    to: '/onboarding',
    title: 'แนะแนวพนักงานใหม่ 90 วัน',
    desc: 'คลังข้อมูล แผน 30-60-90 วัน และแบบประเมินทดลองงาน',
    icon: 'cap',
    color: 'bg-violet-50 text-violet-600',
    enabled: false,
  },
  {
    to: '/admin',
    title: 'ตั้งค่าระบบ',
    desc: 'จัดการผู้ใช้ โครงการ ประเภทเอกสาร และหัวจดหมาย',
    icon: 'settings',
    color: 'bg-slate-100 text-slate-600',
    roles: ['admin'],
    enabled: true, // admin ต้องตั้งค่า E-Memo (โครงการ/หัวจดหมาย/ผู้ใช้)
  },
];

/** Paths of modules that are turned off (for route guards). */
export const disabledPaths = apps.filter((a) => a.enabled === false).map((a) => a.to);

// path → module title, for the ModuleShell header.
export const moduleTitles = {
  '/memos': 'บันทึก & อนุมัติ (E-Memo)',
  '/performance': 'รายงานการปฏิบัติงาน',
  '/credit': 'วงเงินสินเชื่อโครงการ',
  '/onboarding': 'แนะแนวพนักงานใหม่',
  '/admin': 'ตั้งค่าระบบ',
  '/dashboard': 'ภาพรวม E-Memo',
};

export const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  hr: 'เจ้าหน้าที่ HR',
};
