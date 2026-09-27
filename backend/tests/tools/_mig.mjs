/** ดูว่ามีไฟล์ migration ใดถูกรันกับฐานข้อมูลจริงไปแล้ว และไฟล์ถูกแก้หลังรันหรือไม่ */
import fs from 'node:fs'; import path from 'node:path'; import pg from 'pg'; import 'dotenv/config';
const dir = path.resolve('../supabase/migrations');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const rows = (await db.query('select filename, applied_at from schema_migrations order by filename desc limit 12')).rows;
for (const r of rows.reverse()) {
  const p = path.join(dir, r.filename);
  const st = fs.existsSync(p) ? fs.statSync(p) : null;
  const late = st && st.mtime > new Date(r.applied_at);
  console.log(r.filename, '| รันเมื่อ', new Date(r.applied_at).toLocaleString('th-TH'), late ? '⚠ ไฟล์ถูกแก้หลังรัน (ต้องทำไฟล์ใหม่)' : '');
}
await db.end();
