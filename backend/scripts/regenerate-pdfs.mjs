// One-off: (re)generate the letterhead PDF for documents.
// Usage:
//   node scripts/regenerate-pdfs.mjs            # only docs that have NO generated PDF
//   node scripts/regenerate-pdfs.mjs --all      # every document (refresh layout/logo)
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const all = process.argv.includes('--all');
const { query } = await import('../src/config/db.js');
const { generateOriginalPdf } = await import('../src/services/pdfDoc.js');

const sql = all
  ? `select id, doc_number from documents order by created_at`
  : `select d.id, d.doc_number from documents d
       where not exists (
         select 1 from document_attachments a
          where a.document_id = d.id and a.kind = 'generated_pdf'
       ) order by d.created_at`;

const { rows } = await query(sql);
console.log(`${rows.length} document(s) to process${all ? ' (--all)' : ' (missing PDF only)'}\n`);

let ok = 0, fail = 0;
for (const d of rows) {
  try {
    await generateOriginalPdf(d.id);
    ok++;
    console.log(`  ✅ ${d.doc_number}`);
  } catch (e) {
    fail++;
    console.log(`  ❌ ${d.doc_number} — ${e.message}`);
  }
}
console.log(`\nDone. ${ok} generated, ${fail} failed.`);
process.exit(0);
