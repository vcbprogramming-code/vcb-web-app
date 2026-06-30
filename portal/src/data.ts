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
    hero_welcome: 'Welcome to',
    hero_desc:
      'One portal for every internal VCB Group application — built for the team, accessible from any device.',
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
    apps: {
      ememo: { name: 'E-Memo', desc: 'Document control, memo issuance & approval workflow.' },
      minutes: { name: 'Meeting Minutes', desc: 'Meeting records, decisions & action-item tracking.' },
      sop: {
        name: 'Standard Operating Procedures',
        desc: 'Browse, search & version-control company SOPs.',
      },
      hr: { name: 'HR Work Log', desc: 'Attendance, task logs & timesheet for the HR team.' },
      credit: { name: 'Credit Facility Manager', desc: 'Credit limits, drawdowns, requests & approvals.' },
    },
  },
  th: {
    brand_sub: 'พอร์ทัลอินทราเน็ตภายในองค์กร',
    hero_welcome: 'ยินดีต้อนรับสู่',
    hero_desc:
      'ศูนย์รวมแอปพลิเคชันภายในของ VCB Group ทุกระบบไว้ในที่เดียว — สร้างมาเพื่อทีมงาน ใช้งานได้จากทุกอุปกรณ์',
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
    apps: {
      ememo: { name: 'อีเมโม', desc: 'ควบคุมเอกสาร การออกบันทึกข้อความ และขั้นตอนการอนุมัติ' },
      minutes: {
        name: 'รายงานการประชุม',
        desc: 'บันทึกการประชุม มติที่ประชุม และการติดตามงานที่ได้รับมอบหมาย',
      },
      sop: {
        name: 'ขั้นตอนการปฏิบัติงานมาตรฐาน',
        desc: 'เรียกดู ค้นหา และควบคุมเวอร์ชันเอกสาร SOP ของบริษัท',
      },
      hr: { name: 'บันทึกงานฝ่ายบุคคล', desc: 'การลงเวลา บันทึกงาน และตารางเวลาทำงานสำหรับทีม HR' },
      credit: { name: 'ระบบจัดการวงเงินสินเชื่อ', desc: 'วงเงินสินเชื่อ การเบิกถอน คำขอ และการอนุมัติ' },
    },
  },
}
