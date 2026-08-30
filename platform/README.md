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
[ React (Vite + Tailwind) ]  ──HTTP──>  [ Node.js / Express API ]  ──>  [ MongoDB Atlas (Mongoose + GridFS) ]
       frontend/                              backend/                         backend/src/models/
```

**Deploy target: Railway.** Frontend + backend Express both deploy to Railway.
The backend runs as a normal long-running Express server (no serverless
restructure needed). Scheduled/long work (email auto-log, monthly rollups,
interest recompute) runs as a Railway cron service or an in-process scheduler —
no per-request timeout limits.

- **Frontend** (`frontend/`): Vite + React + Tailwind CSS. คุยกับ backend ผ่าน REST `/api`
- **Backend** (`backend/`): Node.js + Express เป็น API หลัก ถือ business logic/workflow ทั้งหมด
  เชื่อมต่อ MongoDB ด้วย **Mongoose** (connection string เดียว) — ไฟล์แนบ/PDF เก็บใน **GridFS**
- **Auth**: จัดการเองในฝั่ง backend — อีเมล + รหัสผ่าน (bcrypt) แลกเป็น JWT,
  middleware ตรวจ token แล้วโหลด profile (role + unit) จาก collection `profiles`
- **Database**: MongoDB (โฮสต์บน Atlas หรือที่ไหนก็ได้) — Mongoose models อยู่ใน `backend/src/models/`,
  seed ข้อมูลอ้างอิงผ่าน `npm run seed`

## โครงสร้างโฟลเดอร์

```
hr-system/
├── backend/
│   ├── src/
│   │   ├── config/       env.js, db.js (Mongoose connect), storage.js (GridFS)
│   │   ├── models/       Mongoose schemas (Profile, Project, Document, …)
│   │   ├── middleware/   auth.js (requireAuth/requireRole), errorHandler.js
│   │   ├── routes/       auth/org/projects/documents/approvals/admin.routes.js
│   │   ├── services/     docNumber, approval, pdfDoc, letterhead, email
│   │   ├── utils/        asyncHandler.js, auth.js (JWT+bcrypt), serialize.js
│   │   ├── app.js        Express app (helmet, cors, json, routes)
│   │   └── server.js     entrypoint (connect + syncIndexes + listen)
│   ├── scripts/         db.mjs (seed / create-admin / list-users), verify-*.mjs
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── auth/         AuthContext.jsx, ProtectedRoute.jsx
│   │   ├── components/   AppLayout.jsx (sidebar + header)
│   │   ├── config/       nav.js (เมนู + สิทธิ์ตามบทบาท)
│   │   ├── lib/          api.js (fetch + multipart/blob helpers), ememo.js
│   │   ├── pages/        Login, Dashboard, ememo/*, admin/*
│   │   ├── App.jsx       routes
│   │   └── main.jsx
│   └── .env.example
└── supabase/             (legacy Postgres SQL — kept for reference only)
    ├── migrations/*.sql
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

### 1) เตรียมฐานข้อมูล MongoDB

ใช้ MongoDB ที่ไหนก็ได้ (Atlas, เครื่อง local ฯลฯ) แล้วคัดลอก **connection string** มา เช่น
`mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/hr_system?retryWrites=true&w=majority`
(บน Atlas อยู่ที่ **Cluster → Connect → Drivers**)

### 2) ตั้งค่า backend
```bash
cd backend
cp .env.example .env       # ใส่ MONGODB_URI และ JWT_SECRET
npm install
```
สร้าง `JWT_SECRET` แบบสุ่ม:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3) seed ข้อมูลอ้างอิง (idempotent — รันซ้ำได้)

```bash
cd backend
npm run seed                          # โครงการ + doc-code mapping + ประเภทเอกสาร + counters
```

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
- End-to-end (in-memory MongoDB, no external services):
  `cd backend && node scripts/verify-e2e.mjs` และ `node scripts/verify-concurrency.mjs`

## หมายเหตุความปลอดภัย

- `MONGODB_URI` และ `JWT_SECRET` เป็นความลับ — **ห้าม** ใส่ในฝั่ง frontend หรือ commit ขึ้น git
- การควบคุมสิทธิ์ทั้งหมดอยู่ที่ชั้น API (`requireAuth` / `requireRole`) ไม่ใช่ที่ database
- ไฟล์แนบ/PDF เก็บใน GridFS และสตรีมผ่าน API ที่ต้องมี token (ไม่มี public/presigned URL)
- รหัสผ่านเก็บเป็น bcrypt hash เท่านั้น (ไม่เก็บ plaintext); JWT เซ็นด้วย `JWT_SECRET`
- `.env` ถูก ignore ใน git แล้ว
