/**
 * App identity and module taxonomy.
 *
 * The Thai names, descriptions and changelog below are carried over VERBATIM
 * from the canonical index.html via the old config.ts. They are business copy —
 * do not reword them.
 *
 * The I18N chrome strings that used to live here now live in src/i18n/dict.js,
 * reached through the shared I18nProvider, so this file holds only data that is
 * not a UI string: the module list, the module hero copy (which is bilingual
 * DATA, keyed by module rather than by dot key), and the About panel's metadata.
 */

export const DEV_NAME  = 'Chavananand';
export const DEV_EMAIL = 'c.chavananand@vcb-con.com';
export const APP_VERSION = 'build 34 · 2026-08-29';
export const CHANGELOG = [
    { th:'หน้าต่างแก้ไขกรณีเป็นแบบเต็มจอ · ทุกช่องอยู่ในหน้าเดียว ไม่ต้องเลื่อน', en:'The case editor is now full-screen — every field fits on one page, no scrolling' },
    { th:'ตั้งชื่อไฟล์แนบได้ · วางลิงก์ Drive แล้วชื่อไฟล์เติมให้อัตโนมัติ (แก้ไขได้)', en:'Name your attachments — pasting a Drive link fills the name in automatically, and you can edit it' },
    { th:'แก้สีตัวอักษรในโหมดกลางคืนที่อ่านไม่ออกในบางจุด', en:'Fixed text that was unreadable in dark mode in a few places' },
    { th:'แชร์ลิงก์ไปยังกรณีเฉพาะแต่ละเรื่องได้โดยตรง (ปุ่ม "แชร์" ในหน้ารายละเอียด)', en:'Share a direct link to any single case study (the "Share" button on its detail page)' },
    { th:'ปรับดีไซน์ใหม่ให้ดูมืออาชีพ ใช้ไอคอนเส้น (SVG) แทนอีโมจิทั้งหมด', en:'Refined-corporate redesign — inline SVG line icons replace all emoji' },
    { th:'อีเมลติดต่อเปลี่ยนเป็นแบบกดเพื่อคัดลอก (ไม่เปิดโปรแกรมอีเมล)', en:'Contact email is now click-to-copy (no longer opens a mail app)' },
    { th:'เมนูทั้งสามรูปแบบเดียวกัน · ผังกระบวนการและกรณีเฉพาะเลือกตามหมวดได้ · หัวข้อหลัก = ดูทั้งหมด', en:'Unified 3-branch nav; Process Flows & Case Studies filter by module; root = All' },
    { th:'หน้าแรกแสดงข้อมูลภาพรวมทางขวา', en:'Landing page shows an overview on the right' },
    { th:'เพิ่มเมนูผังกระบวนการ (Process Flows) ครบ 33 ผัง', en:'Added Process Flows — all 33 workflow diagrams' },
    { th:'เพิ่มส่วนติดต่อผู้พัฒนา เวอร์ชัน และการอัปเดตในหน้าตั้งค่า', en:'Added developer contact, version and updates in Settings' }
  ];

export const MODULES = {
    PO:'จัดซื้อ', IC:'คลังสินค้า', AP:'เจ้าหนี้/จ่าย', FA:'ทรัพย์สิน',
    PM:'โครงการ', OF:'เบิกจ่าย', GL:'บัญชีแยกประเภท', AR:'ลูกหนี้/รับ',
    BD:'งบประมาณ', FIN:'การเงิน', SE:'ตั้งค่าระบบ'
  };

export const MODULE_INFO = {
    BD: { nameTH: 'ระบบการประมูล (BD)', nameEN: 'Bidding System',
          descTH: 'วางแผนงบประมาณจาก BOQ และกำหนดรหัสต้นทุน (Cost Code) เพื่อเปรียบเทียบกำไร-ขาดทุนก่อนเริ่มโครงการ',
          descEN: 'Manage tenders, budgets, and bid evaluations in one place. Award projects with greater confidence.' },
    OF: { nameTH: 'ระบบบริการสำนักงาน (OF)', nameEN: 'Office Service System',
          descTH: 'จัดการใบขอซื้อ (PR) เบิกเงินสดย่อย และติดตามผลงานผู้รับเหมาจากหน้างานได้ทันทีผ่านมือถือ',
          descEN: 'Handle internal requests, subcontractor workflows, and approvals faster. Keep progress claims organized and controlled.' },
    PO: { nameTH: 'ระบบใบสั่งซื้อ (PO)', nameEN: 'Purchase Order System',
          descTH: 'เปรียบเทียบราคาคู่ค้าและออกใบสั่งซื้อ (PO) พร้อมระบบแจ้งเตือนเมื่อการใช้จ่ายเกินงบประมาณที่ตั้งไว้',
          descEN: 'Simplify purchasing and supplier evaluation. Improve procurement speed, accuracy, and control.' },
    FA: { nameTH: 'ระบบทรัพย์สินถาวร (FA)', nameEN: 'Fixed Asset System',
          descTH: 'ทำทะเบียนทรัพย์สินและคำนวณค่าเสื่อมราคาอัตโนมัติ พร้อมติดตามการโอนย้ายทรัพย์สินระหว่างโครงการอย่างเป็นระบบ',
          descEN: 'Track assets, maintenance, and depreciation with ease. Keep records accurate and up to date.' },
    IC: { nameTH: 'ระบบควบคุมสินค้าคงคลัง (IC)', nameEN: 'Inventory Control System',
          descTH: 'ติดตามการเบิก-จ่ายวัสดุรายโครงการ และตรวจสอบยอดวัสดุคงเหลือแบบ Real-time เพื่อป้องกันการสูญหาย คุมต้นทุนการเบิกของได้',
          descEN: 'Monitor receiving, stock movements, and project transfers. Improve traceability and inventory accuracy.' },
    GL: { nameTH: 'ระบบสมุดรายวันทั่วไป (GL)', nameEN: 'General Ledger System',
          descTH: 'รักษาระเบียนทางการเงินให้แม่นและจัดระเบียบได้ดี สนับสนุนการรายงานและการ reconciliation ที่ราบรื่น',
          descEN: 'Keep financial records accurate and well organized. Support smooth reporting and reconciliation.' },
    PM: { nameTH: 'ระบบจัดการโครงการ (PM)', nameEN: 'Project Management System',
          descTH: 'สรุปภาพรวมสถานะโครงการแบบ Dashboard เปรียบเทียบแผนงานและต้นทุนจริงสำหรับผู้บริหาร',
          descEN: 'Track project progress and key updates in one view. Support faster, better management decisions.' },
    FIN: { nameTH: 'ระบบการเงิน (FIN)', nameEN: 'Finance System',
          descTH: 'วิเคราะห์กระแสเงินสด (Cash Flow) และรายงานสถานะการรับ-จ่ายเงินของทุกโครงการได้ในหน้าจอเดียว ดูรายละเอียดชัดเจนว่ายอดเงินมาจากเอกสารฉบับใด',
          descEN: 'Monitor cash flow and financial performance clearly. Plan ahead with better financial visibility.' },
    AP: { nameTH: 'ระบบบัญชี (AP)', nameEN: 'Accounting System — Payables',
          descTH: 'บันทึกข้อมูลบัญชีรับ-จ่ายและภาษีที่เชื่อมโยงกับต้นทุนโครงการโดยตรง เพื่อความถูกต้องและแม่นยำสูงสุด',
          descEN: 'Manage payables, receivables, billing, and payments efficiently. Gain better accuracy and financial control.' },
    AR: { nameTH: 'ระบบบัญชี (AR)', nameEN: 'Accounting System — Receivables',
          descTH: 'บันทึกข้อมูลบัญชีรับ-จ่ายและภาษีที่เชื่อมโยงกับต้นทุนโครงการโดยตรง เพื่อความถูกต้องและแม่นยำสูงสุด',
          descEN: 'Manage payables, receivables, billing, and payments efficiently. Gain better accuracy and financial control.' },
    SE: { nameTH: 'ตั้งค่าระบบ (SE)', nameEN: 'System Settings',
          descTH: 'กำหนดค่าระบบ ข้อมูลหลัก และสิทธิ์การเข้าถึง',
          descEN: 'Configure system preferences, master data, and access rights.' }
  };

export const MODULES_EN = {
    PO:'Purchasing', IC:'Inventory', AP:'Payables', FA:'Fixed Assets',
    PM:'Projects', OF:'Office Service', GL:'General Ledger', AR:'Receivables',
    BD:'Bidding', FIN:'Finance', SE:'Settings'
  };

/** Sidebar / selector order. Object key order is relied on in several places;
 * naming it here makes that dependency explicit rather than incidental. */
export const MODULE_ORDER = Object.keys(MODULES);

/** Per-module accent colours — the same values the old .m-XX CSS rules carried,
 * and the same ones mirrored into tailwind.config.js as `colors.mod`. Used as
 * an inline --mc custom property where the module is only known at runtime. */
export const MODULE_COLORS = {
  PO: '#2563eb', IC: '#0891b2', AP: '#9333ea', FA: '#c2410c',
  PM: '#0d9488', OF: '#ca8a04', GL: '#dc2626', AR: '#db2777',
  BD: '#4f46e5', SE: '#475569', FIN: '#059669', RP: '#0b3d62',
};

/** The accent for a module code, falling back to brand blue for an unknown one
 * (the SOP document is free-form JSON — a module code that is not in MODULES is
 * possible and must not crash a card). */
export function moduleColor(code) {
  return MODULE_COLORS[code] || '#1D4E89';
}

/** Localised short label for a module code. */
export function moduleLabel(code, lang) {
  return (lang === 'en' ? MODULES_EN[code] : MODULES[code]) || code;
}
