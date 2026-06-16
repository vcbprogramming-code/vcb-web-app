// Verify the E-Memo quality-of-life endpoints (edit / cancel / resend / export)
// against a REAL (in-memory) MongoDB.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = resolve(__dirname, '..');
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const PORT = '4097';
const BASE = `http://localhost:${PORT}/api`;
const ENV = { ...process.env, MONGODB_URI: mongo.getUri('hr_system'), JWT_SECRET: 'v', PORT, NODE_ENV: 'test' };

function run(args) {
  return new Promise((res, rej) => {
    const p = spawn('node', args, { cwd: backend, env: ENV, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${args.join(' ')} exited ${c}`))));
  });
}
async function waitHealth(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(`${BASE}/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 300)); }
  throw new Error('no health');
}
const fail = (m) => { throw new Error('ASSERT ' + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${b} got ${a}`); };

let server;
try {
  await run(['scripts/db.mjs', 'seed']);
  await run(['scripts/db.mjs', 'create-admin', 'admin@vcb.local', 'Admin@2048', 'แอดมิน']);
  server = spawn('node', ['src/server.js'], { cwd: backend, env: ENV, stdio: 'inherit' });
  await waitHealth();

  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@vcb.local', password: 'Admin@2048' }) })).json();
  const H = { Authorization: `Bearer ${login.session.access_token}`, 'Content-Type': 'application/json' };
  const j = async (path, opts = {}) => { const r = await fetch(BASE + path, { headers: H, ...opts }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(d)}`); return d.data; };
  console.log('✅ login');

  const proj = (await (await fetch(`${BASE}/projects`, { headers: H })).json()).data[0];

  // create a doc
  const created = await j('/documents', { method: 'POST', body: JSON.stringify({ projectId: proj.id, docCode: '02B', subject: 'ก่อนแก้ไข' }) });
  console.log('✅ create:', created.doc_number);

  // EDIT
  const edited = await j(`/documents/${created.id}`, { method: 'PATCH', body: JSON.stringify({ subject: 'หลังแก้ไข', remarks: 'แก้แล้ว' }) });
  eq(edited.subject, 'หลังแก้ไข', 'edit subject');
  if (!edited.audit.find((a) => a.action === 'edited')) fail('edit audit missing');
  console.log('✅ edit doc + audit');

  // EXPORT (xlsx)
  const xls = await fetch(`${BASE}/documents/export?projectId=${proj.id}`, { headers: H });
  const buf = Buffer.from(await xls.arrayBuffer());
  const isXlsx = buf.slice(0, 2).toString() === 'PK'; // xlsx is a zip
  eq(isXlsx, true, 'export is valid xlsx');
  console.log(`✅ export xlsx (${buf.length} bytes)`);

  // submit approval → then RESEND
  await j(`/documents/${created.id}/submit`, { method: 'POST', body: JSON.stringify({ approvers: [{ name: 'A', email: 'a@x.com' }] }) });
  const resent = await j(`/documents/${created.id}/resend-approval`, { method: 'POST' });
  eq(resent.to, 'a@x.com', 'resend to first approver');
  console.log('✅ resend approval email');

  // CANCEL
  const cancelled = await j(`/documents/${created.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'ทดสอบ' }) });
  eq(cancelled.cancelled, true, 'cancel ok');
  const after = await j(`/documents/${created.id}`);
  eq(after.status, 'cancelled', 'status cancelled');
  if (!after.audit.find((a) => a.action === 'cancelled')) fail('cancel audit missing');
  console.log('✅ cancel doc + audit');

  // edit a cancelled doc must fail (409)
  let blocked = false;
  try { await j(`/documents/${created.id}`, { method: 'PATCH', body: JSON.stringify({ subject: 'x' }) }); } catch { blocked = true; }
  eq(blocked, true, 'edit blocked after cancel');
  console.log('✅ edit blocked after cancel');

  console.log('\n✅✅ E-MEMO QoL VERIFIED');
} finally {
  if (server) server.kill('SIGTERM');
  await mongo.stop();
}
