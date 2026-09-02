# VCB Connect

Internal web portal for VCB Group (วิจิตรภัณฑ์ก่อสร้าง) — eight applications
behind one sign-in.

ระบบงานภายในของกลุ่มวิจิตรภัณฑ์ก่อสร้าง — 8 ระบบงาน เข้าใช้งานด้วยบัญชีเดียว

---

## The applications · ระบบงาน

| App | Does | ทำอะไร |
|---|---|---|
| **Portal** | Launcher, announcements, holiday calendar | หน้าหลัก ประกาศ ปฏิทินวันหยุด |
| **HR Work Log** | Daily labour records — 8 sites, ~345 staff, manday reporting | บันทึกการทำงานรายวัน 8 หน่วยงาน พนักงาน ~345 คน |
| **Credit Facility** | Bank facilities, drawdowns, approvals, monthly cash plan | วงเงินสินเชื่อ การเบิกใช้ การอนุมัติ แผนกระแสเงินสด |
| **Meeting Minutes** | Minutes, decisions, action items; auto-import from Fathom/Transkriptor | บันทึกการประชุม มติ รายการติดตาม นำเข้าอัตโนมัติ |
| **SOP** | MANGO ERP procedures, versioned | ระเบียบปฏิบัติ MANGO ERP พร้อมประวัติเวอร์ชัน |
| **System Map** | System-to-system connections by department | แผนผังการเชื่อมโยงระบบ แยกตามแผนก |
| **Onboarding** | 90-day new-employee programme with progress tracking | ปฐมนิเทศ 90 วัน พร้อมติดตามความคืบหน้า |
| **E-Memo** | Document control, memo issuance, approval workflow | ควบคุมเอกสาร ออกบันทึกข้อความ ขั้นตอนอนุมัติ |

UI is Thai by default, English available. · ค่าเริ่มต้นเป็นภาษาไทย เลือกภาษาอังกฤษได้

---

## Two codebases · โค้ดสองชุด

```
ORIGINAL CODE/          Google Apps Script. LIVE — staff use this daily.
FOR DEPLOYMENT TEAM/    React + Express + Postgres. Not deployed.
├── api/                one Express API, 7 route files
├── shared/             auth, i18n, theme, API client, AppBar
├── supabase/           8 migrations, 43 tables
└── <module>/           one Vite SPA per app
```

The live apps keep running until the replacement is verified. Do not change
`ORIGINAL CODE/` and `FOR DEPLOYMENT TEAM/` expecting them to stay in step —
they are separate implementations, not two copies.

ระบบเดิมยังใช้งานตามปกติจนกว่าระบบใหม่จะผ่านการตรวจสอบ

---

## Stack

React 18 · Vite · Tailwind · Express (Node ≥20) · PostgreSQL (Supabase) ·
JWT + bcrypt + Google Sign-In · ExcelJS · PDFKit · pdf-lib

No TypeScript, no Redux, no ORM, no chart or UI libraries — see
[TECH_STACK.md](TECH_STACK.md) for what is excluded and why.

---

## Run it locally

```bash
cd "FOR DEPLOYMENT TEAM/api" && npm install && npm run dev     # :3000
cd "FOR DEPLOYMENT TEAM/portal" && npm install && npm run dev  # :5173
```

`api/.env` needs `DATABASE_URL` (Supabase **pooler**, port 6543 — Render is
IPv4-only) and `JWT_SECRET` (≥32 chars). Both are checked at startup. Thai
fonts must be in `api/assets/fonts/` or the API refuses to boot; see the README
there.

Every module is its own Vite app with its own port. `@vcb/shared` is aliased to
`../shared/src`, not installed.

---

## Things that will cost you an afternoon

**Buddhist era.** A sheet tab named `2569-08` is Gregorian `2026-08`. Off by
543. Use the helpers in `api/src/lib/excel.js`.

**HR slots.** Slot 1 is งานหลัก, slot 2 is งานเสริม — not AM/PM. Both filled is
**one** manday. Use the `hr.mandays` view; counting `work_entries` rows
double-counts every two-task day.

**Schema qualification.** `hr.employees` and `onboarding.employees` are
different tables. Always qualify.

**One origin.** Theme, language and session live in `localStorage`, which is
per-origin. Serve every module from `vcb-connect.com/<path>`, never a subdomain.
See [`docs/ONE_DOMAIN.md`](FOR%20DEPLOYMENT%20TEAM/docs/ONE_DOMAIN.md).

**Access is not enforced yet.** `resolveRoles()` still reads six per-module
tables; `portal.access_grants` exists but nothing reads it. Populate and diff
before switching. See [`docs/ACCESS_MODEL.md`](FOR%20DEPLOYMENT%20TEAM/docs/ACCESS_MODEL.md).

**`.gscript` files are live cloud objects.** Deleting one locally trashes the
real Apps Script project. This has already cost six apps once.

---

## Read next

| File | For |
|---|---|
| [ARCHITECTURE_STANDARD.md](ARCHITECTURE_STANDARD.md) | Script IDs, data locations, per-app inventory |
| [TECH_STACK.md](TECH_STACK.md) | What to build with, what not to |
| [`docs/ACCESS_MODEL.md`](FOR%20DEPLOYMENT%20TEAM/docs/ACCESS_MODEL.md) | Roles, grants, what is not wired |
| [`docs/ONE_DOMAIN.md`](FOR%20DEPLOYMENT%20TEAM/docs/ONE_DOMAIN.md) | Deployment topology |
| `<module>/PORT_NOTES.md` | What each port covers and what it does not |
| `supabase/migrations/` | Schema, one file per app, traps noted inline |

Source comments explain *why*, not *what*. Read them before changing anything —
several record a bug that was expensive to find.

---

*VCB Group · internal use only · กลุ่มวิจิตรภัณฑ์ก่อสร้าง*
