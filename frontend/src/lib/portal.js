import { api } from './api.js';

// Portal-level features: admin-managed announcements + the "report an issue" form.
export const portalApi = {
  // active feed shown on the launcher (any signed-in user)
  announcements: () => api('/announcements'),
  // admin manage view (includes inactive)
  allAnnouncements: () => api('/announcements/all'),
  createAnnouncement: (body) => api('/announcements', { method: 'POST', body }),
  updateAnnouncement: (id, body) => api(`/announcements/${id}`, { method: 'PATCH', body }),
  deleteAnnouncement: (id) => api(`/announcements/${id}`, { method: 'DELETE' }),
  // ลาวันนี้ + วันเกิดที่กำลังจะถึง — กล่องข้างปฏิทินบนหน้าหลัก
  today: () => api('/portal/today'),
  // help / report an issue → emails the admins
  sendSupport: ({ area, message }) => api('/support', { method: 'POST', body: { area, message } }),
};

/**
 * วันเกิดที่ไม่ใช่วันนี้/พรุ่งนี้แสดงเป็นวันที่ย่อ — "ศ. 2 ต.ค." แบบเดียวกับ
 * พอร์ทัลจริง (วันนี้/พรุ่งนี้ ฝั่งหน้าจอทำเป็นป้ายแทน) นับจากวันนี้บวก days
 * เพื่อไม่ต้องส่งวันที่จริงของปีเกิดออกมาให้ทุกคนเห็น
 */
export function birthdayWhen(days, lang = 'th') {
  const n = Number(days);
  if (!Number.isFinite(n)) return '';
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH',
    { weekday: 'short', day: 'numeric', month: 'short' });
}

// Fixed-date Thai public holidays (month/day repeat yearly). Ported from the
// client's portal; deliberately EXCLUDES lunar/Buddhist holidays (Makha/Visakha/
// Asalha Bucha, Buddhist Lent) and cabinet-announced compensation days, which
// shift each year.
export const THAI_HOLIDAYS_FIXED = [
  { month: 1, day: 1, name: 'วันขึ้นปีใหม่' },
  { month: 4, day: 6, name: 'วันจักรี' },
  { month: 4, day: 13, name: 'วันสงกรานต์' },
  { month: 4, day: 14, name: 'วันสงกรานต์' },
  { month: 4, day: 15, name: 'วันสงกรานต์' },
  { month: 5, day: 1, name: 'วันแรงงานแห่งชาติ' },
  { month: 5, day: 4, name: 'วันฉัตรมงคล' },
  { month: 7, day: 28, name: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { month: 8, day: 12, name: 'วันแม่แห่งชาติ' },
  { month: 10, day: 13, name: 'วันคล้ายวันสวรรคต ร.9' },
  { month: 10, day: 23, name: 'วันปิยมหาราช' },
  { month: 12, day: 5, name: 'วันพ่อแห่งชาติ' },
  { month: 12, day: 10, name: 'วันรัฐธรรมนูญ' },
  { month: 12, day: 31, name: 'วันสิ้นปี' },
];

/** Map of 'YYYY-MM-DD' → holiday name for a given year. */
export function holidaysForYear(year) {
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const out = {};
  for (const h of THAI_HOLIDAYS_FIXED) out[`${year}-${pad(h.month)}-${pad(h.day)}`] = h.name;
  return out;
}
