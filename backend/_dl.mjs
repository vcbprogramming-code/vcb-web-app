const BASE='http://localhost:4000/api';
async function j(p,o={}){const r=await fetch(BASE+p,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p+' '+r.status);return d;}
const login=await j('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@vcb.local',password:'Admin@2048'})});
const H={Authorization:`Bearer ${login.session.access_token}`};
const docId='3820d69f-5989-4483-9969-d3d35ef3cfd6';
const det=(await j(`/documents/${docId}`,{headers:H})).data;
const appr=det.attachments.find(a=>a.version==='approved');
console.log('approved attachment:', appr?.file_name);
const url=(await j(`/documents/${docId}/attachments/${appr.id}/url`,{headers:H})).data.url;
const buf=Buffer.from(await(await fetch(url)).arrayBuffer());
const fs=await import('node:fs'); fs.writeFileSync('/tmp/approved-signed.pdf',buf);
console.log('saved approved pdf', buf.length, 'bytes');
