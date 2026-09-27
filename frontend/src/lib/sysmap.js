import { api } from './api.js';

/** แผนผังระบบ (System Operating Map) — read by everyone, maintained by admins. */
export const sysmapApi = {
  bootstrap: () => api('/sysmap/bootstrap'),
  functions: () => api('/sysmap/functions'),
  ai: () => api('/sysmap/ai'),

  createLane: (body) => api('/sysmap/lanes', { method: 'POST', body }),
  updateLane: (id, body) => api(`/sysmap/lanes/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteLane: (id) => api(`/sysmap/lanes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createNode: (body) => api('/sysmap/nodes', { method: 'POST', body }),
  updateNode: (id, body) => api(`/sysmap/nodes/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteNode: (id) => api(`/sysmap/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createConn: (body) => api('/sysmap/conns', { method: 'POST', body }),
  deleteConn: (id) => api(`/sysmap/conns/${id}`, { method: 'DELETE' }),

  createFunction: (body) => api('/sysmap/functions', { method: 'POST', body }),
  updateFunction: (code, body) => api(`/sysmap/functions/${encodeURIComponent(code)}`, { method: 'PATCH', body }),
  deleteFunction: (code) => api(`/sysmap/functions/${encodeURIComponent(code)}`, { method: 'DELETE' }),

  createAi: (body) => api('/sysmap/ai', { method: 'POST', body }),
  updateAi: (key, body) => api(`/sysmap/ai/${encodeURIComponent(key)}`, { method: 'PATCH', body }),
  deleteAi: (key) => api(`/sysmap/ai/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

/** Pick the Thai text when there is one, else fall back to English.
 *  A blank Thai column must never render as an empty box on screen. */
export const pick = (lang, th, en) => (lang === 'th' && th ? th : (en || th || ''));

/** ป้ายเวอร์ชันของชุดข้อมูล — ตรงกับรุ่นที่ลูกค้าใช้อยู่จริง */
export const SYSMAP_VERSION = 'v8.86 · Jun 2026';

/**
 * How work moves from one box to the next.
 *
 * The words are the client's own, not ours. Their dictionary carries two labels
 * per type and they are not interchangeable: `label` is the short badge on a
 * connection row (ทริกเกอร์), `legend` is the longer phrase under the map
 * (เส้นกระตุ้น). We had invented four of our own (สั่งให้เริ่ม / ส่งข้อมูลต่อ /
 * ทำภายหลัง / มีเงื่อนไข) — readable, but not the words anyone in the company
 * says, so a conversation about the map had to be translated first.
 *
 * `kind` splits the four into the two families their map draws differently:
 * direct flow is a solid line, indirect (conditional / deferred) a dashed one,
 * and each family can be switched off on its own.
 */
export const CONN_META = {
  trigger:     { label: 'ทริกเกอร์',  legend: 'เส้นกระตุ้น',     color: '#38bdf8', kind: 'direct' },
  feeds:       { label: 'ป้อนข้อมูล', legend: 'ป้อนข้อมูลเข้า',   color: '#22d3ee', kind: 'direct' },
  deferred:    { label: 'เลื่อน',     legend: 'เลื่อน',           color: '#fbbf24', kind: 'indirect' },
  conditional: { label: 'เงื่อนไข',   legend: 'เงื่อนไข',         color: '#fb923c', kind: 'indirect' },
};
export const connMeta = (t) => CONN_META[t] || CONN_META.feeds;

/** สีประจำตระกูลเส้น ใช้ในคำอธิบายสัญลักษณ์ */
export const DIRECT_COLOR = '#38bdf8';
export const INDIRECT_COLOR = '#fbbf24';
/** เส้นย้อนกลับ — the `feedback` flag, drawn apart from the forward lines. */
export const FEEDBACK_COLOR = '#d6b16b';

/**
 * ผืนผังเป็นพื้นเข้ม ส่วนที่เหลือของแอปยังสว่าง
 *
 * ระบบที่ลูกค้าใช้จริงวาดผังบนพื้นกรมท่า และนั่นไม่ใช่รสนิยม: เส้น 129 เส้นกับ
 * กล่อง 79 กล่องที่ระบายสีประจำแผนก อ่านออกบนพื้นเข้มดีกว่าพื้นขาวมาก เพราะสี
 * แผนกเป็นสีเข้มทั้งชุด บนพื้นขาวมันกลืนกันไปหมด
 *
 * ขอบเขตคือ "ผืนผัง" เท่านั้น เหมือน E-Memo ที่มีแถบหัวกรมท่าบนหน้าสว่าง —
 * แถบหัว ModuleShell ทะเบียนฟังก์ชัน และตารางทั้งหมดยังเป็นธีมสว่างตามเดิม
 * และไม่แตะ ThemeContext ของ E-Memo แม้แต่บรรทัดเดียว
 */
export const CANVAS = {
  bg: 'linear-gradient(160deg,#0d1b2a 0%,#0b1220 55%,#111f38 100%)',
  panel: '#101c34',
  panelSoft: 'rgba(148,163,184,0.08)',
  border: 'rgba(148,163,184,0.22)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  faint: '#64748b',
};

/**
 * ตัวอักษรบนสีประจำแผนก — เลือกขาวหรือหมึกเข้มตามความสว่างจริงของสีนั้น
 *
 * กล่อง ERP ระบายทึบด้วยสีแผนก และสีแผนกชุดนี้สว่างไม่เท่ากันเลย: ขาวบน
 * #00695C อ่านสบาย (6.6:1) แต่ขาวบน #F57C00 เหลือ 2.7:1 ซึ่งตกเกณฑ์ ฝังสี
 * ตัวอักษรตายตัวจึงแปลว่ามีอย่างน้อยหนึ่งแผนกที่อ่านไม่ออก คำนวณเอาดีกว่า
 */
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const onColor = (hex) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const vsWhite = 1.05 / (L + 0.05);
  const vsInk = (L + 0.05) / 0.0589;   // #0b1220
  return vsWhite >= vsInk ? '#ffffff' : '#0b1220';
};

/**
 * ปฏิบัติการหน้างาน is a group in the function register but not a department.
 *
 * Their DEPT_META has seven departments; the register has eight groups, the
 * extra one being `site`. Keeping it out of sysmap_depts matches that — a site
 * is a place, not an owner, and adding a row would change a count the client
 * has already signed off on. So the group's name and colour live here, next to
 * the code that renders it, the way their `__site__` tab does.
 */
export const SITE_DEPT = {
  key: 'site',
  name_th: 'ปฏิบัติการหน้างาน',
  name_en: 'Site Operations',
  color: '#E65100',
};

/** แผนกของแถวหนึ่ง รวม site ที่ไม่ได้อยู่ในตารางแผนก */
export const deptOf = (depts, key) =>
  depts.find((d) => d.key === key) || (key === SITE_DEPT.key ? SITE_DEPT : null);

/**
 * ป้ายประเภทในทะเบียนฟังก์ชัน — คำของเขา ไม่ใช่ค่าดิบในฐานข้อมูล.
 *
 * The column stores the upstream English ("Non-ERP → ERP"), which we were
 * printing straight onto the screen. Their registry shows a Thai badge instead,
 * and "ERP + Non-ERP" reads as ERP + Manual to them.
 */
export const FN_TYPE_LABEL = {
  'ERP': 'ERP',
  'Non-ERP': 'Non-ERP',
  'Non-ERP → ERP': 'ภายนอก → ERP',
  'ERP + Non-ERP': 'ERP + Manual',
  'ERP → Non-ERP': 'ERP + Manual',
};
export const fnTypeLabel = (v) => FN_TYPE_LABEL[(v || '').trim()] || (v || 'ยังไม่ระบุ');
/** ERP อย่างเดียวคือเขียว ที่เหลือคือยังมีงานมือปน */
export const fnTypeIsErp = (v) => (v || '').trim().toLowerCase() === 'erp';

/** ชนิดของกล่องงาน — สองคำนี้ใช้ชุดเดียวกันทั้งโมดูล */
export const NODE_KIND = { erp: 'ขั้นตอน ERP', manual: 'งานด้วยมือ' };

/** เอกสารหน้างานถูกส่งต่อเข้า ERP อย่างไร */
export const DOC_ROUTE = {
  direct:      { label: 'บันทึกเข้า ERP ทันที', color: '#15803d', arrow: '→' },
  deferred:    { label: 'ทำภายหลัง',            color: '#b45309', arrow: '⇢' },
  conditional: { label: 'มีเงื่อนไข',           color: '#c2410c', arrow: '⇨' },
  manual:      { label: 'คงเป็นแบบฟอร์มมือ',     color: '#475569', arrow: '✎' },
};
export const docRoute = (s) => DOC_ROUTE[s] || DOC_ROUTE.manual;
