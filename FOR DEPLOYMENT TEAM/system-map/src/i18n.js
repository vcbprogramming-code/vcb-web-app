/** System Operating Map — UI chrome dictionary.
 *
 *  Stable dot keys, { th, en } pairs, merged over shared/commonDictionary by
 *  <I18nProvider>. Thai is the default language (shared/src/i18n.jsx).
 *
 *  Two dictionaries, deliberately:
 *
 *    - THIS file is the UI chrome: buttons, tabs, column headings, hints —
 *      a fixed, small set of strings that belong in dot keys.
 *    - data/langTh.js is the map *content*: Thai for each of ~1,000 node,
 *      lane, document and registry records, keyed by the record's own id.
 *      lib/mapLang.js reads it. Re-keying that as dot keys would duplicate a
 *      structure the data already has.
 *
 *  Every Thai string carried over from LANG_TH.ui is byte-for-byte what the
 *  canonical Index.html shipped.
 *
 *  Keys marked NEW-TH below had NO Thai in the source: the original rendered
 *  them in English even with the language set to Thai. See PORT_NOTES.md.
 */
import { createDictionary } from '@vcb/shared';

export const dictionary = createDictionary({
  /* ── brand / shell ─────────────────────────────────────────────────────── */
  'app.brand': { th: 'VCB Group', en: 'VCB Group' },
  'app.title': { th: 'แผนผังการทำงานของระบบ', en: 'System Operating Map' },
  // Each language gets its own words. This held the OTHER language, so the
  // bar read "System Operating Map" in Thai mode and the Thai name in English.
  'app.subtitle': { th: 'แผนผังการทำงานของระบบ', en: 'System Operating Map' },
  'app.backToPortal': { th: 'กลับสู่ VCB Connect', en: 'Back to VCB Connect portal' },
  'app.version': { th: 'v8.86 · มิ.ย. 2026', en: 'v8.86 · Jun 2026' },

  /* ── header controls ───────────────────────────────────────────────────── */
  'hdr.layer': { th: 'เลเยอร์', en: 'Layer' },
  'hdr.dept': { th: 'แผนก', en: 'Dept' },
  'hdr.all': { th: 'ทั้งหมด', en: 'All' },
  'hdr.erp': { th: '⚙️ ERP', en: '⚙️ ERP' },
  'hdr.manual': { th: '📋 งานด้วยมือ', en: '📋 Manual' },
  'hdr.directFlow': { th: '— เส้นตรง', en: '— Direct Flow' },
  'hdr.indirect': { th: '╌ เส้นประ', en: '╌ Indirect' },
  'hdr.functions': { th: '📋 ทะเบียนฟังก์ชัน', en: '📋 Functions' },
  'hdr.returnToMap': { th: '↩ กลับสู่แผนที่', en: '↩ Return to Map' },
  'hdr.aiOpps': { th: '🤖 โอกาส AI', en: '🤖 AI Opps' },
  // NEW-TH: the clear-all button only ever had an English tooltip.
  'hdr.clearAll': {
    th: 'ล้างทั้งหมด — ยกเลิกการเลือก รีเซ็ตเส้น ล้างตัวกรอง ออกจากโหมดติดตาม',
    en: 'Clear all — deselect, reset lines, clear filters, exit trace',
  },

  /* ── legend ────────────────────────────────────────────────────────────── */
  'legend.key': { th: 'คำอธิบาย', en: 'Key' },
  // These two came from hardcoded literals in the original toggleLang().
  'legend.erpStep': { th: 'ขั้นตอน Mango ERP', en: 'ERP step (solid)' },
  'legend.manualStep': { th: 'งานด้วยมือ (ช่องว่าง)', en: 'Manual / off-ERP (dashed)' },
  // NEW-TH: the remaining six legend rows were English-only in the source.
  'legend.atSite': { th: 'ทำที่หน้างาน', en: 'Done at the site' },
  'legend.cornerDot': { th: 'จุดมุม = ผู้รับผิดชอบรอง', en: 'Corner dot = secondary owner' },
  'legend.direct': { th: 'เส้นทางตรง', en: 'Direct flow' },
  'legend.indirect': { th: 'ทางอ้อม / มีเงื่อนไข', en: 'Indirect / conditional' },
  'legend.feedback': { th: 'ย้อนกลับ / วนซ้ำ', en: 'Feedback / loop' },
  'legend.toConfirm': { th: 'รอยืนยัน (เบื้องต้น)', en: 'To confirm (indicative)' },

  /* ── sidebar ───────────────────────────────────────────────────────────── */
  'sb.clickHint': { th: 'คลิกโหนดใดก็ได้', en: 'Click any node' },
  // NEW-TH: the two-line empty-state hint was English-only.
  'sb.hintErp': {
    th: 'ขั้นตอน ERP แสดงรายละเอียดโมดูลและการเชื่อมต่อ',
    en: 'ERP steps show module detail and connections.',
  },
  'sb.hintManual': {
    th: 'งานด้วยมือแสดงงานที่คั่นระหว่างขั้นตอน ERP',
    en: 'Manual gaps show the work that bridges ERP steps.',
  },
  'sb.close': { th: '✕ ปิด', en: '✕ Close' },
  // NEW-TH: trace toggle was English-only.
  'sb.trace': { th: '⤢ ติดตาม', en: '⤢ Trace' },
  'sb.backToMap': { th: '↩ กลับสู่แผนที่', en: '↩ Back to Map' },
  'sb.traceTitle': { th: 'สลับโหมดติดตาม / แผนที่', en: 'Toggle trace / map' },
  'sb.steps': { th: 'ขั้นตอน', en: 'Steps' },
  'sb.tasks': { th: 'งาน', en: 'Tasks' },
  'sb.connections': { th: 'การเชื่อมต่อ', en: 'Connections' },
  'sb.aiTab': { th: '🤖 โอกาส AI', en: '🤖 AI Opps' },
  'sb.erpStep': { th: 'ขั้นตอน ERP', en: 'ERP Step' },
  'sb.manualWork': { th: 'งานด้วยมือ', en: 'Manual Work' },
  'sb.module': { th: 'โมดูล', en: 'Module' },
  'sb.department': { th: 'แผนก', en: 'Department' },
  // NEW-TH: these tag strings were English-only.
  'sb.moduleTag': { th: 'โมดูล: {module}', en: 'Module: {module}' },
  'sb.supportsChecks': { th: '(สนับสนุน/ตรวจสอบ)', en: '(supports/checks)' },
  'sb.atSite': { th: '📍 ทำที่หน้างาน', en: '📍 Done at site' },
  'sb.toConfirm': { th: '⚠ รอยืนยัน', en: '⚠ To confirm' },
  'sb.verified': { th: '✓ ยืนยันแล้ว', en: '✓ Verified' },
  'sb.routeOptions': {
    th: 'ประเภทย่อยของรายการ OF เดียวกันนี้ (แสดงในแผง ไม่ใช่กล่องแยก)',
    en: 'Type options of this one OF transaction (sidebar — not separate boxes)',
  },
  'sb.relatedFunctions': { th: 'หน้าที่ที่เกี่ยวข้อง', en: 'Related functions' },
  'sb.relatedForms': { th: 'แบบฟอร์มที่เกี่ยวข้อง', en: 'Related forms' },
  'sb.openInRegistry': {
    th: ' · คลิกเพื่อเปิดในทะเบียนหน้าที่',
    en: ' · click to open in Function Registry',
  },
  // NEW-TH: "Doc {code}" chip was English-only.
  'sb.docChip': { th: 'เอกสาร {code}', en: 'Doc {code}' },

  /* ── connections pane ──────────────────────────────────────────────────── */
  'conn.none': {
    th: 'ไม่มีการเชื่อมต่อข้ามสายงาน โหนดนี้เชื่อมตามลำดับภายในเลน',
    en: 'No cross-flow connections defined for this node. It connects sequentially within its lane.',
  },
  'conn.out': { th: 'โหนดนี้เชื่อมไปยัง', en: 'This node triggers / feeds' },
  'conn.in': { th: 'สิ่งที่ป้อนข้อมูลเข้าโหนดนี้', en: 'What feeds into this node' },
  'conn.dirOut': { th: 'ออก →', en: 'OUT →' },
  'conn.dirIn': { th: '← เข้า', en: '← IN' },
  'conn.type.trigger': { th: 'ทริกเกอร์', en: 'trigger' },
  'conn.type.feeds': { th: 'ป้อนข้อมูล', en: 'feeds' },
  'conn.type.deferred': { th: 'เลื่อน', en: 'deferred' },
  'conn.type.conditional': { th: 'เงื่อนไข', en: 'conditional' },

  /* ── AI pane ───────────────────────────────────────────────────────────── */
  'ai.impact': { th: 'ผลกระทบ', en: 'Impact' },
  'ai.effort': { th: 'ความยาก', en: 'Effort' },
  'ai.bizImpact': { th: 'ผลกระทบทางธุรกิจ', en: 'Business Impact' },
  'ai.implEffort': { th: 'ความยากในการนำไปใช้', en: 'Implementation Effort' },
  'ai.badge': { th: '🤖 AI', en: '🤖 AI' },
  // NEW-TH: impact/effort values were English-only.
  'ai.level.High': { th: 'สูง', en: 'High' },
  'ai.level.Medium': { th: 'ปานกลาง', en: 'Medium' },
  'ai.level.Low': { th: 'ต่ำ', en: 'Low' },

  /* ── document sidebar ──────────────────────────────────────────────────── */
  'doc.about': { th: 'เกี่ยวกับ', en: 'About' },
  'doc.erpRouting': { th: 'การส่งต่อ ERP', en: 'ERP Routing' },
  'doc.types': { th: 'ประเภทเอกสาร', en: 'Document Types' },
  'doc.siteDoc': { th: 'เอกสารหน้างาน', en: 'Site Document' },
  'doc.flowLabel': {
    th: '📄 การไหลของเอกสารหน้างาน (Document Control)',
    en: '📄 Site Document Flow (Document Control)',
  },
  // NEW-TH: the doc sidebar heading was English-only.
  'doc.heading': { th: 'เอกสาร {code} — {label}', en: 'Document {code} — {label}' },
  'doc.style.direct': { th: '→ เข้า ERP โดยตรง', en: '→ Direct ERP Entry' },
  'doc.style.deferred': { th: '⇢ เลื่อนบันทึก', en: '⇢ Deferred' },
  'doc.style.conditional': { th: '⇨ มีเงื่อนไข', en: '⇨ Conditional' },
  // NEW-TH: the site-origin tooltip on a doc node was English-only.
  'doc.originAtSite': { th: 'เริ่มต้นที่หน้างาน', en: 'Originates at site' },
  'doc.pill.direct': { th: '→ เข้า ERP โดยตรง', en: '→ Direct ERP' },
  'doc.pill.deferred': { th: '⇢ เลื่อนบันทึก', en: '⇢ Deferred' },
  'doc.pill.conditional': { th: '⇨ มีเงื่อนไข', en: '⇨ Conditional' },
  'doc.pill.manual': { th: '✎ ด้วยมือ', en: '✎ Manual' },

  /* ── node badges ───────────────────────────────────────────────────────── */
  // NEW-TH: every node tooltip below was English-only in the source.
  'node.erpBadge': { th: 'ERP', en: 'ERP' },
  'node.exit': { th: '■ สิ้นสุด', en: '■ EXIT' },
  'node.alsoDept': { th: 'และ: {name} (สนับสนุน / ตรวจสอบ)', en: 'Also: {name} (supports / checks)' },
  'node.atSiteTitle': { th: 'ทำที่หน้างาน (สถานที่)', en: 'Done at the site (location)' },
  'node.unverifiedTitle': {
    th: 'เบื้องต้น — รอยืนยันกับทีมงาน',
    en: 'Indicative — to be confirmed with the team',
  },

  /* ── function registry ─────────────────────────────────────────────────── */
  'fn.title': { th: 'ทะเบียนฟังก์ชัน', en: 'Function Registry' },
  'fn.subtitle': { th: 'VCB Construction · ทุกแผนก', en: 'VCB Construction · All Departments' },
  'fn.searchPlaceholder': { th: 'ค้นหารหัสหรือชื่อ…', en: 'Search code or name…' },
  'fn.allDepts': { th: 'ทุกแผนก', en: 'All Departments' },
  'fn.close': { th: '✕ กลับสู่แผนที่', en: '✕ Back to Map' },
  'fn.noMatch': { th: 'ไม่พบฟังก์ชันที่ตรงกับการค้นหา', en: 'No functions match your search.' },
  'fn.noSiteMatch': { th: 'ไม่พบฟังก์ชันหน้างานที่ตรงกัน', en: 'No site functions match.' },
  'fn.count': { th: 'ฟังก์ชัน', en: 'functions' },
  'fn.extPoints': { th: 'จุดเข้าภายนอก', en: 'external entry points' },
  'fn.colCode': { th: 'รหัส', en: 'Code' },
  'fn.colFunction': { th: 'ฟังก์ชัน', en: 'Function' },
  'fn.colType': { th: 'ประเภท', en: 'Type' },
  'fn.colModule': { th: 'โมดูล', en: 'Module' },
  'fn.colNotes': { th: 'หมายเหตุ', en: 'Notes' },
  'fn.badgeErp': { th: 'ERP', en: 'ERP' },
  'fn.badgeNonErp': { th: 'Non-ERP', en: 'Non-ERP' },
  'fn.site': { th: 'หน้างาน', en: 'Site' },
  'fn.siteOnly': { th: 'หน้างานเท่านั้น', en: 'Site only' },
  'fn.siteOnlyBtn': { th: '📍 เฉพาะหน้างาน', en: '📍 Site Only' },
  // NEW-TH: these were English-only.
  'fn.siteOnlyTitle': { th: 'แสดงเฉพาะฟังก์ชันหน้างาน', en: 'Show site functions only' },
  'fn.fieldActivities': { th: 'งานหน้างาน', en: 'field activities' },
  'fn.withAiOpps': { th: 'มีโอกาส AI', en: 'with AI opps' },
  'fn.atSiteTitle': { th: 'ทำที่หน้างาน', en: 'Done at site' },
  'fn.aiPrefix': { th: 'AI:', en: 'AI:' },

  /* ── L0 overview ───────────────────────────────────────────────────────── */
  // NEW-TH: the whole overview layer was English-only.
  'ov.title': { th: 'VCB — งานไหลอย่างไร', en: 'VCB — How the Work Flows' },
  'ov.subtitle': {
    th: 'คลิกที่ขั้นเพื่อดูฟังก์ชันภายใน',
    en: 'click a stage to dive into its functions',
  },
  'ov.orientation': { th: '🧭 แนะนำภาพรวม', en: '🧭 Orientation' },
  'ov.aiOpportunity': { th: '🤖 โอกาส AI', en: '🤖 AI Opportunity' },
  'ov.management': { th: '📊 ผู้บริหาร', en: '📊 Management' },
  'ov.moneyOut': {
    th: '💸 เงินออก — ซื้อ · จ้างเหมาช่วง · เงินสดย่อย → AP (ตั้งหนี้) → จ่าย → GL',
    en: '💸 Money out — Buy · Subcontract · Petty → AP (ตั้งหนี้) → Pay → GL',
  },
  'ov.moneyIn': {
    th: '💰 เงินเข้า — ความก้าวหน้า → วางบิล (AR) → เก็บเงิน → เงินสด',
    en: '💰 Money in — Progress → Bill (AR) → Collect → Cash',
  },
  'ov.stage': { th: 'ขั้นที่ {n}', en: 'STAGE {n}' },
  'ov.aiCount': { th: '🤖 {count} โอกาส AI', en: '🤖 {count} AI opportunities' },
  'ov.openFunctions': { th: 'เปิดดูฟังก์ชัน ▸', en: 'Open functions ▸' },
  'ov.supporting': { th: 'ฟังก์ชันสนับสนุน', en: 'SUPPORTING FUNCTIONS' },
  'ov.hint': {
    th: 'ชั้นที่ 1 — ขั้นตอนหลัก · คลิกขั้น → ชั้นที่ 2 — ฟังก์ชันโดยละเอียด · คลิกฟังก์ชัน → ขั้นตอน โมดูล Mango และโอกาส AI',
    en: 'Layer 1 — streamlined stages · click a stage → Layer 2 — detailed functions · click a function → its steps, Mango module & AI opportunity',
  },
  'ov.modules': { th: 'โมดูล: ', en: 'Modules: ' },
  'ov.showFullMap': { th: '✕ แสดงแผนที่ทั้งหมด', en: '✕ Show full map' },

  /* ── focus / linear trace ──────────────────────────────────────────────── */
  // NEW-TH: the whole trace overlay was English-only.
  'focus.subtitle': {
    th: 'เส้นทางเข้า/ออกทั้งหมด · คลิกกล่องใดก็ได้เพื่อติดตามใหม่',
    en: 'full in/out pathways · click any box to re-trace',
  },
  'focus.showOnMap': { th: '🗺️ แสดงบนแผนที่ใหญ่', en: '🗺️ Show on big map' },
  'focus.close': { th: '✕ ปิด', en: '✕ Close' },
  'focus.hint': {
    th: 'การติดตามเชิงเส้น — กล่องที่เลือก (สีทอง) พร้อมทุกสิ่งที่ไหลเข้า (ซ้าย) และไหลออก (ขวา) วางเมาส์บนกล่องเพื่อเน้นเฉพาะเส้นของกล่องนั้น คลิกกล่องใดก็ได้เพื่อติดตามใหม่',
    en: 'Linear trace — the focused box (gold) with everything that flows IN (left) and OUT (right). Hover a box to highlight just its lines; click any box to re-trace from it.',
  },
});

export default dictionary;
