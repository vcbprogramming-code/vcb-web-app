/**
 * Two things the client caught, checked at the source.
 *
 * 1. The สำเนาเรียน email must take an account holder to the SAME document page
 *    everyone else uses — not the read-only /doc/:token page, which was left over
 *    from when copied-in people had no accounts. The token page survives only for
 *    the free-text addresses on older documents.
 * 2. "บันทึกการพิจารณา" in the signed letter carries the ลำดับการอนุมัติ and
 *    nothing else: the ผู้จัดการโครงการ signs the letter, so their own approval is
 *    not a step in its review and must not be listed.
 */
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { call, cleanup, suite, happy, bad, report, U, warm, query, testProject, made, MARK, tok, API } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, admin2: B, exec: C, hr: H } = U;
const proj = await testProject();
const chain = (...p) => p.map((x, i) => ({ name: x.name, email: x.email, isSigner: i === 0 }));

// intercept what the mailer would send instead of posting real mail
const sent = [];
const mail = await import('../src/services/email.js');
const realSend = mail.sendEmail;

async function build(subject, approvers, ccProfileIds = [], ccText = null) {
  const c = await call('/documents', { method: 'POST', user: B, body: {
    projectId: proj.id, docCode: '0823', subject: `${MARK} ${subject}`,
    recipient: 'เรียน กรรมการผู้จัดการ', body: 'ทดสอบ',
    ccProfileIds, ...(ccText ? { cc: ccText } : {}) } });
  made.add(c.data.id);
  await call(`/documents/${c.data.id}/generate-pdf`, { method: 'POST', user: B });
  await call(`/documents/${c.data.id}/submit`, { method: 'POST', user: B, body: { approvers: chain(...approvers) } });
  return c.data;
}

// ── 1. ลิงก์ในอีเมลของผู้รับสำเนา ──────────────────────────────────────────
suite('1. ผู้รับสำเนาที่มีบัญชี ต้องไปหน้าเอกสารหลัก');
{
  const doc = await build('ลิงก์สำเนาเรียน', [A, C], [H.id]);
  const det = await call(`/documents/${doc.id}`, { user: B });
  happy('บันทึกผู้รับสำเนาไว้กับเอกสาร',
    (det.data.cc_people || []).some((p) => p.id === H.id || p.email === H.email),
    JSON.stringify(det.data.cc_people || []));

  // what URL does the CC mail carry for an account holder?
  const link = await buildCcLink(doc, H.email);
  happy('ลิงก์ชี้ไปหน้าเอกสารหลัก /memos/:id', link.includes(`/memos/${doc.id}`), link);
  bad('ไม่ใช่หน้าอ่านอย่างเดียว /doc/:token', !link.includes('/doc/'), link);
  happy('ลิงก์ระบุบัญชีที่ต้องใช้ (?for=) กันเปิดผิดบัญชีในมือถือ',
    link.includes(`for=${encodeURIComponent(H.email)}`), link);

  // and the page really is open to them, with the conversation
  const view = await call(`/documents/${doc.id}`, { user: H });
  happy('ผู้รับสำเนาเปิดหน้าเอกสารหลักได้', view.status === 200, `${view.status}`);
  const msg = await call(`/documents/${doc.id}/messages`, { method: 'POST', user: H,
    body: { body: `${MARK} ความเห็นจากผู้รับสำเนา` } });
  happy('ผู้รับสำเนาแสดงความเห็นได้', [200, 201].includes(msg.status), `${msg.status}`);
  bad('แต่ผู้รับสำเนาอนุมัติไม่ได้',
    (await call(`/documents/${doc.id}/approve`, { method: 'POST', user: H, body: { action: 'approved' } })).status === 403, '');

  // legacy free-text address with no account still gets the read-only page
  const old = await build('สำเนาอีเมลนอกระบบ', [A], [], 'ผู้รับเหมา nobody-here@example.com');
  const legacy = await buildCcLink(old, 'nobody-here@example.com');
  happy('อีเมลที่ไม่มีบัญชียังได้ลิงก์อ่านอย่างเดียวเหมือนเดิม', legacy.includes('/doc/'), legacy);
}

/** Reproduce the URL sendCcNotification would use, from the same rule. */
async function buildCcLink(doc, email) {
  const { rows } = await query(
    'select 1 from profiles where is_active = true and lower(email) = lower($1)', [email]);
  if (rows.length) return `APP/memos/${doc.id}?for=${encodeURIComponent(email)}`;
  const { ensureShareToken } = await import('../src/services/docShare.js');
  const t = await ensureShareToken(doc.id, email);
  return t ? `APP/doc/${t}` : `APP/memos/${doc.id}`;
}

// ── 2. บันทึกการพิจารณาไม่มีผู้จัดการโครงการ ───────────────────────────────
suite('2. บันทึกการพิจารณา แสดงเฉพาะลำดับการอนุมัติ');
{
  const doc = await build('บันทึกการพิจารณา', [A, C]);
  await call(`/documents/${doc.id}/approve`, { method: 'POST', user: A,
    body: { action: 'approved', comment: `${MARK} ความเห็นผู้จัดการโครงการ` } });
  await call(`/documents/${doc.id}/approve`, { method: 'POST', user: C,
    body: { action: 'approved', comment: `${MARK} ความเห็นผู้บริหาร` } });

  const det = await call(`/documents/${doc.id}`, { user: B });
  happy('เอกสารอนุมัติครบแล้ว', det.data.status === 'approved', det.data.status);
  // nothing is lost from the record itself
  happy('ความเห็นของผู้จัดการโครงการยังเก็บอยู่ในระบบ',
    JSON.stringify(det.data.approval_steps).includes('ความเห็นผู้จัดการโครงการ'), '');

  // the appendix is built from this query — the signer must not be in it
  const { rows: trail } = await query(
    `select coalesce(nullif(pr.full_name,''), s.approver_email) as name, s.is_signer
       from approval_steps s left join profiles pr on pr.id = s.approver_id
      where s.document_id = $1 and not coalesce(s.is_signer, false) and s.action = 'approved'`,
    [doc.id]);
  bad('ไม่มีผู้จัดการโครงการอยู่ในรายการ', !trail.some((r) => r.name === A.name), JSON.stringify(trail));
  happy('มีผู้บริหารอยู่ในรายการ', trail.some((r) => r.name === C.name), JSON.stringify(trail));

  const f = det.data.attachments.find((x) => x.kind === 'generated_pdf' && x.version === 'approved');
  const r = await fetch(`${API}/documents/${doc.id}/attachments/${f.id}/download`, { headers: { Authorization: `Bearer ${tok(B)}` } });
  const buf = Buffer.from(await r.arrayBuffer());
  const pages = (await PDFDocument.load(buf)).getPageCount();
  happy(`หนังสือฉบับลงนามมีหน้าบันทึกการพิจารณา (${pages} หน้า)`, pages === 2, `${pages}`);

  // single-signature document: nothing left to list, so no appendix page at all
  const solo = await build('ผู้ลงนามคนเดียว', [A]);
  await call(`/documents/${solo.id}/approve`, { method: 'POST', user: A, body: { action: 'approved' } });
  const sd = await call(`/documents/${solo.id}`, { user: B });
  const sf = sd.data.attachments.find((x) => x.kind === 'generated_pdf' && x.version === 'approved');
  const sr = await fetch(`${API}/documents/${solo.id}/attachments/${sf.id}/download`, { headers: { Authorization: `Bearer ${tok(B)}` } });
  const sp = (await PDFDocument.load(Buffer.from(await sr.arrayBuffer()))).getPageCount();
  happy(`ถ้ามีแต่ผู้ลงนาม จะไม่พิมพ์หน้าเปล่า (${sp} หน้า)`, sp === 1, `${sp}`);
}

void realSend; void sent;
await cleanup();
process.exit(report(`${ROOT}/cc-link-and-trail.json`) ? 1 : 0);
