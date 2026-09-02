# Tech stack — ข้อกำหนดสำหรับทีม Deploy

เอกสารนี้คือข้อกำหนดของ stack ที่ทุกโมดูลใน `FOR DEPLOYMENT TEAM/` ต้องเป็นไปตาม
ถ้าโค้ดในโมดูลไหนขัดกับเอกสารนี้ ให้ถือว่าเอกสารนี้ถูก และโค้ดนั้นยังแปลงไม่เสร็จ

## ต้องเสิร์ฟทุกโมดูลจากโดเมนเดียว — เข้าสู่ระบบครั้งเดียว

**ทุกแอปต้องอยู่บนโดเมนเดียวกัน แยกด้วย path ไม่ใช่ subdomain และไม่ใช่คนละโปรเจกต์**

```
vcb-connect.com/          ← portal (หน้าเข้าสู่ระบบ)
vcb-connect.com/hr        ← HR Work Log
vcb-connect.com/credit    ← Credit Facility
vcb-connect.com/minutes   ← Meeting Minutes
…
```

เหตุผล: JWT เก็บใน `localStorage` ซึ่งเบราว์เซอร์แยกตาม **origin**
(scheme + host + port) ถ้าแยกเป็น `hr.vcb-connect.com` หรือคนละโปรเจกต์บน
Vercel แต่ละแอปจะมองไม่เห็น token ของอีกแอป และผู้ใช้ต้องเข้าสู่ระบบใหม่ทุกครั้ง
ที่เปลี่ยนโมดูล ซึ่งขัดกับหลักการที่ portal เป็นประตูเดียวของทั้งระบบ

Portal เป็นตัวจัดการการเข้าสู่ระบบ โมดูลอื่นอ่าน token ที่ portal เก็บไว้ —
แต่ทำได้ก็ต่อเมื่ออยู่ origin เดียวกันเท่านั้น

## สถาปัตยกรรม — แยก 3 ส่วน คุยกันผ่าน REST + JWT

```
React SPA (Vercel) ──► Node/Express API (Render) ──► Supabase Postgres + Storage
```

**เบราว์เซอร์ต้องไม่ต่อ Supabase โดยตรง** ทุก request ผ่าน Express เท่านั้น
Express เป็นที่เดียวที่ถือ database credentials

## Frontend

| หัวข้อ | ข้อกำหนด |
|---|---|
| React | 18 |
| Vite | 5 |
| Tailwind | 3 |
| React Router | 6 |
| ภาษา | **JavaScript เท่านั้น — ไม่ใช้ TypeScript** |
| State | Context + `useState` |
| สองภาษา | ไทย/อังกฤษ เขียนเอง |

**ห้ามใช้:** Redux · ไลบรารีกราฟ (recharts, chart.js, d3) · UI kit สำเร็จรูป
(MUI, Ant Design, shadcn, Bootstrap) · TypeScript

กราฟและคอมโพเนนต์ UI ทั้งหมดเขียนเอง

## Backend

| หัวข้อ | ข้อกำหนด |
|---|---|
| Node | 20+ (ES Modules — `import`, ไม่ใช่ `require`) |
| Express | 4 |
| Database | `pg` เขียน SQL เอง — **ไม่มี ORM** |
| ตรวจข้อมูลเข้า | Zod |
| Auth | JWT + bcrypt + Google Sign-In |
| ความปลอดภัย | Helmet + CORS |

**ห้ามใช้:** Prisma · Sequelize · TypeORM · Knex · Supabase client library ฝั่ง server

## ข้อมูลและไฟล์

- **Supabase Postgres** — schema จัดการด้วย migration SQL รันซ้ำได้ (idempotent)
- **Supabase Storage** — เข้าถึงผ่าน **AWS S3 SDK v3** (`@aws-sdk/client-s3`)

## สร้างเอกสาร

| งาน | ไลบรารี |
|---|---|
| สร้าง PDF | PDFKit (ฝังฟอนต์ Sarabun) |
| รวมเล่ม PDF | pdf-lib |
| นำเข้า/ส่งออก Excel | ExcelJS |
| QR ตรวจสอบความถูกต้อง | qrcode |
| อีเมล | Brevo HTTP API |

## โครงโฟลเดอร์

**Express มีตัวเดียว อยู่ที่ `api/` ระดับ root** ไม่แยกตามโมดูล

```
VCB Connect/
├── api/                        Express ตัวเดียวสำหรับทุกโมดูล → Render
│   ├── src/
│   │   ├── index.js            เริ่ม server, Helmet, CORS, ต่อ routes
│   │   ├── db.js               pg Pool ตัวเดียว
│   │   ├── auth.js             JWT + bcrypt + Google Sign-In
│   │   ├── middleware/         requireAuth, requireRole, errorHandler
│   │   ├── routes/
│   │   │   ├── hr.js
│   │   │   ├── credit.js
│   │   │   ├── minutes.js
│   │   │   ├── sop.js
│   │   │   └── onboarding.js
│   │   ├── schemas/            Zod แยกตามโมดูล
│   │   └── lib/                pdf.js, excel.js, storage.js, email.js
│   └── package.json
│
├── supabase/
│   └── migrations/             SQL รันซ้ำได้ ของทั้งระบบรวมกัน
│
└── <module>/
    ├── ORIGINAL CODE/          Apps Script ที่ใช้งานจริง — ไม่เกี่ยวกับ stack นี้
    └── FOR DEPLOYMENT TEAM/
        └── src/                React SPA — .jsx เท่านั้น
```

### ทำไม Express ตัวเดียว ไม่แยกตามโมดูล

- **JWT ใบเดียวใช้ได้ทุกโมดูล** — ตรงกับเป้าหมาย "เว็บเดียว" ถ้าแยก backend
  ผู้ใช้ต้องล็อกอินใหม่ทุกครั้งที่เปลี่ยนโมดูล
- **auth เขียนครั้งเดียว** — ไม่ใช่ 7 ครั้ง เวลาแก้ก็แก้ที่เดียว
- **deploy บน Render ครั้งเดียว** — ไม่ใช่ 7 service
- **ข้อมูลข้ามโมดูลทำได้** — เช่น HR กับ onboarding ใช้ตารางพนักงานร่วมกัน
- **ไม่แตะ `ORIGINAL CODE/`** — โครง 2 โฟลเดอร์เดิมยังอยู่ครบ `api/` เป็นของใหม่
  ที่เพิ่มเข้ามาสำหรับทีม deploy เท่านั้น

## จุดที่ต่างจากของเดิม และต้องระวัง

**1. RLS ย้ายมาเป็น middleware**
Schema เดิมบังคับสิทธิ์ด้วย Row Level Security เพราะ browser ต่อ Supabase ตรง
เมื่อ browser คุยผ่าน Express แล้ว **Express คือด่านเดียวที่บังคับสิทธิ์**
ทุก route ต้องมี `requireAuth` และตรวจ role อย่างชัดเจน — ลืมที่ใดที่หนึ่ง
เท่ากับเปิดข้อมูลนั้นให้ทุกคน

**2. ไม่มี `supabase.from(...)` อีกต่อไป**
ทุกจุดที่เคยเรียก Supabase client เปลี่ยนเป็น SQL ผ่าน `pg`
ใช้ parameterised query (`$1`, `$2`) เสมอ — ห้ามต่อ string เข้า SQL

**3. Apps Script ให้ identity ฟรี แต่ที่นี่ไม่มี**
`Session.getActiveUser().getEmail()` ปลอมไม่ได้เพราะ Google เป็นคนให้
เมื่อย้ายมา SPA + API แล้ว identity มาจาก JWT ที่เราออกเอง
ดังนั้นการตรวจสิทธิ์ฝั่ง React ถือเป็นแค่การซ่อน UI ไม่ใช่ความปลอดภัย
ความปลอดภัยจริงอยู่ที่ Express เท่านั้น

**4. ฟอนต์ไทยใน PDF**
PDFKit ต้องฝังฟอนต์ Sarabun เอง ฟอนต์ default ไม่รองรับภาษาไทย
ถ้าไม่ฝัง ตัวอักษรไทยจะหายทั้งหมดโดยไม่มี error

## สถานะการแปลง

ดู `<module>/FOR DEPLOYMENT TEAM/PORT_NOTES.md` ของแต่ละโมดูล
