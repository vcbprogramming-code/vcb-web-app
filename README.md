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

The live apps keep running until the replacement is verified. The two trees are
separate implementations of the same requirements, not two copies of one
codebase: a change in one does not appear in the other.

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

`api/.env` requires `DATABASE_URL` (Supabase **pooler**, port 6543 — Render is
IPv4-only) and `JWT_SECRET` (≥32 chars). Both are checked at startup. Thai
fonts must be in `api/assets/fonts/` or the API refuses to boot; see the README
there.

Every module is its own Vite app with its own port. `@vcb/shared` is aliased to
`../shared/src`, not installed.

---

## Constraints in the data model

Facts about how this system stores things. They are not preferences and do not
change with taste.

**Buddhist era.** Sheet tabs and Thai-facing dates are BE; the database is
Gregorian. `2569-08` is `2026-08` — a 543-year offset. Conversion lives in
`api/src/lib/excel.js`.

**HR slots are tasks, not times.** Slot 1 is งานหลัก, slot 2 is งานเสริม. The
"AM"/"PM" column names in the legacy sheet are historical and misleading. A day
with both slots filled is **one** manday, which is what the `hr.mandays` view
expresses; `work_entries` has one row per slot and counting it double-counts
every two-task day.

**Two `employees` tables.** `hr.employees` is keyed by `eid`;
`onboarding.employees` is keyed by name and unrelated. Unqualified
`employees` resolves by search_path, not intent.

**localStorage is per-origin.** `vcb_theme`, `vcb_lang` and `vcb_token` do
not cross between hosts, so a subdomain per module breaks the shared session and
appearance. Module links carry `?theme=` and `?lang=` as a fallback for
bookmarks and development. Topology in
[`docs/ONE_DOMAIN.md`](FOR%20DEPLOYMENT%20TEAM/docs/ONE_DOMAIN.md).

**Access control is defined but not enforced.** `resolveRoles()` reads six
per-module tables. `portal.access_grants` and `portal.app_roles` exist and
have endpoints, but nothing reads them for authorisation yet. The four steps to
switch over, in order, are in
[`docs/ACCESS_MODEL.md`](FOR%20DEPLOYMENT%20TEAM/docs/ACCESS_MODEL.md).

**`.gscript` and `.gsheet` files are live cloud objects.** They are pointers
Drive resolves, not local copies. Deleting or moving one locally trashes the
real Apps Script project or Spreadsheet. This has already happened.

**PDFKit drops missing glyphs silently.** Without Sarabun in
`api/assets/fonts/`, Thai text is absent from generated PDFs with no error.
`assertFontsPresent()` runs before `app.listen()` so the API refuses to boot
instead.

---

## Read next

| File | For |
|---|---|
| [ARCHITECTURE_STANDARD.md](ARCHITECTURE_STANDARD.md) | Script IDs, data locations, per-app inventory |
| [TECH_STACK.md](TECH_STACK.md) | The stack, and what is deliberately excluded |
| [`docs/ACCESS_MODEL.md`](FOR%20DEPLOYMENT%20TEAM/docs/ACCESS_MODEL.md) | Roles, grants, what is not wired |
| [`docs/ONE_DOMAIN.md`](FOR%20DEPLOYMENT%20TEAM/docs/ONE_DOMAIN.md) | Deployment topology |
| [`docs/CHROME.md`](FOR%20DEPLOYMENT%20TEAM/docs/CHROME.md) | The shared bar every module wears, and its measurements |
| `<module>/PORT_NOTES.md` | What each port covers and what it does not |
| `supabase/migrations/` | Schema, one file per app, traps noted inline |

Source comments record *why* a decision was made rather than what the code does.
Several document a bug that took a long time to find.

---

*VCB Group · internal use only · กลุ่มวิจิตรภัณฑ์ก่อสร้าง*
