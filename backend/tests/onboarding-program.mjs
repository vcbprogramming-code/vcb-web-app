/**
 * ปฐมนิเทศพนักงานใหม่ 90 วัน — กฎที่ทั้งโปรแกรมตั้งอยู่บนนั้น
 *
 * เอกสารข้อกำหนดฟังก์ชัน §7: เฟสปลดล็อกเมื่อ "ส่งเอกสารครบ และ เฟสก่อนหน้าเสร็จ"
 * เฟสที่ยังล็อกอ่านได้แต่ติ๊กไม่ได้ · รายการระดับอาวุโสไม่นับกับพนักงานระดับต้น
 * · ความคืบหน้าผูกกับ id ถาวรของรายการ ไม่ใช่ตำแหน่งในอาเรย์
 */
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

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

suite('7. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await wipe();
  const left = (await query('select count(*)::int n from ob_progress where profile_id = $1', [me])).rows[0].n;
  happy('ลบความคืบหน้าทดสอบหมดแล้ว', left === 0, `${left}`);
}

process.exit(report());
