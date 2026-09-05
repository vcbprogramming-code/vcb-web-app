/**
 * รายงานการประชุม — สิทธิ์การเข้าถึงสามระดับ
 *
 * เอกสารข้อกำหนดฟังก์ชัน §3.9: กลุ่มเป็น "เปิด" หรือ "ล็อก" กลุ่มที่ล็อกอ่านได้
 * เฉพาะผู้ดูแล ผู้แก้ไข และอีเมลที่ถูกระบุชื่อไว้ — และต้อง **หายไปจากรายการ**
 * ของคนที่ไม่มีสิทธิ์ ไม่ใช่ขึ้นชื่อแล้วกดไม่ได้ เพราะการโชว์ชื่อกลุ่มที่เปิด
 * ไม่ได้ก็คือการรั่วอยู่แล้ว
 *
 * ต่างจากระบบของลูกค้าหนึ่งข้อโดยตั้งใจ: ของเขา "เปิด" หมายถึงอ่านได้โดยไม่ต้อง
 * ลงชื่อเข้าใช้ ของเราทุกโมดูลอยู่หลังบัญชีเดียวกัน "เปิด" จึงหมายถึงผู้ใช้ที่
 * ลงชื่อเข้าใช้แล้วทุกคน
 */
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

await warm();
const A = U.admin;      // ผู้ดูแล — เห็นทุกกลุ่ม
const C = U.exec;       // ผู้บริหาร — ดูได้อย่างเดียว ไม่มีสิทธิ์แก้ไข
const MARK = 'ZZACC';

const clean = async () => {
  await query('delete from mtg_group_guests where group_id in (select id from mtg_groups where code like $1)', [`${MARK}%`]);
  await query('delete from mtg_meetings where group_id in (select id from mtg_groups where code like $1)', [`${MARK}%`]);
  await query('delete from mtg_groups where code like $1', [`${MARK}%`]);
};
await clean();

const mk = async (name, visibility) => (await query(
  `insert into mtg_groups (code, name, name_en, color, visibility, sort_order)
   values ($1,$2,$2,'#64748b',$3, 999) returning *`,
  [`${MARK}-${name}`, `${MARK} ${name}`, visibility])).rows[0];

const open = await mk('เปิด', 'public');
const shut = await mk('ล็อก', 'locked');

const sees = async (user, id) =>
  ((await call('/meetings/bootstrap', { user })).data?.groups || []).some((g) => g.id === id);

suite('1. กลุ่มที่ล็อกหายไปจากรายการของคนที่ไม่มีสิทธิ์');
{
  happy('ผู้ดูแลเห็นกลุ่มที่เปิด', await sees(A, open.id), '');
  happy('ผู้ดูแลเห็นกลุ่มที่ล็อกด้วย', await sees(A, shut.id), '');
  happy('ผู้ที่ดูได้อย่างเดียวเห็นกลุ่มที่เปิด', await sees(C, open.id), '');
  bad('แต่ไม่เห็นกลุ่มที่ล็อก', !(await sees(C, shut.id)), '');
}

suite('2. ผู้ที่ถูกระบุชื่อเข้าอ่านกลุ่มที่ล็อกได้');
{
  const add = await call(`/meetings/groups/${shut.id}/guests`, { method: 'POST', user: A, body: { emails: C.email } });
  happy('เพิ่มอีเมลผู้อ่านได้', add.status === 201, `${add.status}`);
  happy('เพิ่มแล้วเห็นกลุ่มที่ล็อก', await sees(C, shut.id), '');

  const list = await call(`/meetings/groups/${shut.id}/guests`, { user: A });
  happy('อ่านรายชื่อผู้ที่ถูกระบุกลับมาได้',
    (list.data || []).some((g) => g.email === C.email.toLowerCase()), JSON.stringify(list.data));
  happy('บอกว่าใครเป็นคนเพิ่ม', (list.data || []).every((g) => g.added_by_name), '');

  const del = await call(`/meetings/groups/${shut.id}/guests/${encodeURIComponent(C.email)}`, { method: 'DELETE', user: A });
  happy('ถอดชื่อออกได้', del.status === 200, `${del.status}`);
  bad('ถอดแล้วมองไม่เห็นอีก', !(await sees(C, shut.id)), '');
}

suite('3. อีเมลผิดหนึ่งตัว ปฏิเสธทั้งชุด');
{
  const r = await call(`/meetings/groups/${shut.id}/guests`, { method: 'POST', user: A,
    body: { emails: 'good@vcb.local, ไม่ใช่อีเมล, also@vcb.local' } });
  bad('ตอบ 400 ไม่ใช่บันทึกครึ่ง ๆ กลาง ๆ', r.status === 400, `${r.status}`);
  happy('บอกด้วยว่าอีเมลไหนผิด', String(r.error || '').includes('ไม่ใช่อีเมล'), r.error);
  const after = await call(`/meetings/groups/${shut.id}/guests`, { user: A });
  bad('ไม่มีอีเมลที่ถูกต้องหลุดเข้าไปด้วย', (after.data || []).length === 0, `${(after.data || []).length}`);

  const many = await call(`/meetings/groups/${shut.id}/guests`, { method: 'POST', user: A,
    body: { emails: 'a@vcb.local; b@vcb.local\nc@vcb.local' } });
  happy('วางหลายอีเมลคั่นด้วยอะไรก็ได้', many.status === 201, `${many.status}`);
  happy('เพิ่มครบทั้งสามคน', ((await call(`/meetings/groups/${shut.id}/guests`, { user: A })).data || []).length === 3, '');
}

suite('4. หน้าภาพรวมสิทธิ์');
{
  const acc = await call('/meetings/access', { user: A });
  happy('ผู้ดูแลเปิดได้', acc.status === 200 && Array.isArray(acc.data), `${acc.status}`);
  const g = (acc.data || []).find((x) => x.id === shut.id);
  happy('บอกระดับการมองเห็นของแต่ละกลุ่ม', g?.visibility === 'locked', g?.visibility);
  happy('บอกรายชื่อผู้อ่านมาด้วย', (g?.emails || []).length === 3, `${(g?.emails || []).length}`);

  // กลุ่มที่ล็อกแต่ไม่มีใครถูกระบุชื่อ ต้องถูกชี้ให้เห็น — ถูกกฎแต่มักเกิดโดยไม่ตั้งใจ
  const bare = await mk('ล็อกแต่ว่าง', 'locked');
  const acc2 = await call('/meetings/access', { user: A });
  happy('เตือนกลุ่มที่ล็อกไว้แต่ยังไม่มีใครระบุชื่อ',
    (acc2.data || []).find((x) => x.id === bare.id)?.bare === true, '');
  bad('กลุ่มที่มีคนระบุชื่อแล้วไม่ถูกเตือน',
    (acc2.data || []).find((x) => x.id === shut.id)?.bare === false, '');

  bad('ผู้ที่ไม่มีสิทธิ์จัดการเปิดหน้านี้ไม่ได้',
    (await call('/meetings/access', { user: C })).status === 403, '');
}

suite('5. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await clean();
  happy('ลบกลุ่มทดสอบหมดแล้ว',
    (await query('select count(*)::int n from mtg_groups where code like $1', [`${MARK}%`])).rows[0].n === 0, '');
}

process.exit(report());
