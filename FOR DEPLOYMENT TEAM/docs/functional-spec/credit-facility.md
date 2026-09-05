# Credit Facility — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> เอกสารนี้อธิบาย **โค้ด React/Express ที่ใช้งานจริงในปัจจุบัน** ของโมดูลวงเงินสินเชื่อ
> (Credit Facility) ภายใต้ `FOR DEPLOYMENT TEAM/credit-facility/` (ฝั่งหน้าบ้าน) และ
> `FOR DEPLOYMENT TEAM/api/src/routes/credit.js` (ฝั่ง API) ไม่ใช่เอกสารออกแบบในอุดมคติ —
> ทุกหัวข้อยึดตามพฤติกรรมจริงของซอร์สโค้ด พร้อมระบุไฟล์/ฟังก์ชันอ้างอิงเพื่อให้นักพัฒนา
> ตามไปดูโค้ดจริงได้ทันที

---

## 1. ภาพรวมของโมดูล

โมดูล **Credit Facility (ระบบวงเงินสินเชื่อ)** เป็นระบบติดตามวงเงินสินเชื่อธนาคารของบริษัท
ก่อสร้าง ครอบคลุมทุกโครงการ (project) และทุกประเภทวงเงิน (facility type) — เช่น
หนังสือค้ำประกัน (BG), วงเงินกู้ระยะยาว (T/L), ตั๋วสัญญาใช้เงิน (P/N), Bill of Exchange
(B/E/AVAL), Domestic Letter of Credit (DLC) ฯลฯ โดยครอบคลุม 4 กลุ่มงานหลัก:

1. **ภาพรวมวงเงิน (Dashboard)** — การ์ดสรุปวงเงินคงเหลือ/ใช้ไป, รายการที่ใกล้ครบกำหนด,
   และสถานะคำขอ พร้อมคลิกเพื่อ drill-down ไปยังตารางด้านล่าง
2. **การเบิกใช้วงเงิน (Drawdowns / Ledger)** — บันทึกรายการใช้วงเงินจริง (transactions)
   เช่น การออก L/G, การเบิก P/N, การชำระคืน
3. **คำขอสินเชื่อและอนุมัติ (Requests & Approval)** — เจ้าหน้าที่สร้างคำขอ ผู้บริหารอนุมัติ/ไม่อนุมัติ
   ซึ่งเมื่ออนุมัติแล้วระบบจะสร้างรายการเบิกใช้ (transaction) ที่ผูกกับคำขอนั้นโดยอัตโนมัติ
4. **แผนการเงินรายเดือน (Monthly Cash Plan / T-bar)** — แผนกระแสเงินสดแบบ "รับ-จ่าย"
   ต่อโครงการต่อเดือน และมุมมองเทียบ "แผน vs จริง" (Variance)

โค้ดนี้เป็นการ **สร้างใหม่ทั้งหมด** จาก Apps Script เดิม (ดูหัวข้อ 8 "ที่มาและข้อจำกัด") —
Apps Script เดิมไม่มี component React จริง เป็นเพียง `dangerouslySetInnerHTML` ของ HTML/JS
เก่าที่พ่วง mock backend ในหน่วยความจำ ส่วนโค้ดปัจจุบันคุยกับฐานข้อมูล PostgreSQL จริงผ่าน
Express API ที่ `api/src/routes/credit.js` เท่านั้น ไม่มี Supabase client ฝั่งเบราว์เซอร์อีกต่อไป

**Stack**: React 18 + Vite 5 + Tailwind 3 + React Router 6 (JavaScript ล้วน ไม่มี TypeScript,
ไม่มี Redux — ใช้ Context + `useState`, ไม่มี UI kit หรือ chart library — ใช้ primitive
เขียนเองใน `src/components/ui.jsx`)

---

## 2. โครงสร้างแอปและการนำทาง

### 2.1 App shell — `src/App.jsx`

`App()` ห่อทั้งแอปด้วย provider สามชั้น: `DataProvider` → `FilterProvider` → `DashPrefsProvider`
แล้วเรนเดอร์ `Shell()` ซึ่งเป็นโครงหน้าจริง:

- **Header** (`src/components/Header.jsx`) — แถบบนสุด ใช้ `AppBar` ที่ใช้ร่วมกันทุกโมดูล
- **Dashboard** (`src/components/Dashboard.jsx`) — การ์ดสรุปด้านบน
- **แถบแท็บ (tab bar)** — 7 แท็บที่ map ไปยัง route:

  | Path | คีย์ label | หมายเหตุ |
  |---|---|---|
  | `/facilities` | วงเงินสินเชื่อ (Facilities) | ตารางวงเงินทั้งหมด |
  | `/ledger` | รายการสินเชื่อ (Credit Ledger) | ตาราง transaction |
  | `/requests` | เพิ่มคำขอสินเชื่อ | คิวคำขอ + อนุมัติ |
  | `/cost` | สรุปค่าใช้จ่าย | สรุปตามหมวดค่าใช้จ่าย |
  | `/plan` | แผนการเงิน (T-bar) | ป้าย "อยู่ระหว่างการพัฒนา" |
  | `/actual` | หักค่างานตามจริง | ตัวแปร "actual" ของหน้าเดียวกับ `/plan` |
  | `/variance` | ผลต่าง (Variance) | เทียบแผนกับจริง — ป้าย "อยู่ระหว่างการพัฒนา" เช่นกัน |

- **FilterBar** (`src/components/FilterBar.jsx`) — แถบตัวกรองที่ใช้ร่วมกันทุกตาราง
- Modal ที่ mount ไว้ระดับ Shell เสมอ (เปิด/ปิดผ่าน `useState`): `RequestDialog`,
  `TxnDialog`, `SettingsDialog`
- `Toast` — ข้อความแจ้งเตือนชั่วคราวที่มุมล่างกลางจอ (หายเองใน 2.6 วินาที ดู
  `DataContext.jsx` บรรทัด `setTimeout(() => setToast(''), 2600)`)

**หมายเหตุสำคัญเรื่องการโหลด**: หน้าจอ **ไม่ถูกกันไว้ด้วย authLoading** — คอมเมนต์ในโค้ด
(`App.jsx` บรรทัด 45-48) ระบุชัดว่า "หาก `/auth/me` ล้มเหลว จะไม่ปล่อยให้แอปค้างที่หน้า
spinner ตลอดไป" — ตัว shell เรนเดอร์ทันที ส่วนข้อมูลค่อยตามมาทีหลัง

`onExport()` ใน `Shell()` คือปุ่ม Export Excel — export เฉพาะข้อมูลที่ **ตัวกรองปัจจุบัน
กำลังแสดงอยู่บนจอ** (ไม่ใช่ข้อมูลทั้งหมด) โดยเรียก `exportWorkbook()` จาก
`src/lib/exportExcel.js` (ดูหัวข้อ 7.5)

### 2.2 Drill-down จาก Dashboard

ฟังก์ชัน `drill(patch)` ใน `Shell()`:
1. เรียก `resetDrill()` — ล้างตัวกรอง type/due/status/q (คงบริษัท+โครงการไว้)
2. เรียก `applyFilters(patch)` — ตั้งค่าตัวกรองใหม่ตาม card ที่คลิก
3. `navigate()` ไปที่ `/facilities` (ถ้า patch มี `type`) หรือ `/ledger` (กรณีอื่น)

---

## 3. Dashboard — ภาพรวมวงเงิน (`src/components/Dashboard.jsx`)

### 3.1 หน้าที่

แสดงการ์ดสรุป 3 กลุ่มเหนือแถบแท็บ:

1. **การ์ดวงเงิน (Facility cards)** — BG, T/L, M/L, B/E, P/N (แสดง/ซ่อนได้จาก Settings)
2. **การ์ดครบกำหนด (Due cards)** — ภายใน 1 สัปดาห์, ครบกำหนดเดือนนี้, ครบกำหนดเดือนหน้า
3. **การ์ดสถานะ (Status cards)** — คำขอใหม่, เสนออนุมัติ, อนุมัติแล้ว

ทุกการ์ดคลิกได้ (`onDrill`) เพื่อกระโดดไปตารางที่กรองตามเงื่อนไขนั้น

### 3.2 กฎการคำนวณสำคัญ 2 ข้อ (สืบทอดจาก `cards()` ใน legacy.js)

1. **การ์ดไม่กรองตามประเภทวงเงิน (type filter)** — จงใจ เพราะการคลิกการ์ดจะ *ตั้ง*
   ตัวกรอง type เพื่อ drill-down ลงตาราง หากการ์ดกรองตาม type ด้วย การ์ดทั้งหมดจะยุบเหลือ
   กล่องเดียวทันทีที่มีการใช้ตัวกรอง — การ์ดจึงกรองเฉพาะบริษัทและโครงการเท่านั้น (`matchCompany`)
2. **การพับรวมวงเงิน (folding)** — เพราะธนาคารไม่แยกวงเงินเหล่านี้ออกจากกัน:
   - สามรายการ "หนังสือค้ำประกัน" (facility_no #1-3: ค้ำสัญญา 5%, ค้ำ Advance 15%,
     ค้ำประกันผลงาน) ถูกรวมเป็นกล่อง **BG** เดียว — ดู `BG_PARTS = [1, 2, 3]` ใน
     `src/lib/domain.js`
   - L/G วัสดุ (#5), DLC (#9) และ PN-post (#10) ใช้วงเงิน B/E credit cap ร่วมกับ
     AVAL (#6) — ทั้งหมดถูกพับรวมเข้ากล่อง **B/E** — ดู `BE_FOLD_INTO = 6`,
     `BE_FOLDED = [5, 9, 10]`

`computeStats()` (บรรทัด 299-416) คือแกนคำนวณทั้งหมด:

- เก็บ `beParts`/`bgParts` (สัดส่วนย่อยก่อนพับรวม) เพื่อแสดงใน breakdown ของการ์ด — เฉพาะ
  รายการที่มีข้อมูล (`used > 0 || lim > 0`) เท่านั้นที่จะแสดง
- วนลูป `transactions` เพื่อคำนวณ:
  - `dueThis`/`dueNext`/`dueOver` — ยอดครบกำหนดเดือนนี้/เดือนหน้า/เกินกำหนด (ใช้
    `dueBucket()` จาก `lib/format.js`)
  - `due7` — ยอดครบกำหนดใน 7 วัน (คำนวณแยกอิสระจาก bucket ข้างต้น เพราะรายการหนึ่ง
    อาจเป็นทั้ง "เดือนนี้" และ "ภายใน 7 วัน" พร้อมกัน — นับซ้ำได้โดยเจตนา)
  - `cNew/cWait/cAppr` และยอดเงินคู่กัน — นับตามสถานะ (`STATUS.NEW`, `STATUS.PENDING`,
    `isAuthorized()`)
- กฎการนับยอดค้าง: รายการที่ `status === SETTLED` หรือ `status.toLowerCase() === 'void'`
  ไม่นับเป็นยอดค้าง และ **จำนวนเงินติดลบ (การปลดวงเงิน) ไม่นับเป็นยอดค้างชำระ** (`if (amt <= 0) continue`)

### 3.3 FacilityCard — การ์ดวงเงิน

คำนวณ `pct = min(100, round(used/lim*100))` (ถ้า `lim === 0` แต่ `used > 0` ให้ pct = 100)
`avail = lim - used`; ถ้าทั้ง `lim` และ `used` เป็น 0 จะแสดงข้อความ "— ไม่มีข้อมูล" แทน
มิเตอร์ ใช้ component `<Meter>` (เขียนเองด้วย CSS ไม่มี chart library) ซึ่งเปลี่ยนสีเป็น
warn ที่ ≥80% และ danger ที่ ≥100%

### 3.4 การตั้งค่าที่ควบคุมว่าการ์ดไหนแสดง

ทุกการ์ดถูกกรองผ่าน `.filter((c) => prefs.lines[c.key])` เป็นต้น — ค่า `prefs` มาจาก
`DashPrefsContext` (ดูหัวข้อ 6)

---

## 4. รายการฟังก์ชันทั้งหมด (แยกตามหน้าจอ)

### 4.1 วงเงินสินเชื่อ — Facilities (`src/views/FacilitiesView.jsx`)

**ทำอะไรได้**: แสดงตารางวงเงินทุกโครงการ/ประเภท: วงเงิน (limit), ใช้ไป (used), คงเหลือ
(available), มิเตอร์เปอร์เซ็นต์การใช้ พร้อมปุ่ม "ปรับ" (เปิด `LimitDialog`) — เฉพาะผู้บริหาร
(`isManager`)

**Logic**:
- ข้อมูล `used`/`available` **ไม่ถูกคำนวณในฝั่ง client** — มาจาก view ฐานข้อมูล
  `credit.facility_used` ที่ backend query ให้แล้ว (override ถ้ามี ไม่งั้นรวมยอดจาก
  transaction ที่ยังไม่ชำระ) — client แค่แสดงผลตามที่ได้รับ
- `f.usedOverridden` เป็น `true` เมื่อมีการ pin ค่า used ด้วยมือ (ผ่าน `LimitDialog`) —
  แสดงไอคอน ✎ พร้อม tooltip "ตั้งเอง (override) — ไม่ได้คำนวณจากรายการ"
- `f.interest` เป็นข้อความอิสระ (เช่น "MLR ต่อปี", "1.25 % ต่อปีเรียกเก็บทุก 3 เดือน")
  แสดงตรงตัวเสมอ ไม่แปลงเป็นตัวเลข
- ตัวกรองที่ใช้: `filterFacilities()` จาก `lib/lookups.js` (กรองตาม project, company, kind)

### 4.2 รายการสินเชื่อ — Ledger (`src/views/LedgerView.jsx`)

**ทำอะไรได้**: ตารางรายการเบิกใช้วงเงินจริง (transactions) — วันที่, โครงการ, ประเภท,
เลขที่เอกสาร, รายละเอียด/ผู้รับผลประโยชน์, จำนวนเงิน, วันครบกำหนด, เอกสารแนบ, สถานะ
คลิกที่แถวเพื่อเปิด `TxnDetailDialog`

**Logic**:
- เรียงลำดับได้ (`toggleSort`) ตามคอลัมน์ date/ref/amount/due — คลิกซ้ำสลับทิศทาง
  `sortValue()` แปลงวันที่ dd/mm/yyyy เป็น timestamp ก่อนเทียบ เพื่อไม่ให้เรียงผิดแบบ string
- จำนวนเงินติดลบ (การปลด/คืนวงเงิน) แสดงด้วยสีเขียว (`text-ok`) ต่างจากปกติ
- แสดง **ดอกเบี้ยเกินกำหนดโดยประมาณ** ถ้ารายการนั้นเกินกำหนดและยังไม่ชำระ — คำนวณผ่าน
  `overdueInterest()` (ดูหัวข้อ 5.3) — ถ้าอัตราดอกเบี้ยของวงเงินไม่ใช่ตัวเลข (เช่น MLR)
  จะไม่แสดงตัวเลข (คืนค่า `null` ไม่ใช่ 0)

### 4.3 คำขอสินเชื่อ — Requests & การอนุมัติ (`src/views/RequestsView.jsx`)

**ทำอะไรได้**: คิวคำขอสินเชื่อ พร้อมปุ่ม "อนุมัติ" / "ไม่อนุมัติ" (เฉพาะผู้บริหาร และเฉพาะ
คำขอที่ยังไม่ถูกตัดสิน) และปุ่มแก้ไข/ลบ

**Logic การอนุมัติ (state machine)**:
- คำขอเริ่มต้นที่ `STATUS.NEW` ('คำขอใหม่') หรือถูกตั้งเป็น `STATUS.PENDING`
  ('อยู่ระหว่างเสนออนุมัติ') ตอนสร้าง/แก้ไข
- ปุ่ม "อนุมัติ" เรียก `decideRequest(id, DECISION.APPROVE)` → POST
  `/api/credit/requests/:id/decide` พร้อม `{ decision: 'อนุมัติ' }`
- ปุ่ม "ไม่อนุมัติ" (ปุ่ม "ไม่" ในโค้ด) ส่ง `{ decision: 'ไม่อนุมัติ' }`
- **จุดสำคัญที่ต้องเข้าใจ**: สถานะของคำขอหลังตัดสินใจ **ไม่ใช่** `STATUS.APPROVED`
  ('อนุมัติแล้ว' — สถานะของ transaction) แต่เป็นคำตัดสิน (decision literal) ดิบ ๆ
  คือ `DECISION.APPROVE` ('อนุมัติ') หรือ `DECISION.REJECT` ('ไม่อนุมัติ') — สองสตริง
  นี้แยกกันเด็ดขาด ระบบ mapping สีป้าย (`statusMeta()` ใน `lib/domain.js`) ต้องรู้จัก
  ทั้งสองแบบ ไม่งั้นคำขอที่อนุมัติแล้วจะแสดงเป็นป้ายสีฟ้า "คำขอใหม่" ผิด ๆ (ดูคอมเมนต์ยาว
  ในโค้ด `domain.js` บรรทัด 25-41 ที่อธิบาย bug นี้โดยตรง)
- `decided = r.status === DECISION.APPROVE || r.status === DECISION.REJECT` — ใช้ซ่อน
  ปุ่มอนุมัติ/ไม่อนุมัติเมื่อคำขอถูกตัดสินไปแล้ว
- **ฝั่ง backend** (`credit.js` route `/requests/:id/decide`, บรรทัด 759-812):
  1. ล็อกแถวคำขอด้วย `SELECT ... FOR UPDATE` — กันไม่ให้ผู้บริหารสองคนอนุมัติซ้อนกัน
  2. ถ้าคำขอถูกตัดสินไปแล้ว (`status === 'อนุมัติ' || 'ไม่อนุมัติ'`) → ตอบ 409
     `ALREADY_DECIDED`
  3. ถ้า decision เป็น 'อนุมัติ' และยังไม่มี `linked_txn` → **สร้าง transaction ใหม่ทันที
     ในทรานแซกชันฐานข้อมูลเดียวกัน** (สถานะ `'อนุมัติแล้ว'`) แล้วผูก `linked_txn` กลับเข้า
     คำขอ — รับประกันว่าคำขอที่อนุมัติแล้ว **ต้องมี** รายการเบิกใช้คู่กันเสมอ ไม่มีทางที่
     คำขออนุมัติแล้วจะ "ลอย" ไม่มี transaction
  4. เขียน audit log เสมอ (`decideRequest`)
- **นี่คือจุดที่แก้ไขบั๊กจากระบบเดิม**: มoc เดิม (`src/mock/api.ts`) เขียนคำขอใหม่ลง array
  `transactions` (ผ่าน `insertTxn()`) แต่ `decideRequest()` ค้นหาใน array `requests` ที่
  ไม่มีใครเขียนอะไรเข้าไปเลย — ทำให้คำขอที่สร้างผ่าน UI ไม่มีทางถูกอนุมัติได้ ระบบปัจจุบัน
  มีตาราง `credit.requests` และ `credit.transactions` แยกจริงและเชื่อมกันถูกต้อง

**ปุ่ม "เพิ่มคำขอสินเชื่อ"** (`RequestDialog`, เปิดจาก FilterBar หรือแก้ไขจากตาราง)
ดูหัวข้อ 5.1

### 4.4 สรุปค่าใช้จ่าย — Cost (`src/views/CostView.jsx`)

**ทำอะไรได้**: จัดกลุ่มยอดใช้จ่ายตามหมวดค่าใช้จ่าย (cost category) เทียบกับงบที่ตั้งไว้
(ต่อโครงการ) พร้อมมิเตอร์และป้ายสถานะ (ในงบ/ใกล้เต็มงบ/เกินงบ)

**Logic**:
- **นับเฉพาะรายการที่ได้รับอนุมัติแล้ว** (`isAuthorized(r.status)`) — คำขอที่ยังเป็น
  "คำขอใหม่" ยังไม่ผูกพันเงินจริง จึงไม่ควรทำให้โครงการดูเหมือนเกินงบจากเอกสารที่ยัง
  ไม่มีใครอนุมัติ
- รายการที่ไม่มีหมวด (`costCategory` ว่าง) ถูกจัดเข้ากลุ่ม `NO_CATEGORY` ('(ไม่ระบุหมวด)')
- **งบ (cap) เป็นคีย์ผสม (project, category)** — ถ้าไม่ได้เลือกกรองโครงการ (`filters.proj`
  ว่าง) จะไม่มีงบเดี่ยวให้เทียบ (เพราะงบของแต่ละโครงการต่างกัน) คอลัมน์งบจึงว่างเปล่า
  ไม่ใช่การรวมงบข้ามโครงการ
- `pct = round(total/cap*100)` — สีมิเตอร์: ≥100% = "เกินงบ" (danger), ≥80% = "ใกล้เต็มงบ"
  (warn), น้อยกว่านั้น = "ในงบ"
- ปุ่ม "ตั้ง/แก้ไขงบประมาณ" เปิด `CapDialog` — ปรากฏเฉพาะเมื่อเลือกกรองโครงการแล้ว และ
  เฉพาะผู้บริหาร; หมวด "(ไม่ระบุหมวด)" ตั้งงบไม่ได้ (ต้องแก้คำขอให้ระบุหมวดก่อน)

### 4.5 แผนการเงิน — Cash Plan / T-bar (`src/views/PlanView.jsx`)

**ทำอะไรได้**: แผนกระแสเงินสด "T-bar" รายเดือนต่อโครงการ — แบ่งเป็น "ส่วน" (period/section)
โดยแต่ละส่วนมีฝั่งซ้าย = เงินเข้า, ฝั่งขวา = เงินออก, ด้านล่าง = ยอดสุทธิ Component เดียว
ใช้ทั้งแท็บ "แผนการเงิน" (`variant="plan"`, path `/plan`) และ "หักค่างานตามจริง"
(`variant="actual"`, path `/actual`) — ดูคอมเมนต์ "One component, two variants" ใน `App.jsx`

**Logic**:
- โครงการ HO และ LPB ถูกยกเว้นจากแผนการเงินเสมอ (`PLAN_EXCLUDE = { HO: 1, LPB: 1 }` ใน
  `domain.js`) — เลือกไม่ได้ในดรอปดาวน์โครงการของหน้านี้
- ช่วงเดือนที่เลือกได้: ย้อนหลัง 6 เดือน ถึงล่วงหน้า 6 เดือนจากเดือนปัจจุบัน
  (`monthOptions()`)
- แต่ละส่วนมี **ประเภทเทมเพลต** ตายตัว 3 แบบ (`PERIOD_TYPES`):
  1. `pn` — "ขอเบิก P/N" (เบิก P/N เข้าโครงการจากค่างาน/เงินประกัน/ผลงานแล้วเสร็จ)
  2. `work` — "รับเงินค่างาน + หักหนี้" (รับชำระค่างาน หักด้วย TL/ML/PN/Segment)
  3. `aval` — "ขอออก Aval จัดสรร" (ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ)
- **จำกัดสูงสุด 5 ส่วนต่อเดือนต่อโครงการ** (`if (nextIdx >= 5) { notify(t('plan.max5')) }`)
- `periodIdx` (ลำดับส่วน) คำนวณจาก `max(periodIdx ที่มีอยู่) + 1` ไม่ใช่ความยาว array —
  เพราะถ้าลบส่วนกลางออก ดัชนีที่ว่างต้องไม่ถูกใช้ซ้ำ (คีย์ธรรมชาติของ backend คือ
  `(project, month, period_idx, variant)`)
- ยอดรวมเข้า (`totalIn`) = `income` (รับเงินค่างานสุทธิ) + ผลรวม `incomeBreak[].pnAmount`
  + ผลรวม `extraRows[].amount`; ยอดรวมออก (`totalOut`) = ผลรวม `deductions[].amount`;
  `net = totalIn - totalOut`
- ลบส่วน (section) ต้องยืนยันผ่าน `ConfirmDialog` ก่อนเรียก `DELETE /cash-plan/:id`

**ข้อจำกัดที่ระบุไว้ชัดใน PORT_NOTES.md**: การแก้ไขแผนการเงินยังหยาบ — `PUT /cash-plan`
แทนที่ "ทั้งช่วง" (period) เดียวในคราวเดียว ระบบ Apps Script เดิมแก้บรรทัดรายรับ/รายจ่าย
แต่ละช่องแบบ debounce ทีละเซลล์ แต่เวอร์ชันนี้ทำได้แค่ render T-bar และสร้าง/ลบส่วน — การแก้
รายบรรทัดในส่วนต้องรอ endpoint ละเอียดกว่านี้ หรือทำแบบ local-draft-then-save

### 4.6 ผลต่าง — Variance (`src/views/VarianceView.jsx`)

**ทำอะไรได้**: เทียบยอด "แผน" กับ "จริง" ของเดือน/โครงการเดียวกัน สามตัวชี้วัด: รับเงิน
(received), หักจ่าย (deducted), คงเหลือสุทธิ (net) — แสดงเป็นแท่ง SVG สองแท่งต่อแถว (บน =
แผน, ล่าง = จริง) พร้อมผลต่าง (diff) เป็นตัวเลข +/-

**Logic**:
- ดึงข้อมูลสองครั้งพร้อมกัน (`Promise.all`) — เดือนเดียวกัน คนละ `variant` ('plan' และ
  'actual')
- ฟังก์ชัน `totals()` สรุปยอดจาก periods array แบบเดียวกับที่ `PlanView` ใช้คำนวณ
  totalIn/totalOut ต่อ section
- ความยาวแท่งสเกลตามค่าสัมบูรณ์สูงสุดที่ปรากฏในหน้าจอ (`scale`) เพื่อให้เทียบกันได้ระหว่าง
  ตัวชี้วัดทั้งสาม
- สีผลต่าง: ถ้า `actual - plan < 0` → สีแดง (danger), ถ้า ≥ 0 → สีเขียว (ok)

---

## 5. Dialog / ฟอร์มต่าง ๆ — Logic การทำงานโดยละเอียด

### 5.1 RequestDialog — เพิ่ม/แก้ไขคำขอสินเชื่อ (`src/components/RequestDialog.jsx`)

**หน้าที่**: ฟอร์มสร้าง/แก้ไขคำขอสินเชื่อ ส่งไปที่ `POST /api/credit/requests` (สร้าง) หรือ
`PATCH /api/credit/requests/:id` (แก้ไข)

**การเชื่อมโยง วันที่เริ่ม / จำนวนวัน / วันครบกำหนด**: สามช่องนี้ผูกกันแบบ "แก้สองในสาม
คำนวณช่องที่สาม" เหมือนต้นฉบับ `onStart`/`onDays`/`onMat` เดิม:

- แก้ `start` → ถ้ามี `days` แล้ว คำนวณ `maturity` ใหม่; ถ้าไม่มีแต่มี `maturity` แล้ว
  คำนวณ `days` ใหม่แทน (`onStart`)
- แก้ `days` → ถ้าค่าไม่ว่าง คำนวณ `maturity` (ถ้ามี `start`) หรือคำนวณ `start` (ถ้ามี
  `maturity`); **ถ้าล้างช่อง days เป็นค่าว่าง จะไม่กระทบวันที่ทั้งสองช่องเลย** — จงใจ
  ป้องกันไม่ให้การล้างจำนวนวันไปดึงวันที่ทั้งสองให้ตรงกันโดยไม่ตั้งใจ (`onDays`)
- แก้ `maturity` → คำนวณ `days` (ถ้ามี `start`) หรือคำนวณ `start` (ถ้ามี `days`) (`onMaturity`)

ฟังก์ชันคำนวณจริงอยู่ที่ `src/lib/format.js`: `matFromStartDays()`, `daysFromStartMat()`,
`startFromMatDays()` — ทั้งหมดใช้ `parseDays()` ภายในที่แยกกรณี "ค่าว่าง" ออกจาก "ศูนย์"
อย่างชัดเจน (ค่าว่างต้องไม่ถูกตีความเป็น `0` เพราะ `Number('') === 0`)

**ตัวช่วยแสดงวงเงินคงเหลือ**: เมื่อเลือกโครงการ+ประเภทวงเงินแล้ว จะคำนวณ `avail =
facAvail(facilities, project, facilityNo)` (จาก `lib/domain.js`) และแสดง "คงเหลือใช้ได้"
พร้อม "หลังคำขอนี้เหลือ" (`avail - amountNum`) — ถ้าติดลบจะเปลี่ยนเป็นข้อความ/สีแดง
"เกินวงเงินคงเหลือ" แต่ **ไม่ได้บล็อกการบันทึก** เป็นเพียงคำเตือนภาพ

**Validation ก่อนบันทึก** (`save()`):
- ต้องมี `project`, `facilityNo`, `amountNum` (≠0), `beneficiary` (trim แล้วไม่ว่าง) —
  ถ้าขาดข้อใดข้อหนึ่ง แจ้ง "กรอกข้อมูลที่จำเป็น (*) ให้ครบ"
- `docFrom`/`docTo` ต้องเป็น dd/mm/yyyy หรือว่าง (`isDMYOrBlank()`) — ถ้าไม่ผ่าน แจ้ง
  "วันที่เอกสารแนบต้องเป็นรูปแบบ dd/mm/yyyy"
- `company` ในฟอร์ม **มาจากโครงการเสมอ** (`projCompany()`) — เป็นช่อง read-only ไม่ใช่
  ตัวเลือกอิสระ เพราะบริษัทเป็นคุณสมบัติของโครงการ ไม่ใช่ทางเลือกที่ผู้ใช้กรอกเอง
- ก่อนส่ง payload แปลงวันที่จาก ISO (`<input type="date">`) กลับเป็น dd/mm/yyyy ด้วย
  `isoToDMY()` เพราะ wire format ของ API คือ dd/mm/yyyy เสมอ

**หมวดค่าใช้จ่าย (costCategory)**: ใช้ `CostCategoryPicker` (ดูหัวข้อ 5.6) — แม้มีรายการ
ให้เลือกแบบชิป แต่ยังพิมพ์เองได้อิสระ (คอลัมน์เป็น plain text)

### 5.2 TxnDialog — บันทึกการใช้วงเงิน (`src/components/TxnDialog.jsx`)

**หน้าที่**: บันทึก drawdown ใหม่โดยตรง (ไม่ผ่านคำขอ) ส่งไปที่ `POST
/api/credit/transactions` สถานะเริ่มต้นคือ `STATUS.APPROVED` เสมอ (ส่งชัดเจนในโค้ด แม้
backend จะ default ค่าเดียวกันอยู่แล้ว — เพื่อให้เห็นชัดในโค้ด client ว่า drawdown ที่
บันทึกตรงถือว่าอนุมัติแล้วทันที)

**จุดสำคัญ**: จำนวนเงินเป็น **free-text ที่รับค่าติดลบได้โดยเจตนา** — ค่าลบหมายถึงการ
"ปลด/คืนวงเงิน" (repayment หรือยกเลิกหนังสือค้ำประกัน) จึงไม่ใช้ `<input type="number"
min="0">` แต่ใช้ `fmtMoneyStr()`/`moneyVal()` แบบเดียวกับฟอร์มอื่น

**Validation**: ต้องมี `project`, `facilityNo`, และ `amount` ≠ 0 เท่านั้น

### 5.3 TxnDetailDialog — รายละเอียดรายการ + ชำระ/ลบ (`src/components/TxnDetailDialog.jsx`)

**หน้าที่**: แสดงรายละเอียดเต็มของ transaction หนึ่งรายการ พร้อมปุ่ม "ลบ" และ "ชำระ"
(เฉพาะผู้บริหาร, ปุ่มชำระซ่อนถ้าสถานะเป็น SETTLED แล้ว)

**Logic การคำนวณดอกเบี้ยเกินกำหนด** (`overdueInterest()` ใน `lib/lookups.js`):
- คืนค่า `0` ถ้ารายการยังไม่ได้รับอนุมัติ หรือ settled แล้ว หรือยังไม่ครบกำหนด (`days <= 0`)
- ถ้าเลยกำหนดแล้ว: ค้นหาอัตราดอกเบี้ยตัวเลขจาก `facility.interest` ด้วย regex
  `/(\d+(?:\.\d+)?)\s*%/` — **ถ้าไม่พบตัวเลข (เช่น "MLR ต่อปี") คืนค่า `null`** ไม่ใช่ `0`
  — UI จะแสดง "ระบุอัตราไม่ได้" แทนตัวเลขที่กุขึ้นมาเอง
- ถ้าพบอัตรา: `ดอกเบี้ยประมาณ = amount * (rate/100) * daysOverdue / 365`

**การชำระ (Settle)** — เรียก `POST /transactions/:id/settle` ผ่าน `ConfirmDialog` ก่อน
(ข้อความ "ยืนยันชำระ/ปิดรายการนี้? วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน")
Backend guard เขียนไว้ **ในคำสั่ง UPDATE เดียว** (ไม่ใช่ read-then-write) เพื่อกันไม่ให้
ผู้บริหารสองคนกดชำระพร้อมกันแล้วสำเร็จทั้งคู่:
```sql
update credit.transactions
   set status = 'ชำระแล้ว', paid_date = current_date, updated_at = now()
 where id = $1 and coalesce(status,'') <> 'ชำระแล้ว' and coalesce(amount,0) > 0
```
ถ้าไม่มีแถวถูกอัปเดต ระบบจะ query แยกเพื่อแยกแยะสาเหตุ: ถ้า status เดิมคือ 'ชำระแล้ว' อยู่
แล้วตอบ 409 `ALREADY_SETTLED`, ไม่งั้นตอบ 409 `NOTHING_OWING` (เช่น จำนวนเงิน ≤ 0) — ฝั่ง
client แสดงข้อความต่างกันสำหรับสองกรณีนี้เพราะความหมายต่อผู้ใช้ต่างกัน

**การลบ (Delete)** — ต้องยืนยันก่อนเช่นกัน ("ลบรายการนี้? วงเงินที่ใช้ไปจะถูกปล่อยคืน")
เรียก `DELETE /transactions/:id`

### 5.4 LimitDialog — ปรับวงเงิน / ใช้ไป (`src/components/LimitDialog.jsx`)

**หน้าที่**: ตั้งวงเงิน (limit) ของ facility และ pin/unpin ค่า `used` ที่คำนวณอัตโนมัติ

**สาเหตุที่แยกเป็นสอง endpoint**: `limit` และ `used-override` เป็นข้อเท็จจริงคนละเรื่อง —
`PUT /limits` ตั้งวงเงินที่เจรจากับธนาคาร, `PUT /limits/used-override` ตั้งค่าที่ manual pin
ทับค่าที่คำนวณจาก view

**Logic สำคัญ**: ช่อง "ใช้ไป" (`used`) **เริ่มต้นว่างเสมอ เว้นแต่แถวนั้นถูก override อยู่แล้ว**
(`facility.usedOverridden ? fmtMoneyStr(...) : ''`) — เหตุผลตามคอมเมนต์ในโค้ด: การใส่ค่า
ที่คำนวณได้ (derived value) ไว้ล่วงหน้าในช่องนี้ จะทำให้การกด Save โดยไม่แก้อะไรกลาย
เป็นการ pin ค่านั้นทับโดยไม่ตั้งใจ — การส่งค่าว่างจะล้าง override และคืนการคำนวณให้ view
`credit.facility_used` ทำหน้าที่ต่อ

ทั้งสอง endpoint ถูกเรียก **เสมอ** ตอน save (ไม่ใช่แค่เมื่อมีการแก้ไข) — `setUsedOverride()`
ถูกส่งโดยไม่มีเงื่อนไข แม้ `usedRaw === ''` เพื่อให้การล้าง override ที่เคยตั้งไว้ก่อนหน้า
ไปถึง API จริง ๆ

**Validation**: `limit` ต้องเป็นตัวเลข ≥0 (บังคับกรอก); `used` ถ้ากรอกต้องเป็นตัวเลข ≥0 ด้วย
(ไม่บังคับกรอก)

### 5.5 CapDialog — ตั้งงบหมวดค่าใช้จ่าย (`src/components/CapDialog.jsx`)

**หน้าที่**: ตั้ง/ล้างงบประมาณของหมวดค่าใช้จ่ายหนึ่งหมวด ต่อหนึ่งโครงการ ผ่าน `PUT
/api/credit/category-caps`

**Logic**: ช่องจำนวนเงินว่าง → ส่ง `null` → backend ตีความเป็น "ล้างงบ" — และถ้ายังไม่เคย
มีแถวงบของ (project, category) นี้มาก่อน การส่ง `null` จะเป็น **no-op** (ไม่สร้างแถวงบ
เปล่า ๆ) แทนที่จะ insert ค่าว่าง — ดูโค้ด backend บรรทัด 882-890 ที่เช็ค `existing` ก่อน

### 5.6 CostCategoryPicker — ตัวเลือกหมวดค่าใช้จ่าย (`src/components/CostCategoryPicker.jsx`)

ไม่ใช่ dialog เต็มรูป แต่เป็น dropdown พิเศษที่ฝังในฟอร์ม (`RequestDialog`) แสดงรายการหมวด
เป็นชิปสีสองคอลัมน์ (3 คอลัมน์จริงในโค้ด) คลิกเพื่อเลือก หรือพิมพ์เองอิสระ (ฟิลด์เป็น
plain text ที่ backend ไม่ validate ต่อ enum ใด ๆ) พาเนลถูก render ผ่าน `createPortal` ไปที่
`document.body` (ไม่ใช่ลูกของ modal) เพื่อไม่ให้ modal ที่มี `overflow-y-auto` ตัดพาเนลให้
โผล่ไม่ครบเมื่อพื้นที่เหลือน้อย

### 5.7 SettingsDialog — ตั้งค่าขั้นสูง (`src/components/SettingsDialog.jsx`)

แบ่งเป็น 3 ส่วน:

1. **การแสดงผล (Display)** — Theme (light/dark) และภาษา (ไทย/English) — มาจาก provider
   ที่ใช้ร่วมกันทุกโมดูล (`@vcb/shared`) ไม่ใช่ preference เฉพาะแอปนี้ — เปลี่ยนที่นี่จะมีผล
   ทุกโมดูลของ VCB Connect
2. **แดชบอร์ด (Dashboard)** — checkbox เปิด/ปิดการ์ดแต่ละใบ (เชื่อมกับ `DashPrefsContext`,
   ดูหัวข้อ 6) — **มีผลทันทีไม่ต้องกด Save** เพราะเป็น preference ล้วน (เก็บใน localStorage)
   ต่างจากรายการหมวดค่าใช้จ่ายด้านล่างที่เป็น server state
3. **หมวดค่าใช้จ่าย (Cost categories)** — รายการหมวดที่แก้ไขได้ (เพิ่ม/ลบ/เลื่อนลำดับ)
   เฉพาะผู้บริหาร (`isManager`) — กด Save เพื่อเขียนทั้ง array ทับของเดิมผ่าน `PUT
   /api/credit/cost-categories` (ลำดับในลิสต์ = ลำดับที่แสดงในเมนู)

---

## 6. DashPrefsContext — ค่ากำหนดการแสดงผลแดชบอร์ด (`src/lib/DashPrefsContext.jsx`)

**หน้าที่**: เก็บว่าการ์ดใดของ Dashboard ควรแสดง/ซ่อน — เป็น **preference ต่อเบราว์เซอร์**
(เก็บใน `localStorage` คีย์ `vcb_credit_dashprefs`) **ไม่ใช่** preference ฝั่งเซิร์ฟเวอร์
เหมือนต้นฉบับ `getDashPrefs()`/`saveDashPrefs()` ใน legacy.js ที่ไม่เคยส่งผ่าน
`google.script.run` เลย

**ทำไมต้องเป็น Context ไม่ใช่ hook เปล่า**: คอมเมนต์ในโค้ดอธิบาย bug ที่เคยเกิดขึ้นตรง ๆ —
เดิมมี `useDashPrefs()` แบบ hook เปล่าที่ `SettingsDialog` และ `Dashboard` ต่างเรียกแยกกัน
คนละครั้ง ทำให้แต่ละที่มี `useState` ของตัวเอง การติ๊ก checkbox ใน Settings เขียนลง
localStorage จริง แต่ state ของ `Dashboard` ไม่รู้เรื่องด้วย — การ์ดจึงไม่เปลี่ยนจนกว่าจะ
รีโหลดหน้าใหม่ทั้งหมด บทเรียน: React state ไม่ได้ใช้ร่วมกันแค่เพราะสอง component อ่าน
localStorage คีย์เดียวกัน — ต้องมี "หนึ่งแหล่งความจริง" (single source of truth) ที่อยู่
เหนือทั้งสอง component จริง ๆ (Context) โครงสร้างปัจจุบันจึงห่อด้วย
`DashPrefsProvider` ที่ `App.jsx` แล้วให้ทั้งสอง component ใช้ `useDashPrefs()` ตัวเดียวกัน

**ค่าเริ่มต้น** (`DEFAULT`, สืบทอดจากต้นฉบับ):
```js
{
  lines:  { tl: true, bg: true, ml: false, be: true, pn: true },
  due:    { week: false, this: true, next: true },
  status: { new: false, proposed: true, approved: true },
}
```
เหตุผลของค่าเริ่มต้น: M/L ปิดเพราะใช้น้อย, "ภายใน 1 สัปดาห์" และ "คำขอใหม่" ปิดเพราะเป็น
กล่องที่ "ดังและน่าตกใจที่สุด" — ให้ผู้ใช้เปิดเองถ้าต้องการ (opt-in) ส่วนที่เหลือเปิด
ทั้งหมด

`readStored()` จะ merge ค่าที่เก็บไว้เข้ากับ `DEFAULT` เสมอ (`{ ...DEFAULT.lines,
...parsed.lines }`) เพื่อรองรับกรณี key ใหม่ถูกเพิ่มในอนาคตแต่ localStorage เก่ายังไม่มี
key นั้น และดัก try/catch ทุกจุดอ่าน/เขียน localStorage เพื่อไม่ให้ localStorage ที่ถูกบล็อก
ทำให้แอปพัง (เพียงแค่ preference จะไม่รอดข้ามการรีโหลด)

---

## 7. Data Layer และการคำนวณส่วนกลาง

### 7.1 DataContext — ที่เก็บข้อมูลกลางของโมดูล (`src/lib/DataContext.jsx`)

**สถาปัตยกรรม**: Context + `useState` เดียว (ไม่มี Redux ตาม TECH_STACK.md) สืบทอดแนวคิด
จาก Apps Script เดิมที่มีตัวแปร global `D` เก็บทั้งสมุดงาน (workbook) และเรียก `render()`
ใหม่หลังทุกการแก้ไข — รูปแบบนี้ยังคงอยู่ (endpoint เดียวคืนข้อมูลทั้งโมดูล) แต่การเขียน
ข้อมูลตอนนี้ไปที่ API จริง และการรีเฟรชคือการ fetch ใหม่ ไม่ใช่แก้ global ตรง ๆ

**`reload()`**: ดึงข้อมูล 3 อย่างพร้อมกัน (`Promise.all`):
1. `GET /api/credit/data` — ก้อนข้อมูลหลัก (`me`, `facilities`, `costCategories`,
   `categoryCaps`, `transactions`, `requests`, `projects`, `facTypes`)
2. `GET /api/credit/projects` (ผ่าน `optional()` — เผื่อ route ไม่มี)
3. `GET /api/credit/facility-types` (เช่นกัน)

**`mutate(fn, successMessage)`**: รูปแบบการเขียนข้อมูลมาตรฐานของทุก dialog — เรียก `fn()`
(คำสั่งเขียน), รอเสร็จแล้ว **fetch ข้อมูลทั้งหมดใหม่ทันที** (`reload()`) แล้วค่อยแสดง
toast ข้อความสำเร็จ เหตุผลที่ไม่ patch state ในเครื่อง (optimistic update): ค่า `used`,
`available`, `usedOverridden` คำนวณโดย view ฐานข้อมูล (`credit.facility_used`) และการ
อนุมัติคำขอสร้าง transaction ฝั่งเซิร์ฟเวอร์ — การเดาผลลัพธ์ฝั่ง client จะคลาดจากฐานข้อมูล
จริงได้ จึงเลือก "รีเฟรชทุกครั้ง" แทน "เดาผล"

**Fallback สำหรับ reference data**: ถ้า `GET /projects` หรือ `GET /facility-types`
คืนค่า 404 (ยังไม่ implement — ดูหัวข้อ 8) จะ derive รายการโครงการแบบง่ายจาก
`facilities`/`transactions`/`requests` ที่มีอยู่ (`normalizeProjects()`) — โดยใช้รหัส
โครงการแทนชื่อไทย เพราะไม่มีชื่อให้ใช้จริง ๆ ในกรณีนั้น (แต่ปัจจุบัน route เหล่านี้มีจริง
แล้วในโค้ด backend ดูหัวข้อ 8 สำหรับสถานะล่าสุด)

### 7.2 FilterContext — ตัวกรองที่ใช้ร่วมกันทุกตาราง (`src/lib/FilterContext.jsx`)

เก็บ state ตัวกรอง 6 ค่า: `co` (บริษัท), `type` (ประเภทวงเงิน), `proj` (โครงการ), `due`
(ช่วงครบกำหนด), `status`, `q` (คำค้นหาอิสระ) — persist ลง `localStorage` คีย์
`vcb_credit_filters` เพื่อให้กลับมาที่ตัวกรองเดิมเมื่อรีโหลดหน้า

`resetDrill()` ล้างเฉพาะ `type/due/status/q` **แต่คงค่า** `co`/`proj` ไว้ — ตรงกับ
`resetDrillFilters()` ในต้นฉบับ: การกระโดดจากการ์ดหนึ่งไปอีกการ์ดหนึ่งไม่ควรแอบคง
สถานะ/ช่วงเวลาของการ์ดก่อนหน้าไว้ แต่ยังอยู่ใน scope บริษัท/โครงการเดิม

### 7.3 lib/domain.js — คำศัพท์โดเมนหลัก

ไฟล์นี้เก็บ **ค่าคงที่ที่เป็นข้อมูลจริง ไม่ใช่ label UI**:

- `STATUS` — 4 สถานะของ transaction: `NEW` ('คำขอใหม่'), `PENDING`
  ('อยู่ระหว่างเสนออนุมัติ'), `APPROVED` ('อนุมัติแล้ว'), `SETTLED` ('ชำระแล้ว')
- `DECISION` — 2 คำตัดสิน: `APPROVE` ('อนุมัติ'), `REJECT` ('ไม่อนุมัติ')
- **เหตุผลที่ค่าเหล่านี้เป็นภาษาไทยดิบ ไม่ใช่คีย์แปลภาษา**: สตริงเหล่านี้ถูก **เก็บจริงใน
  ฐานข้อมูล** (`credit.transactions.status`, `credit.requests.status`) และถูก validate
  ด้วย Zod enum ฝั่ง backend (`decisionSchema` ใน `credit.js`) — การแปลสถานะเหล่านี้เป็น
  ภาษาอังกฤษจะเปลี่ยนสิ่งที่ถูกเขียนลงฐานข้อมูลจริง จึงคงไว้เป็นภาษาไทยเสมอ ส่วนที่แปลได้
  คือ *label ที่แสดงผล* เท่านั้น (คีย์ `status.*` ใน `i18n.js`)
- `statusMeta(s)` — map สถานะดิบไปเป็น `{ tone, key, raw }` สำหรับแสดงป้าย — รองรับทั้ง
  สถานะปกติ, สถานะ legacy แบบตัวพิมพ์เล็ก ('active' = อนุมัติแล้ว, 'void' = ยกเลิก) และ
  **คำตัดสินดิบของคำขอ** (เพราะคำขอที่ตัดสินแล้วมี status เป็น `DECISION.APPROVE`/`REJECT`
  ไม่ใช่ `STATUS.APPROVED`)
- `isAuthorized(s)` — true เมื่อสถานะคือ "อนุมัติแล้วและยังค้างอยู่" (นับรวมวงเงินที่ใช้ไป)
  — ตรวจสามรูปแบบ: `STATUS.APPROVED`, `DECISION.APPROVE`, หรือ 'active' (case-insensitive)
- `KIND_SHORT` — ป้ายย่อของแต่ละ kind (LG→BG, TL→T/L, AVAL→B/E, PN→P/N, ML→M/L, DLC→DLC,
  PNPOST→PN-post) — ใช้เป็น fallback เมื่อยังไม่มีข้อมูล `facility_types.doc_kind` จาก
  ฐานข้อมูลจริง (คอลัมน์นี้เป็นแหล่งความจริงหลัก, ค่าคงที่นี้เป็นแค่ fallback)
- `BG_PARTS = [1, 2, 3]`, `BE_FOLD_INTO = 6`, `BE_FOLDED = [5, 9, 10]` — ตรรกะการพับรวม
  วงเงินที่ Dashboard ใช้ (ดูหัวข้อ 3.2)
- `PLAN_EXCLUDE = { HO: 1, LPB: 1 }` — โครงการที่ไม่เข้าร่วมแผนการเงิน
- `COST_CATEGORY_DEFAULTS` — รายการหมวดค่าใช้จ่ายสำรอง (ใช้เฉพาะตอนที่ `GET
  /cost-categories` ยังไม่ตอบ) รายการจริงมาจาก `credit.cost_categories` และแก้ไขได้
  ผ่าน Settings
- `facRatePct()` / `facAvail()` — ดึงอัตราดอกเบี้ยตัวเลข (ถ้ามี) และวงเงินคงเหลือของ
  facility หนึ่งรายการ

### 7.4 lib/format.js — การจัดรูปแบบเงินและวันที่

- `money(n)` — จัดรูปแบบเลขคั่นหลักพัน ไม่มีทศนิยม (`toLocaleString('en-US', {
  minimumFractionDigits: 0, maximumFractionDigits: 0 })`)
- `moneyVal(s)` / `fmtMoneyStr(v)` — แปลงสตริงเงิน (มี comma) กลับเป็นตัวเลข และจัดรูปแบบ
  ขณะพิมพ์ (ใส่ comma อัตโนมัติ คงทศนิยมที่พิมพ์ไว้)
- `parseDue(s)` — แปลงค่าครบกำหนดเป็น `Date` รองรับทั้ง dd/mm/yyyy และเลข serial ของ Excel
  (ข้อมูลเก่าที่หลุดมาจากชีต)
- `dueBucket(s)` — จัดกลุ่มวันครบกำหนดเป็น `'overdue' | 'this' | 'next' | 'later' | ''`
  **กฎสำคัญ**: ทั้งเดือนปัจจุบันถือเป็น "เดือนนี้" แม้วันจะผ่านไปแล้วในเดือนนั้น (ยังไม่ใช่
  "เกินกำหนด") — เกินกำหนดหมายถึง "ก่อนเดือนนี้" เท่านั้น
- `isDueWithin7(s)` — ครบกำหนดวันนี้ถึงอีก 7 วันข้างหน้า (รวมทั้งสองปลาย) — **เป็นอิสระ
  จาก `dueBucket()`** รายการหนึ่งอาจนับทั้ง "เดือนนี้" และ "ภายใน 7 วัน" พร้อมกัน
- `daysOverdue(due)` — จำนวนวันที่เกินกำหนด (0 ถ้ายังไม่เกิน)
- `isoToDMY()` / `dmyToISO()` — แปลงระหว่างรูปแบบ `<input type="date">` (ISO) กับรูปแบบ
  ที่ API ใช้จริง (dd/mm/yyyy) — **wire format ของโมดูลนี้คือ dd/mm/yyyy เสมอทั้งสองทาง**
  ตรงกับที่ชีตเดิมใช้
- ชุดฟังก์ชัน start/days/maturity (`matFromStartDays`, `daysFromStartMat`,
  `startFromMatDays`) — ใช้ใน `RequestDialog` (ดูหัวข้อ 5.1)

### 7.5 lib/exportExcel.js — Export Excel

ใช้ไลบรารี **SheetJS (xlsx)** โหลดแบบ dynamic import (`await import('xlsx')`) เพื่อไม่ให้
โค้ดหลายร้อย KB นี้อยู่ใน bundle เริ่มต้น — โหลดเฉพาะตอนกดปุ่ม Export เท่านั้น

**ทำงานฝั่ง client ทั้งหมด** (ต่างจากเดิมที่ Apps Script สร้างไฟล์ฝั่งเซิร์ฟเวอร์ผ่าน
Google Sheet ชั่วคราวแล้ว export จาก Drive) — export ข้อมูลที่ **กรองอยู่บนจอขณะนั้น
เท่านั้น** ("export สิ่งที่กำลังดูอยู่")

สร้าง workbook สูงสุด 3 ชีต: Facilities, Transactions, Requests (ชีตไหนไม่มีข้อมูลจะไม่
ถูกสร้าง) — ค่าเงินถูกเขียนเป็น **ตัวเลขจริง** ไม่ใช่สตริงที่จัดรูปแบบแล้ว (เช่น "฿1,234")
เพราะไฟล์ที่ export ออกไปมีไว้ให้เปิดใน Excel เพื่อรวม/กรองต่อ ถ้าเป็นสตริง Excel จะบวก
เลขไม่ได้ ถ้า workbook ว่างเปล่าทั้งหมด (ไม่มีข้อมูลจากทั้งสามชุด) จะสร้างชีต "Empty" ที่
มีข้อความ "No data" แทน เพื่อป้องกัน SheetJS โยน error กรณี workbook ไม่มีชีตเลย

หมายเหตุจาก PORT_NOTES.md: `TECH_STACK.md` กำหนด ExcelJS เป็นไลบรารีมาตรฐานสำหรับสร้าง
Excel **ฝั่งเซิร์ฟเวอร์** — ถ้าจะย้าย export ไปทำที่ฝั่ง API ในอนาคต ให้ใช้ ExcelJS ไม่ใช่
xlsx (xlsx ถูกคงไว้ที่นี่เพราะเป็น dependency เดิมของโมดูลอยู่แล้วสำหรับงานฝั่ง client นี้)

### 7.6 lib/lookups.js — ฟังก์ชันค้นหา/กรองข้อมูลอ้างอิง

ฟังก์ชันหลักที่ใช้ทั่วทั้งโมดูล:
- `projName()`/`projTh()`/`projThShort()`/`projCompany()` — แปลงรหัสโครงการเป็นชื่อไทย/
  บริษัท (fallback เป็นรหัสถ้าไม่มีข้อมูลอ้างอิง)
- `typeName()`/`typeKind()`/`kindShort()` — แปลงหมายเลข facility เป็นชื่อ/kind/ป้ายย่อ
- `matchKind()` — ตรรกะการจับคู่ตัวกรอง "ประเภทวงเงิน" ที่ **ซับซ้อนกว่าการเทียบตรง ๆ**:
  ถ้าตัวกรองคือ `'AVAL'` (คือตัวกรอง B/E บน Dashboard) จะรวมทุก kind ที่ใช้วงเงินร่วมกัน
  (`AVAL`, `LGM`, `DLC`, `PNPOST`) — ตรงกับตรรกะการพับรวมใน Dashboard; ถ้าตัวกรองคือ
  `'LG'` (ตัวกรอง BG) จะจับเฉพาะ kind `LG` เท่านั้น (ครอบคลุมสามรายการหนังสือค้ำประกัน
  เพราะทั้งสามใช้ kind เดียวกัน)
- `applyFilters()` / `filterFacilities()` — ใช้ตัวกรองทั้งหมด (project, company, kind,
  due, status, คำค้นหา) กับ list ของ transaction/request หรือ facility ตามลำดับ
- `overdueInterest()` — ดูหัวข้อ 5.3
- `attachText()` — ประกอบข้อความคอลัมน์ "เอกสารแนบ" จาก `source` + ช่วงวันที่เอกสาร
  (`docFrom`–`docTo`)

---

## 8. Data Flow: API Endpoints ทั้งหมด (`/api/credit`)

ทุก endpoint mount ผ่าน `router.use(requireAuth)` — **ต้องล็อกอินเท่านั้น ไม่มีการเช็ค
role เพิ่มเติมสำหรับการอ่าน** (ดูหัวข้อ 9 สำหรับรายละเอียดสถานะสิทธิ์การเข้าถึง) ส่วนการ
**เขียน** ทั้งหมดผ่าน middleware `manager = requireRole('credit', 'manager')`

### 8.1 อ่านข้อมูล (GET)

| Endpoint | คืนอะไร | หมายเหตุ |
|---|---|---|
| `GET /data` | `{ me, facilities, costCategories, categoryCaps, transactions, requests, projects, facTypes }` — ข้อมูลทั้งโมดูลในคำขอเดียว | ยิง 7 query พร้อมกันด้วย `Promise.all`; `facilities[].used`/`.available` มาจาก view `credit.facility_used` เข้าร่วมกับตาราง `credit.limits` เพื่อบอกว่ามี override หรือไม่ |
| `GET /facilities` | รายการวงเงินอย่างง่าย (project, facilityNo, limit, used, available) | ไม่รวม `me`/reference data |
| `GET /transactions?project=&facilityNo=&status=` | รายการ transaction ที่กรองแล้ว | ใช้ parameterized query ทุกตัวกรอง (ไม่มีช่องโหว่ SQL injection) |
| `GET /requests?project=&status=` | รายการคำขอที่กรองแล้ว | |
| `GET /cost-categories` | array ของชื่อหมวด | เรียงตาม `sort_order` |
| `GET /projects` | รายการโครงการ (`code, th, company, sortOrder`) | มีอยู่จริงในโค้ด backend ปัจจุบัน (route นี้เคยขาดหายในช่วงพอร์ต — ดูหัวข้อ "สิ่งที่ API เคยขาด" ด้านล่าง) |
| `GET /facility-types` | รายการประเภทวงเงิน 10 แบบ (`no, code, th, en, kind, docKind`) | เช่นเดียวกัน มีอยู่จริงแล้ว |
| `GET /cash-plan?project=&month=&variant=` | array ของ period (T-bar sections) | `variant` เป็น `'plan'` หรือ `'actual'`, default `'plan'` |
| `GET /audit?limit=` | ประวัติการเปลี่ยนแปลงทั้งหมด | **เฉพาะผู้บริหาร** (`manager` middleware) — จำกัด limit สูงสุด 1000 แถว |

### 8.2 เขียนข้อมูล (POST/PATCH/PUT/DELETE) — ทั้งหมดเฉพาะผู้บริหาร

| Endpoint | หน้าที่ | จุดสำคัญ |
|---|---|---|
| `POST /requests` | สร้างคำขอ | id รูปแบบ `REQ-<timestamp>-<random>` |
| `PATCH /requests/:id` | แก้ไขคำขอ | `coalesce($n, column)` — เฉพาะฟิลด์ที่ส่งมาเท่านั้นจะถูกแก้ |
| `POST /requests/:id/decide` | อนุมัติ/ไม่อนุมัติ | ดูหัวข้อ 4.3 — ล็อกแถวด้วย `FOR UPDATE`, สร้าง transaction คู่กันถ้าอนุมัติ, 409 `ALREADY_DECIDED` ถ้าตัดสินไปแล้ว |
| `DELETE /requests/:id` | ลบคำขอ | 404 ถ้าไม่พบ |
| `POST /transactions` | บันทึกรายการเบิกใช้/ปลดวงเงิน | id รูปแบบ `TXN-<timestamp>-<random>` |
| `PATCH /transactions/:id` | แก้ไขรายการ | เช่นเดียวกับ requests — coalesce เฉพาะฟิลด์ที่ส่งมา |
| `POST /transactions/:id/status` | ตั้งสถานะโดยตรง | รับ `{status}` string ใด ๆ ที่ ≤60 อักขระ |
| `POST /transactions/:id/settle` | ชำระ/ปิดรายการ | guard ในคำสั่ง UPDATE เดียว, 409 `ALREADY_SETTLED`/`NOTHING_OWING` |
| `DELETE /transactions/:id` | ลบรายการ | |
| `PUT /limits` | ตั้งวงเงิน (limit) | upsert บน `(project, facility_no)` |
| `PUT /limits/used-override` | pin/unpin ยอดใช้ไป | `used: null` ล้าง override |
| `PUT /category-caps` | ตั้ง/ล้างงบหมวดค่าใช้จ่าย | `cap: null` + ไม่มีแถวเดิม = no-op |
| `PUT /cost-categories` | แทนที่รายการหมวดทั้งชุด | ลบทั้งหมดแล้ว insert ใหม่ในทรานแซกชันเดียว เพื่อรักษาลำดับ |
| `PUT /cash-plan` | สร้าง/แก้ไขหนึ่ง period ของ T-bar | upsert บน `(project, month, period_idx, variant)` |
| `DELETE /cash-plan/:id` | ลบ period หนึ่งส่วน | |

ทุกการเขียนเขียน **audit log** ลงตาราง `credit.audit` ภายในทรานแซกชันเดียวกับการเขียนจริง
(ฟังก์ชัน `audit()` รับ `client` ของทรานแซกชันโดยตรง — ถ้าทรานแซกชันถูก rollback แถว audit
ก็จะหายไปด้วย ไม่เกิด audit log ที่โกหกว่ามีการเขียนสำเร็จ)

### 8.3 รูปแบบข้อมูลบนสาย (wire format) ที่ต้องรู้

- **วันที่**: ทุกวันที่ระหว่าง client-API เป็น `dd/mm/yyyy` (ฟังก์ชัน `dmy()`/`toDate()`
  ใน backend) — ไม่ใช่ ISO เหมือนปกติ เพราะตามรูปแบบเดิมของชีต Apps Script
- **`due` vs `maturity`**: ฐานข้อมูลมีคอลัมน์เดียวคือ `due_date` — route
  `toTransaction()` map ให้ออกมาเป็น **ทั้ง** `due` และ `maturity` (สองชื่อ ค่าเดียวกัน);
  ฝั่ง client อ่าน `due` จาก transaction และอ่าน `maturity` จาก request ให้ตรงกับสิ่งที่
  endpoint แต่ละอันคืนจริง
- **`credit.facilities.interest` เป็น TEXT**: ข้อความอิสระภาษาไทย (เช่น "MLR ต่อปี") —
  แสดงตรงตัวเสมอ ไม่แปลงเป็นตัวเลข ค่าประมาณดอกเบี้ยเกินกำหนดจะดึงเฉพาะตัวเลขนำหน้า
  เครื่องหมาย % เท่านั้น และคืน `null` เมื่อไม่มีตัวเลขให้ดึง

---

## 9. การควบคุมสิทธิ์การเข้าถึง (Access Control) — สถานะปัจจุบัน

**สำคัญมาก**: `credit.js` (บรรทัด 26-32) mount แค่ `requireAuth` เป็น middleware ระดับ
โมดูล **ไม่มีการเช็ค role ใด ๆ เพิ่มเติมสำหรับสิทธิ์การอ่าน** — หมายความว่า:

- **การอ่านข้อมูล** (`GET /data`, `/transactions`, `/requests`, ฯลฯ) เปิดให้ **ผู้ที่
  ล็อกอินเข้าระบบแล้วทุกคน** อ่านได้ ไม่ว่าจะมี role อะไรในระบบหรือไม่มีเลยก็ตาม
  (ยกเว้น `GET /audit` ที่ล็อกด้วย `manager` middleware แยกต่างหาก)
- **การเขียนข้อมูล** ทั้งหมดยังคงถูกล็อกด้วย `requireRole('credit', 'manager')` จริง
  (ตัวแปร `manager` ในโค้ด) — ผู้ใช้ทั่วไปอ่านได้แต่เขียน/อนุมัติ/แก้ไขไม่ได้

**นี่ไม่ใช่ข้อผิดพลาด แต่เป็นการตัดสินใจโดยเจตนา** ตามที่ระบุในคอมเมนต์ต้นไฟล์และใน
`docs/ACCESS_MODEL.md`:

> "สิทธิ์การเข้าถึงถูกบริหารจากพอร์ทัล (และการตั้งค่าของแต่ละแอปเอง) แต่ยังไม่ได้เดินสาย
> ไว้จริง — การล็อกตรงนี้ตอนนี้จะปิดกั้นทุกคนออกจากโมดูลที่ยังไม่มีใครสามารถให้สิทธิ์ได้"

จากเอกสาร `docs/ACCESS_MODEL.md` หัวข้อ "What is NOT wired":

- ระบบสิทธิ์แบบใหม่ (`portal.access_grants`, endpoint `/api/portal/access/*`) มีโครงสร้าง
  พร้อมแล้ว แต่ **`resolveRoles()` ใน `api/src/auth.js` ยังอ่านจากตารางเดิมทีละโมดูล**
  (`credit.managers` สำหรับโมดูลนี้) — การให้สิทธิ์ผ่านหน้าจอใหม่จะเปลี่ยนสิ่งที่ *แสดงผล*
  บนหน้าจอ admin แต่ **ไม่เปลี่ยน** ว่าใครเปิดโมดูลนี้ได้จริง
- ลำดับงานที่เหลือก่อนจะ "ปิดประตู" โมดูลนี้ได้จริง: (1) สร้างหน้าจอจัดการสิทธิ์ 2 หน้า
  (2) backfill ข้อมูลจากตารางเดิมเข้า `access_grants` แล้ว diff ให้ตรงกับ `resolveRoles()`
  ปัจจุบันทุกคน (3) สลับ `resolveRoles()` ให้อ่านจาก `access_grants` แทน (4) **จากนั้นเท่านั้น**
  ถึงจะเพิ่ม role-guard ระดับ router ได้จริง
- โค้ดใน `credit.js` มีคอมเมนต์กำกับไว้ชัดเจนว่าจุดที่ต้องเพิ่ม guard คืออะไร (เปลี่ยน
  `router.use(requireAuth)` เป็น `router.use(requireRole('credit', 'viewer'))` หรือ
  ระดับที่เหมาะสม) — เป็นการเปลี่ยนบรรทัดเดียวเมื่อพร้อม
- Vocabulary ของ role สำหรับโมดูลนี้ที่กำหนดไว้แล้ว (แม้ยังไม่บังคับใช้): `viewer` →
  `manager` (เรียงจากสิทธิ์น้อยไปมาก)

**สรุปนัยเชิงปฏิบัติ**: ในสภาพแวดล้อมที่ deploy จริงตอนนี้ พนักงานที่ล็อกอินเข้า VCB
Connect ได้ (ไม่ว่าจะมีสิทธิ์อะไรในระบบ role) จะสามารถ **ดู** ข้อมูลวงเงินสินเชื่อ,
รายการเบิกใช้, คำขอ, แผนการเงิน และ audit-adjacent ข้อมูล (ยกเว้น audit trail เอง) ของ
บริษัทได้ทั้งหมด แต่จะ **แก้ไข/อนุมัติ/บันทึกอะไรไม่ได้เลย** เว้นแต่ถูกกำหนดเป็น manager
ในตาราง `credit.managers` เดิม — ทีมงานดูแล deploy ควรตระหนักว่านี่คือ "demo mode" ที่ตั้งใจ
ให้เปิดกว้างชั่วคราว ไม่ใช่บั๊กด้านความปลอดภัยที่ต้องรีบแพตช์ทันที แต่ก็ไม่ควรมองข้ามเมื่อ
วางแผนการเปิดใช้งานจริงกับข้อมูลการเงินที่ละเอียดอ่อน

---

## 10. ข้อจำกัดหรือสิ่งที่ยังไม่รองรับ (จาก PORT_NOTES.md)

### 10.1 Route ที่เคยขาดหายระหว่างพอร์ต — ปัจจุบันมีแล้ว

`PORT_NOTES.md` ระบุไว้ (ตอนเขียนเอกสารพอร์ต) ว่า `GET /api/credit/projects` และ `GET
/api/credit/facility-types` **ยังไม่มี** ในขณะนั้น และ `GET /data` ไม่รวมสองชุดนี้มาด้วย
— ทำให้ต้อง fallback เป็นรหัสโครงการดิบแทนชื่อไทย และตัวกรองบริษัทว่างเปล่า

**สถานะจริงในโค้ด backend ปัจจุบัน** (`api/src/routes/credit.js` ที่อ่านในเอกสารนี้):
ทั้งสอง route **มีอยู่แล้วจริง** (บรรทัด 457-500) และ `GET /data` **ก็คืนทั้ง `projects`
และ `facTypes` มาด้วยแล้ว** (บรรทัด 368-381) — ดังนั้นช่องว่างที่ PORT_NOTES.md อธิบายไว้
ได้รับการแก้ไขแล้วในซอร์สโค้ดจริง แต่ฝั่ง client (`src/lib/api.js`, `src/lib/DataContext.jsx`)
ยังคงเก็บกลไก fallback (`optional()`, `normalizeProjects()`, `normalizeFacTypes()`) ไว้
เผื่อกรณี deploy environment ใดที่ backend เวอร์ชันเก่ากว่ายังไม่มี route เหล่านี้ — โค้ด
ฝั่ง client จึงทำงานถูกต้องทั้งสองกรณี (มี route หรือไม่มีก็ตาม)

### 10.2 ข้อจำกัดที่ยังคงอยู่จริงในปัจจุบัน

1. **ไม่มี `PATCH /facilities`** — วงเงิน (limit) แก้ได้ผ่าน `PUT /limits` แต่ฟิลด์
   `type`, `interest`, `notes` ของ facility เป็น **read-only ในหน้าจอ** ไม่มี route
   ให้แก้ไขค่าพวกนี้เลย
2. **การแก้ไขแผนการเงินยังหยาบ (coarse)** — `PUT /cash-plan` แทนที่ "ทั้งช่วง (period)"
   ในคราวเดียว ระบบ Apps Script เดิมแก้บรรทัดรายรับ/รายจ่ายแต่ละช่องแบบ debounce ทีละเซลล์
   ได้ แต่เวอร์ชันนี้ทำได้แค่สร้าง/ลบ "ส่วน (section)" ทั้งก้อน — การแก้ไขราย
   บรรทัดย่อยภายในหนึ่งส่วนต้องรอ endpoint ที่ละเอียดกว่านี้ หรือกลไก
   local-draft-then-save
3. **`exportXlsx` ไม่มี server route** — export ทำงานฝั่ง client ทั้งหมดด้วย SheetJS จาก
   ข้อมูลที่กรองอยู่บนจอ (ดูหัวข้อ 7.5) `TECH_STACK.md` กำหนด ExcelJS ไว้สำหรับงาน
   generate ฝั่งเซิร์ฟเวอร์ — ถ้าต้องย้าย export ไปทำที่ API ในอนาคต ควรใช้ ExcelJS
4. **สิทธิ์การเข้าถึงยังไม่ล็อกระดับการอ่าน** — ดูหัวข้อ 9 โดยละเอียด
5. **อัตราดอกเบี้ยที่ไม่ใช่ตัวเลข** — `credit.facilities.interest` เป็นข้อความอิสระ
   ระบบไม่พยายามตีความอัตราที่ซับซ้อนกว่ารูปแบบ "ตัวเลข%" ธรรมดา (เช่น "MLR ต่อปี" หรือ
   "1.25% ต่อปีเรียกเก็บทุก 3 เดือน" จะถูกดึงได้แค่ตัวเลข 1.25 เท่านั้น ส่วนเงื่อนไข
   "เรียกเก็บทุก 3 เดือน" จะไม่ถูกนำไปคำนวณ)
6. **แท็บ "แผนการเงิน" และ "ผลต่าง"** มีป้าย `tab.planDevNote` = "อยู่ระหว่างการพัฒนา"
   ติดอยู่ที่ tooltip ของแท็บ `/plan`, `/actual`, `/variance` ใน `App.jsx` (`TABS` array)
   — เป็นสัญญาณบอกผู้ใช้ว่าฟีเจอร์กลุ่มนี้ยังไม่นิ่งเท่าแท็บอื่น

### 10.3 สิ่งที่ระบบเดิม (Apps Script/mock) มีบั๊กและได้รับการแก้ไขแล้ว

- **คำขอไม่สามารถอนุมัติได้เลย** — mock เดิมเขียนคำขอลง array `transactions` แต่
  `decideRequest()` ค้นหาใน array `requests` ที่ไม่มีใครเขียนอะไรลงไปเลย ปัจจุบันมีตาราง
  จริงสองตารางแยกกันและเชื่อมโยงกันถูกต้องผ่าน `linked_txn` (ดูหัวข้อ 4.3)
- **ป้ายสถานะของคำขอที่อนุมัติ/ไม่อนุมัติแล้วแสดงผิด** — เพราะสถานะการตัดสินใจ
  (`DECISION.APPROVE`/`REJECT`) เป็นคนละสตริงกับสถานะ transaction (`STATUS.APPROVED`)
  — `statusMeta()` ปัจจุบันรองรับทั้งสองแบบแล้ว (ดูหัวข้อ 7.3)
- **ค่าว่างในช่องจำนวนวัน (days) เคยดึงวันที่ทั้งสองช่องให้ตรงกันโดยไม่ตั้งใจ** —
  เพราะ `Number('') === 0` เป็นค่าที่ finite ทำให้ตรรกะเดิมเข้าใจผิดว่าเป็น "0 วัน" ปัจจุบัน
  ใช้ `parseDays()` ที่แยกกรณี "สตริงว่าง" ออกจาก "0" อย่างชัดเจน (ดูหัวข้อ 7.4)

### 10.4 โค้ดที่ไม่ถูกเรียกใช้ (Dead code)

- **`src/components/SignIn.jsx` ไม่ถูก import จากที่ใดเลย** — ตรวจสอบเมื่อ 2026-09-05 โดย
  ค้นทั้ง `credit-facility/src/` ด้วยคำว่า `SignIn` พบการอ้างอิงเฉพาะภายในตัวไฟล์เองเท่านั้น
  แปลว่าหน้าจอนี้เข้าไม่ถึงในแอปที่รันจริง (การ sign-in ของโมดูลนี้ทำผ่าน `AuthProvider` ของ
  `@vcb/shared` ร่วมกับทุกโมดูล ไม่ได้ใช้หน้าจอเฉพาะของตัวเอง) — **ทีมพัฒนาควรตัดสินใจว่าจะลบ
  ทิ้งหรือเชื่อมเข้าระบบ** ปัจจุบันมันถูกรวมเข้าบันเดิลโดยไม่มีใครใช้

---

## 11. รายการไฟล์อ้างอิงทั้งหมด

| ไฟล์ | หน้าที่ |
|---|---|
| `credit-facility/src/App.jsx` | Shell, routing, provider composition |
| `credit-facility/src/components/Header.jsx` | แถบบนสุด (ใช้ shared `AppBar`) |
| `credit-facility/src/components/Dashboard.jsx` | การ์ดสรุปและตรรกะการคำนวณ |
| `credit-facility/src/components/FilterBar.jsx` | แถบตัวกรองร่วม |
| `credit-facility/src/components/RequestDialog.jsx` | ฟอร์มคำขอสินเชื่อ |
| `credit-facility/src/components/TxnDialog.jsx` | ฟอร์มบันทึกการใช้วงเงิน |
| `credit-facility/src/components/TxnDetailDialog.jsx` | รายละเอียด + ชำระ/ลบ transaction |
| `credit-facility/src/components/LimitDialog.jsx` | ปรับวงเงิน/ใช้ไป |
| `credit-facility/src/components/CapDialog.jsx` | ตั้งงบหมวดค่าใช้จ่าย |
| `credit-facility/src/components/CostCategoryPicker.jsx` | ตัวเลือกหมวดค่าใช้จ่าย |
| `credit-facility/src/components/SettingsDialog.jsx` | ตั้งค่าขั้นสูง |
| `credit-facility/src/components/SignIn.jsx` | หน้าล็อกอิน |
| `credit-facility/src/components/ui.jsx` | Primitive UI ทั้งหมด (Button, Modal, Meter ฯลฯ) |
| `credit-facility/src/views/FacilitiesView.jsx` | ตารางวงเงิน |
| `credit-facility/src/views/LedgerView.jsx` | ตาราง transaction |
| `credit-facility/src/views/RequestsView.jsx` | คิวคำขอ + อนุมัติ |
| `credit-facility/src/views/CostView.jsx` | สรุปค่าใช้จ่าย |
| `credit-facility/src/views/PlanView.jsx` | แผนการเงิน T-bar (plan/actual) |
| `credit-facility/src/views/VarianceView.jsx` | เทียบแผน vs จริง |
| `credit-facility/src/lib/DataContext.jsx` | Store กลาง, reload/mutate |
| `credit-facility/src/lib/FilterContext.jsx` | State ตัวกรองร่วม |
| `credit-facility/src/lib/DashPrefsContext.jsx` | Preference การแสดงผลแดชบอร์ด |
| `credit-facility/src/lib/domain.js` | ค่าคงที่โดเมน (status, kind, fold rules) |
| `credit-facility/src/lib/format.js` | เงิน/วันที่/due bucket |
| `credit-facility/src/lib/lookups.js` | ฟังก์ชันค้นหา/กรองข้อมูลอ้างอิง |
| `credit-facility/src/lib/i18n.js` | Dictionary ภาษาไทย/อังกฤษของโมดูล |
| `credit-facility/src/lib/api.js` | เรียก endpoint ทั้งหมด |
| `credit-facility/src/lib/exportExcel.js` | Export Excel ฝั่ง client |
| `credit-facility/PORT_NOTES.md` | บันทึกการพอร์ตจาก Apps Script |
| `api/src/routes/credit.js` | Express route ทั้งหมดของโมดูล |
| `docs/ACCESS_MODEL.md` | โครงสร้างสิทธิ์การเข้าถึงทั้งระบบ VCB Connect |
