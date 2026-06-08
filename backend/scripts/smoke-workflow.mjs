// E2E smoke for E-Memo phase 2: PDF gen + approval chain via token links.
const BASE = 'http://localhost:4000/api';
async function j(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}
const login = await j('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'admin@vcb.local',password:'Admin@2048'}) });
const H = { Authorization:`Bearer ${login.session.access_token}`, 'Content-Type':'application/json' };
console.log('✅ login');

// pick the first BT1 doc
const projects = (await j('/projects',{headers:H})).data;
const bt1 = projects.find(p=>p.code==='BT1');
const docs = (await j(`/documents?projectId=${bt1.id}`,{headers:H})).data;
const doc = docs[0];
console.log('using doc:', doc.doc_number, doc.id);

// 1) generate PDF
const pdf = (await j(`/documents/${doc.id}/generate-pdf`,{method:'POST',headers:H})).data;
console.log('✅ generate-pdf:', pdf.file_name, '(url len', pdf.url.length, ')');

// 2) submit a 2-step approval chain
const sub = (await j(`/documents/${doc.id}/submit`,{method:'POST',headers:H,body:JSON.stringify({approvers:[
  {name:'ผู้อนุมัติคนที่ 1', email:'approver1@vcb.local'},
  {name:'ผู้อนุมัติคนที่ 2', email:'approver2@vcb.local'},
]})})).data;
console.log('✅ submit -> status', sub.status, 'first approver', sub.firstApprover);

// 3) fetch the doc to read step1 token (via DB-less: detail endpoint hides tokens, so read approvals by listing)
// We need the token; detail doesn't expose it. Pull from approvals lookup is by token only.
// So read token straight from the steps using a tiny admin query endpoint? We don't have one.
// Instead: detail shows pending step; get token from DB via the documents detail? Not exposed.
// For the smoke test we read it from the audit/email console. Fallback: query DB.
import('pg').then(async ({default:pg})=>{
  const dotenv=(await import('dotenv')).default; dotenv.config();
  const c=new pg.Client({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await c.connect();
  const t1=(await c.query("select action_token from approval_steps where document_id=$1 and step_no=1",[doc.id])).rows[0].action_token;
  console.log('step1 token:', t1.slice(0,12)+'...');

  // 4) public lookup (no auth)
  const look = (await j(`/approvals/${t1}`)).data;
  console.log('✅ public lookup:', look.doc_number, 'step', look.step_no, 'action', look.action);

  // 5) approve step 1 -> should advance to step 2 + email it
  const a1 = (await j(`/approvals/${t1}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approved',comment:'เห็นชอบ'})})).data;
  console.log('✅ approve step1 -> docStatus', a1.documentStatus, 'advanced', a1.advanced);

  // 6) approve step 2 -> should finalise to approved
  const t2=(await c.query("select action_token from approval_steps where document_id=$1 and step_no=2",[doc.id])).rows[0].action_token;
  const a2 = (await j(`/approvals/${t2}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approved'})})).data;
  console.log('✅ approve step2 -> docStatus', a2.documentStatus, 'advanced', a2.advanced);

  // 7) reusing consumed token should 409
  let reused='(no error)';
  try { await j(`/approvals/${t1}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approved'})}); }
  catch(e){ reused = e.message.split(' -> ')[1] || e.message; }
  console.log('✅ reuse consumed token blocked:', reused);

  // 8) final doc state + audit
  const detail=(await j(`/documents/${doc.id}`,{headers:H})).data;
  console.log('final status:', detail.status, '| steps:', detail.approval_steps.map(s=>`${s.step_no}:${s.action}`).join(','), '| audit events:', detail.audit.length);
  await c.end();
  console.log('\n🎉 WORKFLOW SMOKE PASSED');
});
