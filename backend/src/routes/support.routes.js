import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sendEmail } from '../services/email.js';

// Portal "Help / report an issue" — a signed-in user sends a short message that
// is emailed to the admins. Lightweight in-memory throttle (single instance).
const router = Router();
router.use(requireAuth);

const schema = z.object({
  area: z.string().max(60).optional(),
  message: z.string().trim().min(1).max(2000),
});

const lastSent = new Map(); // profileId -> timestamp
const THROTTLE_MS = 60 * 1000;

router.post('/', asyncHandler(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'กรุณากรอกข้อความ (ไม่เกิน 2000 ตัวอักษร)');
  const now = Date.now();
  const prev = lastSent.get(req.profile.id) || 0;
  if (now - prev < THROTTLE_MS) throw new ApiError(429, 'ส่งบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');

  const { rows: admins } = await query("select email from profiles where role = 'admin' and is_active = true");
  const to = admins.map((a) => a.email).filter(Boolean);
  if (!to.length) throw new ApiError(500, 'ยังไม่มีผู้ดูแลระบบสำหรับรับเรื่อง');

  const who = `${req.profile.full_name || ''} <${req.profile.email || ''}>`.trim();
  const area = p.data.area || '(ไม่ระบุ)';
  const safe = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  await sendEmail({
    to,
    subject: `[VCB Connect] แจ้งปัญหา/สอบถาม — ${area}`,
    html: `<p><b>ผู้แจ้ง:</b> ${safe(who)}</p><p><b>ส่วนที่เกี่ยวข้อง:</b> ${safe(area)}</p><hr/><p style="white-space:pre-wrap">${safe(p.data.message)}</p>`,
    text: `ผู้แจ้ง: ${who}\nส่วน: ${area}\n\n${p.data.message}`,
  });
  lastSent.set(req.profile.id, now);
  res.json({ data: { sent: true } });
}));

export default router;
