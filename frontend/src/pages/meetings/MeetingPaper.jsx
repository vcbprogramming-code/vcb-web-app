import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  meetingsApi, MTG_COMPANY, thaiLongDate, pdfFileName, isAiSourced,
  meetingDateText, meetingTimeText,
} from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import Spinner from '../../components/Spinner.jsx';
import { useT } from '../../lib/i18n.jsx';

/* ═══════════════════════════════════════════════════════════════════════════
   กระดาษ A4 จริงของรายงานการประชุม — ตัวอย่างบนจอและสิ่งที่ออกจากเครื่องพิมพ์
   คือชิ้นเดียวกัน

   ── เรขาคณิต ──────────────────────────────────────────────────────────────
   ค่าขอบกระดาษเป็นค่าเดียวกับที่ระบบจริงของลูกค้าใช้ (Index.html / OVERRIDE_CSS):
       @page { size: A4; margin: 2.7cm 17mm 2cm; }
   ขอบบน 2.7 ซม. ไม่ใช่เรื่องความสวย มันคือที่ว่างที่ QR ยืนอยู่ ถ้าลดลงมา QR จะ
   ทับบรรทัดแรกของเนื้อหา (ของเขาเคยเพิ่มจาก 1.7 เป็น 2.7 ซม. เพราะเรื่องนี้)

   แปลงเป็นพิกเซลที่ 96 จุดต่อนิ้ว ซึ่งเป็นมาตราที่เบราว์เซอร์ใช้จัดหน้าตอนพิมพ์
   ตัววัดบนจอกับหน้ากระดาษจึงใช้เลขชุดเดียวกันเป๊ะ ๆ ไม่ใช่สองชุดที่ "ใกล้กัน"

   ── ทำไมตัดหน้าเองแล้วพิมพ์หน้าที่ตัดไว้ ─────────────────────────────────────
   ของลูกค้าส่งเอกสารต่อเนื่องให้เบราว์เซอร์ตัดหน้าเอง แล้วใช้ Paged.js จำลอง
   การตัดนั้นบนจอ วิธีนี้ทำให้มีเครื่องจัดหน้า "สองเครื่อง" ที่ต้องเห็นตรงกัน และ
   PAGINATION.md ของเขาเป็นบันทึกการไล่ให้ตรงกันทีละข้อ (ขนาดกระดาษ ขอบซ้ายขวา
   orphans/widows) — ความไม่ตรงหนึ่งข้อที่ตกหล่นก็เลื่อนทุกหน้าใต้จุดนั้น

   เราตัดหน้าด้วยตัววัดของเราเอง (วิธีเดียวกับตัวอย่าง A4 ของ E-Memo: หาขอบล่าง
   ของ "บรรทัดจริง" ด้วย Range.getClientRects แล้วไม่ยอมตัดผ่านบรรทัด) แล้วส่ง
   หน้าที่ตัดแล้วไปให้เครื่องพิมพ์เป็นกล่องขนาด A4 ที่ตัดหน้าไว้แล้ว เครื่องจัดหน้า
   จึงมีเครื่องเดียว ตัวอย่างบนจอไม่ใช่ "การเดาว่าหน้าจะตกที่ไหน" มันคือหน้าเดียวกัน
   ═══════════════════════════════════════════════════════════════════════════ */

const MM = 96 / 25.4;              // พิกเซลต่อมิลลิเมตรที่ 96 จุดต่อนิ้ว
const PAGE_W = 210 * MM;           // 793.70
const PAGE_H = 297 * MM;           // 1122.52
const PAD_T = 27 * MM;             // ขอบบน 2.7 ซม. — ที่ว่างของ QR
const PAD_X = 17 * MM;
const PAD_B = 20 * MM;
const BODY_W = PAGE_W - PAD_X * 2; // 665.20
const USABLE_H = PAGE_H - PAD_T - PAD_B;

/** CSS ของเนื้อหา ใช้ทั้งในตัววัด ในตัวอย่างบนจอ และในหน้าที่พิมพ์ — ก้อนเดียว
 *  คัดลอกค่าข้ามที่ไหนก็จะเพี้ยนที่นั่น และความเพี้ยนหนึ่งจุดเลื่อนทุกหน้าใต้มัน */
const PAPER_CSS = `
.mtg-paper{font-family:'Noto Sans Thai',Sarabun,system-ui,sans-serif;color:#1f2328;font-size:15px;line-height:1.55;}
.mtg-paper .lh{font-size:21px;font-weight:700;color:#0b3d62;line-height:1.3;margin:0 0 4px;}
.mtg-paper .lhd{font-size:15px;color:#24486b;line-height:1.3;margin:0 0 12px;}
.mtg-paper .ai{font-size:12.5px;color:#57606a;background:#f6f8fa;border:1px solid #d8dee4;border-radius:6px;padding:8px 12px;margin:0 0 16px;line-height:1.5;}
.mtg-paper h1{font-size:21px;color:#0b3d62;font-weight:700;margin:18px 0 10px;}
.mtg-paper h2{font-size:17px;color:#0b3d62;font-weight:700;margin:14px 0 8px;}
.mtg-paper h3{font-size:16px;color:#24486b;font-weight:700;margin:12px 0 6px;}
.mtg-paper h4{font-size:15px;color:#24486b;font-weight:700;margin:10px 0 6px;}
.mtg-paper p{margin:0;padding:4px 0;}
.mtg-paper img{max-width:100%;height:auto;}
.mtg-paper a{color:#1f6feb;}
.mtg-paper table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;}
.mtg-paper td,.mtg-paper th{border:1px solid #d8dee4;padding:7px 10px;vertical-align:top;}
.mtg-paper th{background:#f1f5f9;font-weight:700;}
.mtg-paper ul{list-style:disc;margin:0;padding-left:26px;}
.mtg-paper ol{list-style:decimal;margin:0;padding-left:26px;}
.mtg-paper li{margin:0;padding:4px 0;}
.mtg-paper blockquote{border-left:3px solid #d8dee4;padding-left:14px;color:#475569;margin:8px 0;}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * HTML ของ "เนื้อกระดาษ" — หัวจดหมาย + คำเตือน AI + เนื้อหา
 *
 * หัวจดหมายเติมให้เฉพาะตอนที่เนื้อหาไม่ได้ขึ้นต้นด้วยชื่อบริษัทอยู่แล้ว เอกสารที่
 * นำเข้ามาจาก Google Docs ของลูกค้าจำนวนมากพิมพ์หัวของตัวเองไว้ในเนื้อหา เติมทับ
 * ลงไปก็ได้หัวสองหัวติดกัน (กฎเดียวกับ leadsWithCompany ของเขา)
 *
 * คำเตือน "สรุปที่สร้างโดย AI" ใส่ตอนเรนเดอร์เท่านั้น ไม่เคยเขียนลงเนื้อหาจริง —
 * ถ้าเก็บลงฐานข้อมูลมันจะกินสรุปย่อ 200 ตัวแรกและทำให้ทุกฉบับที่มาจากเครื่อง
 * ถอดเสียงค้นเจอด้วยคำว่า "สรุป" เหมือนกันหมด
 */
export function paperHtml(m) {
  const body = m?.content || '<p>(ไม่มีเนื้อหา)</p>';
  const plain = String(body).replace(/<[^>]*>/g, ' ').slice(0, 220);
  const leads = plain.includes('วิจิตรภัณฑ์ก่อสร้าง');
  const date = thaiLongDate(m);
  const head = leads ? '' : `<div class="lh">${esc(MTG_COMPANY)}</div>${date ? `<div class="lhd">${esc(date)}</div>` : ''}`;
  const ai = isAiSourced(m)
    ? '<p class="ai"><b>สรุปที่สร้างโดย AI:</b> สรุปนี้สร้างโดยอัตโนมัติ อาจมีข้อผิดพลาด โปรดอ่านที่ประเด็นหลักของการหารือ และตรวจสอบรายละเอียดที่สำคัญเมื่อจำเป็น</p>'
    : '';
  return head + ai + body;
}

/**
 * จุดที่ตัดหน้าได้ = ขอบล่างของทุกบรรทัดจริง และขอบล่างของทุกบล็อก
 *
 * Range.getClientRects คืนกรอบหนึ่งกรอบต่อหนึ่งบรรทัดที่เบราว์เซอร์จัดเอง จึงเป็น
 * วิธีเดียวที่รู้ว่าบรรทัดขึ้นใหม่ตรงไหนโดยไม่ต้องเดาจากความสูงบรรทัด (ข้อความไทย
 * ที่มีสระบนล่างทำให้ความสูงบรรทัดไม่เท่ากันทุกบรรทัด) — เทคนิคเดียวกับตัวอย่าง
 * A4 ของ E-Memo
 *
 * ตารางเก็บขอบล่างของ "แถว" ไม่ใช่ของบรรทัดข้างใน แถวหนึ่งจึงไม่ถูกผ่าครึ่ง แต่
 * ตารางยังขึ้นหน้าใหม่ระหว่างแถวได้ ซึ่งเป็นสิ่งที่ควรทำ
 */
function breakPoints(root) {
  const origin = root.getBoundingClientRect().top;
  const out = [];
  const isBlock = (el) => /^(P|DIV|H1|H2|H3|H4|H5|H6|UL|OL|LI|TABLE|BLOCKQUOTE|PRE|FIGURE|HR|IMG)$/.test(el.tagName);

  const walk = (el) => {
    for (const child of el.children) {
      if (child.tagName === 'TABLE') {
        for (const tr of child.querySelectorAll('tr')) out.push(tr.getBoundingClientRect().bottom - origin);
        out.push(child.getBoundingClientRect().bottom - origin);
        continue;
      }
      const blockKids = Array.from(child.children).some(isBlock);
      if (blockKids) { walk(child); out.push(child.getBoundingClientRect().bottom - origin); continue; }
      const r = document.createRange();
      r.selectNodeContents(child);
      const rects = r.getClientRects();
      if (rects.length) for (const rc of rects) out.push(rc.bottom - origin);
      r.detach?.();
      out.push(child.getBoundingClientRect().bottom - origin);
    }
  };
  walk(root);
  return out.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
}

/**
 * ตัวอย่างและการพิมพ์กระดาษ A4 ของรายงานหนึ่งฉบับ
 *
 * เป็นชั้นคลุมของตัวเอง ไม่ได้ใช้ Modal กลาง: Modal กว้างสุด 672 พิกเซล ซึ่งแคบกว่า
 * กระดาษ A4 (794) ตัวอย่างหน้ากระดาษที่ต้องย่อลงเกือบครึ่งเพื่อให้พอดีกล่องไม่ได้
 * ทำหน้าที่ของตัวอย่างหน้ากระดาษ
 */
export default function MeetingPaper({ meeting, onClose }) {
  const t = useT();
  const toast = useToast();
  const m = meeting;
  const html = useMemo(() => paperHtml(m), [m]);

  const holderRef = useRef(null);   // กล่องที่วัดความกว้างที่มีให้ย่อกระดาษ
  const measureRef = useRef(null);  // ตัววัด: เนื้อหาชุดเดียวกัน กว้างเท่าเนื้อกระดาษ
  const [offsets, setOffsets] = useState([0]);
  const [scale, setScale] = useState(1);
  const [qr, setQr] = useState(null);   // { qrDataUri, verifyUrl, verifiable }
  const [ready, setReady] = useState(false);

  // Escape ต้องปิดตัวอย่างนี้ ไม่ใช่ปิดเอกสารที่อยู่ข้างหลัง — จับแบบ capture แล้ว
  // หยุดไม่ให้ไหลต่อ เพราะหน้าข้างหลังก็ฟัง Escape ของตัวเองอยู่
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = prev; };
  }, [onClose]);

  // QR + ลิงก์ตรวจสอบ มาจากเซิร์ฟเวอร์ (กุญแจอยู่ที่นั่น และเราไม่มีตัวสร้าง QR
  // ฝั่งเบราว์เซอร์) ล้มเหลวก็ยังพิมพ์ได้ แค่ไม่มีตรา
  useEffect(() => {
    let alive = true;
    meetingsApi.print(m.id)
      .then((r) => { if (alive) setQr(r.data); })
      .catch(() => { if (alive) setQr({ qrDataUri: '', verifyUrl: '', verifiable: false }); });
    return () => { alive = false; };
  }, [m.id]);

  useLayoutEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled || !measureRef.current) return;
      const pts = breakPoints(measureRef.current);
      const total = measureRef.current.scrollHeight || 0;

      // เดินหน้าละหน้า: หน้าหนึ่งเต็มลงมาถึงขอบพิมพ์ แล้วถอยกลับมาที่ขอบล่างของ
      // บรรทัดสุดท้ายที่ยังอยู่ในขอบ เฉพาะเมื่อมีบรรทัดคาบขอบอยู่จริง — ถ้าไม่ถอย
      // เลยบรรทัดที่คาบจะถูกผ่าครึ่ง ถ้าถอยทุกครั้งกระดาษก็เหลือที่ว่างท้ายหน้า
      // โดยไม่มีเหตุ
      const offs = [0];
      let start = 0;
      let guard = 0;
      while (start + USABLE_H < total - 2 && guard < 200) {
        const limit = start + USABLE_H;
        let last = 0;
        let straddles = false;
        for (const p of pts) {
          if (p > start + 1 && p <= limit + 0.5) last = p;
          else if (p > limit + 0.5) { straddles = true; break; }
        }
        // ไม่มีจุดตัดที่ใช้ได้ในหน้านี้เลย (บล็อกเดียวสูงเกินหนึ่งหน้า เช่น รูปใหญ่)
        // ก็ตัดที่ขอบพิมพ์ ยอมให้เสียหนึ่งจุด ดีกว่าวนไม่จบ
        const next = straddles && last > start + 1 ? last : limit;
        offs.push(next);
        start = next;
        guard += 1;
      }
      if (!cancelled) {
        setOffsets((prev) => (prev.length !== offs.length
          || prev.some((v, i) => Math.abs(v - offs[i]) > 0.5) ? offs : prev));
        setReady(true);
      }
    };

    // ฟอนต์เว็บโหลดแบบไม่พร้อมกับหน้า ความสูงของบรรทัดจึงเปลี่ยนหลังวาดรอบแรก —
    // วัดซ้ำเมื่อฟอนต์นิ่งแล้ว ไม่อย่างนั้นจุดตัดหน้าถูกคำนวณจากฟอนต์สำรอง
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => { cancelled = true; ro.disconnect(); };
  }, [html]);

  // ย่อกระดาษให้พอดีความกว้างที่มี — เป็นการย่อ "ภาพ" ด้วย transform เท่านั้น
  // ไม่ได้ย่อการจัดหน้า จุดตัดหน้าจึงไม่ขยับตามขนาดหน้าต่าง
  useLayoutEffect(() => {
    const fit = () => {
      const w = holderRef.current?.clientWidth || 0;
      if (w) setScale(Math.min(1, w / PAGE_W));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (holderRef.current) ro.observe(holderRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const pages = offsets.length;

  /**
   * พิมพ์ — ส่งหน้าที่ตัดไว้แล้วออกไป ไม่ใช่ส่งเอกสารต่อเนื่องให้เบราว์เซอร์ตัด
   *
   * พิมพ์จาก iframe ที่ถือสำเนา ไม่ใช่ window.print() ของหน้าทั้งหน้า ไม่อย่างนั้น
   * แถบข้าง รายการ และปุ่มทุกปุ่มติดไปในกระดาษ และ srcdoc ต้องเป็น HTML ที่ฝังมา
   * ตรง ๆ ไม่ใช่ URL ของ API (iframe ที่ชี้ API ใช้ได้ตอนทดสอบเครื่องตัวเองแต่
   * ว่างเปล่าบนโปรดักชันเพราะ X-Frame-Options)
   *
   * <title> คือชื่อไฟล์ที่เบราว์เซอร์เสนอตอน "บันทึกเป็น PDF" — "<ชื่อเรื่อง> d.m.yy"
   * ตามที่อยู่ในโฟลเดอร์ส่งออกของลูกค้าจริง ถ้าไม่ตั้ง ทุกไฟล์จะใช้ชื่อหน้าแม่
   * เหมือนกันหมดและแยกจากกันไม่ออกในโฟลเดอร์เดียว
   */
  const print = () => {
    const sheets = offsets.map((off, i) => `
      <div class="sheet">
        ${qr?.qrDataUri ? `<img class="qr" src="${qr.qrDataUri}" alt="">` : ''}
        <div class="win"><div class="flow mtg-paper" style="transform:translateY(-${off.toFixed(2)}px)">${html}</div></div>
        <div class="pn">หน้า ${i + 1}/${offsets.length}</div>
      </div>`).join('');

    const doc = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<title>${esc(pdfFileName(m))}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ขอบเป็นศูนย์เพราะขอบจริงถูกกันไว้ในกล่องหน้าแล้ว ถ้าตั้งขอบที่นี่อีกจะได้ขอบสองชั้น
   และกล่อง A4 ขนาดเต็มจะไม่พอหน้า แล้วเบราว์เซอร์จะแทรกหน้าว่างสลับทุกหน้า */
@page{size:A4;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
/* สูงน้อยกว่ากล่องหน้าครึ่งพิกเซลโดยเจตนา: กล่องหน้า A4 ที่ขอบศูนย์สูง 297 มม.
   ซึ่งคำนวณเป็นพิกเซลได้เลขทศนิยม ถ้ากล่องของเราสูงเท่ากันเป๊ะ การปัดเศษเสี้ยว
   พิกเซลเดียวก็ทำให้มันล้นหน้า แล้วเบราว์เซอร์จะแทรกหน้าว่างสลับทุกหน้า
   ครึ่งพิกเซลมองไม่เห็นบนกระดาษ และหน้าต่างที่ตัดเนื้อหา (.win) ยังสูงเท่าเดิม
   จุดตัดหน้าจึงไม่ขยับ */
.sheet{position:relative;width:${PAGE_W}px;height:${(PAGE_H - 0.5).toFixed(2)}px;overflow:hidden;break-after:page;page-break-after:always;}
.sheet:last-child{break-after:auto;page-break-after:auto;}
.win{position:absolute;top:${PAD_T}px;left:${PAD_X}px;width:${BODY_W}px;height:${USABLE_H}px;overflow:hidden;}
/* QR อยู่ในที่ว่างขอบบน 2.7 ซม. ที่กันไว้ให้มันแล้ว จึงทับเนื้อหาไม่ได้เลย —
   ไม่ต้องพึ่งกล่องขอบกระดาษของ @page ซึ่ง Chrome ไม่ยอมให้ CSS กำหนดขนาดภาพ */
.qr{position:absolute;top:${(8 * MM).toFixed(2)}px;right:${PAD_X}px;width:60px;height:60px;}
.pn{position:absolute;left:${PAD_X}px;right:${PAD_X}px;bottom:${(9 * MM).toFixed(2)}px;
  text-align:right;font-size:11px;color:#8b949e;font-family:'Noto Sans Thai',sans-serif;}
${PAPER_CSS}
.flow{width:${BODY_W}px;}
</style></head><body>${sheets}</body></html>`;

    const old = document.getElementById('mtg-print-frame');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'mtg-print-frame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
    f.srcdoc = doc;
    f.onload = () => {
      const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.print(); } };
      // รอฟอนต์ในกรอบนี้ก่อน ไม่อย่างนั้นข้อความถูกวัดด้วยฟอนต์สำรองแล้วล้นกรอบ
      // ที่ตัดไว้ (บรรทัดท้ายหน้าโดนตัดครึ่ง)
      const fonts = f.contentDocument?.fonts;
      if (fonts?.ready) fonts.ready.then(go).catch(go); else go();
    };
    document.body.appendChild(f);
  };

  const copyVerify = async () => {
    if (!qr?.verifyUrl) return;
    try { await navigator.clipboard.writeText(qr.verifyUrl); toast.success(t('คัดลอกลิงก์ตรวจสอบแล้ว')); }
    catch { toast.error(qr.verifyUrl); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60" role="dialog" aria-modal="true"
      aria-label={t('ตัวอย่างก่อนพิมพ์')}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <style>{PAPER_CSS}</style>

      <header className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{m.title}</p>
          <p className="truncate text-[11px] text-white/60">
            {m.group_name} · {meetingDateText(m)}{meetingTimeText(m) ? ` · ${meetingTimeText(m)}` : ''}
            {ready ? ` · ${pages} ${t('หน้า')}` : ''}
          </p>
        </div>
        {/* ชื่อไฟล์ที่จะได้ บอกไว้ก่อนกด ไม่ใช่ให้ไปเจอในกล่องบันทึกไฟล์ */}
        <span data-testid="mtg-pdf-name"
          className="hidden max-w-[16rem] truncate rounded bg-white/10 px-2 py-1 text-[11px] text-white/70 lg:inline"
          title={`${pdfFileName(m)}.pdf`}>{pdfFileName(m)}.pdf</span>
        <button onClick={print} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50">
          <Icon name="document" className="h-4 w-4" /> {t('พิมพ์ / PDF')}
        </button>
        <button onClick={onClose} aria-label={t('ปิด')}
          className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </header>

      {/* คำอธิบายตรา ต้องบอกตรง ๆ เมื่อ QR จะสแกนไม่ได้ผล ไม่ใช่ปล่อยให้แจกกระดาษ
          ที่สแกนแล้วขึ้นว่าไม่พบเอกสาร */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-700/70 px-4 py-1.5 text-[11px] text-white/70">
        <span className="inline-flex items-center gap-1">
          <Icon name="lock" className="h-3.5 w-3.5" />
          {qr?.qrDataUri
            ? (qr.verifiable ? t('มี QR ตรวจสอบความแท้ทุกหน้า') : t('ฉบับนี้ยังไม่เผยแพร่ — QR จะยังตรวจสอบไม่ได้จนกดเผยแพร่'))
            : t('ยังไม่มี QR สำหรับฉบับนี้')}
        </span>
        {qr?.verifyUrl && (
          <button onClick={copyVerify} className="underline hover:text-white">{t('คัดลอกลิงก์ตรวจสอบ')}</button>
        )}
        <span className="ml-auto">{t('ขอบกระดาษ A4 · บน 2.7 ซม. · ซ้ายขวา 17 มม. · ล่าง 2 ซม.')}</span>
      </div>

      <div ref={holderRef} className="flex-1 overflow-auto px-4 py-5">
        {!ready && <div className="flex justify-center py-10"><Spinner label={t('กำลังจัดหน้ากระดาษ…')} /></div>}
        <div className="mx-auto flex flex-col items-center gap-5"
          style={{ width: PAGE_W * scale }}>
          {offsets.map((off, i) => (
            <div key={i} data-testid="mtg-sheet" className="relative shrink-0 bg-white shadow-2xl"
              style={{
                width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left',
                // ย่อด้วย transform แล้วกล่องเดิมยังกินที่เท่าเดิมในการไหล — หักส่วน
                // ที่หายไปออกด้วย margin ลบ ไม่อย่างนั้นจะมีช่องว่างใหญ่ใต้ทุกหน้า
                marginBottom: -(PAGE_H * (1 - scale)),
                marginRight: -(PAGE_W * (1 - scale)),
              }}>
              {qr?.qrDataUri && (
                <img src={qr.qrDataUri} alt={t('QR ตรวจสอบความแท้')}
                  className="absolute" style={{ top: 8 * MM, right: PAD_X, width: 60, height: 60 }} />
              )}
              <div className="absolute overflow-hidden"
                style={{ top: PAD_T, left: PAD_X, width: BODY_W, height: USABLE_H }}>
                <div className="mtg-paper" style={{ width: BODY_W, transform: `translateY(${-off}px)` }}
                  dangerouslySetInnerHTML={{ __html: html }} />
              </div>
              {/* เลขหน้าอยู่บนกระดาษ ไม่ใช่บนหน้าจอ — ผืนเอกสารเป็นภาษาไทยเสมอ
                  ไม่ว่าคนอ่านจะตั้งภาษาแอปไว้เป็นอะไร (กฎเดียวกับหัวจดหมาย: สิ่งที่
                  พิมพ์ออกไปต้องอ่านเหมือนกันทุกใบ ไม่ใช่เปลี่ยนตามคนกดพิมพ์) */}
              <div className="absolute text-right text-[11px] text-slate-400"
                style={{ left: PAD_X, right: PAD_X, bottom: 9 * MM }}>
                หน้า {i + 1}/{pages}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ตัววัด: เนื้อหาชุดเดียวกันที่ความกว้างเนื้อกระดาษเป๊ะ ๆ ไหลต่อเนื่องไม่ตัดหน้า
          ต้องอยู่ในเอกสารจริงและวัดได้ จึงซ่อนด้วยการย้ายออกนอกจอ ไม่ใช่ display:none
          (ของที่ display:none ไม่มีขนาดให้วัดเลย) */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: BODY_W, pointerEvents: 'none' }}>
        <div ref={measureRef} className="mtg-paper" style={{ width: BODY_W }}
          dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
