// E2E verification for Modules 2/3/4 against a REAL (in-memory) MongoDB.
// Boots mongodb-memory-server, seeds, creates an admin, starts the server, and
// exercises each module's routes incl. the credit used-amount business rules.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = resolve(__dirname, '..');

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = mongo.getUri('hr_system');
const PORT = '4098';
const BASE = `http://localhost:${PORT}/api`;
const ENV = { ...process.env, MONGODB_URI: uri, JWT_SECRET: 'verify', PORT, NODE_ENV: 'test' };

function run(args) {
  return new Promise((res, rej) => {
    const p = spawn('node', args, { cwd: backend, env: ENV, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${args.join(' ')} exited ${c}`))));
  });
}
async function waitHealth(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server not healthy');
}

let server;
const fail = (m) => { throw new Error('ASSERT: ' + m); };
const eq = (a, b, m) => { if (a !== b) fail(`${m} — expected ${b}, got ${a}`); };

try {
  await run(['scripts/db.mjs', 'seed']);
  await run(['scripts/db.mjs', 'create-admin', 'admin@vcb.local', 'Admin@2048', 'แอดมิน']);
  server = spawn('node', ['src/server.js'], { cwd: backend, env: ENV, stdio: 'inherit' });
  await waitHealth();

  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@vcb.local', password: 'Admin@2048' }),
  })).json();
  const H = { Authorization: `Bearer ${login.session.access_token}`, 'Content-Type': 'application/json' };
  const j = async (path, opts = {}) => {
    const r = await fetch(BASE + path, { headers: H, ...opts });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(d)}`);
    return d.data;
  };
  console.log('✅ login');

  // ── Module 2: Performance ──────────────────────────────────────────────
  const sites = await j('/performance/sites');
  if (!sites.length) fail('no seeded sites');
  const site = sites[0];
  console.log(`✅ M2 sites: ${sites.length} (using ${site.name})`);

  const emp = await j('/performance/employees', { method: 'POST', body: JSON.stringify({ unitId: site.id, fullName: 'สมชาย ทดสอบ', kind: 'operation', team: 'ทีม A' }) });
  const sup = await j('/performance/employees', { method: 'POST', body: JSON.stringify({ unitId: site.id, fullName: 'สมหญิง สนับสนุน', kind: 'support' }) });
  console.log('✅ M2 employees created (op + sup)');

  const month = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const wt = (await j('/performance/work-types'))[0];
  const save = await j('/performance/grid/save', {
    method: 'POST',
    body: JSON.stringify({ unitId: site.id, cells: [
      { employeeId: emp.id, ymd: today, kind: 'operation', workTypeId: wt.id, workTypeName: wt.name, otHours: 2, otRate: 100 },
      { employeeId: sup.id, ymd: today, kind: 'support', detail: 'ทำเอกสาร' },
    ] }),
  });
  eq(save.count, 2, 'M2 grid save count');
  const grid = await j(`/performance/grid?unitId=${site.id}&month=${month}`);
  if (!grid.logs.find((l) => l.ot_hours === 2)) fail('M2 OT not saved');
  const cov = await j(`/performance/coverage?unitId=${site.id}&month=${month}`);
  if (!cov.rows.length) fail('M2 coverage empty');
  console.log(`✅ M2 grid+coverage (logs=${grid.logs.length}, OT amount auto=${grid.logs.find(l=>l.ot_hours===2)?.ot_amount})`);

  // ── Module 3: Credit (the business rules) ──────────────────────────────
  const projects = await (await fetch(`${BASE}/projects`, { headers: H })).json();
  const proj = projects.data[0];
  const fac = await j('/credit/facilities', { method: 'POST', body: JSON.stringify({ projectId: proj.id, type: 'T/L', limit: 1000000, interestRate: 6 }) });
  eq(fac.used, 0, 'M3 new facility used=0');

  // authorized item counts; new/pending do NOT
  await j('/credit/ledger', { method: 'POST', body: JSON.stringify({ facilityId: fac.id, amount: 300000, status: 'อนุมัติแล้ว' }) });
  await j('/credit/ledger', { method: 'POST', body: JSON.stringify({ facilityId: fac.id, amount: 999999, status: 'คำขอใหม่' }) });
  let facs = await j(`/credit/facilities?projectId=${proj.id}`);
  eq(facs[0].used, 300000, 'M3 used counts only authorized');

  // settle releases the line
  const led = (await j(`/credit/ledger?facilityId=${fac.id}`)).find((l) => l.status === 'อนุมัติแล้ว');
  await j(`/credit/ledger/${led.id}/settle`, { method: 'POST' });
  facs = await j(`/credit/facilities?projectId=${proj.id}`);
  eq(facs[0].used, 0, 'M3 settle releases line');
  console.log('✅ M3 used-amount rules (authorized counts, new ignored, settle releases)');

  // request → approve auto-creates linked authorized ledger
  const reqd = await j('/credit/requests', { method: 'POST', body: JSON.stringify({ facilityId: fac.id, amount: 200000 }) });
  const decided = await j(`/credit/requests/${reqd.id}/decide`, { method: 'POST', body: JSON.stringify({ decision: 'อนุมัติ' }) });
  if (!decided.ledger) fail('M3 approve did not create ledger');
  facs = await j(`/credit/facilities?projectId=${proj.id}`);
  eq(facs[0].used, 200000, 'M3 approved request consumes line once');
  const overview = await j('/credit/overview');
  if (!overview.byType.find((t) => t.type === 'T/L')) fail('M3 overview missing T/L');
  const audit = await j('/credit/audit');
  if (audit.length < 3) fail('M3 audit not recorded');
  console.log(`✅ M3 request→approve→ledger (used=${facs[0].used}); audit rows=${audit.length}`);

  // cash plan
  await j('/credit/cash-plan', { method: 'POST', body: JSON.stringify({ projectId: proj.id, month, income: 500000, newPN: 100000, available: 400000 }) });
  const cp = await j(`/credit/cash-plan?projectId=${proj.id}`);
  eq(cp.length, 1, 'M3 cash plan saved');
  console.log('✅ M3 cash plan');

  // ── Module 4: Onboarding ───────────────────────────────────────────────
  const templates = await j('/onboarding/templates');
  if (templates.length < 3) fail('M4 templates not seeded');
  const journey = await j('/onboarding/journeys', { method: 'POST', body: JSON.stringify({ fullName: 'พนักงานใหม่ ทดสอบ', position: 'ช่าง', startDate: today }) });
  eq(journey.tasks_total, templates.length, 'M4 journey seeded from templates');
  const firstTask = journey.tasks[0];
  const afterToggle = await j(`/onboarding/journeys/${journey.id}/tasks/${firstTask.id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) });
  eq(afterToggle.tasks_done, 1, 'M4 task toggle');
  const reviewed = await j(`/onboarding/journeys/${journey.id}/review`, { method: 'PUT', body: JSON.stringify({ reviewer: 'หัวหน้า', result: 'pass', scores: { 'คุณภาพงาน': 4 } }) });
  eq(reviewed.status, 'completed', 'M4 pass → completed');
  console.log(`✅ M4 journey (${journey.tasks_total} tasks) + toggle + review`);

  console.log('\n✅✅✅ ALL MODULES VERIFIED');
} finally {
  if (server) server.kill('SIGTERM');
  await mongo.stop();
}
