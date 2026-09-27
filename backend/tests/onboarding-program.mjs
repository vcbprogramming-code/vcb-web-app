/**
 * ปฐมนิเทศพนักงานใหม่ 90 วัน — กฎที่ทั้งโปรแกรมตั้งอยู่บนนั้น
 *
 * เอกสารข้อกำหนดฟังก์ชัน §7: เฟสปลดล็อกเมื่อ "ส่งเอกสารครบ และ เฟสก่อนหน้าเสร็จ"
 * เฟสที่ยังล็อกอ่านได้แต่ติ๊กไม่ได้ · รายการระดับอาวุโสไม่นับกับพนักงานระดับต้น
 * · ความคืบหน้าผูกกับ id ถาวรของรายการ ไม่ใช่ตำแหน่งในอาเรย์
 */
import { call, suite, happy, bad, report, U, warm, query, upload } from './harness.mjs';

await warm();
const A = U.admin;

// โมดูลปฐมนิเทศยังปิดอยู่เป็นค่าเริ่มต้น (DISABLED_MODULES) — ชุดนี้จึงข้ามไป
// เว้นแต่จะเปิด รันด้วย DISABLED_MODULES= เพื่อทดสอบส่วนนี้
{
  const probe = await call('/onboarding-program/bootstrap', { user: A });
  if (probe.status === 404) {
    console.log('\nข้าม — โมดูลปฐมนิเทศยังปิดอยู่ (รัน API ด้วย DISABLED_MODULES= เพื่อทดสอบ)');
    process.exit(report());
  }
}
const me = A.id;

const wipe = async () => {
  for (const t of ['ob_progress', 'ob_doc_submissions', 'ob_enrollments'])
    await query(`delete from ${t} where profile_id = $1`, [me]);
};
await wipe();

const boot = () => call('/onboarding-program/bootstrap', { user: A });
let b = await boot();

suite('1. เนื้อหาครบตามต้นฉบับ');
{
  happy('มี 5 แผนก', (b.data?.departments || []).length === 5, `${(b.data?.departments || []).length}`);
  const phases = b.data.departments.reduce((a, d) => a + d.phases.length, 0);
  happy('แผนกละ 3 เฟส รวม 15 เฟส', phases === 15, `${phases}`);
  const items = b.data.departments.reduce((a, d) =>
    a + d.phases.reduce((x, p) => x + p.blocks.reduce((y, bl) => y + bl.items.length, 0), 0), 0);
  happy('รายการเช็กลิสต์ 180 รายการ', items === 180, `${items}`);
  happy('เอกสารที่ต้องส่ง 8 รายการ', (b.data.documents || []).length === 8, `${(b.data.documents || []).length}`);
  const one = b.data.departments[0].phases[0].blocks[0].items[0];
  happy('รายการมี id ถาวรจากเนื้อหาต้นฉบับ', /^[a-z]+-p\d-\w+-\d+$/.test(one.id), one.id);
  happy('บล็อกเรียงตาม อ่าน → ความรู้ → ผลงาน',
    b.data.departments[0].phases[0].blocks.map((x) => x.heading).join(' · ')
      === 'Required Reading · Knowledge Requirements · Required Outputs',
    b.data.departments[0].phases[0].blocks.map((x) => x.heading).join(' · '));
}

const dept = b.data.departments[0];
const [p1, p2, p3] = dept.phases;
const firstItem = p1.blocks[0].items.find((i) => i.level === 'junior');

suite('2. เอกสารเป็นประตูบานแรก');
{
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept.slug } });
  b = await boot();
  bad('ยังไม่ส่งเอกสาร เฟสแรกยังไม่ปลดล็อก', b.data.status.unlocked[p1.id] === false, '');
  happy('บอกเหตุผลว่าติดที่เอกสาร', b.data.status.lockReason[p1.id] === 'documents', b.data.status.lockReason[p1.id]);
  const r = await call(`/onboarding-program/progress/${firstItem.id}`, { method: 'PUT', user: A, body: { done: true } });
  bad('เซิร์ฟเวอร์ปฏิเสธการติ๊ก ไม่ใช่แค่ปิดปุ่ม', r.status === 409, `${r.status}`);

  for (const d of b.data.documents) await call(`/onboarding-program/documents/${d.id}`, { method: 'POST', user: A, body: {} });
  b = await boot();
  happy('ส่งครบแล้วเฟสแรกปลดล็อก', b.data.status.unlocked[p1.id] === true, '');
  happy('ส่งครบแล้วระบบรู้ว่าครบ', b.data.status.docsComplete === true, '');
}

suite('3. เฟสถัดไปรอเฟสก่อนหน้า');
{
  bad('เฟสสองยังล็อก', b.data.status.unlocked[p2.id] === false, '');
  happy('บอกเหตุผลว่าติดเฟสก่อนหน้า', b.data.status.lockReason[p2.id] === 'previous-phase', b.data.status.lockReason[p2.id]);
  const r = await call(`/onboarding-program/progress/${p2.blocks[0].items[0].id}`, { method: 'PUT', user: A, body: { done: true } });
  bad('ติ๊กเฟสสองไม่ได้', r.status === 409, `${r.status}`);

  // ทำเฟสหนึ่งให้ครบ (เฉพาะรายการที่ระดับต้นมองเห็น)
  const junior = p1.blocks.flatMap((x) => x.items).filter((i) => i.level === 'junior');
  for (const it of junior) await call(`/onboarding-program/progress/${it.id}`, { method: 'PUT', user: A, body: { done: true } });
  b = await boot();
  happy('เฟสหนึ่งขึ้นว่าเสร็จ', b.data.status.phases[0].complete === true,
    `${b.data.status.phases[0].done}/${b.data.status.phases[0].total}`);
  happy('เฟสสองปลดล็อกแล้ว', b.data.status.unlocked[p2.id] === true, '');
  bad('เฟสสามยังล็อกอยู่', b.data.status.unlocked[p3.id] === false, '');
}

suite('4. ระดับพนักงานเปลี่ยนตัวหาร ไม่ใช่แค่ซ่อน');
{
  const juniorTotal = b.data.status.phases[0].total;
  happy('ระดับต้นไม่นับรายการของอาวุโส', juniorTotal === 9, `${juniorTotal}`);
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'senior' } });
  b = await boot();
  happy('เปลี่ยนเป็นอาวุโสแล้วตัวหารเพิ่ม', b.data.status.phases[0].total === 12, `${b.data.status.phases[0].total}`);
  bad('และเฟสหนึ่งกลับเป็นยังไม่เสร็จ', b.data.status.phases[0].complete === false, '');
  bad('เฟสสองจึงล็อกกลับ', b.data.status.unlocked[p2.id] === false, '');

  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'junior' } });
  b = await boot();
  happy('กลับเป็นระดับต้นแล้วเครื่องหมายเดิมยังอยู่', b.data.status.phases[0].complete === true, '');
}

suite('5. เปลี่ยนแผนกไม่ล้างความคืบหน้า');
{
  const other = b.data.departments[1];
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: other.slug } });
  const n = (await query('select count(*)::int n from ob_progress where profile_id = $1', [me])).rows[0].n;
  happy('ความคืบหน้าของแผนกเดิมยังอยู่ครบ', n === 9, `${n}`);
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept.slug } });
  b = await boot();
  happy('กลับมาแผนกเดิมแล้วเจอของเดิม', b.data.status.phases[0].complete === true, '');
}

suite('6. ภาพรวมพนักงาน (เฉพาะผู้ดูแล)');
{
  const c = await call('/onboarding-program/cohort', { user: A });
  happy('ผู้ดูแลเปิดได้', c.status === 200 && Array.isArray(c.data), `${c.status}`);
  const mine = (c.data || []).find((x) => x.profileId === me);
  happy('เห็นตัวเองในรายการ', Boolean(mine), '');
  happy('ตัวหารนับตามระดับของแต่ละคน', mine?.total === 27, `${mine?.total}`);
  bad('ผู้ที่ไม่ใช่ผู้ดูแลเปิดไม่ได้',
    (await call('/onboarding-program/cohort', { user: U.exec })).status === 403, '');
}

// เปิดโหมดไทยแล้วยังเห็นอังกฤษล้วน คือข้อบกพร่องที่พาเรามาทำงานรอบนี้ — คำแปล
// มาจาก TH_DICT ของลูกค้าตรงตัว ครบทุกข้อ ไม่ใช่บางข้อ เพราะข้อที่หลุดจะโชว์
// อังกฤษปนไทยอยู่ในรายการเดียวกัน ซึ่งอ่านแล้วดูเหมือนระบบพัง
suite('7. คำแปลไทยของเนื้อหา (เทียบ TH_DICT ของลูกค้า)');
{
  b = await boot();
  const all = b.data.departments.flatMap((d) => d.phases.flatMap((p) => p.blocks.flatMap((x) => x.items)));
  const withTh = all.filter((i) => i.text_th && i.text_th.trim());
  happy('ข้อเช็กลิสต์มีคำแปลไทยครบ 180 ข้อ', withTh.length === 180, `${withTh.length}/${all.length}`);
  happy('คำแปลเป็นอักษรไทยจริง ไม่ใช่อังกฤษซ้ำ',
    withTh.every((i) => /[\u0E00-\u0E7F]/.test(i.text_th)), '');
  const one = all.find((i) => i.id === 'acct-p1-read-1');
  happy('คำแปลตรงตัวตามพจนานุกรมของเขา', one?.text_th === 'โครงสร้างผังบัญชี', one?.text_th || '');

  const phases = b.data.departments.flatMap((d) => d.phases);
  happy('เฟสทั้ง 15 มี eyebrow + title ไทย',
    phases.every((p) => p.eyebrow_th && p.title_th), `${phases.filter((p) => p.eyebrow_th && p.title_th).length}/15`);
  happy('ช่วงวันใช้ขีดยาวแบบของเขา (วันที่ 1–30)',
    phases.some((p) => p.eyebrow_th.includes('วันที่ 1–30')), phases[0].eyebrow_th);

  const blocks = phases.flatMap((p) => p.blocks);
  happy('หัวบล็อกทั้ง 45 มีคำแปลไทย', blocks.every((x) => x.heading_th), '');
  happy('สามหัวบล็อกแปลตรงตามของเขา',
    [...new Set(blocks.map((x) => x.heading_th))].sort().join('|')
      === ['เอกสารที่ต้องศึกษา', 'ความรู้ที่จำเป็น', 'ผลงานที่ต้องส่งมอบ'].sort().join('|'),
    [...new Set(blocks.map((x) => x.heading_th))].join(' · '));

  happy('เอกสารทั้ง 8 มีชื่อและคำบรรยายไทย',
    b.data.documents.every((d) => d.title_th && d.descr_th), '');
  bad('ไม่มีเอกสารใดเหลือแต่ภาษาอังกฤษ',
    !b.data.documents.some((d) => !d.title_th), '');
}

suite('8. ลิงก์เอกสารต้นแบบ (ดู / ดาวน์โหลด)');
{
  const withView = b.data.documents.filter((d) => d.view_url);
  happy('มีลิงก์ดูเอกสาร 7 ฉบับตามต้นฉบับ', withView.length === 7, `${withView.length}`);
  happy('มีลิงก์ดาวน์โหลด 7 ฉบับ', b.data.documents.filter((d) => d.download_url).length === 7, '');
  const contract = b.data.documents.find((d) => d.id === 'employment-contract');
  // สัญญาจ้างเป็น Google Doc ไม่ใช่ไฟล์ใน Drive — รูป URL ต่างกัน จึงต้องเก็บ
  // สองคอลัมน์ ไม่ใช่คำนวณลิงก์ดาวน์โหลดจากลิงก์ดู
  happy('สัญญาจ้าง (Google Doc) ใช้ URL คนละรูปกับไฟล์ Drive',
    contract.view_url.includes('docs.google.com') && contract.download_url.includes('format=docx'), '');
  happy('แบบฟอร์มภาษียังไม่มีลิงก์ ตามต้นฉบับ',
    b.data.documents.find((d) => d.id === 'tax-form').view_url == null, '');
}

suite('9. อัปโหลดไฟล์เอกสารจริง');
{
  await wipe();
  const pdf = Buffer.from('%PDF-1.4 ZZTEST');
  let r = await upload('/onboarding-program/documents/nda/file', A, 'ข้อตกลง ZZTEST.pdf', pdf, 'application/pdf');
  happy('อัปโหลด .pdf สำเร็จ', r.status === 200, `${r.status}`);
  happy('ชื่อไฟล์ภาษาไทยไม่เพี้ยน', r.data?.fileName === 'ข้อตกลง ZZTEST.pdf', r.data?.fileName || '');
  happy('อัปโหลดแล้วถือว่าข้อนั้นเสร็จ', r.data?.status?.submittedDocuments?.includes('nda'), '');
  happy('ใบเสร็จบอกชื่อไฟล์ที่รับไว้', r.data?.status?.uploads?.nda?.fileName === 'ข้อตกลง ZZTEST.pdf', '');

  r = await upload('/onboarding-program/documents/nda/file', A, 'ไม่รองรับ.txt', Buffer.from('x'), 'text/plain');
  bad('สกุลไฟล์ที่ไม่รองรับถูกปฏิเสธที่เซิร์ฟเวอร์', r.status === 400, `${r.status}`);

  // อัปใหม่ต้อง "แทน" ของเดิม ไม่ใช่เก็บสองไฟล์โดยไม่รู้ว่าอันไหนของจริง
  r = await upload('/onboarding-program/documents/nda/file', A, 'แทนที่ ZZTEST.png', Buffer.from('PNGZZTEST'), 'image/png');
  happy('อัปใหม่แทนไฟล์เดิม', r.data?.status?.uploads?.nda?.fileName === 'แทนที่ ZZTEST.png', r.data?.status?.uploads?.nda?.fileName || '');
  const rows = (await query('select count(*)::int n from ob_doc_submissions where profile_id = $1 and doc_id = $2', [me, 'nda'])).rows[0].n;
  happy('มีแถวเดียวต่อเอกสารหนึ่งฉบับ', rows === 1, `${rows}`);

  const file = await call('/onboarding-program/documents/nda/file', { user: A, raw: true });
  happy('เปิดไฟล์ที่อัปไว้ได้', file.status === 200, `${file.status}`);
  bad('เอกสารที่ยังไม่อัปไฟล์ เปิดไม่ได้',
    (await call('/onboarding-program/documents/tax-form/file', { user: A, raw: true })).status === 404, '');
  bad('คนอื่นเปิดไฟล์ของเราด้วย ?profile ไม่ได้',
    (await call(`/onboarding-program/documents/nda/file?profile=${me}`, { user: U.exec, raw: true })).status === 404, '');
}

suite('10. ประตูกั้นก่อนเลือกแผนก บอกชื่อเอกสารที่ขาด');
{
  b = await boot();
  happy('ส่งรายชื่อเอกสารที่ขาด ไม่ใช่แค่จำนวน',
    Array.isArray(b.data.status.missingDocuments) && b.data.status.missingDocuments.length === 7,
    `${b.data.status.missingDocuments?.length}`);
  bad('เอกสารที่อัปแล้วไม่อยู่ในรายการที่ขาด',
    !b.data.status.missingDocuments.includes('nda'), '');
  for (const d of b.data.documents) await call(`/onboarding-program/documents/${d.id}`, { method: 'POST', user: A, body: {} });
  b = await boot();
  happy('ส่งครบแล้วรายการที่ขาดว่างเปล่า', b.data.status.missingDocuments.length === 0, '');
}

suite('11. หน้าผู้ดูแลแก้เช็กลิสต์');
{
  const blk = b.data.departments[0].phases[0].blocks[0];
  const list = await call(`/onboarding-program/items?blockId=${blk.id}`, { user: A });
  happy('ผู้ดูแลอ่านข้อทั้งบล็อกได้', list.status === 200 && list.data.length >= 4, `${list.data?.length}`);
  bad('ผู้ที่ไม่ใช่ผู้ดูแลอ่านไม่ได้',
    (await call(`/onboarding-program/items?blockId=${blk.id}`, { user: U.exec })).status === 403, '');

  const add = await call('/onboarding-program/items', { method: 'POST', user: A,
    body: { blockId: blk.id, text: 'ZZTEST added item', textTh: 'ข้อที่เพิ่มเพื่อทดสอบ ZZTEST', level: 'senior' } });
  happy('เพิ่มข้อใหม่ได้', add.status === 201, `${add.status}`);
  happy('ข้อใหม่เก็บคำแปลไทยด้วย', add.data?.text_th === 'ข้อที่เพิ่มเพื่อทดสอบ ZZTEST', '');
  happy('ข้อใหม่ต่อท้าย ไม่ทับลำดับเดิม', add.data?.sort_order > list.data.length - 1, `${add.data?.sort_order}`);
  // id ของข้อใหม่ต้องไม่เคยมีใครใช้ — ถ้านำเลขเดิมกลับมาใช้ เครื่องหมายถูกของ
  // พนักงานที่ติ๊กข้อเก่าไว้จะกลายเป็นติ๊กข้อใหม่ที่เขายังไม่ได้ทำ
  bad('id ข้อใหม่ไม่ชนกับ id เดิม', !list.data.some((x) => x.id === add.data.id), add.data.id);

  const mv = await call(`/onboarding-program/items/${add.data.id}/move`, { method: 'PUT', user: A, body: { direction: 'up' } });
  happy('เลื่อนลำดับขึ้นได้', mv.status === 200 && mv.data.moved === true, '');
  const after = await call(`/onboarding-program/items?blockId=${blk.id}`, { user: A });
  happy('ลำดับเปลี่ยนจริงในฐานข้อมูล',
    after.data.findIndex((x) => x.id === add.data.id) === after.data.length - 2,
    after.data.map((x) => x.id).join(','));

  const off = await call(`/onboarding-program/items/${add.data.id}`, { method: 'PATCH', user: A, body: { isActive: false } });
  happy('ปิดใช้งานข้อได้', off.data?.is_active === false, '');
  b = await boot();
  bad('ข้อที่ปิดไม่โผล่ในเช็กลิสต์ของพนักงาน',
    !b.data.departments[0].phases[0].blocks[0].items.some((x) => x.id === add.data.id), '');
  const stillThere = await call(`/onboarding-program/items?blockId=${blk.id}`, { user: A });
  happy('แต่ผู้ดูแลยังเห็น จึงเปิดกลับได้', stillThere.data.some((x) => x.id === add.data.id), '');

  // ล้างของทดสอบ แล้วคืนลำดับเดิมให้บล็อกนั้น
  await query('delete from ob_items where id = $1', [add.data.id]);
  const rows = (await query('select id from ob_items where block_id = $1 order by sort_order, id', [blk.id])).rows;
  for (const [i, x] of rows.entries()) await query('update ob_items set sort_order = $2 where id = $1', [x.id, i + 1]);
  happy('ลบข้อทดสอบและคืนลำดับเดิมแล้ว',
    (await query('select count(*)::int n from ob_items where id like $1', ['custom-%ZZ%'])).rows[0].n === 0, '');
}

suite('12. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await wipe();
  const left = (await query('select count(*)::int n from ob_progress where profile_id = $1', [me])).rows[0].n;
  const docs = (await query('select count(*)::int n from ob_doc_submissions where profile_id = $1', [me])).rows[0].n;
  happy('ลบความคืบหน้าทดสอบหมดแล้ว', left === 0, `${left}`);
  happy('ลบเอกสารที่อัปไว้ตอนทดสอบหมดแล้ว', docs === 0, `${docs}`);
}

process.exit(report());
