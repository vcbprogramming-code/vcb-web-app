/**
 * ตัวช่วยที่ชุดทดสอบผ่านหน้าจอใช้ร่วมกัน
 *
 * อยู่ในโฟลเดอร์ tools/ เพราะตัวรันรวมมองหาไฟล์ .mjs เฉพาะชั้นบนสุดของ tests/
 * ไฟล์ที่นี่จึงไม่ถูกนับเป็นชุดทดสอบ
 */

/**
 * กดปุ่มในกล่องยืนยัน — และเฉพาะในกล่องเท่านั้น
 *
 * หน้าจอข้างหลังมักมีปุ่มชื่อเดียวกันอยู่ทุกแถว (เช่น "กู้คืน" "ลบ") การหา
 * ปุ่มจากทั้งหน้าจึงกดผิดตัวประจำ และการเลือก "div ที่มีปุ่มน้อยที่สุดที่มีคำว่า
 * ยกเลิก" ก็ยังพลาด เพราะ div ที่ห่อปุ่มยกเลิกไว้ตัวเดียวมีปุ่มน้อยกว่ากล่อง
 * จริงเสมอ — ต้องหา div ที่มีปุ่ม **ทั้งสองปุ่ม** แล้วเอาตัวในสุด
 */
export const clickInDialog = (page, label, cancelLabel = 'ยกเลิก') => page.evaluate(([l, c]) => {
  const holders = [...document.querySelectorAll('div')].filter((d) => {
    const btns = [...d.querySelectorAll('button')].map((b) => b.innerText.trim());
    return btns.includes(l) && btns.includes(c);
  });
  if (!holders.length) return false;
  // ตัวในสุดคือกล่องจริง — ตัวที่ห่ออยู่ข้างนอกก็ผ่านเงื่อนไขเดียวกันหมด
  const box = holders.sort((a, b) => a.querySelectorAll('button').length - b.querySelectorAll('button').length)[0];
  const el = [...box.querySelectorAll('button')].find((b) => b.innerText.trim() === l);
  if (el) { el.click(); return true; }
  return false;
}, [label, cancelLabel]);

/** สีของปุ่มในกล่องยืนยัน สำหรับตรวจว่าเดินหน้า/ถอยหลังแยกสีกันจริง */
export const dialogButtons = (page, cancelLabel = 'ยกเลิก') => page.evaluate((c) => {
  const holders = [...document.querySelectorAll('div')].filter((d) =>
    [...d.querySelectorAll('button')].some((b) => b.innerText.trim() === c)
    && d.querySelectorAll('button').length >= 2);
  if (!holders.length) return [];
  const box = holders.sort((a, b) => a.querySelectorAll('button').length - b.querySelectorAll('button').length)[0];
  return [...box.querySelectorAll('button')].filter((b) => b.innerText.trim()).map((b) => {
    const s = getComputedStyle(b);
    return { text: b.innerText.trim(), bg: s.backgroundColor, fg: s.color, border: s.borderTopColor };
  });
}, cancelLabel);
