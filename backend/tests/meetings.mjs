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
  // the two inboxes are queues, not projects, so they carry no project link
  happy('กลุ่มตั้งต้นผูกกับโครงการที่มีอยู่',
    b.data.groups.filter((g) => !g.is_inbox).every((g) => g.project_id), '');

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
