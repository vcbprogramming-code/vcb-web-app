import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { ensureShareToken } from './docShare.js';

/**
 * Email delivery. Three modes, picked at send time:
 *   1. BREVO_API_KEY set → Brevo HTTP API over HTTPS (works on hosts like Render
 *      that block outbound SMTP ports). This is the preferred production path.
 *   2. else SMTP_HOST set → classic SMTP via nodemailer.
 *   3. else → console logger so development works without any mail provider.
 */
const hasBrevoApi = Boolean(process.env.BREVO_API_KEY);
const hasSmtp = Boolean(process.env.SMTP_HOST);

const transport = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const FROM = process.env.MAIL_FROM || 'HR System <no-reply@vcb.local>';

/** Split "Name <email@host>" (or a bare address) into { name, email }. */
function parseFrom(from) {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(from);
  if (m) return { name: m[1] || undefined, email: m[2] };
  return { email: from.trim() };
}

/** Send via Brevo's transactional email HTTP API (HTTPS, no SMTP needed). */
async function sendViaBrevoApi({ to, subject, html, text }) {
  const sender = parseFrom(FROM);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      // accept a single address OR a list — Brevo wants [{email}], and passing an
      // array straight through produced {"email":[...]} which it rejects.
      to: (Array.isArray(to) ? to : [to]).filter(Boolean).map((email) => ({ email })),
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

/** Send an email. Brevo API → SMTP → console, depending on what's configured. */
export async function sendEmail({ to, subject, html, text }) {
  if (hasBrevoApi) {
    return sendViaBrevoApi({ to, subject, html, text });
  }
  if (transport) {
    return transport.sendMail({ from: FROM, to, subject, html, text });
  }
  console.log('\n📧 [DEV EMAIL — not sent, no mail provider configured]');
  console.log('   to:', to);
  console.log('   subject:', subject);
  console.log('   text:', (text || html || '').replace(/<[^>]+>/g, '').slice(0, 400));
  console.log('');
  return { dev: true };
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Thai Buddhist-era long date, e.g. "8 มิถุนายน 2569". */
function thaiDate(d) {
  if (!d) return '';
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const x = new Date(d);
  return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear() + 543}`;
}

/**
 * Compose + send the approval request email for one approval step.
 * Single primary CTA → the public /approve page (no login) where the approver
 * sees the full document detail, attachments, and the approve/return/reject
 * actions. The page is the source of truth, not the email.
 */
export async function sendApprovalRequest({ step, doc }) {
  // Login-gated in-app approval: the link opens the document in the web app
  // (redirecting through login if needed). The approver acts from the detail page.
  //
  // ?for= carries WHO the notice was addressed to. On a phone signed into several
  // Google accounts the link opens under whichever account the browser already
  // holds — the approver then saw a document with no approve button and no
  // explanation, and had to work out for themselves that they must sign out.
  // With this the app can say so and offer to switch in one tap. It is a hint for
  // the UI only: authorisation is still decided server-side, per step.
  const url = `${env.appBaseUrl}/memos/${doc.id}?for=${encodeURIComponent(step.approver_email || '')}`;
  const row = (label, value) =>
    `<tr>
       <td style="padding:8px 16px 8px 0;color:#64748b;white-space:nowrap;vertical-align:top">${label}</td>
       <td style="padding:8px 0;color:#0f172a;font-weight:500">${value}</td>
     </tr>`;

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Tahoma','Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <!-- header -->
      <div style="background:#1d4ed8;background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.5px;opacity:.85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">บันทึกข้อความขออนุมัติ</div>
      </div>
      <!-- body -->
      <div style="padding:28px">
        <p style="margin:0 0 4px;font-size:15px;color:#0f172a">เรียน <b>${esc(step.approver_name || 'ผู้อนุมัติ')}</b></p>
        <p style="margin:0 0 20px;font-size:15px;color:#334155">มีเอกสารรอการพิจารณาอนุมัติจากท่าน รายละเอียดดังนี้</p>

        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px">
          ${row('เลขที่หนังสือ', `<b style="font-size:15px">${esc(doc.doc_number)}</b>`)}
          ${row('เรื่อง', esc(doc.subject))}
          ${doc.recipient ? row('เรียน', esc(doc.recipient)) : ''}
          ${doc.date_received ? row('วันที่', thaiDate(doc.date_received)) : ''}
        </table>

        <!-- single CTA -->
        <div style="text-align:center;margin:8px 0 24px">
          <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none">
            ดูรายละเอียดและพิจารณาอนุมัติ
          </a>
        </div>

        <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center">
          คลิกปุ่มด้านบนเพื่อเข้าสู่ระบบและดูเอกสารฉบับเต็ม ไฟล์แนบ แล้วดำเนินการอนุมัติ / ส่งกลับแก้ไข / ไม่อนุมัติ<br>
          กรุณาเข้าสู่ระบบด้วยบัญชีของท่าน (อีเมลนี้)
        </p>
      </div>
      <!-- footer -->
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
        อีเมลฉบับนี้ส่งโดยอัตโนมัติจากระบบงานภายใน วิจิตรภัณฑ์ก่อสร้าง — กรุณาอย่าตอบกลับ
      </div>
    </div>
  </div>`;

  return sendEmail({
    to: step.approver_email,
    subject: `[รออนุมัติ] ${doc.doc_number} — ${doc.subject}`,
    html,
    text: `เรียน ${step.approver_name || 'ผู้อนุมัติ'}\n\nมีเอกสารรออนุมัติจากท่าน\nเลขที่: ${doc.doc_number}\nเรื่อง: ${doc.subject}\n\nดูรายละเอียดและพิจารณาอนุมัติ:\n${url}`,
  });
}

/**
 * Extract valid email addresses from a free-text "สำเนาเรียน / CC" field.
 * The field may hold names, emails, or a mix separated by comma / semicolon /
 * newline (e.g. "ฝ่ายบัญชี, somchai@vcb.co.th"). Only the emails are returned.
 */
export function extractCcEmails(ccText) {
  if (!ccText) return [];
  const found = String(ccText).match(/[^\s,;<>()]+@[^\s,;<>()]+\.[^\s,;<>()]+/g) || [];
  // de-dupe, lowercase-compare, keep original form
  const seen = new Set();
  const out = [];
  for (const e of found) {
    const key = e.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out;
}

/**
 * Send a "for your information / please advise" copy to the CC recipients when a
 * document is submitted for approval. This is NOT an approval request — the CC
 * people are consulted, they do not approve and get no action link. `toEmails`
 * is an array; one email is sent per recipient.
 */
export async function sendCcNotification({ toEmails, doc, actorName, stage = 'submitted' }) {
  const emails = Array.isArray(toEmails) ? toEmails.filter(Boolean) : [];
  if (!emails.length) return { skipped: true };
  // A "เพื่อทราบ" copy is only useful if it also carries the outcome — the submit
  // notice alone left CC recipients never learning whether the document passed.
  const done = stage === 'approved';
  const heading = done ? 'สำเนาเรียน — เอกสารได้รับการอนุมัติแล้ว' : 'สำเนาเรียน (เพื่อทราบ / ปรึกษา)';
  const lead = done
    ? 'เรียนเพื่อทราบ — เอกสารที่ส่งสำเนาถึงท่าน <b>ได้รับการอนุมัติครบทุกลำดับแล้ว</b> สามารถเปิดดูหนังสือฉบับที่ลงนามแล้วได้จากปุ่มด้านล่าง'
    : 'เรียนเพื่อทราบ — มีเอกสารส่งสำเนาถึงท่านเพื่อทราบหรือขอปรึกษา <b>ท่านไม่จำเป็นต้องอนุมัติ</b> เอกสารนี้อยู่ระหว่างการพิจารณาตามสายอนุมัติปกติ';
  const accent = done ? '#15803d' : '#0f766e';
  const accent2 = done ? '#16a34a' : '#0d9488';
  const tag = done ? 'อนุมัติแล้ว' : 'สำเนาเรียน';
  const row = (label, value) =>
    `<tr>
       <td style="padding:8px 16px 8px 0;color:#64748b;white-space:nowrap;vertical-align:top">${label}</td>
       <td style="padding:8px 0;color:#0f172a;font-weight:500">${value}</td>
     </tr>`;

  const body = (url) => `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Tahoma','Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:${accent};background:linear-gradient(135deg,${accent2},${accent});padding:24px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.5px;opacity:.85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">${heading}</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 16px;font-size:15px;color:#334155">${lead}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px">
          ${row('เลขที่หนังสือ', `<b style="font-size:15px">${esc(doc.doc_number)}</b>`)}
          ${row('เรื่อง', esc(doc.subject))}
          ${doc.recipient ? row('เรียน', esc(doc.recipient)) : ''}
          ${doc.date_received ? row('วันที่', thaiDate(doc.date_received)) : ''}
          ${actorName ? row('ผู้ส่งเรื่อง', esc(actorName)) : ''}
        </table>
        <div style="text-align:center;margin:8px 0 4px">
          <a href="${url}" style="display:inline-block;background:${accent2};color:#fff;font-size:15px;font-weight:600;padding:12px 30px;border-radius:10px;text-decoration:none">
            เปิดดูเอกสาร
          </a>
        </div>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;text-align:center">
          เปิดได้จากลิงก์นี้โดยไม่ต้องเข้าสู่ระบบ · ลิงก์นี้เป็นของท่านโดยเฉพาะ กรุณาอย่าส่งต่อ
        </p>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
        อีเมลฉบับนี้ส่งโดยอัตโนมัติเพื่อทราบ — ไม่ต้องดำเนินการอนุมัติ · กรุณาอย่าตอบกลับ
      </div>
    </div>
  </div>`;

  const results = [];
  for (const to of emails) {
    // Each recipient gets THEIR OWN read-only link. It used to be /memos/:id for
    // everyone — a page behind the login wall, which a copied-in person outside
    // the provisioned account list could never get past. Falls back to the
    // in-app page if the token can't be minted, so the notice still goes out.
    const token = await ensureShareToken(doc.id, to);
    const url = token ? `${env.appBaseUrl}/doc/${token}` : `${env.appBaseUrl}/memos/${doc.id}`;
    const r = await sendEmail({
      to,
      subject: `[${tag}] ${doc.doc_number} — ${doc.subject}`,
      html: body(url),
      text: `${done ? 'เรียนเพื่อทราบ — เอกสารที่ส่งสำเนาถึงท่านได้รับการอนุมัติครบทุกลำดับแล้ว' : 'เรียนเพื่อทราบ — มีเอกสารส่งสำเนาถึงท่านเพื่อทราบ/ปรึกษา (ไม่ต้องอนุมัติ)'}\nเลขที่: ${doc.doc_number}\nเรื่อง: ${doc.subject}\n${actorName ? `ผู้ส่งเรื่อง: ${actorName}\n` : ''}\nเปิดดู (ไม่ต้องเข้าสู่ระบบ): ${url}`,
    }).catch((e) => ({ error: e.message, to }));
    results.push(r);
  }
  return { sent: emails.length, results };
}

/**
 * Ask an in-system user for an OPINION on a document (not an approval). Sent when
 * the current approver uses "ขอความเห็น". The recipient logs in and replies in
 * the conversation thread; the approval status is unchanged.
 */
export async function sendConsultRequest({ toEmail, toName, doc, askerName, question }) {
  if (!toEmail) return { skipped: true };
  // ?for= — same multi-account hint as the approval notice (see sendApprovalRequest)
  const url = `${env.appBaseUrl}/memos/${doc.id}?for=${encodeURIComponent(toEmail)}`;
  const row = (label, value) =>
    `<tr>
       <td style="padding:8px 16px 8px 0;color:#64748b;white-space:nowrap;vertical-align:top">${label}</td>
       <td style="padding:8px 0;color:#0f172a;font-weight:500">${value}</td>
     </tr>`;
  const html = `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Tahoma','Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#1d4ed8;background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.5px;opacity:.85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">ขอความเห็นประกอบการพิจารณา</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 6px;font-size:15px;color:#0f172a">เรียน <b>${esc(toName || 'ผู้รับ')}</b></p>
        <p style="margin:0 0 16px;font-size:15px;color:#334155">
          ${esc(askerName || 'ผู้อนุมัติ')} ขอความเห็นจากท่านเกี่ยวกับเอกสารด้านล่าง
          <b>ท่านไม่จำเป็นต้องอนุมัติ</b> เพียงเข้าไปดูเอกสารและให้ความเห็นในระบบ
        </p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px">
          ${row('เลขที่หนังสือ', `<b style="font-size:15px">${esc(doc.doc_number)}</b>`)}
          ${row('เรื่อง', esc(doc.subject))}
        </table>
        ${question ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin-bottom:20px"><div style="color:#1d4ed8;font-size:13px;margin-bottom:2px;font-weight:600">คำถาม/สิ่งที่ขอปรึกษา</div>${esc(question)}</div>` : ''}
        <div style="text-align:center">
          <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;padding:12px 30px;border-radius:10px;text-decoration:none">
            เปิดดูเอกสารและให้ความเห็น
          </a>
        </div>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
        เข้าสู่ระบบด้วยบัญชีของท่าน (อีเมลนี้) เพื่อให้ความเห็น — ไม่ใช่การอนุมัติ
      </div>
    </div>
  </div>`;
  return sendEmail({
    to: toEmail,
    subject: `[ขอความเห็น] ${doc.doc_number} — ${doc.subject}`,
    html,
    text: `เรียน ${toName || 'ผู้รับ'}\n\n${askerName || 'ผู้อนุมัติ'} ขอความเห็นจากท่าน (ไม่ใช่การอนุมัติ)\nเลขที่: ${doc.doc_number}\nเรื่อง: ${doc.subject}\n${question ? `คำถาม: ${question}\n` : ''}\nเปิดดูและให้ความเห็น: ${url}`,
  });
}

/**
 * Notify the document author of an approval outcome (approved / returned /
 * rejected). `outcome` ∈ 'approved'|'returned'|'rejected'.
 */
export async function sendAuthorNotification({ toEmail, authorName, doc, outcome, actorName, comment }) {
  if (!toEmail) return { skipped: true };
  const meta = {
    approved: { label: 'ได้รับการอนุมัติแล้ว', color: '#16a34a', cta: 'เปิดดูเอกสารที่อนุมัติแล้ว' },
    returned: { label: 'ถูกส่งกลับให้แก้ไข', color: '#ea580c', cta: 'แก้ไขและส่งอนุมัติอีกครั้ง' },
    rejected: { label: 'ไม่ได้รับการอนุมัติ', color: '#dc2626', cta: 'เปิดดูเอกสาร' },
  }[outcome] || { label: outcome, color: '#334155', cta: 'เปิดดูเอกสาร' };
  // open THIS document directly so the author lands on the decided document
  // (?for= — same multi-account hint as the approval notice)
  const url = `${env.appBaseUrl}/memos/${doc.id}?for=${encodeURIComponent(toEmail)}`;
  const html = `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Tahoma','Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:${meta.color};padding:22px 28px;color:#fff">
        <div style="font-size:13px;opacity:.85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
        <div style="font-size:19px;font-weight:700;margin-top:4px">เอกสารของท่าน${meta.label}</div>
      </div>
      <div style="padding:28px;font-size:15px;color:#334155">
        <p style="margin:0 0 6px">เรียน <b>${esc(authorName || 'ผู้จัดทำ')}</b></p>
        <p style="margin:0 0 16px">เอกสารเลขที่ <b>${esc(doc.doc_number)}</b> เรื่อง “${esc(doc.subject)}” <b style="color:${meta.color}">${meta.label}</b>${actorName ? ` โดย ${esc(actorName)}` : ''}</p>
        ${comment ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="color:#64748b;font-size:13px;margin-bottom:2px">เหตุผล/ความเห็น</div>${esc(comment)}</div>` : ''}
        <div style="text-align:center;margin-top:8px">
          <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none">${meta.cta}</a>
        </div>
      </div>
    </div>
  </div>`;
  return sendEmail({
    to: toEmail,
    subject: `[${meta.label}] ${doc.doc_number} — ${doc.subject}`,
    html,
    text: `เรียน ${authorName || 'ผู้จัดทำ'}\n\nเอกสารเลขที่ ${doc.doc_number} เรื่อง ${doc.subject} ${meta.label}${actorName ? ` โดย ${actorName}` : ''}\n${comment ? `เหตุผล: ${comment}\n` : ''}\nเปิดดู: ${url}`,
  });
}

/**
 * Tell someone they were @mentioned in a document's conversation.
 *
 * The client asked for this so a discussion can pull a colleague in without
 * leaving the system. Mentions only ever target real accounts, so the link goes
 * to the document page itself (with the ?for= hint that fixes the
 * multi-account-browser trap — see sendApprovalRequest).
 */
export async function sendMentionNotification({ toEmail, toName, doc, authorName, body }) {
  if (!toEmail) return { skipped: true };
  const url = `${env.appBaseUrl}/memos/${doc.id}?for=${encodeURIComponent(toEmail)}`;
  const quoted = String(body || '').slice(0, 400);
  const html = `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Tahoma','Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#7c3aed;background:linear-gradient(135deg,#8b5cf6,#6d28d9);padding:24px 28px;color:#fff">
        <div style="font-size:13px;letter-spacing:.5px;opacity:.85">ระบบงานภายใน · วิจิตรภัณฑ์ก่อสร้าง</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">มีผู้กล่าวถึงท่านในเอกสาร</div>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 4px;font-size:15px;color:#0f172a">เรียน <b>${esc(toName || 'ท่าน')}</b></p>
        <p style="margin:0 0 18px;font-size:15px;color:#334155">
          <b>${esc(authorName || 'ผู้ใช้')}</b> กล่าวถึงท่านในบันทึกของเอกสารต่อไปนี้
        </p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px">
          <tr><td style="padding:8px 16px 8px 0;color:#64748b;white-space:nowrap;vertical-align:top">เลขที่หนังสือ</td>
              <td style="padding:8px 0;color:#0f172a;font-weight:500"><b style="font-size:15px">${esc(doc.doc_number)}</b></td></tr>
          <tr><td style="padding:8px 16px 8px 0;color:#64748b;white-space:nowrap;vertical-align:top">เรื่อง</td>
              <td style="padding:8px 0;color:#0f172a;font-weight:500">${esc(doc.subject)}</td></tr>
        </table>
        <div style="border-left:3px solid #8b5cf6;padding:6px 0 6px 14px;margin:0 0 22px;color:#334155;font-size:14px;white-space:pre-wrap">${esc(quoted)}</div>
        <div style="text-align:center">
          <a href="${url}" style="display:inline-block;background:#6d28d9;color:#fff;font-size:15px;font-weight:600;padding:12px 30px;border-radius:10px;text-decoration:none">
            เปิดเอกสารและตอบกลับ
          </a>
        </div>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
        อีเมลฉบับนี้ส่งโดยอัตโนมัติ · กรุณาอย่าตอบกลับ
      </div>
    </div>
  </div>`;
  return sendEmail({
    to: toEmail,
    subject: `[กล่าวถึงท่าน] ${doc.doc_number} — ${doc.subject}`,
    html,
    text: `${authorName || 'ผู้ใช้'} กล่าวถึงท่านในเอกสาร\nเลขที่: ${doc.doc_number}\nเรื่อง: ${doc.subject}\n\n"${quoted}"\n\nเปิดเอกสาร: ${url}`,
  });
}
