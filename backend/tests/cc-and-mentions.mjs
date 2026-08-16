/**
 * PF — ชุดที่ 2: สำเนาเรียนเป็นบัญชีจริง · comment ได้ · tag คนแล้วส่งอีเมล
 */
import { fileURLToPath } from 'node:url';
import { call, newDoc, cleanup, suite, happy, bad, report, U, warm, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, admin2: B, exec: C, hr: H } = U;
const chain = (...p) => p.map((x, i) => ({ name: x.name, email: x.email, isSigner: i === 0 }));

// ── 1. รายชื่อคนสำหรับเลือก ────────────────────────────────────────────────
suite('1. รายชื่อคนสำหรับเลือก CC และ tag');
{
  const people = await call('/documents/people', { user: A });
  happy('เปิดรายชื่อได้', people.status === 200 && Array.isArray(people.data), `got ${people.status}`);
  happy('มี id มาด้วย (ใช้ผูกบัญชีจริง)', people.data.every((p) => p.id && p.email), '');
  happy('มีเฉพาะบัญชีที่ใช้งานอยู่', people.data.length > 0, `${people.data.length} คน`);
  bad('ไม่ล็อกอินเปิดรายชื่อไม่ได้', (await call('/documents/people', { user: null })).status === 401, '');
}

// ── 2. CC เป็นบัญชีจริง หลายคน ─────────────────────────────────────────────
suite('2. สำเนาเรียนหลายคนเป็นบัญชีจริง');
let docId = null;
{
  const d = await newDoc(A, 'สำเนาเรียนหลายคน', { ccProfileIds: [C.id, H.id] });
  docId = d.id;
  const det = await call(`/documents/${d.id}`, { user: A });
  happy('บันทึกผู้รับสำเนา 2 คนได้', det.data.cc_people?.length === 2, JSON.stringify(det.data.cc_people?.map((p) => p.full_name)));
  happy('ส่งกลับมาเป็นคน (ชื่อ+อีเมล) ไม่ใช่ข้อความดิบ',
    det.data.cc_people.every((p) => p.id && p.full_name && p.email), '');

  const upd = await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: [B.id] } });
  happy('แก้ไขรายชื่อผู้รับสำเนาได้', upd.status === 200, `got ${upd.status}`);
  const det2 = await call(`/documents/${d.id}`, { user: A });
  happy('แก้แล้วเหลือคนเดียวตามที่ตั้ง', det2.data.cc_people.length === 1 && det2.data.cc_people[0].id === B.id, JSON.stringify(det2.data.cc_people));

  const cleared = await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: [] } });
  happy('ล้างผู้รับสำเนาทั้งหมดได้', cleared.status === 200 && (await call(`/documents/${d.id}`, { user: A })).data.cc_people.length === 0, '');
  await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: [C.id, H.id] } });

  bad('ใส่ id ที่ไม่ใช่รูปแบบถูกต้อง → 400',
    (await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: ['ไม่ใช่ไอดี'] } })).status === 400, '');
  const ghost = await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: ['00000000-0000-0000-0000-000000000000'] } });
  bad('id ที่ไม่มีบัญชีจริง → ไม่ถูกบันทึก', ghost.status === 200
    && (await call(`/documents/${d.id}`, { user: A })).data.cc_people.length === 0, '');
  await call(`/documents/${d.id}`, { method: 'PATCH', user: A, body: { ccProfileIds: [C.id, H.id] } });
}

// ── 3. ผู้รับสำเนาเปิดเอกสารและ comment ได้ ────────────────────────────────
suite('3. ผู้รับสำเนาเปิดเอกสารและร่วมสนทนาได้');
{
  // H (เจ้าหน้าที่ HR) ถูกจำกัดขอบเขตให้เห็นเฉพาะโครงการอื่น — ต้องยังเปิดเอกสารที่ถูก CC ได้
  const proj = (await call('/projects', { user: A })).data.find((p) => p.code !== 'kda');
  await query('insert into document_visibility (profile_id, scope_type, scope_value) values ($1,$2,$3)', [H.id, 'project', proj.id]);
  try {
    const open = await call(`/documents/${docId}`, { user: H });
    happy('ผู้รับสำเนาเปิดเอกสารได้ แม้อยู่นอกขอบเขตโครงการของตน', open.status === 200, `got ${open.status}`);
    const msg = await call(`/documents/${docId}/messages`, { method: 'POST', user: H, body: { body: 'ความเห็นจากผู้รับสำเนา' } });
    happy('ผู้รับสำเนาเขียนความเห็นในเอกสารได้', msg.status === 201, JSON.stringify(msg).slice(0, 120));
    const det = await call(`/documents/${docId}`, { user: A });
    happy('ความเห็นปรากฏให้ทุกคนเห็นในหน้าเอกสารเดียวกัน',
      det.data.messages.some((m) => m.body.includes('ความเห็นจากผู้รับสำเนา')), '');
  } finally {
    await query('delete from document_visibility where profile_id = $1', [H.id]);
  }

  // Being CC'd must open exactly ONE door, not the whole register: the same
  // scoped account, on a document it is NOT copied on, must still be refused.
  // (Use a non-admin — admins bypass visibility scoping by design.)
  const notCc = await newDoc(A, 'ไม่ได้ CC ถึง HR', { ccProfileIds: [C.id] });
  await query('insert into document_visibility (profile_id, scope_type, scope_value) values ($1,$2,$3)', [H.id, 'project', proj.id]);
  try {
    const denied = await call(`/documents/${notCc.id}`, { user: H });
    bad('เอกสารที่ไม่ได้ถูก CC ถึง ยังเปิดไม่ได้ (สิทธิ์เปิดแค่ฉบับที่ถูก CC)', denied.status === 403, `got ${denied.status}`);
    const allowed = await call(`/documents/${docId}`, { user: H });
    happy('ส่วนฉบับที่ถูก CC ยังเปิดได้ตามปกติ', allowed.status === 200, `got ${allowed.status}`);
  } finally {
    await query('delete from document_visibility where profile_id = $1', [H.id]);
  }
}

// ── 4. อีเมลสำเนาเรียนใช้บัญชีจริง ─────────────────────────────────────────
suite('4. อีเมลแจ้งผู้รับสำเนา');
{
  const d = await newDoc(A, 'แจ้งผู้รับสำเนา', { ccProfileIds: [C.id] });
  await call(`/documents/${d.id}/generate-pdf`, { method: 'POST', user: A });
  const s = await call(`/documents/${d.id}/submit`, { method: 'POST', user: A, body: { approvers: chain(A, B) } });
  happy('ส่งเข้าสายอนุมัติสำเร็จ', s.status === 200 || s.status === 201, `got ${s.status}`);
  const det = await call(`/documents/${d.id}`, { user: A });
  happy('ไม่มีอีเมลล้มเหลว', !det.data.audit.some((a) => a.action === 'email_failed'), '');

  // เอกสารเก่าที่เก็บ CC เป็นข้อความอิสระ ต้องยังได้รับอีเมลเหมือนเดิม
  const legacy = await newDoc(A, 'CC แบบข้อความเดิม', { cc: 'ฝ่ายบัญชี zz.legacy.cc@example.com' });
  await call(`/documents/${legacy.id}/generate-pdf`, { method: 'POST', user: A });
  const s2 = await call(`/documents/${legacy.id}/submit`, { method: 'POST', user: A, body: { approvers: chain(A, B) } });
  happy('เอกสารรูปแบบเดิม (CC เป็นข้อความ) ยังส่งได้ ไม่พัง', s2.status === 200 || s2.status === 201, `got ${s2.status}`);
  const { rows: tk } = await query('select email from document_share_tokens where document_id = $1', [legacy.id]);
  happy('ยังออกลิงก์ให้อีเมลแบบเดิมที่ไม่มีบัญชี', tk.length === 1, JSON.stringify(tk));
}

// ── 5. tag คนในความเห็น ────────────────────────────────────────────────────
suite('5. กล่าวถึง (tag) คนในความเห็น');
{
  const d = await newDoc(A, 'ทดสอบ tag');
  const m = await call(`/documents/${d.id}/messages`, {
    method: 'POST', user: A, body: { body: 'ฝากดูให้หน่อยครับ', mentions: [C.id, B.id] },
  });
  happy('ส่งความเห็นพร้อม tag 2 คนได้', m.status === 201, JSON.stringify(m).slice(0, 140));
  happy('ตอบกลับมาว่า tag ใครบ้าง', m.data.mentions?.length === 2, JSON.stringify(m.data.mentions));

  const det = await call(`/documents/${d.id}`, { user: A });
  const msg = det.data.messages.find((x) => x.id === m.data.id);
  happy('รายชื่อที่ถูก tag อยู่กับข้อความ', msg?.mentions?.length === 2, JSON.stringify(msg?.mentions));

  const self = await call(`/documents/${d.id}/messages`, { method: 'POST', user: A, body: { body: 'tag ตัวเอง', mentions: [A.id] } });
  bad('tag ตัวเองไม่ส่งแจ้งเตือน', self.data.mentions?.length === 0, JSON.stringify(self.data.mentions));
  const ghost = await call(`/documents/${d.id}/messages`, { method: 'POST', user: A, body: { body: 'tag ผี', mentions: ['00000000-0000-0000-0000-000000000000'] } });
  bad('tag บัญชีที่ไม่มีอยู่ → ข้ามไป ไม่ error', ghost.status === 201 && ghost.data.mentions.length === 0, `got ${ghost.status}`);
  bad('mentions ผิดรูปแบบ → 400',
    (await call(`/documents/${d.id}/messages`, { method: 'POST', user: A, body: { body: 'x', mentions: ['ไม่ใช่ไอดี'] } })).status === 400, '');

  const { rows } = await query('select count(*)::int n from document_message_mentions where message_id = $1', [m.data.id]);
  happy('บันทึกการ tag ลงฐานข้อมูลแล้ว', rows[0].n === 2, `${rows[0].n} แถว`);
}

const removed = await cleanup();
console.log(`\nลบเอกสารทดสอบ ${removed} ฉบับ`);
process.exit(report(`${ROOT}/PF.json`) ? 1 : 0);
