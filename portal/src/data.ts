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
    url: 'https://script.google.com/macros/s/AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA/exec',
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
    staff: 'Staff',
    nav_menu: 'Menu',
    nav_dashboard: 'Dashboard',
    nav_applications: 'Applications',
    nav_more: 'More',
    nav_onboarding: 'Onboarding Portal',
    nav_ai_tavern: 'AI Tavern',
    nav_help: 'Help & Support',
    dash_sub: 'One place for every internal VCB Group application.',
    welcome_sub: "Here's what's happening across VCB Connect today.",
    good_morning: 'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening: 'Good evening',
    system_online: 'System Online',
    applications: 'Applications',
    available: 'available',
    launch: 'Launch',
    footer_left: 'VCB Group · Internal Use Only',
    connecting: 'Connecting…',
    guest: 'Guest',
    settings_language: 'Language',
    settings_theme: 'Appearance',
    theme_light: 'Light',
    theme_dark: 'Dark',
    search_placeholder: 'Search applications…',
    search_empty: 'No applications match your search.',
    panel_announcements: 'Announcements',
    panel_announcements_empty: 'No announcements right now.',
    panel_birthdays: 'Upcoming Birthdays',
    panel_birthdays_note: 'Sample data — connect a real source to replace this.',
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
    staff: 'พนักงาน',
    nav_menu: 'เมนู',
    nav_dashboard: 'แดชบอร์ด',
    nav_applications: 'แอปพลิเคชัน',
    nav_more: 'เพิ่มเติม',
    nav_onboarding: 'พอร์ทัลปฐมนิเทศ',
    nav_ai_tavern: 'AI Tavern',
    nav_help: 'ช่วยเหลือ',
    dash_sub: 'ศูนย์รวมแอปพลิเคชันภายในของ VCB Group ไว้ในที่เดียว',
    welcome_sub: 'ความเคลื่อนไหวของ VCB Connect ในวันนี้',
    good_morning: 'สวัสดีตอนเช้า',
    good_afternoon: 'สวัสดีตอนบ่าย',
    good_evening: 'สวัสดีตอนเย็น',
    system_online: 'ระบบออนไลน์',
    applications: 'แอปพลิเคชัน',
    available: 'รายการ',
    launch: 'เปิดใช้งาน',
    footer_left: 'VCB Group · สำหรับใช้งานภายในเท่านั้น',
    connecting: 'กำลังเชื่อมต่อ…',
    guest: 'ผู้เยี่ยมชม',
    settings_language: 'ภาษา',
    settings_theme: 'ธีม',
    theme_light: 'สว่าง',
    theme_dark: 'มืด',
    search_placeholder: 'ค้นหาแอปพลิเคชัน…',
    search_empty: 'ไม่พบแอปพลิเคชันที่ค้นหา',
    panel_announcements: 'ประกาศ',
    panel_announcements_empty: 'ยังไม่มีประกาศในขณะนี้',
    panel_birthdays: 'วันเกิดที่กำลังจะถึง',
    panel_birthdays_note: 'ข้อมูลตัวอย่าง — เชื่อมต่อแหล่งข้อมูลจริงเพื่อแทนที่ส่วนนี้',
    apps: {
      ememo: {
        name: 'อีเมโม',
        desc: 'ควบคุมเอกสาร การออกบันทึกข้อความ และขั้นตอนการอนุมัติ ระหว่างโครงการและสำนักงานใหญ่',
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
