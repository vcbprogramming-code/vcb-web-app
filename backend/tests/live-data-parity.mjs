/**
 * ข้อมูลจริงของลูกค้าที่นำเข้ามาต้องยังอยู่ครบและเท่าเดิม
 *
 * 27 ก.ย. 2569 เรานำข้อมูลจากระบบที่ลูกค้าใช้อยู่เข้าฐานของเรา แล้ววันเดียวกัน
 * นั้นเองชุดทดสอบเก่าสามไฟล์ (ที่เลือกโครงการด้วย "แถวแรกในตาราง") ก็ไปลบงบ
 * ประมาณจริงของโครงการบางเตยทิ้งหนึ่งแถว — ชุดนี้จึงมีไว้เฝ้าตัวเลขชุดนั้น
 * โดยเฉพาะ อ่านอย่างเดียว ไม่สร้างไม่ลบอะไรเลย
 *
 * ตัวเลขอ้างอิงมาจากจอของลูกค้าเองในวันนำเข้า ถ้าวันหลังลูกค้าแก้ข้อมูลในระบบ
 * เขาแล้วเรา sync ใหม่ ให้แก้ตัวเลขในไฟล์นี้พร้อมกัน และบันทึกว่าแก้เพราะอะไร
 */
import { suite, happy, report, warm, query } from './harness.mjs';

await warm();

/**
 * จำนวนแถวที่ต้องมีเท่าระบบของลูกค้า
 *
 * ทุกคำสั่งนับ "เฉพาะแถวที่นำเข้ามาจากระบบเขา" ไม่ใช่ทั้งตาราง เพราะชุดทดสอบอื่น
 * สร้างข้อมูลของตัวเองตลอดเวลา (ZZ*) ถ้านับทั้งตารางชุดนี้จะแดงทุกครั้งที่มีคน
 * รันเทสต์คู่ขนาน ซึ่งทำให้สัญญาณที่เราอยากได้จริง ๆ (ข้อมูลลูกค้าหาย) จมหายไป
 */
const COUNTS = [
  ['วงเงินสินเชื่อของลูกค้า', `select count(*)::int c from facilities f
       join projects p on p.id = f.project_id where p.code <> 'kda'`, 48],
  ['รายการสินเชื่อที่นำเข้า (มี source_id)', 'select count(*)::int c from credit_ledger where source_id is not null', 66],
  ['งบประมาณต่อหมวด', `select count(*)::int c from credit_category_caps cc
       join projects p on p.id = cc.project_id where p.code <> 'kda'`, 2],
  ['หมวดค่าใช้จ่ายที่เปิดใช้งาน', 'select count(*)::int c from credit_cost_categories where is_active', 18],
  ['การประชุม', "select count(*)::int c from mtg_meetings where meeting_key is not null", 82],
  ['ป้ายการประชุมข้ามโครงการ', 'select count(*)::int c from mtg_meeting_tags', 59],
  ['พนักงานที่นำเข้า', 'select count(*)::int c from employees where live_eid is not null', 325],
  ['หน่วยงานจริงที่ยังเปิดอยู่', `select count(*)::int c from units
       where is_active and code in ('BPW','BTBP','BWA','DRV','HQ','PTM','S5','SPB')`, 8],
  ['บันทึกงานของพนักงานที่นำเข้า', `select count(*)::int c from work_logs w
       join employees e on e.id = w.employee_id
      where w.deleted_at is null and e.live_eid is not null`, 21348],
  ['คำขอลาที่นำเข้า', 'select count(*)::int c from leave_requests where source_id is not null', 14],
  ['กรณีเฉพาะ SOP', 'select count(*)::int c from sop_scenarios', 33],
  ['ผังกระบวนการ SOP', 'select count(*)::int c from sop_flows', 33],
  ['ผังที่มีคำบรรยายขั้นตอน', 'select count(*)::int c from sop_flows where array_length(narrative,1) > 0', 33],
  ['วิธีเรียก Report', 'select count(*)::int c from sop_reports', 24],
  ['เอกสารแนบของกรณีเฉพาะ', 'select count(*)::int c from sop_scenario_attachments', 34],
  ['ข้อเช็กลิสต์ปฐมนิเทศ', 'select count(*)::int c from ob_items', 180],
  ['กล่องงานในผังระบบ', 'select count(*)::int c from sysmap_nodes', 79],
  ['ฟังก์ชันในทะเบียน', 'select count(*)::int c from sysmap_functions', 158],
  ['ทะเบียนวันเกิดบนพอร์ทัล', 'select count(*)::int c from portal_birthdays', 35],
];

suite('1. จำนวนข้อมูลจริงยังเท่าระบบของลูกค้า');
for (const [name, sql, want] of COUNTS) {
  const got = (await query(sql)).rows[0].c;
  happy(`${name} = ${want}`, Number(got) === want, `ได้ ${got}`);
}

suite('2. บันทึกงานครบทั้งสามเดือนที่เขามี');
{
  const rows = (await query(
    `select to_char(w.ymd, 'YYYY-MM') m, count(*)::int c
       from work_logs w join employees e on e.id = w.employee_id
      where w.deleted_at is null and e.live_eid is not null
      group by 1 order by 1`)).rows;
  const by = Object.fromEntries(rows.map((r) => [r.m, r.c]));
  for (const [m, want] of [['2026-06', 7028], ['2026-07', 7307], ['2026-08', 7013]]) {
    happy(`${m} = ${want} ช่อง`, by[m] === want, `ได้ ${by[m] ?? 0}`);
  }
  happy('ไม่มีเดือนอื่นปนเข้ามาในข้อมูลที่นำเข้า', rows.length === 3, rows.map((r) => r.m).join(', '));
}

suite('3. ยอดเงินรวมยังตรงกับจอของลูกค้า');
{
  // ยอดวงเงินรวมและยอดใช้ไปตั้งต้น — สองค่านี้คือฐานของตัวเลขทุกใบบนแดชบอร์ด
  // วงเงินรายโครงการ — ตัวเลขชุดนี้คือฐานของทุกใบบนแดชบอร์ด ถ้าใครลบหรือทับ
  // แถวใดแถวหนึ่ง ยอดของโครงการนั้นจะเพี้ยนทันที
  const want = { BT1: 456784674, BV: 448875558, CVE: 130000000, VK2: 429712000, LPB: 0, PN4: 0, 'V&K': 0 };
  const rows = (await query(
    `select p.code, count(*)::int n, sum(f."limit")::numeric l
       from facilities f join projects p on p.id = f.project_id
      where p.code <> 'kda' group by p.code`)).rows;
  const by = Object.fromEntries(rows.map((r) => [r.code, r]));
  for (const [code, sum] of Object.entries(want)) {
    happy(`วงเงินรวมของ ${code} = ${sum.toLocaleString('en-US')}`,
      Number(by[code]?.l ?? -1) === sum, `${by[code]?.n ?? 0} ก้อน · ${by[code]?.l ?? '—'}`);
  }
  const led = (await query('select count(*)::int c, sum(amount)::numeric s from credit_ledger where source_id is not null')).rows[0];
  happy('รายการสินเชื่อที่นำเข้ายังครบ 66 แถว', led.c === 66, String(led.c));
}

suite('4. กลุ่มการประชุมเป็นชุดของลูกค้า');
{
  const g = (await query('select code, name from mtg_groups order by sort_order, code')).rows;
  const codes = g.map((r) => r.code);
  for (const c of ['FIN', 'BT12', 'BV', 'PN34', 'ERP', 'BD']) {
    happy(`มีกลุ่ม ${c}`, codes.includes(c), codes.join(','));
  }
  happy('ไม่มีกลุ่มทดสอบ test หลงเหลือ', !codes.includes('kda') && !g.some((r) => r.name === 'test'), codes.join(','));
  const per = (await query(
    `select g.code, count(distinct m.id)::int c
       from mtg_groups g
       left join mtg_meetings m on m.group_id = g.id
       left join mtg_meeting_tags t on t.group_id = g.id
      group by g.code`)).rows;
  const own = Object.fromEntries(per.map((r) => [r.code, r.c]));
  happy('งบการเงินทุกโครงการมีบันทึกของตัวเอง', (own.FIN || 0) > 0, JSON.stringify(own));
}

process.exit(report() ? 1 : 0);
