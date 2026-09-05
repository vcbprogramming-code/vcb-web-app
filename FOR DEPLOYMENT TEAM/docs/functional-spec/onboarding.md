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

### 3.2 เมื่อไหร่ที่ระบบถามชื่อ (`NameModal`)

- ครั้งแรกที่พนักงานกดติ๊ก checkbox ใดๆ (ไม่ว่าจะเป็นเอกสารหรือ checklist ในเฟส) ระบบจะเปิด modal ถามชื่อ
- **ถ้าอยู่หน้า Required Documents** (ยังไม่รู้ว่าอยู่แผนกไหน) → ถามแค่ชื่ออย่างเดียว ไม่ถามแผนก (`askDepartment = false`)
- **ถ้าอยู่หน้าเฟสของแผนกใดแผนกหนึ่งแล้ว** (เช่น `/finance-day-1-30`) → ระบบรู้แผนกจาก URL อยู่แล้ว จึงแสดงช่องแผนกแบบ **ล็อกไว้ไม่ให้แก้** (pre-filled + disabled) เพื่อยืนยันเท่านั้น ไม่ใช่ให้เลือกใหม่

### 3.3 การสลับแผนก (Department Switch) — ป้องกันข้อมูลหาย

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

การ์ดแต่ละแผนก (จาก `data/departments.js`'s `deptCard` field) ประกอบด้วย: **เลขลำดับ** (01-05), **ไอคอน** (จาก `components/deptIcons.jsx` — วาดเป็น SVG เส้นง่ายๆ 5 แบบ: ledger, coin, package, building, wrench), **ชื่อแผนก**, **คำอธิบายสั้น**, **"LED BY" (หัวหน้าแผนก)**, **"FOCUS" (จุดเน้นงาน)**, และปุ่ม **"Choose this department →"**

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

### Logic การคำนวณ % ความคืบหน้า (`components/ProgressBar.jsx`)

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

---

## 12. ผังองค์กร (Org Chart) — `src/components/orgchart/`

ประกอบด้วย `CompanyStructure.jsx` (ฝังในหน้า Home), `OrgChart.jsx`, `GroupStructure.jsx`, `TreeNode.jsx` — แสดงผังองค์กรแบบต้นไม้ (tree) จากข้อมูลคงที่ใน `data/orgChart.js` เส้นเชื่อมแบบ tree-connector วาดด้วย CSS `::before` pseudo-element (ไม่ใช้ library วาดกราฟ ตาม TECH_STACK.md ที่ห้ามใช้ chart library)

---

## 13. ข้อจำกัดที่ทราบอยู่แล้ว (จาก PORT_NOTES.md)

1. **ไม่มีหน้าจอสำหรับเปลี่ยนชื่อพนักงาน (`renameEmployee`)** — ฟังก์ชันและ endpoint พร้อมใช้งานแล้ว แต่ยังไม่มีปุ่ม/หน้าจอเรียกใช้ (ระบบเดิมก็ไม่มีเช่นกัน จึงไม่ใช่การถดถอย)
2. **`tasks_done` ในหน้า Admin Cohort ไม่มีตัวหาร** — API ไม่ทราบว่าแผนกหนึ่งมีงานทั้งหมดกี่ข้อ จึงแสดงเป็นแท่งเทียบสัดส่วนกับคนที่ทำเยอะที่สุด แทนที่จะเป็นเปอร์เซ็นต์จริง
3. **Confetti (เอฟเฟกต์ฉลองแบบอนุภาคกระดาษ) ไม่ได้พอร์ตมา** — ต้นฉบับวาดด้วย Canvas (`runConfetti`) ส่วนพอร์ตนี้มีแค่ตัว popup, ข้อความ, และปุ่มกด แต่ไม่มีเอฟเฟกต์ภาพ confetti

