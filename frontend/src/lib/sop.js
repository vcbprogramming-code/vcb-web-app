import { api } from './api.js';

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Module 5 — SOP (คู่มือปฏิบัติงาน): reference content + authoring. */
export const sopApi = {
  bootstrap: () => api('/sop/bootstrap'),
  scenarios: ({ module, q } = {}) => api(`/sop/scenarios${qs({ module, q })}`),
  scenario: (no) => api(`/sop/scenarios/${no}`),
  createScenario: (body) => api('/sop/scenarios', { method: 'POST', body }),
  updateScenario: (no, body) => api(`/sop/scenarios/${no}`, { method: 'PATCH', body }),
  deleteScenario: (no) => api(`/sop/scenarios/${no}`, { method: 'DELETE' }),
  moveScenario: (no, direction) => api(`/sop/scenarios/${no}/move`, { method: 'POST', body: { direction } }),
  /** สลับตำแหน่งกับกรณีที่เลือกไว้ทีเดียว (รหัสแสดงผล เช่น 'PO-5') แบบระบบจริง */
  swapScenario: (no, swapWith) => api(`/sop/scenarios/${no}/swap`, { method: 'POST', body: { swapWith } }),

  /** หัวเอกสาร: ชื่อคู่มือ ฉบับ วันมีผล ขอบเขต วัตถุประสงค์ หมายเหตุ */
  updateMeta: (body) => api('/sop/meta', { method: 'PATCH', body }),

  flows: ({ module } = {}) => api(`/sop/flows${qs({ module })}`),

  reports: () => api('/sop/reports'),
  createReport: (body) => api('/sop/reports', { method: 'POST', body }),
  updateReport: (id, body) => api(`/sop/reports/${id}`, { method: 'PATCH', body }),
  deleteReport: (id) => api(`/sop/reports/${id}`, { method: 'DELETE' }),

  // ประวัติเวอร์ชัน — รายการไม่ส่งเนื้อหาเต็มมาด้วย เพราะแต่ละเวอร์ชันคือเอกสารทั้งฉบับ
  versions: (limit) => api(`/sop/versions${qs({ limit })}`),
  version: (id) => api(`/sop/versions/${id}`),
  restoreVersion: (id) => api(`/sop/versions/${id}/restore`, { method: 'POST' }),
};

/**
 * หน้าเริ่มต้นของโมดูล — หมวดที่จะเปิดให้อัตโนมัติเมื่อเข้าใช้งานครั้งถัดไป
 *
 * เก็บในเครื่องผู้ใช้เท่านั้น เป็นความสะดวกของคนคนเดียว ไม่ใช่ข้อมูลที่ต้องแชร์
 * และต้องอ่านไม่ขึ้นก็ยังใช้งานได้ปกติ (โหมดส่วนตัวของเบราว์เซอร์ทำให้ throw ได้)
 *
 * ค่าที่เก็บได้: 'ALL' = กรณีทั้งหมด · 'flows' = ผังกระบวนการ · 'reports' = วิธีเรียก
 * Report หรือรหัสหมวด — ชุดเดียวกับตัวเลือกในหน้าตั้งค่าของระบบจริง (เดิมเก็บได้แต่
 * หมวด คนที่ทำงานกับผังทุกวันจึงตั้งให้เปิดมาที่ผังไม่ได้)
 */
export const SOP_DEFAULT_VIEW_KEY = 'vcb_sop_default_view';
/**
 * "ทั้งหมด" ต้องมีค่าเก็บของตัวเอง แยกจาก "ยังไม่เคยตั้งค่า" เพราะสองอย่างนี้พาไป
 * คนละหน้า — ของเขาเก็บคำว่า ALL ไว้ตรง ๆ เราใช้คำเดียวกัน
 */
export const SOP_ALL_CASES = 'ALL';
export function readDefaultView() {
  try { return localStorage.getItem(SOP_DEFAULT_VIEW_KEY) || ''; } catch { return ''; }
}
/**
 * แปลงค่าที่เก็บไว้เป็น { tab, module } ที่หน้าจอใช้ได้ตรง ๆ
 *
 * ยังไม่เคยตั้งค่า = เปิดมาที่ผังกระบวนการ ตามระบบจริง (`getDefaultView()` ของเขา
 * คืน 'flows' พร้อมหมายเหตุว่าผังเป็นสาขาหลักของคู่มือ) ของเราเคยเปิดมาที่รายการ
 * กรณีทั้งหมด ซึ่งเป็นรายการยาวที่ต้องกวาดตาหาก่อนจะเจออะไร
 */
export function defaultViewToState(v) {
  if (v === 'reports') return { tab: 'reports', module: '' };
  if (v === SOP_ALL_CASES) return { tab: 'cases', module: '' };
  if (!v || v === 'flows') return { tab: 'flows', module: '' };
  return { tab: 'cases', module: v };
}
export function writeDefaultView(code) {
  try {
    if (code) localStorage.setItem(SOP_DEFAULT_VIEW_KEY, code);
    else localStorage.removeItem(SOP_DEFAULT_VIEW_KEY);
  } catch { /* โหมดส่วนตัว — ข้ามไป ไม่ใช่เรื่องที่ต้องเตือนผู้ใช้ */ }
}

/**
 * ลำดับหมวดของผังกระบวนการ — ชุดและลำดับเดียวกับที่ระบบจริงจัดหัวข้อกลุ่มในรายการผัง
 * ไม่ใช่ลำดับหมวดของกรณีเฉพาะ (ผังเริ่มที่ BD เพราะงานเริ่มจากงบประมาณ)
 */
export const FLOW_MODULE_ORDER = ['BD', 'PO', 'IC', 'OF', 'AP', 'AR', 'FA', 'GL'];

/**
 * ชื่อสองภาษาของข้อมูล — ภาษาที่เลือกขึ้นเป็นบรรทัดหลัก อีกภาษาเป็นบรรทัดรอง
 *
 * กรณีเฉพาะและผังทุกใบมีชื่อไทยและชื่ออังกฤษเก็บไว้คู่กัน ระบบจริงสลับให้ตามภาษา
 * ที่เลือก (อังกฤษ → ชื่ออังกฤษขึ้นก่อน ไทยอยู่บรรทัดล่าง) ของเราเคยขึ้นไทยก่อน
 * เสมอ กดเป็นอังกฤษแล้วชื่อทุกใบยังเป็นไทย · ไม่มีชื่ออังกฤษก็ถอยไปใช้ไทย
 * ไม่ใช่ปล่อยว่าง — และนี่คือการ "เลือกค่าที่เก็บไว้" ไม่ใช่การแปลข้อความ
 */
export function titlePair(lang, th, en) {
  const t = (th || '').trim();
  const e = (en || '').trim();
  if (lang === 'en' && e) return { primary: e, secondary: t };
  return { primary: t || e, secondary: t && e ? e : '' };
}

/** Per-module accent, so a case/flow reads as belonging to its area at a glance. */
export const MODULE_TONE = {
  PO: 'bg-sky-50 text-sky-700', IC: 'bg-emerald-50 text-emerald-700',
  AP: 'bg-amber-50 text-amber-700', FA: 'bg-purple-50 text-purple-700',
  PM: 'bg-blue-50 text-blue-700', OF: 'bg-orange-50 text-orange-700',
  GL: 'bg-slate-100 text-slate-600', AR: 'bg-rose-50 text-rose-700',
  BD: 'bg-emerald-50 text-emerald-700', FIN: 'bg-sky-50 text-sky-700',
  SE: 'bg-slate-100 text-slate-600',
};
export const toneOf = (code) => MODULE_TONE[code] || 'bg-slate-100 text-slate-600';

/** จุดสีประจำหมวดในเมนูซ้าย — ระบบจริงใช้จุดสีนำหน้าทุกหมวด */
export const MODULE_DOT = {
  PO: 'bg-sky-500', IC: 'bg-emerald-500', AP: 'bg-amber-500', FA: 'bg-purple-500',
  PM: 'bg-blue-500', OF: 'bg-orange-500', GL: 'bg-slate-400', AR: 'bg-rose-500',
  BD: 'bg-teal-500', FIN: 'bg-cyan-500', SE: 'bg-slate-500',
};
export const dotOf = (code) => MODULE_DOT[code] || 'bg-slate-400';

/**
 * รหัสไฟล์ใน Google Drive จากลิงก์ที่ผู้แก้ไขวางไว้ — ใช้ขอรูปย่อมาแสดงในคอลัมน์
 * เอกสารที่เกี่ยวข้อง เหมือนระบบจริง ลิงก์ที่ไม่ใช่ Drive คืนค่าว่างและตกไปใช้ไอคอนแทน
 */
export function driveFileId(url) {
  const u = String(url || '');
  const m = u.match(/\/file\/d\/([\w-]{10,})/) || u.match(/[?&]id=([\w-]{10,})/) || u.match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : '';
}
export const driveThumbUrl = (id, w = 400) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
