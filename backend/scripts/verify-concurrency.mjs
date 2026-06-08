// Stress the two race-critical paths against a real (in-memory) MongoDB:
//  1) concurrent document creates in one project → distinct sequential runNos
//  2) concurrent approval POSTs with the SAME token → exactly one succeeds
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = resolve(__dirname, '..');

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = mongo.getUri('hr_system');

const { connectDb } = await import(resolve(backend, 'src/config/db.js'));
await connectDb();
const { Project, Document, syncIndexes } = await import(resolve(backend, 'src/models/index.js'));
await syncIndexes();
const { allocateDocNumber } = await import(resolve(backend, 'src/services/docNumber.js'));
const { createApprovalChain, applyApprovalAction } = await import(resolve(backend, 'src/services/approval.js'));

const project = await Project.create({ code: 'RACE', name: 'Race', docPrefix: 'RC', sortOrder: 1 });

// --- Test 1: 25 concurrent allocations + inserts in the same project ---
const N = 25;
async function makeDoc() {
  const { runNo, docNumber, department } = await allocateDocNumber({ project, docCode: '02B' });
  await Document.create({
    projectId: project._id, docCode: '02B', department, runNo, docNumber,
    subject: `race ${runNo}`, status: 'pending', source: 'manual',
  });
  return runNo;
}
const runNos = await Promise.all(Array.from({ length: N }, makeDoc));
const unique = new Set(runNos);
const sorted = [...unique].sort((a, b) => a - b);
const contiguous = sorted.length === N && sorted[0] === 1 && sorted[N - 1] === N;
console.log(`Test 1 — concurrent run numbers: ${unique.size}/${N} unique, contiguous 1..${N}=${contiguous}`);
if (unique.size !== N || !contiguous) throw new Error('DUPLICATE OR GAPPED run numbers under concurrency');

// --- Test 2: same token fired 10x concurrently → exactly one 'ok' ---
const target = await Document.create({
  projectId: project._id, docCode: '02B', department: 'วิศวะ', runNo: 999,
  docNumber: 'RC/วิศวะ/02B/999', subject: 'token race', status: 'pending', source: 'manual',
});
await createApprovalChain({
  documentId: target._id,
  approvers: [{ name: 'A', email: 'a@x.com' }, { name: 'B', email: 'b@x.com' }],
  actorLabel: 'tester',
});
const fresh = await Document.findById(target._id).lean();
const token = fresh.approvalSteps[0].actionToken;

const results = await Promise.all(
  Array.from({ length: 10 }, () =>
    applyApprovalAction({ token, action: 'approved', comment: 'x' })
      .then((r) => (r.error ? `err:${r.error}` : 'ok'))
      .catch((e) => `throw:${e.message}`)
  )
);
const okCount = results.filter((r) => r === 'ok').length;
console.log(`Test 2 — concurrent same-token approvals: ${okCount} succeeded, ${results.length - okCount} rejected`);
if (okCount !== 1) throw new Error(`Expected exactly 1 success, got ${okCount}: ${JSON.stringify(results)}`);

await mongoose.disconnect();
await mongo.stop();
console.log('\n✅ CONCURRENCY VERIFICATION PASSED');
