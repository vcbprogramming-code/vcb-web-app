# ระบบบริหารงานบุคคลและการอนุมัติเอกสารอิเล็กทรอนิกส์

HR Operations, E-Approval & Onboarding System — สำหรับ **บริษัท วิจิตรภัณฑ์ก่อสร้าง**

เว็บแอป Responsive ใช้งานผ่านเบราว์เซอร์ รองรับมือถือและคอมพิวเตอร์ ทำงานบนฐานข้อมูลกลางตัวเดียว และมีระบบสิทธิ์ตามบทบาท (Role-based Access)

## โมดูล (4 โมดูลตามข้อเสนอโครงการ)

1. **E-Memo & E-Signature** — บันทึกข้อความและอนุมัติอิเล็กทรอนิกส์ + ลายเซ็นดิจิทัล
2. **รายงาน & วิเคราะห์การปฏิบัติงาน** — บันทึกงานรายวัน + OT, Dashboard เทียบ 5 หน่วยงาน
3. **Credit Facility Management** — วงเงินสินเชื่อรายโครงการ, ติดตาม Drawdown / คงเหลือ
4. **Onboarding 90 วัน** — แนะแนวและติดตามพนักงานใหม่

> สถานะปัจจุบัน: **วางโครงสร้างพื้นฐานเสร็จแล้ว** (skeleton + DB schema + Auth + layout).
> หน้าโมดูลทั้ง 4 เป็น placeholder พร้อมต่อยอด

## สถาปัตยกรรม

```
[ React (Vite + Tailwind) ]  ──HTTP──>  [ Node.js / Express API ]  ──>  [ Supabase (Postgres + Auth) ]
       frontend/                              backend/                         supabase/
```

**Deploy target: Railway.** Frontend + backend Express both deploy to Railway.
The backend runs as a normal long-running Express server (no serverless
restructure needed). Scheduled/long work (email auto-log, monthly rollups,
interest recompute) runs as a Railway cron service or an in-process scheduler —
no per-request timeout limits.

- **Frontend** (`frontend/`): Vite + React + Tailwind CSS. คุยกับ backend ผ่าน REST `/api`
- **Backend** (`backend/`): Node.js + Express เป็น API หลัก ถือ business logic/workflow ทั้งหมด
  เชื่อมต่อ PostgreSQL ตรงด้วย connection string (`pg` pool) — ไม่ใช้ Supabase API/keys
- **Auth**: จัดการเองในฝั่ง backend — อีเมล + รหัสผ่าน (bcrypt) แลกเป็น JWT,
  middleware ตรวจ token แล้วโหลด profile (role + unit) จากตาราง `profiles`
- **Database**: PostgreSQL (โฮสต์บน Supabase หรือที่ไหนก็ได้) — schema/seed อยู่ใน `supabase/`

## โครงสร้างโฟลเดอร์

```
hr-system/
├── backend/
│   ├── src/
│   │   ├── config/       env.js, db.js (pg connection pool)
│   │   ├── middleware/   auth.js (requireAuth/requireRole), errorHandler.js
│   │   ├── routes/       auth.routes.js, org.routes.js, index.js
│   │   ├── utils/        asyncHandler.js, auth.js (JWT + bcrypt helpers)
│   │   ├── app.js        Express app (helmet, cors, json, routes)
│   │   └── server.js     entrypoint
│   ├── scripts/         db.mjs (migrate / create-admin / list-users)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── auth/         AuthContext.jsx, ProtectedRoute.jsx
│   │   ├── components/   AppLayout.jsx (sidebar + header)
│   │   ├── config/       nav.js (เมนู + สิทธิ์ตามบทบาท)
│   │   ├── lib/          api.js (fetch wrapper), supabase.js
│   │   ├── pages/        Login, Dashboard, ModulePlaceholder
│   │   ├── App.jsx       routes
│   │   └── main.jsx
│   └── .env.example
└── supabase/
    ├── migrations/0001_core_org_and_auth.sql
    └── seed.sql
```

## บทบาทผู้ใช้ (Roles)

| role        | ภาษาไทย         | สิทธิ์ |
|-------------|-----------------|--------|
| `admin`     | ผู้ดูแลระบบ      | ทั้งหมด รวมตั้งค่าระบบ |
| `executive` | ผู้บริหาร        | ดูภาพรวมทุกหน่วยงาน (รวมข้อมูลการเงิน) |
| `hr`        | เจ้าหน้าที่ HR    | จัดการข้อมูลเฉพาะหน่วยงานของตน |

---

## การติดตั้ง (Setup)

### 1) เตรียมฐานข้อมูล PostgreSQL
ใช้ PostgreSQL ที่ไหนก็ได้ (Supabase, Railway, เครื่อง local ฯลฯ) แล้วคัดลอก
**connection string** มา เช่น
`postgresql://USER:PASSWORD@HOST:5432/postgres`
(บน Supabase อยู่ที่ **Project Settings → Database → Connection string → URI**)

### 2) ตั้งค่า backend
```bash
cd backend
cp .env.example .env       # ใส่ DATABASE_URL และ JWT_SECRET
npm install
```
สร้าง `JWT_SECRET` แบบสุ่ม:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3) สร้างตาราง + ข้อมูลตัวอย่าง
```bash
cd backend
npm run migrate                       # รันทุกไฟล์ใน supabase/migrations ตามลำดับ
node scripts/db.mjs migrate           # (เทียบเท่า — ปลอดภัยที่จะรันซ้ำ)
```
> seed (5 หน่วยงานตัวอย่าง) อยู่ใน `supabase/seed.sql` — รันครั้งเดียวผ่าน SQL client
> หรือ paste ใน Supabase SQL Editor ก็ได้

### 4) สร้างผู้ใช้คนแรก (admin)
```bash
cd backend
npm run create-admin -- admin@vcb.local 'รหัสผ่านที่ต้องการ' "ผู้ดูแลระบบ"
```
รหัสผ่านจะถูก hash ด้วย bcrypt อัตโนมัติ ตรวจรายชื่อผู้ใช้ด้วย `npm run list-users`

### 5) รัน backend + frontend
```bash
cd backend  && npm run dev   # http://localhost:4000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

เปิด http://localhost:5173 แล้วล็อกอินด้วยผู้ใช้ admin ที่สร้างในขั้นตอนที่ 4

## ตรวจสุขภาพระบบ

- API health: `GET http://localhost:4000/api/health` → `{ "status": "ok" }`
- Frontend build: `cd frontend && npm run build`

## หมายเหตุความปลอดภัย

- `DATABASE_URL` และ `JWT_SECRET` เป็นความลับ — **ห้าม** ใส่ในฝั่ง frontend หรือ commit ขึ้น git
- backend ต่อ Postgres ตรงในฐานะ superuser-ish role จึงข้าม RLS — การควบคุมสิทธิ์ทั้งหมด
  อยู่ที่ชั้น API (`requireAuth` / `requireRole`) ไม่ใช่ที่ database
- รหัสผ่านเก็บเป็น bcrypt hash เท่านั้น (ไม่เก็บ plaintext); JWT เซ็นด้วย `JWT_SECRET`
- `.env` ถูก ignore ใน git แล้ว
