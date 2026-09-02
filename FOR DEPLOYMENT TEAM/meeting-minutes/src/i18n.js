// The Meeting Minutes Thai/English dictionary.
//
// ---------------------------------------------------------------------------
// WHAT THE OLD lib/i18n.ts ACTUALLY COVERED — AND WHAT IT DID NOT.
// ---------------------------------------------------------------------------
// It held 28 keys: the sidebar labels, the topbar, and the Settings sheet.
// Everything else in the app — every modal title, every button, every toast,
// every empty state, every error, every placeholder, the whole Project access
// screen, the whole editor, the whole timeline — was hardcoded English JSX.
//
// That is roughly 190 user-visible strings that no `tr()` call could reach.
// A Thai reader switching the language toggle changed the sidebar and nothing
// else. This dictionary is the fix: every one of them is keyed here.
//
// The reverse fault was there too, and matters more, because hr-worklog's port
// found the same class of bug. Several strings were hardcoded THAI in JSX with
// no dictionary entry at all, so an English reader was shown Thai with no way
// to change it. They are listed in PORT_NOTES.md and carried here as proper
// { th, en } pairs. Two Thai strings are deliberately NOT translated and are
// noted at their keys — a legal entity name and the printed letterhead date.
//
// Every Thai string that already existed was carried across MECHANICALLY, byte
// for byte, from lib/i18n.ts and from the JSX. Nothing was retranslated or
// paraphrased. Thai is written first in each pair because Thai is the default
// (shared/src/i18n.jsx) — note the OLD index.html defaulted to English
// (`l === 'th' ? 'th' : 'en'`), which is the opposite of what almost every user
// of this app wants.
//
// Keys are dotted and stable, never the Thai copy itself: keying on the copy is
// what silently orphaned translations in the other modules when a typo was
// fixed.
//
// Merged over commonDictionary by <I18nProvider>, so common.save / common.cancel
// / error.* are available without repeating them. Where this module words
// something its own way it lives under its own prefix rather than overriding a
// common key.

import { createDictionary } from '@vcb/shared';

export const dictionary = createDictionary({
  /* ------------------------------- app chrome ------------------------------ */
  'app.title': { th: 'รายงานการประชุม', en: 'Meeting Minutes' },
  // The group name on the topbar. A company name, shown as-is in both
  // languages; the Thai form is the subtitle beneath it.
  'app.brand': 'VCB Group',
  'app.subtitle': {
    th: 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · รายงานการประชุมภายใน',
    en: 'Vichitbhan Construction Group · Internal meeting minutes',
  },
  'app.backToPortal': { th: 'กลับไปหน้าหลัก VCB Connect', en: 'Back to VCB Connect home' },

  /* ------------------------------- navigation ------------------------------ */
  'nav.projects': { th: 'โครงการ', en: 'Projects' },
  'nav.allMeetings': { th: 'ทุกการประชุม', en: 'All meetings' },
  // The sidebar's ALL tile shows the name in one language and its counterpart
  // underneath, the way every real project row shows name + nameEn. So this
  // pair is deliberately the mirror image of nav.allMeetings.
  'nav.allMeetingsSub': { th: 'All meetings', en: 'ทุกการประชุม' },
  'nav.timeline': { th: 'ไทม์ไลน์', en: 'Timeline' },
  'nav.meetings': { th: 'การประชุม', en: 'Meetings' },
  'nav.backProjects': { th: '← โครงการ', en: '← Projects' },
  'nav.backMeetings': { th: '← การประชุม', en: '← Meetings' },
  'nav.latestMeetings': { th: 'การประชุมล่าสุด', en: 'Latest meetings' },
  'nav.newMeeting': { th: '＋ เพิ่มการประชุม', en: '＋ New meeting' },
  'nav.newProject': { th: '＋ เพิ่มโครงการ', en: '＋ New project' },
  'nav.renameProject': { th: 'เปลี่ยนชื่อโครงการ', en: 'Rename project' },
  'nav.search': { th: 'ค้นหาการประชุม, มติ, บุคคล…', en: 'Search meetings, decisions, people…' },
  'nav.searchShort': { th: 'ค้นหา…', en: 'Search…' },
  'nav.settings': { th: 'ตั้งค่า', en: 'Settings' },

  /* -------------------------------- counters ------------------------------- */
  // Thai has no plural inflection, so both forms are the same word — kept as
  // two keys anyway so the English side can differ.
  'count.record': { th: 'รายการ', en: 'record' },
  'count.records': { th: 'รายการ', en: 'records' },
  'count.meetings': { th: '{n} การประชุม', en: '{n} meetings' },

  /* --------------------------------- ranges -------------------------------- */
  'range.all': { th: 'ทั้งหมด', en: 'All' },
  'range.week': { th: 'สัปดาห์นี้', en: 'This week' },
  'range.month': { th: 'เดือนนี้', en: 'This month' },

  /* ------------------------------- dashboards ------------------------------ */
  'dash.intro': {
    th: 'บันทึกล่าสุดของแต่ละโครงการ — คลิกการ์ดใดก็ได้เพื่ออ่านฉบับเต็ม',
    en: 'The most recent minutes from each project — click any card to read the full record.',
  },
  'dash.readMinutes': { th: 'อ่านบันทึก →', en: 'Read minutes →' },
  'dash.empty': { th: 'ยังไม่มีการประชุมที่จะแสดง', en: 'No meetings to show yet.' },
  'dash.projectIntro': {
    th: 'บทสรุปผู้บริหารและรายการที่ต้องดำเนินการจากการประชุมล่าสุด — คลิกเพื่ออ่านฉบับเต็ม',
    en: 'Executive summary and action items from the most recent meeting — click to read the full record.',
  },
  'dash.projectLatest': { th: '{name} — การประชุมล่าสุด', en: '{name} — Latest meetings' },
  'dash.noMeetingsFor': {
    th: 'ยังไม่มีการประชุมสำหรับ {name}',
    en: 'No meetings yet for {name}.',
  },
  'dash.thisProject': { th: 'โครงการนี้', en: 'this project' },
  'dash.shareProject': { th: '🔗 คัดลอกลิงก์การประชุมล่าสุด', en: '🔗 Share latest-meeting link' },
  'dash.shareProjectHint': {
    th: 'คัดลอกลิงก์ถาวรที่เปิดการประชุมล่าสุดของโครงการนี้เสมอ',
    en: "Copy a permanent link that always opens this project's latest meeting",
  },
  'dash.shareProjectCopied': {
    th: 'คัดลอกลิงก์การประชุมล่าสุดแล้ว',
    en: 'Latest-meeting link copied to clipboard',
  },
  'dash.shareProjectPrompt': {
    th: 'คัดลอกลิงก์นี้เพื่อแชร์ (เปิดการประชุมล่าสุดเสมอ):',
    en: 'Copy this link to share (always opens the latest meeting):',
  },
  'dash.loadingSummary': { th: 'กำลังโหลดบทสรุป…', en: 'Loading summary…' },

  /* -------------------------------- meetings ------------------------------- */
  'meeting.overview': { th: 'ภาพรวม', en: 'Overview' },
  'meeting.pinned': { th: 'ปักหมุดแล้ว', en: 'Pinned' },
  'meeting.pin': { th: 'ปักหมุด', en: 'Pin' },
  'meeting.hidden': { th: '🚫 ซ่อนอยู่', en: '🚫 Hidden' },
  'meeting.visibleToStaff': { th: '👁 พนักงานเห็นได้', en: '👁 Visible to staff' },
  'meeting.badgeFathom': 'Fathom',
  'meeting.badgeTranskriptor': 'Transkriptor',
  'meeting.recording': { th: '▶ บันทึกวิดีโอ', en: '▶ Recording' },
  'meeting.attendees': { th: 'ผู้เข้าร่วม · {n}', en: 'Attendees · {n}' },
  'meeting.attachments': { th: 'เอกสารแนบ', en: 'Attachments' },
  'meeting.attachmentsN': { th: 'เอกสารแนบ · {n}', en: 'Attachments · {n}' },
  'meeting.attachFile': { th: '＋ แนบไฟล์', en: '＋ Attach file' },
  'meeting.emptyList': { th: 'ไม่มีการประชุมที่ตรงกัน', en: 'No meetings match.' },
  'meeting.selectOne': {
    th: 'เลือกการประชุมทางซ้ายเพื่ออ่านรายงานฉบับเต็ม',
    en: 'Select a meeting on the left to read the full minutes.',
  },
  'meeting.alsoTaggedInto': { th: 'แสดงในโครงการ', en: 'Also tagged into' },
  'meeting.removeFrom': { th: 'นำออกจาก {name}', en: 'Remove from {name}' },
  'meeting.fileIntoProject': { th: '📂 จัดเข้าโครงการ…', en: '📂 File into project…' },
  'meeting.fileIntoProjectHint': {
    th: 'แสดงรายการนี้ในโครงการด้วย',
    en: 'Also show this in a project',
  },
  'meeting.editHere': { th: '✎ แก้ไขที่นี่', en: '✎ Edit here' },
  'meeting.history': { th: 'ประวัติ', en: 'History' },
  'meeting.historyHint': {
    th: 'ดูว่าใครแก้ไขและแก้ไขเมื่อใด',
    en: 'See who edited this and when',
  },
  'meeting.comments': { th: 'ความคิดเห็น', en: 'Comments' },
  'meeting.shareLink': { th: 'คัดลอกลิงก์', en: 'Share link' },
  'meeting.shareCopied': { th: 'คัดลอกลิงก์แล้ว', en: 'Share link copied to clipboard' },
  'meeting.sharePrompt': { th: 'คัดลอกลิงก์นี้เพื่อแชร์:', en: 'Copy this link to share:' },
  'meeting.print': { th: '🖨 พิมพ์ / PDF', en: '🖨 Print / PDF' },

  /* -------------------------- meeting mutations ---------------------------- */
  'meeting.updating': { th: 'กำลังอัปเดต…', en: 'Updating…' },
  'meeting.pinnedToast': { th: 'ปักหมุดแล้ว', en: 'Pinned' },
  'meeting.unpinnedToast': { th: 'เลิกปักหมุดแล้ว', en: 'Unpinned' },
  'meeting.publishing': { th: 'กำลังเผยแพร่ให้พนักงาน…', en: 'Publishing to staff…' },
  'meeting.hiding': { th: 'กำลังซ่อนจากพนักงาน…', en: 'Hiding from staff…' },
  'meeting.nowVisible': {
    th: 'พนักงานทุกคนเห็นได้แล้ว',
    en: 'Now visible to all staff',
  },
  'meeting.nowHidden': { th: 'ซ่อนจากพนักงานแล้ว', en: 'Hidden from staff' },
  'meeting.loadingLatest': { th: 'กำลังโหลด…', en: 'Loading…' },
  'meeting.removingFrom': { th: 'กำลังนำออกจาก {name}…', en: 'Removing from {name}…' },
  'meeting.removedFrom': {
    th: 'นำออกจาก {name} แล้ว — ยังอยู่ในกล่องขาเข้า',
    en: '{name} — still in the inbox',
  },
  'meeting.nowShowingIn': { th: 'แสดงในโครงการ {name} แล้ว', en: 'Now also showing in {name}' },
  'meeting.taggingInto': { th: 'กำลังจัดเข้า {name}…', en: 'Tagging into {name}…' },

  /* ------------------------------ attachments ------------------------------ */
  'attach.tooLarge': { th: 'ไฟล์ใหญ่เกินไป (สูงสุด 25MB)', en: 'File too large (max 25MB)' },
  'attach.uploading': { th: 'กำลังอัปโหลด {name}…', en: 'Uploading {name}…' },
  'attach.attached': { th: 'แนบ {name} แล้ว', en: 'Attached {name}' },
  'attach.removing': { th: 'กำลังลบเอกสารแนบ…', en: 'Removing attachment…' },
  'attach.removed': { th: 'ลบเอกสารแนบแล้ว', en: 'Attachment removed' },
  'attach.removeTitle': { th: 'ลบเอกสารแนบนี้?', en: 'Remove this attachment?' },
  'attach.removeHint': { th: 'ลบแล้วกู้คืนไม่ได้', en: 'This cannot be undone.' },
  'attach.remove': { th: 'ลบ', en: 'Remove' },
  'attach.removeOne': { th: 'ลบเอกสารแนบ', en: 'Remove attachment' },

  /* -------------------------------- comments ------------------------------- */
  'comment.none': { th: 'ยังไม่มีความคิดเห็น', en: 'No comments yet.' },
  'comment.write': { th: 'เขียนความคิดเห็น…', en: 'Write a comment…' },
  'comment.post': { th: 'ส่ง', en: 'Post' },
  'comment.delete': { th: 'ลบความคิดเห็น', en: 'Delete comment' },
  'comment.deleteTitle': { th: 'ลบความคิดเห็นนี้?', en: 'Delete this comment?' },
  'comment.deleting': { th: 'กำลังลบ…', en: 'Deleting…' },
  'comment.unknownAuthor': { th: '(ไม่ทราบผู้เขียน)', en: '(unknown)' },

  /* ------------------------------ meeting modal ---------------------------- */
  'modal.newMeeting': { th: 'เพิ่มการประชุม', en: 'New meeting' },
  'modal.editMeeting': { th: 'แก้ไขการประชุม', en: 'Edit meeting' },
  'modal.project': { th: 'โครงการ', en: 'Project' },
  'modal.title': { th: 'หัวข้อ', en: 'Title' },
  'modal.titlePlaceholder': {
    th: 'เช่น ประชุมประจำเดือน — งบการเงิน',
    en: 'e.g. Monthly review — financials',
  },
  'modal.dateLabel': {
    th: 'วันที่ (เช่น 21/05/2569 หรือ 21 พฤษภาคม 2569)',
    en: 'Date (e.g. 21/05/2569 or 21 May 2569)',
  },
  'modal.datePlaceholder': { th: 'วว/ดด/2569', en: 'dd/mm/2569' },
  'modal.time': { th: 'เวลา', en: 'Time' },
  'modal.timePlaceholder': '10:00',
  'modal.content': {
    th: 'เนื้อหา (ข้อความธรรมดาหรือ HTML — หัวข้อ รายการ ลิงก์ ใช้ได้ทั้งหมด)',
    en: 'Content (plain text or HTML — headings, bullets, links all welcome)',
  },
  'modal.contentPlaceholder': {
    th: 'วางหรือพิมพ์รายงานการประชุมที่นี่…',
    en: 'Paste or type the minutes here…',
  },
  'modal.untitled': { th: 'ไม่มีหัวข้อ', en: 'Untitled' },
  'modal.deleteMeetingTitle': { th: 'ลบการประชุมนี้?', en: 'Delete this meeting?' },
  'modal.deleteMeeting': { th: '🗑 ลบการประชุม', en: '🗑 Delete meeting' },
  'modal.deleted': { th: 'ลบแล้ว', en: 'Deleted' },
  'modal.deleting': { th: 'กำลังลบ…', en: 'Deleting…' },
  'modal.saveFailed': { th: 'บันทึกไม่สำเร็จ', en: 'Save failed' },

  /* -------------------------------- projects ------------------------------- */
  'project.new': { th: 'เพิ่มโครงการ', en: 'New project' },
  'project.newHint': {
    // Rewritten. The original said "Creates a new Google Doc for this project's
    // meeting minutes" — untrue since 2026-07-19, and actively misleading: a new
    // project is a tag-only bucket and no Doc is created. Saying otherwise
    // invites someone to go looking for a Doc that does not exist.
    th: 'สร้างกลุ่มสำหรับจัดเก็บรายงานการประชุม และเพิ่มลงในแถบด้านข้าง',
    en: 'Creates a bucket for this project’s meeting minutes and adds it to the sidebar.',
  },
  'project.name': { th: 'ชื่อโครงการ', en: 'Project name' },
  'project.nameHint': {
    th: 'ชื่อโครงการ (ภาษาไทยหรือตามที่ต้องการ)',
    en: "Project name (Thai or however you'll title it)",
  },
  'project.namePlaceholder': { th: 'เช่น โครงการหลวงพระบาง', en: 'e.g. Luang Prabang Project' },
  'project.nameEn': { th: 'ชื่อภาษาอังกฤษ', en: 'English name' },
  'project.nameEnHint': {
    th: 'ชื่อภาษาอังกฤษ (ใช้เป็นคำบรรยายใต้ชื่อในแถบด้านข้างและอ้างอิงภายใน)',
    en: 'English name (used for sidebar subtitle + internal reference)',
  },
  'project.nameEnPlaceholder': { th: 'เช่น Luang Prabang Project', en: 'e.g. Luang Prabang Project' },
  'project.cadence': { th: 'ความถี่', en: 'Cadence' },
  'project.cadenceMonthly': { th: 'รายเดือน', en: 'Monthly' },
  'project.cadenceQuarterly': { th: 'รายไตรมาส', en: 'Quarterly' },
  'project.cadenceAsNeeded': { th: 'ตามความจำเป็น', en: 'As needed' },
  'project.create': { th: 'สร้างโครงการ', en: 'Create project' },
  'project.creating': { th: 'กำลังสร้างโครงการ…', en: 'Creating project…' },
  'project.created': { th: 'สร้าง {name} แล้ว', en: 'Created {name}' },
  'project.nameRequired': { th: 'ต้องระบุชื่อโครงการ', en: 'Project name is required' },
  'project.rename': { th: 'เปลี่ยนชื่อโครงการ', en: 'Rename project' },
  'project.renamed': { th: 'เปลี่ยนชื่อแล้ว', en: 'Renamed' },

  /* ------------------------------ tag picker ------------------------------- */
  'tag.title': { th: 'แสดงบันทึกนี้ในโครงการ…', en: 'Also show this recording in…' },
  'tag.hint': {
    th: 'ยังคงอยู่ในกล่องขาเข้าเช่นเดิม — นี่เป็นเพียงการเพิ่มเข้าไปในรายการของโครงการด้วย',
    en: "It stays in the inbox too — this just adds it to a project's list as well.",
  },
  'tag.suggested': { th: 'แนะนำ', en: 'Suggested' },
  'tag.noCandidates': {
    th: 'ไม่มีโครงการอื่นให้จัดเข้า',
    en: 'No other project to file this into.',
  },

  /* -------------------------------- settings ------------------------------- */
  'settings.signedInAs': { th: 'เข้าสู่ระบบโดย', en: 'Signed in as' },
  'settings.notSignedIn': { th: 'ยังไม่ได้เข้าสู่ระบบ', en: 'Not signed in' },
  'settings.display': { th: 'การแสดงผล / DISPLAY', en: 'การแสดงผล / DISPLAY' },
  'settings.about': { th: 'เกี่ยวกับ / ABOUT', en: 'เกี่ยวกับ / ABOUT' },
  'settings.app': { th: 'แอป', en: 'App' },
  'settings.admin': { th: 'ผู้ดูแล', en: 'Admin' },
  'settings.projectAccess': { th: '🔐 สิทธิ์โครงการ', en: '🔐 Project access' },
  'settings.roleAdmin': { th: 'ผู้ดูแล', en: 'admin' },
  'settings.roleEditor': { th: 'ผู้แก้ไข', en: 'editor' },
  'settings.roleViewer': { th: 'ผู้อ่าน', en: 'viewer' },

  /* ---------------------------- project access ----------------------------- */
  'access.title': { th: 'สิทธิ์โครงการ', en: 'Project access' },
  'access.sub': { th: 'ใครเปิดโครงการใดได้บ้าง', en: 'Who may open each project.' },
  'access.filter': { th: 'กรองโครงการหรืออีเมล…', en: 'Filter projects or emails…' },
  'access.noMatch': { th: 'ไม่มีโครงการที่ตรงกับตัวกรอง', en: 'No project matches that filter.' },
  'access.public': { th: '🔓 สาธารณะ', en: '🔓 Public' },
  'access.locked': { th: '🔒 ล็อก', en: '🔒 Locked' },
  'access.legendPublic': {
    th: 'อ่านได้โดยทุกคนที่เปิดลิงก์แอป ไม่ต้องเข้าสู่ระบบ ไม่จำกัดโดเมนอีเมล',
    en: 'readable by anyone who opens the app link, no sign-in, any email domain.',
  },
  'access.legendLocked': {
    th: 'อ่านได้เฉพาะผู้ดูแล ผู้แก้ไข และผู้ที่ระบุชื่อไว้ด้านล่างเท่านั้น คนอื่นทั้งหมด รวมถึงพนักงาน @vcb-con.com คนอื่น จะไม่เห็นอะไรเลย',
    en: 'readable only by admins, editors, and the people you name below it. Everyone else, including other @vcb-con.com staff, sees nothing of it.',
  },
  'access.legendTip': {
    th: 'เพิ่มหลายคนพร้อมกันได้โดยวางรายชื่อ — คั่นด้วยจุลภาค อัฒภาค เว้นวรรค หรือขึ้นบรรทัดใหม่ก็ได้',
    en: 'Add several at once by pasting a list — commas, semicolons, spaces or new lines all work.',
  },
  'access.whoCanSee': { th: 'ใครเห็นได้', en: 'Who can see it' },
  'access.whoCanSeeN': { th: 'ใครเห็นได้ ({n})', en: 'Who can see it ({n})' },
  'access.nobodyNamed': {
    th: 'ยังไม่ได้ระบุใคร — มีเพียงผู้ดูแลและผู้แก้ไขเท่านั้นที่เห็นโครงการนี้',
    en: 'Nobody named yet — only admins and editors can see this project.',
  },
  'access.addPlaceholder': { th: 'อีเมล หรือวางหลายรายการ', en: 'email, or paste several' },
  'access.adding': { th: 'กำลังเพิ่ม…', en: 'Adding…' },
  'access.removing': { th: 'กำลังนำออก…', en: 'Removing…' },
  'access.updated': { th: 'อัปเดตสิทธิ์แล้ว', en: 'Access updated.' },
  'access.removeEmail': { th: 'นำ {email} ออก', en: 'Remove {email}' },
  'access.unlocking': { th: 'กำลังปลดล็อก…', en: 'Unlocking…' },
  'access.locking': { th: 'กำลังล็อก…', en: 'Locking…' },
  'access.publicNote': {
    th: 'เปิดให้ทุกคน — ไม่ต้องเข้าสู่ระบบ จึงไม่มีรายชื่อผู้อ่านให้ดูแล ล็อกไว้เพื่อเลือกว่าใครเห็นได้บ้าง',
    en: 'Open to everyone — no sign-in needed, so there is no guest list to keep. Lock it to choose exactly who may see it',
  },
  'access.publicNoteKept': {
    th: ' และผู้ที่ระบุชื่อไว้แล้ว {n} คนจะมีผลอีกครั้ง',
    en: ', and the {n} already named here will apply again.',
  },
  'access.confirmPublishTitle': { th: 'เผยแพร่ทุกการประชุมในโครงการนี้?', en: 'Publish every meeting in this project?' },
  'access.confirmPublish': {
    // The asymmetry is the point and must survive translation: unlocking
    // publishes retroactively, locking again does NOT re-hide.
    th: 'ทุกคนที่มีลิงก์แอปจะอ่านได้ — ทุกโดเมนอีเมล ไม่ต้องเข้าสู่ระบบ — และการประชุมที่เพิ่มเข้าโครงการนี้ภายหลังจะถูกเผยแพร่ด้วย การล็อกอีกครั้งจะไม่ซ่อนการประชุมที่เผยแพร่ไปแล้ว',
    en: 'Anyone with the app link will be able to read them — any email domain, no sign-in required — and meetings added to this project later will be published too. Locking again will not re-hide meetings that were already published.',
  },
  'access.confirmPublishOk': { th: 'เผยแพร่', en: 'Publish' },
  'access.bare': {
    th: 'โครงการที่ล็อกไว้ {n} โครงการยังไม่ได้ระบุผู้ใด — ขณะนี้มีเพียงผู้ดูแลและผู้แก้ไขเท่านั้นที่เห็น เพิ่มผู้ที่ควรเข้าถึงได้ หรือตั้งกลับเป็นสาธารณะ',
    en: '{n} locked project(s) with nobody named — only admins and editors can see them right now. Add the people who should have access, or set them back to Public.',
  },

  /* -------------------------------- editor --------------------------------- */
  'editor.title': { th: 'แก้ไขการประชุม', en: 'Edit meeting' },
  'editor.titleField': { th: 'หัวข้อ', en: 'Title' },
  'editor.titlePlaceholder': { th: 'หัวข้อการประชุม', en: 'Meeting title' },
  'editor.date': { th: 'วันที่', en: 'Date' },
  'editor.datePlaceholder': {
    th: 'เช่น 21 พฤษภาคม 2569 หรือ 21-05-2569',
    en: 'e.g. 21 May 2569 or 21-05-2569',
  },
  'editor.time': { th: 'เวลา', en: 'Time' },
  'editor.timePlaceholder': { th: 'เช่น 10:00', en: 'e.g. 10:00' },
  'editor.undo': { th: 'ย้อนกลับ (Ctrl+Z)', en: 'Undo (Ctrl+Z)' },
  'editor.redo': { th: 'ทำซ้ำ (Ctrl+Shift+Z)', en: 'Redo (Ctrl+Shift+Z)' },
  'editor.bold': { th: 'ตัวหนา', en: 'Bold' },
  'editor.italic': { th: 'ตัวเอียง', en: 'Italic' },
  'editor.bulletList': { th: 'รายการหัวข้อย่อย', en: 'Bullet list' },
  'editor.bulletListBtn': { th: '• รายการ', en: '• List' },
  'editor.numberedList': { th: 'รายการลำดับเลข', en: 'Numbered list' },
  'editor.numberedListBtn': { th: '1. รายการ', en: '1. List' },
  'editor.tickList': { th: 'รายการติ๊กถูก (สีเขียว)', en: 'Checklist (green tick)' },
  'editor.tickListBtn': { th: '✓ รายการ', en: '✓ List' },
  'editor.addLink': { th: 'เพิ่มลิงก์', en: 'Add a hyperlink' },
  'editor.addLinkBtn': { th: '🔗 ลิงก์', en: '🔗 Link' },
  'editor.linkTitle': { th: 'เพิ่มลิงก์', en: 'Add a link' },
  'editor.linkUrl': { th: 'URL ของลิงก์', en: 'Link URL' },
  'editor.unlink': { th: 'ลบลิงก์', en: 'Remove hyperlink' },
  'editor.unlinkBtn': { th: 'ลบลิงก์', en: 'Unlink' },
  'editor.editHistory': { th: '🕘 ประวัติการแก้ไข', en: '🕘 Edit history' },
  'editor.discardTitle': { th: 'ละทิ้งการแก้ไขที่ยังไม่บันทึก?', en: 'Discard unsaved changes?' },
  'editor.discardHint': { th: 'สิ่งที่พิมพ์ไว้จะหายไปทั้งหมด', en: 'Anything you typed will be lost.' },
  'editor.discard': { th: 'ละทิ้ง', en: 'Discard' },

  /* ----------------------------- edit history ------------------------------ */
  'history.title': { th: 'ประวัติการแก้ไข', en: 'Edit history' },
  'history.original': { th: 'ต้นฉบับ', en: 'Original' },
  'history.viewOriginal': { th: 'ดูต้นฉบับ', en: 'View Original' },
  'history.createdAt': { th: 'สร้างเมื่อ {when}', en: 'Created {when}' },
  'history.firstVersion': {
    th: 'เวอร์ชันแรกที่บันทึกไว้ของการประชุมนี้',
    en: 'The first saved version of this meeting',
  },
  'history.view': { th: 'ดู', en: 'View' },
  'history.viewHint': {
    th: 'ดูว่าก่อนการแก้ไขครั้งนี้เป็นอย่างไร',
    en: 'See what it looked like before this edit',
  },
  'history.none': { th: 'ยังไม่มีการบันทึกกิจกรรม', en: 'No activity recorded yet.' },
  'history.by': { th: 'โดย', en: 'by' },

  // Audit action names. The API returns machine tokens (edit_content,
  // toggle_pin); the old UI printed them raw at the user in both languages.
  'audit.edit_content': { th: 'แก้ไขเนื้อหา', en: 'Edited content' },
  'audit.create_meeting': { th: 'สร้างการประชุม', en: 'Created meeting' },
  'audit.delete_meeting': { th: 'ลบการประชุม', en: 'Deleted meeting' },
  'audit.toggle_pin': { th: 'เปลี่ยนการปักหมุด', en: 'Changed pin' },
  'audit.set_visibility': { th: 'เปลี่ยนการมองเห็น', en: 'Changed visibility' },
  'audit.tag': { th: 'จัดเข้าโครงการ', en: 'Filed into a project' },
  'audit.untag': { th: 'นำออกจากโครงการ', en: 'Removed from a project' },
  'audit.add_attachment': { th: 'เพิ่มเอกสารแนบ', en: 'Added an attachment' },
  'audit.remove_attachment': { th: 'ลบเอกสารแนบ', en: 'Removed an attachment' },
  'audit.add_comment': { th: 'เพิ่มความคิดเห็น', en: 'Added a comment' },
  'audit.remove_comment': { th: 'ลบความคิดเห็น', en: 'Removed a comment' },
  'audit.create_project': { th: 'สร้างโครงการ', en: 'Created project' },
  'audit.rename_project': { th: 'เปลี่ยนชื่อโครงการ', en: 'Renamed project' },
  'audit.delete_project': { th: 'ลบโครงการ', en: 'Deleted project' },
  'audit.set_project_visibility': { th: 'เปลี่ยนสิทธิ์โครงการ', en: 'Changed project access' },
  'audit.add_guests': { th: 'เพิ่มผู้อ่าน', en: 'Added viewers' },
  'audit.remove_guest': { th: 'นำผู้อ่านออก', en: 'Removed a viewer' },

  /* --------------------------- version preview ----------------------------- */
  'version.title': { th: 'ดูตัวอย่างเวอร์ชัน', en: 'Version preview' },
  'version.readOnly': { th: '(อ่านอย่างเดียว)', en: '(read-only)' },

  /* -------------------------------- timeline ------------------------------- */
  'timeline.title': { th: 'ไทม์ไลน์', en: 'Timeline' },
  'timeline.horizontal': { th: 'แนวนอน', en: 'Horizontal' },
  'timeline.calendar': { th: 'ปฏิทิน', en: 'Calendar' },
  'timeline.prevYear': { th: 'ปีก่อนหน้า', en: 'Previous year' },
  'timeline.nextYear': { th: 'ปีถัดไป', en: 'Next year' },
  'timeline.noDated': {
    th: 'ไม่มีการประชุมที่ระบุวันที่ตรงกับตัวกรองโครงการปัจจุบัน',
    en: 'No dated meetings match the current project filter.',
  },
  'timeline.noVisible': {
    th: 'ไม่มีโครงการที่แสดงอยู่ซึ่งมีการประชุมที่ระบุวันที่',
    en: 'No visible projects have dated meetings.',
  },

  /* ------------------------- the rendered document ------------------------- */
  // Shown INSIDE the A4 iframe, which is a separate document — see lib/docCss.js.
  'doc.aiTitle': { th: 'บทสรุปที่สร้างโดย AI:', en: 'AI-Generated Summary:' },
  'doc.aiBody': {
    th: 'บทสรุปนี้สร้างขึ้นโดยอัตโนมัติและอาจมีข้อผิดพลาด กรุณาเน้นที่ประเด็นการหารือหลักและตรวจสอบรายละเอียดสำคัญเมื่อจำเป็น',
    en: 'This summary was generated automatically and may contain errors. Please focus on the main discussion points and verify important details where necessary.',
  },
  'doc.execSummary': {
    // Was hardcoded as the bilingual string 'บทสรุปผู้บริหาร · Executive Summary'
    // in docRender.ts, printed identically to both audiences.
    th: 'บทสรุปผู้บริหาร',
    en: 'Executive Summary',
  },
  'doc.openToRead': {
    th: 'เปิดเพื่ออ่านรายงานฉบับเต็ม',
    en: 'Open to read the full minutes.',
  },
  'doc.noContent': { th: '(ไม่มีเนื้อหา)', en: '(no content)' },
  'doc.empty': { th: '(ว่าง)', en: '(empty)' },

  /* --------------------------- confirm / prompt ---------------------------- */
  'confirm.areYouSure': { th: 'แน่ใจหรือไม่?', en: 'Are you sure?' },
  'confirm.enterValue': { th: 'กรอกค่า', en: 'Enter a value' },

  /* --------------------------------- errors -------------------------------- */
  'err.projectBuiltin': {
    th: 'ลบโครงการเริ่มต้นไม่ได้ — โครงการเหล่านี้เก็บประวัติไว้',
    en: 'This project cannot be deleted — it holds the original history.',
  },
  'err.projectNotEmpty': {
    th: 'ยังมีการประชุมอยู่ในโครงการนี้ ย้ายหรือลบก่อนจึงจะลบโครงการได้',
    en: 'This project still holds meetings. Move or delete them first.',
  },
  'err.cannotTagInbox': {
    th: 'จัดเข้ากล่องขาเข้าไม่ได้ — เลือกโครงการจริง',
    en: 'A recording cannot be filed into an inbox — choose a real project.',
  },
  'err.notAnInboxRow': {
    th: 'จัดเข้าโครงการได้เฉพาะบันทึกในกล่องขาเข้าเท่านั้น',
    en: 'Only an inbox recording can be filed into a project.',
  },
  'err.projectNotFound': { th: 'ไม่พบโครงการนี้', en: 'That project no longer exists.' },
  'err.commentNotFound': { th: 'ไม่พบความคิดเห็นนี้', en: 'That comment no longer exists.' },
  'err.badVersion': { th: 'หมายเลขเวอร์ชันไม่ถูกต้อง', en: 'That is not a valid version.' },
  'err.invalidEmail': { th: 'อีเมลไม่ถูกต้อง', en: 'That is not a valid email address.' },
  'err.invalidEmailList': {
    // Naming the offenders is the point: the API rejects the whole pasted batch
    // on one bad entry, so "check your list" alone is useless.
    th: 'อีเมลเหล่านี้ไม่ถูกต้อง ไม่มีรายการใดถูกบันทึก: {emails}',
    en: 'These addresses are not valid, so nothing was saved: {emails}',
  },
  'err.uploadFailed': {
    th: 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่',
    en: 'The file could not be uploaded. Please try again.',
  },
  'err.uploadUnavailable': {
    // Shown on a 404 from the presign route. The route DOES exist now
    // (GET /meetings/:id/attachments/upload-url); a 404 here means this API
    // build predates it, so the sentence points at the deployment rather than
    // telling the user a feature was never written.
    th: 'ยังแนบไฟล์ไม่ได้ — เซิร์ฟเวอร์ที่ใช้อยู่ยังไม่รองรับการอัปโหลด กรุณาแจ้งผู้ดูแลระบบให้อัปเดต',
    en: 'Attaching a file is unavailable — this server build has no upload route. Please ask an administrator to update it.',
  },
  'err.loadFailed': { th: 'โหลดข้อมูลไม่สำเร็จ', en: 'Could not load this.' },

  /* ----------------------------- misc / states ----------------------------- */
  'state.loading': { th: 'กำลังโหลด…', en: 'Loading…' },
  'state.working': { th: 'กำลังดำเนินการ…', en: 'Working…' },
  'state.saved': { th: 'บันทึกแล้ว', en: 'Saved' },
  'state.saving': { th: 'กำลังบันทึก…', en: 'Saving…' },
});
