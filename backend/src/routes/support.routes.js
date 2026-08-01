import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sendEmail, esc } from '../services/email.js';

// Portal "Help / report an issue" — a signed-in user sends a short message that
// is emailed to the admins. Throttled per user AND globally (single instance).
const router = Router();
router.use(requireAuth);

const schema = z.object({
  // no CR/LF: `area` is interpolated into the mail subject
  area: z.string().max(60).regex(/^[^\r\n]*$/, 'ข้อมูลไม่ถูกต้อง').optional(),
  message: z.string().trim().min(1).max(2000),
});

const PER_USER_MS = 60 * 1000;
const GLOBAL_MAX_PER_HOUR = 40; // stops one org from flooding admins / burning the mail quota
const lastSent = new Map();     // profileId -> timestamp
let windowStart = 0;
let windowCount = 0;

router.post('/', asyncHandler(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'กรุณากรอกข้อความ (ไม่เกิน 2000 ตัวอักษร)');
  const now = Date.now();

  // opportunistic cleanup so the map can't grow unbounded
  if (lastSent.size > 5000) {
    for (const [k, t] of lastSent) if (now - t > PER_USER_MS) lastSent.delete(k);
  }
  if (now - (lastSent.get(req.profile.id) || 0) < PER_USER_MS) {
    throw new ApiError(429, 'ส่งบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  if (now - windowStart > 60 * 60 * 1000) { windowStart = now; windowCount = 0; }
  if (windowCount >= GLOBAL_MAX_PER_HOUR) {
    throw new ApiError(429, 'ระบบรับเรื่องแจ้งจำนวนมากในขณะนี้ กรุณาลองใหม่ภายหลัง');
  }

  const { rows: admins } = await query("select email from profiles where role = 'admin' and is_active = true");
  const to = admins.map((a) => a.email).filter(Boolean);
  if (!to.length) throw new ApiError(503, 'ยังไม่มีผู้ดูแลระบบสำหรับรับเรื่อง');

  // count the attempt BEFORE sending — otherwise a failing provider leaves the
  // bucket empty and the endpoint can be hammered with no limit at all.
  lastSent.set(req.profile.id, now);
  windowCount += 1;

  const who = `${req.profile.full_name || ''} <${req.profile.email || ''}>`.trim();
  const area = p.data.area || '(ไม่ระบุ)';
  try {
    await sendEmail({
      to,
      subject: `[VCB Connect] แจ้งปัญหา/สอบถาม — ${area}`,
      html: `<p><b>ผู้แจ้ง:</b> ${esc(who)}</p><p><b>ส่วนที่เกี่ยวข้อง:</b> ${esc(area)}</p><hr/><p style="white-space:pre-wrap">${esc(p.data.message)}</p>`,
      text: `ผู้แจ้ง: ${who}\nส่วน: ${area}\n\n${p.data.message}`,
    });
  } catch (e) {
    // never surface the provider's raw response (it can carry account details)
    console.error('support email failed:', e.message);
    throw new ApiError(502, 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
  res.json({ data: { sent: true } });
}));

export default router;
