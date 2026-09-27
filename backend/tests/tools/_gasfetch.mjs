/** เรียกฟังก์ชันฝั่งเซิร์ฟเวอร์ของแอป Apps Script ลูกค้า (อ่านอย่างเดียว) แล้วเก็บผลเป็น JSON */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const OUT = process.env.OUT, PAGE = process.env.URL;
const CALLS = JSON.parse(process.env.CALLS || '[["getData",[]]]');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: `${OUT}.chrome`, defaultViewport: { width: 1400, height: 900 } });
const p = (await b.pages())[0];
p.setDefaultTimeout(180000);
await p.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 9000));
const f = p.frames().find((x) => x.name() === 'userHtmlFrame') || p.mainFrame();
const out = {};
let i = 0;
for (const [fn, args] of CALLS) {
  const key = CALLS.filter((c) => c[0] === fn).length > 1 ? `${fn}#${i++}` : fn;
  try {
    out[key] = await f.evaluate((fn, args) => new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('หมดเวลา')), 170000);
      google.script.run.withSuccessHandler((v) => { clearTimeout(to); res(v); })
        .withFailureHandler((e) => { clearTimeout(to); rej(new Error(String(e && e.message || e))); })[fn](...args);
    }), fn, args);
    console.log(key, JSON.stringify(args), 'ok', JSON.stringify(out[key]).length);
  } catch (e) { out[key] = { __error: e.message }; console.log(key, 'ล้มเหลว:', e.message); }
}
fs.writeFileSync(OUT, JSON.stringify(out));
await b.close();
