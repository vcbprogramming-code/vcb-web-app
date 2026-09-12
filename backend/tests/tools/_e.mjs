import { query } from '../harness.mjs';
for (const t of ['employees', 'leave_requests']) {
  const c = await query(`select column_name from information_schema.columns where table_name=$1 order by ordinal_position`, [t]);
  console.log(t + ':', c.rows.map(r=>r.column_name).join(', '));
}
process.exit(0);
