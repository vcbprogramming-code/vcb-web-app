/**
 * รายงานการประชุม — the record, and what happens to it when someone edits it.
 *
 * Two things carry the weight here. The body is HTML written by one person and
 * read by everybody, so anything executable must be gone before it is stored.
 * And an edit must keep what was there before — WITH the title and date as they
 * stood at that moment, which is the exact bug the reference implementation
 * shipped and had to fix.
 */
import { fileURLToPath } from 'node:url';
import { call, suite, happy, bad, report, U, warm, query } from './harness.mjs';

const ROOT = fileURLToPath(new URL('./.out', import.meta.url));
await warm();
const { admin: A, hr: H, exec: C } = U;
const MARK = 'ZZTEST';
const made = [];

const group = (await query('select id, name from mtg_groups order by sort_order limit 1')).rows[0];
const add = async (user, body) => {
  const r = await call('/meetings', { method: 'POST', user, body: { groupId: group.id, ...body } });
  if (r.data?.id) made.push(r.data.id);
  return r;
};

// ── 1. สร้างและอ่าน ────────────────────────────────────────────────────────
suite('1. สร้างรายงานและอ่านกลับ');
let id = null;
{
  const b = await call('/meetings/bootstrap', { user: A });
  happy('เปิดโมดูลได้ และมีกลุ่มตั้งต้นให้แล้ว', b.status === 200 && b.data.groups.length >= 9, `${b.data?.groups?.length}`);
  // เดิมข้อนี้ยืนยันว่าทุกกลุ่มผูกกับโครงการใน E-Memo ซึ่งจริงเฉพาะช่วงที่กลุ่ม
  // ยังถูกหว่านมาจากตาราง projects (0045) ตอนนี้กลุ่มคือรายการโครงการของลูกค้า
  // ที่นำเข้ามาจริง (scripts/import-live-meetings.mjs) และมีกลุ่มที่ไม่ใช่ไซต์งาน
  // อยู่ด้วย — "งบการเงินทุกโครงการ", "Business Development", "ERP Implementation"
  // บังคับให้ผูกโครงการก็คือบังคับให้ผูกมั่ว แล้วขอบเขตการมองเห็นรายบุคคลจะตัด
  // กลุ่มตามโครงการที่ไม่เกี่ยวกัน สิ่งที่ต้องจริงคือทุกกลุ่มมีรหัสและชื่อของตัวเอง
  happy('ทุกกลุ่มมีรหัสและชื่อกำกับไว้',
    b.data.groups.every((g) => g.code && g.name),
    b.data.groups.filter((g) => !g.code || !g.name).map((g) => g.name || g.id).join(' / '));

  const r = await add(A, {
    title: `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1`,
    meetingDate: '2026-09-15', timeLabel: '09:00 – 11:00',
    content: '<p>วาระที่ 1 ความก้าวหน้างาน</p><ul><li>เสาเข็มเสร็จ 80%</li></ul>',
    attendees: ['ทนงศักดิ์', 'ชวิน'],
  });
  happy('สร้างรายงานได้', r.status === 201, `${r.status}`);
  id = r.data.id;

  const d = await call(`/meetings/${id}`, { user: A });
  happy('อ่านกลับได้ครบ', d.status === 200 && d.data.title.includes('ครั้งที่ 1'), '');
  happy('สรุปย่อดึงมาจากเนื้อความจริง', d.data.excerpt.includes('เสาเข็ม'), d.data.excerpt);
  happy('เก็บรายชื่อผู้เข้าประชุม', (d.data.attendees || []).length === 2, JSON.stringify(d.data.attendees));

  bad('ไม่ระบุชื่อเรื่อง → 400', (await add(A, { content: 'x' })).status === 400, '');
  bad('กลุ่มที่ไม่มีอยู่จริง → 400',
    (await call('/meetings', { method: 'POST', user: A, body: { groupId: '00000000-0000-0000-0000-000000000000', title: 'x' } })).status === 400, '');
  bad('ไอดีผิดรูปแบบ → 404 ไม่ใช่ 500', (await call('/meetings/not-a-uuid', { user: A })).status === 404, '');
}

// ── 2. เนื้อหาที่อันตรายต้องถูกตัด ─────────────────────────────────────────
suite('2. เนื้อหาที่รันสคริปต์ได้ต้องไม่ถูกเก็บ');
{
  const r = await add(A, {
    title: `${MARK} เนื้อหาอันตราย`,
    content: `<p>ปกติ</p><script>alert(1)</script><img src=x onerror=alert(1)>
      <a href="javascript:alert(1)">กด</a><style>body{display:none}</style>
      <table><tr><td colspan="2">ตารางต้องอยู่</td></tr></table>`,
  });
  const d = await call(`/meetings/${r.data.id}`, { user: A });
  const html = d.data.content;
  bad('ไม่มีแท็ก script หลงเหลือ', !/<script/i.test(html), html.slice(0, 80));
  bad('ไม่มีตัวจัดการเหตุการณ์ onerror', !/onerror/i.test(html), '');
  bad('ไม่มีลิงก์ javascript:', !/javascript:/i.test(html), '');
  bad('ไม่มีแท็ก style', !/<style/i.test(html), '');
  happy('ตารางยังอยู่ครบ', /<table/.test(html) && /colspan="2"/.test(html), '');
  happy('ข้อความปกติยังอยู่', html.includes('ปกติ'), '');
}

// ── 3. แก้ไขแล้วต้องเก็บของเดิม ────────────────────────────────────────────
suite('3. แก้ไขแล้วเก็บฉบับเดิมไว้ พร้อมชื่อเรื่อง ณ ขณะนั้น');
{
  const first = await call(`/meetings/${id}`, { user: A });
  happy('ยังไม่เคยแก้ จึงยังไม่มีประวัติ', (first.data.versions || []).length === 0, '');

  await call(`/meetings/${id}`, { method: 'PATCH', user: A,
    body: { content: '<p>วาระที่ 1 แก้ไขแล้ว</p>', title: `${MARK} ประชุมความก้าวหน้า ครั้งที่ 1 (แก้ชื่อ)` } });
  const after = await call(`/meetings/${id}`, { user: A });
  happy('เนื้อหาใหม่ถูกบันทึก', after.data.content.includes('แก้ไขแล้ว'), '');
  happy('มีประวัติ 1 เวอร์ชัน', (after.data.versions || []).length === 1, '');

  const v = await call(`/meetings/${id}/versions/1`, { user: A });
  happy('เวอร์ชันเก่าเก็บเนื้อหาเดิมไว้', v.data.content.includes('เสาเข็ม'), '');
  // the bug the reference implementation shipped: renaming rewrote its own past
  happy('เวอร์ชันเก่าเก็บชื่อเรื่อง ณ ขณะนั้น ไม่ใช่ชื่อใหม่',
    v.data.title.includes('ครั้งที่ 1') && !v.data.title.includes('แก้ชื่อ'), v.data.title);

  await call(`/meetings/${id}`, { method: 'PATCH', user: A, body: { content: '<p>แก้รอบสอง</p>' } });
  const third = await call(`/meetings/${id}`, { user: A });
  happy('แก้อีกครั้งได้ประวัติเพิ่มเป็น 2', (third.data.versions || []).length === 2, '');
  bad('เวอร์ชันที่ไม่มีอยู่ → 404', (await call(`/meetings/${id}/versions/99`, { user: A })).status === 404, '');

  // Renaming alone must also snapshot, or the NEXT content edit would file the
  // new name against the old words — the same trap, one step removed.
  const beforeRename = (await call(`/meetings/${id}`, { user: A })).data;
  await call(`/meetings/${id}`, { method: 'PATCH', user: A, body: { title: `${MARK} ชื่อที่สาม` } });
  const afterRename = await call(`/meetings/${id}`, { user: A });
  happy('เปลี่ยนแค่ชื่อเรื่องก็เก็บเวอร์ชันไว้ด้วย',
    (afterRename.data.versions || []).length === (beforeRename.versions || []).length + 1,
    `${(afterRename.data.versions || []).length}`);
  const latest = afterRename.data.versions[0];
  const vv = await call(`/meetings/${id}/versions/${latest.seq}`, { user: A });
  bad('เวอร์ชันนั้นเก็บชื่อก่อนเปลี่ยน ไม่ใช่ชื่อใหม่', !vv.data.title.includes('ชื่อที่สาม'), vv.data.title);

  // no real change, nothing to record
  const n1 = (await call(`/meetings/${id}`, { user: A })).data.versions.length;
  await call(`/meetings/${id}`, { method: 'PATCH', user: A, body: { title: `${MARK} ชื่อที่สาม` } });
  const n2 = (await call(`/meetings/${id}`, { user: A })).data.versions.length;
  bad('บันทึกทั้งที่ไม่ได้แก้อะไร ไม่สร้างเวอร์ชันเปล่า', n1 === n2, `${n1} → ${n2}`);
}

// ── 4. สิทธิ์ ──────────────────────────────────────────────────────────────
suite('4. ใครทำอะไรได้');
{
  const b = await call('/meetings/bootstrap', { user: H });
  happy('ฝ่ายบุคคลดูและแก้ไขได้', b.data.canEdit === true, String(b.data?.canEdit));
  bad('แต่จัดการกลุ่มไม่ได้', b.data.canManage === false, String(b.data?.canManage));
  bad('ผู้บริหารสร้างรายงานไม่ได้', (await add(C, { title: 'x' })).status === 403, '');
  happy('ผู้บริหารยังอ่านได้', (await call(`/meetings/${id}`, { user: C })).status === 200, '');
  bad('ผู้บริหารเพิ่มกลุ่มไม่ได้',
    (await call('/meetings/groups/new', { method: 'POST', user: C, body: { name: 'x' } })).status === 403, '');
  bad('ไม่ล็อกอินเปิดไม่ได้', (await call('/meetings/bootstrap', { user: null })).status === 401, '');
}

// ── 5. ฉบับร่างและการค้นหา ─────────────────────────────────────────────────
suite('5. ฉบับร่างและการค้นหาทั้งเนื้อความ');
{
  const draft = await add(A, { title: `${MARK} ฉบับร่างของผู้ดูแล`, visible: false, content: '<p>ยังไม่เผยแพร่</p>' });
  const asHr = await call('/meetings', { user: H });
  bad('คนอื่นไม่เห็นฉบับร่างในรายการ', !(asHr.data || []).some((x) => x.id === draft.data.id), '');
  bad('และเปิดตรง ๆ ก็ไม่ได้', (await call(`/meetings/${draft.data.id}`, { user: H })).status === 403, '');
  happy('เจ้าของยังเห็นฉบับร่างของตัวเอง',
    ((await call('/meetings', { user: A })).data || []).some((x) => x.id === draft.data.id), '');

  await add(A, { title: `${MARK} ประชุมอื่น`, content: '<p>มติให้จัดซื้อปูนเพิ่ม 200 ถุง</p>' });
  const hit = await call('/meetings?q=' + encodeURIComponent('ปูนเพิ่ม'), { user: A });
  happy('ค้นหาเจอจากข้อความในเนื้อรายงาน', (hit.data || []).length >= 1, `${(hit.data || []).length}`);
  const none = await call('/meetings?q=' + encodeURIComponent('ไม่มีคำนี้แน่นอนจริง ๆ'), { user: A });
  happy('คำที่ไม่มีจริงได้ผลลัพธ์ว่าง', (none.data || []).length === 0, '');
}

// ── 6. ความเห็นและปักหมุด ──────────────────────────────────────────────────
suite('6. ความเห็นและการปักหมุด');
{
  const c = await call(`/meetings/${id}/comments`, { method: 'POST', user: H, body: { body: `${MARK} เห็นด้วยครับ` } });
  happy('ผู้ที่อ่านได้ แสดงความเห็นได้', c.status === 201, `${c.status}`);
  bad('ความเห็นว่างเปล่าไม่ได้',
    (await call(`/meetings/${id}/comments`, { method: 'POST', user: H, body: { body: '  ' } })).status === 400, '');
  bad('ลบความเห็นของคนอื่นไม่ได้',
    (await call(`/meetings/${id}/comments/${c.data.id}`, { method: 'DELETE', user: C })).status === 403, '');
  happy('เจ้าของลบความเห็นตัวเองได้',
    (await call(`/meetings/${id}/comments/${c.data.id}`, { method: 'DELETE', user: H })).status === 200, '');

  const p = await call(`/meetings/${id}/pin`, { method: 'POST', user: A });
  happy('ปักหมุดได้', p.status === 200 && p.data.pinned === true, '');
  const list = await call('/meetings', { user: A });
  happy('รายงานที่ปักหมุดขึ้นมาอยู่บนสุด', (list.data || [])[0]?.id === id, (list.data || [])[0]?.title);
  await call(`/meetings/${id}/pin`, { method: 'POST', user: A });
}

// ── 7. กลุ่ม ───────────────────────────────────────────────────────────────
suite('7. จัดการกลุ่มการประชุม');
{
  const g = await call('/meetings/groups/new', { method: 'POST', user: A,
    body: { name: `${MARK} ฝ่ายบริหาร`, cadence: 'ทุกเดือน' } });
  happy('เพิ่มกลุ่มที่ไม่ใช่โครงการได้', g.status === 201, `${g.status}`);
  const gid = g.data?.id;
  happy('แก้ชื่อกลุ่มได้',
    (await call(`/meetings/groups/${gid}`, { method: 'PATCH', user: A, body: { name: `${MARK} ฝ่ายบริหารระดับสูง` } })).status === 200, '');

  const m = await call('/meetings', { method: 'POST', user: A, body: { groupId: gid, title: `${MARK} ในกลุ่มใหม่` } });
  made.push(m.data.id);
  bad('ลบกลุ่มที่ยังมีรายงานอยู่ไม่ได้',
    (await call(`/meetings/groups/${gid}`, { method: 'DELETE', user: A })).status === 409, '');
  await call(`/meetings/${m.data.id}`, { method: 'DELETE', user: A });
  happy('ลบกลุ่มที่ว่างแล้วได้',
    (await call(`/meetings/groups/${gid}`, { method: 'DELETE', user: A })).status === 200, '');
}

// ── 9. กล่องรอจัดเก็บและการจัดเก็บเข้ากลุ่ม ────────────────────────────────
suite('9. กล่องรอจัดเก็บ และการจัดเก็บเข้ากลุ่ม');
{
  const b = await call('/meetings/bootstrap', { user: A });
  const inboxes = b.data.groups.filter((g) => g.is_inbox);
  const dest = b.data.groups.find((g) => !g.is_inbox);
  const dest2 = b.data.groups.filter((g) => !g.is_inbox)[1];
  happy('มีกล่องรอจัดเก็บสองกล่อง', inboxes.length === 2, inboxes.map((g) => g.name).join(' · '));

  const rec = await call('/meetings', { method: 'POST', user: A, body: {
    groupId: inboxes[0].id, title: `${MARK} บันทึกเสียงรอจัดเก็บ`,
    recordingUrl: 'https://fathom.video/share/abc', content: '<p>สรุปย่อจากที่ประชุม</p>' } });
  made.push(rec.data.id);
  const r0 = await call(`/meetings/${rec.data.id}`, { user: A });
  bad('บันทึกที่เพิ่งเข้ากล่อง ยังไม่เผยแพร่', r0.data.visible === false, String(r0.data.visible));
  // the detail has to say it is an inbox row, or the screen cannot explain that
  // filing adds a place rather than moving it
  happy('หน้ารายละเอียดรู้ว่าอยู่ในกล่องรอจัดเก็บ', r0.data.is_inbox === true, String(r0.data.is_inbox));
  happy('เก็บลิงก์ไฟล์บันทึกเสียงไว้', r0.data.recording_url.includes('fathom.video'), r0.data.recording_url);

  bad('ลิงก์ที่ไม่ใช่ http(s) ไม่ถูกเก็บ', (await (async () => {
    const x = await call('/meetings', { method: 'POST', user: A, body: {
      groupId: inboxes[0].id, title: `${MARK} ลิงก์อันตราย`, recordingUrl: 'javascript:alert(1)' } });
    made.push(x.data.id);
    return (await call(`/meetings/${x.data.id}`, { user: A })).data.recording_url === '';
  })()), '');

  const t = await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: dest.id } });
  happy('จัดเก็บเข้ากลุ่มได้', t.status === 201 && t.data.length === 1, `${t.status}`);
  const t2 = await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: dest2.id } });
  happy('จัดเก็บเข้าได้มากกว่าหนึ่งกลุ่ม', t2.data.length === 2, `${t2.data?.length}`);

  const inDest = await call(`/meetings?groupId=${dest.id}`, { user: A });
  happy('เห็นในกลุ่มปลายทาง', (inDest.data || []).some((x) => x.id === rec.data.id), '');
  const inInbox = await call(`/meetings?groupId=${inboxes[0].id}`, { user: A });
  happy('และยังอยู่ในกล่องเดิม ไม่ถูกย้ายออก', (inInbox.data || []).some((x) => x.id === rec.data.id), '');

  bad('จัดเก็บซ้ำกลุ่มเดิมไม่เพิ่มรายการ',
    (await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: dest.id } })).data.length === 2, '');
  bad('จัดเก็บเข้ากล่องรอจัดเก็บด้วยกันไม่ได้',
    (await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: inboxes[1].id } })).status === 400, '');
  bad('จัดเก็บเข้ากลุ่มที่ไม่มีอยู่จริงไม่ได้',
    (await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: '00000000-0000-0000-0000-000000000000' } })).status === 400, '');
  bad('ผู้บริหารจัดเก็บไม่ได้',
    (await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: C, body: { groupId: dest.id } })).status === 403, '');

  const u = await call(`/meetings/${rec.data.id}/tags/${dest.id}`, { method: 'DELETE', user: A });
  happy('เอาออกจากกลุ่มเดียวได้', u.status === 200 && u.data.length === 1, `${u.data?.length}`);
  happy('กลุ่มอื่นที่จัดเก็บไว้ยังอยู่', u.data[0]?.id === dest2.id, '');
  const stillInbox = await call(`/meetings?groupId=${inboxes[0].id}`, { user: A });
  happy('เอาป้ายออกแล้วยังอยู่ในกล่องเหมือนเดิม', (stillInbox.data || []).some((x) => x.id === rec.data.id), '');
  bad('เอาออกจากกลุ่มที่ไม่ได้จัดเก็บไว้ → 404',
    (await call(`/meetings/${rec.data.id}/tags/${dest.id}`, { method: 'DELETE', user: A })).status === 404, '');
}

// ── 10. วันที่ที่คนพิมพ์เอง ────────────────────────────────────────────────
// ระบบจริงของลูกค้าไม่มีช่อง type="date" ช่องวันที่เป็นข้อความอิสระและเซิร์ฟเวอร์
// แปลงให้ (parseDateLabel_) เพราะแต่ละคนเขียนวันที่ไม่เหมือนกัน
suite('10. รับวันที่เป็นข้อความอิสระ แล้วแปลงเป็นวันที่จริง');
{
  const cases = [
    ['21/05/2569', '2026-05-21', 'วัน/เดือน/ปี พ.ศ.'],
    ['21 พ.ค. 69', '2026-05-21', 'เดือนไทยย่อ ปีสองหลัก'],
    ['21 May 2569', '2026-05-21', 'เดือนอังกฤษ ปี พ.ศ.'],
    ['2026-05-21', '2026-05-21', 'รูปแบบเดิม yyyy-mm-dd ต้องยังใช้ได้'],
    ['2569-05-21', '2026-05-21', 'ISO ที่ปีเป็น พ.ศ.'],
    ['21/05/2569 10:00น', '2026-05-21', 'มีเวลาติดมาด้วย ต้องไม่ถูกอ่านเป็นวันที่'],
  ];
  for (const [typed, want, why] of cases) {
    const r = await add(A, { title: `${MARK} วันที่ ${typed}`, meetingDate: typed });
    const d = await call(`/meetings/${r.data.id}`, { user: A });
    happy(`${why} → ${want}`, String(d.data.meeting_date || '').slice(0, 10) === want,
      `${typed} → ${String(d.data.meeting_date).slice(0, 10)}`);
  }
  // ข้อความที่พิมพ์เก็บไว้ตามที่พิมพ์ แต่ ISO ล้วนไม่ต้องเก็บ เพราะแสดงกลับเป็น
  // วันที่แบบไทยได้สวยกว่าตัวเลขที่เครื่องเป็นคนเขียน
  const thai = await add(A, { title: `${MARK} เก็บข้อความวันที่`, meetingDate: '21/05/2569' });
  const td = await call(`/meetings/${thai.data.id}`, { user: A });
  happy('เก็บข้อความวันที่ตามที่ผู้ใช้พิมพ์', td.data.date_label === '21/05/2569', td.data.date_label);
  const iso = await add(A, { title: `${MARK} ไม่เก็บ ISO ล้วน`, meetingDate: '2026-05-21' });
  const idd = await call(`/meetings/${iso.data.id}`, { user: A });
  bad('ISO ล้วนไม่ถูกเก็บเป็นข้อความวันที่', idd.data.date_label === '', `"${idd.data.date_label}"`);

  const junk = await add(A, { title: `${MARK} วันที่อ่านไม่ออก`, meetingDate: 'ประชุมครั้งที่ 12' });
  const jd = await call(`/meetings/${junk.data.id}`, { user: A });
  bad('ข้อความที่ไม่ใช่วันที่ ไม่กลายเป็นวันที่มั่ว', jd.data.meeting_date === null, String(jd.data.meeting_date));
  happy('แต่ยังเก็บสิ่งที่พิมพ์ไว้ให้แสดงได้', jd.data.date_label === 'ประชุมครั้งที่ 12', jd.data.date_label);

  // แก้ไขโดยส่งข้อความเดิมกลับมา ต้องไม่นับเป็นการเปลี่ยนแปลง ไม่อย่างนั้นเวอร์ชัน
  // เปล่างอกขึ้นทุกครั้งที่กดบันทึก
  await call(`/meetings/${thai.data.id}`, { method: 'PATCH', user: A, body: { content: '<p>ก</p>' } });
  const n1 = (await call(`/meetings/${thai.data.id}`, { user: A })).data.versions.length;
  await call(`/meetings/${thai.data.id}`, { method: 'PATCH', user: A, body: { meetingDate: '21/05/2569' } });
  const n2 = (await call(`/meetings/${thai.data.id}`, { user: A })).data.versions.length;
  bad('ส่งวันที่เดิมกลับมาไม่สร้างเวอร์ชันเปล่า', n1 === n2, `${n1} → ${n2}`);
}

// ── 11. ภาพรวมโครงการ และการย้ายโครงการ ───────────────────────────────────
suite('11. แถวภาพรวมอยู่ท้ายรายการ และย้ายโครงการตอนแก้ไขได้');
{
  const b = await call('/meetings/bootstrap', { user: A });
  const g1 = b.data.groups.filter((g) => !g.is_inbox)[0];
  const g2 = b.data.groups.filter((g) => !g.is_inbox)[1];

  const ov = await call('/meetings', { method: 'POST', user: A, body: {
    groupId: g1.id, kind: 'overview', title: `${MARK} ภาพรวมโครงการ` } });
  made.push(ov.data.id);
  await call('/meetings', { method: 'POST', user: A, body: {
    groupId: g1.id, title: `${MARK} ประชุมไม่มีวันที่` } }).then((r) => made.push(r.data.id));
  const list = await call(`/meetings?groupId=${g1.id}`, { user: A });
  const rows = list.data || [];
  const iOv = rows.findIndex((r) => r.id === ov.data.id);
  happy('แถวภาพรวมถูกส่งมาพร้อมชนิด', rows[iOv]?.kind === 'overview', rows[iOv]?.kind);
  happy('แถวภาพรวมอยู่ท้ายรายการเสมอ แม้แถวอื่นก็ไม่มีวันที่',
    iOv === rows.length - 1, `${iOv + 1}/${rows.length}`);

  // ของเขาย้ายโครงการได้ ของเราเคยล็อกไว้ ทางออกเดียวคือลบแล้วพิมพ์ใหม่ทั้งฉบับ
  const mv = await call(`/meetings/${ov.data.id}`, { method: 'PATCH', user: A, body: { groupId: g2.id } });
  happy('ย้ายโครงการตอนแก้ไขได้', mv.status === 200 && mv.data.group_id === g2.id, `${mv.status}`);
  const after = await call(`/meetings/${ov.data.id}`, { user: A });
  happy('ย้ายแล้วอยู่ในโครงการใหม่จริง', after.data.group_id === g2.id, '');
  happy('การย้ายถูกบันทึกลงประวัติการทำงาน',
    (after.data.audit || []).some((a) => a.action === 'move'),
    (after.data.audit || []).map((a) => a.action).join(','));
  bad('ย้ายไปกลุ่มที่ไม่มีอยู่จริง → 400',
    (await call(`/meetings/${ov.data.id}`, { method: 'PATCH', user: A,
      body: { groupId: '00000000-0000-0000-0000-000000000000' } })).status === 400, '');
}

// ── 12. ประวัติการทำงาน ───────────────────────────────────────────────────
suite('12. สิ่งที่เกิดกับเอกสารโดยไม่แก้เนื้อหา ต้องมีร่องรอย');
{
  const r = await add(A, { title: `${MARK} รอยประวัติ`, content: '<p>ก</p>' });
  const mid = r.data.id;
  await call(`/meetings/${mid}/pin`, { method: 'POST', user: A });
  await call(`/meetings/${mid}/pin`, { method: 'POST', user: A });
  await call(`/meetings/${mid}`, { method: 'PATCH', user: A, body: { visible: false } });
  const b = await call('/meetings/bootstrap', { user: A });
  const dest = b.data.groups.filter((g) => !g.is_inbox).find((g) => g.id !== group.id);
  await call(`/meetings/${mid}/tags`, { method: 'POST', user: A, body: { groupId: dest.id } });
  await call(`/meetings/${mid}/tags/${dest.id}`, { method: 'DELETE', user: A });

  const d = await call(`/meetings/${mid}`, { user: A });
  const acts = (d.data.audit || []).map((a) => a.action);
  happy('ปักหมุดและเอาหมุดออกมีร่องรอยทั้งคู่',
    acts.includes('pin') && acts.includes('unpin'), acts.join(','));
  happy('การเก็บเป็นฉบับร่างมีร่องรอย', acts.includes('unpublish'), acts.join(','));
  happy('การจัดเก็บและเอาออกจากโครงการมีร่องรอย',
    acts.includes('tag') && acts.includes('untag'), acts.join(','));
  happy('ร่องรอยบอกว่าใครทำ', (d.data.audit || []).every((a) => a.actor_name), '');
  happy('ร่องรอยเรียงตามเวลาจากเก่าไปใหม่',
    (d.data.audit || []).every((a, i, arr) => i === 0 || new Date(arr[i - 1].created_at) <= new Date(a.created_at)), '');
  happy('ร่องรอยการจัดเก็บบอกชื่อโครงการปลายทาง',
    (d.data.audit || []).some((a) => a.action === 'tag' && a.details?.group === dest.name),
    JSON.stringify((d.data.audit || []).find((a) => a.action === 'tag')?.details));
}

// ── 13. "ทุกการประชุม" กับกล่องรอจัดเก็บ ──────────────────────────────────
suite('13. กล่องรอจัดเก็บเป็นคิว ไม่ใช่ส่วนหนึ่งของ "ทุกการประชุม"');
{
  const b = await call('/meetings/bootstrap', { user: A });
  const inbox = b.data.groups.find((g) => g.is_inbox);
  const dest = b.data.groups.find((g) => !g.is_inbox);
  const rec = await call('/meetings', { method: 'POST', user: A, body: {
    groupId: inbox.id, title: `${MARK} บันทึกเสียงยังไม่จัดเก็บ`, visible: true } });
  made.push(rec.data.id);

  const all = await call('/meetings', { user: A });
  bad('บันทึกที่ยังไม่จัดเก็บไม่โผล่ในทุกการประชุม',
    !(all.data || []).some((x) => x.id === rec.data.id), '');
  happy('แต่ยังเห็นได้ในกล่องของมันเอง',
    ((await call(`/meetings?groupId=${inbox.id}`, { user: A })).data || []).some((x) => x.id === rec.data.id), '');

  // จัดเก็บแล้วต้องหาเจอในรายการรวม — การจัดเก็บคือการเพิ่มที่ให้หาเจอ ถ้ายังหาย
  // อยู่ก็เท่ากับจัดเก็บไปแล้วไม่มีผล
  await call(`/meetings/${rec.data.id}/tags`, { method: 'POST', user: A, body: { groupId: dest.id } });
  const all2 = await call('/meetings', { user: A });
  happy('จัดเก็บแล้วโผล่ในทุกการประชุม', (all2.data || []).some((x) => x.id === rec.data.id), '');

  happy('จำนวนของแถว "ทุกการประชุม" เท่ากับจำนวนแถวที่รายการแสดงจริง',
    b2AllTotal(await call('/meetings/bootstrap', { user: A })) === (all2.data || []).length,
    `${b2AllTotal(await call('/meetings/bootstrap', { user: A }))} vs ${(all2.data || []).length}`);
}
function b2AllTotal(b) { return b.data?.allTotal; }

// ── เก็บกวาด ───────────────────────────────────────────────────────────────
await query('delete from mtg_meetings where title like $1', [`%${MARK}%`]);
await query('delete from mtg_groups where name like $1', [`%${MARK}%`]);
const left = await query(
  `select (select count(*) from mtg_meetings where title like $1)::int m,
          (select count(*) from mtg_groups where name like $1)::int g`, [`%${MARK}%`]);
suite('8. ไม่ทิ้งข้อมูลทดสอบไว้');
happy('ลบรายงานและกลุ่มทดสอบหมดแล้ว',
  left.rows[0].m === 0 && left.rows[0].g === 0, JSON.stringify(left.rows[0]));

process.exit(report(`${ROOT}/meetings.json`) ? 1 : 0);
