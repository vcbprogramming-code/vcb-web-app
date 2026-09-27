import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { putObject, deleteObject, openDownloadStream } from '../config/storage.js';

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

// ── เอกสารที่พนักงานอัปโหลดกลับ ────────────────────────────────────────────
// ระบบของลูกค้าจำกัด 10MB และหกสกุลไฟล์ ตามด้วยเหตุผลที่เขาเขียนไว้ในซอร์ส:
// รูปถ่ายเอกสารจากมือถือต้องผ่าน แต่ไฟล์ที่ใหญ่กว่านั้นคือความผิดพลาด ไม่ใช่
// ความจำเป็น เราใช้เลขเดียวกัน เพราะไฟล์เดียวกันชุดเดียวกันจะถูกส่งเข้ามา
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOC_BYTES } });

// หัวบล็อกไม่มี id ถาวรของตัวเอง — สคริปต์ seed ลบแล้วสร้างใหม่ทุกครั้งที่รัน
// ดังนั้น heading_th ที่ migration เติมไว้จะหายไปกับการ seed รอบถัดไป คำแปล
// สามข้อความนี้จึงมีสำเนาไว้ที่นี่ด้วย เพื่อให้หน้าจอไทยไม่กลับไปเป็นอังกฤษ
// เพราะการ seed ครั้งเดียว ค่าจาก migration ยังเป็นตัวหลักถ้ามี
const BLOCK_TH = {
  'Required Reading': 'เอกสารที่ต้องศึกษา',
  'Knowledge Requirements': 'ความรู้ที่จำเป็น',
  'Required Outputs': 'ผลงานที่ต้องส่งมอบ',
};

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
    const withItems = {
      ...b,
      heading_th: b.heading_th || BLOCK_TH[b.heading] || null,
      items: itemsByBlock.get(b.id) || [],
    };
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
    query('select doc_id, file_name, storage_key, note, submitted_at from ob_doc_submissions where profile_id = $1', [profileId]),
  ]);
  const done = new Set(prog.rows.map((r) => r.item_id));
  const submitted = new Set(subs.rows.map((r) => r.doc_id));
  const track = enr?.track || 'junior';
  const docsComplete = content.documents.every((d) => submitted.has(d.id));
  // รายชื่อเอกสารที่ยังขาด ไม่ใช่แค่จำนวน — ประตูกั้นก่อนเลือกแผนกต้องบอกได้ว่า
  // ขาดฉบับไหน ไม่ใช่ "ยังไม่ครบ" เฉย ๆ ซึ่งไม่บอกว่าต้องไปทำอะไรต่อ
  const missingDocuments = content.documents.filter((d) => !submitted.has(d.id)).map((d) => d.id);

  const dept = content.departments.find((d) => d.slug === enr?.dept_slug) || null;
  const phases = (dept?.phases || []).map((p) => {
    const items = p.blocks.flatMap((b) => visible(b.items, track));
    const doneCount = items.filter((i) => done.has(i.id)).length;
    // เฟสที่ระดับนี้ไม่มีรายการต้องทำเลย ถือว่าผ่าน — ไม่งั้นคนคนนั้นจะติดค้าง
    // อยู่ตรงนั้นตลอดไป เพราะเฟสถัดไปรอเฟสก่อนหน้าให้ครบก่อน
    return { id: p.id, total: items.length, done: doneCount, complete: doneCount === items.length };
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
  // เฟสว่างไม่ขวางทางเดินต่อ แต่โปรแกรมที่ไม่มีรายการให้ทำเลยก็ไม่ควรนับว่า
  // "จบหลักสูตรแล้ว" — ต้องมีอย่างน้อยหนึ่งรายการที่คนคนนี้ต้องทำจริง
  const allComplete = phases.some((p) => p.total > 0) && phases.every((p) => p.complete);

  return {
    enrolled: Boolean(enr),
    department: enr?.dept_slug || null,
    track,
    startedAt: enr?.started_at || null,
    done: [...done],
    submittedDocuments: [...submitted],
    docsComplete,
    missingDocuments,
    // ใบเสร็จของไฟล์ที่อัปโหลดไว้ ผูกกับ doc_id — หน้าจอเอามาแสดงว่า "อัปโหลด
    // แล้ว: <ชื่อไฟล์>" ของเขาเก็บไว้ใน localStorage ซึ่งหายไปพร้อมเบราว์เซอร์
    // ของเราเก็บที่ฐานข้อมูล ย้ายเครื่องแล้วยังเห็นว่าส่งอะไรไป
    uploads: Object.fromEntries(subs.rows
      .filter((r) => r.storage_key)
      .map((r) => [r.doc_id, { fileName: r.file_name, submittedAt: r.submitted_at }])),
    phases, unlocked, lockReason, allComplete,
  };
}

// ── อ่าน ────────────────────────────────────────────────────────────────────

/** GET /api/onboarding-program/bootstrap — เนื้อหาทั้งหมด + สถานะของผู้เรียก */
router.get('/bootstrap', asyncHandler(async (req, res) => {
  const content = await loadContent();
  const status = await statusFor(req.profile.id, content);
  res.json({
    data: {
      ...content,
      status,
      isAdmin: isAdmin(req.profile),
      // แถบความคืบหน้าของเขาเขียนชื่อคนไว้ในหัวข้อ ("ความคืบหน้าการปฐมนิเทศของ
      // คุณ — ชื่อ (แผนก)") ของเขาให้พนักงานพิมพ์ชื่อเอง ของเราอ่านจากบัญชี
      me: { name: req.profile.full_name || req.profile.email, email: req.profile.email },
    },
  });
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

/** POST /api/onboarding-program/documents/:docId — บันทึกว่าส่งเอกสารแล้ว (ติ๊กมือ) */
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

/**
 * POST /api/onboarding-program/documents/:docId/file — อัปโหลดไฟล์ที่กรอกแล้ว
 *
 * ของลูกค้าตรวจ "สกุลไฟล์" ไม่ใช่ MIME type และเขาเขียนเหตุผลไว้ด้วย: accept
 * ของ input เป็นแค่ตัวกรองในกล่องเลือกไฟล์ ไม่ใช่การตรวจ และ MIME ที่เบราว์เซอร์
 * ส่งมาก็ปลอมได้เท่ากัน ยิ่ง .doc/.docx เบราว์เซอร์แต่ละตัวรายงานไม่เหมือนกัน
 * เราตรวจแบบเดียวกัน และตรวจที่นี่ ไม่ใช่ที่ปุ่ม
 *
 * อัปใหม่ "แทน" ไฟล์เดิม: key ตั้งจาก (profile, docId) จึงเขียนทับตัวเอง แต่ถ้า
 * สกุลไฟล์เปลี่ยน key จะเปลี่ยนตาม — ต้องลบตัวเก่าทิ้ง ไม่ใช่ปล่อยค้างไว้
 * สองไฟล์โดยไม่มีอะไรบอกว่าอันไหนของจริง
 */
router.post('/documents/:docId/file', docUpload.single('file'), asyncHandler(async (req, res) => {
  const doc = await queryOne('select id from ob_documents where id = $1 and is_active', [req.params.docId]);
  if (!doc) throw new ApiError(404, 'ไม่พบเอกสารนี้');
  if (!req.file || !req.file.size) throw new ApiError(400, 'ไฟล์นี้ว่างเปล่า กรุณาเลือกไฟล์อื่น');

  // multer/busboy ถอดชื่อไฟล์จาก Content-Disposition เป็น latin1 เสมอ ชื่อไฟล์
  // ภาษาไทยจึงกลายเป็นตัวประหลาด ("à¸—à¸”à¸ªà¸­à¸š.pdf") ทั้งในใบเสร็จบนหน้าจอ
  // และในชื่อไฟล์ที่ฝ่ายบุคคลเปิดดู — ต้องแปลงกลับเป็น UTF-8 ที่นี่
  const original = Buffer.from(String(req.file.originalname || ''), 'latin1').toString('utf8').trim();
  const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_DOC_EXT.includes(ext)) {
    throw new ApiError(400, 'ชนิดไฟล์นี้ไม่รองรับ — อัปโหลดได้เฉพาะ PDF รูปภาพ หรือไฟล์ Word');
  }

  const prev = await queryOne('select storage_key from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [req.profile.id, doc.id]);
  const storageKey = `onboarding-program/${req.profile.id}/${doc.id}.${ext}`;
  await putObject(storageKey, req.file.buffer, req.file.mimetype || 'application/octet-stream');
  if (prev?.storage_key && prev.storage_key !== storageKey) {
    await deleteObject(prev.storage_key).catch(() => {});
  }

  // ติ๊กว่าเสร็จ "หลัง" ไฟล์เขียนลงที่เก็บสำเร็จแล้วเท่านั้น ถ้าบรรทัดนี้ล้ม
  // ไฟล์อยู่แต่ข้อนั้นยังไม่เสร็จ พนักงานเห็นว่าล้มแล้วอัปซ้ำ ซึ่งแทนที่ของเดิม
  await query(
    `insert into ob_doc_submissions (profile_id, doc_id, file_name, storage_key, content_type)
     values ($1,$2,$3,$4,$5)
     on conflict (profile_id, doc_id) do update set file_name = excluded.file_name,
       storage_key = excluded.storage_key, content_type = excluded.content_type, submitted_at = now()`,
    [req.profile.id, doc.id, original.slice(0, 200), storageKey, req.file.mimetype || null]);

  res.json({
    data: {
      fileName: original,
      status: await statusFor(req.profile.id, await loadContent()),
    },
  });
}));

/**
 * GET /api/onboarding-program/documents/:docId/file — เปิดดูไฟล์ที่ตัวเองอัปไว้
 *
 * ผู้ดูแลเปิดของคนอื่นได้ด้วย ?profile=<id> เพราะฝ่ายบุคคลต้องตรวจเอกสารที่รับมา
 * นอกนั้นเห็นได้แต่ของตัวเอง — id ของคนอื่นใน query string ไม่ใช่การอนุญาต
 */
router.get('/documents/:docId/file', asyncHandler(async (req, res) => {
  const wanted = req.query.profile && isAdmin(req.profile) ? String(req.query.profile) : req.profile.id;
  const row = await queryOne(
    'select file_name, storage_key, content_type from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [wanted, req.params.docId]);
  if (!row?.storage_key) throw new ApiError(404, 'ยังไม่มีไฟล์ที่อัปโหลดไว้สำหรับเอกสารนี้');
  const obj = await openDownloadStream(row.storage_key);
  if (!obj) throw new ApiError(404, 'ไม่พบไฟล์ในที่เก็บ');
  res.setHeader('Content-Type', obj.contentType || row.content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(row.file_name || 'file')}`);
  obj.stream.on('error', () => res.destroy());
  obj.stream.pipe(res);
}));

/** DELETE /api/onboarding-program/documents/:docId — ยกเลิกการส่ง (ลบไฟล์ด้วย) */
router.delete('/documents/:docId', asyncHandler(async (req, res) => {
  const prev = await queryOne('select storage_key from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [req.profile.id, req.params.docId]);
  await query('delete from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [req.profile.id, req.params.docId]);
  if (prev?.storage_key) await deleteObject(prev.storage_key).catch(() => {});
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
  textTh: z.string().trim().max(500).nullable().optional(),
  level: z.enum(['junior', 'senior']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/onboarding-program/items/:id — ผู้ดูแลแก้ข้อความหรือระดับของรายการ
 *
 * ปิดรายการได้ แต่ลบไม่ได้ — id เป็นสิ่งที่เครื่องหมายถูกของพนักงานผูกอยู่
 * textTh ส่งค่าว่างมาได้ หมายถึง "ไม่มีคำแปลไทย" (หน้าจอถอยไปใช้อังกฤษ) ต่างจาก
 * การไม่ส่ง field มาเลย ซึ่งหมายถึง "ไม่แก้" — จึงต้องแยกสองกรณีนี้ออกจากกัน
 */
router.patch('/items/:id', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const p = itemSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const thGiven = Object.prototype.hasOwnProperty.call(req.body || {}, 'textTh');
  const row = await queryOne(
    `update ob_items set text = coalesce($2, text), level = coalesce($3, level),
       is_active = coalesce($4, is_active),
       text_th = case when $5 then $6 else text_th end
     where id = $1 returning *`,
    [req.params.id, p.data.text ?? null, p.data.level ?? null, p.data.isActive ?? null,
      thGiven, (p.data.textTh || null)]);
  if (!row) throw new ApiError(404, 'ไม่พบรายการนี้');
  res.json({ data: row });
}));

/**
 * GET /api/onboarding-program/items?blockId=N — รายการทั้งบล็อกสำหรับผู้ดูแล
 *
 * bootstrap ส่งเฉพาะข้อที่เปิดใช้งาน (is_active) ซึ่งถูกต้องสำหรับพนักงาน แต่
 * หน้าผู้ดูแลต้องเห็นข้อที่ปิดไว้ด้วย ไม่งั้นปิดข้อหนึ่งแล้วมันหายไปจากจอ และ
 * เปิดกลับไม่ได้อีกเลย — ปิดได้แต่เปิดไม่ได้คือทางเดียว ไม่ใช่สวิตช์
 */
router.get('/items', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const blockId = Number(req.query.blockId);
  if (!Number.isInteger(blockId) || blockId <= 0) throw new ApiError(400, 'ต้องระบุ blockId');
  const { rows } = await query('select * from ob_items where block_id = $1 order by sort_order, id', [blockId]);
  res.json({ data: rows });
}));

const newItemSchema = z.object({
  blockId: z.coerce.number().int().positive(),
  text: z.string().trim().min(1).max(500),
  textTh: z.string().trim().max(500).optional().nullable(),
  level: z.enum(['junior', 'senior']).default('junior'),
});

/**
 * POST /api/onboarding-program/items — ผู้ดูแลเพิ่มข้อใหม่เข้าบล็อก
 *
 * id ของรายการเป็นข้อความถาวรที่ความคืบหน้าของพนักงานผูกอยู่ ข้อใหม่จึงได้ id
 * ที่ "ไม่เคยมีใครใช้" เสมอ: เติมท้ายด้วยเวลาปัจจุบัน ไม่ใช่นับจำนวนแถวในบล็อก
 * แล้ว +1 — เพราะข้อที่ถูกปิดไปแล้วยังกินเลขนั้นอยู่ และการเอาเลขเดิมกลับมาใช้
 * จะทำให้พนักงานที่ติ๊กข้อเก่าไว้ กลายเป็นติ๊กข้อใหม่ที่ยังไม่ได้ทำ
 */
router.post('/items', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const p = newItemSchema.safeParse(req.body);
  if (!p.success) throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง', p.error.flatten());
  const block = await queryOne('select id, phase_id from ob_blocks where id = $1', [p.data.blockId]);
  if (!block) throw new ApiError(404, 'ไม่พบบล็อกนี้');
  const last = await queryOne('select coalesce(max(sort_order), 0) n from ob_items where block_id = $1', [block.id]);
  const id = `custom-${block.id}-${Date.now().toString(36)}`;
  const row = await queryOne(
    `insert into ob_items (id, block_id, text, text_th, level, sort_order, is_active)
     values ($1,$2,$3,$4,$5,$6,true) returning *`,
    [id, block.id, p.data.text, p.data.textTh || null, p.data.level, Number(last.n) + 1]);
  res.status(201).json({ data: row });
}));

/**
 * PUT /api/onboarding-program/items/:id/move — เลื่อนข้อขึ้นหรือลงในบล็อกเดียวกัน
 *
 * สลับ sort_order กับเพื่อนบ้านตัวติดกัน ไม่ใช่เขียนลำดับใหม่ทั้งบล็อก —
 * ความคืบหน้าผูกกับ id ไม่ใช่ลำดับ การสลับลำดับจึงไม่ย้ายเครื่องหมายถูกของใคร
 */
router.put('/items/:id/move', asyncHandler(async (req, res) => {
  if (!isAdmin(req.profile)) throw new ApiError(403, 'เฉพาะผู้ดูแลระบบ');
  const dir = req.body?.direction === 'down' ? 'down' : 'up';
  const me = await queryOne('select id, block_id, sort_order from ob_items where id = $1', [req.params.id]);
  if (!me) throw new ApiError(404, 'ไม่พบรายการนี้');
  const neighbour = await queryOne(
    dir === 'up'
      ? `select id, sort_order from ob_items where block_id = $1 and sort_order < $2
           order by sort_order desc limit 1`
      : `select id, sort_order from ob_items where block_id = $1 and sort_order > $2
           order by sort_order asc limit 1`,
    [me.block_id, me.sort_order]);
  if (!neighbour) return res.json({ data: { moved: false } });
  await query('update ob_items set sort_order = $2 where id = $1', [me.id, neighbour.sort_order]);
  await query('update ob_items set sort_order = $2 where id = $1', [neighbour.id, me.sort_order]);
  res.json({ data: { moved: true } });
}));

export default router;
