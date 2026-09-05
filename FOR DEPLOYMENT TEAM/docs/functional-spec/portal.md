# Portal — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> เอกสารนี้อธิบายโมดูล **Portal** ของระบบ VCB Connect ตามโค้ดจริงที่ implement อยู่ที่
> `FOR DEPLOYMENT TEAM/portal/` (React 18 + Vite 5 + Tailwind 3) และ backend ที่
> `FOR DEPLOYMENT TEAM/api/src/routes/portal.js` (Express + PostgreSQL ผ่าน Zod validation)
> ข้อมูลอ้างอิงจากซอร์สโค้ดจริง ไม่ใช่จากเอกสารเก่า — `README.md` และ `STATUS.md` ในโฟลเดอร์
> `portal/` เป็นเอกสารตกค้างจากสถาปัตยกรรมรุ่นก่อน (TypeScript + mock backend ใน
> localStorage) ซึ่ง**ไม่ตรงกับโค้ดปัจจุบันแล้ว** ข้อมูลที่ถูกต้องและเป็นปัจจุบันที่สุดอยู่ใน
> `PORT_NOTES.md` และในซอร์สโค้ดเอง

---

## 1. ภาพรวมของโมดูล

**Portal** คือ "หน้าประตูบ้าน" (front door) ของระบบ VCB Connect ทั้งหมด เป็นจุดแรกที่พนักงาน
ของบริษัท VCB Group เข้าถึงเมื่อเปิดระบบอินทราเน็ต หน้าที่หลักคือ:

1. เป็นหน้า **sign-in** ของทั้งระบบ (SSO ผ่าน Google หรือ email/password)
2. เป็น **launcher / dashboard** ที่รวมลิงก์ไปยังโมดูลย่อยทั้งหมดของ VCB Connect (E-Memo,
   Meeting Minutes, SOP, System Map, HR Work Log, Credit Facility Manager ฯลฯ) ไว้เป็น
   "ตึกแอป" (app tiles) ในที่เดียว
3. แสดง**ประกาศ (announcement)** จากบริษัทที่ผู้ดูแลระบบ (admin) เผยแพร่ให้ทุกคนเห็น
4. แสดง**ปฏิทินวันหยุด**, พาเนลวันเกิด, และพาเนลผู้ลาวันนี้ (สองพาเนลหลังยังเป็นข้อมูลตัวอย่าง)
5. มีเมนู **ตั้งค่า** สำหรับสลับภาษา (ไทย/อังกฤษ) และธีม (สว่าง/มืด/ตามระบบ)
6. มีฟอร์ม **แจ้งปัญหา (Help & Support)** และหน้าจอ**จัดการประกาศ**สำหรับแอดมิน

**ผู้ใช้งาน:** พนักงานทุกคนของ VCB Group ที่มีบัญชี (ผ่าน Google Workspace โดเมน
`vcb-con.com` หรือบัญชี email/password ที่ IT สร้างให้ เช่น พนักงานหน้างานไซต์ก่อสร้างที่ไม่มี
บัญชี Google) และผู้ดูแลระบบ (portal admin) ที่มีสิทธิ์เพิ่มเติมในการจัดการประกาศและ (ในอนาคต)
จัดการสิทธิ์การเข้าถึงแอปต่าง ๆ

---

## 2. สถาปัตยกรรมโดยสังเขป

- **Frontend:** React 18 + Vite 5 + Tailwind 3, ไม่มี UI library ภายนอก (คอมโพเนนต์ปุ่ม/ฟอร์ม/โมดัล
  เขียนเองใน `src/ui.jsx`)
- **State management:** React Context + `useState` เท่านั้น (ไม่มี Redux/Zustand) — auth, i18n,
  theme มาจาก package กลาง `@vcb/shared` ที่ทุกโมดูลของ VCB Connect ใช้ร่วมกัน
- **Data flow:** เบราว์เซอร์ไม่ต่อฐานข้อมูลโดยตรงเด็ดขาด ทุกอย่างเรียกผ่าน REST API เดียวที่
  `api/src/routes/portal.js` โดยมี `src/lib/portalApi.js` เป็น wrapper
- **Routing:** React Router 6 — มีเพียง 2 เส้นทางที่มีความหมาย: `/` (dashboard) และ `/admin`
  (เปิดหน้าต่างจัดการประกาศทับ dashboard)

---

## 3. รายการฟังก์ชันทั้งหมด

### 3.1 หน้าจอเข้าสู่ระบบ (Sign-in) — `src/SignInScreen.jsx`

**ทำอะไรได้:**
ผู้ใช้ที่ยังไม่ได้ล็อกอินจะเห็นหน้านี้แทน dashboard เสมอ มีฉากหลังเป็นแอนิเมชันลูกโลกดิจิทัล
(plexus network) ที่วิ่งอยู่ตลอดเวลา ตรงกลางมีการ์ดให้เลือกวิธีเข้าสู่ระบบ 2 ทาง:

- **ปุ่ม "Sign in with Google"** (น้ำหนักภาพเด่นที่สุด แสดงก่อนเสมอ) — สำหรับพนักงานที่มีบัญชี
  Google ขององค์กร (โดเมน `vcb-con.com`) ไม่ต้องพิมพ์รหัสผ่านเลย
- **ปุ่ม "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน"** — สำหรับพนักงานหน้างาน/ไซต์ก่อสร้าง หรือเครื่องที่ใช้ร่วมกัน
  ที่อาจไม่มีบัญชี Google

**Logic การทำงานโดยละเอียด:**

- คอมโพเนนต์ใช้ `useAuth()` จาก `@vcb/shared` เพื่อดึง `signInWithGoogle`, `signInWithPassword`,
  `error`, `loading`
- มี local state `mode` ('choose' | 'password') ควบคุมว่าจะโชว์การ์ดเลือกวิธี หรือฟอร์ม
  email/password
- **Google sign-in:**
  - ใช้ hook `useGoogleIdToken()` จาก `src/lib/googleIdentity.js` ซึ่งโหลดสคริปต์
    Google Identity Services (GIS) จาก `https://accounts.google.com/gsi/client` แบบ dynamic
    (โหลดครั้งเดียว, cache เป็น module-level promise)
  - `CLIENT_ID` มาจาก env var `VITE_GOOGLE_CLIENT_ID` — ถ้าไม่ได้ตั้งค่า ปุ่มยังคงแสดงอยู่ (ไม่ซ่อน)
    แต่เมื่อกดจะได้ error message `auth.googleNotConfigured` ทันที (การตัดสินใจเชิงออกแบบ:
    ปุ่มที่มองไม่เห็นแล้วใช้งานไม่ได้แย่กว่าปุ่มที่บอกชัดว่าทำไมใช้ไม่ได้)
  - เมื่อกดปุ่ม: เรียก `google()` → `globeRef.current?.startLogin()` (trigger แอนิเมชันลูกโลก
    "แตกออก" เป็น visual cue) → `requestIdToken()` เปิด One Tap / account chooser ของ Google →
    ได้ `idToken` (JWT) → ส่งต่อให้ `signInWithGoogle(idToken)` ของ `AuthProvider`
  - `/api/auth/google` (ฝั่ง server) เป็นผู้ตรวจสอบ idToken กับ Google จริง ๆ (ไม่เชื่อ client)
  - แยก error 2 ประเภท: `googleError` (state ท้องถิ่น — ไม่มี client id, popup ถูกปิด/ยกเลิก) กับ
    `error` จาก `AuthProvider` (ล็อกอินไม่สำเร็จจริง เช่น token ไม่ผ่านการตรวจสอบ)
- **Password sign-in:**
  - ฟอร์ม email + password ปกติ, `required` ทั้งคู่, `type="email"`/`type="password"`
  - submit เรียก `signInWithPassword(email, password)`; error `BAD_CREDENTIALS` แสดงข้อความ
    "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ส่วน error อื่นแสดง "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"
- ปุ่มทั้งหมดถูก disable ระหว่าง `busy || loading` เพื่อกันการกดซ้ำ
- ฉากหลัง: `GlobeBackground.jsx` เป็น canvas animation วาด "ลูกโลกใยแมงมุม" (plexus network)
  ด้วย particle 260 จุด เชื่อมเส้นกัน, ฝุ่นละออง 950 อนุภาค, หมุนรอบตัวเองต่อเนื่อง — เมื่อเรียก
  `startLogin()` จะเข้าสู่ phase "deform" (แตกกระจายออกอย่างรวดเร็ว) ก่อนหายไป เป็นเพียง
  ตัวช่วยภาพ ไม่ block การนำทางจริง

### 3.2 การยืนยันตัวตนและ Guard หลัก — `src/App.jsx`, `src/main.jsx`

**ทำอะไรได้:** ตัดสินใจว่าจะโชว์หน้าล็อกอิน หรือ dashboard ให้ผู้ใช้ที่ล็อกอินแล้ว

**Logic การทำงาน:**

- Provider order ใน `main.jsx`: `ThemeProvider` → `I18nProvider` (ภาษาเริ่มต้น = `en`) →
  `AuthProvider` (รับ `api` instance เดียวกับที่ `portalApi.js` ใช้ เพื่อให้ token/การจัดการ 401
  ใช้ร่วมกันทุกจุด) → `BrowserRouter` → `App`
- `App.jsx` ดึง `user`, `authLoading`, `hasRole` จาก `useAuth()`
  - ระหว่าง `authLoading === true` (กำลังตรวจสอบ token ที่เก็บไว้กับ `/auth/me`) จะโชว์
    ข้อความ "กำลังโหลด…" กลางจอ ไม่โชว์หน้าล็อกอินก่อน เพื่อไม่ให้ผู้ที่ล็อกอินอยู่แล้วเห็นหน้า
    sign-in กระพริบ
  - ถ้า `authLoading` เสร็จแล้วและ `!user` → แสดง `<SignInScreen />`
  - ถ้ามี `user` → แสดง dashboard เต็มรูปแบบ (Sidebar + Topbar + Dashboard + modals)
- `isAdmin = hasRole('portal', 'admin')` — ใช้ตัดสินทั้งการโหลด tile ที่ถูกปิดใช้งาน
  (`includeDisabled`) และการแสดงปุ่มจัดการประกาศ
- **การดึงรายการแอป (tiles):** `useEffect` ที่รอจน `authLoading` เสร็จก่อน แล้วเรียก
  `listApps({ includeDisabled: isAdmin, signal })` — ใช้ `AbortController` เพื่อยกเลิก request
  เก่าเมื่อ effect รันใหม่ (เช่นตอน `isAdmin` เปลี่ยนค่าหลัง auth settle) ถ้าเรียกไม่สำเร็จ (ไม่ใช่
  `AbortError`) จะตั้ง `appsError` เป็นข้อความ `apps.loadFailed` เพื่อบอกผู้ใช้ตรง ๆ ว่าโหลดไม่สำเร็จ
  (ไม่ปล่อยให้ grid ว่างเปล่าซึ่งดูเหมือนไม่มีแอปเลย)
- **การดึงประกาศ:** เรียก `getAnnouncement()` คล้ายกัน แต่ถ้า error จะเงียบ ๆ ตั้งเป็น `null`
  (พาเนล "ยังไม่มีประกาศ" จะแสดงแทน — ไม่ใช่เรื่องคอขาดบาดตายเท่ากับรายการแอป)
- **Deep-link ของ admin เก่า:** ถ้า URL มี `?admin=1` และอยู่ที่ path `/` จะ `navigate('/admin',
  {replace:true})` อัตโนมัติ — รองรับ bookmark เก่าจากเวอร์ชัน Apps Script ที่ใช้ query param นี้
  เปิดหน้าแอดมิน
- `nameFromEmail(email)`: แปลง local-part ของอีเมล (ก่อน @) เป็นชื่อที่อ่านง่าย โดยแทนที่
  `. _ -` ด้วยช่องว่างแล้ว capitalize ทุกคำ — ใช้เมื่อ `user.name` ไม่มีค่า

### 3.3 Sidebar (แถบเมนูด้านซ้าย) — `src/Sidebar.jsx`

**ทำอะไรได้:** แสดงเมนูนำทางไปยังโมดูลต่าง ๆ, ทางลัดไประบบภายนอก (ERP, Zoom), และปุ่ม
Help — คงอยู่ตลอดเวลา (sticky) บนจอกว้าง (`lg` ขึ้นไป), เป็น off-canvas แบบเลื่อนเข้า-ออก
บนจอเล็ก

**Logic การทำงาน:**

- แสดงตราสินค้า "VCB CONNECT" พร้อมป้ายบทบาทของผู้ใช้: `hasRole('portal','admin')` ?
  "แอดมิน" : "พนักงาน" (คีย์ `portal.adminRole` / `portal.staff`)
- **รายการแอปพลิเคชัน:** กรอง `apps.filter(a => a.key !== 'onboarding')` — Onboarding
  ถูกดึงออกมาแสดงแยกใต้หมวด "เพิ่มเติม" เพราะเป็นโปรแกรมปฐมนิเทศพนักงานใหม่ 90 วัน ไม่ใช่งาน
  ประจำวันของทุกคน — แต่ยัง**ดึง URL จาก `portal.apps`** เหมือนแอปอื่น ไม่ hardcode
- แต่ละลิงก์ผ่าน `appLink(a.url, {theme, lang, token})` (ดูหัวข้อ 3.9) เพื่อส่งต่อธีม/ภาษา/token
  ไปยังโมดูลปลายทาง เปิดในแท็บใหม่เสมอ (`target="_blank"`)
- **หมวดทางลัด (Shortcuts):** ลิงก์ไป ERP (Mango ERP) และ Zoom — เป็นค่าคงที่ hardcode ใน
  `data.js` (`SHORTCUT_LINKS`) เพราะเป็นระบบภายนอก ไม่ใช่ tile ของ `portal.apps`
- **หมวดเพิ่มเติม (More):** Onboarding (ถ้ามีใน apps list), ปุ่ม "AI Tavern" ที่ถูก `disabled`
  ถาวร (label "เร็ว ๆ นี้" — ฟีเจอร์ยังไม่เปิดใช้งาน), ปุ่ม Help ที่เปิด `HelpModal`
- ทุกลิงก์ผูก tooltip ผ่าน `bindTooltip()` ที่รับมาจาก parent (`App.jsx` → `useTooltip()`)
- มี scrim สีดำโปร่งแสงคลุมพื้นหลังเมื่อ sidebar เปิดบนมือถือ กดแล้วปิด sidebar

### 3.4 Topbar (แถบด้านบน) — `src/Topbar.jsx`

**ทำอะไรได้:** ช่องค้นหาแอป, ปุ่มเปิดเมนูมือถือ, เมนูตั้งค่า (ภาษา/ธีม/จัดการประกาศ/ช่วยเหลือ/
ออกจากระบบ), และป้ายแสดงอีเมลผู้ใช้ปัจจุบัน

**Logic การทำงาน:**

- ช่องค้นหา (`<input type="search">`) เป็น controlled input ผูกกับ `query` state ใน `App.jsx`
  ทุกครั้งที่พิมพ์จะเรียก `onQuery` ทันที (ไม่มี debounce เพราะกรองแค่ array ในหน่วยความจำ)
- **เมนูตั้งค่า (Settings dropdown):**
  - เปิด/ปิดด้วย local state `settingsOpen`; ปิดอัตโนมัติเมื่อคลิกนอกกรอบ (`mousedown` listener
    เช็ค `wrapRef.current.contains(e.target)`) หรือกด `Escape` — listener ผูกเฉพาะตอนเปิดอยู่
    เท่านั้น (ลบทิ้งเมื่อปิด เพื่อประหยัด event listener)
  - **สลับภาษา:** ตัวเลือกแบบ segmented control 2 ปุ่ม (ไทย/EN) เรียก `setLang()` จาก
    `useI18n()` — การตั้งค่าถูกเก็บ persistent (`vcb_lang` ใน localStorage ผ่าน `@vcb/shared`)
    และใช้ร่วมกันทุกโมดูลของ VCB Connect
  - **สลับธีม:** segmented control 3 ปุ่ม (สว่าง/มืด/ตามระบบ) เรียก `setTheme()` จาก
    `useTheme()`
  - **จัดการประกาศ:** ปุ่มนี้แสดงเฉพาะเมื่อ `showAdmin` (= `isAdmin` จาก `App.jsx`) เป็นจริง —
    กดแล้ว `navigate('/admin')` เปิด `AnnouncementEditor`
  - **ช่วยเหลือ:** เปิด `HelpModal`
  - **ออกจากระบบ:** เรียก `signOut()` จาก `useAuth()` ซึ่งลบ token แล้วพากลับหน้า sign-in
    (ไม่มีการเช็ค `signedIn` ก่อนแสดงปุ่มนี้อีกต่อไป เพราะการเข้าถึงหน้านี้ได้แปลว่าล็อกอินอยู่แล้ว
    เสมอ — คุมที่ `App.jsx` แล้ว)
- ป้ายผู้ใช้ด้านขวา (ซ่อนบนจอแคบกว่า `sm`) แสดง**อีเมล** (ไม่ใช่ชื่อ เพราะหน้า dashboard ทักทาย
  ด้วยชื่ออยู่แล้ว — แถบนี้มีหน้าที่บอกว่ากำลังล็อกอินด้วยบัญชีไหน)

### 3.5 Dashboard — `src/Dashboard.jsx`

หน้าใจกลางของ Portal แบ่งเป็น 2 คอลัมน์: ซ้าย (2.3fr) ขวา (1fr) บนจอกว้าง (`xl` ขึ้นไป),
เรียงซ้อนกันบนจอแคบ

#### 3.5.1 การ์ดต้อนรับ (Greeting card)

- ข้อความทักทายเปลี่ยนตามเวลาในเครื่อง: `greetingKeyForHour(h)` → ก่อน 12:00 = "สวัสดีตอนเช้า",
  ก่อน 18:00 = "สวัสดีตอนบ่าย", หลังจากนั้น = "สวัสดีตอนเย็น"
- แสดงชื่อผู้ใช้ (`greeting` prop ที่คำนวณใน `App.jsx` จาก `user.name` หรือ `nameFromEmail`)
- นาฬิกา/วันที่: `now` state อัปเดตทุก 30 วินาที (`setInterval`, ไม่ใช่ทุกวินาทีเพราะแสดงผลแค่
  ระดับนาที) รูปแบบวันที่ปรับตาม locale (`th-TH` หรือ `en-GB`)
- ป้าย "System Online" (status indicator แบบ static ไม่ได้เช็ค health จริง)

#### 3.5.2 แบนเนอร์ประกาศ (Announcement banner) และพาเนลประกาศ

- `hasAnnouncement = Boolean(announcement?.show && (title || body))`
- `showBanner = hasAnnouncement && !bannerDismissed`
- **กฎสำคัญ:** แบนเนอร์ (ด้านบน, เด่น) กับพาเนล "ประกาศ" (การ์ดแยกด้านล่าง) **ไม่แสดงพร้อมกัน
  เนื้อหาเดียวกัน** — ถ้าแบนเนอร์กำลังแสดงอยู่ (ยังไม่ถูกปิด) พาเนลจะไม่ render เลย เพื่อไม่ให้
  ข้อความเดียวกันซ้ำ 2 ที่บนจอเดียว เมื่อผู้ใช้กดปิดแบนเนอร์ (`onDismissBanner`) เนื้อหาเดียวกัน
  จะย้ายไปโผล่ในพาเนลแทน ถ้าไม่มีประกาศเลยพาเนลจะโชว์ "ยังไม่มีประกาศในขณะนี้"
- แบนเนอร์ตัดข้อความยาวด้วย `line-clamp-2` (จำกัด 2 บรรทัดเสมอ ไม่ยืดตามความยาวข้อความ)
  ส่วนพาเนล (เมื่อเปิดออกมาแสดงเต็ม) ใช้ `whitespace-pre-line` (คงการขึ้นบรรทัดใหม่ตามต้นฉบับ)
- ปุ่ม "×" ปิดแบนเนอร์ เรียก `dismissBanner()` ใน `App.jsx` → เซ็ต `bannerDismissed = true`
  และเรียก `markDismissed(announcement.id)` เพื่อจำไว้ที่ระดับเครื่อง (ดูหัวข้อ 3.9)

#### 3.5.3 กริดรายการแอปพลิเคชัน (App tiles)

- **การกรอง Onboarding ออก:** `filteredApps` ตัด tile ที่ `key === 'onboarding'` ออกจากกริด
  หลักเสมอ (แสดงเฉพาะใน Sidebar > เพิ่มเติม)
- **ค้นหา:** ถ้ามีข้อความค้นหา (`query`, ผูกกับ Topbar) จะกรอง tile ที่เหลือด้วยการ resolve
  ชื่อ/คำอธิบายผ่าน `appCopy(a, lang, t)` ก่อน แล้วค้นหาแบบ substring, case-insensitive, ใน
  ภาษาปัจจุบันที่ผู้ใช้กำลังอ่านอยู่ (ไม่ใช่ค้นแค่ข้อความอังกฤษดิบ) — ถ้าไม่พบผลลัพธ์แสดงข้อความ
  "ไม่พบแอปพลิเคชันที่ค้นหา"
- แต่ละ tile คือ `<a target="_blank">` ไปยัง `appLink(a.url, {theme, lang, token})` มี:
  - ไอคอนแอป (สีพื้นหลัง/สีตัวอักษรมาจาก `a.accent` ของ record ในฐานข้อมูล)
  - ชื่อ + คำอธิบายสั้น จาก `appCopy()`
  - Tooltip เมื่อ hover แสดงคำอธิบายยาว (`copy.preview`)
  - ลิงก์ "เปิดใช้งาน →" พร้อม animation เลื่อนลูกศรตอน hover
  - Animation `reveal` ไล่ตามลำดับ tile (`animationDelay: i * 45ms`)
- แสดงจำนวน tile ที่พบ ("N รายการ") ข้าง ๆ หัวข้อ "แอปพลิเคชัน"
- ถ้าโหลด apps ไม่สำเร็จ (`appsError`) แสดงข้อความ error สีแดงเหนือกริด (ไม่ทำให้ทั้งหน้าใช้ไม่ได้)

#### 3.5.4 คอลัมน์ขวา: ปฏิทินวันหยุด + พาเนลวันเกิด/ผู้ลา

- `HolidayCalendar` (ดูหัวข้อ 3.6)
- พาเนลรวม 2 คอลัมน์ย่อยในการ์ดเดียว คั่นด้วยเส้นแบ่ง:
  - **วันเกิดที่กำลังจะถึง:** ข้อมูลตัวอย่างคงที่จาก `SAMPLE_BIRTHDAYS` ใน `data.js` (3 รายการ
    hardcode) มีเชิงอรรถบอกชัดว่าเป็นข้อมูลตัวอย่าง (`panel.birthdaysNote`)
  - **ลาวันนี้:** `SAMPLE_LEAVE` เป็น array ว่างเสมอ (`[]`) แสดง empty state "วันนี้ไม่มีพนักงานลา"
    เหมือนพฤติกรรม default ของพอร์ทัลเดิม (Apps Script)

### 3.6 ปฏิทินวันหยุด — `src/HolidayCalendar.jsx`

**ทำอะไรได้:** ปฏิทินรายเดือนแบบเลื่อนดูเดือนก่อน/ถัดไป ไฮไลต์วันหยุดราชการ, วันเสาร์-อาทิตย์,
วันนี้ พร้อม legend และคำบอกวันหยุดถัดไป

**Logic การทำงาน:**

- `viewDate` state (เริ่มต้นที่วันที่ 1 ของเดือนปัจจุบัน) ควบคุมเดือน/ปีที่กำลังดู ปุ่ม ‹ › เลื่อน
  เดือนโดยสร้าง `Date` ใหม่ (`getMonth() - 1` หรือ `+1`) — JavaScript `Date` จัดการ underflow/
  overflow ปีข้ามปีให้อัตโนมัติ
- `holidays = getHolidays(year)` ดึงจาก `data.js` — เป็น pure function ของปี จึงไม่ต้อง cache
  หรือ loading state (คำนวณใหม่ทุกครั้งที่ `year` เปลี่ยนผ่าน `useMemo`)
- `buildCells(year, month)`: สร้าง array 7 คอลัมน์ (เริ่มวันอาทิตย์) รวมวันจากเดือนก่อนหน้า/
  ถัดไปที่ล้นเข้ามาเติมเต็มแถวแรก/แถวสุดท้าย (`outside: true` สำหรับวันนอกเดือน แสดงแบบจาง)
- **ลำดับความสำคัญของสีในแต่ละวัน:** วันนี้ (accent สีเข้ม) ชนะวันหยุด (สีพื้นหลังวันหยุด) ชนะ
  วันหยุดสุดสัปดาห์ (สีเทาอ่อน) ชนะวันปกติ — ตรวจตามลำดับ `isWeekend → h (holiday) → isToday`
  แล้ว `tone` ตัวหลังทับตัวก่อนเสมอ
- วันที่มีวันหยุดจะมีจุดเล็กด้านล่างตัวเลข (ยกเว้นถ้าวันนั้นเป็นวันนี้พอดี ไม่ซ้อนจุด)
- **คำนวณวันหยุดถัดไป (`nextHoliday`):** วน loop ไปข้างหน้าจากวันนี้จริง (ไม่ใช่เดือนที่กำลังดู)
  สูงสุด 366 วัน ข้ามปีได้ (โหลดตาราง `getHolidays()` ของปีใหม่เมื่อ `probe` ข้ามปี) คำนวณ
  `daysAway` และแสดงข้อความ "วันหยุดถัดไป: {ชื่อ} ({วันที่})" พร้อม badge "อีก N วัน" หรือ
  "วันนี้" ถ้า `daysAway === 0`
- Legend อธิบายสี 3 แบบ: วันหยุด/วันเสาร์-อาทิตย์/วันนี้

**ข้อมูลวันหยุด** (`THAI_HOLIDAYS_FIXED` ใน `src/data.js`): เป็นวันหยุดราชการไทยแบบวันที่คงที่
เท่านั้น (เช่น 1 ม.ค., 6 เม.ย., สงกรานต์ 13-15 เม.ย., 1 พ.ค., 4 พ.ค., 28 ก.ค., 12 ส.ค.,
13 ต.ค., 23 ต.ค., 5 ธ.ค., 10 ธ.ค., 31 ธ.ค.) **ไม่รวม**วันหยุดตามปฏิทินจันทรคติ/วันสำคัญทาง
พุทธศาสนา (มาฆบูชา, วิสาขบูชา, อาสาฬหบูชา, เข้าพรรษา) และ**วันหยุดชดเชย**ที่ประกาศโดยมติ ครม.
เพราะทั้งสองอย่างเปลี่ยนวันที่ทุกปีและคอมไพล์ตายตัวไว้ในโค้ดไม่ได้ ข้อมูลนี้ hardcode ในไฟล์ ไม่มี
endpoint หรือตารางในฐานข้อมูล (ตั้งใจให้เป็นแบบนี้ตามต้นฉบับ Apps Script)

### 3.7 Tooltip แบบ custom — `src/Tooltip.jsx`

**ทำอะไรได้:** เมื่อ hover ที่ tile หรือรายการเมนูใน Sidebar จะมี tooltip ลอยขึ้นมาแสดงชื่อ +
คำอธิบายยาว แทน native browser tooltip (title attribute) ที่ช้าและปรับสไตล์ไม่ได้

**Logic การทำงาน (`useTooltip()` hook):**

- ตรวจจับอุปกรณ์สัมผัส (`matchMedia('(hover: none), (pointer: coarse)')`) — ถ้าเป็นทัชสกรีน
  จะไม่แสดง tooltip เลย (`show()`/`hide()` return ทันที)
- มี timing 4 ค่า: `SHOW_DELAY` (220ms หน่วงก่อนแสดงครั้งแรก กัน tooltip กระพริบเวลาเมาส์ผ่าน),
  `SWAP_DELAY` (60ms หน่วงก่อนแสดง target ใหม่เมื่อเมาส์เลื่อนจาก item หนึ่งไปอีก item ทันที),
  `HIDE_DELAY` (60ms หน่วงก่อนเริ่ม fade out จริง), `FADE_OUT_MS` (160ms ต้องตรงกับ CSS
  transition duration ใน `index.css`)
- ใช้ ref หลายตัว (`currentRef`, `visibleRef`, `hoverKeyRef`) แทน state เพื่อเช็คสถานะแบบ
  synchronous ระหว่าง event handler โดยไม่ trigger re-render โดยไม่จำเป็น
- ปิด tooltip ทันทีเมื่อมีการ scroll หน้า (capture-phase listener) — ป้องกัน tooltip ค้างอยู่ผิดตำแหน่ง
- `bind({key, name, desc, kind})`: คืน object ของ event handler (`onMouseEnter`, `onMouseLeave`,
  `onFocus`, `onBlur`) ให้ spread ใส่ element เป้าหมายได้ตรง ๆ — `kind: 'nav'` วาง tooltip
  ด้านขวาของ target, `kind: 'card'` วางด้านบน (fallback ไปด้านล่างถ้าชนขอบจอบน)
- คอมโพเนนต์ `<Tooltip>` วัดตำแหน่ง/ขนาดจริงของ target ด้วย `getBoundingClientRect()` ทุกครั้งที่
  เปิดใหม่ แล้ว clamp ตำแหน่งให้อยู่ในขอบเขตวิวพอร์ต (เผื่อ 12px จากขอบ)

### 3.8 ฟอร์มแจ้งปัญหา (Help & Support) — `src/HelpModal.jsx`

**ทำอะไรได้:** ให้ผู้ใช้เลือกหมวดปัญหา (จากรายชื่อแอปทั้งหมด หรือ "อื่น ๆ") พิมพ์อธิบายปัญหา
แล้วกด "ส่งรายงาน"

**Logic การทำงาน (สำคัญ — เป็นจุดที่ backend ยังไม่รองรับ):**

- ฟอร์ม validate ฝั่ง client ง่าย ๆ: ต้องเลือก `area` และกรอก `message` (trim แล้วไม่ว่าง) ก่อน
  ถึงจะ submit ได้ ไม่งั้นแสดงข้อความ error ใต้ฟอร์ม
- **ไม่มี endpoint สำหรับส่งรายงานจริง** — API `api/src/routes/portal.js` ไม่มี route
  สำหรับเรื่องนี้ (ต้นฉบับ Apps Script เคยใช้ `sendIssueReport()` ผ่าน `MailApp` ของ Google
  ซึ่งไม่มีในสถาปัตยกรรมใหม่)
- แทนที่ด้วยการสร้างลิงก์ `mailto:it@vcb-con.com?subject=...&body=...` (encode ด้วย
  `encodeURIComponent` เพื่อรองรับข้อความภาษาไทยและการขึ้นบรรทัดใหม่) แล้วสั่ง
  `window.location.href = href` เพื่อเปิดโปรแกรมอีเมลของเครื่องผู้ใช้เอง
- ก่อนเปิด mail client จะแสดงข้อความ `help.unavailable` บอกผู้ใช้ตรง ๆ ว่า "ยังส่งจากในระบบไม่ได้
  — จะเปิดอีเมลของคุณพร้อมข้อความนี้แทน" (ไม่หลอกผู้ใช้ว่าส่งสำเร็จแล้ว)
- Subject ของอีเมลถูกประกอบเป็น `[VCB Connect] {ชื่อแอปที่เลือก}`

### 3.9 การเชื่อมโยงข้ามโมดูล — `appLink()` ใน `src/data.js`

**ทำอะไรได้:** เมื่อกด tile หรือลิงก์เมนูใด ๆ ที่พาไปยังโมดูลอื่นของ VCB Connect (เช่น HR,
E-Memo) ระบบจะแนบพารามิเตอร์ธีม/ภาษา/token ต่อท้าย URL ให้อัตโนมัติ

**Logic การทำงาน:**

- รับ `url` ต้นฉบับ (อาจเป็น relative path เช่น `/hr` ในโปรดักชัน หรือ absolute เช่น
  `http://localhost:5181` ตอน dev ที่แต่ละโมดูลรันคนละพอร์ต) แปลงผ่าน `new URL(url,
  window.location.origin)` เพื่อให้ parse ได้ทั้งสองแบบ
- แนบ `theme` และ `lang` ปัจจุบันเป็น query string เสมอ
- แนบ `vt` (token) **เฉพาะเมื่อ origin ต่างกัน** (ข้ามโดเมน/พอร์ต) เพราะถ้า origin เดียวกัน
  localStorage ถูกแชร์อยู่แล้ว ไม่ต้องส่ง token ซ้ำผ่าน URL (ลดความเสี่ยง token หลุดค้างใน
  address bar/ประวัติเบราว์เซอร์)
- ถ้า origin ปลายทางตรงกับ origin ปัจจุบัน จะคืนค่าเป็น relative path (`pathname + search +
  hash`) เพื่อไม่ให้ดูเหมือนออกจากเว็บไซต์ และให้ reverse-proxy/rewrite rule ทำงานถูกต้อง
- ถ้า URL parse ไม่ผ่าน (malformed) จะคืนค่า URL เดิมโดยไม่ทำอะไร (ดีกว่า tile ที่ไม่ทำงานเลย)
- เหตุผลที่ยังต้องมี logic นี้แม้จะมีแผนรวมทุกโมดูลไว้โดเมนเดียว (`docs/ONE_DOMAIN.md`):
  ยังจำเป็นตอน dev (แต่ละโมดูลรันคนละพอร์ต = คนละ origin) และตอนเปิดโมดูลตรง ๆ ครั้งแรก (เช่น
  จากอีเมลหรือ bookmark ที่ไม่เคยผ่านพอร์ทัลมาก่อน ยังไม่มีการตั้งค่าเก็บไว้)

### 3.10 การจัดการประกาศ (Admin) — `src/AnnouncementEditor.jsx`

**ทำอะไรได้:** ผู้ดูแลระบบ (portal admin) สามารถแก้ไข/เผยแพร่/ล้างประกาศที่แสดงบนแบนเนอร์ของ
ทุกคน ผ่านหน้าต่าง modal ที่เปิดจาก path `/admin`

**Logic การทำงาน:**

- **การตรวจสอบสิทธิ์:** `isAdmin = hasRole('portal', 'admin')` ฝั่ง client **ใช้เพื่อตัดสินใจว่า
  จะวาดฟอร์มหรือไม่เท่านั้น** — สิทธิ์จริงในการบันทึกถูกบังคับที่ server (`requireAuth +
  requireRole('portal','admin')` ใน `api/src/routes/portal.js`) เนื่องจากรหัสผ่านแอดมินแบบเดิม
  (hash เก็บใน Apps Script's ScriptProperties + เทียบรหัสฝั่ง client) ใช้ไม่ได้ใน SPA
  เพราะ hash และการเปรียบเทียบจะถูกส่งไปอยู่ในโค้ด JS ที่ทุกคนอ่านได้
  - ถ้าไม่ใช่ admin: แสดงข้อความ "คุณไม่มีสิทธิ์แก้ไขประกาศ" (ถ้าล็อกอินแล้ว) หรือ "กรุณาเข้าสู่
    ระบบด้วยบัญชีแอดมิน" (ถ้ายังไม่ล็อกอิน) พร้อมปุ่มปิดเท่านั้น
- **โหลดข้อมูลปัจจุบัน:** เมื่อ modal เปิดและเป็น admin จะเรียก `getAnnouncement()` — API จะส่ง
  ประกาศฉบับร่างที่ถูกซ่อนอยู่ (`show=false`) มาให้ด้วยถ้าผู้เรียกเป็น admin (คนทั่วไปจะไม่เห็น
  ฉบับร่าง)
- **ฟอร์ม:** ช่อง Title (สูงสุด 120 ตัวอักษร, ตรงกับ `announcementSchema` ฝั่ง server), ช่อง
  Body (สูงสุด 600 ตัวอักษร), checkbox "แสดงแบนเนอร์ให้ผู้เข้าชม" (`show`)
- **การบันทึก (`submitSave`):**
  - Validate ฝั่ง client ก่อน: ต้องมี title หรือ body อย่างน้อย 1 อย่าง ไม่งั้นแจ้ง error
    (`admin.needTitleOrBody`) — สอดคล้องกับ error `EMPTY_ANNOUNCEMENT` ที่ server บังคับเช่นกัน
  - เรียก `saveAnnouncement({title, body, show})` → PUT `/api/portal/announcement`
  - เมื่อสำเร็จ แสดงข้อความ "บันทึกแล้ว" แล้วปิด modal อัตโนมัติหลัง 500ms และเรียก `onSaved()`
    ซึ่งอัปเดต state ประกาศใน `App.jsx` พร้อมรีเซ็ต `bannerDismissed = false` (เพราะการบันทึกทำให้
    `revision` เพิ่มขึ้น = id ใหม่ = ทุกคนควรเห็นแบนเนอร์ใหม่อีกครั้ง รวมถึงเครื่องของแอดมินเอง)
- **การล้างประกาศ (`performClear`):**
  - ต้องกดยืนยัน 2 ขั้นตอน: กดปุ่ม "ล้างประกาศ" ก่อน → เปิดกล่องยืนยันสีแดง (มีคำอธิบาย "แบนเนอร์
    จะถูกซ่อนจากทุกคน") → กดยืนยันอีกครั้ง ("ใช่ ล้างเลย") ถึงจะเรียก `clearAnnouncement()` จริง
  - Server จะ **blank ข้อความ** (`title='', body='', show=false`) ไม่ใช่ลบ row ทิ้ง — เพื่อให้
    `revision` ยังคงเพิ่มขึ้นต่อเนื่อง (ถ้าลบ row จริงแล้วสร้างใหม่ revision อาจย้อนกลับไปที่ค่าเดิม
    ทำให้ผู้ใช้ที่เคยกดปิดแบนเนอร์เก่าที่มี revision เดียวกันไม่เห็นแบนเนอร์ใหม่)

### 3.11 การสลับภาษาและธีม

**ทำอะไรได้:** ผู้ใช้สลับภาษา (ไทย/อังกฤษ) และธีม (สว่าง/มืด/ตามระบบปฏิบัติการ) ได้ตลอดเวลาผ่าน
เมนูตั้งค่าใน Topbar การตั้งค่าคงอยู่ข้ามการรีเฟรชและ**ใช้ร่วมกันทุกโมดูล**ของ VCB Connect (ผ่าน
`localStorage` key `vcb_lang` และ theme key ที่จัดการโดย `@vcb/shared`)

**Logic การทำงาน:**

- Dictionary ของ Portal อยู่ที่ `src/i18n.js` — `createDictionary()` จาก `@vcb/shared` รับ
  object ที่แต่ละ key มี `{ th, en }` (ไทยเขียนก่อนเสมอเพราะเป็นภาษาหลักของระบบ) แล้ว merge เข้า
  กับ `commonDictionary` กลาง (คำเช่น `auth.email`, `auth.password`, `auth.signIn` มาจากส่วนกลาง
  ไม่ซ้ำในแต่ละโมดูล)
- ภาษาเริ่มต้นสำหรับคนที่ไม่เคยตั้งค่ามาก่อน (`defaultLang="en"` ใน `main.jsx`) คือ**อังกฤษ**
  เพราะ Portal เป็นหน้าแรกสุดของทั้งระบบ ให้ความรู้สึกเป็นทางการกว่าการเดาจากภาษาเบราว์เซอร์ —
  แต่ถ้าเคยเลือกภาษาไว้แล้ว (ไม่ว่าจากโมดูลไหนก็ตาม) จะใช้ค่าที่เก็บไว้เสมอ
- คำแปลของแต่ละ tile (ชื่อ/คำอธิบาย/preview) มี logic ลำดับความสำคัญพิเศษ ดูหัวขัด 3.12

### 3.12 การ Resolve ข้อความของ tile — `src/lib/appCopy.js`

**Logic การทำงาน (ลำดับความสำคัญของแหล่งข้อมูล):**

1. **ชื่อ (`appName`) และคำอธิบายสั้น (`appDesc`):** ให้ความสำคัญกับค่าจากฐานข้อมูล
   (`app.nameTh`/`app.name`, `app.descTh`/`app.desc` ที่ API คืนมา) **ก่อนเสมอ** ถ้าค่าจาก API
   ว่างเปล่าหรือไม่มี ถึงจะ fallback ไปที่ dictionary ท้องถิ่น (`src/i18n.js`, key รูปแบบ
   `app.<key>.name`) และถ้า dictionary ก็ไม่มี (แปลว่า key ไม่เคยถูกกำหนดไว้ — ตรวจจากการที่
   ค่าที่คืนมาเท่ากับ key เป๊ะ ซึ่งเป็นพฤติกรรม default ของ `t()` เมื่อไม่พบคำแปล) จะ fallback ไปที่
   `app.name`/`app.key` ดิบ ๆ เป็นทางเลือกสุดท้าย
   - เหตุผล: ระบบเดิมอ่าน dictionary ท้องถิ่นอย่างเดียว ทำให้เปลี่ยนชื่อ tile ในฐานข้อมูลแล้ว
     ยังโชว์ชื่อเก่าจนกว่าจะ redeploy SPA ใหม่ — การกลับลำดับให้ฐานข้อมูลมาก่อนแก้ปัญหานี้
2. **คำอธิบายยาว (`appPreview`) สำหรับ tooltip:** เป็น **dictionary-only** เสมอ เพราะ schema
   ของตาราง `portal.apps` ยังไม่มีคอลัมน์รองรับข้อความยาวนี้ ถ้า dictionary ไม่มี entry จะ
   fallback ไปใช้คำอธิบายสั้น (`appDesc`) แทน เพื่อไม่ให้ tile ที่เพิ่มผ่านหน้าแอดมิน (ซึ่ง
   dictionary ไม่รู้จัก) มี tooltip ว่างเปล่า

---

## 4. Data Flow — API Endpoints ที่ Portal เรียกใช้

ทั้งหมดผ่าน `src/lib/portalApi.js` ซึ่งเรียก `api` instance จาก `createApi()` (`@vcb/shared`)
โดยแนบ JWT token อัตโนมัติเมื่อมีการล็อกอิน Base route คือ `/api/portal/*` (implement ที่
`api/src/routes/portal.js`)

| Method | Path | Auth | ใช้ที่ไหนในโค้ด | คืนอะไร |
|---|---|---|---|---|
| `GET` | `/api/portal/apps[?includeDisabled=1]` | `allowAnonymous`; tile ที่ปิดใช้งาน (`enabled=false`) เห็นเฉพาะ portal admin แม้จะขอ `includeDisabled=1` ก็ตาม (เช็คซ้ำที่ server จาก `req.user.roles.portal`) | `App.jsx` (`listApps`) | array ของ `{key, name, nameTh, desc, descTh, url, icon, accent, sortOrder, enabled}` เรียงตาม `sort_order, name` |
| `POST` | `/api/portal/apps` | admin (`requireAuth` + `requireRole('portal','admin')`) | ยังไม่มี UI เรียกใช้ในโค้ด portal ปัจจุบัน (เตรียมไว้สำหรับหน้าจัดการ tile ในอนาคต) | tile ที่สร้างใหม่ |
| `PATCH` | `/api/portal/apps/:key` | admin | ยังไม่มี UI เรียกใช้ | tile ที่แก้ไข (key เปลี่ยนไม่ได้ — ต้องลบแล้วสร้างใหม่) |
| `DELETE` | `/api/portal/apps/:key` | admin | ยังไม่มี UI เรียกใช้ | `{ok:true}` |
| `PUT` | `/api/portal/apps/order` | admin | ยังไม่มี UI เรียกใช้ | จัดลำดับ tile ใหม่ทั้งชุดในคำสั่งเดียว (ใช้ `unnest` array แทนการ update ทีละแถว) |
| `GET` | `/api/portal/announcement` | `allowAnonymous`; คืน `null` ถ้าประกาศถูกซ่อน (`show=false`) เว้นแต่ผู้เรียกเป็น admin (ได้เห็นฉบับร่าง) | `App.jsx` (`getAnnouncement`), `AnnouncementEditor.jsx` | `{id, title, body, show, updated}` หรือ `null`; `id` คือ `String(revision)` |
| `PUT` | `/api/portal/announcement` | admin | `AnnouncementEditor.jsx` (`saveAnnouncement`) | ประกาศที่บันทึกแล้ว (upsert แถวเดียว `id=1`, trigger ฐานข้อมูลเพิ่ม `revision` อัตโนมัติ); ปฏิเสธด้วย `400 EMPTY_ANNOUNCEMENT` ถ้าทั้ง title และ body ว่าง |
| `DELETE` | `/api/portal/announcement` | admin | `AnnouncementEditor.jsx` (`clearAnnouncement`) | ประกาศที่ถูก blank (`title='' body='' show=false`) — ไม่ลบแถวจริง เพื่อรักษาความต่อเนื่องของ `revision` |
| `GET` | `/api/portal/access/roles` | `allowAnonymous` | ยังไม่มี UI เรียกใช้ในโค้ด portal (เตรียมไว้สำหรับหน้าจัดการสิทธิ์เข้าถึงแอปในอนาคต) | รายการ role ที่แต่ละแอปกำหนดไว้ |
| `GET` | `/api/portal/access/grants` | `requireAuth` | ยังไม่มี UI เรียกใช้ | ใครมีสิทธิ์อะไรในแอปไหนบ้าง |
| `GET` | `/api/portal/access/person/:email` | `requireAuth` | ยังไม่มี UI เรียกใช้ | สิทธิ์ทั้งหมดของคนคนหนึ่งในทุกแอป |
| `PUT` | `/api/portal/access/grants` | `requireAuth` (+ ต้องเป็น portal admin หรือ admin ของแอปนั้น ๆ) | ยังไม่มี UI เรียกใช้ | ให้/เปลี่ยน/ถอนสิทธิ์คนหนึ่งในแอปหนึ่ง |
| `GET` | `/api/portal/access/audit` | admin | ยังไม่มี UI เรียกใช้ | ประวัติการเปลี่ยนแปลงสิทธิ์ (อ่านอย่างเดียว เขียนโดย DB trigger เท่านั้น) |

**หมายเหตุสำคัญ:** endpoint กลุ่ม `/access/*` (บริหารสิทธิ์การเข้าถึงแอป) **มีอยู่ใน backend
แล้วแต่ยังไม่ถูกบังคับใช้จริง** — คอมเมนต์ในโค้ด server ระบุชัดว่า
`portal.access_grants` ถูกเขียนและอ่านโดยหน้าจอแอดมิน (เมื่อสร้างแล้ว) แต่ฟังก์ชัน
`resolveRoles()` ที่ตัดสินสิทธิ์จริงของผู้ใช้ยังคงอ่านจากตารางเฉพาะของแต่ละโมดูล (เช่น
`hr.users`, `credit.managers`) อยู่ ยังไม่ได้สลับมาใช้ `access_grants` — และ**ฝั่ง Portal ยังไม่มี
หน้าจอ UI ใด ๆ เรียกใช้ endpoint กลุ่มนี้เลย** (ไม่มี component ใน `src/` ที่ import
ฟังก์ชันเหล่านี้จาก `portalApi.js` เพราะ `portalApi.js` เองก็ยังไม่ได้ห่อ endpoint กลุ่มนี้ไว้ด้วยซ้ำ)
ถือเป็นฟีเจอร์ที่วางโครง backend ไว้ล่วงหน้าแต่ frontend ยังไม่ตามทัน

---

## 5. ข้อจำกัดหรือสิ่งที่ยังไม่รองรับ (อ้างอิงจาก PORT_NOTES.md)

โมดูล Portal เป็นการพอร์ตจาก Google Apps Script เดิม (`ORIGINAL CODE/`) มาเป็น React/Express
โดยหลักการคือพอร์ตแบบ 1:1 ให้มากที่สุด `PORT_NOTES.md` บันทึกเฉพาะจุดที่พอร์ตแบบ 1:1 ไม่ได้และ
ทำไมถึงต่างออกไป:

1. **แจ้งปัญหา (Help & Support) ยังส่งเข้าระบบจริงไม่ได้** — เวอร์ชัน Apps Script เดิมส่งอีเมล
   ผ่าน `MailApp` ของ Google ตรง ๆ แต่ API ปัจจุบันไม่มี route และไม่มีตารางฐานข้อมูลรองรับเรื่องนี้
   `HelpModal.jsx` จึงเปิด `mailto:` แทนชั่วคราว และบอกผู้ใช้ตรง ๆ ว่ากำลังจะเปิดโปรแกรมอีเมล
   ของเขาเอง **แนวทางแก้ในอนาคต:** เพิ่ม route ใน `api/src/routes/portal.js` + ตารางเก็บ report
   แล้วเปลี่ยน `openMailClient` เป็นการเรียก API จริง แล้วลบข้อความ `help.unavailable` ทิ้ง

2. **Tooltip แบบยาว (preview) ของ tile ยังอยู่ใน dictionary เท่านั้น** — ตาราง `portal.apps`
   มีแค่คอลัมน์คำอธิบายสั้น (`description`/`description_th`) ไม่มีคอลัมน์สำหรับย่อหน้ายาวที่
   tooltip แสดง ข้อความยาวนี้ยังคง hardcode ไว้ที่ `src/i18n.js` (`app.<key>.preview`)
   **แนวทางแก้ในอนาคต:** เพิ่มคอลัมน์ `preview`/`preview_th` ในตาราง

3. **พาเนลวันเกิดและพาเนลผู้ลาวันนี้เป็นข้อมูลตัวอย่างล้วน (sample data)** — ทั้งสองไม่มี
   endpoint และไม่มีตารางในฐานข้อมูลเลย พาเนลวันเกิดมีเชิงอรรถบอกตรง ๆ ว่าเป็นข้อมูลตัวอย่าง
   (`panel.birthdaysNote`) ส่วนพาเนลผู้ลาแสดง empty state เสมอ ตรงกับพฤติกรรม default ของ
   พอร์ทัลเดิม (Apps Script) ที่ก็ไม่มีข้อมูลจริงเช่นกัน

4. **ปฏิทินวันหยุดไม่รวมวันหยุดตามจันทรคติ/วันหยุดชดเชย** — `getHolidays()` ยังอยู่ฝั่ง client
   (compile ไว้ในบันเดิล ไม่ผ่าน API) เป็นตารางวันที่คงที่ที่พอร์ตมาจาก
   `THAI_HOLIDAYS_FIXED` ใน Code.js ของเดิมทุกตัวอักษร ตั้งใจไม่รวมวันมาฆบูชา วิสาขบูชา
   อาสาฬหบูชา เข้าพรรษา และวันหยุดชดเชยจากมติ ครม. เพราะทั้งหมดนี้เปลี่ยนวันที่ทุกปีและ
   ประกาศเป็นปี ๆ ไป ไม่สามารถ hardcode ไว้ล่วงหน้าได้

5. **ตัวเลขเวอร์ชันที่ footer ("v1.1")** — จงใจปล่อยไว้ตรงกับต้นฉบับ Apps Script เป๊ะ ๆ
   (ต้นฉบับเองก็ล้าหลังกว่าเวอร์ชันที่ deploy จริงอยู่แล้ว เป็นความคลาดเคลื่อนที่มีอยู่ในต้นฉบับ
   ไม่ใช่ bug ของการพอร์ต จึงไม่ได้ "แก้" ให้ตรงในเวอร์ชันนี้)

6. **ไม่มีรหัสผ่านแอดมินอีกต่อไป (by design ไม่ใช่ gap)** — เวอร์ชันเดิมมีระบบ
   `unlockAdmin(password)` เทียบ hash ที่เก็บใน ScriptProperties เวอร์ชันใหม่เปลี่ยนมาใช้ role
   จริงบนฐานข้อมูล (`portal.portal_admins`) ยืนยันที่ server เท่านั้น การเปลี่ยนแปลงนี้จำเป็น
   เพราะ SPA ทำให้ hash และตรรกะการเทียบรหัสทั้งหมดถูกส่งไปอยู่ในโค้ด JavaScript ที่ทุกคนเปิด
   ดูได้ ไม่ใช่ความลับที่ปลอดภัยอีกต่อไป

7. **รหัสประกาศ (announcement id) เปลี่ยนรูปแบบ** — จาก uuid สุ่มใหม่ทุกครั้งที่บันทึก
   (เวอร์ชันเดิม) เป็นเลข `revision` ที่เพิ่มขึ้นเรื่อย ๆ (เวอร์ชันใหม่) ผลคือเบราว์เซอร์ที่เคย
   ใช้เวอร์ชันเก่าและมี uuid ค้างอยู่ใน localStorage จะเทียบไม่ตรงกับ revision ใหม่เสมอ ซึ่งเป็น
   ผลลัพธ์ที่ถูกต้อง (แปลว่า "นี่ไม่ใช่แบนเนอร์ที่คุณเคยปิด" — แบนเนอร์จะโชว์อีกครั้ง ไม่ error)
   `src/lib/announcementDismissal.js` เทียบค่าแบบ string ล้วน ๆ ไม่แปลงเป็นตัวเลข จึงไม่มีทาง
   crash จากค่าเก่าที่ค้างอยู่ ระบบยังกวาดล้าง key เก่า (`vcb_connect_ann_dismissed`) ทิ้งตอน
   อ่านครั้งแรกด้วย

8. **ระบบบริหารสิทธิ์เข้าถึงแอป (`/access/*`) มี backend แล้วแต่ยังไม่เชื่อมกับ frontend ของ
   Portal และยังไม่ถูกใช้ตัดสินสิทธิ์จริง** (ดูหมายเหตุท้ายตาราง endpoint ในหัวข้อ 4) — เป็นจุดที่
   ไม่ได้บันทึกไว้ใน `PORT_NOTES.md` แต่พบจากการอ่านโค้ด server โดยตรง ถือเป็น
   งานที่ค้างอยู่ระหว่างทาง ไม่ใช่ gap จากการพอร์ต

9. **เอกสาร `README.md` และ `STATUS.md` ในโฟลเดอร์ `portal/` ล้าสมัย** — ทั้งสองไฟล์อธิบาย
   สถาปัตยกรรมรุ่นก่อน (React + TypeScript, mock backend ผ่าน `localStorage`,
   `src/mockBackend.ts`, `AdminModal.tsx` ฯลฯ) ซึ่งไม่มีอยู่ในโค้ดจริงอีกต่อไปแล้ว ทีมพัฒนาควรยึด
   `PORT_NOTES.md` และซอร์สโค้ดจริงเป็นหลัก ไม่ใช่สองไฟล์นี้
