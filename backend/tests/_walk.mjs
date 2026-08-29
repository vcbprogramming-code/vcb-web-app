import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { U, warm, APP, tok } from './harness.mjs';
await warm();
const OUT = fileURLToPath(new URL('./.out/handover', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:false, userDataDir: fileURLToPath(new URL('./.out/chrome-walk', import.meta.url)),
  defaultViewport:{width:1440,height:950}, args:['--no-first-run'] });
const p = (await b.pages())[0];
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const settle = (ms=2500)=>new Promise(r=>setTimeout(r,ms));
const click = async (l)=>p.evaluate(x=>{const e=[...document.querySelectorAll('button,a')].find(y=>y.innerText.includes(x));if(e){e.click();return true;}return false;},l);
const pickDemo = async ()=>p.evaluate(()=>{const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.text.includes('สาธิต')));if(!s)return false;const o=[...s.options].find(o=>o.text.includes('สาธิต'));Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));return true;});

await p.goto(APP,{waitUntil:'domcontentloaded'});
await p.evaluate(t=>{localStorage.clear();localStorage.setItem('hr_access_token',t);},tok(U.admin));
await p.goto(APP+'/performance',{waitUntil:'networkidle2'}).catch(()=>{});
await settle(3500);
await p.screenshot({path:`${OUT}/1-ภาพรวม.png`});
console.log('1 ภาพรวม:', (await p.evaluate(()=>document.body.innerText)).replace(/\n+/g,' | ').slice(120,300));

await click('แรงงาน-วัน'); await settle(1500); await pickDemo(); await settle(3000);
await p.screenshot({path:`${OUT}/2-แรงงานวัน.png`});
const t2 = await p.evaluate(()=>document.body.innerText);
console.log('2 แรงงาน-วัน:', t2.replace(/\n+/g,' | ').slice(150,380));

await click('รายงานและตรวจสอบ'); await settle(4000);
await p.screenshot({path:`${OUT}/3-รายงาน.png`, fullPage:true});
const t3 = await p.evaluate(()=>document.body.innerText);
console.log('3 รายงาน:', t3.replace(/\n+/g,' | ').slice(150,420));

await click('การลา'); await settle(3000);
await p.screenshot({path:`${OUT}/4-การลา.png`});

await p.setViewport({width:390,height:844,isMobile:true});
await p.goto(APP+'/performance?tab=manday',{waitUntil:'networkidle2'}).catch(()=>{});
await settle(3000); await pickDemo(); await settle(3000);
await p.screenshot({path:`${OUT}/5-มือถือ.png`, fullPage:true});
console.log('5 มือถือ ล้นขวา:', await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth), 'px');
console.log('errors:', [...new Set(errs)].slice(0,3).join(' | ')||'(ไม่มี)');
console.log('ภาพเก็บที่:', OUT);
await b.close(); process.exit(0);
