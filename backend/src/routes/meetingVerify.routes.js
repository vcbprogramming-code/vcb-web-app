import { Router } from 'express';
import { queryOne } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// =============================================================================
// ตรวจสอบความแท้ของรายงานการประชุมที่พิมพ์ออกมา — สาธารณะ (ไม่ต้องลงชื่อเข้าใช้)
//
// ── ทำไมเป็น /mtg/:token ไม่ใช่ ?meeting=<id> แบบของเขา ────────────────────────
// ของลูกค้า QR ชี้ไปที่ลิงก์ของแอปตัวเอง (base + '?meeting=' + id) ซึ่งอยู่หลัง
// การลงชื่อเข้าใช้ Google ทั้งหน้า ใช้ได้เพราะแอปของเขามีผู้อ่านเป็นคนในองค์กร
// อย่างเดียว แต่กับของเรามีปัญหาสองข้อที่เป็นเรื่องจริง ไม่ใช่เรื่องรูปแบบ:
//
//   1. กระดาษเดินทางออกนอกองค์กร  รายงานการประชุมถูกพิมพ์แจกผู้รับเหมา ที่ปรึกษา
//      ผู้สอบบัญชี คนกลุ่มนี้ไม่มีบัญชีในระบบ ถ้า QR พาไปหน้าล็อกอิน "การตรวจ
//      สอบความแท้" ก็ไม่เกิดขึ้นเลย — สแกนแล้วเจอประตูปิด ไม่ใช่คำตอบ
//   2. id ของฉบับไม่ใช่ความลับ  มันอยู่ในลิงก์ ?meeting=<id> ที่คนในส่งกันและ
//      อยู่ในแถบที่อยู่ของทุกคนที่เปิดอ่าน ถ้าเส้นทางสาธารณะรับ id ตรง ๆ ใครที่
//      เคยเห็นลิงก์ภายในสักครั้งก็เปิดหน้าสาธารณะได้ตลอดไป และ id ยังถูกส่งต่อ
//      โดยไม่ได้ตั้งใจง่าย (คัดลอกลิงก์แปะแชต) จึงต้องเป็นกุญแจแยกที่เพิกถอน
//      หรือหมุนได้ในอนาคตโดยไม่กระทบลิงก์ภายใน
//
// และเลือกทำเส้นทางของโมดูลประชุมเองแทนการใช้ /verify/:token ของ E-Memo ซ้ำ
// เพราะกุญแจอยู่ต่างตาราง (mtg_meetings ไม่ใช่ documents) และหน้านั้นตอบด้วย
// สายอนุมัติของหนังสือบันทึกข้อความ ซึ่งรายงานการประชุมไม่มี — ที่สำคัญกว่านั้น
// คือห้ามแตะโค้ด E-Memo
//
// ── สิ่งที่เปิดเผยได้ ────────────────────────────────────────────────────────
// เฉพาะสิ่งที่พิสูจน์ว่า "เอกสารใบนี้ออกจากระบบเราจริงและยังเป็นฉบับปัจจุบัน"
// ไม่เคยส่งเนื้อหาบันทึก ไม่ส่งรายชื่อผู้เข้าประชุม ไม่ส่งความเห็น ไม่ส่งไฟล์แนบ
// ใครก็ตามที่ถือกระดาษอยู่ในมือเปิดหน้านี้ได้ — หน้าสาธารณะจึงต้องไม่ใช่ทางลัด
// ไปอ่านสิ่งที่สิทธิ์การเข้าถึงของโมดูลกันไว้
//
// ฉบับที่ยังไม่เผยแพร่ (ฉบับร่าง) ตอบ 404 เหมือนไม่มีอยู่ ไม่ใช่ 403 — การบอกว่า
// "มีอยู่แต่ยังไม่เผยแพร่" ก็คือการยืนยันการมีอยู่ของร่างให้คนนอกรู้
// =============================================================================
const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/mtg/:token — หลักฐานความแท้ของรายงานหนึ่งฉบับ (สาธารณะ) */
router.get('/:token', asyncHandler(async (req, res) => {
  // โทเค็นที่ไม่ใช่ uuid ต้องอ่านว่า "ไม่มีเอกสารนี้" ไม่ใช่ทำให้ Postgres แปลง
  // ชนิดไม่ผ่านแล้วกลายเป็น 500 — ความผิดเดียวกับที่เคยเสีย 500 ใน E-Memo
  if (!UUID.test(String(req.params.token))) throw new ApiError(404, 'ไม่พบเอกสาร');

  const m = await queryOne(
    `select m.id, m.title, m.meeting_date, m.date_label, m.time_label, m.kind,
            m.visible, m.created_at, m.updated_at,
            g.name as group_name, g.code as group_code,
            cp.full_name as created_by_name, up.full_name as updated_by_name,
            (select count(*)::int from mtg_versions v where v.meeting_id = m.id) as revisions
       from mtg_meetings m
       join mtg_groups g on g.id = m.group_id
       left join profiles cp on cp.id = m.created_by
       left join profiles up on up.id = m.updated_by
      where m.verify_token = $1`,
    [req.params.token]
  );
  if (!m || !m.visible) throw new ApiError(404, 'ไม่พบเอกสาร — QR หรือลิงก์อาจไม่ถูกต้อง');

  // meeting_date เป็นชนิด date ไดรเวอร์ pg คืนมาเป็น Date ของเครื่อง พอแปลงเป็น
  // JSON จะกลายเป็น UTC แล้ววันที่ถอยไปหนึ่งวันที่กรุงเทพ — ตัดเป็น yyyy-mm-dd
  // ตามเวลาเครื่องเหมือนที่ isoDate ในเส้นทางหลักทำ
  const d = m.meeting_date;
  const iso = !d ? null
    : (d instanceof Date
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : String(d).slice(0, 10));

  res.json({
    data: {
      title: m.title,
      group_name: m.group_name,
      group_code: m.group_code,
      meeting_date: iso,
      date_label: m.date_label || '',
      time_label: m.time_label || '',
      kind: m.kind,
      created_at: m.created_at,
      created_by_name: m.created_by_name || '',
      updated_at: m.updated_at,
      updated_by_name: m.updated_by_name || '',
      // จำนวนครั้งที่เนื้อหาถูกแก้ — ตอบคำถามว่ากระดาษในมือเป็นฉบับล่าสุดไหม
      revisions: m.revisions,
    },
  });
}));

export default router;
