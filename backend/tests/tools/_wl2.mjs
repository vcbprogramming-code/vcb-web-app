import { U, call, query } from '../harness.mjs';
const A = U.admin;
for (const path of ['/performance/export/activities.xlsx', '/performance/export/cost-categories.xlsx']) {
  const r = await call(path, { user: A, raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(path.padEnd(42), r.status, buf.length, 'ไบต์', buf.subarray(0,2).toString() === 'PK' ? '✅ เป็นไฟล์ xlsx' : '❌');
}
const u = (await query(`select code from units where code is not null limit 1`)).rows[0];
const p2 = (n) => String(n).padStart(2,'0'); const d = new Date();
const ym = `${d.getFullYear()}-${p2(d.getMonth()+1)}`;
const r = await call(`/performance/export/entries.xlsx?site=${encodeURIComponent(u.code)}&month=${ym}`, { user: A, raw: true });
const b = Buffer.from(await r.arrayBuffer());
console.log('export/entries.xlsx'.padEnd(42), r.status, b.length, 'ไบต์', b.subarray(0,2).toString()==='PK' ? '✅' : '❌');
process.exit(0);
