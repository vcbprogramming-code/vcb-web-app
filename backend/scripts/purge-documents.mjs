// DANGER: deletes ALL E-Memo documents (and their S3 files) to start fresh.
// Child rows (attachments, approval_steps, audit_log) cascade via FK.
// Running numbers reset automatically (they're max(run_no)+1 per project).
// Usage: node scripts/purge-documents.mjs --yes
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

if (!process.argv.includes('--yes')) {
  console.error('Refusing to run without --yes (this deletes ALL documents).');
  process.exit(1);
}

const { query } = await import('../src/config/db.js');
const { deleteObject } = await import('../src/config/storage.js');

// 1. collect every S3 key referenced by attachments
const { rows: atts } = await query(`select storage_key from document_attachments where storage_key is not null`);
console.log(`Deleting ${atts.length} storage object(s)…`);
let s3ok = 0, s3fail = 0;
for (const a of atts) {
  try { await deleteObject(a.storage_key); s3ok++; } catch { s3fail++; }
}
console.log(`  storage: ${s3ok} deleted, ${s3fail} failed/skipped`);

// 2. delete all documents — child tables cascade
const { rows: cntBefore } = await query(`select count(*)::int as n from documents`);
await query(`delete from documents`);
const { rows: cntAfter } = await query(`select count(*)::int as n from documents`);
console.log(`Documents: ${cntBefore[0].n} -> ${cntAfter[0].n}`);

// 3. sanity: child tables should be empty too
for (const t of ['document_attachments', 'approval_steps']) {
  const { rows } = await query(`select count(*)::int as n from ${t}`);
  console.log(`  ${t}: ${rows[0].n} remaining`);
}
console.log('\nDone. Running numbers will restart at 001 per project.');
process.exit(0);
