# original script — โค้ดต้นฉบับ JavaScript/TypeScript (HR Work Log)

โฟลเดอร์นี้เก็บ **โค้ดต้นฉบับฝั่ง React/TypeScript** ของแอป HR Daily Work Log
สำหรับให้นักพัฒนาอ่าน ต่อยอด และดูโครงสร้าง UI ได้โดยไม่ต้องแกะ Apps Script

> คู่ของโฟลเดอร์นี้คือ [`../for deploy team/`](../for%20deploy%20team/) ซึ่งเก็บ
> **สคริปต์ที่ deploy จริง** บน Google Apps Script

---

## ⚠️ อ่านก่อน — โฟลเดอร์นี้ยังไม่ใช่ระบบที่ใช้งานได้จริง

`hr-worklog/` เป็น **ตัว preview ที่ใช้ mock data** ไม่มี backend ของตัวเอง
ข้อมูลทั้งหมดมาจาก `src/mock.ts` **การแก้ไขใด ๆ ในหน้าจอจะหายไปเมื่อ refresh**

ระบบที่ผู้ใช้ใช้งานจริงอยู่ที่ [`../for deploy team/`](../for%20deploy%20team/) —
เป็น Google Apps Script ที่เขียนลง Google Sheets จริง

---

## เนื้อหา

```
hr-worklog/
  src/
    App.tsx           โครงหลัก + แถบเมนู
    Dashboard.tsx     แดชบอร์ด (วงแหวนความคืบหน้า, ปฏิทินย่อ, งานหลัก)
    Entry.tsx         บันทึกงาน (ภาพรวม + ตารางรายสัปดาห์)
    Picker.tsx        ตัวเลือก 2 ชั้น: กิจกรรม → หมวดงาน
    WorkIndex.tsx     ดัชนีงาน (44 รายการ)
    Requests.tsx      คำขอลา (ฟอร์ม + 3 แท็บ)
    SettingsPage.tsx  ตั้งค่า + จัดการโครงการ
    mock.ts           ข้อมูลตัวอย่าง — รูปแบบเดียวกับที่ GAS ส่งกลับ
    types.ts          typed models ตรงกับ return shape ของ api_*
    i18n_data.ts      พจนานุกรมไทย/อังกฤษ — ดึงจาก Code.gs
    app.css           CSS — ดึงจาก Code.gs
    extra.css         CSS ที่เขียนเองอย่างเดียวในโปรเจกต์
  PORT_NOTES.md       ตารางเทียบว่า GAS ส่วนไหน = ไฟล์ React ไหน + สิ่งที่ยังไม่ port
  STATUS.md           สถานะปัจจุบัน (frontend อย่างเดียว)
```

## วิธีรัน

```
cd hr-worklog
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # tsc + vite build
```

Deploy (ถ้าต้องการ): Vercel, Root Directory = `original script/hr-worklog`, preset Vite

---

## กฎการ sync ที่สำคัญ

**`../for deploy team/Code.gs` คือแหล่งความจริง** โฟลเดอร์นี้ตามหลังเสมอ
เมื่อแก้ `Code.gs` แล้วต้อง sync มาที่นี่ ไม่ใช่ทางกลับกัน

ไฟล์ 3 ตัวนี้ **ดึงอัตโนมัติจาก `Code.gs` — ห้ามแก้ด้วยมือ** ให้ดึงใหม่แทน:

| ไฟล์ | ดึงมาจาก |
|---|---|
| `src/i18n_data.ts` | `var T = {…}` (318 รายการ) |
| `src/app.css` | บล็อก `<style>…</style>` |
| `ACTIVITIES` ใน `src/mock.ts` | `var VCB_WORK_TYPES = […]` (44 รายการ) |

`src/extra.css` เป็น CSS ที่เขียนเองไฟล์เดียว — ครอบคลุมส่วนที่ GAS สร้างด้วย JS

---

## สิ่งที่ยังไม่ได้ port (ตั้งใจ)

- **ใบขอลาสำหรับพิมพ์** — ฝั่ง GAS เปิดหน้าต่าง print แล้วเขียนเอกสาร A4 ลงไป
  ไม่มีสิ่งเทียบเท่าใน preview ที่ไม่มี backend
- Excel export, เพิ่มพนักงาน, ย้ายหน่วยงาน, import ดัชนีงาน — เป็น UI เปล่า

รายละเอียดทั้งหมดอยู่ใน [`hr-worklog/PORT_NOTES.md`](hr-worklog/PORT_NOTES.md)

---

## หมายเหตุสำหรับนักพัฒนา

**วันที่ใน leave models เป็น `string` ทุกตัว ไม่ใช่ `Date` โดยเจตนา** —
ฝั่ง GAS แปลงค่าก่อนส่งกลับเสมอ (Google Sheets คืนค่าเป็น Date object
สำหรับเซลล์ที่หน้าตาเหมือนวันที่ และปัดเลข id ที่ยาวเกิน 15 หลัก) การประกาศเป็น
`Date` จะไม่ตรงกับสิ่งที่วิ่งผ่านสายจริง

**`Z-1`/`Z-2`/`Z-3` เป็น `one-to-one` แต่ `fixed_cost` ว่าง** — ฟังก์ชัน
`composite()` ใน `mock.ts` ต้องคืนค่าเป็นรหัสเปล่า ๆ ตามกฎเดียวกับ GAS
(`fixed ? code + ' / ' + fixed : code`) ถ้าใช้ `fixed_cost!` จะได้
`"Z-2 / undefined"` ในเซลล์

---

เอกสารสถาปัตยกรรมทั้งหมด: [`../HR-WORK-LOG.md`](../HR-WORK-LOG.md)
