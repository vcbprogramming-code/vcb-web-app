# FOR DEPLOYMENT TEAM — ตัวอย่าง UI ด้วย React + TypeScript

> **⚠️ นี่ไม่ใช่ระบบที่ใช้งานจริง** — ระบบจริงอยู่ที่
> [`../ORIGINAL CODE/`](../ORIGINAL CODE/) โฟลเดอร์นี้ใช้ mock data
> ไม่มี backend และข้อมูลที่แก้จะหายเมื่อ refresh


A React + TypeScript replica of the Google Apps Script app in the parent folder
(`../ORIGINAL CODE/Code.gs`). It mirrors the live UI pixel-for-pixel (the CSS is extracted
verbatim) with a typed mock data layer, so it runs with **no backend**.

> This folder is a **downstream mirror** of the canonical GAS project. See
> [PORT_NOTES.md](./PORT_NOTES.md) for the parity checklist, file mapping, and the
> last-synced GAS version. The GAS app is edited first; this is regenerated from it.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```sh
npm run typecheck   # strict tsc, no emit
npm run build       # tsc --noEmit && vite build  → dist/
npm run preview     # serve the production build
```

## Deploy to Vercel

This subfolder is self-contained and deploys on its own.

- **Vercel dashboard:** New Project → import the repo → set **Root Directory** to
  `FOR DEPLOYMENT TEAM` → Framework preset **Vite** → deploy. (Build `npm run build`,
  output `dist`.)
- **Vercel CLI:** from this folder, `vercel` (or `vercel --prod`).

## Tech

- React 18 + TypeScript (strict) + Vite
- `src/types.ts` — typed models mirroring the GAS server return shapes
- `src/mock.ts` — typed mock data layer (swap for `fetch()` to the GAS `/exec`
  endpoint, or a real API, keeping the same `types.ts` contracts, to go live)
- `src/settings.tsx` — language / theme / year-format / display prefs (localStorage)
- `src/app.css` — verbatim from the GAS `<style>` block (do not hand-edit)
- `src/i18n_data.ts` — verbatim Thai↔English `T` dictionary from the GAS source

## Structure

```
src/
  main.tsx          entry; mounts <SettingsProvider><App/>
  App.tsx           topbar + nav + view routing + MonthNav
  Dashboard.tsx     3 view modes, site cards, rings, mini-calendar
  Entry.tsx         site picker + Overview heatmap + Weekly grid + editing
  Picker.tsx        two-step Activity→Category searchable picker
  WorkIndex.tsx     Activity + Work Category tables
  SettingsPage.tsx  settings UI
  settings.tsx      settings context + t()/mname/be helpers
  i18n.ts           translate/month/dow helpers
  types.ts          API model interfaces
  mock.ts           typed mock API (BOOT / siteMonth / adminSummary)
  app.css           verbatim GAS stylesheet
  i18n_data.ts      verbatim GAS translation dictionary
  extra.css         small supplement (inline-built GAS elements)
```

## สถาปัตยกรรม — ทำไมที่นี่ถึงไม่มีโฟลเดอร์ backend

โฟลเดอร์นี้มีเฉพาะ **frontend** เท่านั้น ซึ่งต่างจาก `../ORIGINAL CODE/`
ที่รวม frontend กับ backend ไว้ในไฟล์เดียว:

```
../ORIGINAL CODE/Code.gs        FOR DEPLOYMENT TEAM/  (นี่)
├── backend  (api_* , Sheets)   ⟷    ├── ❌ ไม่มี backend
└── frontend (PAGE_HTML_)             │       ใช้ src/mock.ts แทน
                                      └── frontend (src/*.tsx)
```

`src/mock.ts` เลียนแบบ **รูปแบบข้อมูลที่ `api_*` ส่งกลับ** ให้ตรงกันทุกฟิลด์
(ดู `src/types.ts`) จึงเปลี่ยนไปใช้ backend จริงได้โดยไม่ต้องแก้ UI:

| จะทำให้ใช้งานจริง | วิธี |
|---|---|
| ทางที่ 1 | ชี้ไปที่ GAS `/exec` เดิม — เปลี่ยน mock เป็น `fetch()` โดยคง type ใน `src/types.ts` |
| ทางที่ 2 | เขียน backend ใหม่ (Node + Supabase) แบบเดียวกับแอป E-Memo |

**ตอนนี้ยังไม่ได้ทำทั้งสองทาง** — ดู `STATUS.md`

## กฎการ sync

`../ORIGINAL CODE/Code.gs` คือแหล่งความจริง โฟลเดอร์นี้ตามหลังเสมอ

ไฟล์ 3 ตัวนี้ **ดึงอัตโนมัติจาก `Code.gs` — ห้ามแก้ด้วยมือ**:

| ไฟล์ | ดึงมาจาก |
|---|---|
| `src/i18n_data.ts` | `var T = {…}` (318 รายการ) |
| `src/app.css` | บล็อก `<style>…</style>` |
| `ACTIVITIES` ใน `src/mock.ts` | `var VCB_WORK_TYPES = […]` (44 รายการ) |

`src/extra.css` เป็น CSS ที่เขียนเองไฟล์เดียว

## หมายเหตุสำหรับนักพัฒนา

**วันที่ใน leave models เป็น `string` ทุกตัว ไม่ใช่ `Date` โดยเจตนา** — ฝั่ง GAS
แปลงค่าก่อนส่งกลับเสมอ (Google Sheets คืนค่าเป็น Date object สำหรับเซลล์ที่
หน้าตาเหมือนวันที่ และปัด id ที่ยาวเกิน 15 หลัก) ประกาศเป็น `Date` จะไม่ตรงกับ
ข้อมูลจริงที่วิ่งผ่านสาย

**`Z-1`/`Z-2`/`Z-3` เป็น `one-to-one` แต่ `fixed_cost` ว่าง** — `composite()`
ใน `mock.ts` ต้องคืนรหัสเปล่า ๆ ตามกฎเดียวกับ GAS
(`fixed ? code + ' / ' + fixed : code`) ถ้าใช้ `fixed_cost!` จะได้
`"Z-2 / undefined"` ในเซลล์

**ใบขอลาสำหรับพิมพ์ไม่ได้ port มา** — ฝั่ง GAS เปิดหน้าต่าง print แล้วเขียน
เอกสาร A4 ลงไป ไม่มีสิ่งเทียบเท่าใน preview ที่ไม่มี backend
