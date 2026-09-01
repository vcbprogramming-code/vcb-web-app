// Email via Brevo's HTTP API.
//
// HTTP rather than SMTP deliberately: Render blocks outbound SMTP ports on its
// free and starter tiers, so an SMTP transport works locally and then fails
// silently in production.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const apiKey = process.env.BREVO_API_KEY;
const defaultSender = {
  name: process.env.BREVO_SENDER_NAME || 'VCB Connect',
  email: process.env.BREVO_SENDER_EMAIL || '',
};

/**
 * Send one email.
 *
 * Returns { ok, messageId } or { ok:false, error }. It never throws: mail is
 * always a side effect of some other action — approving a request, assigning a
 * task — and a bounced notification must not roll back the thing that
 * succeeded. Callers log the failure and carry on.
 */
export async function sendEmail({ to, subject, html, text, cc, replyTo, sender }) {
  if (!apiKey) {
    console.warn('[email] BREVO_API_KEY not set — skipping send to', to);
    return { ok: false, error: 'NOT_CONFIGURED' };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map((t) => (typeof t === 'string' ? { email: t } : t));

  if (!recipients.length) return { ok: false, error: 'NO_RECIPIENT' };

  const body = {
    sender: sender || defaultSender,
    to: recipients,
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    ...(cc ? { cc: (Array.isArray(cc) ? cc : [cc]).map((e) => ({ email: e })) } : {}),
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
  };

  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[email] Brevo rejected the send:', res.status, detail);
      return { ok: false, error: `BREVO_${res.status}` };
    }

    const json = await res.json().catch(() => ({}));
    return { ok: true, messageId: json.messageId };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { ok: false, error: 'SEND_FAILED' };
  }
}

/**
 * Minimal HTML shell for notification mail.
 *
 * Inline styles only, and a table for layout — email clients strip <style>
 * blocks and support flex and grid inconsistently. The font stack names Thai
 * faces first so Thai renders correctly in Outlook.
 */
export function wrapHtml(title, bodyHtml) {
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#EEF1F6;font-family:'Sarabun','Leelawadee UI',Tahoma,sans-serif;color:#1F2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;">
    <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#1F3864,#2E75B6);border-radius:8px 8px 0 0;">
      <div style="color:#fff;font-size:16px;font-weight:600;">${escapeHtml(title)}</div>
    </td></tr>
    <tr><td style="padding:24px;font-size:14px;line-height:1.7;">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #E1E6EE;font-size:12px;color:#6B7785;">
      อีเมลนี้ส่งอัตโนมัติจากระบบ VCB Connect — กรุณาอย่าตอบกลับ
    </td></tr>
  </table>
</body></html>`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default { sendEmail, wrapHtml, escapeHtml };
