// End-to-end smoke test for the E-Memo API. Run with backend up on :4000.
const BASE = 'http://localhost:4000/api';

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const login = await j('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@vcb.local', password: 'Admin@2048' }),
});
const token = login.session.access_token;
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
console.log('✅ login ok');

const projects = (await j('/projects', { headers: H })).data;
console.log('✅ projects:', projects.map((p) => `${p.code}(${p.doc_prefix})`).join(', '));

const byCode = (c) => projects.find((p) => p.code === c);

async function create(code, docCode, subject, recipient) {
  const peek = (await j(`/documents/next-number?projectId=${byCode(code).id}&docCode=${encodeURIComponent(docCode)}`, { headers: H })).data;
  const created = (await j('/documents', {
    method: 'POST', headers: H,
    body: JSON.stringify({ projectId: byCode(code).id, docCode, subject, recipient }),
  })).data;
  const match = peek.docNumber === created.doc_number ? '✓' : '✗ MISMATCH';
  console.log(`  ${code}/${docCode}: preview=${peek.docNumber} created=${created.doc_number} ${match}`);
  return created;
}

console.log('— create documents —');
await create('BT1', '02B', 'ขออนุมัติซื้อวัสดุสิ้นเปลืองและอุปกรณ์ Box Segment', 'ผู้จัดการฝ่ายวิศวกรรม');
await create('BT1', '02B', 'ขออนุมัติปรับเพิ่มราคาเนื่องจากวิกฤตพลังงาน', 'ผู้จัดการฝ่ายวิศวกรรม');
await create('BV', '02A', 'ขออนุมัติว่าจ้างรักษาความปลอดภัยเพิ่ม', 'ผู้จัดการสำนักงานใหญ่');
await create('LPB', '06', 'ขออนุมัติซ่อมบำรุงเครื่องมือ HILTI TE70', 'ผู้จัดการฝ่ายทรัพย์สิน-พัสดุ');

console.log('— per-project numbering check (BT1 should be 001,002) —');
const bt1 = (await j(`/documents?projectId=${byCode('BT1').id}`, { headers: H })).data;
console.log('  BT1 numbers:', bt1.map((d) => d.doc_number).join(', '));

console.log('— department mapping check (06 → ทรัพย์สิน-พัสดุ) —');
const lpb = (await j(`/documents?projectId=${byCode('LPB').id}`, { headers: H })).data;
console.log('  LPB:', lpb.map((d) => `${d.doc_number} dept=${d.department}`).join(', '));

console.log('— filters —');
const all = await j('/documents?pageSize=50', { headers: H });
console.log('  total docs:', all.total);
const bv = await j(`/documents?projectId=${byCode('BV').id}`, { headers: H });
console.log('  filter BV:', bv.total, bv.data.map((d) => d.doc_number).join(','));
const search = await j(`/documents?search=${encodeURIComponent('ซ่อม')}`, { headers: H });
console.log('  search "ซ่อม":', search.total, '->', search.data.map((d) => d.subject.slice(0, 20)).join(' | '));

console.log('\n✅ ALL SMOKE CHECKS PASSED');
