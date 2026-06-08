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

/**
 * Compose + send the approval request email for one approval step.
 * Includes three tokenised links (approve / reject / return) that work without
 * logging in — they hit the public /approve page on the frontend.
 */
export async function sendApprovalRequest({ step, doc }) {
  const base = `${env.appBaseUrl}/approve/${step.action_token}`;
  const link = (action) => `${base}?action=${action}`;

  const html = `
    <div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#1e293b">
      <p>เรียน ${step.approver_name || 'ผู้อนุมัติ'}</p>
      <p>มีเอกสารรออนุมัติจากท่าน</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">เลขที่</td><td><b>${doc.doc_number}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">เรื่อง</td><td>${doc.subject}</td></tr>
      </table>
      <p style="margin:20px 0">
        <a href="${link('approved')}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:8px">✓ อนุมัติ</a>
        <a href="${link('returned')}" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:8px">↩ ส่งกลับแก้ไข</a>
        <a href="${link('rejected')}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">✕ ไม่อนุมัติ</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">ลิงก์นี้ใช้สำหรับการอนุมัติเอกสารฉบับนี้เท่านั้น</p>
    </div>`;

  return sendEmail({
    to: step.approver_email,
    subject: `[รออนุมัติ] ${doc.doc_number} — ${doc.subject}`,
    html,
    text: `เอกสาร ${doc.doc_number} (${doc.subject}) รออนุมัติ\nอนุมัติ: ${link('approved')}\nส่งกลับ: ${link('returned')}\nไม่อนุมัติ: ${link('rejected')}`,
  });
}
