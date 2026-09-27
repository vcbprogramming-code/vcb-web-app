import { api, apiBlobUrl, apiUpload } from './api.js';

const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

/** รายงานการประชุม — minutes per group, every version kept. */
export const meetingsApi = {
  // สิทธิ์การเข้าถึงสามระดับ (ข้อกำหนดฟังก์ชัน §3.9)
  access: () => api('/meetings/access'),
  addGuests: (groupId, emails) => api(`/meetings/groups/${groupId}/guests`, { method: 'POST', body: { emails } }),
  removeGuest: (groupId, email) =>
    api(`/meetings/groups/${groupId}/guests/${encodeURIComponent(email)}`, { method: 'DELETE' }),

  bootstrap: () => api('/meetings/bootstrap'),
  list: ({ groupId, q } = {}) => api(`/meetings${qs({ groupId, q })}`),
  get: (id) => api(`/meetings/${id}`),
  version: (id, seq) => api(`/meetings/${id}/versions/${seq}`),

  // สิ่งที่หน้าพิมพ์ต้องมีแต่เบราว์เซอร์ทำเองไม่ได้ (QR + ลิงก์ตรวจสอบ)
  print: (id) => api(`/meetings/${id}/print`),
  // เอาเนื้อหาของเวอร์ชันเก่ากลับมา — เป็นการแก้ไขครั้งหนึ่ง ไม่ใช่การย้อนเวลา
  restore: (id, seq) => api(`/meetings/${id}/versions/${seq}/restore`, { method: 'POST' }),

  create: (body) => api('/meetings', { method: 'POST', body }),
  update: (id, body) => api(`/meetings/${id}`, { method: 'PATCH', body }),
  togglePin: (id) => api(`/meetings/${id}/pin`, { method: 'POST' }),
  remove: (id) => api(`/meetings/${id}`, { method: 'DELETE' }),

  /**
   * แนบไฟล์
   *
   * ต้องใช้ apiUpload ไม่ใช่ api: api() ตั้ง Content-Type เป็น application/json
   * แล้ว JSON.stringify ตัว body ทิ้ง ฉะนั้น FormData ที่ส่งเข้าไปจะกลายเป็น "{}"
   * multer มองไม่เห็น multipart เลยและเซิร์ฟเวอร์ตอบ 400 "ไม่พบไฟล์ที่แนบมา"
   * ทุกครั้ง — การแนบไฟล์จากหน้าอ่านรายงานจึงไม่เคยทำงานเลยจนกว่าจะแก้ตรงนี้
   * (พบจาก meetings-flows.ui.mjs ซึ่งขับหน้าจอจริง ชุดที่เรียก API ตรง ๆ ไม่เจอ)
   */
  attach: (id, file, kind = 'file') =>
    apiUpload(`/meetings/${id}/attachments`, file, { extra: { kind } }),
  fileUrl: (id, attId) => apiBlobUrl(`/meetings/${id}/attachments/${attId}`),
  removeFile: (id, attId) => api(`/meetings/${id}/attachments/${attId}`, { method: 'DELETE' }),

  comment: (id, body) => api(`/meetings/${id}/comments`, { method: 'POST', body: { body } }),
  removeComment: (id, cid) => api(`/meetings/${id}/comments/${cid}`, { method: 'DELETE' }),

  tag: (id, groupId) => api(`/meetings/${id}/tags`, { method: 'POST', body: { groupId } }),
  untag: (id, groupId) => api(`/meetings/${id}/tags/${groupId}`, { method: 'DELETE' }),

  createGroup: (body) => api('/meetings/groups/new', { method: 'POST', body }),
  updateGroup: (id, body) => api(`/meetings/groups/${id}`, { method: 'PATCH', body }),
  removeGroup: (id) => api(`/meetings/groups/${id}`, { method: 'DELETE' }),
};

/** dd/mm/พ.ศ. — ใช้กับเวลาที่ระบบเป็นคนประทับ (ความเห็น เวอร์ชัน ประวัติ) */
export const thaiDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
};

/** วัน เวลา ครบ — ใช้ในสายเวลาประวัติการทำงาน ที่ลำดับของเหตุการณ์คือสาระ */
export const thaiDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${thaiDate(v)} ${hh}:${mm}`;
};

export const TH_MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const EN_MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * วันประชุมอย่างที่คนอ่าน — "15 ก.ย. 2569" (อังกฤษ: "15 Sep 2569")
 *
 * รูปแบบเดียวทั้งโมดูล ตาม fmtDate ของเขา และลำดับการถอยก็เหมือนกัน: ใช้วันที่จริง
 * ก่อน ถ้าไม่มีจึงใช้ข้อความที่ผู้ใช้พิมพ์ไว้ — เพราะวันที่จริงเรียงลำดับได้และ
 * สะกดเหมือนกันทุกแถว ส่วนข้อความที่พิมพ์ไว้มีค่าเมื่อมันเป็นสิ่งเดียวที่เหลืออยู่
 *
 * ปีเป็นพุทธศักราชทั้งสองภาษา เพราะเลขปีเป็น "ค่า" ที่คนที่นี่อ่านและพูดถึงกัน
 * ไม่ใช่คำที่แปลได้ — ระบบจริงของเขาก็เขียน "15 Sep 2569" แบบนี้
 */
export const meetingDateText = (m, lang = 'th', overviewLabel = 'ภาพรวม') => {
  const iso = m?.meeting_date ? String(m.meeting_date).slice(0, 10) : '';
  const p = iso.split('-');
  if (p.length === 3) {
    const y = +p[0]; const mo = +p[1]; const d = +p[2];
    const names = lang === 'en' ? EN_MONTHS_ABBR : TH_MONTHS_ABBR;
    if (y && mo >= 1 && mo <= 12 && d) return `${d} ${names[mo - 1]} ${y + 543}`;
  }
  if (m?.kind === 'overview') return overviewLabel;
  // ตัดโทเค็นเวลาท้ายข้อความออก มันมีที่แสดงของตัวเองอยู่แล้ว
  return String(m?.date_label || '').replace(/\s*\d{1,2}\s*[:.]\s*\d{2}\s*(?:AM|PM|am|pm|น\.?)?\s*$/i, '').trim() || '—';
};

/** สีน้ำเงินเข้มของแถบหัวและชิปที่ถูกเลือก — ค่าเดียวกับระบบจริงของลูกค้า
 *  เก็บเป็นค่าคงที่เพราะไม่ได้อยู่ในชุดสีของ Tailwind ที่โปรเจกต์ตั้งไว้ */
export const MTG_NAVY = '#0b3d62';

/** เวลาประชุม ลงท้าย "น." เสมอ — ของเขาต่อท้ายทุกครั้ง (fmtTime) */
export const meetingTimeText = (m) => {
  const s = String(m?.time_label || '').trim();
  if (!s) return '';
  return /น\.?\s*$/.test(s) ? s : `${s} น.`;
};

/** ค่าที่ควรอยู่ในช่องวันที่ของฟอร์ม — สิ่งที่ผู้ใช้พิมพ์ไว้ก่อน ไม่ใช่ ISO ที่
 *  เครื่องแปลงให้ คนที่พิมพ์ "21/05/2569" ไม่ควรเปิดมาเจอ "2026-05-21" */
export const dateFieldValue = (m) =>
  String(m?.date_label || '').trim() || (m?.meeting_date ? String(m.meeting_date).slice(0, 10) : '');

export const fileSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ── ตัวกรองช่วงเวลา ─────────────────────────────────────────────────────────
// สัปดาห์เริ่มวันจันทร์ เดือนเริ่มวันที่ 1 — เหมือน rangeCutoff ของเขา
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rangeCutoff = (range, now = new Date()) => {
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // (วันอาทิตย์=0) → จันทร์เป็นต้นสัปดาห์
    return isoOf(d);
  }
  if (range === 'month') return isoOf(new Date(now.getFullYear(), now.getMonth(), 1));
  return null;
};

/** แถวที่ไม่มีวันที่ตกนอกทุกช่วงที่ไม่ใช่ "ทั้งหมด" — ไม่ใช่เพราะเก่า แต่เพราะ
 *  ตอบไม่ได้ว่าอยู่ในช่วงไหน เดาแล้วนับผิดแย่กว่าไม่นับ */
export const inRange = (m, range, now = new Date()) => {
  if (!range || range === 'all') return true;
  const iso = m?.meeting_date ? String(m.meeting_date).slice(0, 10) : '';
  if (!iso) return false;
  return iso >= rangeCutoff(range, now);
};

// ── บทสรุปผู้บริหารที่ดึงจากเนื้อหาเอง ──────────────────────────────────────
// หัวข้อที่เอกสารของเขาใช้จริง ทั้งไทยและอังกฤษ (SUMMARY_RE ใน JavaScript.html)
const SUMMARY_RE = /สรุปผู้บริหาร|บทสรุป|executive\s*summary|ประเด็นสำคัญ/i;

const headingRank = (node) =>
  (node && node.nodeType === 1 && /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.charAt(1)) : 0);

/** ตัดส่วนของหัวข้อที่ตรงเงื่อนไขออกมา ตั้งแต่ใต้หัวข้อจนถึงหัวข้อระดับเท่ากัน
 *  หรือสูงกว่าตัวถัดไป และถอด style/class ทิ้งเพื่อไม่ให้ CSS ของเอกสารหลุดมา */
export const summarySection = (html) => {
  if (!html || typeof document === 'undefined') return '';
  const root = document.createElement('div');
  root.innerHTML = html;
  const els = root.children;
  for (let i = 0; i < els.length; i += 1) {
    const r = headingRank(els[i]);
    if (!r || !SUMMARY_RE.test((els[i].textContent || '').replace(/\s+/g, ' '))) continue;
    const wrap = document.createElement('div');
    for (let j = i + 1; j < els.length; j += 1) {
      const ej = els[j];
      const rj = headingRank(ej);
      if (rj && rj <= r) break;
      if (!(ej.textContent || '').trim() && !ej.querySelector('img,table,hr')) continue;
      wrap.appendChild(ej.cloneNode(true));
    }
    wrap.querySelectorAll('*').forEach((e) => {
      ['style', 'class', 'id', 'width', 'height', 'align', 'dir'].forEach((a) => e.removeAttribute(a));
    });
    return wrap.innerHTML.trim();
  }
  return '';
};

const concise = (raw) => {
  let t = String(raw || '').replace(/\s+/g, ' ').trim();
  // "หัวเรื่อง | เนื้อความ" หรือ "หัวเรื่อง: เนื้อความ" — เนื้อความคือสาระ
  const parts = t.split(/\s[|｜]\s|：\s?|:\s/);
  if (parts.length > 1) {
    const detail = parts.slice(1).join(' · ').trim();
    if (detail.length >= 12) t = detail;
  }
  if (t.length > 140) t = `${t.slice(0, 138).replace(/\s+\S*$/, '').trim()}…`;
  return t;
};

/** ไม่มีหัวข้อบทสรุปก็ตัดสี่บรรทัดแรกที่เป็นเนื้อหามาแทน */
export const summaryBullets = (html, max = 4) => {
  if (!html || typeof document === 'undefined') return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const t = concise(raw);
    const key = t.slice(0, 24);
    if (t.length < 6 || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  const lis = div.querySelectorAll('li');
  for (let i = 0; i < lis.length && out.length < max; i += 1) push(lis[i].textContent);
  if (!out.length) {
    const ps = div.querySelectorAll('p, h2, h3');
    for (let j = 0; j < ps.length && out.length < max; j += 1) {
      if ((ps[j].textContent || '').trim().length >= 24) push(ps[j].textContent);
    }
  }
  return out;
};

/** เอกสารที่มาจาก Fathom/Transkriptor เป็นสรุปที่เครื่องเขียน ไม่ใช่คน */
export const isAiSourced = (m) => m?.source === 'fathom' || m?.source === 'transkriptor';

/** ป้ายแหล่งที่มา — แสดงเฉพาะเมื่อไม่ใช่ที่คนพิมพ์เอง */
export const sourceLabel = (m) => (m?.source === 'fathom' ? 'Fathom'
  : m?.source === 'transkriptor' ? 'Transkriptor' : '');

// ── สิ่งที่หน้ากระดาษต้องมี ─────────────────────────────────────────────────

/** หัวจดหมายของบริษัท — ค่าเดียวกับ COMPANY_NAME ในระบบจริงของลูกค้า */
export const MTG_COMPANY = 'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด';

const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** "วันที่ 12 มิถุนายน 2569" — บรรทัดวันที่ใต้หัวจดหมาย เหมือน fmtThaiDate ของเขา
 *  ปีเป็นพุทธศักราชเสมอ เพราะนี่คือกระดาษที่ออกจากบริษัทไทย ไม่ใช่หน้าจอสองภาษา */
export const thaiLongDate = (m) => {
  const iso = m?.meeting_date ? String(m.meeting_date).slice(0, 10) : '';
  const p = iso.split('-');
  if (p.length !== 3) return '';
  const y = +p[0]; const mo = +p[1]; const d = +p[2];
  if (!y || !(mo >= 1 && mo <= 12) || !d) return '';
  return `วันที่ ${d} ${TH_MONTHS_FULL[mo - 1]} ${y + 543}`;
};

/**
 * ท้ายชื่อไฟล์ PDF — "12.6.69" (วัน.เดือน.ปี พ.ศ. สองหลัก ไม่เติมศูนย์)
 *
 * รูปแบบนี้ไม่ได้เลือกเอง มันคือชื่อไฟล์ที่อยู่ในโฟลเดอร์ส่งออกของลูกค้าอยู่แล้ว
 * (pdfDateSuffix_ ของเขา) จุดใช้ได้ในชื่อไฟล์ทุกระบบปฏิบัติการ ทับไม่ได้
 *
 * ถอยไปอ่านจากข้อความวันที่ที่ผู้ใช้พิมพ์ถ้าไม่มีวันที่จริง — ไฟล์ที่ไม่มีวันที่
 * ในชื่อจะแยกจากกันไม่ออกเลยเมื่ออยู่ในโฟลเดอร์เดียวกัน
 */
export const pdfDateSuffix = (m) => {
  let y; let mo; let d;
  const iso = m?.meeting_date ? String(m.meeting_date).slice(0, 10) : '';
  const p = iso.split('-');
  if (p.length === 3) { y = +p[0]; mo = +p[1]; d = +p[2]; }
  if (!(y && mo >= 1 && mo <= 12 && d)) {
    const hit = String(m?.date_label || '').match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})/);
    if (hit) { d = +hit[1]; mo = +hit[2]; y = +hit[3]; }
  }
  if (!(y && mo >= 1 && mo <= 12 && d)) return '';
  if (y < 100) y += 2500;          // "69" คือ 2569 ไม่ใช่ ค.ศ. 1969
  if (y < 2400) y += 543;          // ที่เก็บไว้เป็นคริสต์ศักราช → พุทธศักราช
  return `${d}.${mo}.${y % 100}`;
};

/** ชื่อไฟล์ที่เบราว์เซอร์จะเสนอตอนกด "บันทึกเป็น PDF" — <ชื่อเรื่อง> d.m.yy
 *  ถอดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออก ไม่อย่างนั้นเบราว์เซอร์จะตัดชื่อทิ้งเงียบ ๆ */
export const pdfFileName = (m) => {
  const base = String(m?.title || 'รายงานการประชุม').replace(/[\\/:*?"<>|]/g, '').trim()
    || 'รายงานการประชุม';
  const suffix = pdfDateSuffix(m);
  return suffix ? `${base} ${suffix}` : base;
};

// ── ขนาดตัวอักษรสำหรับอ่านบันทึก ────────────────────────────────────────────
// ของเขาเก็บค่านี้ต่อเครื่องไว้ใน localStorage และให้มีผลกับเนื้อหาที่อ่านเท่านั้น
// ไม่ใช่ทั้งแอป (ปุ่มกับแถบข้างขยายตามแล้วหน้าจอแตก) เราทำเหมือนกัน
const SIZE_KEY = 'mtg_reading_size';
export const READING_SIZES = ['small', 'normal', 'large'];
/** ตัวคูณขนาด ไม่ใช่ค่าพิกเซลตายตัว — เนื้อหามีหัวข้อหลายระดับ ถ้ากำหนดพิกเซล
 *  เดียวหัวข้อก็จะเท่ากับเนื้อความ */
export const READING_SCALE = { small: 0.9, normal: 1, large: 1.18 };

export const readReadingSize = () => {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    return READING_SIZES.includes(v) ? v : 'normal';
  } catch { return 'normal'; }   // โหมดส่วนตัว / ปิดที่เก็บของเว็บไซต์
};

export const writeReadingSize = (v) => {
  try { if (READING_SIZES.includes(v)) localStorage.setItem(SIZE_KEY, v); } catch { /* อ่านอย่างเดียวก็ยังใช้งานได้ */ }
};
