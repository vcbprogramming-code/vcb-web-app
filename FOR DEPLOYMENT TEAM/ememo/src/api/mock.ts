// In-memory implementation of the GAS server `Api`. Mirrors return shapes
// from Code.js exactly; touches no Google service. This is the single place
// to swap for a real google.script.run bridge later.
import type {
  Api, DocumentsByProject, DocRow, ReviewResult, ReviewEntry, Status,
  LetterheadMeta, Department, ReviewerRole, ClaimAuthResult,
  ReviewMutationArgs, DecisionArgs, MangoArgs, MangoResult, DeleteDocArgs,
  SimpleOk, PreviewLetterArgs, PreviewLetterResult, SubmitDocumentArgs,
  SubmitDocumentResult, FinalizeLetterArgs, FinalizeLetterResult,
  StreamFileResult, DocAttachmentsResult, AccessConfigResult,
  SetAccessConfigResult, AccessRules,
} from './types'
import { esc, pad3 } from '../i18n'

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const OWNER = 'c.chavananand@vcb-con.com'
const MANAGERS = new Set([OWNER, 'p.somchai@vcb-con.com'])

let _seq = 0
const uid = () => 'doc-' + (++_seq)

function row(date: string, code: string, subject: string, desc: string, status: Status, linked: boolean, ref = ''): DocRow {
  const id = uid()
  return {
    num: 0, date, code, subject, desc, status,
    url: linked ? `https://drive.google.com/file/d/MOCK${_seq}/view` : '',
    id, ref,
  }
}

// ── seed register (mirrors getDocuments output shape) ────────────────
const RAW: DocumentsByProject = {
  BT1: [
    row('24/06/2026', '02A', 'ขออนุมัติแบบฐานรากอาคารสำนักงานชั่วคราว', 'BT-02A-041 · แนบแบบ Shop drawing 3 แผ่น', 'pending', true, 'BT/วิศวะ/02A/041'),
    row('19/06/2026', '01', 'รายงานความก้าวหน้างานก่อสร้างประจำสัปดาห์', 'BT-01-118 · สัปดาห์ที่ 24/2569', 'approved', true, 'BT/บริหาร/01/118'),
    row('11/06/2026', '02C', 'ขออนุมัติเปลี่ยนแปลงวัสดุงานหลังคา', 'BT-02C-009 · เมทัลชีท → ลอนคู่', 'commented', true, 'BT/วิศวะ/02C/009'),
    row('03/06/2026', '08', 'ขออนุมัติจ้างแรงงานเพิ่ม 12 อัตรา', 'BT-08-052 · งานโครงสร้าง', 'rejected', true, 'BT/บุคคล/08/052'),
  ],
  VK2: [
    row('26/06/2026', '02A', 'ขออนุมัติแบบงานระบบสุขาภิบาลอาคาร B', 'VK2-02A-077', 'pending', true, 'VK/วิศวะ/02A/077'),
    row('21/06/2026', '09', 'ส่งใบแจ้งหนี้ผู้รับเหมาช่วงงวดที่ 5', 'VK2-09-031', 'approved', true, 'VK/บัญชี/09/031'),
    row('14/06/2026', '02B', 'ขออนุมัติแผนงานเทคอนกรีตเสาชั้น 3', 'VK2-02B-018', 'commented', false, 'VK/วิศวะ/02B/018'),
  ],
  CVE: [
    row('25/06/2026', '10', 'รายงานผลทดสอบกำลังอัดคอนกรีต', 'CVE-สำนักงาน-10-043', 'approved', true, 'CVE/สำนักงาน/10/043'),
    row('17/06/2026', '01', 'ขออนุมัติสั่งซื้อเหล็กเสริม SD40', 'CVE-บริหาร-01-066', 'pending', true, 'CVE/บริหาร/01/066'),
    row('09/06/2026', '02A', 'แจ้งปัญหาหน้างานหล่อชิ้นงานคานสะพาน', 'CVE-วิศวะ-02A-021', 'commented', false, 'CVE/วิศวะ/02A/021'),
  ],
  LPB: [
    row('23/06/2026', '08', 'ขออนุมัติเบิกค่าเดินทางทีมสำรวจ', 'VC-LBP/สำนักงาน/08/934', 'pending', true, 'LPB/บุคคล/08/934'),
    row('12/06/2026', '01', 'รายงานสรุปความคืบหน้าโครงการรายเดือน', 'VC-LBP/บริหาร/01/210', 'approved', true, 'LPB/บริหาร/01/210'),
  ],
  BV: [
    row('22/06/2026', '02A', 'ขออนุมัติแบบงานถนนภายในโครงการ', 'BV-02A-055', 'pending', true, 'BV/วิศวะ/02A/055'),
    row('08/06/2026', '06', 'ขออนุมัติแผนความปลอดภัยในการทำงาน', 'BV-06-013', 'approved', false, 'BV/พัสดุ/06/013'),
  ],
  PN4: [
    row('20/06/2026', '02C', 'ขออนุมัติเปลี่ยนผู้รับเหมางานสี', 'PN4-02C-007', 'rejected', true, 'PN4/วิศวะ/02C/007'),
    row('05/06/2026', '01', 'รายงานความก้าวหน้างานเสาเข็มเจาะ', 'PN4-01-088', 'commented', true, 'PN4/บริหาร/01/088'),
  ],
  EP: [
    row('18/06/2026', '02A', 'ขออนุมัติแบบงานโครงสร้างหลังคาโรงงาน', 'EP-02A-029', 'pending', true, 'EP/วิศวะ/02A/029'),
    row('02/06/2026', '09', 'ส่งสรุปค่าใช้จ่ายงวดที่ 3', 'EP-09-014', 'approved', false, 'EP/บัญชี/09/014'),
  ],
  'V&K': [
    row('16/06/2026', '02B', 'ขออนุมัติแผนติดตั้งนั่งร้านอาคาร C', 'V&K-02B-040', 'pending', true, 'V&K/วิศวะ/02B/040'),
    row('01/06/2026', '01', 'รายงานความก้าวหน้างานก่อสร้างรายสัปดาห์', 'V&K-01-101', 'approved', true, 'V&K/บริหาร/01/101'),
  ],
  UNCLASSIFIED: [
    row('15/06/2026', '', 'อีเมลแจ้งเปลี่ยนแปลงกำหนดประชุมประจำเดือน', '', 'pending', false),
  ],
}

const THREADS: Record<string, ReviewEntry[]> = {}
const seed = (id: string, e: ReviewEntry[]) => { THREADS[id] = e }
seed(RAW.BT1![2]!.id, [
  { action: 'comment', email: 'p.somchai@vcb-con.com', time: '12/06/2026 10:14', text: 'ขอแบบ section เพิ่มอีก 1 แผ่นก่อนพิจารณาครับ' },
  { action: 'comment', email: OWNER, time: '12/06/2026 15:02', text: 'แนบแบบ section เพิ่มแล้วครับ รบกวนตรวจอีกครั้ง' },
])
seed(RAW.BT1![3]!.id, [
  { action: 'comment', email: 'hr@vcb-con.com', time: '03/06/2026 09:20', text: 'งบประมาณแรงงานเกินแผนไตรมาสนี้' },
  { action: 'reject', email: OWNER, time: '04/06/2026 11:40', text: 'ไม่อนุมัติ — ให้ทบทวนจำนวนอัตราและเสนอใหม่' },
])
seed(RAW.VK2![2]!.id, [{ action: 'comment', email: 'eng@vcb-con.com', time: '14/06/2026 13:05', text: 'แผนเทคอนกรีตชนวันหยุด ขอเลื่อนเป็นวันถัดไป' }])
seed(RAW.CVE![2]!.id, [{ action: 'comment', email: 'site.cve@vcb-con.com', time: '09/06/2026 16:22', text: 'แม่พิมพ์คานสะพานมีรอยร้าว ขอเปลี่ยนชุดใหม่' }])
seed(RAW.PN4![1]!.id, [{ action: 'comment', email: OWNER, time: '05/06/2026 08:50', text: 'ขอดูภาพถ่ายหน้างานเสาเข็มเจาะประกอบ' }])

// ── letterhead config (subset of LETTERHEAD/DEPT_BY_CODE in Code.js) ──
const LH_PROJECTS = ['CVE', 'LPB', 'PN4', 'BT1', 'VK2', 'BV', 'EP', 'V&K']
const LH_DEFAULTS: Record<string, string> = {
  BT1: 'ผู้จัดการโครงการ', VC: 'ผู้จัดการโครงการ', VK2: 'ผู้จัดการโครงการ', CVE: 'ผู้จัดการฝ่ายวิศวกรรม',
  LPB: 'ผู้จัดการโครงการ', BV: 'ผู้จัดการโครงการ', PN4: 'ผู้จัดการโครงการ',
  EP: 'ผู้จัดการโครงการ', 'V&K': 'ผู้จัดการโครงการ',
}
// Ported verbatim from LETTERHEAD's own `prefix` field in Code.js — several
// don't match the project code (LPB is 'VC-LBP', PN4 and VK2 both share
// 'BP', 'V&K' is 'VK'), so this must not be derived from the project key.
const LH_PREFIX: Record<string, string> = { BT1: 'BT', VC: 'VC', VK2: 'BP', CVE: 'CVE', LPB: 'VC-LBP', BV: 'BV', PN4: 'BP', EP: 'EP', 'V&K': 'VK' }
const LH_COMPANY: Record<string, string> = {
  CVE: 'บริษัท ชวนา เอ็นจิเนียร์ริ่ง จำกัด',
  LPB: 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง — โครงการหลวงพระบาง',
  BT1: 'กิจการร่วมค้า — โครงการบางเตย ตอน 1',
  VC: 'กิจการร่วมค้า — โครงการลาดหลุมแก้ว ตอน 3',
  VK2: 'กิจการร่วมค้า — โครงการบางเตย ตอน 2',
  BV: 'กิจการร่วมค้า — โครงการบางวัว ตอน 6',
  PN4: 'กิจการร่วมค้า — โครงการพุทธมณฑล ตอน 4',
  EP: 'กิจการร่วมค้า — โครงการบ้านแพ้ว ตอน 3',
  'V&K': 'กิจการร่วมค้า — โครงการพุทธมณฑล ตอน 3',
}
const DEPT_BY_CODE: Record<string, string> = {
  '01': 'บริหาร', '02A': 'วิศวะ', '02B': 'วิศวะ', '02C': 'วิศวะ', '03': 'วิศวะ', '08': 'บุคคล', '09': 'บัญชี',
}
const THAI_MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

const DEPARTMENTS: Department[] = [
  { key: 'engineer', label: 'ฝ่ายวิศวกรรม' }, { key: 'hr', label: 'ฝ่ายบุคคล' },
  { key: 'account', label: 'ฝ่ายบัญชี' }, { key: 'finance', label: 'ฝ่ายการเงิน' },
  { key: 'supply', label: 'ฝ่ายพัสดุ-ทรัพย์สิน' }, { key: 'borihan', label: 'ฝ่ายบริหาร' },
]

// Mock auth token registry. signIn() (in the bridge) issues a token here.
const TOKENS: Record<string, string> = {}
export function mockIssueToken(email: string): string {
  const tok = 'mock-' + Math.random().toString(36).slice(2)
  TOKENS[tok] = email
  return tok
}
const emailFor = (token: string): string => TOKENS[token] || ''

function statusFromEntries(entries: ReviewEntry[]): Status {
  let status: Status = 'pending'
  for (const e of entries) {
    if (e.action === 'approve') status = 'approved'
    else if (e.action === 'reject') status = 'rejected'
    // Reactivated, not reset — matches readDiscussions_ in Code.js. A reopened
    // document floats back to the top (App.tsx's sort ranks 'commented' first)
    // and shows the same "needs another look" badge a fresh comment would.
    else if (e.action === 'reopen') status = 'commented'
    else if (e.action === 'comment' && status === 'pending') status = 'commented'
  }
  return status
}
function review(docId: string): ReviewResult {
  const entries = (THREADS[docId] ?? []).filter((e) => e.action !== 'delete')
  const status = statusFromEntries(entries)
  return { ok: true, status, locked: status === 'approved' || status === 'rejected', entries, combinedHtml: '' }
}
function applyStatusToRow(docId: string, status: Status) {
  for (const p of Object.keys(RAW)) {
    const arr = RAW[p]!
    const r = arr.find((x) => x.id === docId)
    if (r) r.status = status
  }
}
function packText(text: string, ink: string, ccDepts: string, ccEmails: string): string {
  let body = ink ? `INK:${ink}\n${text}` : text
  const cc = [
    ...ccDepts.split(/[,\s]+/).filter(Boolean).map((k) => DEPARTMENTS.find((d) => d.key === k)?.label || k),
    ...ccEmails.split(/[,\s]+/).filter(Boolean),
  ].join(', ')
  if (cc) body += `␟CC␟${cc}`
  return body
}
function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Next running number for project+code (mirrors updateRunningNo's regex).
function nextRunning(project: string, code: string): number {
  const sig = String(code).replace(/^0+/, '')
  const escd = sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('(?:^|[^0-9A-Za-z])0*' + escd + '[\\/\\-\\s]+0*(\\d{1,5})', 'gi')
  let max = -1
  for (const r of RAW[project] ?? []) {
    const hay = String(r.subject || '') + '  ' + String(r.ref || '')
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(hay)) !== null) {
      const n = parseInt(m[1]!, 10)
      if (!isNaN(n) && n > max) max = n
    }
  }
  return max + 1
}
function makeRef(project: string, code: string): string {
  const prefix = LH_PREFIX[project] || project
  const dept = DEPT_BY_CODE[code] || 'วิศวะ'
  return `${prefix}/${dept}/${code}/${pad3(nextRunning(project, code))}`
}
function thaiDate(docDate: string): string {
  const m = docDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) || docDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return docDate
  let d: number, mo: number, y: number
  if (docDate.includes('-')) { y = +m[1]!; mo = +m[2]!; d = +m[3]! }
  else { d = +m[1]!; mo = +m[2]!; y = +m[3]! }
  return `${d} ${THAI_MONTHS[mo]} ${y + 543}`
}

// Faithful-enough Thai A4 letter (server builds the real one; same layout).
function buildLetterHtml(a: PreviewLetterArgs, ref: string): string {
  const company = LH_COMPANY[a.project] || a.project
  const bodyHtml = esc(a.body || '').replace(/\n/g, '<br>')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<style>
  @page{size:A4;margin:0}
  body{margin:0;background:#525659;font-family:'Sarabun','TH Sarabun New','Segoe UI',sans-serif;color:#000}
  .pg{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:10mm 18mm 18mm;box-sizing:border-box;box-shadow:0 0 12px rgba(0,0,0,.5)}
  .mh{text-align:center;border-bottom:2px solid #1a3a6b;padding-bottom:10px;margin-bottom:18px}
  .mh .co{font-size:20px;font-weight:700;color:#1a3a6b}
  .mh .un{font-size:13px;color:#444;margin-top:2px}
  .meta{display:flex;justify-content:space-between;font-size:14px;margin:14px 0}
  .subj{font-weight:700;margin:10px 0}
  .bd{font-size:15px;line-height:2;text-align:justify;margin:12px 0;min-height:120mm}
  .clo{margin-top:30px;text-align:right;font-size:15px}
  .sign{margin-top:40px;text-align:right;font-size:15px}
  .ty{margin-top:30px;font-size:12px;color:#555}
</style></head><body><div class="pg">
  <div class="mh"><div class="co">${esc(company)}</div><div class="un">${esc(PROJ_DISPLAY(a.project))}</div></div>
  <div class="meta"><span>ที่ ${esc(ref)}</span><span>วันที่ ${esc(thaiDate(a.docDate || ''))}</span></div>
  <div class="subj">เรื่อง&nbsp;&nbsp;${esc(a.subject || '')}</div>
  <div>เรียน&nbsp;&nbsp;${esc(a.to || '')}</div>
  ${a.cc ? `<div>สำเนาเรียน&nbsp;&nbsp;${esc(a.cc)}</div>` : ''}
  <div class="bd">${bodyHtml}</div>
  <div class="clo">จึงเรียนมาเพื่อโปรดพิจารณา</div>
  <div class="sign">ขอแสดงความนับถือ<br><br>(ผู้จัดการโครงการ ${esc(a.project)})</div>
  ${a.typist ? `<div class="ty">${esc(a.typist)}/พิมพ์</div>` : ''}
</div></body></html>`
}
function PROJ_DISPLAY(p: string): string { return p }

// ── the Api implementation ───────────────────────────────────────────
export const mockApi: Api = {
  async getDocuments() {
    await wait(450)
    const out: DocumentsByProject = {}
    for (const [proj, rows] of Object.entries(RAW)) {
      out[proj] = rows.map((r, i) => ({ ...r, num: i + 1 }))
    }
    return out
  },
  async getLetterheadMeta(): Promise<LetterheadMeta> {
    await wait(120)
    return { projects: LH_PROJECTS.slice(), defaults: { ...LH_DEFAULTS } }
  },
  async getDepartments() { await wait(120); return DEPARTMENTS.slice() },
  async getReviewerRole(token): Promise<ReviewerRole> {
    await wait(80)
    const email = emailFor(token)
    return { signedIn: !!email, email, manager: !!email && MANAGERS.has(email) }
  },
  async getOAuthUrl(state) { await wait(40); return 'https://accounts.google.com/o/oauth2/v2/auth?mock=1&state=' + encodeURIComponent(state) },
  async claimAuth(): Promise<ClaimAuthResult> { await wait(40); return {} },
  async getReview(docId) { await wait(180); return review(docId) },
  async addReviewComment(a: ReviewMutationArgs) {
    await wait(220)
    const email = emailFor(a.authToken)
    if (!email) return { ok: false, status: 'pending', locked: false, entries: [], combinedHtml: '', error: 'Session expired' }
      ; (THREADS[a.docId] ??= []).push({ action: 'comment', email, time: now(), text: packText(a.text, a.ink, a.ccDepts, a.ccEmails) })
    const res = review(a.docId); applyStatusToRow(a.docId, res.status); return res
  },
  async submitDecision(a: DecisionArgs) {
    await wait(240)
    const email = emailFor(a.authToken)
    if (!email || !MANAGERS.has(email)) return { ok: false, status: 'pending', locked: false, entries: [], combinedHtml: '', error: 'Not authorised' }
      ; (THREADS[a.docId] ??= []).push({ action: a.decision, email, time: now(), text: packText(a.text, a.ink, a.ccDepts, a.ccEmails) })
    const res = review(a.docId); applyStatusToRow(a.docId, res.status); return res
  },
  async reopenDocument(a: ReviewMutationArgs) {
    await wait(220)
    const email = emailFor(a.authToken)
    if (!email || !MANAGERS.has(email)) return { ok: false, status: 'pending', locked: false, entries: [], combinedHtml: '', error: 'Not authorised' }
      ; (THREADS[a.docId] ??= []).push({ action: 'reopen', email, time: now(), text: packText(a.text, a.ink, a.ccDepts, a.ccEmails) })
    const res = review(a.docId); applyStatusToRow(a.docId, res.status); return res
  },
  async deleteOwnLastEntry(authToken, docId) {
    await wait(180)
    const email = emailFor(authToken)
    const list = THREADS[docId] ?? []
    const last = list[list.length - 1]
    if (last && last.email === email && last.action === 'comment') list.pop()
    const res = review(docId); applyStatusToRow(docId, res.status); return res
  },
  async sendToMangoERP(_a: MangoArgs): Promise<MangoResult> {
    await wait(260)
    return { ok: true, demo: true, message: 'Mock: queued for Mango ERP (no endpoint configured).' }
  },
  async deleteDocument(a: DeleteDocArgs): Promise<SimpleOk> {
    await wait(200)
    const email = emailFor(a.authToken)
    if (!email || !MANAGERS.has(email)) return { ok: false, error: 'Not authorised' }
    for (const p of Object.keys(RAW)) RAW[p] = RAW[p]!.filter((r) => r.id !== a.docId)
    // Preserve the thread as an audit trail, matching deleteDocument in
    // Code.js: it trashes the register row but never clears Discussions —
    // it appends a 'delete' entry instead, so the history of who commented,
    // approved, or rejected before deletion survives even though the row
    // itself is gone. review()'s own read path already filters 'delete'
    // entries back out (see the action !== 'delete' filter above), so this
    // is a pure append with no other reader affected.
    ; (THREADS[a.docId] ??= []).push({ action: 'delete', email, time: now(), text: 'Document deleted' })
    return { ok: true }
  },
  async previewLetter(a: PreviewLetterArgs): Promise<PreviewLetterResult> {
    await wait(300)
    if (!a.project || !LH_PROJECTS.includes(a.project)) return { ok: false, error: 'Select a project that has a letter template.' }
    if (!a.code) return { ok: false, error: 'Select a code first (it sets the ref number).' }
    const ref = makeRef(a.project, a.code)
    return { ok: true, ref, html: buildLetterHtml(a, ref) }
  },
  async submitDocument(a: SubmitDocumentArgs): Promise<SubmitDocumentResult> {
    await wait(600)
    const email = emailFor(a.authToken)
    if (!email) return { success: false, error: 'Session expired' }
    if (!a.project || !a.code || !a.subject.trim()) return { success: false, error: 'Project, Code and Subject are required.' }
    const generated = LH_PROJECTS.includes(a.project)
    const ref = generated ? makeRef(a.project, a.code) : ''
    const token = 'pending-' + Math.random().toString(36).slice(2)
    const desc = generated ? `${ref} · auto-letter` : (a.filename ? `แนบไฟล์: ${a.filename}` : '')
    const newRow = row(a.docDate || now().split(' ')[0]!, a.code, a.subject.trim(), desc, 'pending', true, ref)
      ; (RAW[a.project] ??= []).unshift(newRow)
    const letterHtml = generated
      ? buildLetterHtml({ project: a.project, code: a.code, subject: a.subject, to: a.to, cc: a.cc, typist: a.typist, body: a.body, docDate: a.docDate }, ref)
      : ''
    return { success: true, fileUrl: newRow.url, placed: true, generated, ref, editUrl: '', letterHtml, pending: generated, token }
  },
  async finalizeLetter(_a: FinalizeLetterArgs): Promise<FinalizeLetterResult> {
    await wait(400)
    return { ok: true, url: 'https://drive.google.com/file/d/MOCK_PDF/view', editUrl: 'https://docs.google.com/document/d/MOCK_DOC/edit' }
  },
  async streamFileForViewer(): Promise<StreamFileResult> {
    await wait(200)
    return { ok: false, isNative: true, name: 'document.pdf', mime: 'application/pdf', previewUrl: '' }
  },
  async streamGmailAttachment(): Promise<StreamFileResult> {
    await wait(200)
    return { ok: false, error: 'Mock: Gmail attachment streaming is not available in the preview.' }
  },
  async getDocAttachments(): Promise<DocAttachmentsResult> {
    await wait(160)
    return { ok: true, atts: [], threadId: '' }
  },
  // Same gate as approve/reject/delete/mango — Code.js reuses one isManager_
  // check for both instead of a separate admin-only concept, so anyone
  // granted management authority automatically gets Access Control rights
  // too. A narrower `=== OWNER` check here would silently diverge the moment
  // a second name is ever added to MANAGERS.
  async getAccessConfig(authToken): Promise<AccessConfigResult> {
    await wait(180)
    const email = emailFor(authToken)
    if (!email || !MANAGERS.has(email)) return { ok: false, isAdmin: false, error: 'Sign in as an admin to manage access.' }
    return {
      ok: true, isAdmin: true, email,
      rules: ACCESS_RULES,
      codeLabels: { '01': 'บริหาร', '02A': 'วิศวะ', '02B': 'วิศวะ', '02C': 'วิศวะ', '08': 'บุคคล', '09': 'บัญชี', '10': 'ขอหนังสือรับรอง' },
      projectKeys: Object.keys(RAW).sort(),
      defaultPublicPrefixes: ['01', '02', '03', '04', '05', '06', '07', '09', '10'],
    }
  },
  async setAccessConfig(authToken, jsonPayload): Promise<SetAccessConfigResult> {
    await wait(220)
    const email = emailFor(authToken)
    if (!email || !MANAGERS.has(email)) return { ok: false, error: 'Not authorised' }
    try { ACCESS_RULES = JSON.parse(jsonPayload) as AccessRules } catch { return { ok: false, error: 'Bad payload' } }
    return { ok: true, rules: ACCESS_RULES }
  },
}

let ACCESS_RULES: AccessRules = {
  codes: { '08': { conf: true, allow: ['hr@vcb-con.com'] } },
  projects: {},
}

export const MOCK_OWNER = OWNER
export const MOCK_MANAGERS = MANAGERS
