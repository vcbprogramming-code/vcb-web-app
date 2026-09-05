# Onboarding — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> อ้างอิงจากซอร์สโค้ดจริงที่ `FOR DEPLOYMENT TEAM/onboarding/` (React 18 + Vite 5 + React Router 6) และ API ที่ `FOR DEPLOYMENT TEAM/api/src/routes/onboarding.js` ปรับปรุงล่าสุดวันที่ 2026-09-05

## 1. ภาพรวมของโมดูล

Onboarding คือโปรแกรมปฐมนิเทศพนักงานใหม่ระยะ 90 วัน (Day 1-30 / Day 31-60 / Day 61-90) ของบริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด ผู้ใช้หลักคือ **พนักงานใหม่ที่ยังไม่มีบัญชีผู้ใช้ในระบบ** จึงเป็นโมดูลเดียวใน VCB Connect ที่ส่วนใหญ่ทำงานแบบ "ไม่ต้อง sign-in" (anonymous) โดยตั้งใจ — จะมีการ sign-in จริงเฉพาะหน้า Admin เท่านั้น

โครงสร้างเนื้อหาเดินตามลำดับ:

1. **Pre-boarding** (หน้า Home) — เกริ่นนำบริษัท, คำกล่าวจาก CEO, ค่านิยมองค์กร, ผังโครงสร้างองค์กร
2. **Required Documents** — เอกสาร 8 รายการที่ต้องกรอก/อัปโหลดก่อนวันแรกทำงาน
3. **Department Selection** — เลือกแผนกที่จะไปประจำใน 90 วันแรก (มี 5 แผนก)
4. **Day 1-30 / Day 31-60 / Day 61-90** — checklist 3 เฟสของแผนกที่เลือก แบ่งเป็น 3 บล็อกย่อยต่อเฟส (Required Reading / Knowledge Requirements / Required Outputs)
5. **Completion** — หน้าสรุปเมื่อจบครบ 90 วัน พร้อมใบรับรองที่พิมพ์ได้

มีหน้า **Admin** แยกต่างหาก สำหรับแก้ไข checklist และดูภาพรวมพนักงานทั้งคอฮอร์ต ซึ่งต้องยืนยันตัวตนจริง (sign-in) และมี role `portal.admin` เท่านั้น

---

## 2. ผังเส้นทาง (Routing) — `src/App.jsx`

จุดเริ่มต้นของแอปคือ `src/main.jsx` — mount React ด้วย `createRoot` (React 18) ภายใต้ `StrictMode` และครอบ provider ตามลำดับที่**กำหนดตายตัว**ดังนี้:

```
ThemeProvider → I18nProvider → AuthProvider → BrowserRouter → <App />
```

ลำดับนี้ไม่ใช่เรื่องบังเอิญ: `ThemeProvider` ต้องอยู่นอกสุดเพื่อแตะ `<html>` ก่อนหน้าจอวาดครั้งแรก, ตามด้วย `I18nProvider` เพื่อให้ข้อความที่ error ของ auth ต้องใช้พร้อมอยู่แล้ว, แล้วจึง `AuthProvider` ส่วน router อยู่ในสุดเพราะการจัดเส้นทางเป็นเรื่องของโมดูลนี้เอง ไม่ใช่ของ shared foundation

**สำคัญ**: `AuthProvider` รับ api instance **ตัวเดียวกัน**กับที่ `lib/onboardingApi.js` ใช้ — ถ้าเผลอเรียก `createApi()` ซ้ำอีกตัวที่นี่ คำขอทั้งหมดจะไม่มี token แนบไป และหน้า admin จะได้ 403 ทั้งที่ผู้ใช้ sign-in ถูกต้องแล้ว

การมี `AuthProvider` **ไม่ได้**แปลว่าโมดูลนี้บังคับ sign-in — เส้นทางเกือบทั้งหมดยังเป็น anonymous ตามเจตนา auth มีไว้สำหรับ 2 หน้าจอ admin เท่านั้น


| Path | หน้า | หมายเหตุ |
|---|---|---|
| `/` | Home.jsx | หน้าแรก (pre-boarding) |
| `/required-documents` | RequiredDocuments.jsx | เอกสาร + เลือกแผนก |
| `/completion` | CompletionPage.jsx | สรุปจบโปรแกรม + ใบรับรอง (`?print=1` สั่งพิมพ์อัตโนมัติ) |
| `/company-structure` | OrgChartPage.jsx | ผังองค์กรแบบเต็มหน้า |
| `/meet-our-team`, `/life-on-site` | MeetOurTeamPage.jsx, LifeOnSitePage.jsx | เนื้อหาเสริมหลังจบโปรแกรม |
| `/admin` | AdminPage.jsx | แก้ไข checklist + ดูคอฮอร์ต (ต้อง sign-in + role admin) |
| `/:pageKey` | PageResolver.jsx | catch-all — แยกเองว่าเป็นหน้า "แผนก" (`xxx-team`) หรือหน้า "เฟส" (`xxx-day-1-30`) |

**Logic การแยกเส้นทางใน `PageResolver.jsx`**: React Router ไม่สามารถ match สอง dynamic route ที่ความลึกเท่ากันพร้อมกันได้ (`/:deptSlug` กับ `/:deptPrefix-:dayRange`) จึงต้องรวมเป็น param เดียวแล้วแยกด้วยโค้ด — ถ้า `pageKey` ลงท้ายด้วย `-team` หรือเท่ากับ `property-asset-management` (กรณีพิเศษที่ไม่ตรง pattern) จะไปหน้า `DepartmentLanding`, ไม่งั้นไปหน้า `PhasePage`

---

## 3. ระบบระบุตัวตน (Identity) — ไม่ใช่ระบบสมาชิก

**ไฟล์หลัก**: `src/lib/identity.js`, `src/lib/useProgress.js`, `src/components/NameModal.jsx`

### 3.1 หลักการ

พนักงานใหม่ยังไม่มีบัญชีในวันแรก ระบบจึงใช้ **ชื่อที่พิมพ์เอง** เป็น "กุญแจ" แทน โดยเก็บไว้ใน `localStorage` ของเบราว์เซอร์ (คีย์ `vcb-employee-name`, `vcb-employee-department`, `vcb-employee-level`) — **นี่ไม่ใช่การยืนยันตัวตนที่ปลอดภัย** เป็นเพียงป้ายชื่อที่ผูกกับ record ฝั่งฐานข้อมูล ห้ามเพิ่มการบังคับ sign-in ให้กับ flow ของพนักงานเด็ดขาด เพราะจะปิดกั้นคนที่ระบบนี้สร้างมาเพื่อรองรับ

### 3.2 ฟังก์ชันเข้าถึงค่าใน localStorage (`src/lib/identity.js`)

ไฟล์นี้ทั้งไฟล์เป็นเพียงตัวห่อ (wrapper) ของ `localStorage` 3 คีย์ข้างต้น แบ่งเป็นคู่ get/set คีย์ละคู่:

| ฟังก์ชัน | คีย์ | หมายเหตุ |
|---|---|---|
| `getEmployeeName()` / `setEmployeeName(name)` | `vcb-employee-name` | คืน `null` เมื่อยังไม่เคยตั้งค่า |
| `getEmployeeDepartment()` / `setEmployeeDepartment(deptId)` | `vcb-employee-department` | เก็บเป็น `id` ของแผนก ไม่ใช่ชื่อที่แสดงผล |
| `getEmployeeLevel()` / `setEmployeeLevel(level)` | `vcb-employee-level` | **ตัว get บังคับค่าให้เป็น `'junior'` เสมอ** ถ้าค่าที่อ่านได้ไม่ใช่ `'senior'` พอดี (รวมถึงกรณีไม่มีค่าเลย) เพื่อไม่ให้ค่าขยะกลายเป็นการปลดล็อกงานระดับ Senior โดยไม่ตั้งใจ |

**ทุกฟังก์ชันครอบด้วย `try/catch` ทั้งหมด** เพราะ `localStorage` อาจโยน exception ได้จริงในโหมดไม่ระบุตัวตนหรือเบราว์เซอร์ที่บล็อก site data — ตัว get จะคืนค่าว่าง/ค่าเริ่มต้นแทนการทำให้หน้าจอพัง ส่วนตัว set จะเงียบไป (best-effort) ผลคือระบบยังใช้งานได้ในหน้าเดียว เพียงแต่ session ไม่รอดข้ามการรีโหลด — เป็นพฤติกรรมเดียวกับต้นฉบับ Apps Script

### 3.3 เมื่อไหร่ที่ระบบถามชื่อ (`NameModal`)

- ครั้งแรกที่พนักงานกดติ๊ก checkbox ใดๆ (ไม่ว่าจะเป็นเอกสารหรือ checklist ในเฟส) ระบบจะเปิด modal ถามชื่อ
- **ถ้าอยู่หน้า Required Documents** (ยังไม่รู้ว่าอยู่แผนกไหน) → ถามแค่ชื่ออย่างเดียว ไม่ถามแผนก (`askDepartment = false`)
- **ถ้าอยู่หน้าเฟสของแผนกใดแผนกหนึ่งแล้ว** (เช่น `/finance-day-1-30`) → ระบบรู้แผนกจาก URL อยู่แล้ว จึงแสดงช่องแผนกแบบ **ล็อกไว้ไม่ให้แก้** (pre-filled + disabled) เพื่อยืนยันเท่านั้น ไม่ใช่ให้เลือกใหม่

### 3.4 การสลับแผนก (Department Switch) — ป้องกันข้อมูลหาย

Logic ใน `useProgress.identify()`:

1. ถ้าพนักงานพยายามติ๊กงานของแผนก B ทั้งที่ตอนนี้บันทึกไว้เป็นแผนก A **และ** มีความคืบหน้าในแผนก A แล้วจริง (เช็คด้วย `hasStartedDepartment`) → ระบบ**จะไม่สลับให้ทันที** แต่ return ค่า `'confirm-switch'` กลับไปให้หน้าที่เรียกไปแสดง `DepartmentSwitchModal` ถามยืนยันก่อน
2. ถ้ายังไม่เคยเริ่มแผนกเดิมเลย (ไม่มีงานติ๊กแม้แต่ข้อเดียว) → สลับให้ทันทีโดยไม่ถาม เพราะไม่มีอะไรจะเสีย
3. เมื่อยืนยันสลับแล้ว (`switchDepartment` ใน `useProgress.js`) ระบบจะ**ลบความคืบหน้าของแผนกเดิมทั้งหมดออกจากหน้าจอทันที** (optimistic) และส่งคำขอไปที่ API เพื่อลบที่ฐานข้อมูลด้วย — ใช้ `getDepartmentTaskIds(deptId, 'senior')` เพื่อดึง task id **ทุกรายการที่เป็นไปได้ทั้งหมด** (รวม Senior-only) เพื่อไม่ให้เหลือรอยที่ยังไม่ถูกลบ

---

## 4. หน้า Home (Pre-boarding) — `src/pages/Home.jsx`

แสดงเนื้อหาต้อนรับ ไม่มี logic ซับซ้อน: hero พร้อมรูปพื้นหลัง, คำกล่าวจาก CEO, การ์ดค่านิยมองค์กร 4 ใบ, แถบภาพ "Our Track Record" ที่เลื่อนแนวนอนได้ (CSS scroll snap), ผังองค์กร (ฝังคอมโพเนนต์ `CompanyStructure`) และปุ่ม **"Continue to Required Documents"** ที่จัดกึ่งกลางหน้าจอ (ใช้ `text-center` ที่ div ครอบ เพราะ `CtaLink` เป็น `inline-block`)

---

## 5. Required Documents — `src/pages/RequiredDocuments.jsx`

### 5.1 รายการเอกสาร (8 รายการ, จาก `data/requiredDocuments.js`)

แต่ละเอกสารมีปุ่ม **Complete** (checkbox), **Download** (ถ้ามีลิงก์), และ **Upload**

### 5.2 Logic การ "เสร็จสิ้น" ของเอกสารหนึ่งรายการ

เอกสารจะถูกนับว่า "เสร็จ" เมื่อ task id รูปแบบ `doc::<docId>` ถูกติ๊กเป็น true — **ไม่ว่าจะติ๊ก Complete เอง หรืออัปโหลดไฟล์สำเร็จก็ตาม ทั้งสองทางเขียนไปที่ task id เดียวกัน** (ดู `handleUploaded` ที่เรียก `toggleTask` โดยอัตโนมัติเมื่ออัปโหลดสำเร็จ)

### 5.3 การอัปโหลดไฟล์ — `src/lib/useDocUpload.js`

ขั้นตอน:
1. ตรวจสอบไฟล์ฝั่ง client ก่อนส่งจริง 3 อย่าง: **นามสกุลไฟล์** ต้องอยู่ใน `pdf, jpg, jpeg, png, doc, docx`, **ขนาดไฟล์ต้องไม่เป็น 0**, และ **ขนาดต้องไม่เกิน 10MB** — เพราะ attribute `accept` ของ `<input type=file>` เป็นแค่ตัวกรองในกล่องเลือกไฟล์ ผู้ใช้เลือก "All Files" แล้วข้ามได้ จึงต้องเช็คจริงอีกที
2. เรียก `GET /api/onboarding/documents/:name/path?doc_id=&ext=` เพื่อขอ **presigned URL** สำหรับอัปโหลด (`uploadUrl`) และดาวน์โหลด (`downloadUrl`) — คีย์ของไฟล์ในระบบเก็บข้อมูลผูกกับ **ชื่อพนักงาน + docId + นามสกุลไฟล์** ไม่ใช่ชื่อไฟล์ที่อัปโหลด เพื่อให้อัปโหลดไฟล์ใหม่ทับของเดิมได้เสมอ (ไม่สร้างไฟล์ซ้ำที่แยกไม่ออก)
3. ส่งไฟล์ตรงไปที่ `uploadUrl` ด้วย `PUT` (ไม่ผ่าน Express) — เพื่อไม่ให้ไฟล์ขนาดใหญ่ค้าง worker ของ API นานเกินไป
4. เมื่อสำเร็จ จะบันทึก "ใบเสร็จ" (ชื่อไฟล์ + ลิงก์ดาวน์โหลด) ไว้ใน `localStorage` แยกตามชื่อพนักงาน (คีย์ `vcb-uploaded-docs::<ชื่อพนักงาน>`) เพื่อให้พนักงานเห็นว่าตัวเองเคยอัปโหลดอะไรไปแล้ว (ข้อมูลนี้เป็นแค่ตัวช่วยแสดงผล ไม่ใช่ต้นฉบับ — ต้นฉบับจริงอยู่ที่ระบบเก็บไฟล์)
5. ถ้า `uploadUrl` เป็น null (ระบบเก็บไฟล์ฝั่งเซิร์ฟเวอร์ยังไม่ตั้งค่า) จะแจ้ง error `doc.errorUploadUnavailable` ("กรุณาส่งเอกสารให้ฝ่ายบุคคลโดยตรง") แทนที่จะแกล้งทำเหมือนอัปโหลดสำเร็จ

### 5.4 Department Selection — การ์ดแผนก (rebuild ใหม่ล่าสุด)

การ์ดแต่ละแผนก (จาก `data/departments.js`'s `deptCard` field) ประกอบด้วย: **เลขลำดับ** (01-05), **ไอคอน** (จาก `components/deptIcons.jsx` — วาดเป็น SVG เส้นง่ายๆ 5 แบบ: `LedgerIcon`, `CoinIcon`, `PackageIcon`, `BuildingIcon`, `WrenchIcon` เรียกผ่านตัวเลือก `DeptIcon({ icon })` ที่แม็ปชื่อ string จากข้อมูลไปหาคอมโพเนนต์ และ**ถอยไปใช้ `PackageIcon` เมื่อชื่อไม่ตรงกับตัวใด** เพื่อไม่ให้การพิมพ์ชื่อไอคอนผิดทำให้การ์ดทั้งใบพัง ทั้ง 5 ตัวใช้ค่า `stroke`/`viewBox` ชุดเดียวกันและรับสีจาก `currentColor`), **ชื่อแผนก**, **คำอธิบายสั้น**, **"LED BY" (หัวหน้าแผนก)**, **"FOCUS" (จุดเน้นงาน)**, และปุ่ม **"Choose this department →"**

**ข้อสังเกตที่ตั้งใจไว้ ไม่ใช่บั๊ก**: การ์ดของแผนก "property" จะแสดงชื่อ "Asset Management Team" แต่ตำแหน่งอื่นในระบบ (เช่น หัวข้อหน้า) จะใช้ "Property & Asset Management" — เป็นความไม่สอดคล้องที่มีอยู่ในต้นฉบับ Apps Script เดิมจริง จึงคงไว้ตามเดิม

**Logic การกดเลือกแผนก**: ก่อน navigate ไปหน้าแผนก ระบบจะเช็ค `areRequiredDocsComplete(isTaskDone)` (ทุกเอกสารทั้ง 8 รายการต้องติ๊กครบ) — ถ้ายังไม่ครบจะเปิด `RequiredDocsGateModal` แสดงรายการเอกสารที่ยังขาดแทนการพาไปหน้าแผนกเลย

---

## 6. หน้าแผนก (Department Landing) — `src/pages/DepartmentLanding.jsx`

แสดงข้อมูลของแผนกที่เลือก: หัวหน้างาน (Meet Your Supervisor), ภาพรวมงาน (Overview + bullet points + คำคมท้ายหัวข้อ), ผัง ERP flow (รูปภาพคงที่), และลิงก์ไปยัง 3 เฟส (Day 1-30/31-60/61-90) ของแผนกนั้น — ไม่มี logic ที่ซับซ้อน เป็นการแสดงเนื้อหาคงที่จาก `data/<department>.js`

---

## 7. หน้าเฟส (Phase Page) — `src/pages/PhasePage.jsx` — หัวใจของระบบ checklist

นี่คือไฟล์ที่มี logic ซับซ้อนที่สุดในโมดูลนี้ มีหน้าที่หลายอย่างพร้อมกัน:

### 7.1 การไล่ระดับปลดล็อก (Phase Gating)

**หลักการสำคัญ**: หน้าเฟสที่ยัง "ล็อก" อยู่ **ไม่ได้ถูกซ่อนหรือบล็อกทั้งหน้า** — พนักงานยังอ่านเนื้อหาล่วงหน้าได้ตามปกติ มีเพียง **checkbox เท่านั้นที่กดไม่ได้** (disabled) พร้อมแบนเนอร์อธิบายเหตุผลด้านบน checklist

เงื่อนไขการปลดล็อก (`unlocked` ใน `PhasePage.jsx`):
```
unlocked = docsComplete && previousPhasesComplete
```
- `docsComplete` = เอกสารที่ต้องส่งครบ 8 รายการหรือยัง (`areRequiredDocsComplete`)
- `previousPhasesComplete` = ทุกเฟสก่อนหน้าในแผนกเดียวกัน ติ๊กครบทุกข้อที่ "มองเห็นได้" ตามระดับพนักงาน (junior/senior) หรือยัง

ถ้าล็อกอยู่ จะแสดงข้อความหนึ่งในสองแบบ ขึ้นกับสาเหตุ:
- เอกสารยังไม่ครบ → "Complete all Required Documents to unlock this phase."
- เฟสก่อนหน้ายังไม่จบ → "Complete the previous phase to unlock these tasks. You can still read everything below."

### 7.2 ระดับพนักงาน (Track: Junior / Senior)

แต่ละ checklist item มี field `level` — ถ้าเป็น `senior` จะไม่แสดงให้พนักงานระดับ junior เห็นเลย (`isItemVisible`) พนักงานสลับ track ได้เองด้วยปุ่ม toggle บนหน้า ซึ่งจะยิง `PATCH /api/onboarding/employees/:name` ไปอัปเดตที่ฐานข้อมูลด้วย

### 7.3 การติ๊ก Checkbox — Optimistic Update + Retry + Revert

Logic ใน `useProgress.toggleTask()`:
1. อัปเดตหน้าจอทันที (optimistic) ก่อนรอผลจาก API
2. ยิง `PUT /api/onboarding/progress/:name` — ถ้าล้มเหลวครั้งแรก **ลองซ้ำอีกหนึ่งครั้งอัตโนมัติ**
3. ถ้าล้มเหลวซ้ำอีก (ครั้งที่สอง) → **ย้อน checkbox กลับสภาพเดิม** และแสดง error message — เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าบันทึกสำเร็จทั้งที่จริงไม่สำเร็จ

### 7.4 Reward Toast — ข้อความให้กำลังใจ

ทุกครั้งที่ติ๊ก checkbox จาก "ยังไม่ทำ" เป็น "ทำแล้ว" (ไม่ใช่ตอนติ๊กออก) ระบบจะสุ่มแสดงข้อความให้กำลังใจแบบลอยชั่วคราว (toast) หนึ่งใน 5 ข้อความ: "Nice work!", "Great job!", "Keep it up!", "Well done!", "You're on track!" — แสดง 2.2 วินาทีแล้วหายไปเอง (`components/RewardToast.jsx`)

กลไกนี้ห่อไว้ในฮุก **`useRewardToast()`** (`src/components/RewardToast.jsx`) ซึ่งคืนออบเจ็กต์สองฟิลด์: `showReward()` สำหรับเรียกตอนติ๊กสำเร็จ และ `node` คือ JSX ของ toast ที่หน้าเรียกต้องนำไปวางใน tree เอง (`PhasePage.jsx` รับทั้งคู่ไปใช้) การแยก "ตัวสั่ง" ออกจาก "ตัวแสดง" แบบนี้ทำให้ตัวข้อความไม่ต้องผูกกับตำแหน่งใดในหน้า — toast จัดวางแบบ `fixed` จึงไม่กินพื้นที่ layout และไม่ทำให้เนื้อหาขยับตอนโผล่ ข้อความทั้ง 5 เก็บเป็นคีย์แปล (`content.niceWork` ฯลฯ) จึงเปลี่ยนภาษาตามระบบ i18n และตัวจับเวลาเก็บใน `useRef` พร้อม `clearTimeout` ก่อนตั้งใหม่ทุกครั้ง เพื่อไม่ให้การติ๊กรัวๆ ทำให้ toast หายเร็วกว่าที่ควร

### 7.5 ป๊อปอัปฉลอง — สองระดับ

- **จบเฟสหนึ่ง** (ยังไม่ใช่เฟสสุดท้าย): แสดง popup "Phase Complete" พร้อมปุ่มไปเฟสถัดไป หรือ "Stay on this page"
- **จบเฟสสุดท้าย (Day 61-90)**: แสดง popup ที่ใหญ่กว่า "90 Days Complete — Welcome, officially, to the team!" พร้อมปุ่ม **"Print Completion Form"** (นำไปหน้า Completion พร้อม query `?print=1` เพื่อสั่งพิมพ์อัตโนมัติ) และ **"Continue"** (นำไปหน้า Completion เฉยๆ)

ทั้งสอง popup มี logic กันไม่ให้ขึ้นซ้ำ: จะขึ้นเฉพาะ "ตอนที่เพิ่งเปลี่ยนจากยังไม่เสร็จ → เสร็จ" เท่านั้น (ตรวจด้วย `useRef` เก็บสถานะก่อนหน้า) ไม่ใช่ทุกครั้งที่กลับมาเปิดหน้าที่จบไปแล้ว

---

## 8. Completion Page — `src/pages/CompletionPage.jsx`

เข้าเงื่อนไขแสดงผลได้ก็ต่อเมื่อ **ทุกเฟสในทุกบล็อกของแผนกที่เลือก ติ๊กครบทั้งหมด** (ตามระดับ junior/senior ของพนักงานคนนั้น) ถ้ายังไม่ครบจะขึ้นข้อความ "Not finished yet" พร้อมลิงก์กลับไปหน้า checklist แทน

เมื่อจบจริง จะแสดง 2 การ์ดแนะนำเนื้อหาเสริม (Meet Our Team / Life on Site) และปุ่ม **"Print Completion Form"** ซึ่งเรียก `window.print()` — หน้านี้มีส่วน `<div className="hidden print:block">` ที่ซ่อนอยู่ปกติ แต่จะโผล่มาแทนหน้าจอปกติตอนสั่งพิมพ์ (component `CompletionCertificate`) เพื่อให้พิมพ์ออกมาเป็นใบรับรองล้วนๆ ไม่ติดเมนู/แถบข้าง

**Auto-print**: ถ้า URL มี query `?print=1` (มาจากปุ่มในป๊อปอัปจบโปรแกรม) หน้านี้จะเรียก `window.print()` ให้อัตโนมัติหลังโหลดเสร็จ 300ms แล้วลบ query param ออกทันที (เพื่อไม่ให้กด Back แล้วพิมพ์ซ้ำอีกรอบ)

---

## 9. แถบข้าง (Sidebar) — `src/components/Layout.jsx`

แถบซ้ายของทุกหน้า ประกอบด้วยจากบนลงล่าง:

1. ลิงก์กลับ Portal
2. โลโก้ VCB Onboarding
3. **แถบความคืบหน้าโดยรวม** (`components/ProgressBar.jsx`) — แสดงเฉพาะเมื่อพนักงานมีทั้งชื่อและแผนกแล้วเท่านั้น (ยังไม่มีข้อมูลจะไม่แสดงอะไรเลย) ข้อความ: "Your Onboarding Progress — <ชื่อ> (<แผนก>) NN%" พร้อมแถบเติมสีที่ **ค่อยๆ เลื่อนเข้าที่แบบ animation** (ไม่กระโดดทันที) และบรรทัดย่อย "X / Y tasks complete in your department"
4. **Journey Stepper** (`components/JourneyStepper.jsx`) — ทดแทนเมนูลิงก์แบบเรียบด้วยขั้นบันได 7 ขั้น: Pre-boarding → Required Documents → Department Selection → Day 1-30 → Day 31-60 → Day 61-90 → Completion โดยขั้นที่ 4-6 จะแสดงชื่อแผนกที่เลือกจริง และมี sub-step ย่อย (Reading / Knowledge / Outputs) ต่อเฟส
5. ปุ่ม Settings, ลิงก์ Admin, สถานะ sign-in

### Logic การคำนวณ % ความคืบหน้า (`components/ProgressBar.jsx` + `src/lib/departmentTasks.js`)

```
allIds = getDepartmentTaskIds(department, level)   // กรองตามระดับ junior/senior
done   = จำนวน id ใน allIds ที่ isTaskDone() = true
pct    = Math.round(done / allIds.length * 100)
```

**บั๊กที่แก้ไปแล้ว**: เดิมฟังก์ชัน `getDepartmentTaskIds` นับงานทุกข้อรวมถึงข้อที่เป็น Senior-only โดยไม่กรองตามระดับพนักงาน ทำให้พนักงานระดับ Junior ที่ทำงานครบทุกข้อที่ตัวเองต้องทำจริงแล้ว ยังติดอยู่ที่ต่ำกว่า 100% เพราะตัวหารนับงาน Senior-only ที่เขาไม่เคยถูกขอให้ทำด้วย — แก้แล้วโดยให้ฟังก์ชันรับพารามิเตอร์ `level` และกรองด้วย `isItemVisible` เหมือนกับทุกจุดคำนวณอื่นในระบบ

---

## 10. หน้า Admin — `src/pages/AdminPage.jsx`

### 10.1 การเข้าถึง

หน้านี้เป็น**ข้อยกเว้นเดียว**ที่ต้อง sign-in จริง ต้องมี role `portal.admin` (ผ่าน `useAuth()` จาก `@vcb/shared`) — ถ้ายังไม่ได้ sign-in หรือไม่มี role จะแสดงหน้า `AdminSignIn` แทนตัวแก้ไขทั้งหมด (ไม่โชว์แม้แต่ field เดียวก่อนผ่านเงื่อนไข)

**เหตุผลที่เปลี่ยนจากเดิม**: ระบบเดิมใช้รหัสผ่านเดียวที่แชร์กันทุก admin (เก็บในฟังก์ชันฐานข้อมูลแบบไม่มีตัวตนผู้ใช้ผูกไว้) — ปัจจุบันแทนที่ด้วยการ sign-in จริงผ่าน JWT และเช็ค role ที่ API ทุกครั้งที่บันทึก (`requireAuth + requireRole('portal','admin')`) ฝั่งหน้าจอเป็นเพียงมารยาทไม่ให้กรอกฟอร์มที่สุดท้ายจะโดนปฏิเสธ ตัวเช็คจริงอยู่ที่ API เสมอ

### 10.2 ตัวแก้ไข Checklist

เลือก แผนก → เฟส → บล็อก (3 ระดับ แบบแท็บ) แล้วแสดงรายการ item ของบล็อกนั้น พร้อมปุ่ม:

- **แก้ไขข้อความ** ของแต่ละ item (`AdminItemRow.jsx`)
- **ลบ** (soft-delete — ไม่ได้ลบจริง แต่ตั้ง flag `deleted`)
- **เลื่อนขึ้น/ลง** (`moveItem`) — เมื่อเลื่อน จะคำนวณลำดับใหม่ให้ **ทุก item ในบล็อกนั้น** ไม่ใช่แค่สองตัวที่สลับกัน (ใช้ค่าห่างกัน 1000 ต่อขั้น เพื่อเผื่อแทรกทีหลัง)
- **เพิ่มรายการใหม่** (`addNewItem`) — ถามข้อความผ่าน `window.prompt()` แล้วสร้าง id ใหม่แบบ `admin-<timestamp>-<เลขสุ่ม>`

การแก้ไขทั้งหมดเป็น "override" ที่ซ้อนทับเนื้อหา checklist ต้นฉบับที่ hardcode ไว้ในโค้ด (`data/*.js`) ไม่ได้แก้ไฟล์ต้นฉบับโดยตรง — พนักงานทุกคนที่โหลดหน้าเฟสจะได้เห็นเนื้อหาที่ผ่านการ override แล้วเสมอ (การอ่าน override เป็น anonymous ทำได้โดยไม่ต้อง sign-in)

### 10.3 ภาพรวมคอฮอร์ต (`components/AdminCohort.jsx`)

ตารางแสดงพนักงานทุกคนที่เคยลงทะเบียน: ชื่อ, แผนก, ระดับ (junior/senior), จำนวนงานที่ทำเสร็จ (พร้อมแถบสัดส่วนเทียบกับคนที่ทำเยอะที่สุดในคอฮอร์ต — ไม่ใช่เปอร์เซ็นต์จริง เพราะ API ไม่รู้ว่าแผนกนั้นมีงานทั้งหมดกี่ข้อ), วันที่เริ่ม — ดึงจาก `GET /api/onboarding/admin/employees`

---

## 11. Endpoint API ทั้งหมดที่โมดูลนี้เรียกใช้ (`src/lib/onboardingApi.js`)

| Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| POST | `/api/onboarding/employees` | anonymous | สร้าง/อัปเดตข้อมูลพนักงาน (upsert) |
| GET | `/api/onboarding/employees/:name` | anonymous | ดึงข้อมูลพนักงานคนหนึ่ง |
| PATCH | `/api/onboarding/employees/:name` | anonymous | แก้ไขบางฟิลด์ (แผนก/ระดับ) โดยไม่กระทบฟิลด์อื่น |
| POST | `/api/onboarding/employees/:name/rename` | anonymous | แก้ชื่อที่พิมพ์ผิด — รวมความคืบหน้าเดิมเข้าด้วยกันในธุรกรรมเดียว |
| POST | `/api/onboarding/employees/:name/department` | anonymous | สลับแผนก + ล้างความคืบหน้าแผนกเดิม |
| GET | `/api/onboarding/progress/:name` | anonymous | ดึงรายการงานที่ทำเสร็จแล้ว (404 = พนักงานใหม่ ไม่ใช่ error) |
| PUT | `/api/onboarding/progress/:name` | anonymous | ติ๊ก/ยกเลิกติ๊กหนึ่งข้อ |
| POST | `/api/onboarding/progress/:name/batch` | anonymous | บันทึกหลายข้อพร้อมกันในธุรกรรมเดียว |
| GET | `/api/onboarding/checklist` | anonymous | รายการ override ทั้งหมด (ทุกคนอ่านได้) |
| PUT | `/api/onboarding/checklist` | **portal admin** | บันทึก override หนึ่งรายการ |
| DELETE | `/api/onboarding/checklist/:itemId` | **portal admin** | soft-delete override หนึ่งรายการ |
| GET | `/api/onboarding/documents/:name/path` | anonymous | ขอ presigned URL อัปโหลด/ดาวน์โหลดเอกสาร |
| GET | `/api/onboarding/admin/employees` | **portal admin** | รายชื่อพนักงานทั้งคอฮอร์ตพร้อมความคืบหน้า |

**ทำไมส่วนใหญ่เป็น anonymous**: เพราะผู้ใช้หลักคือพนักงานใหม่ที่ยังไม่มีบัญชี การบังคับ sign-in ก่อนใช้งานจะปิดกั้นคนกลุ่มนี้โดยตรง — ทุกคำขอแบบ anonymous จะถูกจำกัดขอบเขตไว้ที่ record ของพนักงานคนเดียวที่ระบุชื่อมาเท่านั้น

### 11.1 ฟังก์ชัน JS ที่ห่อแต่ละ endpoint

ไฟล์นี้ไม่มี logic ทางธุรกิจของตัวเอง — เป็นชั้นห่อบางๆ หนึ่งฟังก์ชันต่อหนึ่ง endpoint เพื่อให้ทั้งโมดูลเรียกผ่านจุดเดียว และเพื่อให้ `AuthProvider` ต่อ token เข้ากับ `api` instance ตัวเดียวได้ (ดูข้อ 2)

| ฟังก์ชัน | เรียก endpoint | ใช้ที่ |
|---|---|---|
| `saveEmployee({ name, department, level })` | POST `/employees` | `useProgress.identify()` ตอนพนักงานกรอกชื่อครั้งแรก |
| `getEmployee(name, { signal })` | GET `/employees/:name` | โหลดแผนก/ระดับที่บันทึกไว้กลับมาตอนเปิดหน้าใหม่ |
| `updateEmployee(name, patch)` | PATCH `/employees/:name` | ปุ่มสลับ Junior/Senior และการตั้งแผนกทีหลัง — ฟิลด์ที่ไม่ส่งไปจะคงของเดิม **ไม่ถูกล้างเป็นค่าว่าง** |
| `renameEmployee(from, to)` | POST `/employees/:name/rename` | ยังไม่มีหน้าจอเรียกใช้ (ดูข้อ 17) |
| `switchDepartment(name, department, clearTaskIds)` | POST `/employees/:name/department` | `useProgress.switchDepartment()` — ดูข้อ 3.4 |
| `getProgress(name, { signal })` | GET `/progress/:name` | โหลดรายการงานที่ติ๊กแล้วตอนเปิดแอป |
| `setTaskDone(name, taskId, completed)` | PUT `/progress/:name` | ติ๊ก/ยกเลิกติ๊กหนึ่งข้อ (ข้อ 7.3) |
| `setTasksDone(name, tasks)` | POST `/progress/:name/batch` | บันทึกหลายข้อพร้อมกันในธุรกรรมเดียว |
| `listChecklistOverrides({ pageKey, signal })` | GET `/checklist` | `useChecklistOverrides()` — anonymous |
| `saveChecklistOverride(itemId, fields)` | PUT `/checklist` | หน้า Admin (ต้องมี role) |
| `deleteChecklistOverride(itemId)` | DELETE `/checklist/:itemId` | หน้า Admin — soft-delete |
| `getDocumentPath(name, docId, ext, { signal })` | GET `/documents/:name/path` | `useDocUpload()` — ขอ presigned URL (ข้อ 5.3) |
| `listAdminEmployees({ signal })` | GET `/admin/employees` | `AdminCohort.jsx` (ต้องมี role) |

รายละเอียดที่มีผลจริงและไม่ควรแก้:

- **ชื่อพนักงานถูก `encodeURIComponent` ทุกจุดที่ใส่ลง URL** (ตัวช่วย `seg()` ภายในไฟล์) — เพราะชื่อคือ primary key และเดินทางอยู่ใน path ชื่อไทยหรือชื่อที่มีเว้นวรรคซึ่งไม่ได้ encode จะไปชนกับ record คนละแถวแบบเงียบๆ (ได้ 404 โดยไม่มีสัญญาณว่าผิดตรงไหน)
- **`getProgress` คืน 404 สำหรับชื่อที่ยังไม่เคยมี ถือเป็นคำตอบที่ถูกต้อง ไม่ใช่ error** — ผู้เรียกต้องแยกด้วย `err.status === 404` เพื่อแสดงสถานะ "พนักงานใหม่" ไม่ใช่ "โหลดไม่สำเร็จ" (สองกรณีนี้แสดงผลต่างกันคนละแบบ)
- **`listChecklistOverrides` ดึงแถวที่ถูก soft-delete มาด้วย** โดยตั้งใจ — ฝั่งหน้าจอต้องเห็นแถวนั้นจึงจะรู้ว่าต้องซ่อน item ที่ hardcode ไว้ทับ (ดูข้อ 15.2)
- **`getDocumentPath` ตั้งคีย์จาก ชื่อ + docId + นามสกุล ไม่ใช่ชื่อไฟล์** จึงอัปโหลดทับของเดิมได้เสมอ ไฟล์นี้ยัง export ค่าคงที่ `MAX_DOC_UPLOAD_BYTES` (10MB) และ `ALLOWED_DOC_EXTENSIONS` ที่ `useDocUpload` ใช้ตรวจฝั่ง client โดยล้อกับค่าเดียวกันที่ API

---

## 12. ผังองค์กร (Org Chart) — `src/components/orgchart/`

ประกอบด้วย `CompanyStructure.jsx` (ฝังในหน้า Home), `OrgChart.jsx`, `GroupStructure.jsx`, `TreeNode.jsx` — แสดงผังองค์กรแบบต้นไม้ (tree) จากข้อมูลคงที่ใน `data/orgChart.js` เส้นเชื่อมแบบ tree-connector วาดด้วย CSS `::before` pseudo-element (ไม่ใช้ library วาดกราฟ ตาม TECH_STACK.md ที่ห้ามใช้ chart library)

### 12.1 ตัวครอบและการสลับมุมมอง — `CompanyStructure.jsx`

เป็นคอมโพเนนต์ชั้นนอกสุด ประกอบด้วยแท็บแบบ pill 2 อัน (**Chart** / **Group**), คำอธิบายใต้แท็บที่**เปลี่ยนตามมุมมอง** และตัวผังจริงที่เลือกแสดงตาม state `view`

- **Chart** → `<OrgChart />` ผังพนักงานภายในบริษัท
- **Group** → `<GroupStructure />` ตำแหน่งของ VCB ในกลุ่มวิจิตรภัณฑ์

**เหตุผลที่แยกคำอธิบายเป็นคนละชุดต่อมุมมอง ไม่ใช้ประโยคร่วม**: บันทึกใน `content.html` ต้นฉบับระบุว่า คำอธิบายร่วมกันอ่านแล้วผิดในมุมมอง Group เพราะประโยคชวนให้ "กดที่ Leadership" ทั้งที่ผัง Group ไม่มีอะไรให้กด — จึงแยกเป็น `org.chartHint` / `org.groupHint`

**เหตุผลที่ฝังอยู่ในหน้า Home ไม่ใช่ลิงก์ออกไปหน้าอื่น**: ต้นฉบับระบุไว้ตรงๆ ว่า "embed it, don't navigate to it" — พนักงานที่กำลังอ่านหน้า Home ไม่ควรต้องกดออกจากหน้าแล้วเสียตำแหน่งที่อ่านค้างไว้

### 12.2 หน่วยย่อยที่ประกอบเป็นต้นไม้ — `TreeNode.jsx`

ไฟล์เดียวนี้ export คอมโพเนนต์ 4 ตัวที่ผังทั้งหมดสร้างขึ้นจากมัน:

| คอมโพเนนต์ | หน้าที่ |
|---|---|
| `TreeNode({ label, meta, children, defaultOpen })` | กล่องหนึ่งกล่องในต้นไม้ พร้อมความสามารถพับ/กาง — เก็บสถานะเปิด-ปิดด้วย `useState` ของตัวเอง ถ้าไม่มี `children` ปุ่มจะถูก `disabled` และไม่มี `aria-expanded` (ใบสุดท้ายของกิ่ง ไม่ใช่ปุ่มที่กดแล้วไม่เกิดอะไร) `meta` คือบรรทัดเล็กใต้ชื่อ ใช้แสดงจำนวนแผนกของแต่ละโครงการ |
| `TreeRow({ children })` | แถวแนวนอนของ node ระดับเดียวกัน — ทำหน้าที่แค่ใส่คลาส `.tree-row` ซึ่งเป็นตัวที่ CSS ใช้ยึดวาดเส้นเชื่อม |
| `PersonCard({ person })` | การ์ดคนหนึ่งคน: วงกลม **อักษรย่อ** + ชื่อ กดแล้วกางบรรทัดตำแหน่งงาน (`person.role`) ออกมาด้านล่าง ถ้าคนนั้นไม่มีข้อมูลตำแหน่ง การ์ดจะกดไม่ได้ |
| `PersonGrid({ children })` | กริดของ `PersonCard` แบบ auto-fill (ขั้นต่ำคอลัมน์ละ 150px, กว้างรวมไม่เกิน 500px) ใช้ซ้ำทุกจุดที่ต้องแสดง "กลุ่มคน" |

**อักษรย่อใน `PersonCard`** คำนวณสดจากชื่อ: ตัด `Mr.` / `Mrs.` / `Ms.` นำหน้าออกก่อน แล้วเอาอักษรแรกของสองคำแรก — ไม่ต้องเก็บฟิลด์เพิ่มใน `data/orgChart.js` และไม่ต้องใช้รูปถ่าย

**เส้นเชื่อมวาดด้วย CSS ไม่ใช่ JavaScript — และนี่คือความตั้งใจที่ต่างจากต้นฉบับ**: แอปเดิมวัดตำแหน่ง DOM ด้วย `getBoundingClientRect()` ใหม่ทุกครั้งที่ state เปลี่ยน เพื่อจัดตำแหน่ง div ที่ทำหน้าที่เป็นเส้น ซึ่งเป็นจุดที่เปราะที่สุดของแอปเดิม (KNOWN_ISSUES.md ของต้นฉบับบันทึกว่าแก้บั๊กจุดนี้ไปกว่า 5 รอบ) และขัดกับโมเดลการ render ของ React ฉบับพอร์ตนี้ใช้ `::before` บนสาม selector แทน (ก้านลงจากพ่อแม่, คานนอนของแถว, ก้านลงหาลูกแต่ละตัว) เส้นจึงจัดตำแหน่งใหม่เองฟรีทุกครั้งที่ re-render โดยไม่มี JS สักบรรทัด — กฎเหล่านี้ต้องอยู่ใน `index.css` (`.tree-children` / `.tree-row`) ไม่ใช่ utility class เพราะ selector อย่าง `.tree-row > *::before` จัดสไตล์ให้ลูกที่คอมโพเนนต์นี้ไม่ได้เป็นคนสร้าง — Tailwind เขียนแทนไม่ได้จริง

### 12.3 ผังพนักงาน — `OrgChart.jsx`

ประกอบต้นไม้จาก 4 ชุดข้อมูลใน `data/orgChart.js` เป็น 3 กิ่งใหญ่ที่**กางไว้ตั้งแต่แรก** (`defaultOpen`):

1. **Leadership** (`LEADERSHIP`) — แต่ละระดับชั้นเป็น `TreeNode` หนึ่งอัน ข้างในเป็น `PersonGrid`
2. **Head Office** (`DEPARTMENTS_ORG` + `ADMINISTRATION`) — แผนกที่มีฟิลด์ `branches` จะแตกลงไปอีกชั้นเป็น `TreeNode` ซ้อน (กรณีสาย Asset Management) ส่วนแผนกที่ไม่มีจะลงเป็น `PersonGrid` ตรงๆ สาขาที่เป็น `offsite` จะต่อท้ายชื่อด้วยสถานที่ในวงเล็บ
3. **Project Sites** (`PROJECT_MANAGERS`) — หนึ่ง `TreeNode` ต่อหนึ่งโครงการ ข้างในไม่ใช่ต้นไม้ธรรมดาแต่เป็น **ตารางสองคอลัมน์**: หัวหน้าโครงการ (มีป้าย **PM**) อยู่บนสุด แล้วแยกเป็น *Site Operations* กับ *Site Administration* วางเคียงกันบนจอกว้าง และ**ซ้อนกันลงมาบนจอแคบพร้อมซ่อนเส้นคั่นกลาง** เพราะเส้นคั่นแนวตั้งไม่มีความหมายเมื่อสองฝั่งไม่ได้อยู่เคียงกันแล้ว

ชื่อกิ่งใหญ่ใช้ `t()` (คีย์ `org.*`) ส่วนชื่อแผนก/สาขา/โครงการที่มาจากข้อมูลใช้ `tc()` ตามสะพานแปลเนื้อหาในข้อ 14.2

### 12.4 ผังกลุ่มบริษัท — `GroupStructure.jsx`

มุมมอง **Group** แสดงตำแหน่งของวิจิตรภัณฑ์ก่อสร้างในกลุ่มวิจิตรภัณฑ์: ผู้ถือหุ้น (ตระกูลชวนานนท์) → บริษัทในตระกูล → ตัว VCB เอง (การ์ดกรอบหนาสีเน้น อยู่**กึ่งกลาง**โดยการแบ่งรายชื่อบริษัทในตระกูลครึ่งซ้ายครึ่งขวาด้วย `Math.ceil(length / 2)`) แล้วต่อด้วยแถบล่างสองแถว: **Subsidiaries** และ **Joint Ventures**

- บริษัทในตระกูล (`FamilyCompanyCard`) ใช้**กรอบเส้นประ** ต่างจากการ์ดอื่น เพื่อสื่อว่าไม่ได้อยู่ในโครงสร้างองค์กรของ VCB เอง คำอธิบายเพิ่มเติมโผล่เป็น tooltip
- **tooltip นี้ทำด้วย CSS ล้วน** (`group-hover` / `group-focus-within`) ไม่ใช้ React state — เป็นการแสดงผลล้วนๆ และวิธีนี้ยังเข้าถึงได้ด้วยคีย์บอร์ด (การ์ดมี `tabIndex={0}`) โดยไม่ต้อง set state ใหม่ทุกครั้งที่เมาส์ขยับ
- การ์ด JV (`JvCard`) แสดงชื่อกิจการร่วมค้าพร้อมรายชื่อบริษัทแม่ที่ join ด้วย `&`

ทั้งสองคอมโพเนนต์นี้เป็น helper ภายในไฟล์ ไม่ได้ export ออกไป

### 12.5 หน้าเต็มจอ

หน้า `/company-structure` (`src/pages/OrgChartPage.jsx`) แสดงผังเดียวกันแบบเต็มหน้า — แต่ **ไม่มีเมนูนำทางไปหน้านี้** โดยเจตนา เพราะแอปต้นฉบับก็ไม่มีหน้าแยก ผังองค์กรของต้นฉบับอยู่ในหน้า Home เท่านั้น เส้นทางนี้จึงเข้าถึงได้ด้วยการพิมพ์ URL เอง

---

## 13. โครงสร้างข้อมูลเนื้อหา (Content Data Model)

เนื้อหาทั้งหมดของโมดูลนี้เป็น **ข้อมูลคงที่ที่ hardcode ไว้ในโค้ด** (ไม่ได้อยู่ในฐานข้อมูล) — ฐานข้อมูลเก็บเฉพาะ "ใครทำอะไรเสร็จแล้ว" กับ "override ที่ admin แก้" เท่านั้น

### 13.1 นิยามชนิดข้อมูล — `src/data/types.js`

TECH_STACK.md ห้ามใช้ TypeScript จึงเขียนเป็น JSDoc typedef แทน (ช่วยเรื่อง autocomplete ในเอดิเตอร์ แต่ไม่มีการ compile และไม่มีทางทำให้ build ล้มเหลว) โครงสร้างหลัก:

| Type | ฟิลด์ |
|---|---|
| `EmployeeLevel` | `'junior'` \| `'senior'` |
| `ChecklistItem` | `id` (ถาวร), `text`, `level?` (ถ้าไม่ระบุ = ทุกคนเห็น) |
| `ChecklistBlock` | `heading`, `items[]`, `sub?` |

> **กฎที่ห้ามละเมิด**: `id` ของ checklist item เป็นค่าถาวร — **ห้ามเปลี่ยนหรือนำกลับมาใช้ซ้ำเด็ดขาด** เมื่อมีพนักงานเคยติ๊กไปแล้ว เพราะตาราง `onboarding.progress` อ้างอิงด้วย id นี้ การเปลี่ยน id จะทำให้ความคืบหน้าที่บันทึกไว้หลุดออกจากงานที่มันเป็นเจ้าของโดยไม่มีสัญญาณเตือน — ส่วนการ**แก้ข้อความ (`text`) ปลอดภัยเสมอ** ซึ่งเป็นเหตุผลที่แยก id ออกมาเป็นฟิลด์ต่างหากตั้งแต่แรก

### 13.2 ทะเบียนแผนก — `src/data/allDepartments.js`

`ALL_DEPARTMENTS` ผูก 3 อย่างเข้าด้วยกันต่อหนึ่งแผนก: `id`, `landingPageKey` (คีย์ URL หน้าแผนก), `phasePrefix` (คำนำหน้าคีย์หน้าเฟส) และ `content` (เนื้อหาจริง) — จำเป็นต้องเขียน `landingPageKey` ออกมาตรงๆ ทีละแผนก เพราะแผนก property ใช้คีย์ `property-asset-management` ซึ่งไม่ตรงรูปแบบ `<id>-team` ที่แผนกอื่นใช้

มีฟังก์ชันช่วยค้นหา: `getDepartmentByLandingKey()` และ `getDepartmentByPhasePrefix()`

### 13.3 เนื้อหาแต่ละแผนก — `accounting.js`, `finance.js`, `procurement.js`, `property.js`, `engineering.js`

แต่ละไฟล์ export ออบเจ็กต์เดียวที่พอร์ตมาจาก `content.html` ของต้นฉบับแบบคำต่อคำ โครงสร้าง:

```
{
  eyebrow, title,
  supervisor,        // ข้อความแนะนำหัวหน้างาน
  overview[],        // ย่อหน้าภาพรวม
  bullets[],         // หัวข้อย่อยของงานหลัก
  footerQuote,       // คำคมปิดท้ายหัวข้อ
  workflow[],        // ย่อหน้าอธิบายกระบวนการ ERP
  phases[] {         // 3 เฟส
    dayRange,        // 'day-1-30' | 'day-31-60' | 'day-61-90'
    page {
      eyebrow, title,
      blocks[] {     // 3 บล็อก: Required Reading / Knowledge Requirements / Required Outputs
        heading,
        items[] { id, text, level? }
      },
      closing?, nextPhasePage?
    }
  }
}
```

### 13.4 เนื้อหาหน้าอื่น

| ไฟล์ | export | ใช้ที่ |
|---|---|---|
| `data/requiredDocuments.js` | `REQUIRED_DOCUMENTS` (8 รายการ) | หน้า Required Documents |
| `data/home.js` | `HOME_HERO`, `CEO_QUOTE`, `CULTURE_VALUES`, `TRACK_RECORD_SLIDES` | หน้า Home |
| `data/gallery.js` | `MEET_OUR_TEAM`, `LIFE_ON_SITE` | หน้าเนื้อหาเสริมหลังจบโปรแกรม |
| `data/orgChart.js` | ข้อมูลผังองค์กร | คอมโพเนนต์ orgchart |
| `data/departments.js` | `DEPARTMENTS` (รายชื่อ + `deptCard`) | dropdown เลือกแผนก + การ์ดเลือกแผนก |

---

## 14. ระบบ i18n และการแปลเนื้อหา

### 14.1 `src/i18n.js` — พจนานุกรม UI

ใช้ `createDictionary()` เก็บคีย์แบบจุด (dot key) ที่มีค่า `{ th, en }` ภาษาไทยมาก่อน merge ทับ `commonDictionary` ของ `@vcb/shared` — ข้อความภาษาไทยทั้ง **481 รายการ** ถูกยกมาจากระบบเดิมแบบ byte-for-byte และตรวจสอบด้วยโปรแกรม ไม่มีการพิมพ์ใหม่หรือแปลใหม่

**ภาษาเริ่มต้นคือภาษาไทย** และค่า theme/ภาษาใช้คีย์ร่วมกับทุกโมดูล (`vcb_lang` / `vcb_theme`) เพื่อให้การตั้งค่าติดตามผู้ใช้ข้ามแอป

### 14.2 `src/lib/contentText.js` — สะพานแปลเนื้อหา (`tc()`)

เนื้อหาแผนกทั้งหมดใน `src/data/` เป็นภาษาอังกฤษที่เก็บเป็น **ข้อมูล** ไม่ใช่คีย์แปล การเขียนใหม่เป็น dot key ทั้งหมดจะต้องแก้หลายพันบรรทัดโดยไม่ได้ประโยชน์เชิงพฤติกรรม จึงใช้ `tc()` เป็นตัวกลาง: รับข้อความอังกฤษ → ค้นคีย์จาก `CONTENT_KEY_BY_EN` → แปลด้วยคีย์นั้น ถ้าไม่พบคีย์จะคืนข้อความเดิม (ซึ่งเป็นพฤติกรรมเดียวกับ `t()` แบบเก่า และอ่านรู้เรื่องอยู่แล้วเพราะเป็นประโยคอังกฤษเต็ม)

ไฟล์นี้ export 2 อย่างที่ทำงานคู่กัน:

| ฟังก์ชัน | รูปแบบ | หมายเหตุ |
|---|---|---|
| `translateContent(t, text)` | ฟังก์ชันธรรมดา รับ `t` เข้ามาเอง | ตัวตรรกะจริง: `text` เป็น `null` คืนสตริงว่าง, ไม่พบคีย์คืนข้อความเดิม, **และถ้าแปลแล้วได้ค่าเท่ากับตัวคีย์เอง ก็คืนข้อความอังกฤษเดิมเช่นกัน** เพราะ `translate()` ของ shared คืนคีย์กลับมาเมื่อไม่มีรายการแปล — การโชว์ `content.someKey` ให้พนักงานอ่านแย่กว่าโชว์ภาษาอังกฤษ |
| `useContentText()` | ฮุก — `const tc = useContentText()` | ดึง `t` จาก `useI18n()` ให้เอง แล้วห่อ `translateContent` ไว้ใน `useCallback` ที่ผูกกับ `t` เท่านั้น **ตัว callback จึงคงที่ข้าม render** ใส่ใน dependency array ของ `useEffect` ได้โดยไม่ทำให้ effect ทำงานซ้ำทุกรอบ |

`useContentText()` คือรูปแบบที่ทุกจุดในโมดูลเรียกใช้จริง (หน้าเนื้อหา, ผังองค์กร, การ์ดแผนก) ส่วน `translateContent()` เปิดไว้สำหรับจุดที่ไม่ได้อยู่ในบริบทของ React component

> **สำหรับ UI ใหม่ให้ใช้ dot key ผ่าน `t()` โดยตรง** — `tc()` มีไว้สำหรับเนื้อหาที่ย้ายมาเท่านั้น ไม่ใช่วิธีแปลทั่วไปของระบบ

---

## 15. ระบบ Override เนื้อหา checklist

### 15.1 หลักการ

Admin แก้ checklist ได้โดย**ไม่แก้ไฟล์โค้ด** — การแก้ทุกอย่างถูกเก็บเป็นแถว "override" ในฐานข้อมูล แล้วนำมา**ซ้อนทับ**เนื้อหา baseline ตอน render (`src/lib/applyOverrides.js`) ทุกครั้ง บล็อกที่ไม่มี override ใดๆ จะทำงานเหมือน baseline ทุกประการ

### 15.2 `applyOverridesToBlock()` — Logic การซ้อนทับ

ทำ 4 อย่างในลำดับนี้:

1. **ลบรายการที่ถูก soft-delete** — กรอง item ที่ `overrides[id].deleted === true` ออก
2. **แก้ไขรายการเดิมในตำแหน่งเดิม** — ถ้ามี override ตรง id จะแทนที่ `text` และ `level` (ใช้ `??` ดังนั้นค่าที่ไม่ได้ระบุจะคงของเดิมไว้)
3. **เพิ่มรายการใหม่ล้วน** — override ที่มี `pageKey`/`blockIndex` ตรงกับบล็อกนี้ แต่ id ไม่ตรงกับ item ใดใน baseline เลย = รายการที่ admin สร้างขึ้นใหม่
4. **จัดลำดับใหม่** — ถ้ามี item ใดมี `_order` กำหนดไว้ จะ sort ทั้งบล็อก (item ที่ไม่มี order ไปอยู่ท้ายสุดด้วย `MAX_SAFE_INTEGER`)

### 15.3 `useChecklistOverrides()` — hook โหลด/บันทึก override (`src/lib/useChecklistOverrides.js`)

- **การอ่านเป็น anonymous** — พนักงานทุกคนโหลด override มาใช้โดยไม่ต้อง sign-in
- **การเขียนต้องมี role `portal.admin`** — `saveItem()` / `deleteItem()` จะได้ 403 จาก API ถ้าไม่มีสิทธิ์
- ถ้าโหลด override ไม่สำเร็จ จะ**ไม่ทำให้หน้าว่าง** — ยังตั้ง `loaded = true` และแสดง baseline ที่อยู่ใน bundle อยู่แล้ว พร้อม error `admin.overridesLoadFailed` เพราะ override เป็นแค่ชั้นซ้อนทับ ไม่ใช่เนื้อหาหลัก
- ทุกครั้งที่บันทึกสำเร็จจะ `reload()` ใหม่ทั้งชุด

### 15.4 `src/lib/requiredDocsGate.js` — ประตูกั้นเอกสาร

```js
areRequiredDocsComplete(isTaskDone)  // ทุกเอกสารใน REQUIRED_DOCUMENTS ติ๊ก doc::<id> ครบหรือยัง
missingRequiredDocs(isTaskDone)      // คืนรายการเอกสารที่ยังขาด (ใช้แสดงใน modal)
```

ถูกเรียกใช้ 2 จุดโดยตั้งใจให้ซ้ำซ้อนกัน: (1) ตอนกดเลือกแผนก และ (2) ตอนเช็คว่าเฟสแรกของแผนกปลดล็อกหรือยัง — เพื่อให้คนที่พิมพ์ URL เข้าหน้าเฟสตรงๆ ก็ยังติดประตูเดียวกัน

---

## 16. คอมโพเนนต์ประกอบอื่น

| ไฟล์ | หน้าที่ |
|---|---|
| `components/ui.jsx` | primitive ที่ใช้ร่วมกัน: `Page`, `PageTitle`, `Eyebrow`, `Section`, `CtaLink`, `CtaButton`, `ErrorBanner`, `Notice` (เขียนเองทั้งหมด ไม่ใช้ UI kit ตาม TECH_STACK.md) |
| `components/AdminSignIn.jsx` | หน้าจอขอ sign-in สำหรับหน้า Admin — รับ prop `missingRole` เพื่อแยกข้อความระหว่าง "ยังไม่ได้เข้าสู่ระบบ" กับ "เข้าสู่ระบบแล้วแต่ไม่มีสิทธิ์" |
| `components/DepartmentSwitchModal.jsx` | กล่องยืนยันก่อนสลับแผนก (เตือนว่าความคืบหน้าแผนกเดิมจะถูกลบ) |
| `components/RequiredDocsGateModal.jsx` | กล่องแจ้งเตือนเมื่อพยายามเลือกแผนกก่อนส่งเอกสารครบ พร้อมแสดงรายการเอกสารที่ยังขาด |
| `components/CompletionCertificate.jsx` | ใบรับรองสำหรับพิมพ์ — หนึ่งแถวต่อหนึ่งงาน (ทุกเอกสาร + ทุกงานในทุกเฟส) พร้อมช่องให้ผู้บังคับบัญชาวงคะแนน 1-5 ด้วยปากกา และช่องเซ็นชื่อ จัดสไตล์แบบ print-first (ดำบนขาวคงที่ ไม่มี dark mode เพราะพิมพ์ออกมาจะอ่านไม่ออก) |
| `pages/MeetOurTeamPage.jsx` / `pages/LifeOnSitePage.jsx` | หน้าเนื้อหาเสริมที่ปลดล็อกหลังจบโปรแกรม (ข้อมูลจาก `data/gallery.js`) |

---

## 17. ข้อจำกัดที่ทราบอยู่แล้ว (จาก PORT_NOTES.md)

1. **ไม่มีหน้าจอสำหรับเปลี่ยนชื่อพนักงาน (`renameEmployee`)** — ฟังก์ชันและ endpoint พร้อมใช้งานแล้ว แต่ยังไม่มีปุ่ม/หน้าจอเรียกใช้ (ระบบเดิมก็ไม่มีเช่นกัน จึงไม่ใช่การถดถอย)
2. **`tasks_done` ในหน้า Admin Cohort ไม่มีตัวหาร** — API ไม่ทราบว่าแผนกหนึ่งมีงานทั้งหมดกี่ข้อ จึงแสดงเป็นแท่งเทียบสัดส่วนกับคนที่ทำเยอะที่สุด แทนที่จะเป็นเปอร์เซ็นต์จริง
3. **Confetti (เอฟเฟกต์ฉลองแบบอนุภาคกระดาษ) ไม่ได้พอร์ตมา** — ต้นฉบับวาดด้วย Canvas (`runConfetti`) ส่วนพอร์ตนี้มีแค่ตัว popup, ข้อความ, และปุ่มกด แต่ไม่มีเอฟเฟกต์ภาพ confetti

