#!/usr/bin/env node
// Seed realistic mock E-Memo documents into the register (for demo/testing).
//
//   node scripts/seed-mock-documents.mjs          add the mock docs
//   node scripts/seed-mock-documents.mjs --reset  delete ALL documents first
//
// Uses the same allocateDocNumber() the API uses, so running numbers are correct
// and per-project. Idempotent-ish: skips a doc if its subject already exists.

import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌ MONGODB_URI not set'); process.exit(1); }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);

  const { Project, Document, Profile } = await import('../src/models/index.js');
  const { allocateDocNumber } = await import('../src/services/docNumber.js');

  if (process.argv.includes('--reset')) {
    const r = await Document.deleteMany({});
    const { Counter } = await import('../src/models/index.js');
    await Counter.updateMany({}, { $set: { seq: 0 } });
    console.log(`🧹 deleted ${r.deletedCount} document(s); counters reset`);
  }

  const admin = await Profile.findOne({ role: 'admin' }).lean();
  const actor = { id: admin?._id || null, label: admin?.fullName || 'ผู้ดูแลระบบ' };

  const projByCode = Object.fromEntries(
    (await Project.find().lean()).map((p) => [p.code, p])
  );

  // realistic construction-firm memos, mirroring the client's register
  // [projectCode, docCode, subject, recipient?, daysAgo]
  const MOCK = [
    ['CVE', '02A', 'ขออนุมัติส่งรายชื่อพนักงานทำโอที ในวันอาทิตย์ ที่ 21 มิถุนายน 2569', 'คุณวิรัตน์ ชวนะนันท์', 0],
    ['PN4', '02B', 'ขออนุมัติเบิกค่าขยายเขตระบบจำหน่ายกระแสไฟฟ้าขนาดหม้อแปลง 500 KVA', null, 5],
    ['BT1', '02B', 'ขออนุมัติซื้อวัสดุเหล็กรูปพรรณ สำหรับประกอบนั่งร้านงานติดตั้ง Box Segment (สั่งครั้งที่1)', null, 5],
    ['PN4', '03', 'เอกสารค่างาน งวดที่ 1 (นางอโนชา แก้วมรกต)', null, 6],
    ['LPB', '06', 'ขออนุมัติตัดบัญชีทรัพย์สิน', 'ผู้จัดการฝ่ายทรัพย์สิน-พัสดุ สำนักงานใหญ่', 6],
    ['BV', '02A', 'ขออนุมัติเบิกภาษีที่ดินและสิ่งปลูกสร้าง', null, 6],
    ['PN4', '02B', 'ขออนุมัติจ้างงานติดตั้งเสาไฟฟ้าแรงสูงและหม้อแปลงในแคมป์ก่อสร้าง', null, 8],
    ['PN4', '02B', 'ขออนุมัติเปลี่ยนชื่อ ผรม. งานรื้อย้ายและติดตั้งอาคาร สนง.', null, 9],
    ['V&K', '02B', 'ขออนุมัติปรับปริมาณงานก่อสร้างอาคาร สนง. และบ้านพักกรมทางหลวง', null, 9],
    ['PN4', '03', 'เอกสารค่างาน งวดที่ 2 (บจก. ธนเทพ)', null, 9],
    ['V&K', '03', 'เอกสารค่างาน งวดที่ 1 (บจก. ธนเทพ)', null, 9],
    ['BT1', '03', 'เอกสารเบิกค่างานงวดที่ 3 (1-31 พ.ค. 69) บ.เมกะ ไพ จำกัด (แก้ไข)', null, 9],
    ['BV', '03', 'บ สหเดช งวด 2 , 021 บ ตีปัญญา งวด 3 (แก้ไข)', null, 9],
    ['CVE', '02B', 'ขออนุมัติจัดซื้อปูนซีเมนต์และวัสดุงานคอนกรีต โครงการระยะที่ 2', null, 10],
    ['EP', '05', 'ขออนุมัติเบิกจ่ายค่าเช่าเครื่องจักรประจำเดือนมิถุนายน 2569', 'ฝ่ายการเงิน', 11],
    ['VK2', '06', 'ขออนุมัติจัดซื้ออุปกรณ์ความปลอดภัยประจำหน่วยงาน', null, 12],
    ['BT1', '01', 'ขออนุมัติแผนการดำเนินงานก่อสร้างประจำไตรมาส 3/2569', 'ฝ่ายบริหาร', 14],
  ];

  let added = 0, skipped = 0;
  for (const [code, docCode, subject, recipient, daysAgo] of MOCK) {
    const project = projByCode[code];
    if (!project) { console.warn(`  ⚠ project ${code} not found, skip`); continue; }
    if (await Document.findOne({ subject }).lean()) { skipped++; continue; }

    const { runNo, docNumber, department } = await allocateDocNumber({ project, docCode });
    const dateReceived = new Date();
    dateReceived.setDate(dateReceived.getDate() - daysAgo);

    await Document.create({
      projectId: project._id,
      docCode,
      department,
      runNo,
      docNumber,
      subject,
      recipient: recipient || null,
      body: subject,
      dateReceived,
      source: 'manual',
      status: 'pending',
      createdBy: actor.id,
      audit: [{ actorId: actor.id, actorLabel: actor.label, action: 'created', detail: { doc_number: docNumber }, createdAt: dateReceived }],
    });
    added++;
    console.log(`  + ${docNumber}  ${subject.slice(0, 50)}`);
  }

  console.log(`\n✅ Mock documents: ${added} added, ${skipped} skipped (already existed)`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
