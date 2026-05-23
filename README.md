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

- **Frontend** (`frontend/`): Vite + React + Tailwind CSS. คุยกับ backend ผ่าน REST `/api`
- **Backend** (`backend/`): Node.js + Express เป็น API หลัก ถือ business logic/workflow ทั้งหมด
  เชื่อม Supabase ด้วย `service_role` key (ฝั่งเซิร์ฟเวอร์เท่านั้น)
- **Auth**: Supabase Auth (อีเมล + รหัสผ่าน) — backend ตรวจ token และโหลด profile (role + unit)
- **Database**: Supabase (PostgreSQL) — schema/seed อยู่ใน `supabase/`

## โครงสร้างโฟลเดอร์

```
hr-system/
├── backend/
│   ├── src/
│   │   ├── config/       env.js, supabase.js (admin + per-user clients)
│   │   ├── middleware/   auth.js (requireAuth/requireRole), errorHandler.js
│   │   ├── routes/       auth.routes.js, org.routes.js, index.js
│   │   ├── utils/        asyncHandler.js
│   │   ├── app.js        Express app (helmet, cors, json, routes)
│   │   └── server.js     entrypoint
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

### 1) สร้าง Supabase project
1. สมัคร/ล็อกอินที่ https://supabase.com แล้วสร้าง project ใหม่
2. ไปที่ **Project Settings → API** เพื่อคัดลอก:
   - `Project URL`
   - `anon public` key
   - `service_role` key (เก็บเป็นความลับ ใช้ฝั่ง backend เท่านั้น)

### 2) สร้างตารางในฐานข้อมูล
เปิด **SQL Editor** ใน Supabase แล้วรันไฟล์ตามลำดับ:
1. `supabase/migrations/0001_core_org_and_auth.sql`
2. `supabase/seed.sql` (ข้อมูลตัวอย่าง 5 หน่วยงาน — แก้ชื่อให้ตรงองค์กรจริงได้)

> หรือใช้ Supabase CLI: `supabase db push` (ต้อง `supabase link` กับ project ก่อน)

### 3) สร้างผู้ใช้คนแรก (admin)
1. ที่ Supabase ไปที่ **Authentication → Users → Add user** สร้างอีเมล/รหัสผ่าน
2. คัดลอก user id (UUID) แล้วรันใน SQL Editor:
   ```sql
   insert into profiles (id, full_name, role, is_active)
   values ('<USER_UUID>', 'ผู้ดูแลระบบ', 'admin', true);
   ```

### 4) ตั้งค่า backend
```bash
cd backend
cp .env.example .env       # ใส่ค่า SUPABASE_URL / ANON / SERVICE_ROLE
npm install
npm run dev                # http://localhost:4000
```

### 5) ตั้งค่า frontend
```bash
cd frontend
cp .env.example .env       # ปล่อย VITE_API_BASE_URL=/api ไว้ (ใช้ proxy)
npm install
npm run dev                # http://localhost:5173
```

เปิด http://localhost:5173 แล้วล็อกอินด้วยผู้ใช้ที่สร้างในขั้นตอนที่ 3

## ตรวจสุขภาพระบบ

- API health: `GET http://localhost:4000/api/health` → `{ "status": "ok" }`
- Frontend build: `cd frontend && npm run build`

## หมายเหตุความปลอดภัย

- `service_role` key มีสิทธิ์เต็ม (ข้าม RLS) — **ห้าม** ใส่ในฝั่ง frontend หรือ commit ขึ้น git
- ตารางเปิด Row Level Security ไว้เป็น defence-in-depth แม้ API จะเขียนผ่าน service_role
- `.env` ถูก ignore ใน git แล้ว
