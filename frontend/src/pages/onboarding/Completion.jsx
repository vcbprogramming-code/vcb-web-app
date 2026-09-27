import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { pick } from '../../lib/onboardingProgram.js';
import { useT } from '../../lib/i18n.jsx';

/**
 * สำเร็จการปฐมนิเทศ — และใบประเมินสองหน้าที่พิมพ์ออกมาเซ็น
 *
 * ของเขาไม่ใช่ "ใบรับรอง" ที่เขียนว่าผ่านแล้ว แต่เป็น **แบบให้คะแนน** ที่หัวหน้า
 * ฝ่ายวงเลข 1–5 ด้วยปากกาแล้วเซ็น ฝ่ายบุคคลเก็บเข้าแฟ้มเมื่อครบ 90 วัน โครงสร้าง
 * จึงต้องเหมือนกันสองหน้า:
 *   หน้า 1 ตารางงานทีละข้อ + ช่องวงคะแนน 1–5 ต่อข้อ
 *   หน้า 2 Attitude & Working Relationships 6 หัวข้อ + ช่องความเห็น + ช่องเซ็น
 *
 * หมวด "เอกสารที่ต้องศึกษา" **ไม่อยู่ในใบพิมพ์** ตามเหตุผลที่เขาเขียนไว้: การให้
 * คะแนน 1–5 ว่า "อ่านหรือยัง" ไม่มีความหมาย และไม่มีใครตรวจได้เป็นอิสระ สิ่งที่
 * พิสูจน์ว่าอ่านแล้วคือผลงานที่ต้องส่งมอบ ซึ่งอยู่ในใบอยู่แล้ว เราคัดออกด้วย
 * ลำดับบล็อก (บล็อกแรกของทุกเฟส) ไม่ใช่จับคู่ข้อความหัวบล็อก ซึ่งจะพลาดทันที
 * ที่หัวบล็อกถูกแปลหรือถูกแก้คำ
 *
 * เปิดเป็นหน้าต่างใหม่ ไม่ใช่ window.print() ของหน้านี้ — ไม่งั้นเมนู ชั้นวาง
 * และแถบความคืบหน้าจะติดไปในกระดาษด้วย
 */
const HEAD_OF_DEPT = {
  accounting: 'คุณวันเพ็ญ ยำพลอย (หัวหน้าฝ่ายบัญชี)',
  finance: 'คุณวิวิชญ์ ชวนะนันท์ (หัวหน้าฝ่ายการเงิน)',
  procurement: 'คุณธงทิพย์ ชวนะนันท์ (หัวหน้าฝ่ายจัดซื้อ)',
  property: 'คุณวัชริทธิ์ ชวนะนันท์ (หัวหน้าฝ่ายบริหารทรัพย์สิน)',
  engineering: 'คุณวิวัฒน์ ชวนะนันท์ (หัวหน้าฝ่ายวิศวกรรม)',
};

/** หกหัวข้อของหน้า 2 — คงที่ ไม่ผูกกับเฟสหรือแผนกใด เหมือนของเขา */
const ATTITUDE = [
  'ทัศนคติและวินัย',
  'การทำงานเป็นทีมและความร่วมมือ',
  'การสื่อสาร',
  'ความคิดริเริ่มและความเป็นเจ้าของงาน',
  'ความน่าเชื่อถือและการตรงต่อเวลา',
  'ความสามารถในการปรับตัว',
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


export default function Completion({ dept, status, me, lang = 'th' }) {
  const t = useT();

  /**
   * สร้าง HTML ของใบพิมพ์
   *
   * อยู่ข้างในคอมโพเนนต์ ไม่ใช่ฟังก์ชันระดับบนสุดที่รับ t เป็นพารามิเตอร์ —
   * กติกาของ i18n:check คือฟังก์ชันที่เรียก t() ต้องมองเห็น useT() ของตัวเอง
   * และห้ามมีอะไรอื่นชื่อ t ในไฟล์ที่แปลภาษา (เคยมีตัวแปรชื่อ t มาบังจนหน้าจอว่าง)
   */
  const buildFormHtml = () => {
    const phases = dept?.phases || [];
    const name = me?.name || '';
    const track = status.track;
    const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH',
      { year: 'numeric', month: 'long', day: 'numeric' });
    const dots = [1, 2, 3, 4, 5].map((n) => `<span class="dot">${n}</span>`).join('');
    const seniorOnly = track === 'senior';

    let bodies = '';
    for (const p of phases) {
      let rows = `<tr class="sec"><td colspan="2">${esc(pick(lang, p.eyebrow, p.eyebrow_th) || pick(lang, p.title, p.title_th))}</td></tr>`;
      // บล็อกแรกของทุกเฟสคือ "เอกสารที่ต้องศึกษา" — คัดออกจากใบพิมพ์
      for (const b of p.blocks.slice(1)) {
        const items = b.items.filter((i) => i.level === 'junior' || seniorOnly);
        if (!items.length) continue;
        rows += `<tr class="sub"><td colspan="2"><span class="sub-l">${esc(pick(lang, b.heading, b.heading_th))}</span>`
          + `<span class="sub-r">${esc(t('ให้คะแนน 1–5'))}</span></td></tr>`;
        for (const it of items) {
          const sr = it.level === 'senior';
          rows += `<tr><td class="task${sr ? ' sr' : ''}"><span class="tick">&#10003;</span>${esc(pick(lang, it.text, it.text_th))}`
            + `${sr ? `<span class="srbadge">${esc(t('ซีเนียร์'))}</span>` : ''}</td>`
            + `<td class="rate">${dots}</td></tr>`;
        }
      }
      bodies += `<tbody class="grp">${rows}</tbody>`;
    }

    const letterhead = `<div class="lh">
        <div class="co">${esc(t('บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'))}</div>
        <div class="co-sub">${esc(t('แบบประเมินการปฐมนิเทศ 90 วัน'))}</div>
      </div>`;

    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">
<title>${esc(t('แบบประเมินการปฐมนิเทศ 90 วัน'))}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Sarabun','Noto Sans Thai','Segoe UI',Arial,sans-serif;color:#1a1a2e;max-width:860px;margin:0 auto 32px;padding:0 24px;background:#fff}
.lh{padding:16px 0;border-bottom:3px solid #0a1440;margin-bottom:16px}
.co{font-size:14px;font-weight:700;color:#0a1440}
.co-sub{font-size:15px;font-weight:700;color:#2563EB;margin-top:2px}
.meta{display:flex;flex-wrap:wrap;gap:8px 28px;background:#eef1fb;border:1px solid #dde2f5;border-radius:10px;padding:11px 16px;margin-bottom:14px;font-size:11.5px}
.meta-i{display:flex;flex-direction:column}
.meta-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#666f9c;margin-bottom:2px}
.meta-v{font-weight:600}
table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10.5px;margin-bottom:8px;border:1px solid #e4e7f4}
td{border-bottom:1px solid #edf0fa;padding:3.5px 10px;vertical-align:middle}
tbody tr:nth-child(even):not(.sec):not(.sub) td{background:#f8f9fd}
.sec td{background:#2563EB;color:#fff;font-weight:700;padding:5px 10px}
.sub td{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#2563EB;font-weight:700;border-bottom:none;padding:5px 0 2px;background:#fff}
.sub-l{display:inline-block;width:calc(100% - 220px);vertical-align:middle;padding:0 10px}
.sub-r{display:inline-block;width:220px;vertical-align:middle;text-align:center;font-size:8px;color:#8a93b8;text-transform:none}
.tick{display:inline-block;width:16px;color:#16a34a;font-weight:700}
.task.sr{border-left:3px solid #a15c00}
.srbadge{display:inline-block;margin-left:5px;padding:1px 6px;border-radius:999px;background:#ffdcb0;color:#a15c00;font-size:7.5px;font-weight:700}
.rate{white-space:nowrap;text-align:center;width:220px}
.dot{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;margin:0 2.5px;border:1.5px solid #9aa5d4;border-radius:50%;font-size:9px;color:#2563EB;font-weight:600}
.brk{page-break-before:always}
.p2-t{font-size:14px;font-weight:700;color:#0a1440;margin:4px 0 3px}
.p2-s{font-size:11px;color:#666f9c;margin-bottom:16px}
.att{display:flex;align-items:center;gap:16px;padding:10px 14px;border:1px solid #e4e7f4;border-radius:10px;margin-bottom:8px}
.att:nth-child(even){background:#f8f9fd}
.att-l{font-size:12px;font-weight:600;flex:1}
.att-r{white-space:nowrap;text-align:center;width:220px;flex:none;margin-right:-14px}
.cmt{margin-top:18px}
.cmt-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#666f9c;font-weight:700;margin-bottom:6px}
.cmt-line{border-bottom:1px solid #d7dbef;height:26px}
.sign{margin-top:28px;display:flex;gap:60px;flex-wrap:wrap}
.sign-b{flex:1 1 260px}
.sign-l{border-bottom:1.5px solid #1a1a2e;height:36px;margin-bottom:6px}
.sign-t{font-size:11px;color:#444}
.ft{margin-top:22px;padding-top:10px;border-top:1px solid #e4e7f4;font-size:9.5px;color:#9aa0b4;text-align:center}
@media print{body{margin:0;padding:0 16px}tr{page-break-inside:avoid}tbody.grp{page-break-inside:avoid}
.sec,.att{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
${letterhead}
<div class="meta">
  <div class="meta-i"><span class="meta-l">${esc(t('พนักงาน', null, 'onboarding-form'))}</span><span class="meta-v">${esc(name)}</span></div>
  <div class="meta-i"><span class="meta-l">${esc(t('แผนก'))}</span><span class="meta-v">${esc(dept ? (lang === 'en' ? dept.name : (dept.name_th || dept.name)) : '')}</span></div>
  <div class="meta-i"><span class="meta-l">${esc(t('ระดับ'))}</span><span class="meta-v">${esc(seniorOnly ? t('ซีเนียร์') : t('จูเนียร์'))}</span></div>
  <div class="meta-i"><span class="meta-l">${esc(t('วันที่'))}</span><span class="meta-v">${esc(dateStr)}</span></div>
</div>
<table><colgroup><col><col style="width:220px"></colgroup>${bodies}</table>
<div class="brk">
  ${letterhead}
  <div class="p2-t">Attitude &amp; Working Relationships</div>
  <div class="p2-s">${esc(t('การประเมินภาพรวมด้านความประพฤติ การทำงานเป็นทีม และการเข้ากับผู้อื่นในช่วง 90 วัน'))}</div>
  ${ATTITUDE.map((a) => `<div class="att"><span class="att-l">${esc(t(a))}</span><span class="att-r">${dots}</span></div>`).join('')}
  <div class="cmt"><div class="cmt-l">${esc(t('ความเห็นทั่วไป'))}</div>
    ${'<div class="cmt-line"></div>'.repeat(6)}</div>
  <div class="sign">
    <div class="sign-b"><div class="sign-l"></div><div class="sign-t">${esc(t('ลายมือชื่อพนักงาน'))} — ${esc(name)}</div></div>
    <div class="sign-b"><div class="sign-l"></div><div class="sign-t">${esc(t('ลายมือชื่อหัวหน้าฝ่าย'))}${dept && HEAD_OF_DEPT[dept.slug] ? ` — ${esc(t(HEAD_OF_DEPT[dept.slug]))}` : ''}</div></div>
  </div>
  <div class="ft">${esc(t('บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด'))} — ${esc(dateStr)}</div>
</div>
</body></html>`;
  };

  const openForm = () => {
    const html = buildFormHtml();
    // หน้าต่างแยกจริง (ระบุขนาด) ไม่ใช่แท็บ — กล่องพิมพ์ของแท็บใหม่จะล็อกทั้ง
    // หน้าต่างเบราว์เซอร์ไว้ รวมถึงแท็บที่พนักงานเปิดโปรแกรมอยู่ ซึ่งดูเหมือน
    // ระบบค้าง จนกว่าจะปิดกล่องพิมพ์ทิ้ง — ข้อนี้เขาเจอมาแล้วและเขียนไว้
    const win = window.open('', '_blank', 'width=900,height=1000,left=100,top=60');
    if (!win) { window.alert(t('กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์แบบประเมิน')); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (!status.allComplete) {
    return (
      <div className="card space-y-2 py-10 text-center">
        <Icon name="lock" className="mx-auto h-8 w-8 text-slate-300" />
        <h3 className="font-bold text-slate-700">{t('ยังไม่เสร็จ')}</h3>
        <p className="text-sm text-slate-500">
          {t('หน้านี้จะปลดล็อกเมื่อทุกข้อในเช็กลิสต์ครบทั้งสามระยะของแผนกคุณเสร็จสมบูรณ์')}
        </p>
      </div>
    );
  }

  const total = status.phases.reduce((a, p) => a + p.total, 0);
  return (
    <div className="space-y-4">
      <div className="card space-y-2 text-center">
        <Icon name="check" className="mx-auto h-12 w-12 text-emerald-500" />
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t('สำเร็จการปฐมนิเทศ')}</p>
        <h2 className="text-xl font-bold text-slate-900">{t('ยินดีต้อนรับสู่ทีมของเราอย่างเป็นทางการ!')}</h2>
        <p className="text-slate-600">
          {t('ทำรายการครบทั้ง {n} รายการของ{dept}', { n: total, dept: dept ? (dept.name_th || dept.name) : '' })}
        </p>
        <p className="text-sm text-slate-400">
          {t('ระดับ')} {status.track === 'senior' ? t('ซีเนียร์') : t('จูเนียร์')}
          {status.startedAt ? ` · ${t('เริ่ม')} ${new Date(status.startedAt).toLocaleDateString('th-TH')}` : ''}
        </p>
      </div>

      <div className="card flex flex-wrap items-center justify-center gap-3">
        <button onClick={openForm} className="btn-primary">
          <Icon name="document" className="h-4 w-4" /> {t('พิมพ์แบบประเมินการปฐมนิเทศ')}
        </button>
        <Link to="/" className="btn-outline">
          {t('กลับไปหน้าหลัก VCB Connect')} <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
