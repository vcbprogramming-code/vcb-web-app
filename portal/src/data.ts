import type { AppEntry, I18nDict } from './types'

// Single source of truth for the app cards — ported verbatim from Code.js (APPS).
export const APPS: AppEntry[] = [
  {
    key: 'ememo',
    name: 'E-Memo',
    desc: 'Document control, memo issuance & approval workflow.',
    url: 'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxv70XmRpmQf_9JKQsJwY_-N3oxc0llO4xQL52ycDdpW_HvaN_G1sG0GsRqePbLxROn/exec',
    icon: 'memo',
    accent: '#4fd1ff',
  },
  {
    key: 'minutes',
    name: 'Meeting Minutes',
    desc: 'Meeting records, decisions & action-item tracking.',
    url: 'https://script.google.com/a/macros/vcb-con.com/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec',
    icon: 'minutes',
    accent: '#7ee8ff',
  },
  {
    key: 'sop',
    name: 'Standard Operating Procedures',
    desc: 'Browse, search & version-control company SOPs.',
    url: 'https://script.google.com/a/macros/vcb-con.com/s/AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg/exec',
    icon: 'sop',
    accent: '#a78bfa',
  },
  {
    key: 'sysmap',
    name: 'System Map',
    desc: 'Interactive map of VCB Group systems & integrations.',
    url: 'https://script.google.com/macros/s/AKfycbyslTl8HOSLBtqFfp8lo0UBoVJGvCl7ieAxskcdl0HrDwYec7Uzj8khCjKtpC2VRRgh/exec',
    icon: 'sysmap',
    accent: '#f472b6',
  },
  {
    key: 'hr',
    name: 'HR Work Log',
    desc: 'Attendance, task logs & timesheet for the HR team.',
    url: 'https://script.google.com/a/macros/vcb-con.com/s/AKfycbzRll0RWwjBcFVWsCiyeM8x6AqlOzeOxaZx6qEmbD-lJepMJn2dUWsL08T0ubOjhy3lNg/exec',
    icon: 'hr',
    accent: '#34d399',
  },
  {
    key: 'credit',
    name: 'Credit Facility Manager',
    desc: 'Credit limits, drawdowns, requests & approvals.',
    url: 'https://script.google.com/a/macros/vcb-con.com/s/AKfycbztWhyi0anTnTu8lOkMYVrECpRStAn0jqjlNrfxPlnnTwkk1t45XfCofWiv9wLLVEisjQ/exec',
    icon: 'credit',
    accent: '#fbbf24',
  },
]

// EN / TH dictionary — ported verbatim from index.html I18N.
export const I18N: I18nDict = {
  en: {
    brand_sub: 'Internal Intranet Portal',
    hero_desc: 'Connect the Apps, Fill the Gaps.',
    system_online: 'SYSTEM ONLINE',
    apps_word: 'APPS',
    applications: 'Applications',
    available: 'available',
    launch: 'Launch',
    footer_left: 'VCB Group · Internal Use Only',
    connecting: 'Connecting…',
    guest: 'Guest',
    toggle_title: 'เปลี่ยนเป็นภาษาไทย',
    badge: 'EN',
    mission: [
      'VCB Connect is a centralized digital platform that connects information across the organization. It integrates documents, files, and day-to-day operational data through APIs and AI, transforming fragmented information into connected knowledge that can be searched, referenced, and reused.',
      'Every time an employee records information, they contribute to an Enterprise Knowledge Base that continuously captures experience and lessons learned, preserving institutional knowledge and making it available for future use.',
      'Paper-based processes cannot produce machine-readable data. Without digitally structured information, knowledge cannot be indexed, semantically searched, or leveraged by AI agents and automation.',
    ],
    apps: {
      ememo: {
        name: 'E-Memo',
        desc: 'Document control, memo issuance & approval workflow.',
        preview:
          'Centralizes company documents and memos in one place, with a structured issuance and approval workflow so every record is version-controlled, traceable, and easy to find later.',
      },
      minutes: {
        name: 'Meeting Minutes',
        desc: 'Meeting records, decisions & action-item tracking.',
        preview:
          'Captures meeting records and decisions as they happen, then tracks the resulting action items to completion so agreements from a meeting are never lost or forgotten.',
      },
      sop: {
        name: 'Standard Operating Procedures',
        desc: 'Browse, search & version-control company SOPs.',
        preview:
          'Gives every team a single, searchable library of standard operating procedures, with version control so staff always work from the current approved process, not an outdated copy.',
      },
      sysmap: {
        name: 'System Map',
        desc: 'Interactive map of VCB Group systems & integrations.',
        preview:
          'Visualizes how the functions of each department across VCB Group connect to one another, making it easy to see how work and responsibilities link across teams at a glance.',
      },
      hr: {
        name: 'HR Work Log',
        desc: 'Attendance, task logs & timesheet for the HR team.',
        preview:
          'Lets the HR team log attendance, daily tasks, and timesheets in one system, replacing scattered spreadsheets with a single accurate record for the team’s work.',
      },
      credit: {
        name: 'Credit Facility Manager',
        desc: 'Credit limits, drawdowns, requests & approvals.',
        preview:
          'Manages the company’s bank credit facilities end to end — limits, drawdowns, requests, and approvals — giving the finance team a clear, auditable view of the company’s credit position with each bank.',
      },
    },
  },
  th: {
    brand_sub: 'พอร์ทัลอินทราเน็ตภายในองค์กร',
    hero_desc:
      'ศูนย์รวมแอปพลิเคชันภายในของ VCB Group ไว้ในที่เดียว — สร้างมาเพื่อทีมงาน ใช้งานได้จากทุกอุปกรณ์',
    system_online: 'ระบบออนไลน์',
    apps_word: 'แอป',
    applications: 'แอปพลิเคชัน',
    available: 'รายการ',
    launch: 'เปิดใช้งาน',
    footer_left: 'VCB Group · สำหรับใช้งานภายในเท่านั้น',
    connecting: 'กำลังเชื่อมต่อ…',
    guest: 'ผู้เยี่ยมชม',
    toggle_title: 'Switch to English',
    badge: 'ไทย',
    mission: [
      'VCB Connect คือแพลตฟอร์มดิจิทัลที่เชื่อมโยงข้อมูลทั้งองค์กร โดยรวบรวมข้อมูลจากเอกสาร ระบบงาน ไฟล์ต่าง ๆ และการปฏิบัติงานประจำวัน ผ่าน API และ AI เพื่อเปลี่ยนข้อมูลที่กระจัดกระจายให้เป็นข้อมูลที่เชื่อมโยงกัน สามารถค้นหา อ้างอิง และนำกลับมาใช้ได้ตลอดเวลา',
      'การเชื่อมโยงข้อมูลในลักษณะนี้ไม่สามารถเกิดขึ้นได้จากกระบวนการทำงานที่อาศัยเอกสารกระดาษเป็นหลัก เนื่องจากข้อมูลไม่ได้อยู่ในรูปแบบ machine readable จึงไม่สามารถรองรับ AI, semantic search, AI Agents และ automation',
      'ทุกครั้งที่พนักงานบันทึกข้อมูล ไม่ได้เป็นเพียงการบันทึกงานประจำวัน แต่เป็นการร่วมสร้าง Enterprise Knowledge Base ที่สะสมองค์ความรู้ ประสบการณ์ และบทเรียนจากการปฏิบัติงานอย่างต่อเนื่อง เพื่อรักษาองค์ความรู้ขององค์กรให้สามารถถ่ายทอด และนำกลับมาใช้ได้อย่างเป็นระบบ',
    ],
    apps: {
      ememo: {
        name: 'อีเมโม',
        desc: 'ควบคุมเอกสาร การออกบันทึกข้อความ และขั้นตอนการอนุมัติ',
        preview:
          'รวมเอกสารและบันทึกข้อความของบริษัทไว้ในที่เดียว พร้อมขั้นตอนการออกและอนุมัติที่เป็นระบบ ทำให้ทุกฉบับมีเวอร์ชันที่ตรวจสอบย้อนกลับได้และค้นหาได้ง่ายในภายหลัง',
      },
      minutes: {
        name: 'รายงานการประชุม',
        desc: 'บันทึกการประชุม มติที่ประชุม และการติดตามงานที่ได้รับมอบหมาย',
        preview:
          'บันทึกรายละเอียดและมติที่ประชุมทันทีที่เกิดขึ้น พร้อมติดตามงานที่ได้รับมอบหมายจนเสร็จสิ้น เพื่อให้ข้อตกลงจากที่ประชุมไม่ถูกลืมหรือตกหล่น',
      },
      sop: {
        name: 'มาตรฐานการปฏิบัติงาน',
        desc: 'เรียกดู ค้นหา และควบคุมเวอร์ชันเอกสาร SOP ของบริษัท',
        preview:
          'เป็นคลังขั้นตอนการปฏิบัติงานมาตรฐานที่ค้นหาได้สำหรับทุกทีม พร้อมควบคุมเวอร์ชัน เพื่อให้พนักงานทำงานตามขั้นตอนที่อนุมัติล่าสุดเสมอ ไม่ใช่ฉบับที่ล้าสมัย',
      },
      sysmap: {
        name: 'แผนผังระบบ',
        desc: 'แผนผังเชื่อมโยงระบบและแอปพลิเคชันต่าง ๆ ของ VCB Group',
        preview:
          'แสดงภาพรวมการเชื่อมโยงหน้าที่งานของแต่ละฝ่ายทั่วทั้ง VCB Group ทำให้เห็นความเชื่อมโยงของงานและความรับผิดชอบระหว่างทีมต่าง ๆ ได้ในทันที',
      },
      hr: {
        name: 'บันทึกงานฝ่ายบุคคล',
        desc: 'การลงเวลา บันทึกงาน และตารางเวลาทำงานสำหรับทีม HR',
        preview:
          'ให้ทีม HR ลงเวลา บันทึกงานประจำวัน และจัดตารางเวลาทำงานไว้ในระบบเดียว แทนที่ไฟล์ Excel ที่กระจัดกระจาย เพื่อให้มีบันทึกข้อมูลการทำงานของทีมที่ถูกต้องและเป็นระบบ',
      },
      credit: {
        name: 'ระบบจัดการวงเงินสินเชื่อ',
        desc: 'วงเงินสินเชื่อ การเบิกถอน คำขอ และการอนุมัติ',
        preview:
          'บริหารจัดการวงเงินสินเชื่อของบริษัทกับธนาคารครบวงจร ตั้งแต่วงเงิน การเบิกถอน คำขอ ไปจนถึงการอนุมัติ ให้ทีมการเงินเห็นสถานะวงเงินสินเชื่อกับแต่ละธนาคารได้ชัดเจนและตรวจสอบย้อนกลับได้',
      },
    },
  },
}
