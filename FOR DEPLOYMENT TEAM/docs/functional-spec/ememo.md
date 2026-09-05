# E-Memo — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

## หมายเหตุสำคัญก่อนอ่าน (ต้องอ่านก่อน)

- **E-Memo เป็นแอปมาตรฐานเดี่ยว (standalone) ที่เขียนด้วย TypeScript** ต่างจากอีก 7 โมดูลของ VCB Connect ที่เขียนด้วย JavaScript ธรรมดา
- **โมดูลนี้ไม่ได้ import `@vcb/shared`** — ไม่ใช้ component, token หรือ utility ร่วมจากแพ็กเกจกลางของระบบ ทุกอย่างที่ดูเหมือนของที่ใช้ร่วมกัน (เช่นค่าตัวเลขของแถบ header, ธีม, ภาษา) เป็น "สำเนา" ที่เขียนไว้ในโค้ดของโมดูลนี้เอง ไม่ใช่การเชื่อมต่อจริงกับแพ็กเกจกลาง
- **ห้ามรวม E-Memo เข้าใน sweep หรือการไล่แก้ข้ามโมดูล (cross-module sweep)** ใด ๆ ที่อ้างอิง `@vcb/shared` เพราะโมดูลนี้จะไม่ได้รับผลจากการแก้ที่จุดกลาง และการแก้ไขอัตโนมัติที่คาดหวัง pattern ของ JavaScript module อื่นอาจใช้ไม่ได้กับโครงสร้าง TypeScript/React ของที่นี่
- **โมดูลนี้ส่งมอบให้ผู้พัฒนาภายนอก (external developer) ดูแลต่อ** เอกสารนี้มีไว้เพื่อ "บันทึกสิ่งที่มีอยู่จริงในโค้ด" เท่านั้น ไม่ใช่คำแนะนำให้แก้ไขหรือปรับปรุงสิ่งใด
- **เอกสาร PORT_NOTES.md ของโมดูลระบุชัดเจนว่า "port นี้ตามหลังแอปจริงอยู่"** — มีการเปลี่ยนแปลงฝั่ง Apps Script (ระบบเดิม) หลังจากซิงก์ครั้งล่าสุดที่ไม่เคยถูกนำมาใส่ในพอร์ต TypeScript นี้ หากพบว่าโค้ดสองฝั่งไม่ตรงกัน ให้ถือว่า **เวอร์ชัน Apps Script (ระบบที่ใช้งานจริง) ถูกต้องกว่า** และควรตรวจสอบก่อนสรุปว่าฟีเจอร์ใดหายไปจริง หรือแค่ยังไม่ถูกพอร์ตมา

---

## 1. ภาพรวมของโมดูล

E-Memo (ชื่อในส่วนหัวของแอป: "ระบบควบคุมเอกสาร · อีเมโม" / "Document Control · e-Memo") เป็นระบบ **ควบคุมเอกสารภายในและระบบอนุมัติหนังสือ (memo/letter) แบบดิจิทัล** สำหรับบริษัทวิจิตรภัณฑ์ก่อสร้าง จำกัด ใช้เพื่อ:

1. **บันทึกทะเบียนเอกสาร (document register)** ของแต่ละโครงการก่อสร้าง — ใครส่งเอกสารอะไร วันที่เท่าไร รหัสประเภทอะไร สถานะเป็นอย่างไร
2. **ออกหนังสือราชการ/บันทึกภายใน (letterhead memo)** โดยระบบสร้างหัวจดหมาย เลขที่อ้างอิง วันที่ และลายเซ็นให้อัตโนมัติจากข้อมูลที่กรอก (โครงการ + รหัสประเภทเอกสาร)
3. **ควบคุมกระบวนการอนุมัติ (approval workflow)** ผ่านการแสดงความเห็น (comment), อนุมัติ (approve), ไม่อนุมัติ (reject) และเปิดเอกสารใหม่เพื่อพิจารณาอีกครั้ง (reopen)
4. **จำกัดสิทธิ์การเข้าถึงเอกสารบางประเภท** ตามรหัสเอกสารหรือโครงการ (access control / confidential gating)

ต้นทางของแอปนี้คือ Google Apps Script (GAS) ที่รันภายใน iframe ของ Google (เข้าถึง Gmail, Drive, Sheets ได้จริง) ส่วนโค้ดที่อยู่ใน `E:\WORK\08 CLAUDE CODE\VCB Connect\FOR DEPLOYMENT TEAM\ememo\` เป็น **การพอร์ต (port) แอปนั้นมาเป็น React + TypeScript แบบ "1:1"** ให้ทำงานนอก Google iframe ได้ โดยชั้นข้อมูลจริง (Gmail/Drive/Sheets) ถูกแทนที่ด้วยชั้น mock ในหน่วยความจำทั้งหมด (ดูหัวข้อ 4)

โครงสร้างไฟล์หลัก:

| ไฟล์ | หน้าที่ |
|---|---|
| `src/App.tsx` | หน้าหลัก: ตาราง/ทะเบียนเอกสาร, ตัวกรอง, การเรียงลำดับ, ส่วนหัว (header) |
| `src/api/types.ts` | นิยามชนิดข้อมูล (data model) ที่ตรงกับ contract ของ Apps Script (Code.js) ทุกประการ |
| `src/api/mock.ts` | Implementation ของ API แบบ mock ในหน่วยความจำ (ไม่แตะ Google service ใด ๆ) |
| `src/api/index.ts` | จุดสลับชั้นข้อมูล (data-layer swap point) — export `api` object ที่ resolve ไปที่ mock ปัจจุบัน |
| `src/components/AddPanel.tsx` | แผงสร้าง/ส่งเอกสารใหม่ (create/issue memo) |
| `src/components/ReviewModal.tsx` | หน้าต่างตรวจสอบเอกสารและดำเนินการ approval workflow |
| `src/components/AccessControl.tsx` | ตัวแก้ไขสิทธิ์การเข้าถึง (admin-only) |
| `src/components/SettingsModal.tsx` | หน้าต่างตั้งค่า (ธีม/ภาษา/รูปแบบวันที่/ผู้ใช้/sign out) — เป็นที่ฝัง AccessControl |
| `src/components/AckDialog.tsx` | Dialog ยืนยัน (confirm) แบบ custom ใช้แทน `window.confirm()` |
| `src/store.tsx` | State กลางของแอป (ธีม, ภาษา, รูปแบบวันที่ยุค, mock auth) ผ่าน React Context |
| `src/i18n.ts` | ข้อความสองภาษา (TH/EN), ชื่อโครงการ, ตารางรหัสเอกสาร→หน่วยงาน, ฟังก์ชันช่วยจัดรูปแบบ |
| `src/main.tsx` | จุดเริ่มต้น React (mount `<App/>` ภายใต้ `StoreProvider`) |
| `PORT_NOTES.md` | บันทึกจุดที่พอร์ตแบบ 1:1 ไม่ได้ และทำอะไรแทน |

---

## 2. Data Model (จาก `src/api/types.ts`)

ไฟล์นี้เป็น "กระจกสะท้อน" (TypeScript mirror) ของ contract ที่ Apps Script (`Code.js`) ส่งกลับให้ฝั่ง client ผ่าน `google.script.run` ทุกรูปร่างข้อมูล (shape) ในไฟล์นี้ต้องตรงกับสิ่งที่ระบบจริงส่งกลับมา

### 2.1 สถานะเอกสารและ action

```ts
export type Status = 'pending' | 'commented' | 'approved' | 'rejected'
export type ReviewAction = 'comment' | 'approve' | 'reject' | 'reopen' | 'delete' | 'mango'
```

- **`Status`** คือสถานะปัจจุบันของเอกสาร 1 รายการ มี 4 ค่า: รอดำเนินการ / มีความเห็น / อนุมัติแล้ว / ไม่อนุมัติ
- **`ReviewAction`** คือ "เหตุการณ์" แต่ละรายการในกระทู้สนทนาของเอกสาร (discussion thread) — `mango` หมายถึงการส่งเข้า Mango ERP (ระบบบัญชี/ERP ภายนอก) ซึ่งไม่ใช่ action ที่เปลี่ยนสถานะ แต่ถูกบันทึกเป็น entry เพื่อบอกว่าเคยส่งไปแล้ว

### 2.2 แถวทะเบียนเอกสาร — `DocRow`

```ts
interface DocRow {
  num: number      // ลำดับที่แสดงในตาราง (คำนวณใหม่ทุกครั้งที่ flatten/sort)
  date: string     // "dd/MM/yyyy"
  code: string     // "02A" | "08" | "" (ยังไม่จัดหมวด)
  subject: string  // หัวเรื่อง
  desc: string     // สรุปย่อ (อาจว่าง)
  url: string      // ลิงก์ Drive หรือ ""
  id: string       // docKey: url หรือ "project|subject|date"
  ref: string      // คอลัมน์ Remarks — เลขที่อ้างอิงอัตโนมัติหรือโน้ต
  status: Status
}
```

`DocumentsByProject = Record<string, DocRow[]>` คือทะเบียนทั้งหมด **จัดกลุ่มตามรหัสโครงการ** (เช่น `BT1`, `VK2`, `CVE` ฯลฯ) — นี่คือรูปร่างที่ `getDocuments(authToken)` คืนกลับมา

### 2.3 ข้อมูลประกอบการออกหนังสือ

- **`LetterheadMeta`**: `{ projects: string[]; defaults: Record<string,string> }` — รายชื่อโครงการที่มีเทมเพลตหัวจดหมาย และค่า "เรียน" เริ่มต้นต่อโครงการ
- **`Department`**: `{ key, label }` — รายการหน่วยงานสำหรับใช้ในช่อง CC
- **`ReviewerRole`**: `{ signedIn, email, manager }` — บทบาทของผู้ใช้ที่ล็อกอินอยู่
- **`ClaimAuthResult`**: `{ token?, email? }` — ผลของการ claim OAuth token (ว่างเปล่าเมื่อยัง pending/หมดอายุ)

### 2.4 กระทู้สนทนาและผลการตรวจ

- **`ReviewEntry`**: หนึ่งรายการในกระทู้สนทนาของเอกสาร — `{ time, email, action, text }`
  - `text` มีรูปแบบพิเศษ 3 แบบที่ถูก "แพ็ก" (pack) เป็นสตริงเดียว:
    - ข้อความล้วน
    - `"INK:<dataURL>\n<note>"` — ลายเซ็น/รอยขีดจากลายมือ (canvas) ตามด้วยข้อความโน้ต
    - ต่อท้ายด้วย `␟CC␟<รายชื่อผู้รับสำเนา>` เมื่อมีการ CC — ตัวคั่น `␟CC␟` เป็นอักขระควบคุมพิเศษที่ไม่ปรากฏในข้อความทั่วไป
- **`ReviewResult`**: `{ ok, status, locked, entries, combinedHtml, error? }` — ผลลัพธ์ของ `getReview()` และทุกการ mutation (comment/decision) `locked` เป็น `true` เมื่อสถานะเป็น `approved` หรือ `rejected` แล้ว (ห้ามแก้ไขต่อ)

### 2.5 อาร์กิวเมนต์การ mutate

- **`ReviewMutationArgs`**: `{ authToken, docId, project, text, ink, ccDepts, ccEmails }` — พารามิเตอร์ร่วมของ comment/reopen
- **`DecisionArgs extends ReviewMutationArgs`**: เพิ่ม `decision: 'approve' | 'reject'`
- **`MangoArgs` / `MangoResult`**: ส่งเอกสารเข้า Mango ERP
- **`DeleteDocArgs` / `SimpleOk`**: ลบเอกสาร

### 2.6 การออกหนังสือ (letterhead)

- **`PreviewLetterArgs`**: `{ project, code, subject, to, cc, typist, body, docDate }` — ใช้พรีวิวจดหมายก่อนส่งจริง
- **`PreviewLetterResult`**: `{ ok, ref?, html?, error? }`
- **`SubmitDocumentArgs`**: อาร์กิวเมนต์เต็มของการส่งเอกสาร รวมไฟล์แนบ (`filename`, `fileBase64`, `mimeType`)
- **`SubmitDocumentResult`**: `{ success, fileUrl?, placed?, generated?, ref?, attachUrl?, editUrl?, letterHtml?, pending?, token?, error? }` — `pending`/`token` ใช้เมื่อการสร้าง Doc/PDF จริงถูกเลื่อนไปทำภายหลัง (deferred) ผ่าน `finalizeLetter`
- **`FinalizeLetterArgs` / `FinalizeLetterResult`**: ขั้นตอนสร้างเอกสารจริง (PDF/Doc) แบบ deferred หลัง submit

### 2.7 ไฟล์แนบ (stub ในพอร์ตนี้)

- **`StreamFileResult`**, **`DocAttachment`**, **`DocAttachmentsResult`** — โครงสร้างสำหรับสตรีมไฟล์แนบจาก Drive/Gmail (ในพอร์ตนี้ endpoint เหล่านี้คืนค่า "ไม่มีข้อมูลจริง" เสมอ ดูหัวข้อ 4.7)

### 2.8 การควบคุมสิทธิ์เข้าถึง

- **`AccessRule`**: `{ conf: boolean; allow: string[] }` — `conf` = เอกสารประเภท/โครงการนี้เป็นความลับหรือไม่, `allow` = รายชื่ออีเมลที่เข้าถึงได้เพิ่มจากเจ้าของ
- **`AccessRules`**: `{ codes: Record<string, AccessRule>; projects: Record<string, AccessRule> }` — กำหนดได้ทั้งระดับ "รหัสเอกสาร" และ "โครงการ"
- **`AccessConfigResult`**: ผลของ `getAccessConfig()` — มี `isAdmin`, `rules`, `codeLabels`, `projectKeys` (รายชื่อโครงการที่มีเอกสารอย่างน้อย 1 รายการ), `defaultPublicPrefixes`
- **`SetAccessConfigResult`**: ผลของการบันทึกกฎใหม่

### 2.9 สัญญา API เต็มรูปแบบ — `Api` interface

`types.ts` ปิดท้ายด้วย interface `Api` ที่รวมทุกเมธอดที่ UI พึ่งพา (`getDocuments`, `getReview`, `submitDocument`, `getAccessConfig` ฯลฯ) — นี่คือ "สัญญา" กลางที่ `mock.ts` implement อยู่ในปัจจุบัน และเป็นจุดที่ backend จริง (เช่น proxy ไปยัง `google.script.run`) จะต้อง implement ให้ตรงกันในอนาคตโดยไม่ต้องแก้ UI เลย

---

## 3. รายการฟังก์ชันทั้งหมด และ Logic การทำงานโดยละเอียด

### 3.1 การแสดงทะเบียนเอกสาร / ตัวกรอง / การเรียงลำดับ (`src/App.tsx`)

**ทำอะไรได้:** แสดงเอกสารทั้งหมดจากทุกโครงการในตารางเดียว พร้อมค้นหา กรองตามประเภท/สถานะ/โครงการ/ช่วงวันที่ และเรียงคอลัมน์

**Logic การทำงาน:**

1. เมื่อ mount แอปเรียก `reload()` → `api.getDocuments(auth?.token ?? '')` แล้วเก็บผลลัพธ์ดิบ (`DocumentsByProject`) ไว้ใน state `raw`
2. **การ flatten + จัดเรียงเริ่มต้น** (`allRows`, useMemo): แปลง `raw` (grouped by project) เป็น array เดียว โดยแต่ละแถวเพิ่มฟิลด์ `proj` (รหัสโครงการ), `iso` (วันที่แบบ ISO ที่ parse จาก `dd/MM/yyyy`), `ts` (timestamp) ผ่าน `parseRow()` จากนั้นจัดเรียงด้วยกฎ: **แถวที่มีสถานะ `commented` ลอยขึ้นบนสุดก่อนเสมอ (`rk(r) = 0` ถ้า commented, `1` ถ้าไม่ใช่) แล้วค่อยเรียงตามวันที่ใหม่สุดก่อน (`b.ts - a.ts`)** — นี่คือลำดับ default เมื่อยังไม่มีการคลิกหัวคอลัมน์ใด
3. **การเรียงคอลัมน์** (`sortedRows`, `onSort`): คลิกหัวคอลัมน์ (`num`/`iso`/`proj`/`code`/`subject`) ครั้งแรก = ascending, คลิกซ้ำที่คอลัมน์เดิม = descending, คลิกครั้งที่ 3 = **กลับสู่ default order (sortCol = -1)** ไม่ใช่ toggle ไปมาไม่รู้จบ — คอลัมน์ `code` ใช้ `fmtCode()` แปลงก่อนเทียบ (เติมเลข 0 นำหน้าเลขหลักเดียว เช่น `8` → `08`) เพื่อให้เรียงถูกต้องแบบ string
4. **ตัวกรอง** (`visible`, useMemo): กรองซ้อนกัน 6 เงื่อนไข — โครงการ (`af`), ประเภทเอกสาร/รหัส (`dtf`), สถานะ (`stf`), คำค้นหาจากช่อง search (จับคู่กับ code, subject, desc, ชื่อโครงการ — ไม่สนตัวพิมพ์เล็กใหญ่), วันที่เริ่ม (`d1`) และวันที่สิ้นสุด (`d2`) เทียบกับ `iso`
5. **ตัวกรองวันที่แบบด่วน** (`setQuick`): ปุ่ม "7 วันล่าสุด" / "30 วันล่าสุด" / "เดือนที่แล้ว" ตั้งค่า `d1`/`d2` อัตโนมัติจากวันที่ปัจจุบัน
6. **ตัวเลือกโครงการ** (`pfms`): เป็น custom popover ไม่ใช่ `<select>` มาตรฐาน เพราะต้องการโชว์ badge สีของแต่ละโครงการข้างชื่อ ปิดเองเมื่อคลิกนอกกรอบ (ผ่าน `document.addEventListener('click', ...)` บน ref)
7. **ปุ่มล้างตัวกรองทั้งหมด** (`clearFilters`): รีเซ็ต search, dtf, stf, af, dates, sortCol/sortDir กลับเป็นค่าเริ่มต้นทั้งหมดในจุดเดียว
8. หัวตารางแสดง **จำนวนเอกสารทั้งหมดและจำนวนที่มีลิงก์ Drive** (`{allRows.length} documents · {linked} linked`) และแถบสถานะด้านล่างแสดง "Showing {n} of {m} documents"
9. คลิกปุ่ม "Open" ที่แถวใด ๆ จะเปิด `ReviewModal` สำหรับเอกสารนั้น (`setReviewDoc(r)`)
10. ปุ่ม "+ Add Document" (มุมขวาบนและ floating action button มุมล่างขวา) เปิด `AddPanel`
11. Header (แบรนด์ "VCB Group") เป็นลิงก์กลับไปพอร์ทัลหลัก โดยแนบ query string `?theme=` และ `?lang=` ปัจจุบันไปด้วย เพื่อไม่ให้พอร์ทัลรีเซ็ตธีม/ภาษาเมื่อกลับไป (ดู PORT_NOTES.md หัวข้อ "The brand went nowhere")

### 3.2 การสร้าง/ออกเอกสารใหม่ (`src/components/AddPanel.tsx`)

**ทำอะไรได้:** ผู้ใช้กรอกแบบฟอร์มเพื่อ (ก) บันทึกเอกสารเข้าเทียบทะเบียนพร้อมไฟล์แนบ หรือ (ข) ให้ระบบสร้างหนังสือ (letterhead memo) แบบ A4 ให้อัตโนมัติจากเนื้อความที่พิมพ์

**Logic การทำงาน:**

1. เปิดแผงทุกครั้ง (`useEffect` เมื่อ `open` เป็น true) จะตั้งวันที่เอกสารเป็น **วันนี้** โดยอัตโนมัติ (`openPanel()` เดิมใน GAS)
2. โหลด `LetterheadMeta` (`api.getLetterheadMeta()`) เพื่อรู้ว่าโครงการใดมีเทมเพลตหัวจดหมาย (`meta.projects`) และค่า "เรียน" เริ่มต้นต่อโครงการ (`meta.defaults`)
3. `isLetterhead = meta.projects.includes(project)` — **ตัวแปรนี้ตัดสินใจว่าฟอร์มจะแสดงส่วน "หนังสือราชการ" (เรียน/สำเนาเรียน/เนื้อความ/ผู้พิมพ์) หรือไม่** ถ้าโครงการที่เลือกไม่มีเทมเพลต จะแสดงข้อความเตือนว่า "No letterhead template for {project} yet — please attach a file for this project." แทน
4. **ค่า "เรียน" อัตโนมัติ**: เมื่อเลือกรหัสเอกสาร (`code`) ระบบเติมค่า "เรียน" จาก `TO_BY_CODE[code]` (ตารางใน `i18n.ts`) ก่อน ถ้าไม่มีจึงใช้ `meta.defaults[project]` (`updateTemplateUI` เดิม)
5. **ผู้พิมพ์อัตโนมัติ**: ถ้าเป็นหนังสือราชการและยังไม่กรอกผู้พิมพ์ ระบบเติมอีเมลผู้ใช้ที่ login อยู่ให้อัตโนมัติ
6. **เลขที่อ้างอิงถัดไป (running number)** — คำนวณฝั่ง client ล่วงหน้าเพื่อแสดงตัวอย่างให้ผู้ใช้ (`nextRunning()` ใน `AddPanel.tsx`): ใช้ regex สแกนข้อความ `subject` + `ref` ของทุกแถวในโครงการเดียวกันเพื่อหาตัวเลขวิ่ง (running number) ที่ตรงกับรหัสเอกสาร แล้วบวก 1 — ตรรกะนี้ **จำลอง `updateRunningNo()` ของฝั่งเซิร์ฟเวอร์ทุกประการ** (regex เดียวกันซ้ำอยู่ใน `mock.ts` ที่ฟังก์ชัน `nextRunning()`/`makeRef()` ด้วย เพื่อให้เลขที่ preview ตรงกับเลขที่จริงที่เซิร์ฟเวอร์จะออกให้)
7. **การตรวจสอบก่อนส่ง (`submit`)**:
   - ต้อง login แล้ว (ไม่งั้นเด้ง "Sign in with Google")
   - ต้องกรอก Project, Code, Subject
   - ถ้าเป็นหนังสือราชการ (`isLetterhead`) ต้องกรอกเนื้อความ (`body`) ด้วย
   - เรียก `api.submitDocument(...)` — ถ้า error เป็น `'Session expired'` จะขึ้นข้อความให้ signInใหม่โดยเฉพาะ
8. **การสร้างเอกสารแบบ deferred**: ถ้าผลลัพธ์จาก `submitDocument` มี `pending: true` และ `token` (หมายความว่าเป็นหนังสือราชการที่ยังไม่ได้สร้าง Doc/PDF จริง) แอปจะเรียกต่อ `api.finalizeLetter(...)` ทันทีเพื่อ "จบงานที่ค้าง" — จำลองพฤติกรรมเดิมที่การสร้าง Google Doc/PDF ใช้เวลานานจึงถูกแยกเป็นขั้นตอนหลัง submit
9. เมื่อสำเร็จ แสดงข้อความ "✓ Document submitted — ref {ref}. It now appears at the top as 'Pending'." เรียก `onSubmitted()` (สั่ง reload ทะเบียนที่หน้า App) รีเซ็ตฟอร์ม และปิดแผงอัตโนมัติหลัง 1.5 วินาที
10. **พรีวิวจดหมาย (`openPreview`)**: ปุ่ม "👁 Preview" (แสดงเฉพาะเมื่อ `isLetterhead`) เรียก `api.previewLetter(...)` แล้วเปิด iframe แสดง HTML จดหมาย A4 ที่ประกอบเสร็จแล้ว (ไม่บันทึกจริง)
11. **โหมด "เขียนบน A4 โดยตรง" (`editorOpen`)**: เปิด overlay จำลองหน้ากระดาษ A4 พร้อม textarea ทับอยู่ ให้ผู้ใช้พิมพ์เนื้อความในบริบทภาพหน้าจดหมายจริง กด "Apply & close" เพื่อคัดลอกข้อความกลับเข้าช่อง `body` เดิม (เป็นเวอร์ชันย่อของ editor เดิม — ดูข้อจำกัดหัวข้อ 5)
12. **ไฟล์แนบ**: จำกัดขนาดไม่เกิน 7 MB ฝั่ง client (ถ้าเกิน แสดง error "File too large — max 7 MB." และล้างค่าไฟล์ทิ้ง) — ไฟล์ที่แนบเป็นเพียง **ไฟล์เสริม** ไม่ใช่ตัวแทนของหนังสือหลัก (ระบบระบุไว้ในคำอธิบายฟอร์มว่า "ไม่ได้แทนที่จดหมาย")

### 3.3 กระบวนการอนุมัติ (Approval Workflow) — `src/components/ReviewModal.tsx`

**ทำอะไรได้:** ดูรายละเอียดเอกสารแบบจำลองหน้าหนังสือจริง ดูกระทู้ความเห็นทั้งหมด และดำเนินการ comment / approve / reject / reopen / ลบ / ส่งเข้า Mango ERP ตามสิทธิ์ของผู้ใช้

**State Machine ของสถานะเอกสาร** (คำนวณจาก `statusFromEntries()` ใน `mock.ts` — อ่านลำดับ entries ทั้งหมดของเอกสารแล้วไล่ทีละรายการ):

| Action ที่เกิดขึ้น | ผลต่อ Status |
|---|---|
| `comment` (ขณะสถานะเป็น `pending`) | เปลี่ยนเป็น `commented` |
| `comment` (ขณะสถานะเป็นอื่น) | ไม่เปลี่ยนสถานะ |
| `approve` | เปลี่ยนเป็น `approved` (ล็อกเอกสาร) |
| `reject` | เปลี่ยนเป็น `rejected` (ล็อกเอกสาร) |
| `reopen` | เปลี่ยนกลับเป็น `commented` (ไม่ใช่ `pending`) — เอกสารที่ reopen จะ "ลอยขึ้นบนสุด" ของตารางเหมือนเพิ่งมีความเห็นใหม่ และแสดง badge เดียวกับที่มีความเห็นใหม่ ("needs another look") |
| `delete` | ไม่ถูกนับใน status เลย (ถูกกรองออกจาก entries ก่อนคำนวณสถานะ) |

หมายเหตุ: state ไม่ใช่ finite-state-machine ที่เข้มงวด แต่เป็น **การไล่ประมวลผลลำดับเหตุการณ์ทั้งหมดใหม่ทุกครั้ง** (fold ทับค่าล่าสุดชนะ) เพราะเซิร์ฟเวอร์จริง (`readDiscussions_` ใน Code.js) ก็ทำงานแบบนี้ ผลคือสถานะปัจจุบันของเอกสารมาจากการอ่าน "เหตุการณ์ล่าสุดที่มีนัยยะเปลี่ยนสถานะ" ในกระทู้ ไม่ใช่ฟิลด์ status ที่ถูกเขียนทับตรง ๆ

**Logic การทำงานในหน้า Modal:**

1. เมื่อเปิด modal ด้วยเอกสารใด โหลด `api.getReview(doc.id)` (กระทู้ + สถานะ) และ `api.getDepartments()` (สำหรับตัวเลือก CC) พร้อมกัน
2. **`locked = review.locked`** (true เมื่อ approved/rejected) — ควบคุมว่าจะแสดงปุ่ม action ชุดใด:
   - ยังไม่ล็อก: แสดง "💬 Comment" เสมอ (ทุกคนที่ login), และถ้าเป็น manager (`isMgr`) แสดงเพิ่ม "✓ Approve" / "✕ Reject"
   - ล็อกแล้ว **และเป็น manager**: แสดงปุ่ม "↺ Reopen / Request revision" แทน (เพื่อเปิดเอกสารกลับมาพิจารณาใหม่)
   - ล็อกแล้ว **และไม่ใช่ manager**: ไม่มีปุ่ม action ใด ๆ ทั้งสิ้น แสดงข้อความ "This document is {status} — locked."
   - ถ้าเป็น manager และสถานะ = `approved`: แสดงปุ่มเพิ่มเติม "↗ Send to Mango ERP" (เปลี่ยนเป็น "✓ In Mango ERP" สีเขียวเมื่อเคยส่งไปแล้ว — เช็คจาก entries ที่มี `action === 'mango'`)
3. **การกดปุ่ม action** (`arm(kind)`) ไม่ใช่การส่งทันที แค่ "เลือกโหมด" (`pending` state) แล้วเปิดขั้นตอนที่ 2 (`rvStep2`) ให้กรอกโน้ต/ลายเซ็นก่อน มีข้อความกำกับ "Nothing is sent until you confirm." เสมอ
4. **โหมดพิมพ์/วาด (Type/Draw)**: ผู้ใช้เลือกพิมพ์ข้อความในกล่องข้อความ หรือวาดลายเซ็น/รอยขีดด้วยเมาส์/ปากกา (Apple Pencil) บน `<canvas>` — วาดผ่าน pointer events (`pointerdown/pointermove/pointerup`) แล้วแปลงเป็น PNG dataURL ตอน submit (`canvasRef.current.toDataURL('image/png')`)
5. **เงื่อนไขกดยืนยันได้ (`canConfirm`)**: approve/reject/reopen กดยืนยันได้ทันที (ไม่บังคับกรอกโน้ต) ส่วน comment ต้องมีข้อความหรือมีรอยวาดอย่างน้อยหนึ่งอย่าง
6. **การ CC เมื่อ submit**: เลือกหน่วยงานจาก chip ที่โหลดจาก `getDepartments()` และ/หรือพิมพ์อีเมลอิสระในช่องข้อความ — ทั้งสองรวมกันเป็น `ccDepts`/`ccEmails` แล้วถูก "แพ็ก" เข้าไปในสตริง `text` ด้วย `packText()` (มี `␟CC␟` คั่น) ฝั่งแสดงผล (`renderEntry`) จะ **แกะ** สตริงนี้กลับออกมาเป็นข้อความ + ป้าย "🔔 CC: ..." แยกกัน
7. **`submit()`**: เรียก endpoint ตาม `pending`:
   - `comment` → `api.addReviewComment(...)`
   - `reopen` → `api.reopenDocument(...)`
   - `approve`/`reject` → `api.submitDecision({ ...decision })`
   - เมื่อสำเร็จ อัปเดต `review` state ทันที (ไม่ reload หน้าทั้งหมด) และเรียก `onChanged()` (สั่งให้ App.tsx reload ทะเบียนหลัก เพื่อให้สถานะ/การเรียงลำดับที่หน้าตารางอัปเดตตาม)
8. **การลบ entry ล่าสุดของตัวเอง** (`deleteOwnLastEntry`): ปุ่ม "× Delete" จะปรากฏเฉพาะที่ entry **ตัวสุดท้ายของกระทู้เท่านั้น** และต้องเป็น entry ของตัวเอง (`en.email === myEmail`) ที่มี action เป็น `comment` (ลบ approve/reject ไม่ได้) และเอกสารต้องไม่ถูกล็อก
9. **การลบเอกสารทั้งรายการ** (`del`): ปุ่ม "🗑 Delete" ที่หัว modal เฉพาะ manager เท่านั้น เรียก dialog ยืนยันแบบ custom ก่อน (ผ่าน `useConfirm()`) แล้วเรียก `api.deleteDocument(...)`
10. เอกสารที่ยังไม่ login: แสดงเฉพาะปุ่ม "🔐 Sign in with Google to comment / decide" แทนแผง action ทั้งหมด

### 3.4 การควบคุมสิทธิ์การเข้าถึง (`src/components/AccessControl.tsx`)

**ทำอะไรได้:** ให้ผู้ดูแล (admin/manager) กำหนดว่าเอกสารประเภทใด (ตามรหัส) หรือโครงการใดเป็น "ความลับ" (Confidential) และถ้าเป็นความลับ ใครมีสิทธิ์เห็นได้บ้างนอกเหนือจากเจ้าของ

**Logic การทำงาน — ใครเห็น/แก้ไขอะไรได้:**

1. **ประตูสิทธิ์แรก**: component นี้ถูก render จาก `SettingsModal.tsx` **เฉพาะเมื่อ `auth?.manager === true`** (`{isManager && <AccessControl />}`) — ผู้ใช้ staff ทั่วไปจะไม่เห็นส่วนนี้ในหน้าตั้งค่าเลย
2. **ประตูสิทธิ์ที่สอง (ฝั่งข้อมูล)**: แม้ manager จะเห็น section นี้ แต่การโหลดข้อมูลจริงต้องผ่าน `api.getAccessConfig(auth.token)` ซึ่งฝั่ง mock ตรวจซ้ำว่า `MANAGERS.has(email)` — ถ้าไม่ผ่านจะได้ `{ ok: false, isAdmin: false, error: '...' }` และ UI แสดงข้อความ "Sign in as an admin to manage access." แทนฟอร์มทั้งหมด — **นี่คือ gate เดียวกับที่ควบคุม approve/reject/delete/mango ทุกอย่าง (isManager_ ใน Code.js ตัวเดียวถูกใช้ซ้ำทุกจุด) ไม่ได้แยก concept "admin" ออกจาก "manager" เป็นคนละสิทธิ์** ดังนั้นใครก็ตามที่ถูกเพิ่มเข้า `MANAGERS` จะได้สิทธิ์ทั้ง approve เอกสารและแก้ Access Control โดยอัตโนมัติ
3. เมื่อเป็น admin จริง จะเห็นฟอร์ม 2 กลุ่ม:
   - **BY DOCUMENT CODE**: รายการรหัสเอกสารทั้งหมด (`cfg.codeLabels`) แต่ละรายการมี checkbox "Confidential" (`conf`) และช่องพิมพ์อีเมลที่อนุญาต (`allow`, คั่นด้วย comma/space) — ช่องอีเมลจะถูก disable จนกว่าจะติ๊ก conf ก่อน
   - **BY PROJECT**: เช่นเดียวกันแต่ระดับโครงการ (`cfg.projectKeys` — เฉพาะโครงการที่มีเอกสารอย่างน้อย 1 รายการ)
4. การแก้ไขทุกช่องแก้ที่ state ท้องถิ่น (`rules`) ก่อนเท่านั้น (`setConf`, `setAllow` ใช้ `structuredClone` เพื่อไม่แก้ object เดิมตรง ๆ) — ต้องกดปุ่ม **"บันทึก · Save access"** เพื่อเรียก `api.setAccessConfig(token, JSON.stringify(rules))` จริง
5. ปุ่ม "↻ Reload" โหลดค่าปัจจุบันจากเซิร์ฟเวอร์ทับ state ท้องถิ่นทั้งหมด (ละทิ้งการแก้ไขที่ยังไม่บันทึก)
6. **ข้อควรทราบ**: การตรวจว่าเอกสารที่เป็นความลับจะถูก "ซ่อน" จากผู้ใช้ที่ไม่มีสิทธิ์จริงหรือไม่นั้น **ไม่มี logic ฝั่ง client ที่กรองทะเบียนตาม `AccessRules` เลยในโค้ดที่อ่านมา** — `App.tsx` ที่ดึง `getDocuments()` ไม่ได้อ้างอิง `AccessRules` แต่อย่างใด บ่งชี้ว่าการบังคับใช้กฎ (enforcement) ต้องเกิดที่ฝั่งเซิร์ฟเวอร์จริง (Code.js กรองก่อนส่งข้อมูลออกมา) ซึ่งพอร์ต mock นี้ยังไม่ได้จำลองพฤติกรรมการกรองนั้น (`getDocuments()` ใน `mock.ts` คืนทุกแถวเสมอโดยไม่อ้างอิง `ACCESS_RULES` เลย) — เป็นช่องว่างของพอร์ตที่ควรทราบเมื่อทดสอบ

### 3.5 การตั้งค่า (`src/components/SettingsModal.tsx`)

**ทำอะไรได้:** ศูนย์รวมการตั้งค่าที่ผู้ใช้ปรับได้เอง และจุดเข้าสู่ Access Control (สำหรับ manager)

**Logic การทำงาน:**

1. **SIGNED IN AS**: แสดงอีเมลและบทบาท (`manager`/`staff`) ของผู้ login อยู่ ถ้ายังไม่ login แสดงปุ่ม 2 แบบ: "🔐 Sign in (owner)" กับ "Sign in as staff" (เพราะเป็น mock auth — ดูหัวข้อ 4.1)
2. **DISPLAY**: ปรับ 3 อย่างอิสระจากกัน
   - **โหมดสี (Theme)**: Light/Dark — เขียนค่าไปที่ `localStorage['vcb_theme']` เฉพาะตอนที่ผู้ใช้เลือกเองในนี้เท่านั้น (ไม่เขียนตอน mount) เพื่อไม่ทับค่า `auto` ที่มาจากพอร์ทัลกลาง (ดู PORT_NOTES.md)
   - **ภาษา (Language)**: ไทย/EN — เขียนไปที่ `localStorage['vcb_lang']`
   - **รูปแบบวันที่ (Date format)**: พ.ศ. (Buddhist Era) หรือ ค.ศ. (Christian Era) — เขียนไปที่ `localStorage['vcb-era']` (คีย์นี้เป็นคีย์เฉพาะของโมดูลนี้ ไม่ใช่คีย์ร่วมกับพอร์ทัล)
3. **AccessControl** ถูกฝังไว้ท้าย section นี้ เฉพาะเมื่อ `auth?.manager === true` (ดูหัวข้อ 3.4)
4. **Sign out**: ล้าง `auth` state และตั้ง flag `localStorage['vcbSignedOut'] = '1'`

### 3.6 State/Store กลาง (`src/store.tsx`)

- **Mock Sign-in** (`signIn(email?)`): เรียก `mockSignIn()` จาก `api/index.ts` ซึ่ง **ไม่ใช่ OAuth popup จริง** — เพียงออก token ปลอมสำหรับอีเมลที่ระบุ (ค่าเริ่มต้นคือ `PREVIEW_OWNER` = `c.chavananand@vcb-con.com`) แล้วตรวจว่าอีเมลนั้นอยู่ใน `MANAGERS` set หรือไม่เพื่อกำหนด `manager: boolean`
- Auth state (`Auth = { token, email, manager }`) อยู่ใน React state เท่านั้น **ไม่ persist ข้าม reload หน้า** (ต่างจาก theme/lang/era ที่ persist ผ่าน localStorage)
- ธีม/ภาษา/ยุควันที่อ่านค่าเริ่มต้นจาก localStorage คีย์ที่ **ใช้ร่วมกับพอร์ทัลกลาง**: `vcb_theme` (`light`/`dark`/`auto` — auto ตาม `prefers-color-scheme`), `vcb_lang` (`th`/`en`) — ยกเว้น `vcb-era` ที่เป็นคีย์เฉพาะโมดูลนี้
- **`useStore()`**: ฮุกทางเดียวที่ใช้เข้าถึง store — อ่าน context ที่ `StoreProvider` วางไว้ และ **โยน error ทันทีถ้าถูกเรียกจากนอก provider** (`'useStore must be used within StoreProvider'`) แทนการคืน `undefined` เงียบ ๆ ทำให้ความผิดพลาดของลำดับ provider ปรากฏเป็นข้อความชัดเจนตอน render ครั้งแรก ไม่ใช่กลายเป็น `TypeError` ปลายทางที่ไล่ต้นเหตุยาก และเป็นสิ่งที่ทำให้ TypeScript รู้ว่าค่าที่ได้ไม่มีทางเป็น `null`

### 3.7 ข้อความหลายภาษาและตารางช่วย (`src/i18n.ts`)

- เก็บ string คู่ TH/EN ทั้งหมดของ UI (`I18N`), ชื่อเต็มของแต่ละโครงการ (`PROJ_NAMES`), ตาราง "เรียน" เริ่มต้นตามรหัสเอกสาร (`TO_BY_CODE`), ป้ายกำกับรหัสเอกสารในตัวกรอง (`CODE_LABEL`)
- **`fmtCode()`**: เติมเลข 0 นำหน้ารหัสตัวเลขหลักเดียว (`8` → `08`) เพื่อให้การเรียง/แสดงผลสม่ำเสมอ
- **`formatDateByEra()`**: แปลง `dd/MM/yyyy` ให้แสดงปี พ.ศ. หรือ ค.ศ. ตามตัวเลือกผู้ใช้
- **`projBadgeClass()`**: กำหนด CSS class ของ badge สีต่อโครงการ — จัดการกรณีพิเศษ `V&K` ให้ได้ token เฉพาะ (`VnK`) แยกจาก `VK` (ตัวย่อของ VK2) ไม่ให้สี badge ชนกัน
- **`makeT(lang)`**: โรงงานสร้างฟังก์ชันแปล — คืนฟังก์ชัน `t(key)` ที่ผูกกับภาษาที่ระบุไว้แล้ว ทุก component เรียกใช้ผ่านรูปแบบนี้แทนการอ่าน `I18N` ตรง ๆ จุดสำคัญคือ **ลำดับการถอยกลับ 3 ชั้น**: ค่าในภาษาปัจจุบัน → ค่าในภาษาอังกฤษ → ตัวคีย์เอง (`String(k)`) ผลคือคีย์ที่ยังแปลไทยไม่เสร็จจะแสดงข้อความอังกฤษให้อ่านรู้เรื่อง ไม่ใช่ช่องว่าง และ**ไม่มีทางที่คีย์ผิดจะทำให้หน้าจอพัง** อย่างแย่ที่สุดคือเห็นชื่อคีย์
- **`pad3(x)`**: เติมเลข 0 นำหน้าจนครบ 3 หลัก (`7` → `007`) ใช้กับเลขวิ่งของเลขที่อ้างอิงเอกสารโดยเฉพาะ แยกคนละหน้าที่กับ `fmtCode()` ซึ่งเติมให้ครบ 2 หลักและใช้กับ**รหัสประเภทเอกสาร**

---

## 4. Data Flow: ชั้น Mock (`src/api/mock.ts`, `src/api/index.ts`)

**สำคัญ: โมดูลนี้ในสถานะปัจจุบัน "ไม่ได้เชื่อมต่อกับ backend จริงใด ๆ ทั้งสิ้น"** ทุกข้อมูลอยู่ในหน่วยความจำ (in-memory) ของเบราว์เซอร์ระหว่างเปิดหน้าเว็บเท่านั้น รีเฟรชหน้าเว็บแล้วข้อมูลที่เพิ่ม/แก้ไขทั้งหมดจะหายและกลับไปเป็นชุดข้อมูลตั้งต้น (seed data)

### 4.1 จุดสลับชั้นข้อมูล (`src/api/index.ts`)

```ts
export const api: Api = mockApi
```

คอมเมนต์ในไฟล์ระบุชัดเจนว่านี่คือ **"single swap point"** — เมื่อจะเชื่อมต่อ backend จริง ให้ทำ object ใหม่ที่ implement `Api` interface (เช่น bridge ไปยัง `google.script.run` หรือ REST proxy) แล้วเปลี่ยนบรรทัดนี้ให้ export object ใหม่แทน โดย **ไม่ต้องแก้โค้ด UI ใด ๆ เลย** เพราะทุก component เรียกผ่าน `api.xxx()` เท่านั้น

`mockSignIn()` ในไฟล์นี้จำลอง OAuth popup → claimAuth flow — ออก token ปลอมให้อีเมลที่ระบุทันที (ค่า default คือ owner) เพื่อให้ทดสอบทุก flow ที่ผูกกับสิทธิ์ (manager action, admin access) ได้โดยไม่ต้องมี OAuth จริง

ตัวที่ออก token ให้จริงคือ **`mockIssueToken(email)`** ใน `mock.ts` — สร้างสตริงสุ่มขึ้นต้นด้วย `mock-` แล้ว**จดคู่ token → อีเมลไว้ในตัวแปร `TOKENS` ระดับโมดูล** จากนั้นทุก endpoint ที่ต้องรู้ว่า "ใครเป็นคนเรียก" จะแปลง token กลับเป็นอีเมลผ่านตารางนี้ (ตัวช่วยภายใน `emailFor()`) แล้วจึงเทียบกับ `MANAGERS` ต่อ — นี่คือเหตุผลที่การตรวจสิทธิ์ในชั้น mock ทำงานได้ครบทุกเส้นทางทั้งที่ไม่มี OAuth จริง แต่ก็เป็นเหตุผลที่ token **หายทั้งหมดเมื่อรีเฟรชหน้า** เพราะ `TOKENS` อยู่ในหน่วยความจำเท่านั้น (ไม่มีลายเซ็น ไม่มีวันหมดอายุ ไม่มีการตรวจสอบใด ๆ — จะถูกแทนที่ทั้งหมดเมื่อสลับไปใช้ backend จริงตามหัวข้อ 4.1)

`mock.ts` ยัง re-export ค่า **`MOCK_OWNER`** และ **`MOCK_MANAGERS`** (คือ `OWNER` / `MANAGERS` ของ seed data) ออกไปให้ `api/index.ts` ใช้ตั้งค่าเริ่มต้นของ `mockSignIn()` และคำนวณ `manager: boolean` — เป็นการเปิดค่าคงที่ของข้อมูลตัวอย่างออกมาให้ชั้น bridge เห็น ไม่ใช่ส่วนหนึ่งของ `Api` interface

### 4.2 ข้อมูลตั้งต้น (seed data) ใน `mock.ts`

- **`RAW`**: ทะเบียนเอกสารตั้งต้น 9 โครงการ (`BT1`, `VK2`, `CVE`, `LPB`, `BV`, `PN4`, `EP`, `V&K`, `UNCLASSIFIED`) รวมกันประมาณ 20 รายการ ครอบคลุมทั้ง 4 สถานะ
- **`THREADS`**: กระทู้ความเห็นตั้งต้นสำหรับเอกสารบางรายการ (5 เอกสารมีกระทู้ตัวอย่าง ที่เหลือกระทู้ว่างเปล่า)
- **`OWNER`** = `'c.chavananand@vcb-con.com'`, **`MANAGERS`** = Set ของ `{ OWNER, 'p.somchai@vcb-con.com' }` — กำหนดว่าใครมีสิทธิ์ manager ในข้อมูลตัวอย่าง
- **`LH_PROJECTS`, `LH_DEFAULTS`, `LH_PREFIX`, `LH_COMPANY`, `DEPT_BY_CODE`**: ตารางค่าคงที่จำลองส่วนหนึ่งของ `LETTERHEAD`/`DEPT_BY_CODE` ในไฟล์ Code.js เดิม ใช้สร้างเลขที่อ้างอิงและหัวจดหมาย

### 4.3 พฤติกรรมของแต่ละ endpoint ใน `mockApi`

| Endpoint | พฤติกรรม mock |
|---|---|
| `getDocuments()` | หน่วงเวลา 450ms แล้วคืน `RAW` ทั้งหมด (เติมเลข `num` ใหม่ทุกครั้ง) **ไม่กรองตาม Access Control** |
| `getLetterheadMeta()` | คืน `LH_PROJECTS`/`LH_DEFAULTS` (หน่วง 120ms) |
| `getDepartments()` | คืนรายการหน่วยงานคงที่ 6 รายการ (หน่วง 120ms) |
| `getReviewerRole(token)` | คืนบทบาทจาก token ที่ผูกไว้ตอน sign-in (หน่วง 80ms) |
| `getOAuthUrl()` / `claimAuth()` | คืน URL/ผลลัพธ์ปลอม ไม่เชื่อมต่อ Google OAuth จริง |
| `getReview(docId)` | คำนวณสถานะจาก entries ที่ยังไม่ถูกลบ (กรอง `action !== 'delete'` ออกก่อน) |
| `addReviewComment` / `submitDecision` / `reopenDocument` | ตรวจสิทธิ์จาก token → email → เช็ค `MANAGERS` (เฉพาะ decision/reopen) → push entry ใหม่เข้า `THREADS` → คำนวณสถานะใหม่ → sync สถานะกลับเข้า `RAW` ผ่าน `applyStatusToRow()` |
| `deleteOwnLastEntry` | ลบ entry ตัวสุดท้ายของกระทู้ **เฉพาะเมื่อเป็นของอีเมลเดียวกันและเป็น action `comment`** |
| `sendToMangoERP()` | คืน `{ ok: true, demo: true, message: 'Mock: queued for Mango ERP (no endpoint configured).' }` เสมอ — **ไม่เชื่อมต่อ Mango ERP จริง** |
| `deleteDocument()` | ต้องเป็น manager — ลบแถวออกจาก `RAW` ทุกโครงการที่ตรง id แต่ **"เก็บกระทู้ไว้เป็น audit trail"** โดย push entry `action: 'delete'` เข้ากระทู้แทนการล้างทิ้ง (จำลอง `deleteDocument` ใน Code.js ที่ trash แถวทะเบียนแต่ไม่เคยล้าง Discussions) |
| `previewLetter()` | ตรวจว่าโครงการมีเทมเพลตและมีรหัสก่อน แล้วสร้างเลขอ้างอิงจริง + HTML จดหมายด้วย `buildLetterHtml()` |
| `submitDocument()` | ตรวจสิทธิ์และฟิลด์บังคับ แล้ว unshift แถวใหม่เข้า `RAW[project]` — ถ้าโครงการมีเทมเพลต (`generated: true`) จะคืน `pending: true` พร้อม token ปลอมเพื่อให้ UI เรียก `finalizeLetter` ต่อ |
| `finalizeLetter()` | คืนลิงก์ Drive/Doc **ปลอม** (`MOCK_PDF`, `MOCK_DOC`) เสมอ ไม่สร้างไฟล์จริง |
| `streamFileForViewer()` | คืน `{ ok: false, isNative: true, ... }` เสมอ — **ไม่มีไฟล์จริงให้สตรีม** |
| `streamGmailAttachment()` | คืน error "Mock: Gmail attachment streaming is not available in the preview." เสมอ |
| `getDocAttachments()` | คืน `{ ok: true, atts: [], threadId: '' }` เสมอ — รายการไฟล์แนบว่างเปล่าเสมอ |
| `getAccessConfig()` / `setAccessConfig()` | ตรวจสิทธิ์ manager แล้วอ่าน/เขียน `ACCESS_RULES` ตัวแปรในหน่วยความจำ (module-level variable) — **ไม่ persist ไปที่ไหน หายเมื่อ refresh หน้า** |

### 4.4 ตรรกะการคำนวณเลขที่อ้างอิง (running number)

ทั้ง `AddPanel.tsx` (เพื่อแสดง preview เลขถัดไปในฟอร์ม) และ `mock.ts` (เพื่อออกเลขจริงตอน submit) มีฟังก์ชัน `nextRunning()` เหมือนกันทุกประการ (regex เดียวกัน) — สแกนข้อความ `subject` + `ref` ของทุกเอกสารในโครงการเดียวกันเพื่อหาตัวเลขวิ่งสูงสุดที่ตรงกับรหัสเอกสารที่เลือก แล้วให้เลขถัดไปเป็น max+1 การที่ทั้งสองที่ต้องมี logic เดียวกันแยกกันคือความเสี่ยงที่หากแก้ไขจุดหนึ่งแล้วลืมอีกจุด เลข preview กับเลขจริงจะไม่ตรงกัน (เป็นข้อสังเกตของโครงสร้างโค้ด ไม่ใช่บั๊กที่ต้องแก้ในบริบทงานนี้)

### 4.5 ผลของการที่เป็น mock layer

- ไม่มีการเชื่อมต่อ Gmail/Drive/Sheets จริง — ทุกอย่างที่ควรเป็นไฟล์จริง (PDF, Doc, Drive link) เป็นค่าคงที่ปลอม (`MOCK...`)
- ไม่มีการเชื่อมต่อ Mango ERP จริง
- Sign-in ไม่ใช่ OAuth จริง เป็นการเลือกอีเมลจำลอง 2 แบบ (owner/manager หรือ staff) จากปุ่มในหน้า Settings
- ข้อมูลทั้งหมดอยู่ในหน่วยความจำของ tab เบราว์เซอร์ปัจจุบันเท่านั้น ไม่มี persistence ข้าม session/refresh (ยกเว้นค่าธีม/ภาษา/ยุควันที่ที่เก็บใน localStorage)
- โครงสร้างถูกออกแบบให้ **สลับไปใช้ backend จริงได้โดยแก้ไฟล์เดียว** (`src/api/index.ts`) ตราบใดที่ backend ใหม่ implement `Api` interface ครบทุกเมธอดตาม `src/api/types.ts`

---

## 5. ข้อจำกัดหรือสิ่งที่ยังไม่รองรับ (จาก `PORT_NOTES.md`)

เอกสาร `PORT_NOTES.md` ระบุว่าไฟล์นี้ "บันทึกเฉพาะจุดที่การพอร์ตแบบ 1:1 ทำไม่ได้ และทำอะไรแทน" ประเด็นสำคัญมีดังนี้:

1. **⚠️ Port นี้ตามหลังแอปจริง (live app) อยู่** — มีชุดการเปลี่ยนแปลงฝั่ง Apps Script ที่เกิดขึ้นหลังการซิงก์ครั้งล่าสุด ที่ไม่เคยถูกนำเข้ามาพอร์ตนี้ **ให้ถือว่าเวอร์ชัน Apps Script ถูกต้องกว่าเสมอเมื่อพบว่าสองฝั่งไม่ตรงกัน** และควรตรวจสอบให้แน่ใจก่อนสรุปว่าฟีเจอร์ใดหายไปจริง เพราะอาจเป็นแค่ "ยังไม่ถูกพอร์ตมา" ไม่ใช่ "ไม่มีอยู่จริง"

2. **Backend**: ไม่มีการเชื่อมต่อ Gmail, Drive หรือ Sheets จริง — `getDocuments`, `getReview`, การ submit และการตัดสินใจ (decision) ทั้งหมดรันในหน่วยความจำเท่านั้น เพราะฟังก์ชัน Apps Script จริงเข้าถึงได้เฉพาะผ่าน `google.script.run` ภายใน iframe ของ Google เท่านั้น (พอร์ตนี้รันนอก iframe นั้น)

3. **Sign-in เป็น mock**: `mockSignIn()` ออก token ปลอม (owner = manager/admin, `staff@vcb-con.com` = staff) แทนป๊อปอัป Google OAuth จริง เพื่อให้ทดสอบทุก flow ที่ผูกกับสิทธิ์ได้โดยไม่ต้องมี OAuth จริง

4. **การสตรีมไฟล์แนบเป็นเพียง stub**: ไม่มีไฟล์จริงให้สตรีม ดังนั้นหน้าต่างตรวจสอบ (review modal) จะแสดงเฉพาะมุมมองตัวจดหมาย (letter view) เท่านั้น ไม่แสดงไฟล์แนบจริง

5. **ช่องกรอกวันที่ใช้ native control บนทุกอุปกรณ์**: แอปจริง (live app) มีปฏิทินกำหนดเองเพื่อหลบปัญหาความเข้ากันได้ของ iOS รุ่นเก่า ส่วนพอร์ตนี้ใช้ native date picker ของเบราว์เซอร์แทน ซึ่งถือว่าทำงานเทียบเท่ากันในทางฟังก์ชัน

6. **ไม่สามารถ import `@vcb/shared` ได้** เพราะเป็นแอป TypeScript เดี่ยว จึงต้อง "จำลอง" ค่าตัวเลขของแถบ chrome ที่ใช้ร่วมกับโมดูลอื่น (เช่น ขนาด/ระยะของแถบด้านบน) ไว้ในโค้ดของโมดูลเอง — รายละเอียดตัวเลขเหล่านี้ดูที่ `docs/CHROME.md`

7. **ประเด็น theme/language ที่เพิ่งแก้ในพอร์ตนี้** (บันทึกไว้เป็นประวัติ ไม่ใช่ปัญหาที่ค้างอยู่แล้ว): เดิมโมดูลนี้ใช้ localStorage key ของตัวเอง (`vcb-dm`/`vcb-lang`) ที่ไม่มีใครอื่นเขียนถึง ทำให้การเปลี่ยนธีม/ภาษาที่พอร์ทัลกลางไม่ส่งผลมาที่นี่ และ effect ของธีมในโมดูลนี้เขียนทับ `vcb_theme` ทุกครั้งที่ mount จนทำให้ค่า `auto` ของพอร์ทัลกลายเป็น `light`/`dark` แบบตายตัวทันทีที่เปิดโมดูลนี้ ปัจจุบันแก้แล้วให้ใช้คีย์ร่วม (`vcb_theme`/`vcb_lang`) และเขียนคีย์เฉพาะเมื่อผู้ใช้เลือกเองในนี้เท่านั้น

8. **ลิงก์แบรนด์เดิมไปไหนไม่ได้**: เคยเป็น `href="#"` พร้อม `preventDefault()` ปัจจุบันแก้ให้พากลับพอร์ทัลพร้อมพารามิเตอร์ธีม/ภาษาแล้ว

9. **ฟอนต์ Sarabun ไม่เคยถูกโหลด**: ทำให้แบรนด์ render กว้างผิดขนาดเทียบกับโมดูลอื่น (แก้ไขแล้วในพอร์ตนี้)

10. **ป้าย "Date" ที่ช่องกรองวันที่ซ้ำซ้อนกับสิ่งที่ native input แสดงอยู่แล้ว** ปัจจุบันเปลี่ยนให้แสดงเฉพาะวันที่ที่เลือกไว้แทน

### ข้อสังเกตเพิ่มเติมที่พบระหว่างอ่านโค้ด (ไม่ได้อยู่ใน PORT_NOTES.md แต่ควรทราบ)

- **`AccessRules` ไม่ถูกใช้บังคับกรองข้อมูลจริงในชั้น mock** — `getDocuments()` คืนทุกแถวเสมอโดยไม่อ้างอิงกฎความลับที่ตั้งไว้ใน Access Control เลย การบังคับใช้กฎนี้ (ถ้ามี) ต้องอยู่ฝั่ง Apps Script จริงเท่านั้น
- **การตรวจขนาดไฟล์แนบ 7 MB ที่ฝั่ง client ถูกทำเครื่องหมายในโค้ดว่า "ported from the original's file-picker handler — dropped in the port"** หมายความว่าตรงนี้เป็นจุดที่นักพัฒนาที่พอร์ตโค้ดได้ใส่กลับเข้ามาเอง ไม่ได้มาจากพอร์ตอัตโนมัติ ควรระวังหากมีการเปลี่ยนพฤติกรรมนี้ในระบบจริงภายหลัง
- **`combinedHtml` ใน `ReviewResult` ถูกปล่อยเป็นสตริงว่างเสมอในชั้น mock** (คอมเมนต์ในไฟล์ types.ts ระบุว่า server จริงจะ render HTML จดหมาย+ความเห็นรวมกัน แต่ mock ไม่ทำ) — ฟิลด์นี้จึงไม่มีผลอะไรในพอร์ตปัจจุบัน

---

## 6. สรุปสิทธิ์ผู้ใช้ (Role Matrix)

| การกระทำ | ยังไม่ login | Staff (login แล้ว, ไม่ใช่ manager) | Manager |
|---|---|---|---|
| ดูทะเบียนเอกสาร / ใช้ตัวกรอง | ✅ | ✅ | ✅ |
| เปิดดูรายละเอียดเอกสาร (Review Modal) | ✅ (ดูอย่างเดียว) | ✅ | ✅ |
| แสดงความเห็น (Comment) บนเอกสารที่ยังไม่ล็อก | ❌ (ต้อง sign in ก่อน) | ✅ | ✅ |
| อนุมัติ / ไม่อนุมัติ (Approve/Reject) | ❌ | ❌ | ✅ |
| เปิดเอกสารกลับมาพิจารณาใหม่ (Reopen) เมื่อล็อกแล้ว | ❌ | ❌ | ✅ |
| ส่งเข้า Mango ERP (เฉพาะเอกสารที่ approved แล้ว) | ❌ | ❌ | ✅ |
| ลบความเห็นล่าสุดของตัวเอง (ถ้ายังไม่ล็อก) | ❌ | ✅ (เฉพาะของตัวเอง) | ✅ (เฉพาะของตัวเอง) |
| ลบเอกสารทั้งรายการ | ❌ | ❌ | ✅ |
| สร้าง/ส่งเอกสารใหม่ (Add Document) | ❌ (ต้อง sign in ก่อน) | ✅ | ✅ |
| เข้าถึง Access Control (ตั้งค่าความลับ) | ❌ | ❌ (ไม่เห็นเมนูเลย) | ✅ |

หมายเหตุ: ในข้อมูล mock ปัจจุบัน manager = สมาชิกใน `MANAGERS` set (`c.chavananand@vcb-con.com` และ `p.somchai@vcb-con.com`) ระบบไม่มี concept "admin" แยกจาก "manager" — สิทธิ์ทั้งสองมาจากการตรวจสอบเดียวกันเสมอ (`isManager_` ในฝั่งเซิร์ฟเวอร์จริง, `MANAGERS.has(email)` ในชั้น mock)
