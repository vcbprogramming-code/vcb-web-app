# คู่มือ Deploy — ระบบงานภายใน VCB (เปิด E-Memo ก่อน)

Deploy 3 ส่วน: **Database/Storage = Supabase (มีแล้ว)**, **Backend = Render**, **Frontend = Vercel**

> หมายเหตุ: ตอนนี้เปิดเฉพาะโมดูล **E-Memo** (โมดูลอื่นซ่อนไว้ — แก้ `frontend/src/config/nav.js`
> เปลี่ยน `enabled: false` เป็น `true` เมื่อพร้อมเปิด)

ลำดับสำคัญ: **Backend ก่อน → ได้ URL → Frontend → ได้ URL → กลับมาอัปเดต env Backend**

---

## เตรียมพร้อม

- โค้ดอยู่บน GitHub แล้ว: `vcbprogramming-code/vcb-web-app`
- มีค่าจาก `backend/.env` ของเครื่อง dev พร้อมก๊อปไปใส่ (DATABASE_URL, JWT_SECRET, S3_*, SMTP_*)
- สมัคร: [render.com](https://render.com) + [vercel.com](https://vercel.com) (ล็อกอินด้วย GitHub ได้)

---

## ส่วนที่ 1 — Backend บน Render

1. เข้า [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. เชื่อม GitHub → เลือก repo **vcb-web-app**
3. ตั้งค่า:
   - **Name:** `vcb-hr-api`
   - **Region:** Singapore
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. กด **Advanced** → **Add Environment Variable** ใส่ทีละตัว (ก๊อปค่าจาก `backend/.env`):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | (connection string Supabase) |
   | `JWT_SECRET` | (ค่าเดิมจาก .env) |
   | `JWT_EXPIRES_IN` | `604800` |
   | `MAX_UPLOAD_BYTES` | `26214400` |
   | `S3_ENDPOINT` | `https://plwgllrarqyxqgovjglf.storage.supabase.co/storage/v1/s3` |
   | `S3_REGION` | `ap-southeast-1` |
   | `S3_ACCESS_KEY_ID` | (จาก .env) |
   | `S3_SECRET_ACCESS_KEY` | (จาก .env) |
   | `S3_BUCKET` | `documents` |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | (จาก .env) |
   | `SMTP_PASS` | (SMTP key ล่าสุด) |
   | `MAIL_FROM` | `ระบบงานภายใน VCB <thanongsak40ni@gmail.com>` |
   | `CLIENT_ORIGIN` | (เว้นว่างไว้ก่อน — เติมหลังได้ URL Vercel) |
   | `APP_BASE_URL` | (เว้นว่างไว้ก่อน) |

5. กด **Create Web Service** → รอ build (~2-3 นาที)
6. ได้ URL เช่น **`https://vcb-hr-api.onrender.com`** → ก๊อปเก็บไว้
7. เช็ค: เปิด `https://vcb-hr-api.onrender.com/api/health` ต้องได้ `{"status":"ok"}`

---

## ส่วนที่ 2 — Frontend บน Vercel

1. เข้า [vercel.com/new](https://vercel.com/new) → Import repo **vcb-web-app**
2. ตั้งค่า:
   - **Root Directory:** `frontend` (กด Edit แล้วเลือก)
   - **Framework Preset:** Vite (auto)
3. **Environment Variables** → เพิ่ม 1 ตัว:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://vcb-hr-api.onrender.com/api` |
   > ⬆️ ใส่ URL Render จากส่วนที่ 1 + ลงท้าย `/api`

4. กด **Deploy** → รอ (~1 นาที)
5. ได้ URL เช่น **`https://vcb-hr.vercel.app`** → ก๊อปเก็บไว้

---

## ส่วนที่ 3 — เชื่อม 2 ฝั่ง (อัปเดต env Backend)

กลับไป Render → service `vcb-hr-api` → **Environment** → แก้ 2 ตัวที่เว้นว่างไว้:

| Key | Value |
|---|---|
| `CLIENT_ORIGIN` | `https://vcb-hr.vercel.app` (URL Vercel) |
| `APP_BASE_URL` | `https://vcb-hr.vercel.app` (URL Vercel) |

→ กด **Save Changes** → Render จะ redeploy อัตโนมัติ (~1 นาที)

> `CLIENT_ORIGIN` = ให้ backend ยอมรับ request จาก frontend (CORS)
> `APP_BASE_URL` = ลิงก์อนุมัติในอีเมลจะชี้มาที่ frontend จริง (กดจากมือถือได้)

---

## ทดสอบหลัง Deploy

1. เปิด `https://vcb-hr.vercel.app` → ล็อกอิน `admin@vcb.local` / `Admin@2048`
2. เห็น Portal → การ์ด **E-Memo** + **ตั้งค่าระบบ** (โมดูลอื่นซ่อน)
3. เข้า E-Memo → สร้างเอกสาร → สร้าง PDF → ส่งอนุมัติไปอีเมลจริง
4. เปิดอีเมลในมือถือ → กดปุ่มอนุมัติ → ต้องเปิดหน้าอนุมัติได้ (เพราะ APP_BASE_URL เป็น URL จริงแล้ว)

---

## หมายเหตุ

- **Render free tier sleep:** backend จะ "หลับ" หลังไม่มีคนใช้ 15 นาที — เปิดครั้งแรกหลังหลับจะช้า ~30 วินาที
  (ถ้าไม่อยากให้หลับ อัปเกรดเป็น paid $7/เดือน หรือใช้ cron ping ทุก 10 นาที)
- **เปิดโมดูลอื่นเพิ่ม:** แก้ `frontend/src/config/nav.js` เปลี่ยน `enabled: false → true` ของโมดูลนั้น
  → push GitHub → Vercel redeploy อัตโนมัติ
- **โดเมนบริษัท:** เพิ่มทีหลังได้ทั้ง Render (Custom Domain) และ Vercel (Domains) → ตั้ง DNS CNAME
- **Secrets:** อยู่ใน Render/Vercel dashboard เท่านั้น — ไม่อยู่ใน git
