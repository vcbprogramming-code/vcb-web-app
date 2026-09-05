# SOP — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> อ้างอิงจากซอร์สโค้ดจริงที่ `E:\WORK\08 CLAUDE CODE\VCB Connect\FOR DEPLOYMENT TEAM\sop\` (ฝั่ง React/Vite) และ
> `E:\WORK\08 CLAUDE CODE\VCB Connect\FOR DEPLOYMENT TEAM\api\src\routes\sop.js` (ฝั่ง Express API) ณ วันที่จัดทำเอกสาร
> ทุกพฤติกรรมที่อธิบายด้านล่างตรวจสอบได้จากไฟล์ที่อ้างถึงในแต่ละหัวข้อ

---

## 1. ภาพรวมของโมดูล

โมดูล **SOP** คือแอปพลิเคชันแสดง "ระเบียบปฏิบัติงาน" (Standard Operating Procedure) ของระบบ **VCB-MANGO ERP**
ซึ่งเป็นระบบ ERP ภายในของบริษัทก่อสร้าง เนื้อหาในโมดูลนี้ประกอบด้วย 3 ส่วนหลัก ตรงกับ 3 กิ่งของเมนูด้านซ้าย
(ดู `src/components/Sidebar.jsx`):

1. **Process Flows (ผังกระบวนการ)** — แผนภาพ swimlane 33 ผัง อธิบายขั้นตอนการทำงานของแต่ละโมดูลย่อยใน ERP
   (เช่น การเปิดโครงการใหม่, การอนุมัติงบประมาณ) ข้อมูลนี้ฝังมากับตัวแอป ไม่ได้ดึงจากฐานข้อมูล
2. **Case Studies (กรณีศึกษา/ปัญหา-วิธีแก้)** — รายการปัญหาที่พบบ่อยพร้อมขั้นตอนแก้ไข แยกตามโมดูล ERP
   (PO, IC, AP, FA, PM, OF, GL, AR, BD, FIN, SE) ข้อมูลนี้ดึงจากฐานข้อมูลจริงผ่าน API และแก้ไขได้โดยผู้มีสิทธิ์
3. **Reports (รายงาน)** — ตารางอ้างอิง "จะเรียกรายงานนี้ได้จากเมนูไหนใน ERP" (คอลัมน์: เลขที่กรณี, คำอธิบาย
   สถานการณ์, เมนูพาธ)

เอกสารทั้งหมด (`meta` + `scenarios` + `reports`) ถูกเก็บเป็น **เอกสาร JSON หนึ่งก้อนเดียว (single JSONB
document)** ในตาราง `sop.sop_document` แถวเดียว (`id = 1`) ไม่ได้ normalize แยกเป็นตาราง scenario/step ตามปกติ
— รายละเอียดสถาปัตยกรรมนี้อธิบายในหัวข้อ 4

โมดูลนี้มี **ระบบ Version History** (`/versions`) ให้ผู้แก้ไขย้อนดูและกู้คืนเอกสารเวอร์ชันก่อนหน้าได้ เพราะทุกครั้ง
ที่มีการบันทึกทับเอกสาร ฐานข้อมูลจะสร้าง snapshot อัตโนมัติผ่าน trigger (ดูหัวข้อ 3.5)

โมดูลนี้ **เปิดให้อ่านได้แบบไม่ต้องล็อกอิน (anonymous)** โดยตั้งใจ ส่วนการแก้ไขต้องมีสิทธิ์ `sop` editor
— รายละเอียดเต็มอยู่ในหัวข้อ 5

### โครงสร้างไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `src/App.jsx` | Routing หลักและโครงสามคอลัมน์ (sidebar / list / detail) |
| `src/store.jsx` | Context store: โหลดเอกสาร, สถานะ, mutation ทั้งหมด |
| `src/components/Sidebar.jsx` | เมนูซ้าย 3 กิ่ง: Process Flows / Case Studies / Reports |
| `src/components/CaseListPane.jsx` | รายการ case ตรงกลาง กรองตามโมดูล/คำค้นหา |
| `src/components/CaseDetail.jsx` | รายละเอียด case หนึ่งเรื่อง (ปัญหา, ขั้นตอน, หมายเหตุ, เอกสารแนบ) |
| `src/components/EditCaseModal.jsx` | ฟอร์มสร้าง/แก้ไข/สลับ/ลบ case |
| `src/components/AttachmentRows.jsx` | ตัวแก้ไขรายการไฟล์แนบใน modal |
| `src/lib/steps.js` | แปลงข้อความ textarea ⇄ รูปแบบจัดเก็บของ "ขั้นตอน" |
| `src/lib/sopApi.js` | ฟังก์ชันเรียก API ทั้งหมด + แปล error code |
| `src/components/FlowListPane.jsx`, `FlowDetail.jsx`, `FlowDiagram.jsx` | รายการและแผนภาพ Process Flows |
| `src/data/flows.js` | ข้อมูลผังกระบวนการ 33 ผัง (ฝังในแอป ไม่ผ่าน API) |
| `src/data/config.js` | รายชื่อโมดูล ERP, สี, ข้อความอธิบายแต่ละโมดูล, changelog |
| `src/components/ReportsView.jsx` | ตารางรายงาน + เพิ่ม/ลบแถว |
| `src/components/VersionsView.jsx` | หน้าประวัติเวอร์ชัน (editor เท่านั้น) |
| `src/components/SettingsModal.jsx` | ธีม, ภาษา, มุมมองเริ่มต้น, ลิงก์ไปหน้า Versions, sign-in/out |
| `api/src/routes/sop.js` | Express endpoints ทั้งหมดของโมดูลนี้ |
| `supabase/migrations/006_sop.sql` | Schema: `sop.sop_document`, `sop.sop_versions`, trigger snapshot |
| `seed/sop-document.json`, `seed/README.md` | ข้อมูลตั้งต้นสำหรับ seed เอกสาร (ไม่ใช่โค้ดแอป) |

---

## 2. รายการฟังก์ชันทั้งหมด

### 2.1 การเรียกดู SOP ตามแผนก/หมวดหมู่ (Sidebar navigation)

**ทำอะไรได้:** ผู้ใช้เห็นเมนูซ้าย 3 กิ่งเสมอ (`src/components/Sidebar.jsx`):

- **Process Flows** — กดแล้วขยายเป็นรายการโมดูล ERP ที่มีผังกระบวนการ เรียงตามลำดับคงที่
  `FLOW_MOD_ORDER = ['BD','PO','IC','OF','AP','AR','FA','GL']` แต่ละแถวแสดงจำนวนผังของโมดูลนั้น
- **Case Studies** — ขยายเป็นรายการโมดูล ERP ทั้งหมดตามลำดับ `MODULE_ORDER` (มาจาก key ของ `MODULES` ใน
  `src/data/config.js`: PO, IC, AP, FA, PM, OF, GL, AR, BD, FIN, SE) แต่ละแถวแสดงจุดสี (ตาม `moduleColor()`)
  ชื่อย่อ ชื่อเต็มตามภาษา และจำนวน case ที่อยู่ในโมดูลนั้น โมดูลที่ไม่มี case เลย (count === 0) จะแสดงจางลง
  (`dimmed`)
- **Reports** — กิ่งใบ (leaf) ไม่มีเมนูย่อย กดแล้วไปหน้าตาราง reports ตรงๆ

**Logic การทำงาน:**

- กิ่งไหน "เปิดอยู่" ตัดสินจาก URL ปัจจุบันโดยตรง (`pathname.startsWith('/flows')` /
  `pathname.startsWith('/cases')`) ไม่มี state แยกเก็บว่ากิ่งไหนเปิด/ปิดเหมือนเวอร์ชันเดิม (คอมเมนต์ในโค้ดระบุว่า
  เวอร์ชันเดิมเก็บ `navCollapsed` ไว้ใน store และ toggle class ด้วยมือ — เวอร์ชันนี้ให้ React Router's `NavLink`
  จัดการ active state แทน)
- **การนับจำนวน case ต่อโมดูล** (`scenarioCounts`, บรรทัด 89-96): case หนึ่งเรื่องมีโมดูลหลัก (`module`) และอาจมี
  โมดูลรอง (`extraModules[]`) — ตัวนับจะบวกทั้งโมดูลหลักและโมดูลรองทุกตัว ไม่ใช่แค่โมดูลหลัก เพราะ
  `CaseListPane.jsx` เองก็จับคู่ case เข้ากับ list ทั้งจากโมดูลหลักหรือโมดูลรอง (ฟังก์ชัน `caseInModule()`) —
  ถ้านับเฉพาะโมดูลหลัก badge ตัวเลขจะน้อยกว่าจำนวนจริงที่มองเห็นได้ในหน้า list
- ท้ายเมนูมี footer แสดง metadata ของเอกสาร (`meta.version`, `meta.effective`, `meta.scope`, `meta.manual`) และ
  เลขเวอร์ชันแอป (`APP_VERSION`)
- บนจอแคบ (mobile) เมนูนี้คือหน้าแรกที่เห็น (แสดงหัวข้อต้อนรับเพิ่มเติมที่ซ่อนบนจอกว้าง `lg:hidden`)

**ไฟล์ที่เกี่ยวข้อง:** `src/components/Sidebar.jsx`, `src/data/config.js` (MODULE_ORDER, MODULE_INFO,
moduleColor, moduleLabel), `src/data/flows.js` (SOP_FLOWS)

---

### 2.2 การเรียกดูรายการ Case และรายละเอียด Case

**ทำอะไรได้:** เมื่อกดกิ่ง "Case Studies" หรือเลือกโมดูลย่อย จะเห็น `CaseListPane.jsx` เป็นคอลัมน์กลาง
แสดงการ์ดของแต่ละ case พร้อมเลขที่ (`displayNo` เช่น "PO-3"), ชื่อเรื่อง, ปัญหาโดยย่อ (`when`, ตัดด้วย
`line-clamp-2`) และป้าย (chip) โมดูลรองถ้ามี กดการ์ดแล้วเปิด `CaseDetail.jsx` เป็นคอลัมน์ขวา

**Logic การทำงาน:**

- **การกรองตามโมดูล** (`caseInModule()`): case จะปรากฏใน list ของโมดูล `mod` ถ้า `sc.module === mod`
  **หรือ** `mod` อยู่ใน `sc.extraModules[]`
- **การค้นหา** (`haystack()`): รวมข้อความจาก titleTH, titleEN, when, steps ทั้งหมด (join เป็น string เดียว),
  module, ref, displayNo, extraModules แล้วค้นหาแบบ substring-match ไม่สนตัวพิมพ์เล็ก/ใหญ่ ช่องค้นหาอยู่ที่
  `TopBar` และผูกกับ `query` ใน store (`useStore().query` / `setQuery`)
- **การจัดเรียงภายในมุมมองโมดูลเดียว**: case ที่มีโมดูลนี้เป็น **โมดูลหลัก** จะขึ้นก่อนเสมอ ส่วน case ที่ติดแท็ก
  เข้ามาแค่ผ่าน `extraModules` จะอยู่ถัดไป (stable sort) — ป้องกันไม่ให้เลขที่ "PO-N" ดูสลับสับสนเมื่อมี case
  จากโมดูลอื่นแทรกเข้ามา
- แต่ละ case แสดง "hero" อธิบายโมดูล (ชื่อไทย/อังกฤษ + คำอธิบาย จาก `MODULE_INFO`) เมื่อเปิดมุมมองเฉพาะโมดูล
- **CaseDetail.jsx** แสดง:
  - ป้ายเลขที่ + ชื่อเรื่อง (ภาษาไทย/อังกฤษ สลับกันตามภาษา UI ปัจจุบัน)
  - ปุ่ม **Share** (`ShareButton.jsx`) — คัดลอกลิงก์ตรง `origin + /cases/{no}` ไปยัง clipboard
  - ปุ่ม **Edit** (เฉพาะผู้มีสิทธิ์ `canEdit`)
  - หัวข้อ "ปัญหา" (`sc.when`), หัวข้อ "วิธีแก้/ขั้นตอน" (`sc.steps` render ผ่าน `classifyStep()` — ดูหัวข้อ 2.4),
    "หมายเหตุ" (`sc.note`, ถ้ามี แสดงเป็นกล่องเตือนสีแดง), "อ้างอิง" (`sc.ref`), "วันที่เพิ่ม" (`sc.dateAdded`)
  - แถบ "เอกสารแนบ" (`Attachments`) ทางขวา — ลิงก์ไฟล์ ถ้าเป็นลิงก์ Google Drive จะพยายามดึง `fileId` จาก URL
    (ด้วย regex 3 รูปแบบ) มาสร้าง thumbnail preview; ถ้าดึงไม่ได้ (404) จะซ่อนรูปแล้วเหลือแค่ลิงก์
- case ที่ไม่พบเลขที่ (`no`) ที่ระบุ จะแสดงข้อความ "ไม่พบ" (`error.NOT_FOUND`) แทนหน้าเปล่า

**ไฟล์ที่เกี่ยวข้อง:** `src/components/CaseListPane.jsx`, `src/components/CaseDetail.jsx`,
`src/components/ShareButton.jsx`, `src/lib/copy.js`

---

### 2.3 การแก้ไข Case (สร้าง / แก้ไข / สลับ / ลบ)

**ทำอะไรได้:** ผู้มีสิทธิ์แก้ไข (`canEdit`) เห็นปุ่ม "เพิ่ม case ใหม่" ในหน้า list และปุ่ม "แก้ไข" ในหน้ารายละเอียด
ทั้งสองเปิด modal เดียวกันคือ `EditCaseModal.jsx` (`mode="new"` หรือ `mode="edit"`) ซึ่งมี 3 การกระทำที่แยกจากกัน:

1. **บันทึก (Save)** — สร้างใหม่ (POST) หรือแก้ไข (PATCH) ข้อมูล case
2. **สลับ (Swap)** — สลับเนื้อหาของ case สองเรื่องโดยไม่เปลี่ยนตำแหน่งแถว (มีเฉพาะตอนแก้ไข ไม่มีในโหมดสร้างใหม่)
3. **ลบ (Delete)** — ลบ case พร้อมยืนยันสองขั้นตอน (`confirmDelete`)

**ฟิลด์ในฟอร์ม:** module (dropdown), extraModules (checkbox กลุ่ม ไม่รวมโมดูลหลักของตัวเอง), swap picker
(เฉพาะตอนแก้ไข), titleTH, titleEN, ref (อ้างอิงระเบียบ/เอกสาร), attachments (แบบไดนามิก เพิ่ม/ลบแถวได้), when
(ปัญหา/เงื่อนไขที่พบ), steps (textarea แบบ mono-font ขนาดใหญ่), note (คำเตือนเพิ่มเติม)

**Logic การทำงานโดยละเอียด:**

- **การ validate ก่อนบันทึก:** เฉพาะตอนสร้างใหม่ (`isNew`) เท่านั้นที่ต้องกรอก `titleTH` (ถ้าไม่กรอกจะ error
  `TITLE_REQUIRED` ที่ฝั่ง client ก่อนยิง request) การแก้ไข (edit) ยอมให้เว้นว่าง titleTH ได้ (เพื่อให้ลบข้อความ
  เดิมได้ ตรงกับพฤติกรรมแอปต้นฉบับ)
- **payload ที่ส่งไป API** (ฟังก์ชัน `save()`):
  - `titleTH` จะถูกส่งก็ต่อเมื่อเป็นการสร้างใหม่ หรือมีข้อความ (`.trim()` ไม่ว่าง) — ถ้าเป็นการแก้ไขและเว้นว่าง
    จะ**ไม่ส่ง key นี้เลย** เพราะฝั่ง server (`scenarioEditSchema`) ตีความ key ที่ไม่ส่งมาว่า "ไม่แก้ไขฟิลด์นี้"
    แต่ถ้าส่งค่า titleTH เป็น string ว่าง server จะ validate fail (schema กำหนด `min(1)`) — ดังนั้นฝั่ง client
    ต้องหลีกเลี่ยงการส่ง key ว่างเพื่อไม่ให้ได้ 400 กลับมา
  - `when` และ `steps` (จาก textarea) ผ่าน `normalizePastedText()` ก่อนส่ง เพื่อซ่อม arrow character ที่วางมา
    จาก Word/Excel (ดูหัวข้อ 2.4)
  - **`displayNo` และ `no` ไม่ถูกส่งไปเลย** — `displayNo` คำนวณใหม่ทุกครั้งที่อ่านจาก server (จึงส่งไปก็ไร้
    ประโยชน์ และอาจ stale ทันทีที่มีการ reorder/ลบ) ส่วน `no` คือ "ที่อยู่" ของ record ไม่ใช่ field ที่แก้ไขได้
- **การสร้างใหม่ (`createScenario`)**: หลังสำเร็จ ปิด modal แล้ว navigate ไปที่ `/cases/{no}` ของ case ที่เพิ่ง
  สร้าง (server ตอบ `no` กลับมา) เพื่อไม่ให้ผู้ใช้รู้สึกว่า "บันทึกหายไปไหน"
- **การแก้ไข (`saveScenario`)**: หลังสำเร็จ navigate ไปที่ `/cases/{no}` เสมอ (แม้จะเปลี่ยน module) เพื่อไม่ให้
  case หายไปจาก list ที่เปิดอยู่ในทันที
- **การสลับ (`doSwap`)**: ต้องเลือกเป้าหมายจาก dropdown ที่จัดกลุ่มตามโมดูล (`swapGroups`) แสดงชื่อ case
  ตัดคำยาวเกิน 42 ตัวอักษร (มี tooltip เต็ม) ค่าที่ส่งไปคือ **`displayNo`** ของเป้าหมาย (เช่น "PO-5") ไม่ใช่ `no`
  เพราะเป็นป้ายที่ผู้แก้ไขมองเห็นจริงบนการ์ด
- **การลบ (`doDelete`)**: ต้องกดยืนยันสองครั้ง (ปุ่มแรกเปลี่ยน UI เป็นข้อความยืนยัน + ปุ่ม "ใช่/ยกเลิก") หลังลบ
  สำเร็จ navigate กลับไปที่ `/cases/module/{module}`
- **การจัดการ error แบบ "ห้ามดูเหมือนบันทึกสำเร็จ"** (หลักการสำคัญของทั้งโมดูล ดูหัวข้อ 4.3): ทุก mutation เป็น
  read-modify-write ของทั้งเอกสารภายใต้ `select … for update` — client ไม่สามารถสมมติว่าการเขียนจะสำเร็จเสมอ
  ดังนั้นเมื่อเกิด error, modal **จะไม่ปิด** ข้อความที่พิมพ์ไว้ยังอยู่ครบ และแสดงเหตุผล error (`errorText()`)
  ผ่าน `Notice` — ถ้าปิด modal ไปตอน error จะทำให้ผู้ใช้เข้าใจผิดว่าข้อมูลถูกบันทึกแล้วทั้งที่ไม่ใช่ และข้อความ
  ที่พิมพ์จะหายไปกว่าจะรู้ตัว
- **`ExtraModules`**: เปลี่ยน module หลักจะล้างค่า `extraModules` ทั้งหมดทันที (`onModuleChange`) เพราะชุดที่
  เลือกไว้ผูกกับ module หลักตัวเก่า

**ไฟล์ที่เกี่ยวข้อง:** `src/components/EditCaseModal.jsx`, `src/components/AttachmentRows.jsx`,
`src/lib/steps.js`, `src/lib/sopApi.js`, `src/store.jsx` (mutate/createScenario/saveScenario/swapScenario/
deleteScenario), `api/src/routes/sop.js` (POST/PATCH/DELETE `/scenarios`, POST `/scenarios/:no/swap`)

---

### 2.4 โครงสร้างขั้นตอน (Steps) — `lib/steps.js`

นี่คือหัวใจของการแสดงผล "วิธีแก้ไขปัญหา" แบบมีลำดับขั้นตอน ทั้งตอนแสดงผล (`CaseDetail.jsx`) และตอนแก้ไข
(`EditCaseModal.jsx`) พอร์ตมาจาก `stepsToStorage` / `stepsFromStorage` / `stepDepth` ในแอปต้นฉบับ
(apps-script/index.html) โดยตรง

**รูปแบบการจัดเก็บ (storage format)** — แต่ละบรรทัดใน `Scenario.steps[]` เป็น string ธรรมดา มี prefix บอก
ประเภท:

| Prefix | ความหมาย |
|---|---|
| `"N. text"` | ขั้นตอนแบบมีเลข (ตัวเลข N เขียนไว้ตามตัวอักษร แต่ **เลขที่แสดงจริงบนหน้าจอมาจาก CSS counter** ของ `<ol class="steps">` ไม่ใช่เลขที่เขียนไว้ในสตริง — ตัวเลขที่พิมพ์มีไว้แค่ "บอกว่าบรรทัดนี้เป็นขั้นตอนแบบมีเลข" เท่านั้น) |
| `"» text"`, `"» » text"`, … | ขั้นตอนย่อย (sub-bullet) ความลึก = จำนวนครั้งที่ `"» "` ซ้ำกัน |
| `"· text"` | คำอธิบายเฉย ๆ ไม่มีเลข ไม่มีสัญลักษณ์ (caption) |

**รูปแบบตอนพิมพ์ใน textarea (authoring format):**

- บรรทัดที่ขึ้นต้นด้วยตัวเลข (`1.` หรือ `2)` ฯลฯ) → กลายเป็นขั้นตอนแบบมีเลข
- บรรทัดที่ขึ้นต้นด้วย `>` หรือ `>>` → กลายเป็น sub-bullet ระดับ 2 / 3 ตามจำนวน `>`
- บรรทัดอื่น ๆ → กลายเป็น caption ธรรมดา

**ฟังก์ชันหลัก:**

- `normalizePastedText(text)` — ซ่อม arrow ที่เพี้ยนจากการวางข้อความจาก Word/Excel/Confluence เช่น
  `$\rightarrow$`, `\Rightarrow`, `->` ให้กลายเป็นอักขระ `→`/`←` จริง ใช้ทั้งกับทุกบรรทัดของ steps และกับฟิลด์
  "ปัญหา" (`when`) ตอนบันทึก
- `stepsToStorage(text)` — แปลงเนื้อหาทั้งก้อนจาก textarea เป็น array ของ string ตามรูปแบบจัดเก็บด้านบน โดยไล่
  ทีละบรรทัด, ข้ามบรรทัดว่าง, ตรวจ prefix `>` ก่อน (sub-bullet) แล้วจึงตรวจเลขนำหน้า (numbered) ถ้าไม่เข้าเงื่อนไข
  ไหนเลยจะกลายเป็น caption (`· `) เลขของขั้นตอนแบบมีเลข (`stepNo`) นับต่อเนื่องเพิ่มขึ้นทุกครั้งที่เจอบรรทัด
  ประเภทนี้ (sub-bullet และ caption ไม่ทำให้ตัวนับขยับ)
- `stepsFromStorage(steps)` — แปลงกลับจาก array ที่เก็บไว้ให้เป็นข้อความ textarea สำหรับแก้ไข case ที่มีอยู่แล้ว
  (ตัด prefix `· ` หรือ `» ` ออก แปลงความลึกกลับเป็นจำนวน `>`)
- `classifyStep(line)` — ใช้ตอนแสดงผล (ไม่ใช่ตอนแก้ไข) คืนค่า `{ kind, depth, text }` โดย `kind` เป็น
  `'numbered' | 'sub' | 'caption'` ใช้ตัดสินใจว่าจะ render อย่างไรใน `CaseDetail.jsx` (component `Steps`) —
  ขั้นตอนแบบมีเลขแสดงด้วย class `step-n` (ให้ CSS counter นับเลขจริง), sub-bullet เยื้องซ้ายตามความลึก (สูงสุด
  จำกัดที่ระดับ 3), caption แสดงตัวหนาสีจาง

**เหตุผลเชิงออกแบบที่สำคัญ:** การใช้ CSS counter แทนเลขที่เขียนตายตัวทำให้ *แทรกขั้นตอนใหม่ตรงกลางได้โดยไม่ต้อง
ไล่แก้เลขของทุกบรรทัดถัดไปด้วยมือ* — ผู้แก้ไขพิมพ์เลขอะไรก็ได้ (หรือจะเรียง 1,1,1 ก็ได้) ระบบจะนับเลขที่แสดงจริง
ให้เองตามตำแหน่ง

**ไฟล์ที่เกี่ยวข้อง:** `src/lib/steps.js`, ใช้งานใน `src/components/EditCaseModal.jsx` (stepsFromStorage /
stepsToStorage) และ `src/components/CaseDetail.jsx` (classifyStep, component `Steps`)

---

### 2.5 Process Flows (ผังกระบวนการ)

**ทำอะไรได้:** แสดงแผนภาพ swimlane (แนวขั้นตอนแบ่งตามผู้รับผิดชอบ/lane) จำนวน 33 ผัง ครอบคลุมโมดูล ERP หลัก
(BD, PO, IC, OF, AP, AR, FA, GL) ผู้ใช้เลือกดูได้จากเมนูซ้าย หรือค้นหาผ่านช่องค้นหาส่วนกลาง

**Logic การทำงาน:**

- ข้อมูลผัง (`SOP_FLOWS`) เก็บเป็นไฟล์ static `src/data/flows.js` **ไม่ได้ดึงจาก API** — เพราะเป็นแผนภาพที่มากับ
  ตัวแอปโดยตรง ไม่ใช่เนื้อหาที่แก้ไขได้จากฐานข้อมูล จึงทำงานได้ปกติแม้เอกสาร SOP หลักจะยังไม่ได้ seed
  (`NOT_SEEDED`) หรือ API ล่ม
- โครงสร้างข้อมูลแต่ละผัง: `lanes[]` (คอลัมน์ตามผู้รับผิดชอบ), `nodes[]` (กล่องขั้นตอน มี `lane`, `rank` กำหนด
  ตำแหน่งบน grid, `type`: start/end/process/decision), `edges[]` (เส้นเชื่อมระหว่าง node มี `kind`:
  normal/approve/yes/reject), `narrative[]` (คำอธิบายเป็นข้อความ prefix `» ` = ขั้นตอนย่อย, `! ` = ข้อควรระวัง)
- **การวาดเส้นเชื่อม (`FlowDiagram.jsx`)**: ไม่ใช้ library กราฟใด ๆ (ตาม TECH_STACK.md) แต่วัดตำแหน่งจริงของกล่อง
  แต่ละใบจาก DOM (`getBoundingClientRect`) หลัง layout เสร็จ แล้วคำนวณเส้น SVG เอง (`routeEdge()`) เพราะความสูง
  ของกล่องขึ้นกับการตัดคำภาษาไทย ซึ่งขึ้นกับฟอนต์และขนาดจอ รู้ตำแหน่งจริงได้ก็ต่อเมื่อ DOM render เสร็จแล้วเท่านั้น
  — วัดใหม่ทุกครั้งที่: resize หน้าต่าง, ฟอนต์ Sarabun โหลดเสร็จ (`document.fonts.ready`), หรือขนาด pane
  เปลี่ยนโดยไม่ใช่ window resize (ผ่าน `ResizeObserver`)
- เส้นประเภท `reject` จะวาดเป็นเส้นวนย้อนกลับใต้กล่องทั้งสอง (แสดงว่าการปฏิเสธคือการถอยกลับ ไม่ใช่เดินหน้าต่อ)
- ผังที่หา `id` ไม่เจอ (ลิงก์เก่า/พิมพ์ผิด) จะ fallback ไปหน้า Welcome แทนหน้า error

**ไฟล์ที่เกี่ยวข้อง:** `src/data/flows.js`, `src/components/FlowListPane.jsx`, `src/components/FlowDetail.jsx`,
`src/components/FlowDiagram.jsx`

---

### 2.6 Reports (ตารางรายงาน)

**ทำอะไรได้:** แสดงตาราง "จะเรียกรายงานนี้ได้จากเมนูไหนใน ERP" 3 คอลัมน์: เลขที่กรณี (case), คำอธิบายสถานการณ์
(scenario), เมนูพาธ (path) ผู้มีสิทธิ์แก้ไขเพิ่มแถวใหม่ได้ (modal `NewReportModal`) และ **ลบแถวได้** (ฟีเจอร์ใหม่
ที่แอปต้นฉบับไม่มี — ดูหัวข้อ 6) มีปุ่มลิงก์ไปยัง NotebookLM ภายนอกด้วย

**Logic การทำงาน:**

- ค้นหาด้วยช่องค้นหาส่วนกลางเช่นกัน (จับคู่ `case + scenario + path` รวมเป็น string เดียว)
- การเพิ่มแถวใหม่: เลขที่ case เริ่มต้นเป็น `เลขสุดท้าย + 1` โดยอัตโนมัติ (แก้ไขเองได้) ต้องกรอก scenario และ
  path ไม่งั้น error `VALIDATION_FAILED` ที่ฝั่ง client
- การลบแถว: ต้องกดยืนยัน (แสดงปุ่ม "ยืนยัน/ยกเลิก" แทนที่ปุ่ม × เมื่อกดครั้งแรก)
- เช่นเดียวกับ EditCaseModal เมื่อบันทึกล้มเหลว modal จะไม่ปิด ข้อความที่พิมพ์ยังอยู่

**ไฟล์ที่เกี่ยวข้อง:** `src/components/ReportsView.jsx`, `api/src/routes/sop.js` (`/reports`,
`/reports/:case`)

---

### 2.7 ประวัติเวอร์ชัน (Version History) — `/versions`

**ทำอะไรได้:** ผู้มีสิทธิ์แก้ไข (`sop` editor) เท่านั้นที่เข้าถึงได้ (ทั้งจากลิงก์ตรงและจาก Settings) หน้านี้แสดง
รายการ snapshot ของเอกสารทั้งฉบับ เรียงจากล่าสุดไปเก่าสุด (สูงสุด 50 รายการ) พร้อมวันที่/เวลา, ผู้ที่ทำให้เกิด
snapshot (`takenBy`), หมายเหตุ และปุ่ม "กู้คืน" (Restore) ต่อแต่ละรายการ (ต้องกดยืนยัน)

**Logic การทำงาน:**

- รายการ version **ไม่ได้บรรจุเนื้อหาเอกสารเต็ม** (`data`) มาด้วย — ฝั่ง API จงใจตัดออกจาก endpoint `/versions`
  list เพราะแต่ละ version คือเอกสาร SOP ทั้งก้อน ดึงมา 50 ชุดเพื่อแสดง dropdown จะสิ้นเปลืองเกินจำเป็น
- guard สองชั้น: ถ้า route `/versions` ถูกเข้าถึงโดยตรงทาง URL (ไม่ใช่ผ่านลิงก์ใน Settings) โดยผู้ที่ไม่มีสิทธิ์
  `sop` editor จะเห็นข้อความแจ้ง "สำหรับผู้แก้ไขเท่านั้น" (`versions.editorOnly`) แทนตาราง — ตรวจสอบทั้งจาก
  `canEdit` (สิทธิ์ที่ API ยืนยันมา) และ `hasEditorRole` (สิทธิ์จาก JWT ฝั่ง client เอง) ป้องกันไม่ให้ผู้ไม่มีสิทธิ์
  ยิง request แล้วได้ 403 กลับมาเปล่า ๆ
- การกู้คืน (`restoreVersion`) เขียนเอกสารเก่ากลับเข้าไปเป็นการ **update ปกติ** ซึ่งจะทำให้ trigger สร้าง snapshot
  ของเอกสาร**ปัจจุบัน**ก่อนทับ — แปลว่าการ restore เองก็ย้อนกลับได้เสมอ ไม่มีข้อมูลสูญหาย
- หน้านี้เป็นฟีเจอร์ที่ **เพิ่มใหม่ในระบบพอร์ต** (ไม่มีในแอปต้นฉบับ Apps Script) — ดูรายละเอียดในหัวข้อ 6

**ไฟล์ที่เกี่ยวข้อง:** `src/components/VersionsView.jsx`, `src/lib/sopApi.js` (listVersions, getVersion,
restoreVersion), `api/src/routes/sop.js` (GET `/versions`, GET `/versions/:id`, POST `/versions/:id/restore`),
`supabase/migrations/006_sop.sql` (ตาราง `sop.sop_versions`, trigger `sop_snapshot`)

---

### 2.8 การตั้งค่า (Settings)

**ทำอะไรได้ (`SettingsModal.jsx`):**

- แสดงสถานะบัญชี: อีเมลผู้ใช้ (หรือ "ไม่ระบุตัวตน/anonymous" ถ้ายังไม่ล็อกอิน) และป้าย "Editor" ถ้ามีสิทธิ์แก้ไข
- สลับธีม (light/dark/auto) และภาษา (ไทย/อังกฤษ) — ใช้ provider ร่วมของทั้งระบบ VCB Connect
- เลือก "มุมมองเริ่มต้น" (default view) เมื่อเปิดแอป — เก็บใน `localStorage` คีย์ `sop-default-view`
  (ค่าได้แก่ `flows`, `ALL`, รหัสโมดูลใดโมดูลหนึ่ง, หรือ `reports`)
- ลิงก์ไปหน้า Version History (เฉพาะผู้มีสิทธิ์แก้ไข)
- ปุ่ม sign-in (ลิงก์ไป portal กลาง) / sign-out
- แสดงเลขเวอร์ชันแอปและ changelog
- ปุ่มคัดลอกอีเมลผู้พัฒนา (click-to-copy)

**Logic ที่สำคัญ:** ไม่มีฟอร์ม login ในโมดูลนี้เลย — การล็อกอินเป็นหน้าที่ของ portal กลาง (คอมเมนต์ในโค้ด: "Sign-in
is the portal's job") ปุ่ม "เข้าสู่ระบบเพื่อแก้ไข" เป็นเพียงลิงก์ `<a href={VITE_PORTAL_URL}>` ธรรมดา

**ไฟล์ที่เกี่ยวข้อง:** `src/components/SettingsModal.jsx`, `src/store.jsx` (getDefaultView/setDefaultView/
defaultViewPath)

---

## 3. โครงสร้างข้อมูลและ Data Flow

### 3.1 โมเดลเอกสารเดียว (Single JSONB Document) — ยืนยันจากโค้ด

ยืนยันตามคอมเมนต์หัวไฟล์ `api/src/routes/sop.js` และ schema ใน `supabase/migrations/006_sop.sql`:
**SOP ทั้งหมดถูกเก็บเป็นเอกสาร JSON เดียว** ในตาราง `sop.sop_document` แถวเดียวคงที่ (`id = 1`, บังคับด้วย
`check (id = 1)`) โครงสร้าง JSON คือ:

```json
{
  "meta": { "title": "...", "version": "...", "effective": "...", "scope": "...", "purpose": "...", "notes": ["..."] },
  "scenarios": [ { "no": 1, "module": "PO", "titleTH": "...", "steps": ["..."], "...": "..." } ],
  "reports": [ { "case": 1, "scenario": "...", "path": "..." } ]
}
```

เหตุผลที่ไม่ normalize เป็นหลายตาราง (ระบุในคอมเมนต์ทั้งใน `sop.js` และ migration): client อ่าน/เขียนทั้งต้นไม้
(tree) เป็นก้อนเดียวเสมอ (`getSopDataForClient` / `renumberAllSteps_` ในแอปต้นฉบับ) การแยกเป็นตารางย่อยจะต้อง
สร้าง logic เหล่านี้ใหม่ทั้งหมดโดยไม่ได้ประโยชน์อะไร จนกว่าจะมีความต้องการ query แยกทีละ step จริง ๆ

ในแอป Apps Script เดิม ข้อมูลนี้เก็บใน `ScriptProperties` (ต้องแบ่ง key เพราะแต่ละ property มีขนาดจำกัด) —
Postgres ไม่มีข้อจำกัดนั้น การแบ่ง chunk จึงหายไปในเวอร์ชันนี้

### 3.2 ทำไมต้องเป็น read-modify-write ทั้งก้อน

ทุก mutation (`mutateDocument()` ใน `api/src/routes/sop.js` บรรทัด 142-177) ทำงานแบบ:

1. `select data from sop.sop_document where id = 1 for update` — ล็อกแถวไว้ในทรานแซกชัน
2. แก้ไข object `doc` ใน JavaScript memory (เพิ่ม/แก้/ลบ scenario หรือ report)
3. คำนวณ `displayNo` ใหม่ทั้งหมด (`assignDisplayNo`), อัปเดต `meta.updatedAt`
4. ลบ `meta.isAdmin` / `meta.userEmail` ออกก่อนบันทึก (เป็นข้อมูล session ของ request หนึ่งครั้ง ไม่ใช่เนื้อหา
   เอกสารที่ควรถูกบันทึกถาวร)
5. `update sop.sop_document set data = $2::jsonb ...` — เขียนทับทั้งเอกสาร

ผลคือถ้าผู้แก้ไขสองคนบันทึกพร้อมกัน คนที่สองจะรอ lock แล้วจึงเขียนทับบน state ล่าสุด (ไม่ใช่ last-write-wins
ที่ทำลายทั้งเอกสาร) และเนื่องจากเป็นการเขียนทั้งก้อนเสมอ **ฝั่ง client ห้ามสมมติว่าตัวเองชนะการเขียนเสมอ** —
นี่คือที่มาของกฎ "A rejected write must not look like a save" ในหัวข้อ 4.3

### 3.3 `displayNo` — คำนวณฝั่ง server เท่านั้น ไม่เคยถูกจัดเก็บถาวร

ฟังก์ชัน `assignDisplayNo(scenarios)` (บรรทัด 114-122) ไล่ทุก scenario ตามลำดับแถวปัจจุบัน นับแยกตาม `module`
แล้วประกอบเป็น label เช่น `"PO-3"` — คำนวณใหม่ **ทุกครั้งที่อ่านและทุกครั้งที่เขียน** ไม่เคยถูกบันทึกเป็นค่าถาวร
เพราะการลบ/สลับ/เรียงลำดับใหม่จะทำให้ค่าที่บันทึกไว้ผิดทันที จุดเดียวที่ `displayNo` ถูกส่งจาก client ไป server
คือ endpoint `swap` (เพราะเป็นป้ายที่ผู้แก้ไขมองเห็นและเลือกจริงบนหน้าจอ)

### 3.4 Endpoints ทั้งหมด (`api/src/routes/sop.js`, base path `/api/sop`)

| Method & Path | สิทธิ์ | คำอธิบาย |
|---|---|---|
| `GET /` | `allowAnonymous` | คืนเอกสารทั้งฉบับ (`{meta, scenarios, reports}` + `meta.isAdmin`/`meta.userEmail` ที่ฉีดเข้ามาจาก JWT ของผู้เรียก) 404 `NOT_SEEDED` ถ้ายังไม่มีแถว |
| `PATCH /meta` | editor | แก้ไข metadata เอกสาร (title, subtitle, manual, version, effective, scope, purpose, notes) |
| `GET /scenarios` | anonymous | รายการ case ทั้งหมด กรองด้วย query `?module=` ได้ (จับคู่ทั้ง primary + extraModules) |
| `GET /scenarios/:no` | anonymous | case เดียวตามเลข `no` |
| `POST /scenarios` | editor | สร้าง case ใหม่ (`no` = length+1 เสมอ) |
| `PATCH /scenarios/:no` | editor | แก้ไข case (ทุกฟิลด์ optional, key ที่ไม่ส่งมา = "ไม่แก้ไข") |
| `POST /scenarios/:no/swap` | editor | สลับเนื้อหาระหว่าง case `no` กับ case ที่มี `displayNo` ตรงกับ `swapWith` |
| `DELETE /scenarios/:no` | editor | ลบ case (case ถัดไปในโมดูลเดียวกัน renumber displayNo ขึ้นอัตโนมัติ) |
| `GET /reports` | anonymous | รายการ reports ทั้งหมด |
| `POST /reports` | editor | เพิ่มแถว report |
| `DELETE /reports/:case` | editor | ลบแถว report ตามเลข `case` |
| `GET /versions` | editor | รายการ snapshot (ไม่รวม `data`) สูงสุดตาม `?limit=` (default 50, max 200) |
| `GET /versions/:id` | editor | snapshot เดียวพร้อมเนื้อหาเต็ม |
| `POST /versions/:id/restore` | editor | เขียนเอกสารจาก snapshot นี้กลับเป็นเอกสารปัจจุบัน |

### 3.5 การ Snapshot อัตโนมัติ (Version History)

Trigger ฐานข้อมูล `sop.snapshot_before_update()` (นิยามใน `006_sop.sql`) ทำงาน **ก่อน** ทุกคำสั่ง
`update` บนตาราง `sop.sop_document`: มันจะ insert แถวเก่า (`old.data`, `old.updated_by`) เข้า
`sop.sop_versions` พร้อม timestamp และ note ("auto-snapshot before update") ก่อนที่การ update จะเกิดขึ้นจริง

จุดสำคัญ: เพราะเป็น **database trigger** ไม่ใช่โค้ดใน route handler — ประวัติเวอร์ชันจึง "ไม่มีวันขาดหาย"
จากการที่ผู้พัฒนา route ใดลืมเรียก snapshot การ restore version เก่าเองก็เป็นแค่การ update ธรรมดา ซึ่งจะโดน
trigger จับสร้าง snapshot ของเอกสารปัจจุบันก่อนทับเช่นกัน ทำให้ restore เองก็ undo ได้เสมอ

### 3.6 Data Flow สรุปสั้น (ฝั่ง client)

```
StoreProvider (src/store.jsx)
  └─ load() → sopApi.fetchSop() → GET /api/sop
       ├─ 200 → setDoc({meta, scenarios, reports}), status = ready
       ├─ 404 NOT_SEEDED → setDoc(EMPTY_DOC), status = notSeeded
       └─ อื่น ๆ → status = error, เก็บ error object ไว้

mutate(fn) — ใช้ร่วมกันโดยทุก write operation
  └─ เรียก fn() (เช่น sopApi.createScenario)
       ├─ สำเร็จ → reloadTick++ (trigger useEffect ให้ load() ใหม่) → คืนผลลัพธ์
       └─ ล้มเหลว → setWriteError(err) แล้ว throw ต่อ (caller ต้อง catch เอง)
```

ทุก mutation ที่สำเร็จจะ**โหลดเอกสารใหม่ทั้งฉบับ** (ไม่ merge เฉพาะจุด) เพราะ `displayNo` อาจเปลี่ยนทั้งโมดูล
จากการ mutation เดียว

**ไฟล์ที่เกี่ยวข้อง:** `src/store.jsx`, `src/lib/sopApi.js`, `api/src/routes/sop.js`,
`supabase/migrations/006_sop.sql`

---

## 4. หลักการออกแบบสำคัญ (จากคอมเมนต์ในโค้ดและ PORT_NOTES.md)

### 4.1 ข้อมูลมาจาก API เท่านั้น ไม่มี mock ฝังในแอป

เวอร์ชันก่อนหน้าเคย bundle `src/data/sop.json` และเสิร์ฟจาก mock ใน `lib/api.ts` เวอร์ชันปัจจุบันดึงทุกอย่าง
ผ่าน `GET /api/sop` และ endpoint พี่น้อง `lib/supabaseClient.ts` ถูกลบทิ้งไปเลย — เบราว์เซอร์**ไม่มีทาง**เข้าถึง
Supabase โดยตรงอีกต่อไป Express เป็นตัวเดียวที่ถือ credential ฐานข้อมูล และเป็นตัวเดียวที่บังคับสิทธิ์การเขียน

ข้อมูลชุดเดิมที่เคย bundle ไว้ยังหลงเหลืออยู่ที่ `seed/sop-document.json` แต่**ไม่ใช่โค้ดแอปอีกต่อไป** — ใช้เป็น
payload สำหรับ seed ตาราง `sop.sop_document` เท่านั้น (ดู `seed/README.md`)

### 4.2 Navigation เป็น React Router จริง ไม่ใช่ state จำลอง

เวอร์ชันเดิมจำลอง routing ด้วย object `{ view, mod, sel, selFlow }` ใน store และสลับ pane บนมือถือด้วยการ
toggle class บน `body` (`m-list` / `m-detail` / `reports-mode`) เวอร์ชันนี้ใช้ React Router แทนทั้งหมด ทำให้
case แชร์ลิงก์ได้จริง ลิงก์เก่าแบบ `?case=N` / `?flow=ID` ยังใช้งานได้ผ่าน `LegacyQueryRedirect` ใน `App.jsx`
(แปลงเป็น route แล้ว replace history entry ครั้งเดียว)

### 4.3 "A rejected write must not look like a save" (กฎที่สำคัญที่สุดของโมดูลนี้)

เพราะทุก mutation เป็น read-modify-write แบบ lock ทั้งเอกสาร ฝั่ง client **ห้ามสมมติว่าการเขียนจะชนะเสมอ**
ดังนั้น `mutate()` ใน `store.jsx` จะ re-throw error ทุกครั้งที่ล้มเหลว และทุกฟอร์ม (EditCaseModal,
NewReportModal) ต้อง**เปิดค้างไว้**พร้อมข้อความที่พิมพ์ครบถ้วนและแสดงเหตุผล — การปิดฟอร์มตอน error จะทำให้คน
เข้าใจผิดว่างานถูกบันทึกแล้วทั้งที่ไม่ใช่ และข้อความที่พิมพ์ไว้จะหายไปก่อนที่จะรู้ตัว

error code `409` (นอกเหนือจาก `NOT_SEEDED`) ถูกแปลความเป็น `error.CONFLICT` โดยเฉพาะ (ฟังก์ชัน `errorKey()` ใน
`lib/sopApi.js`) — สื่อความว่า "มีคนอื่นแก้ไขพร้อมกัน ให้ refresh แล้วทำใหม่" แทนที่จะเป็น error ทั่วไปที่ทำอะไร
ไม่ถูก

### 4.4 Drive filename lookup ถูกตัดออกจริง ไม่ใช่แค่ยังไม่ทำ

แอปต้นฉบับ (Apps Script) ดึงชื่อไฟล์แนบอัตโนมัติผ่าน `DriveApp.getFileById(...).getName()` เวอร์ชันพอร์ตแรก
ยังคงรูปแบบ call ไว้แต่คืนค่าว่างเสมอ เวอร์ชันปัจจุบัน**ตัดออกไปเลย** เพราะ Drive ไม่ส่ง permissive CORS header
สำหรับ file metadata และ Express API ไม่มี endpoint สำหรับ Drive — ไม่ใช่แค่ยังไม่ implement แต่ implement
จากฝั่ง browser ไม่ได้เลยด้วยสถาปัตยกรรมปัจจุบัน ผู้ใช้ต้องพิมพ์ชื่อไฟล์แนบเอง (เว้นว่างจะแสดง "เอกสารแนบ" ซึ่ง
เป็นค่าเดียวกับที่ auto-fill เดิมได้ผลลัพธ์อยู่แล้ว) **หากต้องการฟีเจอร์นี้กลับมา ต้องเพิ่ม API endpoint ที่ proxy
Drive API ด้วย service credential**

### 4.5 Google Doc mirror ไม่ได้ทำใหม่

เดิมมี `SOP_DOC_ID` เป็น one-way mirror: ทุกครั้งที่บันทึกจะเขียนเข้า Google Doc ด้วย (แต่แก้ Doc แล้วไม่ไหลกลับ
เข้าระบบ) หลัง migration `sop_document` ในฐานข้อมูลถือเนื้อหาแทน การจะเขียน mirror นี้ต่อหรือไม่เป็นการตัดสินใจ
ที่ทีม deployment ต้องทำเอง (ระบุไว้ท้าย `006_sop.sql`) — ถ้าเลิกเขียนแบบเงียบ ๆ จะกลายเป็นเอกสารที่ล้าสมัยแต่
ยังดูน่าเชื่อถือ ซึ่งแย่กว่าไม่มีทั้งสองแบบ

---

## 5. สิทธิ์การเข้าถึง (Access Model) — ยืนยันจากโค้ด

โมดูล SOP **เปิดให้อ่านได้แบบไม่ต้องล็อกอิน (anonymous) โดยตั้งใจ** — ยืนยันได้จากหลายจุดที่สอดคล้องกัน:

1. **`api/src/routes/sop.js`** — comment หัวไฟล์ระบุชัดเจน: *"READS ARE PUBLIC. WRITES NEED THE `sop` EDITOR
   ROLE."* endpoint อ่านทั้งหมด (`GET /`, `GET /scenarios`, `GET /scenarios/:no`, `GET /reports`) ใช้
   middleware `allowAnonymous` — *"the SOP is reference material staff open without signing in, and requiring
   auth would be a regression"*
2. **`supabase/migrations/006_sop.sql`** — comment: *"Reads are allowAnonymous (the SOP is reference material
   staff open without signing in — requiring auth would be a regression)"* — RLS ถูกปิดไปแล้ว (ไม่มี policy
   ใน migration นี้) เพราะ browser ไม่เข้าฐานข้อมูลตรงอีกต่อไป การบังคับสิทธิ์ทั้งหมดย้ายมาอยู่ที่ Express
3. **`docs/ACCESS_MODEL.md`** — ระบุในตาราง role ว่า `sop` มีเพียงระดับเดียวคือ `editor` (บรรทัด 46:
   `| sop | editor |`) และในหัวข้อ "Intentionally open regardless" (บรรทัด 150-154): *"SOP, Meeting Minutes,
   Onboarding and Portal reads are anonymous by design and documented in each route file. The SOP is
   reference material staff open without signing in ... Do not 'fix' these."*
4. **`sop/PORT_NOTES.md`** — *"Sign-in is the portal's job. There is no sign-in form in this module. Reading
   the SOP is anonymous (allowAnonymous, matching the old 'readable by anyone' RLS policy), and editing needs
   the `sop` editor role, which comes from the shared JWT."*

**สรุปเป็นตาราง:**

| การกระทำ | สิทธิ์ที่ต้องมี |
|---|---|
| อ่านเอกสารทั้งฉบับ / ดู case / ดู reports / ดู Process Flows | ไม่ต้องล็อกอิน (anonymous) |
| แก้ไข metadata เอกสาร, สร้าง/แก้ไข/สลับ/ลบ case, เพิ่ม/ลบ report | ล็อกอิน + สิทธิ์ `sop = editor` |
| ดูและกู้คืน Version History | ล็อกอิน + สิทธิ์ `sop = editor` |

**พฤติกรรมฝั่ง UI ที่เกี่ยวข้อง (`src/store.jsx`):** ตัวแปร `canEdit` มาจาก `doc.meta.isAdmin !== false`
(ค่าเริ่มต้นคือ **เปิด/true** ตราบใดที่ยังไม่ทราบค่าจาก server — เช่นตอนโหลดครั้งแรกหรือ API ล่ม) เหตุผลที่ตั้ง
default เป็นเปิดไว้ก่อน (ระบุในคอมเมนต์บรรทัด 170-172): *"doc.meta is {} before the first successful load ...
and Boolean({}.isAdmin) is false — which hid every Edit control behind a backend outage."* กล่าวคือถ้า default
ปิดไว้ก่อน ปุ่ม Edit ทั้งหมดจะหายไปทุกครั้งที่ backend ตอบช้าหรือล่ม ซึ่งเป็นพฤติกรรมที่ไม่ต้องการ — `canEdit`
เป็นเพียง **UI hint** ว่าจะแสดงปุ่มแก้ไขหรือไม่ ตัวบังคับสิทธิ์จริงคือ `requireRole('sop','editor')` ที่ฝั่ง
Express เสมอ (ต่อให้ client แสดงปุ่ม Edit แต่ไม่มีสิทธิ์จริง server ก็ปฏิเสธ)

ค่า `hasEditorRole` (จาก `useAuth().hasRole('sop','editor')`) เป็นอีกตัวแปรแยกต่างหาก ใช้เพื่ออธิบาย "ทำไมแก้ไข
ไม่ได้" (เช่น "คุณยังไม่ได้ล็อกอิน" ต่างจาก "คุณล็อกอินแล้วแต่ไม่มีสิทธิ์ editor")

---

## 6. ข้อจำกัดหรือสิ่งที่ยังไม่รองรับ (จาก `PORT_NOTES.md`)

1. **ไม่มีการดึงชื่อไฟล์อัตโนมัติจาก Google Drive** — ต้องพิมพ์ชื่อไฟล์แนบเอง เพราะ Drive ไม่ส่ง CORS header ที่
   จำเป็นสำหรับการเรียกจาก browser และ API ยังไม่มี endpoint proxy ไปยัง Drive (ดูหัวข้อ 4.4)
2. **ไม่มี Google Doc mirror ใหม่** — `SOP_DOC_ID` เดิมที่เคยเขียนสำเนาไปยัง Google Doc ทุกครั้งที่บันทึก ยังไม่
   ถูกนำกลับมาทำ ทีม deployment ต้องตัดสินใจเองว่าจะทำต่อหรือไม่ (ดูหัวข้อ 4.5)
3. **`displayNo` เป็นค่าที่คำนวณสดเสมอ ห้าม client เก็บ cache ไว้ใช้ต่อ** — ค่าจะ stale ทันทีที่มีการ reorder/
   ลบ/สลับ (ดูหัวข้อ 3.3)
4. **การบันทึกไม่รับประกันว่าจะสำเร็จเสมอ** — เนื่องจากเป็น read-modify-write แบบ lock ทั้งเอกสาร ผู้ใช้อาจเจอ
   409 CONFLICT เมื่อมีคนแก้ไขพร้อมกัน (ดูหัวข้อ 4.3)
5. **เอกสารต้องถูก seed ก่อนใช้งานจริง** — migration `006_sop.sql` จงใจ**ไม่**ใส่แถวเปล่าให้ตอนสร้าง schema
   (เพื่อไม่ให้ editor เริ่มพิมพ์เนื้อหาลงเอกสารที่กำลังจะถูกทับด้วยข้อมูลนำเข้าจริง) จนกว่าจะมีคน insert แถวลง
   `sop.sop_document` ทุก endpoint จะตอบ `404 NOT_SEEDED` และ UI จะแสดงหน้าจอ onboarding (`NotSeeded.jsx`)
   แทน — ข้อมูลตั้งต้นมีให้ที่ `seed/sop-document.json` (คำเตือนใน `seed/README.md`: อาจ stale ถ้าแอป Apps
   Script ต้นทางถูกแก้ไขหลังจากขุดข้อมูลนี้ออกมา ควร re-export จาก `<exec-url>?diag=sopdata` ถ้าไม่แน่ใจ)
6. **Process Flows ไม่ได้มาจากฐานข้อมูล** — เป็นข้อมูล static ที่ฝังในแอป (`src/data/flows.js`) ดังนั้นจึงแก้ไข
   ไม่ได้จากหน้า UI เลย (ไม่มีฟอร์มแก้ไขผัง) การเปลี่ยนแปลงต้องแก้ไฟล์และ deploy ใหม่เท่านั้น
7. **ไม่มีฟอร์ม sign-in ในโมดูลนี้** — การล็อกอินทั้งหมดอยู่ที่ portal กลาง โมดูลนี้มีแค่ลิงก์ส่งต่อ

**สิ่งที่ถูกเพิ่มเข้ามาใหม่ในระบบพอร์ต (ไม่มีในแอปต้นฉบับ):**

- **หน้า Version History** (`/versions`) — API เดิมมี endpoint versions ครบอยู่แล้วแต่ไม่เคยมี UI แสดงในแอป
  ต้นฉบับ (แอปเดิมชี้ผู้ใช้ไปดู "Google Doc's version history" ซึ่งไม่มีอยู่จริงหลัง migration) ถ้าไม่มีหน้านี้
  case ที่ถูกลบไปจะกู้คืนไม่ได้เลยจากตัวแอป
- **การลบแถวรายงาน** (`DELETE /api/sop/reports/:case`) — API มี endpoint นี้อยู่แล้วแต่ UI เดิมมีแค่ปุ่มเพิ่ม
  แถวเท่านั้น แถวที่พิมพ์ผิดจึงลบไม่ได้จนกว่าจะพอร์ตหน้าจอใหม่นี้เข้ามา
- **หน้าจอ NOT_SEEDED** เป็น onboarding screen ที่บอกผู้ใช้ว่า Process Flows ยังใช้งานได้ตามปกติ (เพราะไม่ได้
  พึ่งฐานข้อมูล) แทนที่จะแสดงเป็นหน้า error

---

*จัดทำจากการอ่านซอร์สโค้ดจริงทั้งหมดของโมดูลนี้ ครอบคลุมไฟล์ทุกไฟล์ใน `sop/src/`, `sop/PORT_NOTES.md`,
`api/src/routes/sop.js`, `supabase/migrations/006_sop.sql`, `docs/ACCESS_MODEL.md` และ `seed/README.md`*
