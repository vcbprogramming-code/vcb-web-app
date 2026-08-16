/**
 * Shared harness for the E-Memo suites.
 * Defaults to the REAL Render API + database; override with API=... for local.
 * Every document a suite creates is marked ZZTEST and removed by cleanup().
 */
import fs from 'node:fs';
import { dirname } from 'node:path';
import { signToken } from '../src/utils/auth.js';
import { query } from '../src/config/db.js';

export { query };
export const API = process.env.API || 'https://vcb-hr-api.onrender.com/api';
export const APP = process.env.APP || 'https://project-bhq0j.vercel.app';

// the accounts the client agreed to use for testing
export const U = {
  admin: { id: '1f01b1c0-aa67-4468-bf3b-f7d8892a5ce6', email: 'thanongsak40ni@gmail.com', name: 'ทนงศักดิ์ นิราศ' },
  admin2: { id: '2695a5a0-15f9-4941-9978-b4f0f416aea3', email: 'thanongsakni.senx@gmail.com', name: 'ihjkda' },
  exec: { id: '384d3655-3c57-4998-88bf-70d2720905db', email: 'c.chavananand@gmail.com', name: 'Chawin' },
  hr: { id: 'b13d8f8c-a94a-4a18-a6c5-48ccb898efe7', email: 'hr1@vcb.local', name: 'นายทดสอบ HR' },
};
export const tok = (u) => signToken(u.id);

// Test documents stay in the throwaway project; running numbers there are
// recoverable because allocation is MAX(run_no)+1 per project.
export const TEST_PROJECT = 'kda';
export const MARK = 'ZZTEST';
export const made = new Set();

const results = [];
let group = '';
export function suite(name) {
  group = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
}
export function check(kind, name, ok, extra = '') {
  results.push({ group, kind, name, ok });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${kind}] ${name}${ok || !extra ? '' : ` — ${extra}`}`);
  return ok;
}
export const happy = (n, ok, x) => check('H', n, ok, x);
export const bad = (n, ok, x) => check('B', n, ok, x);
export function report(file) {
  const p = results.filter((r) => r.ok).length;
  const f = results.length - p;
  console.log(`\n${p} passed, ${f} failed  (${results.filter((r) => r.kind === 'H').length} happy / ${results.filter((r) => r.kind === 'B').length} bad)`);
  if (f) console.log('ที่ไม่ผ่าน:\n' + results.filter((r) => !r.ok).map((r) => `  · [${r.group}] ${r.name}`).join('\n'));
  // sync, and make the folder first: the caller exits straight after this line
  if (file) {
    fs.mkdirSync(dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(results, null, 1));
  }
  return f;
}

export async function call(path, { method = 'GET', body, user, raw = false, headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders || {}) };
  if (user) headers.Authorization = `Bearer ${tok(user)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

/** Multipart upload of an in-memory file. */
export async function upload(path, user, filename, bytes, type) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type }), filename);
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok(user)}` }, body: fd,
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

let project = null;
export async function testProject(user = U.admin) {
  if (project) return project;
  const r = await call('/projects', { user });
  project = r.data.find((p) => p.code === TEST_PROJECT);
  if (!project) throw new Error(`ไม่พบโครงการทดสอบ ${TEST_PROJECT}`);
  return project;
}

export async function newDoc(user, subject, extra = {}) {
  const p = await testProject(user);
  const r = await call('/documents', {
    method: 'POST', user,
    body: { projectId: p.id, docCode: '0823', subject: `${MARK} ${subject}`, ...extra },
  });
  if (r.status !== 201) throw new Error(`create failed ${r.status}: ${JSON.stringify(r).slice(0, 200)}`);
  made.add(r.data.id);
  return r.data;
}

/** Remove every document this run created, plus any stragglers carrying MARK. */
export async function cleanup() {
  const ids = [...made];
  if (ids.length) await query('delete from documents where id = any($1::uuid[])', [ids]);
  const { rows } = await query('select id from documents where subject like $1', [`${MARK}%`]);
  if (rows.length) await query('delete from documents where subject like $1', [`${MARK}%`]);
  made.clear();
  return ids.length + rows.length;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wake the free-tier API so the first real request isn't a cold start. */
export async function warm() {
  for (let i = 0; i < 30; i += 1) {
    try { if ((await fetch(`${API}/health`)).ok) return true; } catch { /* retry */ }
    await sleep(4000);
  }
  return false;
}
