// Seed data for the typed mock layer. Representative sample minutes (not the real
// docs) for all 5 projects defined in Config.js (SOURCE_DOCS), with realistic Thai
// content carrying a real Executive Summary + Action Items section so the
// project-tab summary extraction has something to pull — exactly like live docs.

import type { MeetingKind, MeetingSource, ProjectId } from '../types'

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
  { id: 'PN34', name: 'โครงการบรม ตอน 3+4',     nameEn: 'Borommaratchachonnani Sections 3+4 (PN)', cadence: 'Monthly',   color: '#cf222e', order: 5 }
]

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
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com', 'finance.lead@vcb-con.com', 'a.somchai@vcb-con.com'],
      tabId: 't.fin06', source: 'doc-import', visible: true, pinned: true,
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
      fathomUrl: '', attendees: ['c.chavananand@vcb-con.com', 'finance.lead@vcb-con.com'],
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
      fathomUrl: 'https://fathom.video/calls/123456', attendees: ['c.chavananand@vcb-con.com', 'bd.manager@vcb-con.com', 'p.wirat@vcb-con.com'],
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
      fathomUrl: '', attendees: ['site.bt12@vcb-con.com', 'c.chavananand@vcb-con.com', 'eng.kitti@vcb-con.com'],
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
      fathomUrl: '', attendees: ['site.bv@vcb-con.com', 'c.chavananand@vcb-con.com'],
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
      fathomUrl: '', attendees: ['site.pn34@vcb-con.com', 'c.chavananand@vcb-con.com', 'eng.suda@vcb-con.com'],
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
      id: 'bd-2569-note', projectId: 'BD', meetingKey: 'manual-note', date: '2026-06-25', dateLabel: '25 มิถุนายน 2569', time: '11:00AM',
      title: 'บันทึกเพิ่มเติม — สรุปการหารือพันธมิตร', kind: 'meeting',
      excerpt: 'บันทึกที่เพิ่มในแอป (manual) — สรุปการหารือกับพันธมิตรเรื่องการร่วมทุนโครงการใหม่',
      fathomUrl: '', attendees: ['bd.manager@vcb-con.com', 'c.chavananand@vcb-con.com'],
      tabId: '', source: 'manual', visible: true, pinned: false,
      content: body({
        h1: 'บันทึกการหารือพันธมิตร — มิถุนายน 2569',
        summary: 'หารือเบื้องต้นกับพันธมิตรเรื่องการร่วมทุนโครงการพัฒนาที่ดินแปลงใหม่ ทั้งสองฝ่ายเห็นชอบให้จัดทำกรอบความร่วมมือเพื่อเสนอผู้บริหาร',
        summaryPoints: ['พันธมิตรสนใจร่วมทุนโครงการที่ดินแปลงใหม่', 'เห็นชอบจัดทำกรอบ MOU', 'นัดหารือรายละเอียดอีกครั้งเดือนหน้า'],
        agenda: ['ทบทวนข้อเสนอพันธมิตร', 'ขอบเขตการร่วมทุน', 'ขั้นตอนถัดไป'],
        discussion: ['พันธมิตรเสนอสัดส่วนการร่วมทุน 60/40 และจะรับผิดชอบงานออกแบบ', 'ฝ่ายเราขอเวลาพิจารณาเงื่อนไขทางการเงินและผลตอบแทนก่อนตอบรับ'],
        actions: [['ฝ่าย BD', 'ร่างกรอบ MOU เสนอผู้บริหาร', '5 ก.ค. 2569']]
      })
    },
    {
      id: 'pn34-overview', projectId: 'PN34', meetingKey: 'overview', date: '', dateLabel: 'Overview', time: '',
      title: 'ภาพรวมโครงการบรม ตอน 3+4', kind: 'overview',
      excerpt: 'ข้อมูลทั่วไป ขอบเขตงาน และไทม์ไลน์โครงการ',
      fathomUrl: '', attendees: [], tabId: 't.pn34ov', source: 'doc-import', visible: true, pinned: false,
      content: '<h1>ภาพรวมโครงการบรม ตอน 3+4</h1><p>โครงการก่อสร้างถนนและระบบสาธารณูปโภค ช่วงที่ 3 และ 4 ระยะทางรวมประมาณ 8.2 กิโลเมตร มูลค่าสัญญา 340 ล้านบาท กำหนดแล้วเสร็จไตรมาส 4 ปี 2570</p>'
    }
  ]
}
