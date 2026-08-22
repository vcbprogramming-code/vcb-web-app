// Portal app catalog. Each entry is a card on the Portal landing page.
// `roles` (when present) limits visibility. `enabled: false` hides + blocks the
// module (soft launch — flip to true when ready to release that module).
// Keep `to` in sync with App.jsx.
export const apps = [
  {
    to: '/memos',
    title: 'บันทึก & อนุมัติ (E-Memo)',
    // The sidebar is narrower than a card, and the full title was being cut to
    // "บันทึก & อนุมัติ (E-Me…" there.
    navTitle: 'บันทึก & อนุมัติ',
    desc: 'จัดทำหนังสือ ออกเลขอัตโนมัติ และอนุมัติออนไลน์พร้อมลายเซ็น',
    icon: 'document',
    color: 'bg-blue-50 text-blue-600',
    perm: ['ememo', 'view'], // hidden when the user's ememo.view is turned off
    enabled: true,
  },
  {
    // the path stays /performance: it's an internal name, and changing it would
    // break saved links and every stored permission key for no user benefit.
    to: '/performance',
    title: 'บันทึกงานฝ่ายบุคคล',
    desc: 'บันทึกงานที่พนักงานแต่ละคนทำในแต่ละวัน แยกตามไซต์งาน',
    icon: 'userClock',
    color: 'bg-emerald-50 text-emerald-600',
    enabled: true, // live (Module 2 — hr-worklog)
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
  // Settings is now ONE page for everything (system + per-module + your own
  // signature), so the Portal shows a single card instead of one per screen.
  {
    to: '/settings',
    title: 'ตั้งค่า',
    desc: 'ผู้ใช้และสิทธิ์ · โครงการ/หัวจดหมาย · ประเภทเอกสาร · โปรไฟล์และลายเซ็นของฉัน',
    icon: 'settings',
    color: 'bg-slate-100 text-slate-600',
    roles: ['admin'],
    enabled: true,
  },
  {
    to: '/sop',
    title: 'คู่มือปฏิบัติงาน (SOP)',
    desc: 'ระเบียบปฏิบัติมาตรฐาน ERP — กรณีศึกษา ผังกระบวนการ และเมนูรายงาน',
    icon: 'book',
    color: 'bg-indigo-50 text-indigo-600',
    perm: ['sop', 'view'],
    enabled: true,
  },
  {
    to: '/sysmap',
    title: 'แผนผังระบบ (System Map)',
    desc: 'กระบวนการทำงานของกลุ่ม ทะเบียนฟังก์ชันรายแผนก และจุดที่ใช้ AI ช่วยได้',
    icon: 'sysmap',
    color: 'bg-pink-50 text-pink-600',
    perm: ['sysmap', 'view'],
    enabled: true,
  },
];

/** Paths of modules that are turned off (for route guards). */
export const disabledPaths = apps.filter((a) => a.enabled === false).map((a) => a.to);

// path → module title, for the ModuleShell header.
export const moduleTitles = {
  '/memos': 'บันทึก & อนุมัติ (E-Memo)',
  '/performance': 'บันทึกงานฝ่ายบุคคล',
  '/credit': 'วงเงินสินเชื่อโครงการ',
  '/onboarding': 'แนะแนวพนักงานใหม่',
  '/settings': 'ตั้งค่า',
  '/sop': 'คู่มือปฏิบัติงาน (SOP)',
  '/dashboard': 'ภาพรวม E-Memo',

};

export const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  hr: 'เจ้าหน้าที่ HR',
};
