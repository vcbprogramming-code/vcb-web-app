# วิธีตั้งค่า SMTP เพื่อให้ระบบส่งอีเมลจริง

> เอกสารนี้อธิบายวิธีหา **ค่า SMTP** มาใส่ในระบบ เพื่อให้การแจ้งเตือน/อนุมัติเอกสาร
> (E-Memo) **ส่งอีเมลจริง** ออกไปหาผู้อนุมัติได้ — ผู้อนุมัติจะกดปุ่ม อนุมัติ/ไม่อนุมัติ/ส่งกลับ
> จากในอีเมลได้ทันที โดยไม่ต้องล็อกอิน

ระบบรองรับ SMTP มาตรฐานอยู่แล้ว ท่านเพียงเลือก **ผู้ให้บริการอีเมล 1 เจ้า** แล้วนำ 5 ค่า
มาใส่ในไฟล์ `backend/.env`

---

## ภาพรวม: ต้องได้ 5 ค่านี้

| ตัวแปร | คืออะไร | ตัวอย่าง |
|---|---|---|
| `SMTP_HOST` | ที่อยู่เซิร์ฟเวอร์ส่งเมล | `smtp-relay.brevo.com` |
| `SMTP_PORT` | พอร์ต (587 = STARTTLS, 465 = SSL) | `587` |
| `SMTP_USER` | ชื่อผู้ใช้/อีเมลสำหรับล็อกอิน SMTP | `xxxxx@smtp-brevo.com` |
| `SMTP_PASS` | รหัสผ่าน / App Password / SMTP key | `xkeysib-xxxx...` |
| `MAIL_FROM` | ชื่อผู้ส่งที่จะแสดงในอีเมล | `ระบบงานภายใน VCB <no-reply@vcb.co.th>` |

นำค่าทั้งหมดไปวางต่อท้ายไฟล์ `backend/.env` (สร้างจาก `.env.example` ได้) เช่น:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=xxxxx@smtp-brevo.com
SMTP_PASS=xkeysib-xxxxxxxxxxxxxxxx
MAIL_FROM=ระบบงานภายใน VCB <thanongsak40ni@gmail.com>
```

> หากไม่ตั้งค่า SMTP ระบบจะทำงานในโหมด dev (พิมพ์อีเมลออก console แทนการส่งจริง)

---

## ทางเลือกที่ 1 — Brevo (แนะนำ · ฟรี 300 อีเมล/วัน ถาวร)

เหมาะที่สุดสำหรับเริ่มใช้งาน: สมัครง่าย ไม่ต้องมีโดเมน ไม่ต้องใส่บัตรเครดิต

### ขั้นที่ 1 — สมัคร
1. เข้า <https://www.brevo.com> → กด **Sign up free**
2. กรอกอีเมล + รหัสผ่าน → ยืนยันอีเมล
3. กรอกข้อมูลบริษัทคร่าว ๆ (ไม่ต้องใส่บัตรเครดิต)

### ขั้นที่ 2 — เอาค่า SMTP
1. ล็อกอิน → คลิกชื่อบัญชี (มุมขวาบน) → **SMTP & API**
   หรือเข้าตรง <https://app.brevo.com/settings/keys/smtp>
2. เลือกแท็บ **SMTP** จะเห็น:
   - **Server** → ใช้เป็น `SMTP_HOST` = `smtp-relay.brevo.com`
   - **Port** → `SMTP_PORT` = `587`
   - **Login** → `SMTP_USER`
3. กด **Generate a new SMTP key** → ก๊อปคีย์มาเป็น `SMTP_PASS` (โชว์ครั้งเดียว เก็บไว้ดี ๆ)

### ขั้นที่ 3 — ยืนยันผู้ส่ง (สำคัญ ไม่งั้นเมลไม่ออก)
1. เมนูซ้าย **Senders, Domains & Dedicated IPs → Senders → Add a sender**
2. ใส่ชื่อ + อีเมลผู้ส่ง (เช่น `thanongsak40ni@gmail.com`) → Brevo ส่งเมลยืนยันมา → กดลิงก์ยืนยัน
3. อีเมลที่ยืนยันแล้ว นำไปใส่เป็น `MAIL_FROM`

---

## ทางเลือกที่ 2 — Gmail App Password (ใช้ Gmail ที่มีอยู่)

เร็วถ้าเปิด 2-Step Verification อยู่แล้ว · ส่งได้ ~500 อีเมล/วัน

### ขั้นตอน
1. เปิด **2-Step Verification** ที่ <https://myaccount.google.com/security> (ถ้ายังไม่เปิด)
2. ไปที่ <https://myaccount.google.com/apppasswords>
3. ตั้งชื่อ app (เช่น "VCB E-Memo") → กด **Create** → ได้รหัส **16 หลัก** (เช่น `abcd efgh ijkl mnop`)
4. ใช้ค่าดังนี้ (เอาเว้นวรรคออกจากรหัส 16 หลักก็ได้):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=thanongsak40ni@gmail.com
SMTP_PASS=abcdefghijklmnop
MAIL_FROM=thanongsak40ni@gmail.com
```

> ข้อสังเกต: Gmail อาจขึ้นว่า "ส่งผ่านบัญชีส่วนตัว" ปลายทางบางที่อาจเข้า Junk — เหมาะกับการทดสอบ
> ถ้าต้องการความเป็นทางการ/ปริมาณมาก แนะนำ Brevo หรือ Google Workspace ของบริษัท

---

## ทางเลือกอื่น ๆ (สรุปสั้น)

| บริการ | ฟรี | HOST | PORT |
|---|---|---|---|
| **Brevo** ⭐ | 300/วัน ถาวร | `smtp-relay.brevo.com` | 587 |
| **Gmail** | ~500/วัน | `smtp.gmail.com` | 587 |
| **Mailtrap (Sending)** | 1,000/เดือน | `live.smtp.mailtrap.io` | 587 |
| **SendGrid** | 100/วัน | `smtp.sendgrid.net` | 587 |
| **Google Workspace** (บริษัท) | ตามแพ็กเกจ | `smtp.gmail.com` / relay | 587 |

---

## ทดสอบหลังตั้งค่า

1. ใส่ค่า 5 ตัวใน `backend/.env` แล้ว **รีสตาร์ท backend** (`npm run dev`)
2. เข้าระบบ → เปิดเอกสารใน E-Memo → กด **ส่งอนุมัติ** → ใส่อีเมลผู้อนุมัติ
3. ตรวจกล่องเมลผู้อนุมัติ — ควรได้อีเมลพร้อมปุ่ม **อนุมัติ / ส่งกลับแก้ไข / ไม่อนุมัติ**
4. กดปุ่มในอีเมล → เปิดหน้าอนุมัติของระบบ → เซ็น/ยืนยัน → ระบบเดินสายอนุมัติต่อให้อัตโนมัติ

> หมายเหตุ: ลิงก์ในอีเมลชี้ไปที่ค่า `APP_BASE_URL` ใน `.env`
> - ตอนรันบนเครื่อง = `http://localhost:5173` (กดได้เฉพาะบนเครื่องนั้น)
> - ถ้าจะกดจากมือถือ/เครื่องอื่น ต้อง deploy ขึ้นเซิร์ฟเวอร์จริง หรือใช้ tunnel ชั่วคราว
>   แล้วแก้ `APP_BASE_URL` เป็น URL สาธารณะนั้น

---

## ความปลอดภัย

- `SMTP_PASS` / App Password / SMTP key เป็น **ความลับ** — ไฟล์ `.env` ถูกกันไม่ให้ขึ้น git แล้ว
- หากรหัสหลุด สามารถเข้าไป **revoke/regenerate** ใหม่ได้ทุกเมื่อ (ทั้ง Brevo และ Gmail App Password)
- อย่าใส่ค่า SMTP ไว้ฝั่ง frontend — ต้องอยู่ใน backend `.env` เท่านั้น
