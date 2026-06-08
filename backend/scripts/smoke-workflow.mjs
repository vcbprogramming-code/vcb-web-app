// E2E smoke for E-Memo on MongoDB: create + PDF gen + GridFS upload/download +
// approval chain via token links + one-time-token reuse guard.
//
// Requires the backend running on :4000 and an admin seeded:
//   npm run seed && npm run create-admin admin@vcb.local Admin@2048
// Reads approval tokens directly via Mongoose (the API hides them by design).
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const BASE = process.env.SMOKE_BASE || 'http://localhost:4000/api';
const ADMIN = { email: 'admin@vcb.local', password: 'Admin@2048' };

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

await mongoose.connect(process.env.MONGODB_URI);
const { Document } = await import('../src/models/index.js');
const tokenFor = async (docId, stepNo) => {
  const d = await Document.findById(docId).lean();
  return d.approvalSteps.find((s) => s.stepNo === stepNo)?.actionToken;
};

const login = await j('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ADMIN),
});
const H = { Authorization: `Bearer ${login.session.access_token}`, 'Content-Type': 'application/json' };
console.log('✅ login');

// pick BT1 and create a fresh document (so the run gap doesn't matter)
const projects = (await j('/projects', { headers: H })).data;
const bt1 = projects.find((p) => p.code === 'BT1');

const created = (await j('/documents', {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    projectId: bt1.id,
    docCode: '02B',
    subject: 'ทดสอบ migration MongoDB',
    recipient: 'ผู้จัดการอาวุโสฝ่ายวิศวกรรม',
    body: 'เนื้อความทดสอบหลังย้ายฐานข้อมูลเป็น MongoDB + GridFS',
  }),
})).data;
console.log('✅ create doc:', created.doc_number, '(runNo', created.run_no + ')');
const docId = created.id;

// 1) generate ORIGINAL pdf -> GridFS, then download it back through the API
const pdf = (await j(`/documents/${docId}/generate-pdf`, { method: 'POST', headers: H })).data;
console.log('✅ generate-pdf:', pdf.file_name, '(attId', pdf.id + ')');
const dl = await fetch(`${BASE}/documents/${docId}/attachments/${pdf.id}/download`, { headers: H });
const pdfBytes = Buffer.from(await dl.arrayBuffer());
const isPdf = pdfBytes.slice(0, 4).toString() === '%PDF';
console.log(`✅ download original PDF: ${pdfBytes.length} bytes, valid PDF=${isPdf}`);

// 2) upload a supplementary attachment (multipart) and read it back
const form = new FormData();
form.append('file', new Blob([Buffer.from('hello gridfs')], { type: 'text/plain' }), 'note.txt');
const up = await fetch(`${BASE}/documents/${docId}/attachments`, {
  method: 'POST',
  headers: { Authorization: H.Authorization },
  body: form,
});
const upData = (await up.json()).data;
console.log('✅ upload attachment:', upData.file_name, '(attId', upData.id + ')');
const back = await fetch(`${BASE}/documents/${docId}/attachments/${upData.id}/download`, { headers: H });
console.log('✅ download attachment text:', JSON.stringify(await back.text()));

// 3) submit a 2-step approval chain
const sub = (await j(`/documents/${docId}/submit`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    approvers: [
      { name: 'ผู้อนุมัติคนที่ 1', email: 'approver1@vcb.local' },
      { name: 'ผู้อนุมัติคนที่ 2', email: 'approver2@vcb.local' },
    ],
  }),
})).data;
console.log('✅ submit -> status', sub.status, '| first approver', sub.firstApprover);

// 4) public lookup + approve step 1 -> advances to step 2
const t1 = await tokenFor(docId, 1);
const look = (await j(`/approvals/${t1}`)).data;
console.log('✅ public lookup:', look.doc_number, 'step', look.step_no, look.action);
const a1 = (await j(`/approvals/${t1}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'approved', comment: 'เห็นชอบ' }),
})).data;
console.log('✅ approve step1 -> docStatus', a1.documentStatus, '| advanced', a1.advanced);

// 5) approve step 2 -> finalises to approved (+ approved PDF generated)
const t2 = await tokenFor(docId, 2);
const a2 = (await j(`/approvals/${t2}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'approved' }),
})).data;
console.log('✅ approve step2 -> docStatus', a2.documentStatus, '| finalized', a2.finalized);

// 6) reusing consumed token must 409
let reused = '(no error!)';
try {
  await j(`/approvals/${t1}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approved' }),
  });
} catch (e) {
  reused = e.message.split(' -> ')[1] || e.message;
}
console.log('✅ reuse consumed token blocked:', reused);

// 7) final state: approved PDF present + audit trail
const detail = (await j(`/documents/${docId}`, { headers: H })).data;
const approvedPdf = detail.attachments.find((a) => a.version === 'approved');
console.log(
  'final status:', detail.status,
  '| steps:', detail.approval_steps.map((s) => `${s.step_no}:${s.action}`).join(','),
  '| audit:', detail.audit.length,
  '| approved PDF:', approvedPdf?.file_name || '(none)'
);

await mongoose.disconnect();
console.log('\n🎉 WORKFLOW SMOKE PASSED');
