/**
 * App identity, module taxonomy, and the i18n dictionary — extracted
 * VERBATIM from index.html. Drives the language toggle, sidebar labels,
 * module heroes, settings 'about', and all UI chrome strings.
 */
/* eslint-disable */

export type Lang = 'th' | 'en';
type Fmt = (...a: any[]) => string;
type Dict = Record<string, string | Fmt>;

export const DEV_NAME  = 'Chavananand';
export const DEV_EMAIL = 'c.chavananand@vcb-con.com';
export const APP_VERSION = 'build 26 · 2026-06-03';
export const CHANGELOG = [
    { th:'ปรับดีไซน์ใหม่ให้ดูมืออาชีพ ใช้ไอคอนเส้น (SVG) แทนอีโมจิทั้งหมด', en:'Refined-corporate redesign — inline SVG line icons replace all emoji' },
    { th:'อีเมลติดต่อเปลี่ยนเป็นแบบกดเพื่อคัดลอก (ไม่เปิดโปรแกรมอีเมล)', en:'Contact email is now click-to-copy (no longer opens a mail app)' },
    { th:'เมนูทั้งสามรูปแบบเดียวกัน · ผังกระบวนการและกรณีศึกษาเลือกตามหมวดได้ · หัวข้อหลัก = ดูทั้งหมด', en:'Unified 3-branch nav; Process Flows & Case Studies filter by module; root = All' },
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

export const I18N: Record<Lang, Dict> = {
    th: {
      moduleLabel:'หมวด (Module)', referenceLabel:'อ้างอิง (Reference)',
      allTitle:'ทั้งหมด', allDesc:'ทุกกรณีศึกษา',
      reportsTitle:'วิธีเรียก Report', reportsDesc:'เมนูเรียกรายงานสำคัญ',
      reportsHeader:'วิธีเรียก Report',
      reportsSubFmt:function(n,t){return 'เมนูเรียกรายงานสำคัญทั้งหมด · '+n+' จาก '+t+' รายการ';},
      reportsCol1:'#', reportsCol2:'ต้องการตรวจสอบอะไร', reportsCol3:'เมนูที่ใช้ · Menu Path',
      searchPh:'ค้นหา… น้ำมัน, Advance, PO, เช็ค, โอนเงิน',
      showingFmt:function(n,t){return 'แสดง '+n+' จาก '+t+' กรณี';},
      noResults:'ไม่พบรายการที่ค้นหา',
      noScenarios:'ยังไม่มีกรณีศึกษาในหมวดนี้ · No scenarios in this module yet',
      noResultsRep:'ไม่พบรายงานที่ค้นหา',
      problemLbl:'ปัญหา / สถานการณ์ · Problem',
      solutionLbl:'แนวทางปฏิบัติ · Solution (SOP)',
      noteLbl:'หมายเหตุ:',
      editBtn:'แก้ไข · Edit',
      backList:'รายการ · List', backModules:'หมวด · Modules',
      menuLang:'ภาษา · Language', menuNight:'โหมดกลางคืน · Night mode', menuSync:'ดึงข้อมูลใหม่ · Sync from Doc',
      langName:'ไทย', nightOn:'เปิด', nightOff:'ปิด',
      settingsTitle:'การตั้งค่า · Settings',
      signedInLbl:'เข้าใช้งานในชื่อ · SIGNED IN AS',
      displayHdr:'การแสดงผล · DISPLAY',
      themeLbl:'โหมดสี · Theme', themeLight:'สว่าง · Light', themeDark:'มืด · Dark',
      langLbl:'ภาษา · Language',
      signOutLbl:'ออกจากระบบ · Sign out',
      purposeHdr:'วัตถุประสงค์และขอบเขต · Purpose & Scope',
      notesHdr:'หมายเหตุ · Notes',
      versionLbl:'เวอร์ชัน: ', effectiveLbl:'มีผล: ',
      casesSuffix:' กรณีศึกษา', reportsSuffix:' รายงาน',
      ht1Title:'เลือกหมวด (ซ้าย)', ht1Desc:'คลิกหมวดในแถบซ้าย เช่น PO, IC, AP หรือ "ทั้งหมด" เพื่อดูรายการกรณีในหมวดนั้น',
      ht2Title:'เลือกกรณี (กลาง)', ht2Desc:'คลิกการ์ดของกรณีศึกษาตรงกลาง เพื่อเปิดดูปัญหาและแนวทางปฏิบัติฉบับเต็ม',
      ht3Title:'อ่านรายละเอียด (ขวา)', ht3Desc:'ปัญหา/สถานการณ์ และขั้นตอนปฏิบัติทั้งหมดจะแสดงในแถบนี้ พร้อมอ้างอิงคู่มือ',
      homeHeading:'คู่มือปฏิบัติงานระบบ VCB-MANGO ERP',
      homeLead:'รวมขั้นตอนการปฏิบัติงานมาตรฐาน (SOP) สำหรับการใช้งานระบบ ERP ของบริษัท ใช้เป็นแนวทางอ้างอิงในการทำงานแต่ละขั้นตอน',
      defaultViewLbl:'หน้าเริ่มต้น · Default view',
      defaultViewHint:'เลือกหมวดที่จะเปิดโดยอัตโนมัติเมื่อเข้าใช้งานครั้งถัดไป',
      flowsTitle:'ผังกระบวนการ', flowsDesc:'Process Flow ทุกขั้นตอน', flowsAllDesc:'ผังทั้งหมด',
      caseStudiesTitle:'กรณีศึกษา', caseStudiesDesc:'Case Studies · ตามหมวด',
      backToPortal:'กลับไปหน้าหลัก VCB Connect',
      flowsHeader:'ผังกระบวนการ · Process Flows',
      showingFlowsFmt:function(n,tt){return 'แสดง '+n+' จาก '+tt+' ผัง';},
      flowStepsLbl:'รายละเอียดขั้นตอน · Process',
      flowsIntroTitle:'ผังกระบวนการทำงาน · Process Flows',
      flowsIntroLead:'แผนผังขั้นตอนการทำงานในระบบ ERP แยกตามโมดูล เลือกผังจากรายการเพื่อดูลำดับขั้นตอนและผู้รับผิดชอบในแต่ละขั้น',
      flowLegNormal:'ขั้นตอนปกติ', flowLegApprove:'ส่งอนุมัติ', flowLegYes:'อนุมัติ (Yes)', flowLegReject:'ตีกลับ (Reject)',
      aboutHdr:'เกี่ยวกับ · ABOUT',
      contactHdr:'ติดต่อ / สอบถาม · CONTACT',
      developerLbl:'ผู้พัฒนา · Developer',
      contactLbl:'ติดต่อ / สอบถาม · Contact developer',
      versionTag:'เวอร์ชัน · Version',
      updatesLbl:'อัปเดตล่าสุด · Updates',
      contactSubject:'[Mango ERP SOP] สอบถาม / แจ้งปัญหา'
    },
    en: {
      moduleLabel:'Modules', referenceLabel:'Reference',
      allTitle:'All', allDesc:'All scenarios',
      reportsTitle:'Reports', reportsDesc:'Common report menu paths',
      reportsHeader:'Reports',
      reportsSubFmt:function(n,t){return 'Common report menu paths · '+n+' of '+t+' items';},
      reportsCol1:'#', reportsCol2:'What to check', reportsCol3:'Menu Path',
      searchPh:'Search… oil, Advance, PO, cheque, transfer',
      showingFmt:function(n,t){return 'Showing '+n+' of '+t+' cases';},
      noResults:'No matching results',
      noScenarios:'No scenarios in this module yet',
      noResultsRep:'No matching reports',
      problemLbl:'Problem / Situation',
      solutionLbl:'Solution (SOP)',
      noteLbl:'Note:',
      editBtn:'Edit',
      backList:'List', backModules:'Modules',
      menuLang:'Language · ภาษา', menuNight:'Night mode', menuSync:'Sync from Doc',
      langName:'English', nightOn:'On', nightOff:'Off',
      settingsTitle:'Settings · การตั้งค่า',
      signedInLbl:'SIGNED IN AS',
      displayHdr:'DISPLAY · การแสดงผล',
      themeLbl:'Theme · โหมดสี', themeLight:'Light · สว่าง', themeDark:'Dark · มืด',
      langLbl:'Language · ภาษา',
      signOutLbl:'Sign out',
      purposeHdr:'Purpose & Scope',
      notesHdr:'Notes',
      versionLbl:'Version: ', effectiveLbl:'Effective: ',
      casesSuffix:' cases', reportsSuffix:' reports',
      ht1Title:'Pick a module (left)', ht1Desc:'Tap a module like PO, IC, AP or "All" to see scenarios in that module.',
      ht2Title:'Pick a case (middle)', ht2Desc:'Tap a case card to open the full problem and the step-by-step procedure.',
      ht3Title:'Read the details (right)', ht3Desc:'The problem statement and procedure steps appear here with a manual reference.',
      homeHeading:'VCB-MANGO ERP — Operating Procedures',
      homeLead:'Standard operating procedures (SOP) for using the company’s ERP system — your step-by-step reference for getting each task done correctly.',
      defaultViewLbl:'Default view · หน้าเริ่มต้น',
      defaultViewHint:'The module shown automatically next time you open the app.',
      flowsTitle:'Process Flows', flowsDesc:'All workflow diagrams', flowsAllDesc:'All flows',
      caseStudiesTitle:'Case Studies', caseStudiesDesc:'By module · กรณีศึกษา',
      backToPortal:'Back to VCB Connect home',
      flowsHeader:'Process Flows',
      showingFlowsFmt:function(n,tt){return 'Showing '+n+' of '+tt+' flows';},
      flowStepsLbl:'Process detail',
      flowsIntroTitle:'Process Flows',
      flowsIntroLead:'Step-by-step ERP workflow diagrams grouped by module. Pick a flow to see the sequence and who is responsible at each step.',
      flowLegNormal:'Step', flowLegApprove:'Submit', flowLegYes:'Approved (Yes)', flowLegReject:'Reject',
      aboutHdr:'About · เกี่ยวกับ',
      contactHdr:'Contact · ติดต่อ',
      developerLbl:'Developer · ผู้พัฒนา',
      contactLbl:'Contact developer · ติดต่อผู้พัฒนา',
      versionTag:'Version · เวอร์ชัน',
      updatesLbl:'Updates · อัปเดตล่าสุด',
      contactSubject:'[Mango ERP SOP] Question / issue report'
    }
  };

/** Look up a UI string (or format fn) for the active language, falling back to TH. */
export function tr(lang: Lang, key: string): any {
  return (I18N[lang] && I18N[lang][key]) ?? I18N.th[key] ?? '';
}
