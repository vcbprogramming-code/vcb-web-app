/**
 * Demo data for the HR Work Log acceptance walkthrough.
 *
 *   node scripts/demo-worklog.mjs load      สร้างข้อมูลตัวอย่าง
 *   node scripts/demo-worklog.mjs remove    ลบออกให้หมด
 *
 * Everything lives under one site whose name says it is sample data, so nobody
 * mistakes it for a real project and one command takes it all away again.
 */
import { query, pool } from '../src/config/db.js';

const SITE_CODE = 'DEMO';
const SITE_NAME = 'โครงการสาธิต (ข้อมูลตัวอย่าง)';
const PEOPLE = [
  ['สมชาย ใจดี', 'ทีม ก'], ['ประยงค์ ศรีทอง', 'ทีม ก'], ['วิรัตน์ แก้วมณี', 'ทีม ก'],
  ['อนันต์ พรมมา', 'ทีม ก'], ['สุชาติ บุญมี', 'ทีม ข'], ['ธนากร ทองดี', 'ทีม ข'],
  ['ณรงค์ สุขสม', 'ทีม ข'], ['พิชัย มั่นคง', 'ทีม ข'], ['สมพร เจริญ', 'ทีม ค'],
  ['กิตติ วงศ์ใหญ่', 'ทีม ค'], ['อรทัย ดวงแก้ว', 'ทีม ค'], ['มานพ ชูชื่น', 'ทีม ค'],
];
const WORK = ['งานคอนกรีต', 'งานเหล็ก', 'งานปรับพื้นที่ / ดินถม', 'งานระบบไฟฟ้า', 'งานสำรวจ / วางแนว'];
const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function load() {
  const unit = (await query(
    `insert into units (name, code, lock_days, company) values ($1,$2,3,'วิจิตรภัณฑ์ก่อสร้าง')
     on conflict (code) do update set name = excluded.name, lock_days = 3 returning *`,
    [SITE_NAME, SITE_CODE])).rows[0];

  // §2 the registers the walkthrough shows: departments with positions under them
  for (const [dept, roles] of [
    ['ฝ่ายวิศวกรรม', ['วิศวกรสนาม', 'โฟร์แมน']],
    ['ฝ่ายจัดซื้อ', ['เจ้าหน้าที่จัดซื้อ']],
    ['ฝ่ายความปลอดภัย', ['จป. วิชาชีพ']],
  ]) {
    const d = (await query(
      `insert into departments (unit_id, name) values ($1,$2)
       on conflict (unit_id, name) do update set is_active = true returning id`, [unit.id, dept])).rows[0];
    for (const role of roles) {
      await query(`insert into positions (department_id, name) values ($1,$2)
                   on conflict (department_id, name) do update set is_active = true`, [d.id, role]);
    }
  }

  for (const name of ['ทีม ก', 'ทีม ข', 'ทีม ค']) {
    await query(`insert into teams (unit_id, name) values ($1,$2) on conflict (unit_id, name) do nothing`, [unit.id, name]);
  }

  const emps = [];
  for (const [i, [name, team]] of PEOPLE.entries()) {
    const code = `DM-${String(i + 1).padStart(3, '0')}`;
    const row = (await query(
      `insert into employees (unit_id, full_name, employee_code, kind, team, is_active)
       values ($1,$2,$3,$4,$5,true)
       on conflict (employee_code) do update set unit_id = excluded.unit_id, full_name = excluded.full_name,
         team = excluded.team, is_active = true returning *`,
      [unit.id, name, code, i < 8 ? 'operation' : 'support', team])).rows[0];
    emps.push(row);
  }

  // three weeks of days, weekdays only, with the odd absence so the coverage
  // view and the status breakdown have something real to show
  const today = new Date();
  let written = 0;
  for (let back = 20; back >= 0; back -= 1) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    if (d.getDay() === 0) continue;
    const day = ds(d);
    for (const [i, e] of emps.entries()) {
      const roll = (i * 7 + back * 3) % 20;
      let manDay = 1; let status = 'ปกติ';
      if (roll === 0) { manDay = null; status = null; }          // not recorded
      else if (roll === 1) { manDay = 0; status = 'ขาดงาน'; }
      else if (roll === 2) { manDay = 1; status = 'ล่วงเวลา'; }
      else if (roll === 3) { manDay = 0.5; status = 'Standby'; }
      if (manDay === null) continue;
      const log = (await query(
        `insert into work_logs (employee_id, unit_id, ymd, kind, team, man_day, hours, work_status, detail, status, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'',null)
         on conflict (employee_id, ymd) do update set man_day = excluded.man_day, hours = excluded.hours,
           work_status = excluded.work_status, team = excluded.team, detail = excluded.detail, deleted_at = null
         returning id`,
        [e.id, unit.id, day, e.kind, e.team, manDay, manDay * 8, status, WORK[(i + back) % WORK.length]])).rows[0];
      await query('delete from work_log_lines where work_log_id = $1', [log.id]);
      if (manDay > 0) {
        await query(
          `insert into work_log_lines (work_log_id, work_type_name, man_day, hours, work_status)
           values ($1,$2,$3,$4,$5)`,
          [log.id, WORK[(i + back) % WORK.length], manDay, manDay * 8, status]);
      }
      written += 1;
    }
  }

  // a few trail entries so the audit panel shows the shape of a real one during
  // the walkthrough, rather than an empty box that reads as a broken feature
  const actor = (await query("select id, full_name from profiles where role = 'admin' order by created_at limit 1")).rows[0];
  const sample = emps.slice(0, 3);
  for (const [i, e] of sample.entries()) {
    const day = ds(new Date(today.getTime() - (i + 1) * 86400000));
    const log = (await query('select id from work_logs where employee_id = $1 and ymd = $2', [e.id, day])).rows[0];
    await query(
      `insert into work_log_audit (work_log_id, employee_id, unit_id, ymd, action, before_val, after_val, reason, actor_id, actor_label)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [log?.id || null, e.id, unit.id, day, i === 2 ? 'verify' : (i === 1 ? 'edit' : 'create'),
       i === 1 ? JSON.stringify({ manDay: 0.5, workStatus: 'Standby' }) : null,
       JSON.stringify({ manDay: 1, workStatus: 'ปกติ' }),
       i === 1 ? 'แก้ตามที่หน้างานแจ้งกลับมา' : null,
       actor?.id || null, actor?.full_name || 'ผู้ดูแลระบบ']);
  }

  const leaveFrom = ds(new Date(today.getTime() + 2 * 86400000));
  await query(
    `insert into leave_requests (employee_id, unit_id, leave_type, from_date, to_date, reason, requested_by, day_part, days, status)
     select $1,$2,'sick',$3,$3,'ตัวอย่างคำขอลา',null,'full',1,'pending'
     where not exists (select 1 from leave_requests where employee_id = $1 and from_date = $3)`,
    [emps[0].id, unit.id, leaveFrom]);

  console.log(`สร้างข้อมูลตัวอย่างแล้ว: ไซต์ "${SITE_NAME}" · พนักงาน ${emps.length} คน · บันทึกงาน ${written} รายการ · คำขอลา 1 รายการ`);
  console.log('ลบออกได้ด้วย:  node scripts/demo-worklog.mjs remove');
}

async function remove() {
  const unit = (await query('select id from units where code = $1', [SITE_CODE])).rows[0];
  if (!unit) { console.log('ไม่พบข้อมูลตัวอย่าง'); return; }
  await query('delete from work_log_attachments where unit_id = $1', [unit.id]);
  await query('delete from work_log_lines where work_log_id in (select id from work_logs where unit_id = $1)', [unit.id]);
  await query('delete from work_logs where unit_id = $1', [unit.id]);
  await query('delete from work_log_audit where unit_id = $1', [unit.id]);
  await query('delete from period_closes where unit_id = $1', [unit.id]);
  await query('delete from employee_away where employee_id in (select id from employees where unit_id = $1)', [unit.id]);
  await query('delete from leave_requests where unit_id = $1', [unit.id]);
  await query('delete from leave_approvers where employee_id in (select id from employees where unit_id = $1)', [unit.id]);
  await query('update employees set department_id = null, position_id = null where unit_id = $1', [unit.id]);
  await query('delete from positions where department_id in (select id from departments where unit_id = $1)', [unit.id]);
  await query('delete from departments where unit_id = $1', [unit.id]);
  await query('delete from teams where unit_id = $1', [unit.id]);
  await query('delete from employees where unit_id = $1', [unit.id]);
  await query('delete from profile_units where unit_id = $1', [unit.id]);
  await query('delete from units where id = $1', [unit.id]);
  console.log('ลบข้อมูลตัวอย่างออกหมดแล้ว');
}

const cmd = process.argv[2];
if (cmd === 'load') await load();
else if (cmd === 'remove') await remove();
else console.log('ใช้: node scripts/demo-worklog.mjs load | remove');
await pool.end();
