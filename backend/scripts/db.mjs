#!/usr/bin/env node
// Database admin CLI for the HR system (MongoDB / Mongoose).
//
//   node scripts/db.mjs seed                                  seed reference data (idempotent)
//   node scripts/db.mjs create-admin <email> <password> ["Full Name"]
//   node scripts/db.mjs list-users
//
// Connects via MONGODB_URI from backend/.env. The seed is idempotent (upserts),
// so it is safe to re-run.

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const CI = { locale: 'en', strength: 2 }; // case-insensitive collation

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}

async function models() {
  // import after dotenv + connect so the schemas register on this connection
  return import('../src/models/index.js');
}

// --- Reference data (mirrors the old SQL seed; doc codes from migration 0008) ---

const PROJECTS = [
  { code: 'CVE', name: 'CVE', docPrefix: 'CVE', color: '#16a34a', sortOrder: 1 },
  { code: 'BV', name: 'BV', docPrefix: 'Bv', color: '#db2777', sortOrder: 2 },
  { code: 'PN4', name: 'PN4', docPrefix: 'PN', color: '#9333ea', sortOrder: 3 },
  { code: 'V&K', name: 'V&K', docPrefix: 'VK', color: '#0891b2', sortOrder: 4 },
  { code: 'EP', name: 'EP', docPrefix: 'EP', color: '#65a30d', sortOrder: 5 },
  { code: 'VK2', name: 'VK2', docPrefix: 'BP', color: '#7c3aed', sortOrder: 6 },
  { code: 'BT1', name: 'BT1', docPrefix: 'BT', color: '#2563eb', sortOrder: 7 },
  { code: 'LPB', name: 'LPB (Luang Prabang)', docPrefix: 'VC', color: '#ea580c', sortOrder: 8 },
];

const DOC_CODES = [
  { _id: '01', department: 'บริหาร', recipientTitle: 'ฝ่ายบริหาร' },
  { _id: '02A', department: 'วิศวะ', recipientTitle: 'ผู้จัดการฝ่ายวิศวกรรม' },
  { _id: '02B', department: 'วิศวะ', recipientTitle: 'ผู้จัดการอาวุโสฝ่ายวิศวกรรม' },
  { _id: '02C', department: 'ปฏิบัติการ', recipientTitle: 'ผู้จัดการอาวุโสฝ่ายปฏิบัติการ' },
  { _id: '03', department: 'บริหาร', recipientTitle: 'ผู้จัดการทั่วไป' },
  { _id: '05', department: 'การเงิน', recipientTitle: 'ฝ่ายการเงิน' },
  { _id: '06', department: 'พัสดุ', recipientTitle: 'ฝ่ายพัสดุทรัพย์สิน' },
  { _id: '09', department: 'บัญชี', recipientTitle: 'ฝ่ายบัญชี' },
  { _id: '10', department: 'สำนักงาน', recipientTitle: 'ขอหนังสือรับรอง' },
];

const DOC_TYPES = [
  { name: 'ขออนุมัติซื้อ', sortOrder: 1 },
  { name: 'ขออนุมัติว่าจ้าง', sortOrder: 2 },
  { name: 'ขออนุมัติเช่า', sortOrder: 3 },
  { name: 'ขออนุมัติซ่อมบำรุง', sortOrder: 4 },
  { name: 'ขออนุมัติปรับราคา', sortOrder: 5 },
  { name: 'ขอหนังสือรับรอง', sortOrder: 6 },
  { name: 'อื่นๆ', sortOrder: 99 },
];

async function seed() {
  await connect();
  const { Project, DocCodeDepartment, DocumentType, Counter, Document, syncIndexes } = await models();

  await syncIndexes();
  console.log('🔑 Indexes synced');

  for (const p of PROJECTS) {
    await Project.updateOne(
      { code: p.code },
      { $setOnInsert: p },
      { upsert: true, collation: CI }
    );
  }
  console.log(`📁 Projects: ${PROJECTS.length} ensured`);

  for (const d of DOC_CODES) {
    await DocCodeDepartment.updateOne(
      { _id: d._id },
      { $set: { department: d.department, recipientTitle: d.recipientTitle } },
      { upsert: true }
    );
  }
  console.log(`🔖 Doc codes: ${DOC_CODES.length} ensured`);

  for (const t of DOC_TYPES) {
    await DocumentType.updateOne(
      { name: t.name },
      { $setOnInsert: t },
      { upsert: true }
    );
  }
  console.log(`🗂️  Document types: ${DOC_TYPES.length} ensured`);

  // Seed per-project counters to the current max runNo (so numbering continues
  // correctly if documents already exist; fresh installs start at 0).
  const projects = await Project.find().lean();
  for (const p of projects) {
    const top = await Document.find({ projectId: p._id }).sort({ runNo: -1 }).limit(1).lean();
    const max = top[0]?.runNo ?? 0;
    await Counter.updateOne({ _id: String(p._id) }, { $max: { seq: max } }, { upsert: true });
  }
  console.log(`🔢 Counters seeded for ${projects.length} project(s)`);

  console.log('\n✅ Seed complete.');
  await mongoose.disconnect();
}

async function createAdmin(email, password, fullName) {
  if (!email || !password) {
    console.error('Usage: create-admin <email> <password> ["Full Name"]');
    process.exit(1);
  }
  await connect();
  const { Profile } = await models();
  const passwordHash = await bcrypt.hash(password, 10);
  const row = await Profile.findOneAndUpdate(
    { email },
    {
      $set: { passwordHash, fullName: fullName || 'ผู้ดูแลระบบ', role: 'admin', isActive: true },
    },
    { upsert: true, new: true, collation: CI }
  ).lean();
  console.log('✅ Admin ready:', { id: String(row._id), email: row.email, role: row.role });
  await mongoose.disconnect();
}

async function listUsers() {
  await connect();
  const { Profile } = await models();
  const rows = await Profile.find().sort({ createdAt: 1 }).lean();
  console.table(
    rows.map((r) => ({ email: r.email, full_name: r.fullName, role: r.role, is_active: r.isActive }))
  );
  await mongoose.disconnect();
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = {
  seed,
  'create-admin': () => createAdmin(...rest),
  'list-users': listUsers,
};

if (!commands[cmd]) {
  console.log('Commands: seed | create-admin <email> <password> ["name"] | list-users');
  process.exit(1);
}

commands[cmd]().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
