// Portal app catalog. Each entry is a card on the Portal landing page.
// `roles` (when present) limits visibility. `enabled: false` hides + blocks the
// module (soft launch — flip to true when ready to release that module).
// Keep `to` in sync with App.jsx.
//
// ชื่อ คำบรรยาย (desc) และคำบรรยายยาว (preview) ถอดมาจากพจนานุกรม I18N.th.apps
// ของพอร์ทัลที่บริษัทใช้อยู่จริงแบบตรงตัว เพื่อให้คนที่ย้ายจากระบบเดิมมาเห็น
// คำเดียวกัน ข้อยกเว้นเดียวคือการ์ด E-Memo ที่คงชื่อของเราไว้ตามที่ตกลงกัน
// (ของเขาเรียก "อีเมโม")
//
// `group` บอกว่าเมนูข้างและตารางการ์ดจะจัดไว้กลุ่มไหน — 'main' คือหกแอปหลัก
// ที่ระบบจริงนับเป็น "แอปพลิเคชัน" ส่วน 'more' คือของที่เขาแยกไว้ใต้ "เพิ่มเติม"
// ลำดับในไฟล์นี้คือลำดับที่แสดง และเรียงตาม APPS ของเขา
export const apps = [
  {
    to: '/memos',
    group: 'main',
    title: 'บันทึก & อนุมัติ (E-Memo)',
    // The sidebar is narrower than a card, and the full title was being cut to
    // "บันทึก & อนุมัติ (E-Me…" there.
    navTitle: 'บันทึก & อนุมัติ',
    desc: 'ควบคุมเอกสาร การออกบันทึกข้อความ และขั้นตอนการอนุมัติ ระหว่างโครงการและสำนักงานใหญ่',
    preview: 'รวมเอกสารและบันทึกข้อความของบริษัทไว้ในที่เดียว พร้อมขั้นตอนการออกและอนุมัติที่เป็นระบบ ทำให้ทุกฉบับมีเวอร์ชันที่ตรวจสอบย้อนกลับได้และค้นหาได้ง่ายในภายหลัง',
    icon: 'document',
    color: 'bg-blue-50 text-blue-600',
    perm: ['ememo', 'view'], // hidden when the user's ememo.view is turned off
    enabled: true,
  },
  {
    to: '/meetings',
    group: 'main',
    title: 'รายงานการประชุม',
    desc: 'บันทึกการประชุม มติที่ประชุม และการติดตามงานที่ได้รับมอบหมาย',
    preview: 'บันทึกรายละเอียดและมติที่ประชุมทันทีที่เกิดขึ้น พร้อมติดตามงานที่ได้รับมอบหมายจนเสร็จสิ้น เพื่อให้ข้อตกลงจากที่ประชุมไม่ถูกลืมหรือตกหล่น',
    icon: 'chat',
    color: 'bg-amber-50 text-amber-600',
    perm: ['meetings', 'view'],
    enabled: true,
  },
  {
    to: '/sop',
    group: 'main',
    title: 'มาตรฐานการปฏิบัติงาน',
    desc: 'เรียกดู ค้นหา และควบคุมเวอร์ชันเอกสาร SOP ของบริษัท',
    preview: 'เป็นคลังขั้นตอนการปฏิบัติงานมาตรฐานที่ค้นหาได้สำหรับทุกทีม พร้อมควบคุมเวอร์ชัน เพื่อให้พนักงานทำงานตามขั้นตอนที่อนุมัติล่าสุดเสมอ ไม่ใช่ฉบับที่ล้าสมัย',
    icon: 'book',
    color: 'bg-indigo-50 text-indigo-600',
    perm: ['sop', 'view'],
    enabled: true,
  },
  {
    to: '/sysmap',
    group: 'main',
    title: 'แผนผังระบบ',
    desc: 'แผนผังเชื่อมโยงระบบและแอปพลิเคชันต่าง ๆ ของ VCB Group',
    preview: 'แสดงภาพรวมการเชื่อมโยงหน้าที่งานของแต่ละฝ่ายทั่วทั้ง VCB Group ทำให้เห็นความเชื่อมโยงของงานและความรับผิดชอบระหว่างทีมต่าง ๆ ได้ในทันที',
    icon: 'sysmap',
    color: 'bg-pink-50 text-pink-600',
    perm: ['sysmap', 'view'],
    enabled: true,
  },
  {
    // the path stays /performance: it's an internal name, and changing it would
    // break saved links and every stored permission key for no user benefit.
    to: '/performance',
    group: 'main',
    title: 'บันทึกงานฝ่ายบุคคล',
    desc: 'การลงเวลา บันทึกงาน และตารางเวลาทำงานสำหรับทีม HR',
    preview: 'ให้ทีม HR ลงเวลา บันทึกงานประจำวัน และจัดตารางเวลาทำงานไว้ในระบบเดียว แทนที่ไฟล์ Excel ที่กระจัดกระจาย เพื่อให้มีบันทึกข้อมูลการทำงานของทีมที่ถูกต้องและเป็นระบบ',
    icon: 'userClock',
    color: 'bg-emerald-50 text-emerald-600',
    enabled: true, // live (Module 2 — hr-worklog)
  },
  {
    to: '/credit',
    group: 'main',
    title: 'ระบบจัดการวงเงินสินเชื่อ',
    desc: 'วงเงินสินเชื่อ การเบิกถอน คำขอ และการอนุมัติ',
    preview: 'บริหารจัดการวงเงินสินเชื่อของบริษัทกับธนาคารครบวงจร ตั้งแต่วงเงิน การเบิกถอน คำขอ ไปจนถึงการอนุมัติ ให้ทีมการเงินเห็นสถานะวงเงินสินเชื่อกับแต่ละธนาคารได้ชัดเจนและตรวจสอบย้อนกลับได้',
    icon: 'card',
    color: 'bg-amber-50 text-amber-600',
    perm: ['credit', 'view'], // financial data — off for everyone but admin/executive by default,
    enabled: true,            // and grantable per person from ตั้งค่า → ผู้ใช้
  },
  {
    // การ์ดพาไปที่ "โปรแกรม" ที่พนักงานใหม่เดินเอง ไม่ใช่เครื่องมือฝั่ง HR ที่
    // /onboarding — อันนั้นยังอยู่ แต่คนที่กดจากหน้าแรกคือพนักงานใหม่
    to: '/onboarding/program',
    group: 'more',
    title: 'ปฐมนิเทศพนักงานใหม่',
    // ระบบจริงเรียกเมนูนี้ว่า "พอร์ทัลปฐมนิเทศ" — ใช้คำของเขาในเมนูข้าง
    navTitle: 'พอร์ทัลปฐมนิเทศ',
    desc: 'การปฐมนิเทศและต้อนรับพนักงานใหม่',
    preview: 'โปรแกรม 90 วัน · เอกสารที่ต้องส่ง แผนกที่สังกัด และรายการที่ต้องทำแต่ละช่วง',
    icon: 'cap',
    color: 'bg-violet-50 text-violet-600',
    enabled: true,
  },
  // Settings is now ONE page for everything (system + per-module + your own
  // signature), so the Portal shows a single card instead of one per screen.
  {
    to: '/settings',
    group: 'more',
    title: 'ตั้งค่า',
    desc: 'ผู้ใช้และสิทธิ์ · โครงการ/หัวจดหมาย · ประเภทเอกสาร · โปรไฟล์และลายเซ็นของฉัน',
    icon: 'settings',
    color: 'bg-slate-100 text-slate-600',
    roles: ['admin'],
    enabled: true,
  },
];

/** Paths of modules that are turned off (for route guards). */
export const disabledPaths = apps.filter((a) => a.enabled === false).map((a) => a.to);

/** ทางลัดออกไปเว็บอื่น — คำบรรยายคือ tt_*_desc ของระบบจริง */
export const shortcuts = [
  {
    key: 'erp',
    label: 'ERP',
    icon: 'building',
    href: 'https://www.vcbcon.com/newproduction.anywhere/page/authentication/login/',
    tip: 'ไปที่ระบบ Mango ERP — สำหรับคำขอซื้อ คำขอเบิกเงินสด และธุรกรรมเชิงตัวเลขอื่น ๆ',
  },
  {
    key: 'zoom',
    label: 'Zoom',
    icon: 'people',
    href: 'https://zoom.us/join',
    tip: 'เข้าร่วมประชุมผ่าน Zoom',
  },
];

// path → module title, for the ModuleShell header.
export const moduleTitles = {
  '/memos': 'บันทึก & อนุมัติ (E-Memo)',
  '/performance': 'บันทึกงานฝ่ายบุคคล',
  '/credit': 'ระบบจัดการวงเงินสินเชื่อ',
  '/onboarding': 'แนะแนวพนักงานใหม่',
  '/onboarding/program': 'ปฐมนิเทศพนักงานใหม่',
  '/settings': 'ตั้งค่า',
  '/sop': 'มาตรฐานการปฏิบัติงาน',
  // ชื่อการ์ดในพอร์ทัลของเขาคือ "แผนผังระบบ" ส่วนหัวในหน้าคือชื่อเต็ม
  '/sysmap': 'แผนผังการทำงานของระบบ',
  '/dashboard': 'ภาพรวม E-Memo',

};

export const roleLabels = {
  admin: 'ผู้ดูแลระบบ',
  executive: 'ผู้บริหาร',
  hr: 'เจ้าหน้าที่ HR',
  recorder: 'ผู้บันทึกข้อมูลหน้างาน',
  verifier: 'ผู้ตรวจสอบโครงการ',
};

/**
 * ป้ายบทบาทบนหน้าหลัก — ระบบจริงมีแค่สามค่า: พนักงาน / แอดมิน / ผู้เยี่ยมชม
 * (roleLabels ด้านบนยังใช้ในหัวโมดูล ซึ่งต้องละเอียดกว่านี้)
 */
export const portalRoleLabel = (role) =>
  (!role ? 'ผู้เยี่ยมชม' : role === 'admin' ? 'แอดมิน' : 'พนักงาน');
