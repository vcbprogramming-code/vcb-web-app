# VCB Meeting Minutes

ระบบบันทึกการประชุมของกลุ่มวิจิตรภัณฑ์ก่อสร้าง — เก็บรายงานการประชุมไว้ในที่เดียว
ค้นหาได้ และควบคุมสิทธิ์การเข้าถึงรายโครงการ

**🔗 เปิดใช้งาน:**
https://script.google.com/macros/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec

*(ใช้ลิงก์รูปแบบนี้เท่านั้น อย่าใช้แบบ `/a/vcb-con.com/` เพราะ Google จะ redirect
แล้วทำให้ query string เช่น `?meeting=` หรือ `?project=` หายไป)*

---

## โครงสร้างโฟลเดอร์

แยกเป็น **2 โฟลเดอร์หลัก** แบบเดียวกับ HR Work Log ในโปรเจกต์นี้

| โฟลเดอร์ | คืออะไร | สถานะ |
|---|---|---|
| [`for deploy team/`](for%20deploy%20team/) | **Google Apps Script ที่ deploy จริง** — 8 ไฟล์ที่ `clasp push` ส่งขึ้นไป | 🟢 **รันอยู่จริง** `@220` |
| [`original script/`](original%20script/) | **โค้ดต้นฉบับ React + TypeScript** สำหรับนักพัฒนาอ่าน/ต่อยอด | 🟡 preview, mock data |

### ⚠️ อ่านก่อนแก้ไข

**ระบบที่พนักงานใช้อยู่คือ [`for deploy team/`](for%20deploy%20team/)** ไม่ใช่ React
ถ้าจะแก้ให้มีผลกับผู้ใช้จริง ต้องแก้ที่โฟลเดอร์นั้น

`original script/` เป็น React port ที่ใช้ mock data (`src/api/mock.ts`)
แก้แล้ว **ไม่มีผล** กับระบบที่ใช้งานอยู่ และข้อมูลจะหายเมื่อ refresh

**ทิศทางการ sync:** `for deploy team/` คือแหล่งความจริงเสมอ — แก้ที่นั่นก่อน
แล้วค่อย sync มาที่ `original script/` ไม่ใช่ทางกลับกัน

---

## สิทธิ์การเข้าถึง

**การอ่าน** ไม่ต้องล็อกอิน แต่เห็นได้แค่ไหนขึ้นกับโครงการ:

- **🔓 Public** — ใครก็ตามที่เปิดลิงก์อ่านได้ทุกการประชุมในโครงการนั้น
  ไม่ต้องล็อกอิน ไม่จำกัดโดเมนอีเมล
- **🔒 Locked** — อ่านได้เฉพาะ admin, editor และ **อีเมลที่ระบุไว้เฉพาะเจาะจง**
  โครงการที่ล็อกไว้ **ไม่ได้**เปิดให้พนักงาน `@vcb-con.com` ทุกคน
  แต่เป็นรายชื่อที่กำหนดเอง

**การแก้ไข** ต้องล็อกอินเสมอ — Google Sign-In หรืออีเมล + PIN 4 หลัก
Editor แก้เนื้อหาได้ทุกโครงการ ส่วน admin จัดการสิทธิ์/โครงการ/สถานะซ่อน-ปักหมุดได้

จัดการทั้งหมดที่ **ตั้งค่า → 🔐 Project access** (เฉพาะ admin)

---

## ข้อมูลระบบ

| | |
|---|---|
| **Script ID** | `1Ozxm34TQ4tIdwyr4dPPImwIeuGJpj9B53Zb0hl30MnR8tdeawb7KE6vf` |
| **Deployment ID** | `AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr` |
| **เวอร์ชันล่าสุด** | `@220` |
| **ฐานข้อมูล** | Google Sheet ส่วนตัว (สคริปต์เข้าถึงแทนเจ้าของ) |

---

## เอกสาร

| เอกสาร | เนื้อหา |
|---|---|
| [`for deploy team/README.md`](for%20deploy%20team/README.md) | วิธี deploy, ไฟล์แต่ละตัวทำอะไร, จุดที่พลาดบ่อย |
| [`for deploy team/PAGINATION.md`](for%20deploy%20team/PAGINATION.md) | **อ่านก่อนแก้เรื่องการแสดงผล/พิมพ์/ตัวแก้ไขเอกสาร** |
| [`original script/README.md`](original%20script/README.md) | วิธีรัน React, โครงสร้างไฟล์ |
| [`original script/PORT_NOTES.md`](original%20script/PORT_NOTES.md) | ตารางเทียบ GAS↔React + สิ่งที่ยังไม่ port |

เอกสารสถาปัตยกรรมและ CHANGELOG ฉบับเต็มอยู่ในโฟลเดอร์ต้นทางของ Apps Script
(`PROJECT_SUMMARY.md`, `CHANGELOG.md`) ซึ่งไม่ได้ mirror มาที่นี่
