import { api } from './api.js';

/** โปรแกรมปฐมนิเทศ 90 วัน — เนื้อหาคงที่ ความคืบหน้าเป็นของแต่ละคน */
export const programApi = {
  bootstrap: () => api('/onboarding-program/bootstrap'),
  setMe: (body) => api('/onboarding-program/me', { method: 'PUT', body }),
  toggle: (itemId, done) => api(`/onboarding-program/progress/${itemId}`, { method: 'PUT', body: { done } }),
  submitDoc: (docId, note) => api(`/onboarding-program/documents/${docId}`, { method: 'POST', body: { note } }),
  unsubmitDoc: (docId) => api(`/onboarding-program/documents/${docId}`, { method: 'DELETE' }),
  cohort: () => api('/onboarding-program/cohort'),
  updateItem: (id, body) => api(`/onboarding-program/items/${id}`, { method: 'PATCH', body }),
};

/** ข้อความให้กำลังใจตอนติ๊กสำเร็จ — สุ่มหนึ่งข้อ ไม่ใช่ข้อความเดียวซ้ำทุกครั้ง */
export const REWARDS = ['ทำได้ดีมาก', 'เยี่ยมมาก', 'ไปได้สวย', 'เก่งมาก', 'มาถูกทางแล้ว'];
export const randomReward = () => REWARDS[Math.floor(Math.random() * REWARDS.length)];
