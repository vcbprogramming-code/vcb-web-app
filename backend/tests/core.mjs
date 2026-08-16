/**
 * core — the E-Memo behaviour that must never regress.
 *
 * Rebuilt after the original scratch copies were lost with a temp folder, which
 * is exactly why these now live in the repo. Covers the paths a real day goes
 * through, plus the specific traps that bit us before: concurrent numbering,
 * malformed URLs, a corrupt image, skipping the approval queue, and export/scope
 * permissions.
 */
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import {
  call, upload, newDoc, cleanup, suite, happy, bad, report, U, warm, query, testProject, MARK, made,
} from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, admin2: B, exec: C, hr: H } = U;
const chain = (...p) => p.map((x, i) => ({ name: x.name, email: x.email, isSigner: i === 0 }));
const proj = await testProject();

// ── file builders ──────────────────────────────────────────────────────────
const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
function png(w = 24, h = 24) {
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x80)])));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const truncatedPng = () => png(64, 64).subarray(0, 60); // the file that once hung the whole API
const minimalPdf = () => Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

// ── 1. เลขที่เอกสาร ────────────────────────────────────────────────────────
suite('1. เลขที่เอกสารอัตโนมัติ');
{
  const peek = await call(`/documents/next-number?projectId=${proj.id}&docCode=0823`, { user: A });
  happy('ดูเลขที่ถัดไปได้ก่อนสร้าง', peek.status === 200 && !!peek.data?.docNumber, `${peek.status}`);

  const d1 = await newDoc(A, 'เลข 1');
  const d2 = await newDoc(A, 'เลข 2');
  happy('เลขรันนิ่งเดินต่อทีละ 1', d2.run_no === d1.run_no + 1, `${d1.run_no} → ${d2.run_no}`);
  happy('รูปแบบเลขที่ถูกต้อง', /^[^/]+\/[^/]+\/[^/]+\/\d{3,}$/.test(d2.doc_number), d2.doc_number);

  // the pool-deadlock regression: 20 at once must all succeed with no gaps
  const settled = await Promise.allSettled(Array.from({ length: 20 }, (_, i) =>
    call('/documents', { method: 'POST', user: A, body: { projectId: proj.id, docCode: '0823', subject: `${MARK} พร้อมกัน ${i + 1}` } })));
  const ok = settled.filter((s) => s.status === 'fulfilled' && s.value.status === 201).map((s) => s.value.data);
  ok.forEach((d) => made.add(d.id));
  happy('สร้างพร้อมกัน 20 ฉบับสำเร็จครบ', ok.length === 20, `${ok.length}/20`);
  const nums = ok.map((d) => d.doc_number);
  happy('ไม่มีเลขที่ซ้ำ', new Set(nums).size === nums.length, '');
  const runs = ok.map((d) => d.run_no).sort((a, b) => a - b);
  happy('เลขเรียงต่อเนื่องไม่ข้าม', runs.every((n, i) => i === 0 || n === runs[i - 1] + 1), '');
  happy('ระบบยังตอบสนองหลังยิงพร้อมกัน', (await call('/documents/stats', { user: A })).status === 200, '');
}

// ── 2. สร้าง / แก้ไข / ค่าที่ผิด ───────────────────────────────────────────
suite('2. การจัดทำและการตรวจค่าที่ผิด');
{
  const d = await newDoc(A, 'เอกสารเต็มรูปแบบ', { recipient: 'เรียน ผู้จัดการฝ่ายจัดซื้อ', body: 'เนื้อความ' });
  const det = await call(`/documents/${d.id}`, { user: A });
  happy('เอกสารใหม่เริ่มที่ฉบับร่าง', det.data.status === 'draft', det.data.status);
  happy('แก้ไขได้และบันทึกในประวัติ',
    (await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { subject: `${MARK} แก้แล้ว` } })).status === 200
    && (await call(`/documents/${d.id}`, { user: A })).data.audit.some((a) => a.action === 'edited'), '');

  const cases = [
    ['ไม่ระบุเรื่อง → 400', { projectId: proj.id, docCode: '0823' }, 400],
    ['วันที่ไม่มีจริง → 400', { projectId: proj.id, docCode: '0823', subject: `${MARK} x`, dateReceived: '2569-13-45' }, 400],
    ['อ้างถึงเอกสารที่ไม่มี → 400', { projectId: proj.id, docCode: '0823', subject: `${MARK} x`, referenceDocId: '00000000-0000-0000-0000-000000000000' }, 400],
    ['โครงการผิดรูปแบบ → 400', { projectId: 'not-a-uuid', docCode: '0823', subject: `${MARK} x` }, 400],
  ];
  for (const [label, body, want] of cases) {
    bad(label, (await call('/documents', { method: 'POST', user: A, body })).status === want, '');
  }
  bad('ไอดีผิดรูปแบบ → 404 ไม่ใช่ 500', (await call('/documents/not-a-uuid', { user: A })).status === 404, '');
  bad('เอกสารที่ไม่มีอยู่ → 404', (await call('/documents/00000000-0000-0000-0000-000000000000', { user: A })).status === 404, '');
  bad('ไม่ล็อกอิน → 401', (await call(`/documents/${d.id}`, { user: null })).status === 401, '');
  bad('สถานะที่ไม่รู้จัก → 400 ไม่ใช่ 500', (await call('/documents?status=ลบทิ้ง', { user: A })).status === 400, '');
}

// ── 3. สายอนุมัติ ──────────────────────────────────────────────────────────
suite('3. สายอนุมัติทั้งเส้นทาง');
{
  const d = await newDoc(B, 'สายอนุมัติ');
  await call(`/documents/${d.id}/generate-pdf`, { method: 'POST', user: B });
  const s = await call(`/documents/${d.id}/submit`, { method: 'POST', user: B, body: { approvers: chain(A, C) } });
  happy('ส่งเข้าสายอนุมัติได้', s.status === 200 || s.status === 201, `${s.status}`);

  const d1 = await call(`/documents/${d.id}`, { user: B });
  happy('ลำดับ 1 คือผู้ลงนาม และยังไม่มีลายเซ็น',
    d1.data.approval_steps[0].is_signer === true && d1.data.approval_steps[0].has_signature === false, '');
  bad('ลำดับ 2 กดข้ามคิวไม่ได้', [403, 409].includes((await call(`/documents/${d.id}/approve`, { method: 'POST', user: C, body: { action: 'approved' } })).status), '');
  bad('คนนอกสายกดอนุมัติไม่ได้', (await call(`/documents/${d.id}/approve`, { method: 'POST', user: H, body: { action: 'approved' } })).status === 403, '');
  bad('คำสั่งที่ไม่รู้จัก → 400', (await call(`/documents/${d.id}/approve`, { method: 'POST', user: A, body: { action: 'ลบ' } })).status === 400, '');

  await call(`/documents/${d.id}/approve`, { method: 'POST', user: A, body: { action: 'approved', comment: 'เห็นชอบ' } });
  const d2 = await call(`/documents/${d.id}`, { user: B });
  happy('อนุมัติแล้วลงลายเซ็นให้ผู้ลงนาม', d2.data.approval_steps[0].has_signature === true, '');
  happy('ส่งต่อลำดับถัดไปอัตโนมัติ', d2.data.approval_steps[1].action === 'pending', '');
  bad('อนุมัติซ้ำขั้นเดิมไม่ได้', [403, 409].includes((await call(`/documents/${d.id}/approve`, { method: 'POST', user: A, body: { action: 'approved' } })).status), '');

  bad('ไม่อนุมัติโดยไม่ระบุเหตุผล → 400',
    (await call(`/documents/${d.id}/approve`, { method: 'POST', user: C, body: { action: 'rejected' } })).status === 400, '');
  await call(`/documents/${d.id}/approve`, { method: 'POST', user: C, body: { action: 'rejected', comment: 'งบเกินกรอบ' } });
  const r1 = await call(`/documents/${d.id}`, { user: B });
  happy('ไม่อนุมัติแล้วสถานะเปลี่ยนและเก็บเหตุผล',
    r1.data.status === 'rejected' && JSON.stringify(r1.data.approval_steps).includes('งบเกินกรอบ'), r1.data.status);
  bad('ยื่นใหม่โดยไม่บอกว่าแก้อะไร → 400',
    (await call(`/documents/${d.id}/submit`, { method: 'POST', user: B, body: { approvers: chain(A, C) } })).status === 400, '');
  const again = await call(`/documents/${d.id}/submit`, { method: 'POST', user: B, body: { approvers: chain(A, C), resubmitNote: 'ปรับลดงบแล้ว' } });
  happy('ยื่นใหม่พร้อมเหตุผลได้ และเริ่มที่ลำดับ 1',
    [200, 201].includes(again.status) && (await call(`/documents/${d.id}`, { user: B })).data.approval_steps[0].action === 'pending', '');

  await call(`/documents/${d.id}/approve`, { method: 'POST', user: A, body: { action: 'approved' } });
  await call(`/documents/${d.id}/approve`, { method: 'POST', user: C, body: { action: 'approved' } });
  const done = await call(`/documents/${d.id}`, { user: B });
  happy('อนุมัติครบ → สถานะอนุมัติแล้ว + มีหนังสือฉบับลงนาม',
    done.data.status === 'approved' && done.data.attachments.some((a) => a.kind === 'generated_pdf' && a.version === 'approved'), done.data.status);
  bad('แก้เอกสารที่อนุมัติแล้วไม่ได้',
    [403, 409].includes((await call(`/documents/${d.id}`, { method: 'PATCH', user: B, body: { subject: `${MARK} แอบแก้` } })).status), '');
  bad('ยกเลิกเอกสารที่อนุมัติแล้วไม่ได้',
    (await call(`/documents/${d.id}/cancel`, { method: 'POST', user: B })).status === 409, '');

  // guards that stop a document approving itself
  const own = await newDoc(A, 'ผู้จัดทำเป็นผู้ลงนามคนเดียว');
  bad('ผู้จัดทำอนุมัติเอกสารตัวเองคนเดียวไม่ได้',
    (await call(`/documents/${own.id}/submit`, { method: 'POST', user: A, body: { approvers: chain(A) } })).status === 400, '');
  const ghost = await newDoc(B, 'ผู้อนุมัติไม่มีบัญชี');
  bad('ผู้อนุมัติที่ไม่มีบัญชี → ปฏิเสธ',
    (await call(`/documents/${ghost.id}/submit`, { method: 'POST', user: B, body: { approvers: [{ email: 'nobody@nowhere.invalid', isSigner: true }] } })).status === 400, '');
}

// ── 4. หนังสือฉบับลงนาม + QR ───────────────────────────────────────────────
suite('4. หนังสือฉบับลงนาม และการตรวจสอบ');
{
  const d = await newDoc(B, 'ตรวจหนังสือ');
  await call(`/documents/${d.id}/generate-pdf`, { method: 'POST', user: B });
  await call(`/documents/${d.id}/submit`, { method: 'POST', user: B, body: { approvers: chain(A, C) } });
  await call(`/documents/${d.id}/approve`, { method: 'POST', user: A, body: { action: 'approved', comment: 'ความเห็นผู้จัดการ ห้ามโผล่' } });
  await call(`/documents/${d.id}/approve`, { method: 'POST', user: C, body: { action: 'approved', comment: 'ความเห็นผู้บริหาร ต้องแสดง' } });

  const det = await call(`/documents/${d.id}`, { user: B });
  const signed = det.data.attachments.find((a) => a.kind === 'generated_pdf' && a.version === 'approved');
  happy('สร้างหนังสือฉบับลงนามอัตโนมัติ', Boolean(signed), '');
  const buf = Buffer.from(await (await call(`/documents/${d.id}/attachments/${signed.id}/download`, { user: B, raw: true })).arrayBuffer());
  happy('เปิดไฟล์ได้จริง', buf.subarray(0, 5).toString() === '%PDF-', '');
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  happy(`เหลือ 2 หน้า (ตัดหน้าความเห็นออกตามที่ลูกค้าขอ) — ได้ ${pages}`, pages === 2, `${pages}`);

  const v = await call(`/verify/${det.data.verify_token}`);
  happy('หน้าตรวจสอบ QR เปิดได้โดยไม่ล็อกอิน', v.status === 200 && v.data?.document?.doc_number === d.doc_number, `${v.status}`);
  bad('หน้าตรวจสอบไม่เปิดเผยอีเมล/ความเห็นภายใน',
    !JSON.stringify(v.data.approval_steps).includes('@') && !JSON.stringify(v.data.approval_steps).includes('ความเห็น'), '');
  bad('รหัสตรวจสอบผิดรูปแบบ → 404', (await call('/verify/ไม่ใช่รหัส')).status === 404, '');
}

// ── 5. ไฟล์แนบ ─────────────────────────────────────────────────────────────
suite('5. ไฟล์แนบและการรวมไฟล์');
{
  const d = await newDoc(B, 'ไฟล์แนบ');
  await call(`/documents/${d.id}/generate-pdf`, { method: 'POST', user: B });
  const u1 = await upload(`/documents/${d.id}/attachments`, B, 'ใบเสนอราคา ผู้ขาย ก.pdf', minimalPdf(), 'application/pdf');
  happy('แนบ PDF ได้ และชื่อไทยไม่เพี้ยน', u1.status === 201 && u1.data.file_name === 'ใบเสนอราคา ผู้ขาย ก.pdf', u1.data?.file_name);
  happy('แนบรูปได้', (await upload(`/documents/${d.id}/attachments`, B, 'รูปหน้างาน.png', png(40, 30), 'image/png')).status === 201, '');

  // the corrupt image that once took the API down
  await upload(`/documents/${d.id}/attachments`, B, 'รูปเสีย.png', truncatedPng(), 'image/png');
  const t0 = Date.now();
  const comb = await call(`/documents/${d.id}/combine`, { method: 'POST', user: B });
  happy(`รวมไฟล์สำเร็จแม้มีภาพเสีย ไม่ค้าง (${((Date.now() - t0) / 1000).toFixed(1)} วิ)`, [200, 201].includes(comb.status), `${comb.status}`);
  happy('ระบบยังตอบสนองหลังเจอไฟล์เสีย', (await call('/documents/stats', { user: B })).status === 200, '');
  const cd = await call(`/documents/${d.id}`, { user: B });
  happy('มีไฟล์รวมเล่มเดียว และแจ้งในประวัติว่ามีไฟล์ที่รวมไม่ได้',
    cd.data.attachments.some((a) => a.kind === 'combined_pdf') && cd.data.audit.some((a) => a.action === 'combine_skipped'), '');
  happy('ระบุตำแหน่งจัดเก็บของทุกไฟล์', cd.data.attachments.every((a) => !!a.storage_key), '');

  const svg = await upload(`/documents/${d.id}/attachments`, B, 'อันตราย.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml');
  if (svg.status === 201) {
    const dl = await call(`/documents/${d.id}/attachments/${svg.data.id}/download`, { user: B, raw: true });
    bad('ไฟล์ SVG ถูกบังคับให้ดาวน์โหลด ไม่เปิดในเบราว์เซอร์', (dl.headers.get('content-disposition') || '').startsWith('attachment'), '');
  } else {
    bad('ไฟล์ SVG ถูกปฏิเสธตั้งแต่อัปโหลด', true, `${svg.status}`);
  }
  bad('ขอไฟล์ที่ไม่มีอยู่ → 404',
    (await call(`/documents/${d.id}/attachments/00000000-0000-0000-0000-000000000000/download`, { user: B })).status === 404, '');
}

// ── 6. สิทธิ์ ขอบเขต และการส่งออก ──────────────────────────────────────────
suite('6. สิทธิ์ ขอบเขต และการส่งออก');
{
  const mine = await newDoc(A, 'ของผู้ดูแล');
  bad('ผู้ใช้ทั่วไปแก้เอกสารคนอื่นไม่ได้',
    (await call(`/documents/${mine.id}`, { method: 'PATCH', user: H, body: { subject: `${MARK} แอบแก้` } })).status === 403, '');
  bad('ผู้ใช้ทั่วไปยกเลิกเอกสารคนอื่นไม่ได้',
    (await call(`/documents/${mine.id}/cancel`, { method: 'POST', user: H })).status === 403, '');
  for (const [label, path] of [['ทะเบียน', '/documents'], ['สถิติ', '/documents/stats'], ['Excel', '/documents/export']]) {
    bad(`ไม่ล็อกอินเข้า${label}ไม่ได้`, (await call(path, { user: null, raw: true })).status === 401, '');
  }
  bad('แดชบอร์ดและ Excel เปิดให้เฉพาะผู้ดูแล',
    (await call('/documents/stats', { user: H })).status === 403 && (await call('/documents/export', { user: H, raw: true })).status === 403, '');

  const all = await call('/documents?page=1&pageSize=100', { user: H });
  const before = new Set(all.data.map((d) => d.project_code));
  await query('insert into document_visibility (profile_id, scope_type, scope_value) values ($1,$2,$3)', [H.id, 'project', proj.id]);
  try {
    const scoped = await call('/documents?page=1&pageSize=100', { user: H });
    happy('จำกัดขอบเขตแล้วเห็นเฉพาะโครงการที่ได้รับ',
      new Set(scoped.data.map((d) => d.project_code)).size === 1, [...new Set(scoped.data.map((d) => d.project_code))].join(','));
    const outside = all.data.find((d) => d.project_code !== proj.code);
    if (outside) bad('เปิดเอกสารนอกขอบเขตตรง ๆ ไม่ได้', (await call(`/documents/${outside.id}`, { user: H })).status === 403, '');
  } finally {
    await query('delete from document_visibility where profile_id = $1', [H.id]);
  }
  happy('คืนขอบเขตเดิมแล้ว', new Set((await call('/documents?page=1&pageSize=100', { user: H })).data.map((d) => d.project_code)).size === before.size, '');

  const xl = await call('/documents/export', { user: A, raw: true });
  happy('ผู้ดูแลดาวน์โหลด Excel ได้', xl.status === 200 && (xl.headers.get('content-type') || '').includes('spreadsheet'), `${xl.status}`);
}

// ── 7. ทะเบียนและตัวกรอง ───────────────────────────────────────────────────
suite('7. ทะเบียนเอกสารและตัวกรอง');
{
  const uniq = `${MARK}ค้นหา${Date.now().toString().slice(-6)}`;
  const d = await newDoc(A, uniq);
  const list = await call('/documents?page=1&pageSize=25', { user: A });
  happy('เอกสารที่เพิ่งสร้างอยู่บนสุด', list.data[0]?.id === d.id, list.data[0]?.doc_number);
  happy('ค้นหาจากชื่อเรื่องภาษาไทยเจอ',
    (await call(`/documents?search=${encodeURIComponent(uniq)}`, { user: A })).data.some((x) => x.id === d.id), '');
  happy('กรองตามโครงการได้',
    (await call(`/documents?projectId=${proj.id}&pageSize=50`, { user: A })).data.every((x) => x.project_code === proj.code), '');
  happy('กรอง "เอกสารของฉัน" ได้', (await call('/documents?mine=created&pageSize=5', { user: A })).status === 200, '');
  const acted = await call('/documents?mine=acted&pageSize=5', { user: A });
  happy('กรอง "ที่ฉันเคยดำเนินการ" และเรียงตามเวลาที่ฉันทำล่าสุด',
    acted.status === 200 && (acted.data.length === 0 || acted.data[0].my_last_action_at), '');
  for (const q of ['projectId=ไม่ใช่ไอดี', 'from=2026-02-30', 'page=-5', 'pageSize=999999']) {
    bad(`ตัวกรองผิดรูปแบบ (${q}) ไม่ทำให้ระบบพัง`, (await call(`/documents?${q}`, { user: A })).status !== 500, '');
  }
}

const removed = await cleanup();
console.log(`\nลบเอกสารทดสอบ ${removed} ฉบับ`);
process.exit(report(`${ROOT}/core.json`) ? 1 : 0);

