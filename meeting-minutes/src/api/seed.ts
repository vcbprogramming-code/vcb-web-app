// Seed data for the typed mock layer. Representative sample minutes (not the real
// docs) for all 5 projects defined in Config.js (SOURCE_DOCS), with realistic Thai
// content carrying a real Executive Summary + Action Items section so the
// project-tab summary extraction has something to pull — exactly like live docs.

import type { Attachment, MeetingKind, MeetingSource, ProjectId } from '../types'

export interface SeedProject {
  id: ProjectId
  name: string
  nameEn: string
  cadence: string
  color: string
  order: number
}

// Mirrors SOURCE_DOCS in Config.js (minus the private docId).
export const SOURCE_PROJECTS: SeedProject[] = [
  { id: 'FIN',  name: 'งบการเงินทุกโครงการ',  nameEn: 'All-Project Financial Review',            cadence: 'Monthly',   color: '#1f6feb', order: 1 },
  { id: 'BD',   name: 'Business Development',   nameEn: 'กลยุทธ์การพัฒนาธุรกิจ',                    cadence: 'Quarterly', color: '#8957e5', order: 2 },
  { id: 'BT12', name: 'โครงการบางเตย ตอน 1+2', nameEn: 'Bang Toey Sections 1+2 (BT)',             cadence: 'Monthly',   color: '#2da44e', order: 3 },
  { id: 'BV',   name: 'โครงการบางวัว ตอน 6',    nameEn: 'Bang Wua Section 6 (BV) · Highway 34',    cadence: 'Monthly',   color: '#bf8700', order: 4 },
  { id: 'PN34', name: 'โครงการบรม ตอน 3+4',     nameEn: 'Borommaratchachonnani Sections 3+4 (PN)', cadence: 'Monthly',   color: '#cf222e', order: 5 },
  // Example of a project added at runtime via "+ New project" (createProject) —
  // demonstrates that a runtime-created project behaves identically to the
  // original 5, and gives the suggestion scorer a real project to distinguish
  // from FIN (see suggestProjectFor in TagPickerModal.tsx).
  { id: 'ERP',  name: 'ERP',                    nameEn: 'ERP',                                       cadence: 'As needed', color: '#0969da', order: 6 }
]

// Fathom Inbox is a pseudo-project (no Doc backing) — recordings ingested via
// the Fathom webhook/backfill land here permanently and stay admin-only.
// Mirrors FATHOM_INBOX_META in Config.js. Color is neutral grey (2026-07-22,
// was '#57606a' — a darker slate grey) — same reasoning as the Transkriptor
// Inbox below: an inbox is a temporary review queue, not a real project, so
// it shouldn't have its own distinct accent color competing with the sidebar's
// real project colors.
export const FATHOM_INBOX_PROJECT: SeedProject = {
  id: 'FATHOM_INBOX', name: 'Fathom Inbox', nameEn: 'Fathom Inbox', cadence: 'As recorded', color: '#8b949e', order: 99
}

// Transkriptor Inbox mirrors Fathom Inbox exactly — a second pseudo-project
// (no Doc backing) for recordings pulled via the Transkriptor API (polling,
// no webhook). Mirrors TRANSKRIPTOR_INBOX_META in Config.js. Same neutral grey
// as Fathom Inbox, deliberately (2026-07-22, was '#bc4c00' orange) — "make
// them light grey so it does not intervene with the other colors."
export const TRANSKRIPTOR_INBOX_PROJECT: SeedProject = {
  id: 'TRANSKRIPTOR_INBOX', name: 'Transkriptor Inbox', nameEn: 'Transkriptor Inbox', cadence: 'As recorded', color: '#8b949e', order: 100
}

export const ADMIN_EMAIL = 'c.chavananand@vcb-con.com'
export const APP_TITLE = 'VCB Meeting Minutes'
export const APP_DISPLAY_TITLE = 'Meeting Minutes'
export const APP_SUBTITLE = 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · รายงานการประชุมภายใน'
export const DOMAIN = 'vcb-con.com'

// A full sheet row mirror (see COLUMNS in Config.js). `content` is the rendered html.
export interface SeedRow {
  id: string
  projectId: ProjectId
  meetingKey: string
  date: string
  dateLabel: string
  time: string
  title: string
  kind: MeetingKind
  excerpt: string
  fathomUrl: string
  attendees: string[]
  tabId: string
  source: MeetingSource
  visible: boolean
  pinned: boolean
  content: string
  /** Inbox rows only (fathom/transkriptor source): projects this recording is
   *  ALSO tagged into (in addition to always staying listed under its inbox). */
  taggedProjectIds?: ProjectId[]
  /** ISO timestamp — powers the Edit History "Original" row's real creation
   *  date. Defaults to a fixed seed timestamp if omitted (see makeSeedRows). */
  createdAt?: string
  /** Files attached via addAttachment/removeAttachment. '' or [] = none. */
  attachments?: Attachment[]
}

interface BodyOpts {
  h1: string
  summary: string
  summaryPoints: string[]
  agenda: string[]
  discussion: string[]
  table?: string
  actions: [string, string, string][]
}

function body(o: BodyOpts): string {
  return (
    '<h1>' + o.h1 + '</h1>' +
    '<h1>1. สรุปผู้บริหาร · Executive Summary</h1>' +
    '<p>' + o.summary + '</p>' +
    '<ul>' + o.summaryPoints.map(p => '<li>' + p + '</li>').join('') + '</ul>' +
    '<h1>2. วาระการประชุม · Agenda</h1>' +
    '<ol>' + o.agenda.map(p => '<li>' + p + '</li>').join('') + '</ol>' +
    '<h1>3. รายละเอียดการประชุม · Discussion</h1>' +
    o.discussion.map(p => '<p>' + p + '</p>').join('') +
    (o.table || '') +
    '<h1>4. รายการที่ต้องดำเนินการ · Action Items</h1>' +
    '<table><tr><td>ผู้รับผิดชอบ</td><td>งาน</td><td>กำหนดเสร็จ</td></tr>' +
    o.actions.map(a => '<tr><td>' + a[0] + '</td><td>' + a[1] + '</td><td>' + a[2] + '</td></tr>').join('') +
    '</table>'
  )
}

const FIN_TABLE =
  '<table>' +
  '<tr><td>โครงการ</td><td>รายรับ (ล้านบาท)</td><td>รายจ่าย (ล้านบาท)</td><td>คงเหลือ</td></tr>' +
  '<tr><td>บางเตย 1+2</td><td>128.4</td><td>96.2</td><td>32.2</td></tr>' +
  '<tr><td>บางวัว 6</td><td>74.1</td><td>61.8</td><td>12.3</td></tr>' +
  '<tr><td>บรม 3+4</td><td>203.7</td><td>178.5</td><td>25.2</td></tr>' +
  '</table>'

export function makeSeedRows(): SeedRow[] {
  return [
    {
      id: 'fin-2569-06', projectId: 'FIN', meetingKey: '2569-06', date: '2026-06-12', dateLabel: '12 มิถุนายน 2569', time: '10:00AM',
      title: 'สรุปงบการเงินทุกโครงการ — มิถุนายน 2569', kind: 'meeting',
      excerpt: 'ภาพรวมกระแสเงินสดทั้ง 3 โครงการเป็นบวก รายจ่ายรวมต่ำกว่างบประมาณ 4.2% เน้นการเร่งเก็บหนี้ค้างชำระงวดที่ 3',
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.fin06', source: 'doc-import', visible: true, pinned: true,
      attachments: [
        { fileId: 'seed-att-1', name: 'กระแสเงินสด Q2-2569.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 48213, uploadedAt: '2026-06-12T04:10:00.000Z', uploadedBy: ADMIN_EMAIL, url: '#' },
        { fileId: 'seed-att-2', name: 'สรุปงบประมาณจัดซื้อเหล็ก.pdf', mimeType: 'application/pdf', size: 152430, uploadedAt: '2026-06-12T04:12:00.000Z', uploadedBy: ADMIN_EMAIL, url: '#' }
      ],
      content: body({
        h1: 'รายงานการประชุมงบการเงิน — มิถุนายน 2569',
        summary: 'กระแสเงินสดรวมของทั้ง 3 โครงการอยู่ในเกณฑ์บวก รายจ่ายรวมต่ำกว่างบประมาณที่ตั้งไว้ 4.2% ที่ประชุมมีมติให้เร่งติดตามการเก็บหนี้ค้างชำระงวดที่ 3 ของโครงการบางวัว',
        summaryPoints: ['กระแสเงินสดรวมเป็นบวกทั้ง 3 โครงการ', 'รายจ่ายต่ำกว่างบประมาณ 4.2%', 'หนี้ค้างชำระงวดที่ 3 บางวัว ต้องเร่งติดตาม'],
        agenda: ['ทบทวนงบการเงินเดือนพฤษภาคม', 'พิจารณากระแสเงินสดไตรมาส 2', 'อนุมัติงบประมาณจัดซื้อวัสดุ'],
        discussion: ['ฝ่ายบัญชีรายงานว่ายอดรายรับรวมเดือนนี้สูงกว่าประมาณการ 6 ล้านบาท จากการเบิกงวดงานบางเตยที่เร็วกว่ากำหนด', 'ที่ประชุมหารือเรื่องการบริหารสภาพคล่อง และเห็นชอบให้สำรองเงินสดเพิ่มอีก 10 ล้านบาทสำหรับงวดจัดซื้อเหล็กเดือนหน้า'],
        table: FIN_TABLE,
        actions: [['ฝ่ายบัญชี', 'จัดทำรายงานกระแสเงินสดไตรมาส 2', '30 มิ.ย. 2569'], ['ฝ่ายจัดซื้อ', 'สรุปราคาเหล็กล่าสุด 3 ผู้ขาย', '20 มิ.ย. 2569']]
      })
    },
    {
      id: 'fin-2569-05', projectId: 'FIN', meetingKey: '2569-05', date: '2026-05-15', dateLabel: '15 พฤษภาคม 2569', time: '10:00AM',
      title: 'สรุปงบการเงินทุกโครงการ — พฤษภาคม 2569', kind: 'meeting',
      excerpt: 'ทบทวนงบประมาณไตรมาสแรก รายจ่ายโครงการบรมสูงกว่าแผนเล็กน้อยจากค่าวัสดุที่ปรับขึ้น',
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.fin05', source: 'doc-import', visible: true, pinned: false,
      content: body({
        h1: 'รายงานการประชุมงบการเงิน — พฤษภาคม 2569',
        summary: 'ภาพรวมไตรมาสแรกเป็นไปตามแผน ยกเว้นรายจ่ายโครงการบรมที่สูงกว่าแผน 3% จากราคาวัสดุปรับขึ้น',
        summaryPoints: ['ไตรมาสแรกเป็นไปตามแผนโดยรวม', 'รายจ่ายบรม 3+4 สูงกว่าแผน 3%', 'เสนอทบทวนสัญญาผู้รับเหมาช่วง'],
        agenda: ['สรุปผลประกอบการไตรมาส 1', 'ทบทวนต้นทุนวัสดุ', 'แผนการเบิกจ่ายเดือนมิถุนายน'],
        discussion: ['ราคาเหล็กและคอนกรีตปรับเพิ่มขึ้นเฉลี่ย 5% ส่งผลต่อต้นทุนรวมของโครงการบรม', 'ที่ประชุมมอบหมายให้ฝ่ายจัดซื้อเจรจาสัญญาระยะยาวเพื่อล็อกราคา'],
        table: FIN_TABLE,
        actions: [['ฝ่ายจัดซื้อ', 'เจรจาสัญญาวัสดุระยะยาว', '10 มิ.ย. 2569']]
      })
    },
    {
      id: 'bd-2569-q2', projectId: 'BD', meetingKey: '2569-q2', date: '2026-06-03', dateLabel: '3 มิถุนายน 2569', time: '14:00PM',
      title: 'Business Development — แผนกลยุทธ์ไตรมาส 2/2569', kind: 'meeting',
      excerpt: 'พิจารณาโอกาสประมูลงานภาครัฐ 2 โครงการใหม่ และทบทวนความพร้อมด้านบุคลากร',
      fathomUrl: 'https://fathom.video/calls/123456', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.bdq2', source: 'doc-import', visible: true, pinned: false,
      content: body({
        h1: 'Business Development — ไตรมาส 2/2569',
        summary: 'ที่ประชุมเห็นชอบให้เข้าร่วมประมูลงานก่อสร้างถนนภาครัฐ 2 โครงการ มูลค่ารวมประมาณ 480 ล้านบาท และอนุมัติงบเตรียมเอกสารประมูล',
        summaryPoints: ['เข้าประมูลงานภาครัฐ 2 โครงการ มูลค่ารวม ~480 ล้านบาท', 'อนุมัติงบเตรียมเอกสารประมูล 1.2 ล้านบาท', 'ต้องเสริมทีมประมาณราคา 2 อัตรา'],
        agenda: ['ทบทวน pipeline งานใหม่', 'ประเมินความพร้อมประมูล', 'แผนกำลังคน'],
        discussion: ['งานถนนสายบางนา-ตราดช่วงที่ 4 เปิดประมูลต้นเดือนหน้า บริษัทมีคุณสมบัติครบตามเงื่อนไข', 'ทีมประเมินราคาปัจจุบันมีงานเต็มมือ จำเป็นต้องจ้างเพิ่มเพื่อรองรับ'],
        actions: [['ฝ่าย BD', 'จัดเตรียมเอกสารคุณสมบัติผู้ประมูล', '25 มิ.ย. 2569'], ['ฝ่ายบุคคล', 'เปิดรับวิศวกรประมาณราคา 2 อัตรา', '30 มิ.ย. 2569']]
      })
    },
    {
      id: 'bt12-2569-06', projectId: 'BT12', meetingKey: '2569-06', date: '2026-06-18', dateLabel: '18 มิถุนายน 2569', time: '09:30AM',
      title: 'ประชุมความคืบหน้าโครงการบางเตย ตอน 1+2', kind: 'meeting',
      excerpt: 'งานโครงสร้างคืบหน้า 68% ตามแผน ปัญหาฝนตกกระทบงานดินช่วงสัปดาห์ที่ผ่านมา',
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.bt1206', source: 'doc-import', visible: true, pinned: false,
      content: body({
        h1: 'ความคืบหน้าโครงการบางเตย ตอน 1+2 — มิถุนายน 2569',
        summary: 'งานโครงสร้างคืบหน้า 68% เป็นไปตามแผนงานหลัก แต่ฝนตกหนักช่วงสัปดาห์ที่ผ่านมาทำให้งานถมดินล่าช้าประมาณ 3 วัน',
        summaryPoints: ['งานโครงสร้างคืบหน้า 68% ตามแผน', 'งานถมดินล่าช้า 3 วันจากฝน', 'ต้องเร่งแผนสำรองช่วงหน้าฝน'],
        agenda: ['รายงานความคืบหน้ารายหมวดงาน', 'ปัญหาหน้างานและการแก้ไข', 'แผนงานเดือนกรกฎาคม'],
        discussion: ['ผู้จัดการโครงการรายงานว่างานเสาเข็มและฐานรากแล้วเสร็จทั้งหมด ขณะนี้อยู่ระหว่างงานคานและพื้นชั้น 2', 'ที่ประชุมเห็นควรจัดเตรียมเครื่องสูบน้ำเพิ่มและปรับลำดับงานให้ทำงานในอาคารช่วงฝนตก'],
        actions: [['ผจก.โครงการ', 'จัดทำแผนงานสำรองหน้าฝน', '24 มิ.ย. 2569'], ['ฝ่ายจัดซื้อ', 'เช่าเครื่องสูบน้ำเพิ่ม 2 เครื่อง', '21 มิ.ย. 2569']]
      })
    },
    {
      id: 'bv-2569-06', projectId: 'BV', meetingKey: '2569-06', date: '2026-06-09', dateLabel: '9 มิถุนายน 2569', time: '13:30PM',
      title: 'ประชุมโครงการบางวัว ตอน 6 (ทางหลวง 34)', kind: 'meeting',
      excerpt: 'การส่งมอบงวดงานที่ 3 ล่าช้า อยู่ระหว่างประสานผู้ควบคุมงานเพื่อตรวจรับ',
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.bv06', source: 'doc-import', visible: true, pinned: false,
      content: body({
        h1: 'โครงการบางวัว ตอน 6 — มิถุนายน 2569',
        summary: 'งวดงานที่ 3 พร้อมส่งมอบแล้วแต่ติดขั้นตอนตรวจรับจากผู้ควบคุมงาน ที่ประชุมเร่งรัดให้นัดตรวจรับภายในสัปดาห์นี้เพื่อเบิกงวด',
        summaryPoints: ['งวดงานที่ 3 พร้อมส่งมอบ รอตรวจรับ', 'เร่งนัดผู้ควบคุมงานภายในสัปดาห์', 'กระทบกระแสเงินสดหากเบิกงวดล่าช้า'],
        agenda: ['สถานะการส่งมอบงวดงาน', 'ปัญหาการตรวจรับ', 'แผนเบิกจ่าย'],
        discussion: ['งานผิวทางลาดยางช่วง กม. 12-15 แล้วเสร็จและผ่านการทดสอบความหนาแน่นแล้ว', 'ผู้ควบคุมงานติดภารกิจ ทำให้นัดตรวจรับล่าช้า ฝ่ายโครงการกำลังประสานวันใหม่'],
        actions: [['ผจก.โครงการ', 'นัดผู้ควบคุมงานตรวจรับงวด 3', '13 มิ.ย. 2569']]
      })
    },
    {
      id: 'pn34-2569-06', projectId: 'PN34', meetingKey: '2569-06', date: '2026-06-21', dateLabel: '21 มิถุนายน 2569', time: '10:00AM',
      title: 'ประชุมโครงการบรม ตอน 3+4', kind: 'meeting',
      excerpt: 'เริ่มงานระบบสาธารณูปโภค ประสานการไฟฟ้าและประปาเรื่องแนวท่อ',
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com'],
      tabId: 't.pn3406', source: 'doc-import', visible: true, pinned: false,
      content: body({
        h1: 'โครงการบรม ตอน 3+4 — มิถุนายน 2569',
        summary: 'เริ่มงานระบบสาธารณูปโภคใต้ดิน ที่ประชุมหารือการประสานหน่วยงานสาธารณูปโภคเรื่องแนวท่อที่ทับซ้อนกับระบบเดิม',
        summaryPoints: ['เริ่มงานระบบสาธารณูปโภคใต้ดิน', 'แนวท่อทับซ้อนระบบเดิม ต้องประสาน', 'ขออนุมัติแบบแก้ไขแนวท่อ'],
        agenda: ['ความคืบหน้างานระบบ', 'การประสานสาธารณูปโภค', 'การขออนุมัติแบบ'],
        discussion: ['พบว่าแนวท่อระบายน้ำใหม่ทับซ้อนกับท่อประปาเดิมบางช่วง ต้องปรับแบบเล็กน้อย', 'ทีมออกแบบเสนอแนวทางหลบท่อ 2 ทางเลือกเพื่อให้ที่ประชุมพิจารณา'],
        actions: [['ทีมออกแบบ', 'จัดทำแบบแก้ไขแนวท่อเสนออนุมัติ', '28 มิ.ย. 2569'], ['ผจก.โครงการ', 'ประสานการประปาเรื่องแนวท่อเดิม', '24 มิ.ย. 2569']]
      })
    },
    {
      id: 'pn34-overview', projectId: 'PN34', meetingKey: 'overview', date: '', dateLabel: 'Overview', time: '',
      title: 'ภาพรวมโครงการบรม ตอน 3+4', kind: 'overview',
      excerpt: 'ข้อมูลทั่วไป ขอบเขตงาน และไทม์ไลน์โครงการ',
      fathomUrl: '', attendees: [], tabId: 't.pn34ov', source: 'doc-import', visible: true, pinned: false,
      content: '<h1>ภาพรวมโครงการบรม ตอน 3+4</h1><p>โครงการก่อสร้างถนนและระบบสาธารณูปโภค ช่วงที่ 3 และ 4 ระยะทางรวมประมาณ 8.2 กิโลเมตร มูลค่าสัญญา 340 ล้านบาท กำหนดแล้วเสร็จไตรมาส 4 ปี 2570</p>'
    },

    // ---- Fathom Inbox seed rows ----
    // Every Fathom row: projectId is ALWAYS FATHOM_INBOX (permanent — the row
    // never moves), source is 'fathom', visible is false (admin-only until
    // reviewed). taggedProjectIds is the ADDITIONAL project(s) it also shows
    // under, if any — never removes it from the inbox.
    {
      id: 'fathom-erp-po', projectId: 'FATHOM_INBOX', meetingKey: 'fathom-744007526', date: '2026-07-13', dateLabel: 'Impromptu Microsoft Teams Meeting', time: '',
      title: 'Impromptu Microsoft Teams Meeting', kind: 'meeting',
      excerpt: 'Watch on Fathom · Action items: Send Mango Excel extract to Suthira; Set Area Type to ใช้งาน across all projects…',
      fathomUrl: 'https://fathom.video/calls/744007526', attendees: [], tabId: '', source: 'fathom', visible: false, pinned: false,
      // Deliberately no FIN-ish words beyond generic ones — this row exists to
      // prove the tag-picker suggestion correctly picks ERP over FIN (both
      // mention money/budget-adjacent terms, but only ERP's own name/id is a
      // direct hit; see the WEAK_SUGGEST_WORDS fix in TagPickerModal.tsx).
      // AI-summary section headers are bold paragraphs, never real <h1>-<h6>
      // tags (2026-07-21 GAS fix — see fathomMarkdownToHtml_/
      // transkriptorRecordToHtml_ in Code.js) — a real heading is a colored
      // block container that contenteditable silently continues into on
      // Enter/paste, with no visible boundary; a bold run has a clear one.
      content:
        '<p><a href="https://fathom.video/calls/744007526">Watch on Fathom</a></p>' +
        '<p><b>Key Takeaways</b></p>' +
        '<p>PO Approvals Blocked: pending POs are blocked by missing material codes (MatCode). The fix is to import the full item master list from the old ERP system.</p>' +
        '<p>Unit Code Mismatch: mismatched unit codes (e.g. PR in kg vs. PO in ton) prevent PO creation. The solution is for users to create PRs in the required PO unit.</p>' +
        '<p>Legacy Data Integrity: the 31 Dec AP balance is incorrect, differing from the GL by ~748,000 THB. The fix is to use the correct GL balance as the source of truth.</p>' +
        '<p><b>Action items</b></p><ul>' +
        '<li>Send Mango Excel extract to Suthira; then Suthira send to ดวง for 2-day cleanup</li>' +
        '<li>Set Area Type to ใช้งาน across all projects; then delete unused Area Types</li>' +
        '<li>Verify 53 carryforward POs; then approve in new system</li>' +
        '</ul>',
      taggedProjectIds: ['ERP']
    },
    {
      id: 'fathom-bv-overview', projectId: 'FATHOM_INBOX', meetingKey: 'fathom-597341158', date: '2026-03-12', dateLabel: 'BV - ประชุมภาพรวมโครงการบางวัว', time: '',
      title: 'BV - ประชุมภาพรวมโครงการบางวัว', kind: 'meeting',
      excerpt: 'Review BV project progress, resolve blockers, and align on next steps. Critical Blocker: Pipe delivery is stalled…',
      fathomUrl: 'https://fathom.video/calls/597341158', attendees: [], tabId: '', source: 'fathom', visible: false, pinned: false,
      // Untagged on purpose — demonstrates the tag picker's "Suggested" highlight
      // (should suggest BV, whose id/name/alias appear directly in the title).
      content:
        '<p><a href="https://fathom.video/calls/597341158">Watch on Fathom</a></p>' +
        '<p><b>Meeting Purpose</b></p><p>Review BV project progress, resolve blockers, and align on next steps.</p>' +
        '<p><b>Key Takeaways</b></p>' +
        '<p><b>Critical Blocker:</b> Pipe delivery is stalled because CCP requires upfront payment, but the PO voucher is stuck in ERP.</p>' +
        '<p><b>Concrete Plan:</b> Use Cement Thai One for structural work (~30 tons) until supply ends in 2026.</p>' +
        '<p><b>Action items</b></p><ul><li>Finalize pricing and submit a proposal immediately to capture the Thai Terrace market.</li></ul>'
    },
    {
      id: 'fathom-untitled-call', projectId: 'FATHOM_INBOX', meetingKey: 'fathom-410091837', date: '2025-09-13', dateLabel: 'Test call', time: '',
      title: 'Test call', kind: 'meeting',
      excerpt: 'Demonstrate Fathom\'s automated meeting recording and note-taking capabilities.',
      fathomUrl: 'https://fathom.video/calls/410091837', attendees: [], tabId: '', source: 'fathom', visible: false, pinned: false,
      content: '<p><a href="https://fathom.video/calls/410091837">Watch on Fathom</a></p><p><b>Meeting Purpose</b></p><p>Demonstrate Fathom\'s automated meeting recording and note-taking capabilities.</p>'
    },

    // ---- Transkriptor Inbox seed rows ----
    // Mirrors the Fathom Inbox rows exactly: projectId is ALWAYS
    // TRANSKRIPTOR_INBOX (permanent — the row never moves), source is
    // 'transkriptor', visible is false (admin-only until reviewed).
    // taggedProjectIds is the ADDITIONAL project(s) it also shows under, if
    // any — never removes it from the inbox. Transkriptor's summary shape is
    // an array of { section_title, section_content } (section_content is
    // Markdown) — rendered here the same way transkriptorRecordToHtml_ does
    // server-side (h2 per section, markdown body).
    {
      id: 'transkriptor-bt12-siteissue', projectId: 'TRANSKRIPTOR_INBOX', meetingKey: 'transkriptor-88213', date: '2026-07-15', dateLabel: 'BT1+2 Site Coordination Call', time: '',
      title: 'BT1+2 Site Coordination Call', kind: 'meeting',
      excerpt: 'Coordinate rebar delivery schedule and resolve access-road blockage for Bang Toey Sections 1+2.',
      fathomUrl: '', attendees: [], tabId: '', source: 'transkriptor', visible: false, pinned: false,
      // Tagged on purpose — demonstrates a Transkriptor row filed into a real
      // project exactly like a Fathom row can be (File into project… gate
      // checks source === 'fathom' || 'transkriptor').
      // Section titles are bold paragraphs, never real <h1>-<h6> tags — mirrors
      // transkriptorRecordToHtml_'s section_title handling in Code.js (was
      // <h2>title</h2>, changed 2026-07-21; see the note on the Fathom rows
      // above for the full reasoning).
      content:
        '<p><b>Summary</b></p><p>Rebar delivery for the BT1+2 slab pour is delayed by two days; the access road near gate 3 is partially blocked by a neighboring site\'s equipment.</p>' +
        '<p><b>Action items</b></p><ul>' +
        '<li>Escalate access-road blockage to the neighboring site\'s project manager</li>' +
        '<li>Confirm revised rebar delivery date with the supplier</li>' +
        '</ul>',
      taggedProjectIds: ['BT12']
    },
    {
      id: 'transkriptor-untagged-standup', projectId: 'TRANSKRIPTOR_INBOX', meetingKey: 'transkriptor-88477', date: '2026-07-17', dateLabel: 'Weekly Ops Standup', time: '',
      title: 'Weekly Ops Standup', kind: 'meeting',
      excerpt: 'Cross-project standup covering procurement delays and headcount requests.',
      fathomUrl: '', attendees: [], tabId: '', source: 'transkriptor', visible: false, pinned: false,
      // Untagged on purpose — shows up in the tag picker's candidate list like
      // any untagged inbox row.
      content:
        '<p><b>Summary</b></p><p>General cross-project operations standup. Procurement flagged a steel price increase; HR flagged two open engineering requisitions.</p>' +
        '<p><b>Action items</b></p><ul><li>Procurement to circulate updated steel pricing by Friday</li></ul>'
    }
  ]
}
