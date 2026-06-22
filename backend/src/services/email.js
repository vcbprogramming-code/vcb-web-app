import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Email transport. If SMTP env vars are configured we send for real; otherwise
 * we fall back to a console "ethereal" logger so development works without SMTP.
 * Configure later via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM.
 */
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

/** Send an email. In dev (no SMTP) it just logs to the console. */
export async function sendEmail({ to, subject, html, text }) {
  if (!transport) {
    console.log('\n📧 [DEV EMAIL — not sent, no SMTP configured]');
    console.log('   to:', to);
    console.log('   subject:', subject);
    console.log('   text:', (text || html || '').replace(/<[^>]+>/g, '').slice(0, 400));
    console.log('');
    return { dev: true };
  }
  return transport.sendMail({ from: FROM, to, subject, html, text });
}

const esc = (s) =>
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
  const url = `${env.appBaseUrl}/approve/${step.action_token}`;
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
          คลิกปุ่มด้านบนเพื่อดูเอกสารฉบับเต็ม ไฟล์แนบ และดำเนินการอนุมัติ / ส่งกลับแก้ไข / ไม่อนุมัติ<br>
          ลิงก์นี้ใช้สำหรับเอกสารฉบับนี้เท่านั้น และไม่จำเป็นต้องเข้าสู่ระบบ
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
