import { api, apiBlobUrl, apiUpload } from './api.js';

/** โปรแกรมปฐมนิเทศ 90 วัน — เนื้อหาคงที่ ความคืบหน้าเป็นของแต่ละคน */
export const programApi = {
  bootstrap: () => api('/onboarding-program/bootstrap'),
  setMe: (body) => api('/onboarding-program/me', { method: 'PUT', body }),
  toggle: (itemId, done) => api(`/onboarding-program/progress/${itemId}`, { method: 'PUT', body: { done } }),
  submitDoc: (docId, note) => api(`/onboarding-program/documents/${docId}`, { method: 'POST', body: { note } }),
  unsubmitDoc: (docId) => api(`/onboarding-program/documents/${docId}`, { method: 'DELETE' }),
  uploadDoc: (docId, file) => apiUpload(`/onboarding-program/documents/${docId}/file`, file),
  // ไฟล์ที่อัปโหลดไว้สตรีมผ่าน API ซึ่งต้องมี Bearer — window.open ส่ง header ไม่ได้
  // จึงต้องดึงเป็น blob ก่อนเสมอ (กับดักเดิม: iframe ชี้ตรงไป API ใช้ได้ที่เครื่อง
  // ตัวเองแต่ขึ้นหน้าว่างบน production เพราะ X-Frame-Options)
  docFileUrl: (docId) => apiBlobUrl(`/onboarding-program/documents/${docId}/file`),
  cohort: () => api('/onboarding-program/cohort'),
  // หน้าเนื้อหาของพอร์ทัล (สารจาก MD · ค่านิยม · ผลงาน · ผังองค์กร · แนะนำแผนก ·
  // รู้จักทีมของเรา · ชีวิตในไซต์งาน · หน้าจบ) — ขอทีละหน้า ไม่ใช่มาพร้อม bootstrap
  // เพราะผังองค์กรอันเดียวมีคน 184 คน ซึ่งไม่มีเหตุให้โหลดตอนเปิดเช็กลิสต์
  page: (key) => api(`/onboarding-program/pages/${encodeURIComponent(key)}`),
  // รูปอยู่หลังล็อกอิน <img src> ส่ง Bearer ไม่ได้ จึงดึงเป็น blob เหมือนไฟล์แนบ
  imageUrl: (key) => apiBlobUrl(`/onboarding-program/images/${encodeURIComponent(key)}`),
  // ของผู้ดูแล: รวมข้อที่ปิดใช้งานแล้วด้วย bootstrap ส่งมาแต่ข้อที่เปิดอยู่
  blockItems: (blockId) => api(`/onboarding-program/items?blockId=${blockId}`),
  updateItem: (id, body) => api(`/onboarding-program/items/${id}`, { method: 'PATCH', body }),
  addItem: (body) => api('/onboarding-program/items', { method: 'POST', body }),
  moveItem: (id, direction) => api(`/onboarding-program/items/${id}/move`, { method: 'PUT', body: { direction } }),
};

/**
 * ข้อความให้กำลังใจตอนติ๊กสำเร็จ — สุ่มหนึ่งข้อ ไม่ใช่ข้อความเดียวซ้ำทุกครั้ง
 *
 * ห้าข้อนี้คือคำแปลไทยของห้าข้อในพอร์ทัลที่บริษัทใช้อยู่ (showRewardToast ใน
 * progress.html) ตรงตัว รวมทั้งเครื่องหมายอัศเจรีย์ท้ายประโยค — พนักงานที่เคย
 * ใช้พอร์ทัลเดิมต้องเจอคำเดิม ไม่ใช่คำที่เราคิดขึ้นเองให้ความหมายใกล้เคียง
 */
export const REWARDS = ['ทำได้ดีมาก!', 'เยี่ยมมาก!', 'ทำต่อไปนะ!', 'ทำได้ดี!', 'คุณมาถูกทางแล้ว!'];
export const randomReward = () => REWARDS[Math.floor(Math.random() * REWARDS.length)];

/** ข้อความของรายการ/หัวข้อ ตามภาษาที่ผู้ใช้ตั้งไว้ — ไม่มีคำไทยก็ถอยไปใช้อังกฤษ
 *
 *  เนื้อหาเช็กลิสต์ไม่ได้อยู่ในพจนานุกรม t() เพราะมันเป็น "ข้อมูล" ในฐานข้อมูล
 *  ไม่ใช่ข้อความบนหน้าจอ คำแปลจึงมาเป็นคอลัมน์คู่กันมาจากเซิร์ฟเวอร์ (text /
 *  text_th) และเลือกตรงจุดที่วาด ไม่ใช่ห่อด้วย t() ซึ่งจะไม่เจอคีย์เลย
 */
export const pick = (lang, en, th) => (lang === 'en' ? (en || th || '') : (th || en || ''));
