/**
 * Clean the HTML a person typed before it is stored and shown to everyone else.
 *
 * Minutes are authored in the browser and read by the rest of the company, so
 * the body is untrusted markup on its way to other people's screens. Allow only
 * the tags and attributes the editor can actually produce; everything else goes.
 *
 * Allow-list, never a block-list: a block-list is a promise to have thought of
 * every attack, and we already had an SVG slip through elsewhere in this system.
 */

// Tags the editor's toolbar can create, plus the ones a paste from Word or
// Google Docs legitimately brings with it.
const ALLOWED = new Set([
  'p', 'br', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
]);

// Per-tag attribute allow-list. Anything not named here is dropped, which takes
// out every on* handler without having to enumerate them.
const ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  col: ['span'],
  colgroup: ['span'],
  '*': ['data-checked'],   // the checklist marker the editor writes
};

const VOID = new Set(['br', 'hr', 'img', 'col']);

/** หนีอักขระในค่าของแอตทริบิวต์ — เข้มที่สุด & ทุกตัวถูกหนี */
const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * หนีอักขระในเนื้อข้อความ โดยไม่หนีสิ่งที่ถูกหนีไว้แล้ว
 *
 * ของเดิมหนี & ทุกตัวรวมทั้งตัวที่เป็นส่วนหนึ่งของอักขระอ้างอิงที่ถูกต้องอยู่แล้ว
 * "SG&amp;A" ที่วางมาจาก Google Docs จึงกลายเป็น "SG&amp;amp;A" แล้วขึ้นบนจอว่า
 * "SG&amp;A" ตรง ๆ — พบตอนนำเข้าบันทึกการประชุมจริง 27 จาก 82 ฉบับมีอาการนี้ และ
 * ใครพิมพ์ "A & B" ในตัวแก้ไขของเราเองก็เจอเหมือนกัน เพราะเบราว์เซอร์ส่ง &amp; มา
 *
 * ปล่อยอักขระอ้างอิงผ่านได้อย่างปลอดภัย: ในตำแหน่งข้อความ &lt;script&gt; คือ
 * ตัวอักษรที่อ่านว่า <script> ไม่ใช่แท็ก เบราว์เซอร์ไม่เคยตีความมันเป็นแท็ก
 * (ต่างจากในค่าแอตทริบิวต์ ซึ่งยังใช้ escAttr เข้ม ๆ ตามเดิม)
 */
const escText = (s) => String(s)
  .replace(/&(?!#\d{1,7};|#[xX][0-9a-fA-F]{1,6};|[a-zA-Z][a-zA-Z0-9]{1,31};)/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * ถอดอักขระอ้างอิงในค่าที่เป็น URL ก่อนตรวจว่าปลอดภัยไหม
 *
 * ต้องถอดก่อนตรวจ ไม่ใช่หลัง: เบราว์เซอร์ถอดให้เองตอนผู้ใช้กดลิงก์ ถ้าตรวจจาก
 * ข้อความดิบ "&#106;avascript:alert(1)" จะผ่านทุกด่าน แล้วค่อยกลายเป็น
 * javascript: ตอนที่มีคนกด — ซึ่งก็คือช่องที่เรากำลังปิดอยู่นี่เอง
 */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n', semi: ';' };
function decodeRefs(raw) {
  return String(raw)
    // ตัวเลขถอดได้แม้ไม่มีอัฒภาค เบราว์เซอร์ก็ถอด ("&#106avascript:")
    .replace(/&#(\d{1,7});?/g, (m, d) => { try { return String.fromCodePoint(+d); } catch { return m; } })
    .replace(/&#[xX]([0-9a-fA-F]{1,6});?/g, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return m; } })
    // ชื่อที่เบราว์เซอร์ยอมให้ไม่มีอัฒภาคมีแค่ชุดเก่าสี่ตัวนี้
    .replace(/&(amp|lt|gt|quot);?/gi, (m, n) => NAMED[n.toLowerCase()])
    // ที่เหลือต้องมีอัฒภาค — ถ้าถอดโดยไม่บังคับ URL จริงอย่าง "?a=1&tab=t.0"
    // จะถูกแปลงเป็นแท็บแล้วลิงก์ของลูกค้าก็พัง
    .replace(/&(apos|colon|tab|newline|semi);/gi, (m, n) => NAMED[n.toLowerCase()]);
}

/** A link or image target we are willing to put in front of a reader.
 *  ตรวจจาก "สิ่งที่เบราว์เซอร์จะได้จริง" — ถอดอักขระอ้างอิงและช่องว่างที่เบราว์เซอร์
 *  ไม่สนใจออกก่อน ("&#106;avascript:", "java\tscript:") แล้วคืนค่าดิบไปเขียนต่อ */
function safeUrl(raw, { image = false } = {}) {
  const v = decodeRefs(String(raw || '')).trim();
  if (!v) return null;
  const probe = v.replace(/[\s\u0000-\u001f]/g, '');
  // javascript:, vbscript:, and data: URIs that can carry script. An image may
  // be a data: URI only when it is a real raster image — an SVG data URI is a
  // document that can run script.
  if (/^(javascript|vbscript|file):/i.test(probe)) return null;
  if (/^data:/i.test(probe)) {
    if (!image) return null;
    return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(probe) ? v : null;
  }
  if (/^(https?:)?\/\//i.test(probe) || probe.startsWith('/') || probe.startsWith('#')) return v;
  if (/^mailto:|^tel:/i.test(probe)) return v;
  return null;
}

/**
 * Rewrite `html` keeping only what is on the allow-list.
 *
 * A hand-rolled pass rather than a parser dependency: the input is our own
 * editor's output, the allow-list is small, and anything that does not match
 * the shape of a tag is escaped as text rather than passed through.
 */
export function sanitizeHtml(html, { maxLength = 400000 } = {}) {
  const src = String(html || '').slice(0, maxLength);
  let out = '';
  let i = 0;
  const open = [];

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { out += escText(src.slice(i)); break; }
    out += escText(src.slice(i, lt));

    // comments and CDATA go entirely, including anything hiding inside them
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
      continue;
    }

    // "<" ที่ไม่ได้ตามด้วยตัวอักษร / "/" / "!" / "?" ไม่ใช่การเปิดแท็ก มันคือ
    // เครื่องหมายน้อยกว่าที่คนพิมพ์ ("งบ 5 < 10 ล้าน") เบราว์เซอร์ก็อ่านเป็น
    // ข้อความแบบนั้น แต่ของเดิมกระโดดไปหา ">" ตัวถัดไปแล้วกลืนทุกอย่างระหว่าง
    // ทางทิ้ง — ประโยคขาดหายไปกลางบรรทัดโดยไม่มีอะไรบอก
    if (!/[a-zA-Z/!?]/.test(src[lt + 1] || '')) { out += '&lt;'; i = lt + 1; continue; }

    const gt = src.indexOf('>', lt);
    if (gt < 0) { out += escText(src.slice(lt)); break; }

    const raw = src.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (!raw) continue;

    // closing tag
    if (raw[0] === '/') {
      const name = raw.slice(1).trim().toLowerCase();
      if (!ALLOWED.has(name) || VOID.has(name)) continue;
      const at = open.lastIndexOf(name);
      if (at < 0) continue;
      // close anything left open inside it, so a stray <b> cannot leak styling
      // across the rest of the document
      for (let k = open.length - 1; k >= at; k -= 1) out += `</${open[k]}>`;
      open.length = at;
      continue;
    }

    const m = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(raw);
    if (!m) continue;
    const name = m[1].toLowerCase();
    // script/style content would otherwise be emitted as text; drop the body too
    if (name === 'script' || name === 'style') {
      const close = new RegExp(`</\\s*${name}\\s*>`, 'i').exec(src.slice(i));
      i += close ? close.index + close[0].length : src.length;
      continue;
    }
    if (!ALLOWED.has(name)) continue;

    const allowed = new Set([...(ATTRS[name] || []), ...ATTRS['*']]);
    let attrs = '';
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let a;
    while ((a = re.exec(raw))) {
      const key = a[1].toLowerCase();
      if (!allowed.has(key)) continue;
      let val = a[3] ?? a[4] ?? a[5] ?? '';
      if (key === 'href' || key === 'src') {
        const url = safeUrl(val, { image: name === 'img' });
        if (!url) continue;
        val = url;
      }
      if ((key === 'width' || key === 'height' || key === 'colspan' || key === 'rowspan' || key === 'span')
        && !/^\d{1,4}$/.test(val)) continue;
      attrs += ` ${key}="${escAttr(val)}"`;
    }
    // a link that opens elsewhere must not hand the opener to the target page
    if (name === 'a' && /target="_blank"/.test(attrs) && !/rel=/.test(attrs)) {
      attrs += ' rel="noopener noreferrer"';
    }

    if (VOID.has(name)) { out += `<${name}${attrs}>`; continue; }
    out += `<${name}${attrs}>`;
    open.push(name);
  }

  for (let k = open.length - 1; k >= 0; k -= 1) out += `</${open[k]}>`;
  return out;
}

/** Plain text of some HTML — for the list excerpt and for search. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
