import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// =============================================================================
// ปฐมนิเทศพนักงานใหม่ 90 วัน
//
// เนื้อหาเป็นของตายตัว (5 แผนก × 3 เฟส × 3 บล็อก) สิ่งที่เปลี่ยนคือความคืบหน้า
// ของแต่ละคน กฎที่ทั้งโมดูลตั้งอยู่บนนั้นมีสองข้อ:
//
//   1. เฟสที่ยังไม่ปลดล็อก "อ่านได้" เสมอ — ล็อกเฉพาะการติ๊ก พนักงานอ่านล่วงหน้า
//      ได้ตามปกติ การซ่อนเนื้อหาจะทำให้คนที่อยากเตรียมตัวทำอะไรไม่ได้เลย
//   2. ความคืบหน้าผูกกับ id ถาวรของรายการ ไม่ใช่ตำแหน่งในอาเรย์ — สลับลำดับหรือ
//      แทรกรายการใหม่จึงไม่ย้ายเครื่องหมายถูกของใคร
//
// ต่างจากระบบของลูกค้าหนึ่งข้อ: ของเขาเข้าใช้ได้โดยไม่ต้องล็อกอิน เพราะพนักงาน
// ใหม่ยังไม่มีบัญชี ของเราอยู่หลังบัญชีเดียวกันทั้งระบบ พนักงานใหม่จึงต้องมี
// บัญชีก่อน — ตัวตนมาจาก JWT ไม่ใช่ชื่อที่พิมพ์เอง จึงไม่มีทางกรอกชื่อคนอื่น
// =============================================================================
const router = Router();
router.use(requireAuth);

const isAdmin = (p) => p.role === 'admin';

/** เนื้อหาทั้งโปรแกรม — แผนก เฟส บล็อก รายการ และเอกสารที่ต้องส่ง */
async function loadContent() {
  const [depts, phases, blocks, items, docs] = await Promise.all([
    query('select * from ob_departments where is_active order by sort_order, slug'),
    query('select * from ob_phases order by dept_slug, sort_order'),
    query('select * from ob_blocks order by phase_id, sort_order'),
    query('select * from ob_items where is_active order by block_id, sort_order'),
    query('select * from ob_documents where is_active order by sort_order'),
  ]);
  const itemsByBlock = new Map();
  for (const it of items.rows) (itemsByBlock.get(it.block_id) || itemsByBlock.set(it.block_id, []).get(it.block_id)).push(it);
  const blocksByPhase = new Map();
  for (const b of blocks.rows) {
    const withItems = { ...b, items: itemsByBlock.get(b.id) || [] };
    (blocksByPhase.get(b.phase_id) || blocksByPhase.set(b.phase_id, []).get(b.phase_id)).push(withItems);
  }
  const phasesByDept = new Map();
  for (const p of phases.rows) {
    const withBlocks = { ...p, blocks: blocksByPhase.get(p.id) || [] };
    (phasesByDept.get(p.dept_slug) || phasesByDept.set(p.dept_slug, []).get(p.dept_slug)).push(withBlocks);
  }
  return {
    departments: depts.rows.map((d) => ({ ...d, phases: phasesByDept.get(d.slug) || [] })),
    documents: docs.rows,
  };
}

/** รายการที่พนักงานระดับนี้ "มองเห็น" — รายการ senior ไม่แสดงให้ junior เลย */
const visible = (items, track) => items.filter((i) => i.level === 'junior' || track === 'senior');

/**
 * สถานะของคนหนึ่งคน: ติ๊กอะไรไปแล้ว ส่งเอกสารครบไหม และเฟสไหนปลดล็อกแล้ว
 *
 * เงื่อนไขปลดล็อก (ข้อกำหนดฟังก์ชัน §7.1):
 *   ปลดล็อก = ส่งเอกสารครบ และ ทุกเฟสก่อนหน้าในแผนกเดียวกันติ๊กครบ
 * "ครบ" นับเฉพาะรายการที่ระดับของคนนั้นมองเห็น — junior ไม่ต้องทำรายการ senior
 */
async function statusFor(profileId, content) {
  const [enr, prog, subs] = await Promise.all([
    queryOne('select * from ob_enrollments where profile_id = $1', [profileId]),
    query('select item_id from ob_progress where profile_id = $1', [profileId]),
    query('select doc_id from ob_doc_submissions where profile_id = $1', [profileId]),
  ]);
  const done = new Set(prog.rows.map((r) => r.item_id));
  const submitted = new Set(subs.rows.map((r) => r.doc_id));
  const track = enr?.track || 'junior';
  const docsComplete = content.documents.every((d) => submitted.has(d.id));

  const dept = content.departments.find((d) => d.slug === enr?.dept_slug) || null;
  const phases = (dept?.phases || []).map((p) => {
    const items = p.blocks.flatMap((b) => visible(b.items, track));
    const doneCount = items.filter((i) => done.has(i.id)).length;
    return { id: p.id, total: items.length, done: doneCount, complete: items.length > 0 && doneCount === items.length };
  });

  let previousComplete = true;
  const unlocked = {};
  const lockReason = {};
  for (const p of phases) {
    const open = docsComplete && previousComplete;
    unlocked[p.id] = open;
    // บอกเหตุผลให้ตรง — สองสาเหตุนี้ต้องทำคนละอย่างเพื่อปลดล็อก
    if (!open) lockReason[p.id] = !docsComplete ? 'documents' : 'previous-phase';
    previousComplete = previousComplete && p.complete;
  }
  const allComplete = phases.length > 0 && phases.every((p) => p.complete);

  return {
    enrolled: Boolean(enr),
    department: enr?.dept_slug || null,
    track,
    startedAt: enr?.started_at || null,
    done: [...done],
    submittedDocuments: [...submitted],
    docsComplete,
    phases, unlocked, lockReason, allComplete,
  };
}

// ── อ่าน ────────────────────────────────────────────────────────────────────

/** GET /api/onboarding-program/bootstrap — เนื้อหาทั้งหมด + สถานะของผู้เรียก */
router.get('/bootstrap', asyncHandler(async (req, res) => {
  const content = await loadContent();
  const status = await statusFor(req.profile.id, content);
  res.json({ data: { ...content, status, isAdmin: isAdmin(req.profile) } });
}));

// ── ลงทะเบียนและระดับพนักงาน ────────────────────────────────────────────────

const enrollSchema = z.object({
  department: z.string().min(1).optional(),
  track: z.enum(['junior', 'senior']).optional(),
});

/**
 * PUT /api/onboarding-program/me — เลือกแผนกหรือสลับระดับพนักงาน
 *
 * เปลี่ยนแผนกแล้วความคืบหน้าของแผนกเดิมยังอยู่ ไม่ถูกลบ — ถ้าเปลี่ยนกลับมาก็เจอ
 * ของเดิมครบ การลบทิ้งเพราะกดผิดหนึ่งครั้งคือการทำลายงานหลายสัปดาห์
 */
router.put('/me', asyncHandler(async (req, res) => {
  const p = enrollSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  if (p.data.department) {
    const d = await queryOne('select slug from ob_departments where slug = $1 and is_active', [p.data.department]);
    if (!d) throw new ApiError(400, 'ไม่พบแผนกนี้');
  }
  await query(
    `insert into ob_enrollments (profile_id, dept_slug, track) values ($1,$2,coalesce($3,'junior'))
     on conflict (profile_id) do update set
       dept_slug = coalesce($2, ob_enrollments.dept_slug),
       track = coalesce($3, ob_enrollments.track),
       updated_at = now()`,
    [req.profile.id, p.data.department ?? null, p.data.track ?? null]);
  const content = await loadContent();
  res.json({ data: await statusFor(req.profile.id, content) });
}));

// ── ติ๊กรายการ ──────────────────────────────────────────────────────────────

/**
 * PUT /api/onboarding-program/progress/:itemId — ติ๊กหรือเอาเครื่องหมายออก
 *
 * ปฏิเสธถ้าเฟสของรายการนั้นยังไม่ปลดล็อก — หน้าจอปิดช่องติ๊กไว้อยู่แล้ว แต่กฎ
 * ต้องอยู่ที่เซิร์ฟเวอร์ ไม่ใช่ที่ปุ่ม
 */
router.put('/progress/:itemId', asyncHandler(async (req, res) => {
  const done = req.body?.done !== false;
  const item = await queryOne(
    `select i.id, b.phase_id from ob_items i join ob_blocks b on b.id = i.block_id
      where i.id = $1 and i.is_active`, [req.params.itemId]);
  if (!item) throw new ApiError(404, 'ไม่พบรายการนี้');

  const content = await loadContent();
  const status = await statusFor(req.profile.id, content);
  if (!status.enrolled || !status.department) throw new ApiError(409, 'ยังไม่ได้เลือกแผนก');
  if (!status.unlocked[item.phase_id]) {
    throw new ApiError(409, status.lockReason[item.phase_id] === 'documents'
      ? 'ต้องส่งเอกสารให้ครบก่อนจึงจะเริ่มเฟสนี้ได้'
      : 'ต้องทำเฟสก่อนหน้าให้ครบก่อน');
  }

  if (done) {
    await query(
      'insert into ob_progress (profile_id, item_id) values ($1,$2) on conflict do nothing',
      [req.profile.id, item.id]);
  } else {
    await query('delete from ob_progress where profile_id = $1 and item_id = $2', [req.profile.id, item.id]);
  }
  res.json({ data: await statusFor(req.profile.id, content) });
}));

/** POST /api/onboarding-program/documents/:docId — บันทึกว่าส่งเอกสารแล้ว */
router.post('/documents/:docId', asyncHandler(async (req, res) => {
  const doc = await queryOne('select id from ob_documents where id = $1 and is_active', [req.params.docId]);
  if (!doc) throw new ApiError(404, 'ไม่พบเอกสารนี้');
  const note = String(req.body?.note || '').trim().slice(0, 500) || null;
  await query(
    `insert into ob_doc_submissions (profile_id, doc_id, note) values ($1,$2,$3)
     on conflict (profile_id, doc_id) do update set note = excluded.note, submitted_at = now()`,
    [req.profile.id, doc.id, note]);
  res.json({ data: await statusFor(req.profile.id, await loadContent()) });
}));

/** DELETE /api/onboarding-program/documents/:docId — ยกเลิกการส่ง */
router.delete('/documents/:docId', asyncHandler(async (req, res) => {
  await query('delete from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [req.profile.id, req.params.docId]);
  res.json({ data: await statusFor(req.profile.id, await loadContent()) });
}));

// ── ผู้ดูแล ─────────────────────────────────────────────────────────────────

/**
 * GET /api/onboarding-program/cohort — ภาพรวมพนักงานทุกคนที่อยู่ในโปรแกรม
 *
 * นับเฉพาะรายการที่ระดับของแต่ละคนมองเห็น มิฉะนั้นพนักงาน junior จะดูเหมือน
 * ทำไม่เสร็จตลอดไป ทั้งที่รายการ senior ไม่ใช่ของเขาตั้งแต่ต้น
 */
router.get('/cohort', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const content = await loadContent();
  const rows = (await query(
    `select e.*, p.full_name, p.email from ob_enrollments e
       join profiles p on p.id = e.profile_id order by e.started_at desc`)).rows;
  const out = [];
  for (const r of rows) {
    const st = await statusFor(r.profile_id, content);
    out.push({
      profileId: r.profile_id, name: r.full_name, email: r.email,
      department: r.dept_slug, track: r.track, startedAt: r.started_at,
      docsComplete: st.docsComplete, allComplete: st.allComplete,
      phases: st.phases,
      total: st.phases.reduce((a, p) => a + p.total, 0),
      done: st.phases.reduce((a, p) => a + p.done, 0),
    });
  }
  res.json({ data: out });
}));

const itemSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  level: z.enum(['junior', 'senior']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/onboarding-program/items/:id — ผู้ดูแลแก้ข้อความหรือระดับของรายการ
 *
 * ปิดรายการได้ แต่ลบไม่ได้ — id เป็นสิ่งที่เครื่องหมายถูกของพนักงานผูกอยู่
 */
router.patch('/items/:id', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const p = itemSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const row = await queryOne(
    `update ob_items set text = coalesce($2, text), level = coalesce($3, level),
       is_active = coalesce($4, is_active) where id = $1 returning *`,
    [req.params.id, p.data.text ?? null, p.data.level ?? null, p.data.isActive ?? null]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการนี้');
  res.json({ data: row });
}));

export default router;
