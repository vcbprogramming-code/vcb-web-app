const BASE='http://localhost:4000/api';
async function j(p,o={}){const r=await fetch(BASE+p,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p+' -> '+r.status+' '+JSON.stringify(d));return d;}
const login=await j('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@vcb.local',password:'Admin@2048'})});
const H={Authorization:`Bearer ${login.session.access_token}`,'Content-Type':'application/json'};
console.log('✅ login');
console.log('users:', (await j('/admin/users',{headers:H})).data.map(u=>u.email+'/'+u.role).join(', '));
// create user (idempotent-ish: ignore conflict)
try{const u=await j('/admin/users',{method:'POST',headers:H,body:JSON.stringify({fullName:'นายทดสอบ HR',email:'hr1@vcb.local',password:'Hr@123456',role:'hr'})});console.log('✅ created', u.data.email);}catch(e){console.log('(create user:', e.message.split('->')[1]?.trim()||e.message, ')');}
console.log('types:', (await j('/admin/document-types',{headers:H})).data.length, 'types');
console.log('projects(admin):', (await j('/admin/projects',{headers:H})).data.length, 'projects');
// letterhead upsert on BT1
const bt=(await j('/projects',{headers:H})).data.find(p=>p.code==='BT1');
const lh=await j(`/admin/projects/${bt.id}/letterhead`,{method:'PUT',headers:H,body:JSON.stringify({companyName:'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด',address:'123 ถนนพระราม 9 กรุงเทพฯ',signatoryName:'นายสมชาย ใจดี',signatoryTitle:'ผู้จัดการโครงการ'})});
console.log('✅ letterhead saved for BT1:', lh.data.company_name);
console.log('\n🎉 ADMIN SMOKE PASSED');
