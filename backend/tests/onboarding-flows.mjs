/**
 * โปรแกรมปฐมนิเทศ — ไล่ทีละสถานการณ์การใช้งาน เทียบกับพอร์ทัลที่ลูกค้าใช้อยู่
 *
 * ชุดเดิม (onboarding-program.mjs) ตรึงกฎหลักสามข้อ: เอกสารเป็นประตูบานแรก ·
 * เฟสถัดไปรอเฟสก่อนหน้า · ระดับพนักงานเปลี่ยนตัวหาร ชุดนี้ไล่ "คนคนหนึ่งกดอะไร
 * ตามลำดับ" ให้ครบทั้งเส้นทาง แล้วจี้เฉพาะจุดที่ระบบตอบผิดได้โดยยังดูปกติ:
 * เปอร์เซ็นต์ต่อบล็อก · ข้อที่ไม่ใช่ของแผนกตัวเอง · อัปโหลดทับไฟล์เดิม ·
 * จอผู้ดูแลที่ปิดข้อแล้วต้องเปิดกลับได้ · หน้าเนื้อหาสิบหน้าที่ลิงก์และรูปต้องมาจริง
 *
 * อ้างซอร์สของเขา: Code.gs (getProgress · setTaskDone · uploadRequiredDocument ·
 * getChecklistOverrides · saveChecklistItem) และ progress.html (isPhasePageUnlocked ·
 * MAX_DOC_UPLOAD_BYTES · promptRequiredDocsIncomplete)
 *
 * ต่างจากเขาหนึ่งข้อโดยเจตนา: สลับแผนกแล้วความคืบหน้าเดิมไม่หาย (ของเขาลบทิ้ง)
 * — ชุดนี้ตรึงพฤติกรรมของเราไว้ ไม่ใช่ของเขา
 */
import { call, suite, happy, bad, report, U, warm, query, upload } from './harness.mjs';

await warm();
const A = U.admin;
const H = U.hr;

// โมดูลนี้ปิดได้ด้วย DISABLED_MODULES — ถ้าปิดอยู่ก็ข้ามทั้งชุด ไม่ใช่แดงทั้งแผง
{
  const probe = await call('/onboarding-program/bootstrap', { user: A });
  if (probe.status === 404) {
    console.log('\nข้าม — โมดูลปฐมนิเทศยังปิดอยู่ (รัน API ด้วย DISABLED_MODULES= เพื่อทดสอบ)');
    process.exit(report());
  }
}

const boot = () => call('/onboarding-program/bootstrap', { user: A });
/** ล้างร่องรอยของบัญชีหนึ่งให้เริ่มใหม่เหมือนพนักงานที่เพิ่งเข้าวันแรก */
const wipe = async (id) => {
  for (const t of ['ob_progress', 'ob_doc_submissions', 'ob_enrollments']) {
    await query(`delete from ${t} where profile_id = $1`, [id]);
  }
};
await wipe(A.id);

let b = await boot();
const documents = b.data.documents;
const dept = b.data.departments[0];
const dept2 = b.data.departments[1];
const [p1, p2, p3] = dept.phases;
const jr = (blk) => blk.items.filter((i) => i.level === 'junior');
/** ติ๊กทุกข้อของเฟสหนึ่งที่ระดับนี้ต้องทำ */
const finishPhase = async (phase, track = 'junior') => {
  for (const blk of phase.blocks) {
    for (const it of blk.items) {
      if (it.level === 'junior' || track === 'senior') {
        await call(`/onboarding-program/progress/${it.id}`, { method: 'PUT', user: A, body: { done: true } });
      }
    }
  }
};

// ───────────────────────────────────────────────────────────────────────────
// 1. ประตูกั้นเอกสารก่อนเลือกแผนก
//
// promptRequiredDocsIncomplete ของเขาไม่ได้แค่ปฏิเสธการกด — มันบอกด้วยว่าขาด
// ฉบับไหน แล้วมีปุ่มพาไปหน้าเอกสาร การปฏิเสธเงียบ ๆ คือทางตัน
// ───────────────────────────────────────────────────────────────────────────
suite('1. ประตูกั้นเอกสาร — บอกว่าขาดฉบับไหน');
{
  happy('ยังไม่ส่งอะไร → เอกสารยังไม่ครบ', b.data.status.docsComplete === false, '');
  happy('รายชื่อที่ขาดครบทุกฉบับ ไม่ใช่แค่จำนวน',
    (b.data.status.missingDocuments || []).length === documents.length,
    `${(b.data.status.missingDocuments || []).length}/${documents.length}`);
  happy('ทุก id ที่บอกว่าขาด มีอยู่ในทะเบียนเอกสารจริง',
    (b.data.status.missingDocuments || []).every((id) => documents.some((d) => d.id === id)), '');

  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept.slug } });
  b = await boot();
  bad('เลือกแผนกไว้แล้วก็ยังติ๊กอะไรไม่ได้ ถ้าเอกสารยังไม่ครบ',
    b.data.status.unlocked[p1.id] === false, '');
  happy('เหตุผลที่ล็อกคือ "เอกสาร" ไม่ใช่ "เฟสก่อนหน้า"',
    b.data.status.lockReason[p1.id] === 'documents', String(b.data.status.lockReason[p1.id]));
  const t = await call(`/onboarding-program/progress/${jr(p1.blocks[0])[0].id}`,
    { method: 'PUT', user: A, body: { done: true } });
  bad('เซิร์ฟเวอร์ปฏิเสธการติ๊ก ไม่ใช่ปิดแค่ที่ปุ่ม', t.status === 409, `${t.status}`);
  happy('ข้อความบอกให้ไปส่งเอกสารก่อน', /ส่งเอกสารให้ครบ/.test(String(t.error || '')), String(t.error || ''));

  // ส่งไปทีละฉบับ แล้วประตูต้องเปิด "ตอนฉบับสุดท้าย" ไม่ใช่ก่อนหน้านั้น
  for (let i = 0; i < documents.length; i += 1) {
    const r = await call(`/onboarding-program/documents/${documents[i].id}`, { method: 'POST', user: A, body: {} });
    const last = i === documents.length - 1;
    if (!last && i === documents.length - 2) {
      bad('เหลืออีกฉบับเดียว ประตูยังปิดอยู่', r.data.docsComplete === false, '');
      happy('และบอกว่าเหลือฉบับเดียว', (r.data.missingDocuments || []).length === 1,
        `${(r.data.missingDocuments || []).length}`);
    }
    if (last) {
      happy('ส่งฉบับสุดท้ายแล้วเอกสารครบ', r.data.docsComplete === true, '');
      happy('เฟสแรกปลดล็อกทันทีในคำตอบเดียวกัน', r.data.unlocked[p1.id] === true, '');
      bad('ไม่มีรายชื่อที่ขาดเหลืออยู่', (r.data.missingDocuments || []).length === 0, '');
    }
  }
  const missingDoc = await call('/onboarding-program/documents/no-such-doc', { method: 'POST', user: A, body: {} });
  bad('ส่งเอกสารที่ไม่มีในทะเบียน → 404', missingDoc.status === 404, `${missingDoc.status}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 2. อัปโหลดเอกสารจริง
//
// ของเขาตรวจสกุลไฟล์ (ไม่ใช่ MIME) และขนาด 10MB ที่ฝั่งเซิร์ฟเวอร์ พร้อมเหตุผล:
// accept ของ input เป็นแค่ตัวกรองในกล่องเลือกไฟล์ และ MIME ที่เบราว์เซอร์ส่งมา
// ปลอมได้เท่ากัน อัปใหม่ต้อง "แทน" ของเดิม ไม่ใช่กองซ้อนกันจนไม่รู้ว่าอันไหนจริง
// ───────────────────────────────────────────────────────────────────────────
suite('2. อัปโหลดเอกสาร');
{
  const doc = documents[0];
  const path = `/onboarding-program/documents/${doc.id}/file`;
  const rows = async () => (await query(
    'select file_name, storage_key, content_type from ob_doc_submissions where profile_id = $1 and doc_id = $2',
    [A.id, doc.id])).rows;

  const okUp = await upload(path, A, 'สำเนาบัตรประชาชน.pdf', Buffer.from('%PDF-1.4 ทดสอบ'), 'application/pdf');
  happy('อัปไฟล์ PDF ได้', okUp.status === 200, `${okUp.status}`);
  happy('ชื่อไฟล์ภาษาไทยไม่กลายเป็นตัวประหลาด', okUp.data?.fileName === 'สำเนาบัตรประชาชน.pdf', String(okUp.data?.fileName));
  happy('ใบเสร็จอยู่ในสถานะที่หน้าจอใช้แสดง', okUp.data?.status?.uploads?.[doc.id]?.fileName === 'สำเนาบัตรประชาชน.pdf',
    JSON.stringify(okUp.data?.status?.uploads?.[doc.id] || {}));
  const first = (await rows())[0];

  const badExt = await upload(path, A, 'ไวรัส.exe', Buffer.from('MZ'), 'application/pdf');
  bad('สกุลไฟล์ที่ไม่รองรับ → ปฏิเสธ ถึงจะแอบส่ง MIME เป็น pdf', badExt.status === 400, `${badExt.status}`);
  happy('บอกว่ารับสกุลไหน', /PDF|Word/.test(String(badExt.error || '')), String(badExt.error || ''));
  const noExt = await upload(path, A, 'ไม่มีนามสกุล', Buffer.from('x'), 'application/pdf');
  bad('ไฟล์ที่ไม่มีนามสกุลเลย → ปฏิเสธ', noExt.status === 400, `${noExt.status}`);

  const empty = await upload(path, A, 'ว่าง.pdf', Buffer.alloc(0), 'application/pdf');
  bad('ไฟล์ว่าง → ปฏิเสธ', empty.status === 400, `${empty.status}`);
  happy('ข้อความบอกให้เลือกไฟล์อื่น', /ว่างเปล่า/.test(String(empty.error || '')), String(empty.error || ''));

  const big = await upload(path, A, 'สแกนใหญ่.pdf', Buffer.alloc(11 * 1024 * 1024, 1), 'application/pdf');
  bad('ไฟล์ใหญ่เกิน 10MB → ปฏิเสธ', big.status === 413, `${big.status}`);
  happy('บอกว่าใหญ่เกินกำหนด ไม่ใช่ "ลองใหม่อีกครั้ง"',
    /ขนาดใหญ่เกินกำหนด/.test(String(big.error || '')), String(big.error || ''));
  happy('ที่ใหญ่เกินไม่ได้ทับไฟล์ที่อัปไว้ก่อน', (await rows())[0]?.storage_key === first.storage_key, '');

  // อัปซ้ำด้วยสกุลอื่น: ต้องเหลือแถวเดียวและไฟล์เดิมต้องถูกลบ ไม่ใช่ค้างสองไฟล์
  const again = await upload(path, A, 'ใหม่กว่า.png', Buffer.from('\x89PNG ทดสอบ'), 'image/png');
  happy('อัปซ้ำได้', again.status === 200, `${again.status}`);
  const after = await rows();
  happy('เหลือใบเสร็จแถวเดียวต่อเอกสารหนึ่งฉบับ', after.length === 1, `${after.length}`);
  happy('ชื่อไฟล์เปลี่ยนเป็นของใหม่', after[0].file_name === 'ใหม่กว่า.png', String(after[0].file_name));
  bad('ที่เก็บไม่เหลือไฟล์เดิมค้างอยู่สองใบ', after[0].storage_key !== first.storage_key,
    `${first.storage_key} → ${after[0].storage_key}`);

  const dl = await call(`/onboarding-program/documents/${doc.id}/file`, { user: A, raw: true });
  happy('เปิดดูไฟล์ที่ตัวเองอัปไว้ได้', dl.status === 200, `${dl.status}`);
  const other = await call(`/onboarding-program/documents/${doc.id}/file?profile=${A.id}`, { user: H, raw: true });
  bad('ใส่ id ของคนอื่นใน URL ไม่ใช่การอนุญาต', other.status === 404, `${other.status}`);

  const del = await call(`/onboarding-program/documents/${doc.id}`, { method: 'DELETE', user: A });
  happy('ลบการส่งได้', del.status === 200, `${del.status}`);
  bad('ลบแล้วเอกสารกลับเป็นยังไม่ครบ', del.data.docsComplete === false, '');
  happy('และเฟสแรกล็อกกลับด้วยเหตุผลเอกสาร', del.data.lockReason[p1.id] === 'documents', String(del.data.lockReason[p1.id]));
  happy('ไม่มีใบเสร็จค้างในฐาน', (await rows()).length === 0, '');
  bad('ไฟล์ที่ดาวน์โหลดไม่ได้อีก',
    (await call(`/onboarding-program/documents/${doc.id}/file`, { user: A, raw: true })).status === 404, '');

  // ส่งกลับให้ครบเพื่อเดินเรื่องต่อ
  await call(`/onboarding-program/documents/${doc.id}`, { method: 'POST', user: A, body: { note: 'ส่งที่ฝ่ายบุคคล' } });
  b = await boot();
  happy('ติ๊กมือแทนการอัปไฟล์ก็นับว่าส่งแล้ว', b.data.status.docsComplete === true, '');
}

// ───────────────────────────────────────────────────────────────────────────
// 3. เลือกแผนกและระดับพนักงาน
// ───────────────────────────────────────────────────────────────────────────
suite('3. เลือกแผนกและระดับพนักงาน');
{
  const pick = await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept.slug } });
  happy('เลือกแผนกได้', pick.status === 200 && pick.data.department === dept.slug, String(pick.data?.department));
  happy('ระดับตั้งต้นเป็นพนักงานระดับต้น', pick.data.track === 'junior', String(pick.data.track));
  happy('ได้สามเฟสของแผนกนั้น', pick.data.phases.length === 3, `${pick.data.phases.length}`);

  const jrTotals = pick.data.phases.map((x) => x.total);
  const sr = await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'senior' } });
  happy('สลับเป็นระดับอาวุโสแล้วงานเพิ่มขึ้น',
    sr.data.phases.every((x, i) => x.total >= jrTotals[i]) && sr.data.phases.some((x, i) => x.total > jrTotals[i]),
    `${jrTotals.join('/')} → ${sr.data.phases.map((x) => x.total).join('/')}`);
  const back = await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'junior' } });
  happy('สลับกลับแล้วตัวหารกลับเท่าเดิม', back.data.phases.map((x) => x.total).join('/') === jrTotals.join('/'), '');

  bad('แผนกที่ไม่มีในทะเบียน → ปฏิเสธ',
    (await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: 'ไม่มีแผนกนี้' } })).status === 400, '');
  bad('ระดับที่ไม่มีในระบบ → ปฏิเสธ',
    (await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'หัวหน้า' } })).status === 400, '');
  happy('ส่งมาทั้งสองช่องพร้อมกันได้',
    (await call('/onboarding-program/me', { method: 'PUT', user: A,
      body: { department: dept.slug, track: 'junior' } })).status === 200, '');
}

// ───────────────────────────────────────────────────────────────────────────
// 4. ติ๊กข้อ ยกเลิกติ๊ก และเปอร์เซ็นต์ต่อบล็อก / ต่อเฟส
//
// แถบความคืบหน้าของเขานับสองระดับ: ต่อบล็อก (isPageBlockComplete) และต่อเฟส
// (isPagePhaseComplete) ตัวหารต้องเป็น "ข้อที่ระดับนี้มองเห็น" ไม่ใช่ทุกข้อ
// ───────────────────────────────────────────────────────────────────────────
suite('4. ติ๊กข้อและเปอร์เซ็นต์');
{
  const blk = p1.blocks[0];
  const items = jr(blk);
  const first = items[0];

  const on = await call(`/onboarding-program/progress/${first.id}`, { method: 'PUT', user: A, body: { done: true } });
  happy('ติ๊กได้', on.status === 200 && on.data.done.includes(first.id), `${on.status}`);
  happy('เฟสนับเพิ่มหนึ่งข้อ', on.data.phases[0].done === 1, `${on.data.phases[0].done}`);
  bad('ยังไม่ครบเฟส', on.data.phases[0].complete === false, '');

  const twice = await call(`/onboarding-program/progress/${first.id}`, { method: 'PUT', user: A, body: { done: true } });
  happy('ติ๊กซ้ำไม่ทำให้นับสองครั้ง', twice.data.done.filter((x) => x === first.id).length === 1
    && twice.data.phases[0].done === 1, `${twice.data.phases[0].done}`);

  const off = await call(`/onboarding-program/progress/${first.id}`, { method: 'PUT', user: A, body: { done: false } });
  bad('ยกเลิกติ๊กได้', off.status === 200 && !off.data.done.includes(first.id), `${off.status}`);
  happy('ตัวนับลดลงตาม', off.data.phases[0].done === 0, `${off.data.phases[0].done}`);
  const offAgain = await call(`/onboarding-program/progress/${first.id}`, { method: 'PUT', user: A, body: { done: false } });
  happy('ยกเลิกติ๊กของที่ไม่ได้ติ๊ก ก็ไม่ล้ม', offAgain.status === 200, `${offAgain.status}`);

  // ครบบล็อกแรก แต่เฟสยังไม่ครบ — เปอร์เซ็นต์สองระดับต้องแยกกันจริง
  for (const it of items) await call(`/onboarding-program/progress/${it.id}`, { method: 'PUT', user: A, body: { done: true } });
  const st = (await boot()).data.status;
  const doneSet = new Set(st.done);
  happy('บล็อกแรกครบทุกข้อ', items.every((i) => doneSet.has(i.id)), '');
  bad('แต่เฟสยังไม่ครบ (ยังมีอีกสองบล็อก)', st.phases[0].complete === false,
    `${st.phases[0].done}/${st.phases[0].total}`);
  happy('ตัวหารของเฟสนับแต่ข้อที่ระดับต้นมองเห็น',
    st.phases[0].total === p1.blocks.reduce((a, x) => a + jr(x).length, 0), `${st.phases[0].total}`);
  bad('ข้อระดับอาวุโสไม่ถูกนับรวมให้พนักงานระดับต้น',
    st.phases[0].total < p1.blocks.reduce((a, x) => a + x.items.length, 0),
    `${st.phases[0].total} / ทั้งหมด ${p1.blocks.reduce((a, x) => a + x.items.length, 0)}`);

  const ghost = await call('/onboarding-program/progress/ไม่มีข้อนี้', { method: 'PUT', user: A, body: { done: true } });
  bad('ติ๊กข้อที่ไม่มีอยู่ → 404', ghost.status === 404, `${ghost.status}`);

  // ข้อของแผนกอื่นไม่ใช่ของคนนี้ — และเหตุผลต้องบอกให้ตรง ไม่ใช่ชี้ไปที่เฟสก่อนหน้า
  // ซึ่งทำแล้วก็ไม่ช่วย (ของเขาลบความคืบหน้าตอนสลับแผนก จึงไม่มีกรณีนี้เลย)
  const foreign = dept2.phases[0].blocks[0].items[0];
  const fr = await call(`/onboarding-program/progress/${foreign.id}`, { method: 'PUT', user: A, body: { done: true } });
  bad('ติ๊กข้อของแผนกอื่น → ปฏิเสธ', fr.status === 409, `${fr.status}`);
  happy('เหตุผลบอกว่าไม่ใช่แผนกของตัวเอง',
    /ไม่อยู่ในแผนกที่คุณเลือกไว้/.test(String(fr.error || '')), String(fr.error || ''));
}

// ───────────────────────────────────────────────────────────────────────────
// 5. ปลดล็อกเฟสถัดไปเป็นลูกโซ่
// ───────────────────────────────────────────────────────────────────────────
suite('5. ปลดล็อกเฟสถัดไป');
{
  let st = (await boot()).data.status;
  bad('เฟสสองยังล็อกอยู่', st.unlocked[p2.id] === false, '');
  happy('เพราะเฟสก่อนหน้ายังไม่ครบ', st.lockReason[p2.id] === 'previous-phase', String(st.lockReason[p2.id]));
  const jump = await call(`/onboarding-program/progress/${jr(p2.blocks[0])[0].id}`,
    { method: 'PUT', user: A, body: { done: true } });
  bad('ข้ามไปติ๊กเฟสสองไม่ได้', jump.status === 409, `${jump.status}`);
  bad('และเฟสสามยิ่งล็อก', st.unlocked[p3.id] === false, '');

  await finishPhase(p1);
  st = (await boot()).data.status;
  happy('ทำเฟสหนึ่งครบ → เฟสสองปลดล็อก', st.unlocked[p2.id] === true, '');
  happy('เฟสหนึ่งขึ้นว่าครบ', st.phases[0].complete === true, `${st.phases[0].done}/${st.phases[0].total}`);
  bad('แต่เฟสสามยังล็อก ปลดทีละขั้น ไม่ใช่เปิดหมด', st.unlocked[p3.id] === false, '');
  happy('ติ๊กเฟสสองได้แล้ว',
    (await call(`/onboarding-program/progress/${jr(p2.blocks[0])[0].id}`,
      { method: 'PUT', user: A, body: { done: true } })).status === 200, '');

  await finishPhase(p2);
  st = (await boot()).data.status;
  happy('ทำเฟสสองครบ → เฟสสามปลดล็อก', st.unlocked[p3.id] === true, '');
  bad('ยังไม่จบหลักสูตร', st.allComplete === false, '');

  // ย้อนกลับไปยกเลิกติ๊กของเฟสหนึ่ง เฟสถัดไปต้องล็อกกลับ ไม่ใช่ค้างเปิดไว้
  const one = jr(p1.blocks[0])[0];
  await call(`/onboarding-program/progress/${one.id}`, { method: 'PUT', user: A, body: { done: false } });
  st = (await boot()).data.status;
  bad('ยกเลิกติ๊กย้อนหลัง → เฟสถัดไปล็อกกลับ', st.unlocked[p2.id] === false && st.unlocked[p3.id] === false, '');
  await call(`/onboarding-program/progress/${one.id}`, { method: 'PUT', user: A, body: { done: true } });
}

// ───────────────────────────────────────────────────────────────────────────
// 6. จบหลักสูตร และหน้าจบ
// ───────────────────────────────────────────────────────────────────────────
suite('6. หน้าสำเร็จการปฐมนิเทศ');
{
  const page = await call('/onboarding-program/pages/completion', { user: A });
  happy('มีหน้าจบในทะเบียนเนื้อหา', page.status === 200, `${page.status}`);
  happy('มีชุด section สำรองสำหรับคนที่ยังไม่ครบ',
    (page.data?.notCompleteSections || []).length > 0, `${(page.data?.notCompleteSections || []).length}`);
  happy('และชุดหลักสำหรับคนที่ครบแล้ว', (page.data?.sections || []).length > 0, `${(page.data?.sections || []).length}`);

  await finishPhase(p3);
  const st = (await boot()).data.status;
  happy('ทำครบทั้งสามเฟส → จบหลักสูตร', st.allComplete === true, '');
  happy('ทุกเฟสขึ้นว่าครบ', st.phases.every((x) => x.complete), JSON.stringify(st.phases.map((x) => `${x.done}/${x.total}`)));
  happy('เปอร์เซ็นต์รวมเป็นร้อย',
    Math.round((st.phases.reduce((a, x) => a + x.done, 0) / st.phases.reduce((a, x) => a + x.total, 0)) * 100) === 100, '');

  // สลับเป็นอาวุโสหลังจบ: งานเพิ่ม จบจึงต้องกลับเป็นยังไม่ครบ ไม่ใช่ค้างว่าจบแล้ว
  const sr = await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'senior' } });
  bad('สลับเป็นอาวุโสแล้วงานเพิ่ม → ยังไม่จบ', sr.data.allComplete === false, '');
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { track: 'junior' } });
}

// ───────────────────────────────────────────────────────────────────────────
// 7. สลับแผนก — ความคืบหน้าเดิมต้องไม่หาย (ข้อที่เราตั้งใจต่างจากเขา)
// ───────────────────────────────────────────────────────────────────────────
suite('7. สลับแผนกแล้วความคืบหน้าเดิมยังอยู่');
{
  const doneBefore = (await boot()).data.status.done.length;
  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept2.slug } });
  const mid = (await boot()).data.status;
  happy('ย้ายไปแผนกใหม่แล้วเริ่มนับจากศูนย์', mid.phases[0].done === 0, `${mid.phases[0].done}`);
  happy('แต่เครื่องหมายถูกของแผนกเดิมยังอยู่ในฐาน', mid.done.length === doneBefore, `${mid.done.length}/${doneBefore}`);
  happy('เฟสแรกของแผนกใหม่ปลดล็อกเลย (เอกสารครบอยู่แล้ว)', mid.unlocked[dept2.phases[0].id] === true, '');

  await call('/onboarding-program/me', { method: 'PUT', user: A, body: { department: dept.slug } });
  const back2 = (await boot()).data.status;
  happy('ย้ายกลับแล้วเจอของเดิมครบ ไม่ต้องทำใหม่', back2.allComplete === true, '');
}

// ───────────────────────────────────────────────────────────────────────────
// 8. หน้าผู้ดูแลแก้เช็กลิสต์
//
// ของเขากั้นด้วยรหัสผ่านร่วมที่ตรวจฝั่งเซิร์ฟเวอร์ทุกครั้ง (requireAdmin_) —
// ของเราใช้บัญชีเดียวกับทั้งระบบ แต่กฎเดียวกัน: ทุกทางที่เขียนข้อมูลต้องตรวจที่
// เซิร์ฟเวอร์ ไม่ใช่เชื่อว่าจอไม่ยอมให้กด
// ───────────────────────────────────────────────────────────────────────────
suite('8. จอผู้ดูแลแก้เช็กลิสต์');
{
  const blockId = p1.blocks[1].id;   // บล็อก "ความรู้ที่จำเป็น"
  for (const [label, path, opt] of [
    ['ดูรายการทั้งบล็อก', `/onboarding-program/items?blockId=${blockId}`, { user: H }],
    ['เพิ่มข้อใหม่', '/onboarding-program/items', { method: 'POST', user: H, body: { blockId, text: 'x' } }],
    ['แก้ข้อความ', `/onboarding-program/items/${jr(p1.blocks[1])[0].id}`, { method: 'PATCH', user: H, body: { text: 'x' } }],
    ['เลื่อนลำดับ', `/onboarding-program/items/${jr(p1.blocks[1])[0].id}/move`, { method: 'PUT', user: H, body: { direction: 'up' } }],
    ['ภาพรวมพนักงาน', '/onboarding-program/cohort', { user: H }],
  ]) {
    const r = await call(path, opt);
    bad(`คนที่ไม่ใช่ผู้ดูแล: ${label} → ปฏิเสธ`, r.status === 403, `${r.status}`);
  }

  const before = (await call(`/onboarding-program/items?blockId=${blockId}`, { user: A })).data;
  const add = await call('/onboarding-program/items', { method: 'POST', user: A,
    body: { blockId, text: 'ZZFLOW new checklist item', textTh: 'ZZFLOW ข้อที่ผู้ดูแลเพิ่ม', level: 'junior' } });
  happy('เพิ่มข้อใหม่ได้', add.status === 201, `${add.status}`);
  happy('ข้อใหม่ได้ id ที่ไม่เคยมีใครใช้', !before.some((x) => x.id === add.data.id), String(add.data.id));
  happy('ต่อท้ายบล็อก ไม่แทรกกลาง', Number(add.data.sort_order) > Math.max(...before.map((x) => Number(x.sort_order))), '');
  bad('เพิ่มข้อว่าง → ปฏิเสธ',
    (await call('/onboarding-program/items', { method: 'POST', user: A, body: { blockId, text: '  ' } })).status === 400, '');
  bad('เพิ่มเข้าบล็อกที่ไม่มีอยู่ → 404',
    (await call('/onboarding-program/items', { method: 'POST', user: A, body: { blockId: 999999, text: 'x' } })).status === 404, '');

  // ข้อใหม่ต้องโผล่บนจอพนักงานทันที และติ๊กได้
  const bootNow = await boot();
  const seen = bootNow.data.departments.find((d) => d.slug === dept.slug)
    .phases[0].blocks[1].items.some((x) => x.id === add.data.id);
  happy('ข้อใหม่ขึ้นบนจอพนักงานทันที', seen, '');
  const tickNew = await call(`/onboarding-program/progress/${add.data.id}`, { method: 'PUT', user: A, body: { done: true } });
  happy('พนักงานติ๊กข้อใหม่ได้', tickNew.status === 200, `${tickNew.status}`);
  bad('ข้อที่เพิ่มเข้ามาทำให้ "จบหลักสูตร" กลับเป็นยังไม่จบ', tickNew.data.allComplete === true, '');

  const ed = await call(`/onboarding-program/items/${add.data.id}`, { method: 'PATCH', user: A,
    body: { text: 'ZZFLOW edited', textTh: 'ZZFLOW แก้แล้ว', level: 'senior' } });
  happy('แก้ข้อความและระดับได้', ed.status === 200 && ed.data.text === 'ZZFLOW edited' && ed.data.level === 'senior', `${ed.status}`);
  const clearTh = await call(`/onboarding-program/items/${add.data.id}`, { method: 'PATCH', user: A, body: { textTh: '' } });
  happy('ล้างคำแปลไทยได้ (ต่างจากการไม่ส่งมาเลย)', clearTh.data.text_th === null, String(clearTh.data.text_th));
  const keepTh = await call(`/onboarding-program/items/${add.data.id}`, { method: 'PATCH', user: A, body: { level: 'junior' } });
  happy('ไม่ส่ง textTh มา = ไม่แตะคำแปล', keepTh.data.text_th === null && keepTh.data.level === 'junior', '');
  bad('แก้ข้อที่ไม่มีอยู่ → 404',
    (await call('/onboarding-program/items/ไม่มีข้อนี้', { method: 'PATCH', user: A, body: { text: 'x' } })).status === 404, '');

  // เรียงลำดับ: สลับกับเพื่อนบ้าน แล้วเครื่องหมายถูกต้องไม่ย้ายไปข้ออื่น
  const list = (await call(`/onboarding-program/items?blockId=${blockId}`, { user: A })).data;
  const last = list[list.length - 1]; const prev = list[list.length - 2];
  const mv = await call(`/onboarding-program/items/${last.id}/move`, { method: 'PUT', user: A, body: { direction: 'up' } });
  happy('เลื่อนขึ้นได้', mv.data?.moved === true, JSON.stringify(mv.data));
  const after = (await call(`/onboarding-program/items?blockId=${blockId}`, { user: A })).data;
  happy('สองข้อสุดท้ายสลับที่กันจริง',
    after[after.length - 1].id === prev.id && after[after.length - 2].id === last.id,
    `${after[after.length - 2].id} / ${after[after.length - 1].id}`);
  happy('เครื่องหมายถูกยังผูกกับ id เดิม ไม่ย้ายตามลำดับ',
    (await boot()).data.status.done.includes(add.data.id), '');
  const top = (await call(`/onboarding-program/items?blockId=${blockId}`, { user: A })).data[0];
  happy('เลื่อนข้อบนสุดขึ้นอีกไม่ได้ และไม่ล้ม',
    (await call(`/onboarding-program/items/${top.id}/move`, { method: 'PUT', user: A, body: { direction: 'up' } }))
      .data?.moved === false, '');

  // ปิดข้อ: หายจากจอพนักงาน แต่จอผู้ดูแลยังเห็น ไม่งั้นปิดแล้วเปิดกลับไม่ได้อีกเลย
  const off = await call(`/onboarding-program/items/${add.data.id}`, { method: 'PATCH', user: A, body: { isActive: false } });
  happy('ปิดข้อได้', off.status === 200 && off.data.is_active === false, `${off.status}`);
  const bootOff = await boot();
  bad('ข้อที่ปิดหายจากจอพนักงาน',
    !bootOff.data.departments.find((d) => d.slug === dept.slug).phases[0].blocks[1].items
      .some((x) => x.id === add.data.id), '');
  happy('แต่จอผู้ดูแลยังเห็น จึงเปิดกลับได้',
    (await call(`/onboarding-program/items?blockId=${blockId}`, { user: A })).data.some((x) => x.id === add.data.id), '');
  happy('ปิดข้อที่ยังไม่มีใครทำแล้ว "จบหลักสูตร" กลับมา', bootOff.data.status.allComplete === true, '');
  bad('เครื่องหมายถูกของข้อที่ปิดไม่ถูกลบทิ้ง (เปิดกลับต้องเจอของเดิม)',
    (await query('select count(*)::int c from ob_progress where profile_id = $1 and item_id = $2',
      [A.id, add.data.id])).rows[0].c === 1, '');

  // เก็บของ: ลบข้อที่ชุดนี้เพิ่มเข้าไป ไม่ทิ้งไว้ในเช็กลิสต์จริง
  await query('delete from ob_progress where item_id = $1', [add.data.id]);
  await query('delete from ob_items where id = $1', [add.data.id]);
  happy('ทะเบียนเช็กลิสต์กลับเป็น 180 ข้อเท่าเดิม',
    (await query('select count(*)::int c from ob_items')).rows[0].c === 180,
    String((await query('select count(*)::int c from ob_items')).rows[0].c));
}

// ───────────────────────────────────────────────────────────────────────────
// 9. ภาพรวมพนักงานของผู้ดูแล
// ───────────────────────────────────────────────────────────────────────────
suite('9. ภาพรวมพนักงาน');
{
  const c = await call('/onboarding-program/cohort', { user: A });
  happy('ผู้ดูแลเปิดได้', c.status === 200, `${c.status}`);
  const me = (c.data || []).find((r) => r.profileId === A.id);
  happy('เห็นคนที่อยู่ในโปรแกรมจริง', Boolean(me), `${(c.data || []).length} คน`);
  if (me) {
    happy('บอกแผนกที่เลือกไว้', me.department === dept.slug, String(me.department));
    happy('บอกว่าเอกสารครบแล้ว', me.docsComplete === true, String(me.docsComplete));
    happy('นับความคืบหน้าจากข้อที่ระดับของคนนั้นมองเห็น', me.total > 0 && me.done === me.total,
      `${me.done}/${me.total}`);
    happy('บอกว่าจบหลักสูตรแล้ว', me.allComplete === true, String(me.allComplete));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 10. หน้าเนื้อหาสิบหน้า — ลิงก์ต้องไปถึงที่ และรูปต้องโหลดขึ้นจริง
//
// เนื้อหามาจากฐานข้อมูล ลิงก์ที่ชี้ไปหน้าที่ไม่มีจึงเกิดขึ้นได้จริง และรูปของ
// ต้นฉบับเป็น data URI 7.3 MB ที่เราย้ายไปที่เก็บไฟล์ — ถ้าคีย์ใดหาย จอจะขึ้น
// กรอบเปล่าโดยไม่มีอะไรบอก
// ───────────────────────────────────────────────────────────────────────────
suite('10. หน้าเนื้อหาและรูปภาพ');
{
  const index = (await call('/onboarding-program/pages', { user: A })).data || [];
  happy('มีหน้าเนื้อหาครบสิบหน้า', index.length === 10, `${index.length}`);
  happy('ครบทั้งห้าหน้าแนะนำแผนก', index.filter((p) => p.kind === 'dept').length === 5,
    `${index.filter((p) => p.kind === 'dept').length}`);
  happy('มีหน้าแรก · หน้าเอกสาร · หน้าจบ',
    ['home', 'preboarding', 'completion'].every((k) => index.some((p) => p.kind === k)),
    index.map((p) => p.kind).join(','));
  happy('ทุกหน้ามีชื่อไทย', index.every((p) => String(p.title_th || '').trim()), '');

  // คีย์ที่เนื้อหาอ้างถึงต้องไปถึงที่: หน้าเนื้อหาอีกหน้า หรือเฟสของแผนกใด ๆ
  const pageKeys = new Set(index.map((p) => p.key));
  const phaseIds = new Set(b.data.departments.flatMap((d) => d.phases.map((p) => p.id)));
  const deptSlugs = new Set(b.data.departments.map((d) => d.slug));
  const dead = []; const imageKeys = new Set(); let sections = 0;

  for (const p of index) {
    const r = await call(`/onboarding-program/pages/${p.key}`, { user: A });
    if (r.status !== 200) { dead.push(`เปิดหน้า ${p.key} ไม่ได้ (${r.status})`); continue; }
    const all = [...(r.data.sections || []), ...(r.data.notCompleteSections || [])];
    sections += all.length;
    const json = JSON.stringify(all);
    for (const m of json.matchAll(/"(?:page|target|goto|pageKey|deptId)":"([^"]+)"/g)) {
      const v = m[1];
      if (pageKeys.has(v) || phaseIds.has(v) || deptSlugs.has(v)) continue;
      dead.push(`${p.key} → ${v}`);
    }
    for (const m of json.matchAll(/"(?:image|img|src|photo|imageKey|logo)":"([^"]+)"/g)) {
      if (!/^https?:|^data:/.test(m[1])) imageKeys.add(m[1]);
    }
  }
  happy('ทุกหน้าเปิดได้และมีเนื้อหา', sections > 0, `${sections} section`);
  bad('ไม่มีลิงก์ที่ชี้ไปที่ที่ไม่มีอยู่', dead.length === 0, dead.slice(0, 5).join(' · '));

  happy('เนื้อหาอ้างรูปไว้จริง', imageKeys.size > 0, `${imageKeys.size} ใบ`);
  const broken = [];
  for (const key of imageKeys) {
    const r = await call(`/onboarding-program/images/${encodeURIComponent(key)}`, { user: A, raw: true });
    if (r.status !== 200) broken.push(`${key} (${r.status})`);
  }
  bad('ทุกรูปที่เนื้อหาอ้างถึงโหลดขึ้นจริง', broken.length === 0, broken.slice(0, 5).join(' · '));

  bad('หน้าที่ไม่มีอยู่ → 404 ไม่ใช่หน้าว่าง',
    (await call('/onboarding-program/pages/ไม่มีหน้านี้', { user: A })).status === 404, '');
  bad('รูปที่ไม่มีอยู่ → 404', (await call('/onboarding-program/images/ไม่มีรูปนี้', { user: A })).status === 404, '');
  bad('เนื้อหาต้องล็อกอินก่อน',
    (await fetch(`${process.env.API || 'https://vcb-hr-api.onrender.com/api'}/onboarding-program/pages`)).status === 401, '');
}

// ───────────────────────────────────────────────────────────────────────────
suite('11. ไม่ทิ้งข้อมูลทดสอบไว้');
{
  await wipe(A.id);
  const left = (await query(
    `select (select count(*) from ob_progress where profile_id = $1)
          + (select count(*) from ob_doc_submissions where profile_id = $1)
          + (select count(*) from ob_enrollments where profile_id = $1)
          + (select count(*) from ob_items where id like 'custom-%' and text like 'ZZFLOW%') n`, [A.id])).rows[0].n;
  happy('ลบร่องรอยทดสอบหมดแล้ว', Number(left) === 0, `เหลือ ${left}`);
  happy('ข้อเช็กลิสต์จริงยังครบ 180 ข้อ',
    (await query('select count(*)::int c from ob_items')).rows[0].c === 180,
    String((await query('select count(*)::int c from ob_items')).rows[0].c));
}

process.exit(report(`${new URL('./.out/onboarding-flows.json', import.meta.url).pathname}`) ? 1 : 0);
