# โครงสร้างโฟลเดอร์นี้ — อ่านก่อนถ้าสงสัยว่าทำไมมีไฟล์ที่ไม่เกี่ยวกับ HR

> **สรุปสั้น:** โฟลเดอร์นี้ไม่ได้มีแค่ HR Work Log — มันคือ working copy ของ
> **monorepo ที่หลายแอปใช้ร่วมกัน** ไฟล์ของ HR Work Log อยู่ใน 2 โฟลเดอร์นี้เท่านั้น:
>
> | โฟลเดอร์ | คืออะไร | สถานะ |
> |---|---|---|
> | **`ORIGINAL CODE/`** | Google Apps Script · **JavaScript** ล้วน ไม่มีขั้นตอน compile<br>backend = ฟังก์ชัน `api_*` ใน `Code.gs` · frontend = `PAGE_HTML_` ใน `Code.gs` | 🟢 **ใช้งานจริง** |
> | **`FOR DEPLOYMENT TEAM/`** | **React 18 + TypeScript** (Vite)<br>frontend = `src/` · backend = ยังไม่มี (ใช้ `src/mock.ts`) | ⚪ ยังไม่ deploy |
>
> ⚠ **แก้ของจริงต้องแก้ที่ [`ORIGINAL CODE/`](ORIGINAL%20CODE/)** — ผู้ใช้ทุกคนเห็นแอปจากโฟลเดอร์นั้น
> `FOR DEPLOYMENT TEAM/` เป็น port ที่ sync ตามทีหลัง อ่าน
> [`FOR DEPLOYMENT TEAM/PORT_NOTES.md`](FOR%20DEPLOYMENT%20TEAM/PORT_NOTES.md)
> ก่อนสรุปว่าฟีเจอร์ไหนมีแล้ว

---

## ทำไมถึงมีไฟล์ของ E-Memo และแอปอื่นอยู่ในนี้

**เพราะโฟลเดอร์นี้ไม่ได้เริ่มต้นจากการเป็น HR Work Log** ประวัติ git บอกว่า:

```
28d8a3c  Initial commit
20a6d65  Scaffold HR system foundation: monorepo, backend API, frontend, DB schema
37fa5aa  Checkpoint: Module 1 E-Memo on Postgres/Supabase…
a241987  Migrate Module 1 from Postgres/Supabase to MongoDB Atlas + GridFS
```

เดิมมันคือ **monorepo ของ "ระบบ HR" ทั้งระบบ** (Node + Postgres/Mongo + React)
โดยมี E-Memo เป็นโมดูลแรก ส่วนแอป HR Work Log ที่เป็น Apps Script ถูกเพิ่มเข้ามา
**ทีหลัง** ในโฟลเดอร์ที่มีของพวกนั้นอยู่ก่อนแล้ว

ดังนั้นไฟล์ E-Memo **ไม่ใช่ของที่หลงเข้ามา** แต่เป็นเจ้าของเดิมของโฟลเดอร์นี้ —
HR Work Log ต่างหากที่เป็นผู้มาทีหลัง

**อีกชั้นหนึ่ง:** โฟลเดอร์นี้ต่อกับ 2 remote

| Remote | Repo | หมายเหตุ |
|---|---|---|
| `origin` | `VCB-HR` (private) | repo เดิมของระบบ HR |
| `vcb-web-app` | monorepo รวม | **หลาย session ช่วยกัน push คนละแอป** |

แอปอื่น (`meeting-minutes/`, `sop/`, `portal/`, `credit-facility/`,
`System Operating Map/`) เข้ามาทาง `vcb-web-app` เพราะทุกแอป push ขึ้น branch
เดียวกัน — ไม่ได้เกี่ยวกับ HR Work Log เลย

---

## แผนที่: อะไรเป็นของใคร

### ✅ ของ HR Work Log

| Path | คืออะไร |
|---|---|
| `ORIGINAL CODE/` | Apps Script ที่ใช้งานจริง (`Code.gs`, `History.gs`, `appsscript.json`) |
| `FOR DEPLOYMENT TEAM/` | React + TypeScript preview |
| `HR-WORK-LOG.md` | เอกสารสถาปัตยกรรม + บันทึกทุก session |
| `STRUCTURE.md` | ไฟล์นี้ |
| `.clasp.json` | ตั้ง `rootDir` ชี้ไป `ORIGINAL CODE/` (ไม่อยู่ใน git — เฉพาะเครื่อง) |
| `.githooks/` | ลบ `desktop.ini` ที่ Google Drive เขียนใส่ `.git/` |

### ❌ ไม่ใช่ของ HR Work Log — อย่าแก้

| Path | เป็นของ |
|---|---|
| `backend/`, `frontend/`, `supabase/`, `render.yaml` | **E-Memo** (Node + Mongo + React) |
| `README.md`, `DEPLOY.md`, `เอกสารสรุปฟังก์ชันระบบ.md`, `docs/` | **E-Memo** — ไม่ได้อธิบายแอปนี้ |
| `meeting-minutes/`, `sop/`, `portal/`, `credit-facility/`, `System Operating Map/` | React mirror ของแอปอื่น ที่ push มารวมกัน |

> ⚠ `README.md` ที่ root **เป็นของ E-Memo** ไม่ใช่ของ HR Work Log
> เอกสารของแอปนี้คือ `HR-WORK-LOG.md`

---

## แอปอื่นแต่ละตัวอยู่ที่ไหน (โฟลเดอร์ทำงานจริง)

โฟลเดอร์ที่เห็นใน repo นี้เป็นแค่ React mirror ที่ push มารวม — **ตัว Apps Script
จริงของแต่ละแอปอยู่คนละโฟลเดอร์กันที่ `E:\WORK\08 CLAUDE CODE\`** และมี
`.clasp.json` + script ID ของตัวเอง:

| แอป | โฟลเดอร์ทำงานจริง |
|---|---|
| HR Work Log | `HR Work Log Web App/` ← **ที่นี่** |
| Credit Facility | `Credit Facility Web App/` |
| System Operating Map | `System Map App/` |
| SOP | `SOP Web App/` |
| Meeting Minutes | `Meeting Minute Web App/` |
| E-Memo | `E-Memo Web App/` |

**อย่าแก้ Apps Script ของแอปอื่นจากในโฟลเดอร์นี้** — ที่เห็นเป็นแค่ mirror
ต้องไปแก้ที่โฟลเดอร์ทำงานของแอปนั้นโดยตรง

---

## การตั้งชื่อโฟลเดอร์

`ORIGINAL CODE` / `FOR DEPLOYMENT TEAM` เป็นชื่อเดียวกับที่ **SOP Web App** และ
**Meeting Minutes** ใช้อยู่ ตั้งใจให้ตรงกันทั้งกลุ่ม เพื่อให้คนที่ดูหลายแอป
ไม่ต้องเรียนรู้ใหม่ทุกครั้ง

ความหมายคือ **สถานะการใช้งาน** ไม่ใช่ภาษา:

- `ORIGINAL CODE` = ของเดิมที่คนใช้งานอยู่จริง (บังเอิญเป็น Apps Script)
- `FOR DEPLOYMENT TEAM` = ของที่เตรียมส่งต่อให้ทีม deploy ทำต่อ (บังเอิญเป็น React)

---

## เรื่องที่ต้องระวัง

**Google Drive กับ `.git/`** — โฟลเดอร์นี้อยู่ในเส้นทางที่ Google Drive sync
Drive จะเขียน `desktop.ini` ลงในทุกโฟลเดอร์ที่ sync **รวมถึง `.git/refs/` และ
`.git/objects/`** ซึ่งทำให้ git พังด้วย error แบบ:

```
fatal: bad object refs/desktop.ini
fatal: failed to write object
```

`.gitignore` แก้ไม่ได้ (มันคุมแค่ working tree ไม่ใช่ข้างใน `.git/`)
มี hook ใน `.githooks/` คอยลบให้ก่อน commit/push/checkout — เปิดใช้ครั้งเดียวต่อ clone:

```
git config core.hooksPath .githooks
```

ถ้า git พังขึ้นมา แก้มือด้วย:

```
find .git -name desktop.ini -delete
```

**ทางแก้ถาวรอยู่นอก git:** ตั้งไม่ให้ Drive sync โฟลเดอร์ `.git/`

---

## คำสั่งที่ใช้บ่อย

```sh
# Deploy Apps Script — รันจากโฟลเดอร์นี้ (ไม่ใช่จากใน ORIGINAL CODE/)
clasp push
clasp deploy -i AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA -d "รายละเอียด"

# React preview
cd "FOR DEPLOYMENT TEAM"
npm install && npm run dev      # http://localhost:5173
npm run typecheck && npm run build
```

รายละเอียดทั้งหมด: [`HR-WORK-LOG.md`](HR-WORK-LOG.md)
