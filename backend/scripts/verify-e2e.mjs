// One-shot end-to-end verification against a REAL (in-memory) MongoDB.
// Boots mongodb-memory-server, runs seed + create-admin + the full workflow
// smoke (create → PDF → GridFS up/download → 2-step approval → token reuse
// guard → approved PDF), then tears everything down. No external services.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = resolve(__dirname, '..');

// A single-node replica set: GridFS + the app both work on a plain standalone,
// but a replica set keeps Atlas-like semantics available.
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = mongo.getUri('hr_system');
console.log('🧪 in-memory MongoDB at', uri.replace(/\/\/.*@/, '//'));

const PORT = '4099';
const ENV = {
  ...process.env,
  MONGODB_URI: uri,
  JWT_SECRET: 'verify-secret',
  PORT,
  NODE_ENV: 'test',
  SMOKE_BASE: `http://localhost:${PORT}/api`,
};

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn(cmd, args, { cwd: backend, env: ENV, stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${args.join(' ')} exited ${code}`))));
    p.on('error', reject);
  });
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not become healthy in time');
}

let server;
try {
  console.log('\n— seed —');
  await run('node', ['scripts/db.mjs', 'seed']);

  console.log('\n— create-admin —');
  await run('node', ['scripts/db.mjs', 'create-admin', 'admin@vcb.local', 'Admin@2048', 'ผู้ดูแลระบบ']);

  console.log('\n— start server —');
  server = spawn('node', ['src/server.js'], { cwd: backend, env: ENV, stdio: 'inherit' });
  await waitForHealth();
  console.log('server healthy ✅');

  console.log('\n— workflow smoke —');
  await run('node', ['scripts/smoke-workflow.mjs']);

  console.log('\n✅✅ E2E VERIFICATION PASSED');
} finally {
  if (server) server.kill('SIGTERM');
  await mongo.stop();
}
