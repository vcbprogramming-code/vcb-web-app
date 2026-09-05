# Platform & Shared Layer — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> เอกสารนี้อธิบาย **ชั้นฐาน (foundation layer) ที่ทุกโมดูลของ VCB Connect พึ่งพา** — Express API
> ที่ `FOR DEPLOYMENT TEAM/api/src/`, แพ็กเกจหน้าบ้านที่ใช้ร่วมกัน `@vcb/shared` ที่
> `FOR DEPLOYMENT TEAM/shared/src/` และสคีมาฐานข้อมูลที่ `FOR DEPLOYMENT TEAM/supabase/migrations/`
> ทุกหัวข้อยึดตามพฤติกรรมจริงของซอร์สโค้ด ไม่ใช่เอกสารออกแบบในอุดมคติ พร้อมระบุไฟล์/ฟังก์ชัน
> อ้างอิงเพื่อให้นักพัฒนาตามไปดูโค้ดจริงได้ทันที
>
> **ขอบเขต**: เอกสารนี้ **ไม่** อธิบายหน้าจอหรือ route เฉพาะของแต่ละโมดูล — เรื่องนั้นอยู่ใน
> `portal.md`, `hr-worklog.md`, `credit-facility.md`, `meeting-minutes.md`, `sop.md`,
> `onboarding.md`, `system-map.md`, `ememo.md` ตามลำดับ สิ่งที่อยู่ในเอกสารนี้คือ **สิ่งที่
> เอกสารทั้งแปดฉบับนั้นถือว่ามีอยู่แล้ว**

---

## 1. ภาพรวมสถาปัตยกรรม

```
React SPA (Vercel, หนึ่ง origin ต่อโมดูล)
        │  HTTPS + Bearer JWT
        ▼
Express API เดียว (Render)  ── api/src/index.js
        │  pg pool เดียว, ผู้ใช้ฐานข้อมูลคนเดียว
        ▼
Supabase Postgres (6 schema) + Supabase Storage (ผ่าน S3 API)
```

**หลักการที่กำหนดทุกอย่างในเอกสารนี้**: มี API **ตัวเดียว** ไม่ใช่หนึ่งตัวต่อโมดูล
คอมเมนต์บรรทัดแรกของ `api/src/index.js` ระบุเหตุผลตรง ๆ — "so a person signs in once and the
same JWT works across HR, Credit Facility, Minutes, SOP and Onboarding" คนหนึ่งคนเข้าสู่ระบบ
ครั้งเดียว แล้ว token ใบเดียวกันใช้ได้ทุกโมดูล

**ผลสืบเนื่องที่สำคัญที่สุด**: เพราะ Express เป็น client เพียงรายเดียวของฐานข้อมูล และเชื่อมต่อ
ด้วย **ผู้ใช้ฐานข้อมูลคนเดียว** ทุกคำขอจึงหน้าตาเหมือนกันหมดในสายตาของ Postgres — Row Level
Security จึงถูก **ถอดออกทั้งระบบโดยเจตนา** และย้ายไปอยู่ที่ `api/src/middleware/auth.js` แทน
(ดูหัวข้อ 2.4 และ 4.1)

**Stack ฝั่งเซิร์ฟเวอร์**: Node ≥20 (ESM ล้วน, `"type": "module"`), Express 4, `pg` ดิบ (ไม่มี ORM),
Zod สำหรับ validate, jsonwebtoken, bcrypt, google-auth-library, PDFKit + pdf-lib, ExcelJS,
AWS S3 SDK — ดู `api/package.json`

---

## 2. Express API — ชั้นฐานหลังบ้าน

### 2.1 การบูตเซิร์ฟเวอร์ — `api/src/index.js`

ไฟล์นี้สั้นมากโดยเจตนา: หน้าที่เดียวคือ **ประกอบชิ้นส่วนตามลำดับที่ถูกต้อง** ลำดับของ middleware
ในไฟล์นี้ไม่ใช่เรื่องสไตล์ — สลับลำดับแล้วพฤติกรรมเปลี่ยน:

| ลำดับ | บรรทัด | สิ่งที่ทำ | ทำไมต้องอยู่ตรงนี้ |
|---|---|---|---|
| 1 | `app.set('trust proxy', 1)` | บอก Express ว่ามี reverse proxy หนึ่งชั้นอยู่หน้า | Render วางแอปไว้หลัง proxy — ถ้าไม่ตั้ง `req.ip` จะเป็นที่อยู่ของ proxy และการตรวจ secure cookie จะผิด |
| 2 | `helmet()` | ใส่ security header มาตรฐาน | ต้องมาก่อน route ทั้งหมด ไม่งั้น response บางเส้นทางจะไม่ได้ header |
| 3 | `cors({...})` | ตรวจ Origin ตาม allowlist | ต้องมาก่อน body parser และ route เพื่อให้ preflight ถูกตอบก่อนงานหนัก |
| 4 | `express.json({ limit: '2mb' })` | แปลง JSON body | เพดาน 2 MB — ไฟล์แนบทุกชนิด **ไม่ผ่าน API** แต่ใช้ presigned URL แทน (ดู 2.6) |
| 5 | `GET /health` | health check | อยู่ก่อน route ที่ต้องยืนยันตัวตน เพื่อให้ตรวจได้โดยไม่มี token |
| 6 | `app.use('/api/<module>', …)` | mount router ของแต่ละโมดูล | — |
| 7 | `notFound` | ตอบ 404 `{ error: 'NOT_FOUND' }` | ต้องอยู่**หลัง**ทุก route ไม่งั้นจะกลืน route ที่มีอยู่จริง |
| 8 | `errorHandler` | ตัวจัดการ error กลาง | Express บังคับว่า error handler ต้องเป็นตัวสุดท้ายและมี 4 พารามิเตอร์ |

#### กฎ CORS

`CORS_ORIGINS` เป็นรายการ origin คั่นด้วยจุลภาค **แบบตรงตัว ไม่มี wildcard**:

```js
if (!origin) return cb(null, true);              // curl / health check / server-to-server
if (allowedOrigins.includes(origin)) return cb(null, true);
cb(new Error(`Origin not allowed: ${origin}`));
```

คำขอที่ **ไม่มี** header `Origin` ผ่านได้ — คอมเมนต์ในโค้ดอธิบายว่าคำขอเหล่านั้นไม่พก
credential ของเบราว์เซอร์ CORS จึงไม่ใช่สิ่งที่ปกป้องมันอยู่แล้ว (สิ่งที่ปกป้องคือ `requireAuth`)
และ **API ไม่เคยสะท้อน (reflect) Origin ที่ส่งมา** — เป็น allowlist เท่านั้น

#### Startup assertion — ทำไมต้องพังเสียงดัง

ระบบนี้มี **assertion ตอนบูต 3 จุด** และทั้งสามจุดมีเหตุผลเดียวกัน: **ความล้มเหลวเหล่านี้เงียบ
ตอนรันไทม์** ถ้าไม่ตรวจตอนบูต ระบบจะทำงานต่อไปเรื่อย ๆ โดยให้ผลลัพธ์ผิดโดยไม่มีใครรู้

| assertion | ไฟล์ | เกิดอะไรถ้าไม่ตรวจ |
|---|---|---|
| `DATABASE_URL` ต้องมี | `db.js` (throw ตอน import) | `pg` จะ fallback ไปที่ libpq default คือ `localhost:5432` ด้วยชื่อ OS user ปัจจุบัน — ทุกคำขอ timeout หรือรายงาน "role does not exist" โดย**ไม่มีข้อความไหนบอกว่า connection string หายไป** |
| `JWT_SECRET` ต้องมีและยาว ≥32 ตัวอักษร | `auth.js` (throw ตอน import) | secret สั้นหรือหายไป = **token ทุกใบที่ process นี้ออกให้ปลอมแปลงได้** และความล้มเหลวนี้ไม่แสดงอาการใด ๆ ตอนรันไทม์ |
| ฟอนต์ไทยต้องมี | `lib/pdf.js` → `assertFontsPresent()` เรียกจาก `index.js` | PDFKit **ไม่ error เมื่อไม่มี glyph — มันเขียนช่องว่างเปล่า** PDF ทุกใบจะออกมามีระยะขอบถูกต้อง เลย์เอาต์ถูกต้อง ภาษาอังกฤษถูกต้อง และ**ตัวอักษรไทยหายไปทั้งหมดอย่างเงียบ ๆ** ไม่มีใครรู้จนกว่าเอกสารที่เซ็นแล้วจะถึงมือคน |

การตรวจฟอนต์เป็นจุดเดียวที่ **หนีได้**: ตั้ง `PDF_FONTS_OPTIONAL=1` แล้วระบบจะ `console.warn`
และบูตต่อ (แต่ route ที่สร้าง PDF จะพัง) — มีไว้สำหรับ deployment ที่ไม่ออก PDF จริง ๆ เท่านั้น
กรณีปกติคือ `process.exit(1)` เพราะ "container ที่สร้างเอกสารที่ถูกต้องไม่ได้ ไม่ควรรายงานตัวว่า
healthy"

> **ข้อค้นพบสำคัญ (discrepancy)**: ณ ขณะเขียนเอกสารนี้ `api/assets/fonts/` มีเพียง
> `README.md` — **ไม่มี `Sarabun-Regular.ttf` และ `Sarabun-Bold.ttf`** ผลคือ API ที่
> checkout สด ๆ จาก repo นี้ **บูตไม่ขึ้น** เว้นแต่ตั้ง `PDF_FONTS_OPTIONAL=1` ทีมติดตั้ง
> ต้องดาวน์โหลด Sarabun จาก Google Fonts (SIL OFL 1.1 — ใส่ใน deployment image ได้)
> ก่อน deploy ครั้งแรก ดูวิธีใน `api/assets/fonts/README.md`

### 2.2 ตัวตนและ token — `api/src/auth.js`

ไฟล์นี้คือ **แหล่งความจริงเรื่องตัวตนทั้งระบบ** คอมเมนต์หัวไฟล์อธิบายว่าทำไมมันจึงจำเป็น: ระบบ
Apps Script เดิมได้ตัวตนมาฟรีจาก `Session.getActiveUser().getEmail()` ซึ่ง Google ป้อนให้ภายใน
iframe และปลอมไม่ได้ — allowlist ฝั่งเซิร์ฟเวอร์จึงพอ ตอนนี้สิ่งนั้นหายไปแล้ว เบราว์เซอร์ส่ง JWT
ที่ **เราเป็นคนออกให้** กลับมา ดังนั้น:

- อะไรก็ตามที่ React ตัดสินใจเรื่องบทบาท เป็นเพียง **คำใบ้สำหรับ UI** — มันซ่อนเมนู **ไม่ใช่
  ความปลอดภัย** เพราะใครก็ตามเรียก API ตรง ๆ ด้วย `curl` ได้
- ไฟล์นี้ + `middleware/` คือ **ประตูจริงเพียงบานเดียว** — route ที่ไม่มี `requireAuth` คือ route
  ที่เปิดต่ออินเทอร์เน็ตทั้งใบ

#### รหัสผ่าน (bcrypt)

```js
const BCRYPT_ROUNDS = 12;
export function hashPassword(plain)          // bcrypt.hash(plain, 12)
export function verifyPassword(plain, hash)  // bcrypt.compare
```

`verifyPassword()` มีพฤติกรรมสำคัญ: **เมื่อ `hash` เป็น null มันยังคงเรียก `bcrypt.compare`
กับ hash ปลอม** แทนที่จะ return ทันที เพื่อให้ "ไม่มีผู้ใช้คนนี้" และ "รหัสผ่านผิด" ใช้เวลา
เท่ากัน — ไม่งั้นเวลาตอบสนองจะบอกผู้โจมตีได้ว่าอีเมลไหนมีอยู่จริง (timing attack) คอลัมน์
`hr.users.password_hash` เป็น nullable โดยเจตนา เพราะผู้ใช้ที่เข้าผ่าน Google Sign-In ไม่มี
รหัสผ่านจริง ๆ

#### การออก token — `issueToken(user)`

```js
jwt.sign(
  { sub: user.email, name, roles: user.roles || {}, hrSites: user.hrSites || [] },
  JWT_SECRET,
  { expiresIn: JWT_TTL /* default '12h' */, issuer: 'vcb-connect' }
)
```

payload ถูกออกแบบให้ **เล็กและไม่มีความลับ** — JWT เป็น base64 ไม่ใช่การเข้ารหัส เบราว์เซอร์
อ่านทุกฟิลด์ได้

**`hrSites` ในโค้ดมีคอมเมนต์บันทึกบั๊กจริงไว้**: เดิมค่านี้ถูกคำนวณตอนเข้าสู่ระบบและใส่กลับไปใน
response body แต่ **ไม่เคยถูกลงนามเข้าไปใน token** ผลคือมันมาถึง `requireHrSite()` เป็น
`undefined` และ **ผู้ใช้ HR ที่ไม่ใช่ admin ทุกคนได้ 403 `SITE_SCOPE_UNKNOWN`** หรือแย่กว่านั้นคือ
ได้รายการ site ว่างเปล่าจาก `/bootstrap` ซึ่งอ่านได้ว่า "คุณไม่สังกัดหน่วยงานใดเลย" แทนที่จะอ่าน
ได้ว่าเป็นบั๊ก

#### การตรวจ token — `verifyToken(token)`

```js
try { return jwt.verify(token, JWT_SECRET, { issuer: 'vcb-connect' }); }
catch { return null; }
```

คืน `null` เมื่อ token ไม่ถูกต้องหรือหมดอายุ — **ไม่ throw** เพื่อให้ middleware ตัดสินใจเองว่า
จะตอบ 401 หรือปล่อยผ่านแบบ anonymous

#### Google Sign-In — `verifyGoogleIdToken(idToken)`

ตรวจลายเซ็นด้วย `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` แล้ว
บังคับสองเงื่อนไข:

1. payload ต้องมี `email` — ไม่งั้น throw `'Google token carried no email'`
2. `payload.email_verified` ต้องเป็นจริง — ไม่งั้น throw `'Google email is not verified'`

คืน `{ email: <lowercase>, name }` **เหตุผลที่ต้องตรวจที่นี่แทนที่จะเชื่ออีเมลที่ client POST
มา คือประเด็นทั้งหมดของเรื่องนี้**: ลายเซ็นพิสูจน์ว่า Google เป็นผู้ออก token นี้ให้ client id
ของเรา ถ้า `GOOGLE_CLIENT_ID` ไม่ถูกตั้ง `googleClient` จะเป็น `null` และฟังก์ชันจะ throw
`'GOOGLE_CLIENT_ID is not configured'` — คือ Google Sign-In ปิดตัวเอง ส่วน login ด้วยรหัสผ่าน
ยังทำงานได้

#### `resolveRoles(email)` — หัวใจของระบบสิทธิ์

รวบรวมบทบาททุกโมดูลของคนคนหนึ่งใน **การเรียกครั้งเดียว** ด้วย `Promise.all` 6 คิวรี:

```js
one('select role from hr.users        where lower(email) = $1', [e]),
one('select 1    from credit.managers where lower(email) = $1', [e]),
one('select 1    from minutes.admins  where lower(email) = $1', [e]),
one('select 1    from minutes.editors where lower(email) = $1', [e]),
one('select 1    from sop.sop_editors where lower(email) = $1', [e]),
one('select 1    from portal.portal_admins where lower(email) = $1', [e]),
```

รูปร่างผลลัพธ์:

```js
{ hr: 'admin'|'manager'|'user'|null,   // จริง ๆ คือ 'admin'|'manager'|'staff' — ดูหมายเหตุด้านล่าง
  credit:  'manager'|null,
  minutes: 'admin'|'editor'|null,
  sop:     'editor'|null,
  portal:  'admin'|null }
```

จุดที่ต้องเข้าใจ:

- **แต่ละโมดูลมีตารางสิทธิ์รูปร่างต่างกัน** — `hr.users` มีคอลัมน์ `role`, `credit.managers` เป็น
  membership ล้วน (อยู่ในตาราง = เป็น manager), `minutes` มีสองตารางแยกกัน — จึงต้องอ่านทั้งหมด
- **admin ของ minutes ถูกยุบรวมเป็น editor ด้วย** (`mAdmin ? 'admin' : mEditor ? 'editor' : null`)
  เพราะ "admin ก็เป็น editor ในทุกที่ที่สำคัญ" — route จึงถามคำถามเดียวแทนที่จะถามสองคำถาม
- ทำงาน **หนึ่งครั้งต่อการเข้าสู่ระบบ ไม่ใช่ต่อคำขอ** — ผลลัพธ์ถูกอบเข้าไปใน JWT

> **Discrepancy ที่พบ**: คอมเมนต์ JSDoc ของ `resolveRoles()` ระบุ shape ของ `hr` ว่าเป็น
> `'admin' | 'manager' | 'user' | null` แต่ CHECK constraint จริงใน `004_hr.sql` คือ
> `check (role in ('admin','manager','staff'))` และ `008_access.sql` ก็ seed คำว่า `staff`
> ไม่ใช่ `user` — **คอมเมนต์ผิด โค้ดและฐานข้อมูลถูก** ค่าที่เป็นไปได้จริงคือ
> `admin | manager | staff | null`

#### `hrSitesFor(email, hrRole)` — ขอบเขตหน่วยงานของ HR

แทนที่ policy RLS เดิมที่ชื่อ "within site":

- `hrRole === 'admin'` → คืน `site_key` **ทุกแถว** จาก `hr.sites`
- คนอื่น → คืนเฉพาะ site ที่ระเบียนพนักงานของตนสังกัด:
  `select site_key from hr.employees where lower(email) = $1` (ผ่าน `Set` เพื่อกันซ้ำ)

**นี่คือเหตุผลที่คอลัมน์ `hr.employees.email` เป็นสิ่งที่ขาดไม่ได้** — มันคือ **ลิงก์เดียว**
ระหว่างบัญชีเข้าสู่ระบบกับหน่วยงาน ถ้าคอลัมน์นี้หายไป คิวรีคืนค่าว่าง `hrSites` เป็น `[]` และ
`requireHrSite()` ปฏิเสธทุกคำขอจากทุกคนที่ไม่ใช่ HR admin — เงียบ เบ็ดเสร็จ และดูเหมือนบั๊ก
เรื่องสิทธิ์แทนที่จะเป็นคอลัมน์ที่หายไป (ดูคอมเมนต์ใน `004_hr.sql` บรรทัด 110-120)

#### `randomToken(bytes = 32)`

`crypto.randomBytes(bytes).toString('base64url')` — ใช้สำหรับลิงก์ครั้งเดียว (การยืนยันเอกสาร,
คำเชิญ)

### 2.3 การเข้าสู่ระบบ — `api/src/routes/auth.js`

มีทางเข้าสองทาง และทั้งสองจบที่ฟังก์ชันเดียวกัน `sessionFor(email, name)`:

```js
async function sessionFor(email, name) {
  const roles    = await resolveRoles(email);
  const hrSites  = roles.hr ? await hrSitesFor(email, roles.hr) : [];
  const token    = issueToken({ email, name, roles, hrSites });
  return { token, user: { email, name, roles, hrSites } };
}
```

| Endpoint | Body (Zod) | พฤติกรรม |
|---|---|---|
| `POST /api/auth/google` | `{ idToken: string }` | ตรวจลายเซ็นกับ Google → `sessionFor()` |
| `POST /api/auth/login` | `{ email: email, password: string }` | อ่าน `hr.users` → `verifyPassword()` → ถ้าไม่ผ่าน 401 `BAD_CREDENTIALS` |
| `GET /api/auth/me` | (Bearer) | `requireAuth` แล้ว **อ่านบทบาทใหม่จากฐานข้อมูล ไม่เชื่อ token** |

**สองจุดที่ต้องเข้าใจ**:

1. `POST /login` เรียก `verifyPassword()` **ก่อน** ตรวจว่ามีผู้ใช้หรือไม่ แล้วค่อยรวมเงื่อนไข
   (`if (!user || !ok)`) — เพื่อให้เวลาตอบสนองไม่เปิดเผยว่าอีเมลใดมีอยู่จริง
2. `GET /me` เรียก `resolveRoles()` และ `hrSitesFor()` ใหม่ทุกครั้ง **ไม่ถอดรหัส token เอา
   บทบาท** เพราะ payload เป็น snapshot ณ เวลาเข้าสู่ระบบ — บทบาทอาจถูกให้หรือถูกถอนไปแล้ว

**ข้อแลกเปลี่ยนที่บันทึกไว้ในโค้ด**: `hrSites` ถูกใส่ใน token เพื่อให้ guard ต่อ site ไม่ต้อง
วิ่งไปฐานข้อมูลทุกคำขอ ผลข้างเคียงคือ **คนที่ย้ายหน่วยงานจะยังถือขอบเขตเดิมจนกว่า token จะ
หมดอายุ (ค่าเริ่มต้น 12 ชม.)** — ยอมรับได้เพราะหน่วยงานเปลี่ยนไม่บ่อย แต่คำขอเกิดตลอดเวลา

### 2.4 Middleware — `api/src/middleware/`

#### `middleware/auth.js` — ที่ที่ RLS เดิมย้ายมาอยู่

คอมเมนต์หัวไฟล์วางกฎไว้ชัด: **การลืมใส่ guard ไม่ทำให้เกิด error — มันแค่เผยแพร่ข้อมูลนั้น
อย่างเงียบ ๆ** กฎจึงเป็น "ไม่มี route ไหนไม่มี guard และ route สาธารณะต้องบอกออกมาตรง ๆ ด้วย
`allowAnonymous`"

| ฟังก์ชัน | ทำอะไร | ตอบอะไรเมื่อไม่ผ่าน |
|---|---|---|
| `requireAuth` | ดึง `Bearer <token>` จาก header `Authorization` → `verifyToken()` → เติม `req.user` | 401 `AUTH_REQUIRED` (ไม่มี token) / 401 `AUTH_INVALID` (token ใช้ไม่ได้) |
| `allowAnonymous` | อ่าน token ถ้ามี **แต่ไม่เคยปฏิเสธ** — `req.user` เป็น object หรือ `null` | ไม่มี — ผ่านเสมอ |
| `requireRole(module, ...allowed)` | ตรวจ `req.user.roles[module]` ว่าอยู่ในรายการที่อนุญาต | 403 `{ error: 'FORBIDDEN', module, need: allowed }` |
| `requireHrSite(getSiteKey)` | policy "within site" ของ HR | ดูตารางย่อยด้านล่าง |
| `requireAnyRole` | แค่ต้องมี session ไม่สนบทบาท | 401 `AUTH_REQUIRED` |

`req.user` ที่ `requireAuth` สร้างขึ้น:

```js
{ email: payload.sub, name: payload.name || '', roles: payload.roles || {}, hrSites: payload.hrSites || [] }
```

> **Discrepancy เล็กแต่มีผล**: `allowAnonymous` สร้าง `req.user` **โดยไม่มีฟิลด์ `hrSites`**
> (มีแค่ `email`, `name`, `roles`) ต่างจาก `requireAuth` ดังนั้น route ใดที่ต่อ
> `allowAnonymous` เข้ากับ `requireHrSite()` จะได้ 403 `SITE_SCOPE_UNKNOWN` เสมอสำหรับผู้ที่
> ไม่ใช่ admin — ปัจจุบันยังไม่มี route ไหนทำแบบนั้น แต่เป็นกับดักที่รออยู่

`requireHrSite(getSiteKey = (req) => req.params.siteKey)` ตัดสินตามลำดับนี้ (สังเกตว่า
site key อ่านจากที่ไหนก็ได้ที่ route กำหนดให้ — params, query หรือ body — เพราะ route ของ HR
ไม่สอดคล้องกัน):

| เงื่อนไข | ผลลัพธ์ |
|---|---|
| ไม่มีบทบาท hr เลย | 403 `FORBIDDEN` |
| บทบาทเป็น `admin` | ผ่าน (ไม่จำกัดหน่วยงาน) |
| `getSiteKey(req)` คืนค่าว่าง | 400 `SITE_REQUIRED` |
| `req.user.hrSites` ไม่ใช่ array | 403 `SITE_SCOPE_UNKNOWN` — **ปฏิเสธแทนที่จะเดา เพราะการเดาที่นี่คือการรั่วข้อมูลของหน่วยงานอื่น** |
| site ที่ขอไม่อยู่ใน `hrSites` | 403 `{ error: 'FORBIDDEN_SITE', siteKey }` |

#### `middleware/error.js` — รูปร่าง error ที่ตายตัวทั้งระบบ

`asyncRoute(fn)` — ตัวห่อ handler แบบ async ให้ promise ที่ reject วิ่งไปถึง error handler
(Express 4 ไม่จับ rejected promise ให้เอง) **ทุก handler แบบ async ต้องห่อด้วยตัวนี้**

`notFound` — 404 `{ error: 'NOT_FOUND' }`

`errorHandler(err, req, res, next)` — แปลง error เป็น response ตามลำดับความจำเพาะ:

| ประเภท error | HTTP | body |
|---|---|---|
| `ZodError` | 400 | `{ error: 'VALIDATION_FAILED', issues: [{ path, message }] }` |
| Postgres `23505` (unique violation) | 409 | `{ error: 'ALREADY_EXISTS' }` |
| Postgres `23503` (FK violation) | 409 | `{ error: 'REFERENCED_ROW_MISSING' }` |
| Postgres `23514` (check violation) | 400 | `{ error: 'CHECK_CONSTRAINT_FAILED' }` |
| error ที่มี `err.status < 500` | `err.status` | `{ error: err.code \|\| 'REQUEST_FAILED', message }` |
| อื่น ๆ ทั้งหมด | 500 | `{ error: 'INTERNAL' }` |

**กฎที่สำคัญ**: กรณีสุดท้ายจะ `console.error` ข้อมูลเต็มฝั่งเซิร์ฟเวอร์ แต่บอก client แค่ว่า
ล้มเหลว — **ข้อความและ stack trace เปิดเผยโครงสร้างสคีมาและ path ของไฟล์**

**ฟิลด์ `error` เป็นรหัสสำหรับเครื่องอ่านเสมอ ไม่ใช่ข้อความสำหรับมนุษย์** — ฝั่ง client
แปลเป็นภาษาไทย/อังกฤษเองผ่าน `t('error.' + err.code)` (ดูหัวข้อ 3.5)

### 2.5 ฐานข้อมูล — `api/src/db.js`

**pool เดียวสำหรับทั้ง API** ไม่มี ORM ทุกคำสั่งเป็น SQL ที่เขียนด้วยมือ พร้อมกฎสองข้อที่
คอมเมนต์ระบุว่า "ไม่มีการต่อรอง":

1. **ต้องใช้พารามิเตอร์ (`$1`, `$2`, …) เสมอ** ห้ามต่อสตริง SQL กับ input ของผู้ใช้ แม้แต่ชื่อ
   คอลัมน์ที่ "เห็น ๆ ว่า" มาจากโค้ดของเราเอง — นั่นคือช่องทางที่ injection เข้ามา
2. **ชื่อตารางต้องมีชื่อ schema นำหน้าเสมอ** (`hr.employees`, `onboarding.employees`) เพราะ
   **สองโมดูลมีตารางชื่อ `employees` เหมือนกันและมันไม่ใช่สิ่งเดียวกัน** — ชื่อที่ไม่ระบุ
   schema คือบั๊กที่รออยู่เสมอ

การตั้งค่า pool:

```js
new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})
```

- `rejectUnauthorized: false` — เป็นสิ่งที่เอกสารการเชื่อมต่อของ Supabase เองระบุ: certificate
  chain ของเขาไม่อยู่ใน trust store เริ่มต้นของ Node ถ้าไม่ตั้ง ทุกคำสั่งจะพังด้วย
  `SELF_SIGNED_CERT_IN_CHAIN`
- `pool.on('error')` — เมื่อ client ที่ idle ระเบิด (network สะดุด, Supabase restart) จะ log
  แล้วปล่อยให้ pool เปลี่ยน client ใหม่ **ไม่ crash API เด็ดขาด**
- ต้องใช้ **connection string ของ pooler พอร์ต 6543** ไม่ใช่การเชื่อมต่อตรงพอร์ต 5432:
  Render ต่อออกเป็น IPv4 เท่านั้น ส่วน host ตรงของ Supabase resolve เป็น IPv6 เท่านั้น → พังด้วย
  `ENETUNREACH` (ข้อความ error ของ assertion ระบุเรื่องนี้ไว้ตรง ๆ)

#### API ของ db.js

| ฟังก์ชัน | คืนค่า |
|---|---|
| `query(text, params)` | ผลลัพธ์เต็มของ `pg` |
| `rows(text, params)` | อาเรย์ของแถว |
| `one(text, params)` | แถวแรก หรือ `null` |
| `tx(fn)` หรือ `tx(user, fn)` | ทำงานหลายคำสั่งเป็นทรานแซกชันเดียว |
| `close()` | ปิด pool |

#### `tx()` และ actor context — จุดที่พลาดง่ายที่สุดในระบบ

```js
await tx(async (c) => { … });            // ไม่มี actor context
await tx(req.user, async (c) => { … });  // ตั้ง actor context
```

เมื่อส่ง `user` เข้ามา `tx()` จะรัน:

```js
await client.query('select set_config($1, $2, true)', ['app.actor_email', String(user.email || '')]);
await client.query('select set_config($1, $2, true)', ['app.actor_role',  String(user.roles?.hr || 'none')]);
```

**ต้องส่ง user เสมอเมื่อคำสั่งแตะ HR** เพราะ trigger ของ HR (`enforce_entry_window`,
`audit_work_entry`) อ่านค่าเหล่านี้เพื่อตัดสินว่าใครกำลังแก้ไขและมีสิทธิ์แก้นอกกรอบเวลาปกติ
หรือไม่ **ทั้งสองอย่าง fail closed** — ค่าที่ไม่ถูกตั้งหมายถึงบทบาท `'none'` และอีเมลว่าง ดังนั้น
การลืมส่ง user **ไม่ทำให้เกิด error** แต่มันจะ:

- ล็อก HR admin ออกจากการแก้ไขย้อนหลังเกินกรอบเวลาอย่างเงียบ ๆ
- เขียนแถว audit ที่ไม่มีผู้กระทำ

และมันมองไม่เห็นเลยจนกว่าจะมีคนไปเปิด audit log ดูหลังจากผ่านไปหลายเดือน

**เหตุผลที่ต้องใช้ `set_config(..., true)` แทน `set local`**: `set local` ไม่รับพารามิเตอร์
(`$1`) จึงต้องผ่าน `set_config()` ที่รับได้ — **ห้ามแทรกอีเมลลงใน SQL text โดยตรงเด็ดขาด**
พารามิเตอร์ตัวที่สาม `true` คือ "is_local" ทำให้ค่าอยู่และตายไปพร้อมทรานแซกชัน **จึงรั่วไปสู่
ผู้เรียกคนถัดไปที่ยืม connection เดียวกันจาก pool ไม่ได้** — คุณสมบัตินี้คือเหตุผลทั้งหมดของ
`local` เพราะ `set` ธรรมดาบน pooled connection จะยื่นตัวตนของคนหนึ่งให้อีกคนหนึ่ง

`tx()` rollback เมื่อ throw และคืน client เข้า pool ใน `finally` เสมอ (ถ้า rollback เองก็พัง
แสดงว่า connection หายไปแล้ว — rollback จึงไม่มีความหมาย โค้ดกลืน error นั้นทิ้ง)

### 2.6 ไลบรารีที่ใช้ร่วมกัน — `api/src/lib/`

#### `lib/storage.js` — ไฟล์แนบ (Supabase Storage ผ่าน S3 API)

**ไฟล์ไม่เคยผ่าน API นี้** เบราว์เซอร์อัปโหลดไปยัง และดาวน์โหลดจาก **presigned URL** โดยตรง
เหตุผลสองข้อ:

1. ไฟล์แนบ 40 MB จะไม่ยึด Express worker ไว้ตลอดเวลาที่โอนย้าย
2. ไม่ชนเพดาน JSON body 2 MB ที่ตั้งไว้ใน `index.js`

API นี้ทำแค่ **ลงนามและบันทึก** เท่านั้น และเข้าถึง Supabase ผ่าน **AWS S3 SDK** ไม่ใช่ Supabase
client — เพื่อให้ทั้ง stack มี storage client ตัวเดียว และไลบรารี Supabase JS ไม่โผล่ฝั่งเซิร์ฟเวอร์เลย
(`forcePathStyle: true` เพราะ Supabase route ด้วย path `/bucket/key` ไม่ใช่ DNS subdomain)

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `presignUpload(bucket, key, contentType, expiresIn)` | URL ที่เบราว์เซอร์ PUT ไฟล์เดียวได้ |
| `presignDownload(bucket, key, expiresIn)` | URL ที่เบราว์เซอร์ GET ไฟล์เดียวได้ |
| `deleteObject(bucket, key)` | ลบ object |
| `statObject(bucket, key)` | `{ size, contentType, modified }` หรือ `null` เมื่อ 404 |
| `safeKey(prefix, originalName, random)` | สร้าง storage key ที่หนีออกจาก prefix ไม่ได้ |

**`DEFAULT_EXPIRY = 300` (5 นาที)** — คอมเมนต์อธิบายเกณฑ์: "นานพอที่จะเริ่ม สั้นพอที่จะไร้
ประโยชน์ถ้ารั่ว"

**`contentType` ถูกลงนามเข้าไปใน URL อัปโหลด** ดังนั้น client ไม่สามารถอัปโหลดไฟล์ executable
ภายใต้ key ที่อ้างว่าเป็น PDF ได้

**`safeKey()` — เหตุผลที่ไม่ sanitize ชื่อไฟล์**: ชื่อไฟล์มาจากผู้ใช้ และ**ชื่อไฟล์ภาษาไทยเป็น
เรื่องปกติที่นี่** แทนที่จะพยายาม sanitize ชุดอักขระที่ไม่มีขอบเขต ระบบเลือก **เก็บชื่อเดิมไว้ใน
ฐานข้อมูลเท่านั้น** และตั้งชื่อ object เป็นค่าสุ่มโดยรักษานามสกุลไว้ — path traversal, การชนกัน
ของชื่อ และปัญหา encoding **หยุดเป็นไปได้ทั้งหมดในคราวเดียว**

```js
`${prefix ที่ตัด / หัวท้ายแล้ว}/${random}${นามสกุลตัวพิมพ์เล็ก}`
```
(regex ของนามสกุลคือ `/\.[A-Za-z0-9]{1,8}$/` — จำกัดยาวไม่เกิน 8 อักขระ)

#### `lib/pdf.js` — การสร้าง PDF

PDFKit สำหรับสร้างหน้า, pdf-lib สำหรับรวมไฟล์

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `assertFontsPresent()` | throw ตอน startup ถ้าไม่มีฟอนต์ (ดู 2.1) |
| `createDocument(options)` | สร้าง `PDFDocument` A4 ระยะขอบ 56pt พร้อม**ลงทะเบียนและเลือกฟอนต์ไทยเรียบร้อยแล้ว** |
| `toBuffer(doc)` | ปิดเอกสารและรวมเป็น `Buffer` |
| `mergePdfs(buffers)` | รวม PDF หลายไฟล์ตามลำดับเป็นไฟล์เดียว |
| `drawTable(doc, columns, rows, opts)` | วาดตารางอย่างง่าย |

ฟอนต์ที่ลงทะเบียน: `Sarabun` → `Sarabun-Regular.ttf`, `Sarabun-Bold` → `Sarabun-Bold.ttf`
จากไดเรกทอรี `api/assets/fonts/`

`drawTable()` เขียนเองแทนที่จะดึงไลบรารีมา เพราะ TECH_STACK ห้าม UI kit และตารางต้องรองรับการ
ตัดบรรทัดแบบภาษาไทยอยู่ดี **การขึ้นหน้าใหม่เกิดขึ้นก่อนวาดแถว ไม่ใช่หลังจากล้น** (`if (y +
rowHeight > doc.page.height - doc.page.margins.bottom)`) และวาดหัวตารางซ้ำในหน้าใหม่ทุกครั้ง

#### `lib/excel.js` — นำเข้า/ส่งออก Excel (ExcelJS)

**กับดักพุทธศักราชอยู่ในไฟล์นี้** สมุดงานต้นฉบับของ HR ตั้งชื่อแท็บเดือนเป็นปฏิทินไทย — แท็บชื่อ
`2569-08` คือ **ค.ศ. 2026-08 ไม่ใช่ 2569** ส่วนต่างคือ 543 ปี **การทำผิดตรงนี้ไม่ throw** มันแค่
ยัดงานทั้งปีไว้ใต้วันที่ผิดอย่างเงียบ ๆ และจะสังเกตได้ต่อเมื่อมีรายงานที่คลาดเคลื่อนไป 543 ปี

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `beToGregorian(year)` | 2569 → 2026 — **ตัวเลข > 2400 ถือว่าเป็น พ.ศ. แน่นอน ส่วน 2026 เป็น ค.ศ. อยู่แล้ว** |
| `gregorianToBe(year)` | ทางกลับ สำหรับแสดงผลแก่ผู้ใช้ไทย |
| `parseMonthTab(name)` | แปลง `"2569-08"` / `"2569/8"` เป็น `{ year, month }` (ปีแปลงเป็น ค.ศ. แล้ว) คืน `null` ถ้าไม่ใช่แท็บเดือน |
| `toWorkbook(sheets)` | สร้าง workbook จากอาเรย์ `{ name, columns, rows }` |
| `fromWorkbook(buffer)` | อ่าน workbook เป็น `{ sheetName: [ {header: value} ] }` |

`toWorkbook()` จัดรูปแบบแถวหัวตารางตายตัว: ตัวหนา สีขาว บนพื้น `FF1F3864` และตรึงแถวแรก
(`{ state: 'frozen', ySplit: 1 }`)

**`fromWorkbook()` คืนเซลล์ว่างเป็น `null` เสมอ ไม่เคยเป็น `''`** — คอมเมนต์ระบุว่าใน HR ความ
แตกต่างนี้ **มีน้ำหนัก**: เซลล์ว่างหมายถึง "วันนั้นไม่มีการบันทึก" ในขณะที่สตริงว่างจะดูเหมือน
รายการที่บันทึกไว้แต่ไม่มีเนื้อหา และจะถูกนับเป็น manday แถวที่ทุกเซลล์ว่างจะถูกข้ามไปเลย
(`if (any) rows.push(obj)`)

#### `lib/email.js` — อีเมล (Brevo HTTP API)

**ใช้ HTTP API ไม่ใช่ SMTP โดยเจตนา**: Render บล็อกพอร์ต SMTP ขาออกในแพ็กเกจ free และ starter
ดังนั้น SMTP transport จะทำงานได้ตอน dev แล้ว**ล้มเหลวเงียบ ๆ ตอน production**

`sendEmail({ to, subject, html, text, cc, replyTo, sender })` คืน `{ ok, messageId }` หรือ
`{ ok: false, error }` — **ไม่เคย throw** เพราะอีเมลเป็นผลข้างเคียงของการกระทำอื่นเสมอ (อนุมัติ
คำขอ, มอบหมายงาน) และการที่การแจ้งเตือนตีกลับ **ต้องไม่ rollback สิ่งที่สำเร็จไปแล้ว** ผู้เรียก
มีหน้าที่ log ความล้มเหลวแล้วทำงานต่อ

รหัส error ที่เป็นไปได้: `NOT_CONFIGURED` (ไม่มี `BREVO_API_KEY` — แค่ `console.warn` และข้าม),
`NO_RECIPIENT`, `BREVO_<status>`, `SEND_FAILED` มี timeout 15 วินาที
(`AbortSignal.timeout(15_000)`)

`wrapHtml(title, bodyHtml)` — เปลือก HTML ขั้นต่ำสำหรับอีเมลแจ้งเตือน **ใช้ inline style
เท่านั้นและใช้ `<table>` จัดเลย์เอาต์** เพราะ email client ตัดบล็อก `<style>` ทิ้งและรองรับ
flex/grid ไม่สม่ำเสมอ font stack ตั้งชื่อฟอนต์ไทยไว้ก่อน (`'Sarabun','Leelawadee UI',Tahoma`)
เพื่อให้ภาษาไทยแสดงถูกใน Outlook ท้ายอีเมลมีข้อความไทยตายตัว "อีเมลนี้ส่งอัตโนมัติจากระบบ
VCB Connect — กรุณาอย่าตอบกลับ"

`escapeHtml(s)` — escape `& < > "` ใช้กับทุกค่าที่มาจากผู้ใช้ก่อนใส่ลงใน HTML ของอีเมล

### 2.7 Route ของแต่ละโมดูล — ดูเอกสารของโมดูลนั้น

`index.js` mount router 7 ตัว เอกสารนี้**ไม่** ลงรายละเอียด endpoint ของแต่ละโมดูล — ตารางนี้
มีไว้เพื่อชี้ทางเท่านั้น:

| Mount path | ไฟล์ | จำนวน route | รูปแบบ guard | เอกสารที่ครอบคลุม |
|---|---|---|---|---|
| `/api/auth` | `routes/auth.js` | 3 | ผสม — ดูหัวข้อ 2.3 | **เอกสารนี้** (หัวข้อ 2.3) |
| `/api/hr` | `routes/hr.js` | 24 | `router.use(requireAuth, requireRole('hr','admin','manager','staff'))` ทั้งโมดูล แล้วแต่ละ route เพิ่ม `requireHrSite()` หรือบทบาทที่เข้มกว่า | `hr-worklog.md` |
| `/api/credit` | `routes/credit.js` | 24 | `router.use(requireAuth)` ทั้งโมดูล (ข้อมูลการเงินบริษัท — ไม่มี anonymous) + `requireRole('credit','manager')` บนทุกการเขียน | `credit-facility.md` |
| `/api/minutes` | `routes/minutes.js` | 31 | อ่านใช้ `allowAnonymous` แล้วกรอง tier ใน SQL; เขียนใช้ `requireRole('minutes', …)` | `meeting-minutes.md` |
| `/api/sop` | `routes/sop.js` | 14 | อ่าน `allowAnonymous`; เขียนและประวัติเวอร์ชัน `requireRole('sop','editor')` | `sop.md` |
| `/api/onboarding` | `routes/onboarding.js` | 13 | ส่วนใหญ่ `allowAnonymous` (ผู้ใช้คือพนักงานใหม่วันแรก **ก่อนที่ใครจะสร้างบัญชีให้**); ยกเว้น checklist overrides และมุมมอง cohort ที่ใช้ `requireRole('portal','admin')` | `onboarding.md` |
| `/api/portal` | `routes/portal.js` | 13 | อ่าน `allowAnonymous` (หน้าแรกต้องเรนเดอร์ให้ผู้เยี่ยมชมที่ยังไม่ล็อกอิน); เขียน `[requireAuth, requireRole('portal','admin')]` | `portal.md` |

> **หมายเหตุ**: E-Memo (`ememo.md`) และ System Map (`system-map.md`) **ไม่มี router ใน API นี้**
> — E-Memo เป็นแอป TypeScript แยกต่างหากที่อยู่นอก `@vcb/shared` และ System Map เป็นตัวเรนเดอร์
> แบบสถิตที่ไม่มีอะไรต้องปกป้อง (จึงเป็นโมดูลเดียวที่ตั้งใจไม่มี `AuthProvider` — ดูหัวข้อ 3.3)
> ทั้งสองปรากฏใน `portal.apps` (ผ่าน `008_access.sql`) ในฐานะไทล์บนหน้าแรกเท่านั้น

---

## 3. `@vcb/shared` — แพ็กเกจหน้าบ้านที่ใช้ร่วมกัน

แพ็กเกจ workspace ชื่อ `@vcb/shared` (`shared/package.json`, `"private": true`, ESM,
peer dependency: React 18.3) ทุก SPA import จากที่นี่:

```js
import { AuthProvider, I18nProvider, ThemeProvider, api, useAuth } from '@vcb/shared';
```

มี subpath export ด้วย: `@vcb/shared/api`, `/auth`, `/i18n`, `/theme`, `/tailwind.preset`

### 3.1 ลำดับ provider — ตายตัว ไม่ใช่เรื่องรสนิยม

`shared/src/index.js` ระบุลำดับไว้ในคอมเมนต์หัวไฟล์ และลำดับนี้ **มีเหตุผลเชิงเทคนิค**:

```jsx
<ThemeProvider>
  <I18nProvider dictionary={moduleDict}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </I18nProvider>
</ThemeProvider>
```

- **`ThemeProvider` นอกสุด** — เพราะมันแตะ `<html>` **ก่อนที่อะไรจะถูกวาด** ถ้าอยู่ชั้นใน จะเกิด
  การกะพริบสีขาว (flash of white) ก่อนธีมมืดจะติด
- **`I18nProvider` ชั้นกลาง** — เพราะมันจัดหาสตริงที่ **ข้อความ error ของ auth ต้องใช้**
  ถ้า `AuthProvider` อยู่นอกกว่า ข้อความ "เซสชันหมดอายุ" จะไม่มีพจนานุกรมให้แปล
- **`AuthProvider` ชั้นในสุด** — ต้องการทั้งธีมและภาษาที่พร้อมแล้ว

### 3.2 `api.js` — HTTP client

#### กฎ instance เดียว

`createApi()` เป็น **factory ไม่ใช่ singleton** และไฟล์ export instance เริ่มต้นไว้ท้ายไฟล์:

```js
export const api = createApi();
```

**กฎ**: โมดูลต้องใช้ instance เดียวตลอดทั้งแอป `AuthProvider` เป็นผู้เชื่อม `getToken` และ
`onUnauthorized` เข้ากับ instance นั้น — **instance ที่สองจะไม่ได้รับทั้งแหล่ง token และการ
จัดการ 401** (คอมเมนต์ใน `access.js` ย้ำเรื่องนี้อีกครั้ง และนั่นคือเหตุผลที่ทุกฟังก์ชันใน
`access.js` รับ `api` เป็นอาร์กิวเมนต์ตัวแรกแทนที่จะ import เอง)

Base URL มาจาก `import.meta.env.VITE_API_URL` (Vite แทนที่ตอน build) ผ่าน `resolveBaseUrl()`
ซึ่งมี guard ไว้เพราะโมดูลนี้ถูกโหลดโดย Node ในเทสต์ด้วย ซึ่งไม่มี `import.meta.env`

#### การแนบ token และการพา session ข้าม origin

`TOKEN_KEY = 'vcb_token'` ใน `localStorage`

**ปัญหาที่แก้**: แต่ละโมดูลรันบน **origin ของตัวเอง** (พอร์ตของตัวเองตอน dev และ — ส่วนที่สำคัญ
กว่า — subdomain ของตัวเองตอน production) ดังนั้น `vcb_token` ใน localStorage ของพอร์ทัล
**มองไม่เห็นจาก origin ของ hr-worklog** ผลคือการเข้าสู่ระบบที่พอร์ทัลไม่เคยไปถึงโมดูลใดเลย และ
ทุกโมดูลขอให้ล็อกอินใหม่

**วิธีแก้**: พอร์ทัลแนบ query parameter `?vt=<token>` ไปกับลิงก์ทุกลิงก์ `readStoredToken()`
อ่าน **URL ก่อน localStorage** เพราะ "มันคือคำสั่งที่ใหม่กว่า" — การมาจากพอร์ทัลที่ล็อกอินอยู่
หมายถึงเจตนาที่จะมาถึงในสถานะล็อกอิน ไม่ว่า origin นี้จะจำหรือไม่จำอะไรจากการมาเยือนครั้งก่อน

จากนั้น **บริโภคครั้งเดียว เขียนลง storage แล้วลบออกจากแถบที่อยู่** ผ่าน `stripUrlToken()`
(`history.replaceState`) — เพื่อไม่ให้ bearer token ค้างอยู่ในประวัติเบราว์เซอร์หรือ bookmark
เกินกว่าการนำทางครั้งเดียวที่พามันเข้ามา (รูปแบบเดียวกับ `readUrlTheme()`/`stripUrlTheme()` ใน
`theme.jsx`)

**ทุกการเข้าถึง `localStorage` ถูกห่อด้วย try/catch** — คอมเมนต์ระบุว่า localStorage **throw
(ไม่ใช่แค่ว่าง)** ใน Safari private window, เมื่อเบราว์เซอร์ตั้งค่าให้บล็อก site data และใน
webview ฝังบางตัว การ throw ที่ไม่ถูกจับตรงนี้เกิดขึ้นระหว่าง module init และล้มทั้งแอปเป็นจอ
ขาว — **"การเสียเซสชันที่จำไว้คือการเสื่อมถอยที่ยอมรับได้ จอขาวไม่ใช่"**

#### รูปร่าง error — `ApiError`

```js
class ApiError extends Error {
  code    // รหัส error จาก API (เช่น 'FORBIDDEN'), default 'REQUEST_FAILED'
  status  // HTTP status (0 สำหรับ NETWORK_ERROR)
  issues  // เฉพาะ VALIDATION_FAILED — ฟอร์มใช้มาร์กฟิลด์ที่ผิด
  module  // เฉพาะ FORBIDDEN
  need    // เฉพาะ FORBIDDEN — รายการบทบาทที่ต้องการ
  body    // body ดิบทั้งก้อน
}
```

**กฎที่คอมเมนต์หัวไฟล์ระบุชัด**: `error` เป็นรหัสสำหรับเครื่องอ่านเสมอ **ไม่ใช่ร้อยแก้วสำหรับ
ผู้ใช้** ผู้เรียกต้องแตกสาขาจาก `err.code` และเรนเดอร์ข้อความไทย/อังกฤษของตัวเองผ่าน `t()`
— **ห้ามพิมพ์ `err.message` ให้ผู้ใช้เห็น**

`fetch` reject เฉพาะเมื่อ network/CORS ล้มเหลว ไม่เคย reject บน 4xx/5xx — ดังนั้นความล้มเหลว
ของ fetch จึงถูกแปลงเป็น `ApiError('NETWORK_ERROR', 0, …)` ส่วน `AbortError` ถูกส่งต่อตามเดิม
(ผู้เรียกที่ยกเลิกคำขอเองต้องแยกแยะได้)

#### การจัดการ 401 — และทำไม 403 ไม่ทำแบบเดียวกัน

```js
if (res.status === 401) {
  clearStoredToken();
  for (const fn of listeners) { try { fn(new ApiError(...)); } catch {} }
}
```

401 หมายถึง token หายไป หมดอายุ หรือถูกลงนามด้วย secret อื่น (`AUTH_REQUIRED` /
`AUTH_INVALID` จาก middleware) การเก็บมันไว้จะทำให้ทุกคำขอถัดไปพังแบบเดียวกัน และ component
ที่ retry เมื่อ error จะวนไม่รู้จบกับ session ที่ตายแล้ว จึง **ทิ้ง token ตรงจุดเดียวที่เห็น
status** แล้วบอกชั้น auth ให้กลับไปหน้าเข้าสู่ระบบ

**จงใจไม่ทำแบบนี้กับ 403** — ตรงนั้น token ยังใช้ได้ คนคนนั้นแค่ไม่มีบทบาท การเตะเขาออกจากระบบ
เพราะเรื่องนี้จะทำให้งุนงง

การส่ง response ประเภทอื่น: `res.status === 204` → คืน `null`; `opts.raw: true` → คืน
`Response` เองสำหรับผู้เรียกที่ต้องการไฟล์ (PDF, xlsx); `FormData` body → ปล่อยให้เบราว์เซอร์
ตั้ง `multipart/form-data` พร้อม boundary ของตัวเอง

#### API ที่ instance เปิดออกมา

`get(path, opts)`, `post(path, body, opts)`, `put`, `patch`, `del(path, opts)`, `baseUrl`
พร้อมสองตัวช่วยสำหรับ `AuthProvider`:

- `onUnauthorized(fn)` — สมัครรับ 401 คืนฟังก์ชันยกเลิกการสมัคร
- `setTokenSource(fn)` — ชี้ client ไปที่ token ในหน่วยความจำของ `AuthProvider` แทน
  localStorage **สำคัญเมื่อ storage ถูกบล็อก**: เซสชันจะอยู่แค่ใน React state และถ้าไม่มีตัวนี้
  ทุกคำขอจะออกไปโดยไม่มีลายเซ็น

opts ที่รับได้: `{ auth: false }` (ไม่แนบ token — ใช้กับ endpoint เข้าสู่ระบบ), `headers`,
`signal`, `raw`

### 3.3 `auth.jsx` — `AuthProvider` / `useAuth` / `hasRole`

คอมเมนต์หัวไฟล์มีกล่องเตือนคาดเส้นที่ระบุว่า **`hasRole()` ซ่อน UI มันไม่ใช่ความปลอดภัย** —
ใช้เพื่อไม่ให้แสดงปุ่มที่กดแล้วจะได้ 403 อยู่ดี **ห้ามใช้ตัดสินว่าข้อมูลปลอดภัยพอที่จะดึงหรือไม่
— API เป็นผู้ตัดสินเรื่องนั้น**

#### สถานะที่ provider ถือไว้

| ค่า | ความหมาย |
|---|---|
| `user` | `{ email, name, roles, hrSites }` หรือ `null` |
| `token` | JWT ปัจจุบัน |
| `loading` | **เริ่มต้นเป็น `true` เมื่อมี token อยู่แล้ว** — เพื่อไม่ให้แอปกะพริบหน้าเข้าสู่ระบบขณะที่ `/api/auth/me` ยังยืนยันเซสชันที่น่าจะยังใช้ได้ |
| `error` | `ApiError` ล่าสุดที่ไม่ใช่ 401 |
| `signedIn` | `Boolean(user && token)` |

#### `tokenRef` — ทำไมต้องมี ref ทั้งที่มี state แล้ว

client อ่าน token ผ่าน **ref ไม่ใช่ค่า React** เพื่อให้ token ที่เพิ่งตั้งเมื่อครู่มองเห็นได้จาก
คำขอที่ยิงออกไปใน tick เดียวกัน — **ก่อนที่ re-render จะเกิดขึ้น** เช่นเดียวกัน `apiRef` มีไว้
ให้ effect ที่กู้คืนเซสชันเข้าถึง client ได้โดยไม่ต้องใส่ไว้ใน dependency array (effect นั้น
**ต้องรันครั้งเดียวเท่านั้น** — มันคือการกู้คืนเซสชัน ไม่ใช่การ subscribe)

#### การกู้คืนเซสชันตอน mount

effect ที่รันครั้งเดียว: ถ้ามี token ที่เก็บไว้ → เรียก `GET /api/auth/me`

**ตรวจกับเซิร์ฟเวอร์แทนการถอดรหัส JWT ที่เก็บไว้** เพราะ payload เป็น snapshot ณ เวลาเข้าสู่
ระบบ — บทบาทอาจถูกให้หรือถอนไปแล้ว และ token อาจหมดอายุไปแล้ว `/me` **พิสูจน์ทั้งสองเรื่องพร้อม
กัน**: ว่า token ยังถูกรับ และคืนบทบาทกับ hrSites ปัจจุบัน

การจัดการความล้มเหลวแยกเป็นสองกรณีโดยเจตนา:

- **401** — ถูกจัดการโดย listener `onUnauthorized` ไปแล้ว (ล้าง token, ล้าง user)
- **อื่น ๆ (API ล่ม, network)** — **ปล่อย token ทิ้งไว้** เพื่อให้การรีโหลดหลัง API กลับมา
  ทำงานได้ต่อเซสชันเดิม แทนที่จะบังคับให้ล็อกอินใหม่โดยไม่จำเป็น — แต่เพราะยังไม่มี user ที่
  ยืนยันแล้ว แอปจึงแสดงหน้าเข้าสู่ระบบ

#### `hasRole(module, ...allowed)` — **fail OPEN โดยเจตนา**

```js
const role = user?.roles?.[module] ?? null;
if (!role) return true;                       // ← สังเกตตรงนี้
return allowed.length === 0 || allowed.includes(role);
```

**นี่คือการตัดสินใจที่ขัดสัญชาตญาณและมีเหตุผลบันทึกไว้ในโค้ด**: การไม่รู้บทบาท — ไม่ว่าเพราะยัง
ไม่มีใครล็อกอิน หรือเพราะ API ยังไม่ตอบ — **ให้ผลเป็น "เปิด" ไม่ใช่ "ปิด"** การคืน `false` ตรงนี้
ทำให้ **ทุกปุ่มที่ขับด้วยสิทธิ์หายไปทุกครั้งที่ backend เข้าถึงไม่ได้** ผลคือโมดูลที่ฐานข้อมูล
หายไปดูเหมือนโมดูลที่ฟีเจอร์ถูกตัดทิ้งไปตอน port ปุ่มจึงถูกเรนเดอร์ และ **API เป็นผู้ปฏิเสธ
ถ้าคนคนนั้นไม่มีสิทธิ์เรียก**

(ตรงกับบันทึกความจำ "Permission flags must default open" — ฐานข้อมูลที่หายไปต้องไม่ซ่อนปุ่ม)

#### ฟังก์ชันอื่นที่ context เปิดออกมา

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `signInWithGoogle(idToken)` | `POST /api/auth/google` ด้วย `{ auth: false }` |
| `signInWithPassword(email, password)` | `POST /api/auth/login` ด้วย `{ auth: false }` |
| `signOut()` | ล้าง session + error |
| `refresh()` | อ่านบทบาทใหม่จาก `/api/auth/me` **โดยไม่ต้องล็อกอินซ้ำ** — ใช้หลังจาก admin ให้สิทธิ์ |
| `hasHrSite(siteKey)` | admin ผ่านเสมอ; คนอื่นต้องมี siteKey ใน `user.hrSites` — API บังคับซ้ำอีกชั้น |

#### `useAuth()` vs `useAuthOptional()`

- `useAuth()` — **throw** ถ้าไม่มี provider ใช้กับทุกอย่างที่ **gate** ตามตัวตน เพราะ provider
  ที่หายไปตรงนั้นคือบั๊กการต่อสาย ไม่ใช่คนที่ล็อกเอาต์อยู่
- `useAuthOptional()` — คืน `null` ถ้าไม่มี provider ใช้กับ chrome ที่ใช้ร่วมกันซึ่งเรนเดอร์ใน
  ทุกโมดูล **รวมถึงโมดูลที่ไม่มี `AuthProvider`** — **System Map เป็นหนึ่งในนั้นโดยเจตนา**:
  มันเป็นตัวเรนเดอร์แบบสถิตที่ไม่มีอะไรต้องปกป้อง การใส่ provider แค่เพื่อผ่านเกณฑ์จะเป็นการ
  วางกำแพงล็อกอินหน้าเพจที่ไม่ต้องการมัน `AppBar.jsx` ใช้ hook ตัวนี้

#### `<RequireRole module roles fallback>`

component ที่เรนเดอร์ลูกเฉพาะเมื่อ `hasRole()` ผ่าน — **ซ่อน ไม่ใช่ปกป้อง** เช่นเดิม

### 3.4 `theme.jsx` — สว่าง / มืด / ตามระบบ

#### สิ่งที่มันแทนที่

คอมเมนต์หัวไฟล์บันทึกสภาพก่อน port ไว้ครบ — **selector 4 แบบ และ storage key 5 ตัว**:

| โมดูล | selector เดิม | key เดิม |
|---|---|---|
| hr-worklog | `document.body.classList.toggle('dark')` | `hr_theme` |
| portal | `<html data-theme="dark\|light">` | (data-theme) |
| sop | `<html class="theme-dark">` | `sop-night` |
| meeting-minutes | `<html class="dark">` | `vcb_mm_theme` |
| credit-facility | `<html class="dark">` | `vcb-dark` |

selector 4 แบบหมายความว่า component ที่ยกจากโมดูลหนึ่งไปอีกโมดูลจะเรนเดอร์แบบไม่มีสไตล์ และ
key 5 ตัวหมายความว่าการสลับเป็นธีมมืดในแอปหนึ่งทิ้งแอปที่เหลือไว้ในธีมสว่าง — **ซึ่งเป็นสิ่งที่
ขวาง "หนึ่งเว็บไซต์" อยู่พอดี**

#### ข้อตกลงเดียวจากนี้ไป

```
selector: class="dark" บน <html>   (Tailwind 3 darkMode: 'class')
storage:  vcb_theme                ('light' | 'dark' | 'auto')
```

**ไม่มีอย่างอื่น** — ถ้า CSS ของโมดูลใดยังอิงกับ `body.dark` หรือ `[data-theme]` แสดงว่า CSS นั้น
ยังไม่ถูก port **ให้แก้ CSS อย่าเพิ่ม selector ที่สองที่นี่**

| ค่าคงที่ | ค่า |
|---|---|
| `THEMES` | `['light', 'dark', 'auto']` |
| `THEME_KEY` | `'vcb_theme'` |
| `DEFAULT_THEME` | `'auto'` — เพราะค่ากำหนดของ OS เป็นสัญญาณจริง คนที่ตั้งเครื่องเป็นธีมมืดคาดหวังให้แอปตามโดยไม่ต้องบอก |

#### การส่งธีมข้าม origin

`?theme=dark` ทำงานเหมือน `?vt=` ทุกประการ (`readUrlTheme` → `writeStoredTheme` →
`stripUrlTheme`) พอร์ทัลแนบไปกับทุกลิงก์โมดูล บนโดเมนเดียวมันซ้ำซ้อน — localStorage พาไปอยู่แล้ว
— แต่ localStorage ผูกกับ **origin** และตอน dev แต่ละโมดูลรันบนพอร์ตของตัวเอง ถ้าไม่มีตัวนี้
การตั้งพอร์ทัลเป็นสว่างแล้วเปิด HR จะได้ HR สีมืด ซึ่งดูเหมือน "การตั้งค่าถูกเพิกเฉย" มากกว่า
"ข้อจำกัดของการรัน dev server แปดตัว" มันยังครอบคลุมเคส production จริง: โมดูลที่เปิดจาก
bookmark บนเครื่องที่ไม่เคยเข้าพอร์ทัล

#### `applyTheme(resolved)` — สองอย่างที่ทำ ไม่ใช่หนึ่ง

```js
root.classList.toggle('dark', resolved === 'dark');
root.style.colorScheme = resolved;
```

`color-scheme` ถูกตั้งควบคู่ไปด้วย เพื่อให้ chrome ของเบราว์เซอร์เอง — form control, scrollbar,
สีพื้นหลังที่แวบขึ้นมาก่อน CSS จะวาด — เข้ากัน **ถ้าไม่มี หน้าธีมมืดจะยังมี scrollbar สีขาว**

#### `applyStoredThemeEarly()` — กันจอขาวกะพริบ

ต้องรันจาก inline `<script>` ใน `index.html` **ก่อน React mount** โค้ดที่ต้องวางมีให้ใน
docstring ของฟังก์ชัน (อ่าน `vcb_theme` ตรง ๆ จาก localStorage แล้ว toggle class บน
`documentElement` ในสคริปต์ที่ห่อ try/catch)

#### พฤติกรรม `'auto'`

effect ใน `ThemeProvider` **สมัคร listener ของ `matchMedia('(prefers-color-scheme: dark)')`
เฉพาะเมื่อ theme เป็น `'auto'`** เพราะในโหมด auto ระบบปฏิบัติการอาจสลับกลางเซสชันได้ (การตั้ง
เวลาตามพระอาทิตย์ตก, การกดสลับ dark mode ของระบบ) และหน้าเว็บต้องตามโดยไม่ต้องรีโหลด ส่วนใน
โหมด light/dark คนคนนั้น **ได้เขียนทับค่าของ OS ไปแล้ว** การเปลี่ยนแปลงของ OS จึงไม่ใช่ธุระของเรา

รองรับ Safari < 14 ด้วย (`mq.addEventListener` ถ้ามี ไม่งั้น `mq.addListener`) เพราะยังมี iPad
รุ่นเก่าใช้งานอยู่หน้างาน

#### `useTheme()` คืนอะไร

`{ theme, resolved, isDark, setTheme, cycleTheme, toggleTheme, themes }`
— `theme` คือ **สิ่งที่ถูกเลือก** (`light|dark|auto`), `resolved` คือ **สิ่งที่ถูกวาดจริง**
(`light|dark`) `cycleTheme()` วนสามค่าเพื่อให้ปุ่มเดียวขับได้ทั้งหมด; `toggleTheme()` สลับ
light/dark ทิ้ง auto ไว้เบื้องหลัง สำหรับสวิตช์สองสถานะธรรมดา

### 3.5 `i18n.jsx` — ไทย / อังกฤษ

**เขียนเองไม่มีไลบรารี** — TECH_STACK.md ห้าม dependency เพิ่ม และความต้องการเล็ก: สองภาษา,
key แบน, การแทรกค่าแบบเดียว

**ภาษาไทยเป็นค่าเริ่มต้น** (`DEFAULT_LANG = 'th'`) — ผู้ใช้เกือบทุกคนพูดไทย และข้อความต้นทางใน
โมดูลก็เป็นไทยอยู่แล้ว (พจนานุกรมของ hr-worklog คือ key ภาษาไทยพร้อมคำแปลอังกฤษที่ไม่บังคับ) ไทย
คือสิ่งที่ **มีอยู่** ส่วนอังกฤษคือสิ่งที่ **ถูกเพิ่มเข้ามา** การตั้งค่าเริ่มต้นเป็นอังกฤษจะแสดง
แอปที่แปลครึ่ง ๆ กลาง ๆ ให้คนส่วนใหญ่เห็นตอนโหลดครั้งแรก **ค่าที่ผู้ใช้เคยเลือกไว้ชนะค่าเริ่มต้นนี้เสมอ**

`LANG_KEY = 'vcb_lang'` — key เดียวสำหรับทุก SPA (เดิมคือ `vcb-lang`, `hr_lang`, `sop-lang`,
`vcb_mm_lang` แยกกัน) `?lang=th` ทำงานเหมือน `?theme=` และ `?vt=` ทุกประการ

`detectLang()` — ใช้เฉพาะเมื่อไม่มีค่าที่เก็บไว้: วนดู `navigator.languages` คืน `'th'` ถ้าขึ้นต้น
ด้วย th, `'en'` ถ้าขึ้นต้นด้วย en, ไม่งั้นคืน `DEFAULT_LANG`

#### `createDictionary(entries)` และการรวมพจนานุกรม

```js
export const dict = createDictionary({
  'entry.title': { th: 'บันทึกงาน', en: 'Entry' },
  'entry.saved': { th: 'บันทึกแล้ว',  en: 'Saved' },
});
```

`createDictionary()` เป็นเพียง `{ ...entries }` — มีไว้เพื่อความชัดเจนของเจตนา
`mergeDictionaries(...dicts)` รวมจากซ้ายไปขวา ตัวหลังชนะ

`I18nProvider` รวม `commonDictionary` กับ `dictionary` ของโมดูล (`mergeDictionaries(common,
dictionary)` — **โมดูลจึงเขียนทับคำกลางได้** เมื่อถ้อยคำของตัวเองต่างออกไป)

#### `commonDictionary` — คำที่ทุกโมดูลต้องใช้

เก็บ **เล็กโดยเจตนา** — อะไรที่ใช้แค่หน้าจอเดียวต้องอยู่ในพจนานุกรมของโมดูลนั้น กลุ่มคำที่มี:
actions (`common.save`, `common.cancel`, …), answers, states, **errors**, auth, settings, dates

**กลุ่ม `error.*` ถูก key ตรงกับรหัส error ของ API** เพื่อให้ catch block เขียนได้ว่า
``t(`error.${err.code}`)`` และตกกลับไปแสดงรหัสเองเมื่อยังไม่ได้แมป — มี `error.NETWORK_ERROR`,
`AUTH_REQUIRED`, `AUTH_INVALID`, `BAD_CREDENTIALS`, `FORBIDDEN`, `FORBIDDEN_SITE`, `NOT_FOUND`,
`VALIDATION_FAILED`, `ALREADY_EXISTS`, `INTERNAL`

**`app.company` — ชื่อบริษัทในที่เดียว**: คอมเมนต์บันทึกว่าโมดูลต่าง ๆ เขียนไว้ 4 แบบ —
"กลุ่มวิจิตรภัณฑ์ก่อสร้าง", "บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด", "Vichitbhan Construction Group"
และ **"Vichitphan" ที่สะกดด้วย p ซึ่งเป็นการสะกดผิดที่ขึ้นไปถึงแบนเนอร์ในสองโมดูล** ชื่อบริษัท
ไม่ใช่ทางเลือกด้านถ้อยคำของแต่ละโมดูล ค่าปัจจุบัน: `th: 'วิจิตรภัณฑ์ก่อสร้าง จำกัด'`,
`en: 'Vichitbhan Construction co.,Ltd.'`

#### `translate(dict, lang, key, vars)` — กฎการค้นหา

1. `key == null` → คืน `''`
2. ไม่พบ key → **คืนตัว key เอง ไม่เคยคืนค่าว่าง** เพราะ "หน้าจอที่สูญเสีย label ไปเงียบ ๆ แย่กว่า
   หน้าจอที่แสดง `entry.title` ซึ่งชี้ตรงไปยังรายการที่ขาดหายไปมาก"
3. entry เป็น string ธรรมดา → แปลว่า "เหมือนกันทั้งสองภาษา" (ปกติสำหรับวิสามานยนามและรหัส)
4. entry เป็น object → `entry[lang] ?? entry[DEFAULT_LANG] ?? key`

การแทรกค่าใช้รูปแบบ `{name}` เดียว (`PLACEHOLDER = /\{(\w+)\}/g`) และ **placeholder ที่ไม่รู้จัก
ถูกทิ้งไว้ให้มองเห็น** ไม่ถูกลบทิ้ง — "`{name}` ที่หลงอยู่ใน UI คือรายงานบั๊ก ส่วนข้อความว่าง
คือปริศนา"

#### `useI18n()` คืนอะไร

| ค่า | หมายเหตุ |
|---|---|
| `lang`, `setLang`, `toggleLang`, `isThai`, `dict` | — |
| `t(key, vars)` | ตัวแปลหลัก |
| `monthName(m, short)`, `weekdayName(d)` | จาก `MONTHS`, `MONTHS_SHORT`, `WEEKDAYS` |
| `displayYear(year)` | **`lang === 'th' ? year + 543 : year`** — หน้าจอ HR เดิมแสดง พ.ศ. เป็นค่าเริ่มต้นในภาษาไทยและ ค.ศ. ในภาษาอังกฤษ พฤติกรรมนี้ถูกรักษาไว้ |
| `formatDate(value, opts)` | `toLocaleDateString('th-TH' \| 'en-GB')` ตกกลับเป็น ISO slice เมื่อพัง |
| `formatNumber(n, opts)` | **บังคับ locale `'th-TH-u-nu-latn'`** เพื่อไม่ให้ th-TH เรนเดอร์ ๑๒๓ ในตารางที่คนอ่านคู่กับ Excel |

`useT()` — ทางลัดสำหรับ component ที่ต้องการแค่ `t` (`useI18n().t`)

`I18nProvider` ยังตั้ง `document.documentElement.lang = lang` เพื่อให้ CSS ปรับ line-height และ
ฟอนต์สำหรับภาษาไทยได้ — ไทยสูงกว่าละตินเพราะสระและวรรณยุกต์ที่ซ้อนกัน

`useI18n()` **throw** เมื่อไม่มี provider (ต่างจาก `useAuthOptional()` — i18n ไม่มีรูปแบบ optional)

### 3.6 `access.js` — สิทธิ์การใช้แอป

ชั้นบาง ๆ เหนือ `/api/portal/access/*` **ทุกฟังก์ชันรับ `api` เป็นอาร์กิวเมนต์แรก** เพราะ
`createApi()` เป็น factory ไม่ใช่ singleton — instance ที่สองจะไม่ได้ทั้งแหล่ง token และการ
จัดการ 401

| ฟังก์ชัน | Endpoint | ใช้ทำอะไร |
|---|---|---|
| `getAccessRoles(api, { app })` | `GET /api/portal/access/roles` | คลังคำศัพท์บทบาท — **เรนเดอร์ dropdown จากตัวนี้แทนการ hardcode ชื่อบทบาท** เพื่อให้แอปที่ได้บทบาทใหม่ได้มันใน UI โดยไม่ต้อง deploy |
| `getAccessGrants(api, { app, email })` | `GET /api/portal/access/grants` | สิทธิ์ที่มีอยู่ กรองด้วย app หรือ email |
| `getPersonAccess(api, email)` | `GET /api/portal/access/person/:email` | คนหนึ่งคนข้ามทุกแอป — **แอปที่มี `roles: []` ถูกรวมไว้ด้วยไม่ใช่ตัดทิ้ง** เพื่อให้หน้าจอแสดงภาพครบ |
| `setAccessGrant(api, { email, app, role, note })` | `PUT /api/portal/access/grants` | ให้/เปลี่ยน/ถอน — **idempotent**: PUT สถานะที่ต้องการ ไม่ใช่ delta; `role: null` = ถอน |
| `getAccessAudit(api, { email, app, limit })` | `GET /api/portal/access/audit` | ประวัติการเปลี่ยนแปลง — portal admin เท่านั้น |

> **สถานะสำคัญที่คอมเมนต์ในไฟล์ระบุตรง ๆ**: **ยังไม่มีการบังคับใช้** `resolveRoles()` ใน
> `api/src/auth.js` ยังอ่านตารางรายโมดูล (`hr.users`, `credit.managers`, …) อยู่ ดังนั้นสิทธิ์
> ที่ให้ผ่านหน้าจอนี้ **เปลี่ยนเฉพาะสิ่งที่หน้าจอ admin แสดง ยังไม่เปลี่ยนสิ่งที่ใครเปิดได้**
> การสลับ `resolveRoles()` ไปอ่าน `portal.access_grants` เป็นการเปลี่ยนแปลงแยกต่างหากที่ต้อง
> ตั้งใจทำ — ดู `supabase/migrations/008_access.sql` และหัวข้อ 4.9

### 3.7 `AppBar.jsx` — แถบบนที่ทุกโมดูลสวม

#### ทำไมต้องใช้ร่วมกันไม่ใช่คัดลอก

คอมเมนต์บันทึกสภาพก่อนหน้าไว้: **หกโมดูลต่างมีของตัวเอง** — ชื่อไฟล์ 4 แบบ (`Header.jsx`,
`TopBar.jsx`, `Topbar.jsx` หรือ inline ใน `App.jsx`), สองในนั้น **ไม่มีทางกลับพอร์ทัลเลย**,
หนึ่งในนั้นเปิดปุ่มสลับภาษาไว้เป็นปุ่มขณะที่ที่เหลือเก็บไว้ในตั้งค่า และข้อความแบรนด์อยู่ที่
17px, 20px และ 18px แล้วแต่ว่าเปิดไฟล์ไหน **ทุกอันคือการตัดสินใจเล็ก ๆ ที่ถูกทำสองครั้ง แล้ว
ค่อย ๆ ห่างกันไปตามตารางเวลาของตัวเอง**

หลักการที่อยู่เบื้องหลัง: "คนที่ย้ายจาก HR ไป Credit Facility ไม่ควรรู้สึกว่าตัวเองย้ายไปไหน —
ซึ่งเป็นจริงได้ก็ต่อเมื่อมีแถบเดียว ไม่ใช่หกแถบที่บังเอิญตรงกันในวันนี้"

#### สิ่งที่อยู่ในเฟือง (gear) และทำไม

**ภาษาและธีมอยู่หลังเฟืองเสมอ ไม่เคยเป็นปุ่มของตัวเอง** — มันถูกตั้งครั้งเดียวแล้วลืม ส่วนปุ่ม
ใช้เวลาอีก 99% ของชีวิตแย่งความสนใจกับ control ที่คนเข้ามาเพื่อใช้จริง ๆ

`<AppSettings open onClose extra footer />` — `extra` คือที่ที่โมดูลใส่สิ่งที่มีแค่ตัวเอง
(มุมมองเริ่มต้นของ SOP, กรอบเวลาล็อกของ HR, สิทธิ์โครงการของ Meeting Minutes) **ธีมและภาษาอยู่
ที่นี่สำหรับทุกคนและไม่ใช่ธุระของโมดูลที่จะทำซ้ำ**

#### การกลับพอร์ทัล

ชื่อแบรนด์คือทางกลับบ้าน (อย่างที่เว็บส่วนใหญ่เป็น) และมันพา **ธีมและภาษาปัจจุบันไปด้วย** เพื่อ
ไม่ให้พอร์ทัลพลิกหน้าตาเมื่อมีคนกลับไป `VITE_PORTAL_URL` ให้แต่ละ deployment ชี้ไปที่ที่ถูกต้อง
โดย **ค่าเริ่มต้นเป็น `'/'`** เพราะเมื่อทุกอย่างถูกเสิร์ฟจากโดเมนเดียว (ดู `docs/ONE_DOMAIN.md`)
พอร์ทัล **คือ** root

`<AppBar title subtitle subtitleTh>` — `title`/`subtitle` ตั้งชื่อโมดูล, `children` คือสิ่งที่
โมดูลต้องการในแถบ (ช่องค้นหา, nav, ตัวเลือกเดือน) และอยู่ระหว่างแบรนด์กับเฟือง

`AppBar` ใช้ `useAuthOptional()` **ไม่ใช่ `useAuth()`** เพื่อให้เรนเดอร์ได้ในโมดูลที่ไม่มี
`AuthProvider` (System Map) `descriptor` มีตรรกะกันชื่อบริษัทซ้ำ: ถ้าส่วนหัวของ subtitle
มีคำว่า วิจิตรภัณฑ์ / Vichitbhan / Vichitphan / VCB อยู่แล้ว จะไม่ต่อ `app.company` เข้าไปอีก

ลิงก์ออกจาก AppBar ใช้ `appLink()` ที่พา `theme`, `lang` และ `vt` (token) ไปด้วยทั้งสามตัว —
คือกลไกเดียวกันที่อธิบายไว้ในหัวข้อ 3.2 และ 3.4

---

## 4. สคีมาฐานข้อมูล — `supabase/migrations/`

Migration 9 ไฟล์ รันตามลำดับหมายเลข ทุกไฟล์เขียนแบบ **idempotent** (`create table if not
exists`, `on conflict do nothing`, `drop trigger if exists` ก่อน `create trigger`)

> **Discrepancy**: `api/package.json` ประกาศสคริปต์ `"migrate": "node scripts/migrate.js"`
> แต่ **ไดเรกทอรี `api/scripts/` ไม่มีอยู่จริงใน repo นี้** `npm run migrate` จึงพังทันที
> ปัจจุบันต้องรัน SQL ทั้ง 9 ไฟล์ตามลำดับด้วยมือ (Supabase SQL Editor หรือ `psql`)

### 4.1 ข้อเท็จจริงข้ามทุก migration

#### หก Postgres schema (ไม่ใช่ `public`)

`001_schemas.sql` สร้าง: `portal`, `credit`, `hr`, `minutes`, `sop`, `onboarding`
พร้อม `comment on schema` อธิบายหน้าที่แต่ละตัว

**เหตุผลที่ต้องแยก schema ไม่ใช่รวมใน `public` เดียว** ระบุไว้ตรง ๆ: `hr.employees` และ
`onboarding.employees` เป็นตารางคนละตัว — **primary key คนละแบบ (eid vs. name), วงจรชีวิตคนละ
แบบ, ความหมายคนละอย่าง** ถ้าอยู่ใน `public` เดียวกัน ตัวใดตัวหนึ่งต้องถูกเปลี่ยนชื่อ และ
`employees` ทุกตัวที่ไม่ระบุ schema ในโค้ดกลายเป็นการโยนหัวก้อย **หก schema ทำให้การชนกัน
เป็นไปไม่ได้ และทำให้การอ้างอิงแบบไม่ระบุ schema กลายเป็น error แทนที่จะเป็นคำตอบผิดที่เงียบ ๆ**

#### ไม่มี RLS — และห้ามใส่กลับ

**Row Level Security ไม่ปรากฏในทุก migration โดยเจตนา** และ policy 45 ตัวที่ไฟล์ `schema.sql`
รายโมดูลเคยมี **ถูกทิ้ง ไม่ใช่ถูก port** เหตุผล (ระบุใน `001_schemas.sql` และย้ำในทุกไฟล์ถัดไป):

RLS ทำงานได้ตอนที่เบราว์เซอร์ถือ Supabase anon key และคุยกับ Postgres โดยตรง — `auth.jwt() ->>
'email'` ระบุตัวผู้เรียกจริง policy จึงแยกคนหนึ่งจากอีกคนได้ **ตอนนี้เบราว์เซอร์ไม่ทำอย่างนั้น
แล้ว** Express เป็น client เพียงรายเดียว เชื่อมต่อในฐานะผู้ใช้ฐานข้อมูล **คนเดียว** ทุกคำขอจึง
หน้าตาเหมือนกันหมดสำหรับ Postgres

**policy ที่เขียนกับ `auth.jwt()` ในสถาปัตยกรรมนี้ไม่ได้จำกัดใครเลย** — มันคืน null สำหรับผู้เรียก
ทุกคน แล้วไม่ก็ล็อกทุกคนออก ไม่ก็ปล่อยทุกคนเข้า **ซึ่งแย่กว่าไม่มี policy เลย เพราะมันอ่านดู
เหมือนการปกป้อง**

> ห้าม "กู้คืน" RLS โดยไม่ย้าย API ออกจากตัวตนการเชื่อมต่อเดี่ยวก่อน จนกว่าจะถึงตอนนั้น ที่ที่
> ซื่อสัตย์ของกฎเหล่านี้คือ API และการแยกมันเป็นสองชั้นหมายความว่าครึ่งที่เป็น SQL จะผุอย่างเงียบ ๆ

#### สัญญา actor (actor contract)

Trigger ของ HR ต้องรู้ว่า **ใคร** กำลังเขียนและ **ด้วยบทบาทอะไร** เดิมมันถาม `auth.jwt()` ซึ่ง
ตอนนี้ไม่มีอะไรอยู่ข้างใน API จึงจัดหาให้แทน **ต่อทรานแซกชัน** ผ่านฟังก์ชันสองตัวใน
`001_schemas.sql`:

```sql
create or replace function hr.actor_email() returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('app.actor_email', true), ''), ''));
$$;

create or replace function hr.actor_role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.actor_role', true), ''), 'none');
$$;
```

ใช้แฟล็ก `missing_ok` (`true` ตัวที่สอง) เพื่อให้คำสั่งที่รันนอก API (psql session, migration)
**ไม่ error** — มันแค่ไม่มี actor และได้ `''` กับ `'none'` แทน ซึ่ง **fail closed ในทุกที่ที่ถูกใช้**

### 4.2 `001_schemas.sql` — schema และ actor contract

สร้าง 6 schema + `hr.actor_email()` + `hr.actor_role()` (รายละเอียดในหัวข้อ 4.1)

### 4.3 `002_portal.sql` — พอร์ทัล

| ตาราง | คีย์ | หน้าที่ |
|---|---|---|
| `portal.portal_admins` | `email` | รายชื่อ admin ของพอร์ทัล — `resolveRoles()` อ่านตอนเข้าสู่ระบบ |
| `portal.apps` | `key` | ไทล์แอปบนหน้าแรก: `name`, `name_th`, `description`, `description_th`, `url`, `icon`, `accent`, `sort_order`, `enabled` |
| `portal.announcement` | `id` (บังคับ `= 1`) | แบนเนอร์ประกาศ **แถวเดียวตลอดกาล** |

**`portal_admins` แทนที่ `ADMIN_PASSWORD_HASH` ScriptProperty ของ Apps Script** — รหัสผ่านที่ใช้
ร่วมกันรอดการย้ายมาเป็น SPA ไม่ได้ เพราะทั้ง hash และการเปรียบเทียบจะถูกส่งไปอยู่ใน browser
bundle ประตูจึงกลายเป็นรายชื่อคนบวก token จริง

**`portal.apps` แทนที่อาเรย์ `APPS` ที่ hardcode ไว้** — ไทล์เป็นแถวเพื่อให้ URL ที่ย้ายที่เป็น
การ update ไม่ใช่การแก้โค้ดแล้ว redeploy (URL ของ Credit Facility ที่ล้าสมัยและถูกแก้ด้วยมือ
เมื่อ 2026-08-30 คือความล้มเหลวที่เรื่องนี้ขจัดออกไปพอดี) คอลัมน์ `key` เป็นสิ่งที่ client ใช้
key ตารางไอคอนและ i18n ของตัวเอง **ซึ่งเป็นเหตุผลที่ API ปฏิเสธการ patch คอลัมน์นี้**

**`announcement` — `check (id = 1)` คือสิ่งที่ทำให้ "แบนเนอร์" เป็นสิ่งเดียว** แทนที่จะเป็น
รายการที่ UI ต้องเลือก

trigger `announcement_bump` (`before update`) เพิ่ม `revision` และแตะ `updated_at` ทุกครั้ง:

```sql
new.revision := old.revision + 1;
new.updated_at := now();
```

**`revision` เป็นเลขที่ client ใช้ปิดแบนเนอร์แยกต่อเครื่อง** มันต้องเปลี่ยนทุกครั้งที่บันทึก
ไม่งั้นแบนเนอร์ที่เขียนข้อความใหม่จะยังคง "ถูกปิดไปแล้ว" สำหรับทุกคนที่เคยปิดของเก่า (Apps
Script เดิมสร้าง uuid ใหม่ด้วยเหตุผลเดียวกัน)

แถวถูก seed ไว้ล่วงหน้า (`insert … on conflict do nothing`) เพราะ API ทำ upsert บน `id = 1`
และ `DELETE /announcement` **ล้างข้อความแทนที่จะลบแถว** — ตั้งใจให้ `revision` ไม่รีสตาร์ตแล้ว
กลับไปแสดงแบนเนอร์เก่าซ้ำ

### 4.4 `003_credit.sql` — Credit Facility

รายละเอียดเชิงธุรกิจอยู่ใน `credit-facility.md` ที่นี่สรุปเฉพาะโครงสร้าง:

| ตาราง / view | คีย์ | หมายเหตุ |
|---|---|---|
| `credit.managers` | `email` | แทนอาเรย์ `MANAGERS` ที่ hardcode ใน Code.js |
| `credit.projects` | `code` | CVE / LPB / PN4 / … — seed 8 โครงการจาก `SEED_PROJECTS` |
| `credit.facility_types` | `no` (1..10) | seed 10 ประเภทจาก `SEED_FAC_TYPES` |
| `credit.facilities` | `(project, facility_no)` | **`used` ไม่ใช่คอลัมน์โดยเจตนา** |
| `credit.transactions` | `id` (text — id ของชีตเดิม) | FK ไป `facilities(project, facility_no)` |
| `credit.requests` | `id` (text) | `linked_txn` → `transactions(id)` |
| `credit.limits` | `(project, facility_no)` | `used_override` `null` = คำนวณจาก transaction |
| `credit.category_caps` | `(project, cost_category)` | งบต่อหมวดต่อโครงการ |
| `credit.cost_categories` | `name` | API แทนที่ทั้งชุดเพราะ client แก้เป็นอาเรย์เรียงลำดับก้อนเดียว |
| `credit.cash_plan` | `id`, unique `(project, month, period_idx, variant)` | คอลัมน์ jsonb คงเป็น jsonb เพราะ client อ่าน/เขียนทั้งค่า |
| `credit.audit` | `id` (identity) | append-only เขียนภายในทรานแซกชันของผู้เรียก **เพื่อให้แถว audit ของการเขียนที่ rollback ไปแล้วมีอยู่ไม่ได้** |
| `credit.facility_used` (**view**) | — | คำนวณ `used` จาก transaction ที่ยังไม่ชำระ เว้นแต่ `limits.used_override` จะ pin ไว้ |

**`used` ไม่ใช่คอลัมน์เพราะมันไม่เคยเป็นคอลัมน์จริง ๆ** — แอปสดคำนวณจาก transaction ที่ยังไม่ชำระ
เว้นแต่ถูก pin การเก็บมันไว้ด้วยจะให้คำตอบสองอันที่ค่อย ๆ ต่างกัน **การเก็บกฎไว้ใน SQL หมายความ
ว่า client เบี่ยงจากมันไม่ได้**

**`facility_types` มีสองคอลัมน์ที่ดูซ้ำแต่ไม่ซ้ำ**: `kind` คือตระกูล, `doc_kind` คือป้ายสั้นที่
พิมพ์บน document pill ใน UI **มันไม่ใช่สตริงเดียวกันและ mapping ไม่สามารถ derive ได้** —
`kindShort()` แมป LG→BG, LGM→L/G, TL→T/L, AVAL→B/E, PN→P/N และปล่อย ML / DLC / PNPOST ผ่าน
(PNPOST แสดงเป็น 'PN-post') การเก็บทั้งสองคอลัมน์ทำให้ตารางนั้นอยู่ในที่เดียว แทนที่จะต้อง
derive ซ้ำใน API, client และรายงานทุกฉบับ

**`projects` และ `facility_types` เดิมมีอยู่แค่ในอาเรย์ที่ hardcode ใน mock ของ React** ทั้งที่
ทุกอย่างในโมดูลอ้างอิงมันอยู่แล้ว (`facilities.project` เป็นรหัสโครงการ, `facilities.facility_no`
เป็นเลขประเภท) — มันคือ foreign key ที่ชี้ไปยังความว่างเปล่า การทำให้เป็นตารางจริงหมายความว่า
การเปลี่ยนชื่อโครงการหรือเพิ่มประเภทวงเงินคือแถวหนึ่งแถว ไม่ใช่การ redeploy ทั้งหน้าบ้านและ mock

### 4.5 `004_hr.sql` — HR Work Log (มี trigger ที่บังคับกฎธุรกิจ)

**ไฟล์นี้เป็นข้อยกเว้นที่จงใจของกฎ "ไม่มีตรรกะในฐานข้อมูล"** กฎเรื่องกรอบเวลาแก้ไข ความสอดคล้อง
ของหน่วยงาน และ audit **ยังเป็น trigger และต้องเป็น trigger ต่อไป** — เพราะมัน **ไม่ใช่การ
ควบคุมการเข้าถึง มันคือความถูกต้องของข้อมูล (data integrity)** และประเด็นของการเก็บไว้ในฐาน
ข้อมูลคือ psql session หรือสคริปต์ครั้งเดียวเลี่ยงมันไม่ได้แบบที่เลี่ยง Express middleware ได้

#### ตาราง

| ตาราง / view | คีย์ | หมายเหตุ |
|---|---|---|
| `hr.users` | `email` | **ตารางล็อกอินด้วยรหัสผ่านของทั้งพอร์ทัล** — `POST /api/auth/login` อ่าน `email, name, password_hash` จากที่นี่ `role` มี `check (role in ('admin','manager','staff'))` |
| `hr.config` | `key` | `LOCK_DAYS` seed เป็น `'3'` |
| `hr.sites` | `site_key` | **ไม่ใช่ `key`** — ดูหมายเหตุด้านล่าง |
| `hr.teams` | `(site_key, name)` | FK → sites, on delete cascade |
| `hr.employees` | `eid` | **คีย์ด้วย eid — ไม่ใช่สิ่งเดียวกับ `onboarding.employees`** |
| `hr.master_index` | `id` | แคตตาล็อกกิจกรรมที่ตัวเลือกเสนอให้ |
| `hr.cost_index` | `id` | รหัสต้นทุนของ ERP |
| `hr.migrations` | `id` (identity) | บันทึกการย้ายหน่วยงานของพนักงาน |
| `hr.leave_requests` | `id` (`'LV'` + timestamp) | ใบลาที่พิมพ์ออกมาพก id นี้ |
| `hr.audit_log` | `id` (identity) | **หนึ่งแถวต่อหนึ่งเซลล์ที่เปลี่ยน — append-only เขียนโดย trigger** |
| `hr.work_days` | `(eid, entry_date)` | หมายเหตุประจำวัน |
| `hr.work_entries` | `id`, unique `(eid, entry_date, slot)` | รายการงานรายวัน |
| `hr.mandays` (**view**) | — | **หนึ่ง manday ต่อคนต่อวัน ไม่ว่ากรอกกี่ slot** |

**`password_hash` และ `name` เดิมไม่มีเลย**: ชีตไม่มีรหัสผ่าน (Apps Script ได้ตัวตนจาก Google)
และไม่มีชื่อสำหรับแสดงผล ทั้งสองจำเป็นแล้วตอนนี้ `password_hash` เป็น **nullable โดยเจตนา**
(ผู้ใช้ Google Sign-In ไม่มีรหัสผ่านโดยชอบธรรม — ดูหัวข้อ 2.2)

**`hr.sites` ใช้ `site_key` ไม่ใช่ `key`**: สคีมาเก่าเรียกมันว่า `key` ขณะที่ `auth.js` และทุก
route ใน `hr.js` คิวรี `site_key` — ตัวใดตัวหนึ่งต้องขยับ และ `site_key` คือชื่อที่ปรากฏใน
`hr.users`, `hr.employees`, `hr.work_entries` และ `hr.leave_requests` การเปลี่ยนสี่ตัวนั้นให้
ตรงกับ `key` ของตารางเดียวคือการเปลี่ยนที่ใหญ่กว่า ไฟล์มีบล็อกรองรับฐานข้อมูลที่สร้างก่อนการ
rename (รันเฉพาะเมื่อคอลัมน์ `key` ยังอยู่)

**`hr.employees.email` — ดูหัวข้อ 2.2** มี index `employees_email_idx on hr.employees(lower(email))`

#### รูปแบบตารางกว้าง (wide tab) และการนำเข้า

ชีตเก็บงานรายวันใน **แท็บกว้างต่อ (site, month): หนึ่งแถวต่อคน 98 คอลัมน์** — "AM 1", "Note 1", …
แล้วต่อท้ายด้วยบล็อก "PM 1".."PM 31" รูปแบบนั้นบังคับเพดาน 31 วัน และทำให้ความหมายของคอลัมน์
ขึ้นกับตำแหน่งของมัน ที่นี่กลายเป็นหนึ่งแถวต่อ (employee, date, slot)

**สี่สิ่งที่ทำให้การ pivot เสียหายอย่างเงียบ ๆ** (ระบุไว้ในคอมเมนต์):

1. **ชื่อแท็บเป็นพุทธศักราช** — `2569-08` คือ ค.ศ. 2026-08 (ลบ 543) ผิดตรงนี้แล้วทั้งเดือนไปอยู่
   ใต้ปีผิดอย่างเงียบ ๆ
2. **เซลล์ว่างหมายถึงไม่มีรายการ** ไม่ใช่รายการที่มีค่าเป็น `''` — การเขียนแถวสำหรับเซลล์ว่าง
   ทำให้ทุกจำนวนนับและทุกยอด manday พองขึ้น
3. **วันที่ 29-31 ไม่มีอยู่ในทุกเดือน** — ต้องข้ามคอลัมน์เหล่านั้น ไม่ใช่สร้างวันที่ที่เป็นไปไม่ได้
4. **`site_key` มาจากชื่อแท็บ** ผ่านการย้อนกลับของ `siteSheetMap_()`

คำแนะนำในโค้ด: ตรวจจำนวนแถวเทียบกับการนับมือของเดือนที่รู้แน่หนึ่งเดือนสำหรับสอง site ก่อนเชื่อ
ผลการนำเข้า และหาแท็บ `_legacy_<siteName>` ที่หลงเหลือก่อน — การ migrate รูปแบบยาวครั้งก่อน
**rename แทนที่จะลบ**

#### `slot` ไม่ใช่ช่วงเวลาของวัน

คอลัมน์ของชีตคือ "AM N" / "PM N" และโค้ดเก่ายังพูดแบบนั้น แต่แอปแสดง **งานหลัก** กับ
**"+ งานที่ 2 (ถ้ามี)"** การ auto-mirror จาก AM ไป PM **ถูกปิดโดยเจตนา** พร้อมเหตุผลบันทึกไว้ใน
Code.gs: การคัดลอกงานหลักไปช่องที่สอง "จะเปลี่ยนทุกวันที่มีงานเดียวให้เป็นวันสองงาน และทำลาย
คณิตศาสตร์ 1 manday ต่อวัน"

**ดังนั้น slot 1 = งานหลัก, slot 2 = งานเสริมที่ไม่บังคับ และวันที่มีทั้งสองยังเป็น ONE manday**
การตั้งชื่อคอลัมน์นี้ว่า `period` ด้วยค่า 'am'/'pm' — อย่างที่ร่างก่อนหน้าทำ — เชิญชวนให้เกิด
การคำนวณผิดนั้นพอดี

#### view `hr.mandays` — ห้ามคำนวณ manday ด้วยวิธีอื่น

```sql
create or replace view hr.mandays as
  select distinct eid, site_key, entry_date, 1::int as mandays
    from hr.work_entries
   where coalesce(value, '') <> '';
```

**ใช้ view นี้สำหรับทุกยอดปริมาณงานและต้นทุน** การนับแถว `work_entries` แทน **นับซ้ำทุกวันที่มี
สองงาน** ซึ่งทำให้ตัวเลขของ site ที่บันทึกงานเสริมพองขึ้นพอดี และมัน **ไม่ปรากฏเป็น error ที่
ไหนเลย — ตัวเลขแค่ผิด**

ใช้ `distinct` ไม่ใช่ `group by` เพราะไม่มีอะไรต้อง aggregate — คิวรีต้องการเซตของคู่
(พนักงาน, วัน) ที่มีงานใด ๆ เท่านั้น

#### Trigger — กฎเรื่องกรอบเวลาแก้ไข

กฎเรื่องเวลาสองข้อที่เลย์เอาต์ของชีตแสดงออกไม่ได้:

- **ห้ามใครกรอกล่วงหน้าเกินหนึ่งวัน** — ทุกคน รวมทั้ง admin เพื่อไม่ให้กรอกทั้งเดือนล่วงหน้าก่อน
  มันเกิดขึ้นจริง
- **ผู้ที่ไม่ใช่ admin แก้ย้อนหลังได้ไม่เกิน `LOCK_DAYS` (ค่าเริ่มต้น 3)**

```sql
create or replace function hr.entry_window_ok(p_date date)
returns boolean language sql stable as $$
  select p_date <= (current_date + 1)
     and (hr.actor_role() = 'admin'
          or p_date >= (current_date - coalesce(
               (select value::int from hr.config where key = 'LOCK_DAYS'), 3)));
$$;
```

`hr.enforce_entry_window()` raise exception ด้วย **`errcode = '42501'`** เมื่อไม่ผ่าน และ
**ยังแตะ `new.updated_at := now()` ด้วย** (เป็นเหตุผลที่ trigger `work_entries_touch` เดิมถูก
ทิ้ง — trigger สองตัวเขียนคอลัมน์เดียวเป็นปริศนาสำหรับคนที่อ่านต่อ และ window trigger ข้ามไม่ได้อยู่แล้ว)

ผูกกับสองตาราง: `work_entries_window` และ `work_days_window` (ทั้ง `before insert or update`)

**`api/src/routes/hr.js` จงใจไม่ทำซ้ำกฎนี้** — มันแค่แปลง `42501` ที่ trigger raise ให้เป็น 403
พร้อมเหตุผล

**ทำไมมันถูกเขียนใหม่**: เดิมมันเรียก `is_hr_admin()` ซึ่งอ่าน `auth.jwt()` เมื่อไม่มี Supabase
JWT มันคืน `'none'` สำหรับ **ทุกคน** ผลคือ **HR admin ถูกล็อกออกจากการแก้ไขนอกกรอบเวลาเหมือน
พนักงานทั่วไปเป๊ะ ๆ — ทั้งที่เขาคือคนเดียวที่ข้อยกเว้นนี้มีไว้เพื่อ**

#### Trigger — ความสอดคล้องของหน่วยงาน

`hr.enforce_entry_site()` — รายการต้องอยู่บน site ของพนักงานคนนั้นเอง ไม่งั้น raise ด้วย
`errcode = '23514'` (check constraint violation → API แปลเป็น 400 `CHECK_CONSTRAINT_FAILED`)
ผูกเป็น trigger `work_entries_site`

**คอมเมนต์เตือนเรื่องที่เกี่ยวกัน**: `hr.migrations` (การย้ายหน่วยงาน) ต้องถูกบันทึกและ **นำไปใช้
ในทรานแซกชันเดียวกัน** โดย API — การทำครึ่งเดียวทิ้ง `enforce_entry_site` ไว้ปฏิเสธทุกการเขียน
ของคนนั้นหลังจากนั้นโดยไม่มีสาเหตุที่ชัดเจน

#### Trigger — audit

`hr.audit_work_entry()` (`after insert or update` บน `work_entries` → trigger
`work_entries_audit`) เขียนหนึ่งแถวลง `hr.audit_log` ต่อหนึ่งเซลล์ที่เปลี่ยน ตรงกับที่
`writeWideCells_` ทำในชีต

- **ข้ามเมื่อไม่มีอะไรเปลี่ยนจริง**: `if tg_op = 'UPDATE' and new.value is not distinct from
  old.value then return new;`
- ฟิลด์ `field` เขียนเป็น `'slot' || new.slot`
- ดึง `emp_name` จาก `hr.employees` มาเก็บไว้ในแถว audit ด้วย

**ทำไมมันถูกเขียนใหม่**: actor เดิมมาจาก `auth.jwt() ->> 'email'` ซึ่งเป็น null ที่นี่ ทุกแถวจึงถูก
เขียนด้วย `email = ''` — **audit log ที่บันทึกว่ามีอะไรเปลี่ยนแต่ไม่บันทึกว่าใครเปลี่ยน ซึ่งเป็น
ข้อเท็จจริงเดียวที่มันมีไว้เพื่อถือ** ตอนนี้อ่าน `hr.actor_email()`

**ถ้า API ลืมตั้ง actor แถวยังถูกเขียนด้วย actor ว่าง ไม่ใช่ให้การเขียนล้มเหลว** — เสียชื่อไป
หนึ่งชื่อแย่ แต่เสียทั้งรายการและร่องรอยแย่กว่า **ถ้าสงสัยว่ามี code path ที่ข้ามไป ให้มองหา
actor ที่เป็น `''`** (นี่คือความล้มเหลวที่พารามิเตอร์ `user` ของ `tx()` มีไว้ป้องกัน — ดูหัวข้อ 2.5)

**`hr.audit_log` ไม่มี write endpoint โดยเจตนา** — audit log ที่ client เขียนได้ไม่ใช่หลักฐาน
ของอะไรเลย และการเขียนโดย trigger หมายความว่าการแก้ไขจาก SQL client ก็ถูก audit ด้วย

### 4.6 `005_minutes.sql` — Meeting Minutes

| ตาราง | คีย์ | หมายเหตุ |
|---|---|---|
| `minutes.admins` | `email` | แทน `ADMIN_EMAILS` ใน Config.js |
| `minutes.editors` | `email` | แทนรายการ `EDITOR_EMAILS` ที่จัดการเองจากหน้าตั้งค่า |
| `minutes.projects` | `id` (slug จากอักษรย่อ) | `visibility check in ('public','locked')`, `domain`, `builtin` |
| `minutes.project_guests` | `(project_id, email)` | อีเมลที่ถูกระบุชื่อบนโครงการที่ล็อก |
| `minutes.minutes` | `id`, unique `(project_id, meeting_key)` | `kind check in ('overview','meeting')`, `source check in ('doc-import','manual','fathom','transkriptor')`, `tagged_project_ids` มี GIN index |
| `minutes.versions` | `id` (identity) | snapshot ก่อนแก้ append-only |
| `minutes.audit_log` | `id` (identity) | ทุก mutation ที่เปลี่ยนเนื้อหา |
| `minutes.fathom_raw_log` | `id` (identity) | payload webhook ดิบ เก็บไว้ replay และวินิจฉัย **ไม่มี write endpoint** |

**สามระดับสิทธิ์ (tier) ถูกจำลองใน API ไม่ใช่ที่นี่**:
`public` (ใครก็อ่านได้ ไม่ต้องล็อกอิน — 🔓 ของแอป), `locked` (admin, editor และ
`minutes.project_guests` — 🔒), `guest` (ผู้ดูที่ถูกระบุชื่อบนโครงการที่ล็อก: อ่านอย่างเดียว
เฉพาะโครงการนั้น) route อ่านใช้ `allowAnonymous` แล้วกรอง tier ใน SQL เพราะแอปเดิม deploy เป็น
`ANYONE_ANONYMOUS` **ผู้เยี่ยมชมที่ไม่มีเซสชันจึงเป็นผู้เรียกที่คาดหมายได้ และ 401 จะเป็น regression**

**`projects.domain` คือแกนที่สามที่เป็นอิสระ ไม่ใช่คำพ้องของ `visibility`**:
- `visibility='public'` = ใครก็ตามที่มีลิงก์ ไม่ต้องล็อกอิน โดเมนใดก็ได้
- `domain=true` = ทุกอีเมล `@vcb-con.com` ที่ล็อกอินแล้ว **และไม่มีใครอื่น**

โครงการที่ล็อกและ `domain=true` อ่านได้ทั่วบริษัทแต่ไม่สาธารณะ ส่วนโครงการสาธารณะไม่บอกอะไรเลย
ว่าพนักงานถูก allow-list ไว้หรือไม่ **คอลัมน์นี้เคยมีอยู่ในไทป์ของ React และใน mock
(`ProjectAccess.domain`) โดยไม่มีคอลัมน์รองรับ** — admin เปิดมันได้แล้วค่าระเหยไปตอนรีโหลด

**`minutes.versions` เก็บ `title`, `dateLabel` และ `time` ด้วย ไม่ใช่แค่ `html`**: การทำ
version เฉพาะเนื้อหาทำให้ "View Original" แสดง **ชื่อปัจจุบัน** ของแถวหลังการเปลี่ยนชื่อ (ยืนยัน
เมื่อ 2026-07-22) snapshot ที่ถ่ายไว้ก่อนการแก้นั้นมีแต่ `html` และสัญญาที่บันทึกไว้ของ API คือ
**คืน `''` สำหรับฟิลด์ที่หายไป**

**สองกล่องขาเข้า (inbox) เป็นเป้าหมายของ foreign key ไม่ใช่ของประดับ**: ทุกการบันทึกจาก Fathom
หรือ Transkriptor ที่เข้ามาลงเป็นแถวที่ `project_id` เป็นหนึ่งในสอง id นี้ **ถ้าไม่มีแถวเหล่านี้
foreign key ของ `minutes.minutes` จะปฏิเสธการ insert และการ ingest ล้มเหลว — บน webhook ที่ไม่มี
ใครเฝ้าดู และการบันทึกนั้นก็สูญหายไปเฉย ๆ** ทั้งสองเป็น `locked` (การบันทึกยังไม่สาธารณะจนกว่าจะ
มีคนจัดเก็บ) และ `builtin` (API ปฏิเสธการลบโครงการ builtin ซึ่งเป็นสิ่งที่กัน admin ไม่ให้ลบ
inbox แล้วทำ ingest พัง) route ของ tag ยัง **ปฏิเสธการ tag เข้าไปในนั้นด้วย id** เพื่อให้ inbox
คงเป็นจุดมาถึงและไม่กลายเป็นปลายทาง

### 4.7 `006_sop.sql` — SOP

| ตาราง | คีย์ | หมายเหตุ |
|---|---|---|
| `sop.sop_editors` | `email` | ผู้มีสิทธิ์แก้ไข |
| `sop.sop_document` | `id` (บังคับ `= 1`) | **ต้นไม้ SOP ทั้งหมด `{ meta, scenarios, reports }` เป็นแถวเดียว** |
| `sop.sop_versions` | `id` (identity) | ประวัติเวอร์ชัน |

**จงใจไม่ normalize เป็น module และ step**: client อ่านและเขียนต้นไม้ทั้งก้อนและเรียงเลขใหม่ทุก
ครั้งที่บันทึก การแยกมันจะหมายถึงการสร้างตรรกะนั้นใหม่โดยไม่ได้อะไรเลย จนกว่าจะมีอะไรคิวรีทีละ
step จริง ๆ รูปทรงแถวเดียวบังคับด้วย `check (id = 1)`

ใน Apps Script สิ่งนี้อยู่ใน ScriptProperties **แยกเป็นหลาย key เพราะ property หนึ่งตัวมีเพดาน
ขนาด** Postgres ไม่มีเพดานแบบนั้น การแบ่งก้อนจึงหายไป

#### Trigger `sop_snapshot`

```sql
create or replace function sop.snapshot_before_update() … ;
create trigger sop_snapshot before update on sop.sop_document …
```

ถ่าย snapshot เอกสารเดิมก่อนการเขียนทับทุกครั้ง **เป็น trigger ไม่ใช่การเรียกจาก API ด้วยเหตุผล
ที่ควรรักษาไว้**: ประวัติเวอร์ชันที่ขึ้นกับการที่แต่ละ route จำได้ว่าต้อง snapshot คือประวัติที่
มีรูโหว่ และรูนั้นจะปรากฏบน code path ที่ใครบางคนเพิ่มเข้ามาตอนรีบพอดี **ที่นี่การ restore เอง
ก็ย้อนกลับได้**: การเขียนเอกสารเก่ากลับเป็น update ธรรมดา เอกสารปัจจุบันจึงถูก snapshot ก่อน
และไม่มีอะไรสูญหาย

**แถวเอกสาร ไม่ ถูก seed ด้วยต้นไม้ว่าง** ทุก mutation route คืน 409 `NOT_SEEDED` เมื่อไม่มีแถว
ซึ่งเป็นสัญญาณชัดเจนว่ายังต้องโหลดเนื้อหาเข้ามา แถว `{}` ว่าง ๆ จะปล่อยให้ editor เริ่มเขียนลงใน
เอกสารที่การนำเข้าจริงจะเขียนทับทีหลังแทน วิธี seed: เปิด `<exec-url>?diag=sopdata` คัดลอก JSON
แล้ว `insert into sop.sop_document (id, data) values (1, '<json>'::jsonb);`

**หมายเหตุเรื่อง Google Doc (`SOP_DOC_ID`)**: มันเคยเป็น **live one-way mirror** — ทุกการบันทึก
ในแอป Apps Script เขียนลงไป แต่การแก้ Doc ไม่เคยไหลกลับ หลัง migration `sop_document` เป็นผู้ถือ
เนื้อหา **ต้องตัดสินใจอย่างตั้งใจว่าจะเขียน mirror นั้นต่อหรือไม่ — ถ้ามันหยุดอย่างเงียบ ๆ มันจะ
เก่าไปเรื่อย ๆ ในขณะที่ยังดูเหมือนเป็นแหล่งอ้างอิง ซึ่งเป็นสิ่งที่แย่ที่สุดของทั้งสองทาง**

### 4.8 `007_onboarding.sql` — Onboarding

| ตาราง | คีย์ | หมายเหตุ |
|---|---|---|
| `onboarding.employees` | **`name`** | ตัวตนคือชื่อที่พิมพ์ลงกล่องและเก็บใน localStorage; `level check in ('junior','senior')` |
| `onboarding.progress` | `id` (identity), unique `(employee_name, task_id)` | FK → `employees(name)` on delete cascade |
| `onboarding.checklist_overrides` | `item_id` | ทับเนื้อหาที่ hardcode ใน React bundle ตอน render |

**พื้นผิวที่กว้างที่สุดในระบบ และนั่นเป็นความตั้งใจไม่ใช่ความบกพร่อง**: คนที่ใช้โมดูลนี้คือ
พนักงานใหม่ในวันแรก **ก่อนที่จะมีใครสร้างบัญชีให้** เวอร์ชัน Apps Script ไม่มีการล็อกอินเลย
route ส่วนใหญ่จึงเป็น `allowAnonymous` โดยจำกัดขอบเขตที่พนักงานหนึ่งคนที่ระบุชื่อต่อคำขอ
ยกเว้น `checklist_overrides` (เนื้อหาที่ใช้ร่วมกันซึ่งเรนเดอร์ลงหน้าของทุกคน —
`requireRole('portal','admin')`) และมุมมอง cohort ของ admin

**ไม่มีอะไรที่อ่อนไหวอยู่ที่นี่**: ชื่อ, แผนก, ระดับ และเซตของ checkbox ที่ติ๊กแล้ว
**ห้ามใส่อะไรที่จะเสียหายถ้าถูกอ่านหรือถูกปลอมลงที่นี่** — ถ้าโมดูลนี้ต้องถือของจริงเมื่อไหร่
มันต้องมีบัญชีจริงก่อน

**`onboarding.employees` ไม่ใช่ตารางเดียวกับ `hr.employees`** ซึ่งคีย์ด้วย eid และถือทะเบียน
พนักงานจริง ตารางสองตารางชื่อเดียวกันคือเหตุผลที่แม่นยำว่าทำไมมันอยู่คนละ schema

**ชื่อคือ primary key ดังนั้น API จึง `trim()` ทุกที่ก่อนมันมาถึงที่นี่** — variant ที่ไม่ถูก
trim สร้างระเบียนที่สองที่ว่างเปล่า ซึ่งในสายตาพนักงานดูเหมือนความคืบหน้าของเขาหายไปพอดี

**foreign key ของ `progress` มีน้ำหนัก**: มันเปลี่ยนชื่อที่พิมพ์ผิดให้กลายเป็น `23503` ที่ API
รายงานเป็น 409 แทนที่จะเป็นแถว progress กำพร้าที่ไม่มีใครจะอ่านมันอีก

**`checklist_overrides` — แถวที่ถูกลบถูกเก็บไว้ (`deleted = true`) ไม่ใช่ถูกลบจริง** เพราะ
client ต้องมีแถวนั้นเพื่อจะรู้ว่าต้องซ่อนรายการที่ hardcode ไว้ซึ่งมันทับอยู่ **การ hard delete
จะทำให้รายการนั้นโผล่กลับมา** และหมายเหตุ: **นี่ไม่ใช่ audit trail** แถวถูก upsert ทับที่เดิม
การแก้ไขจึงเขียนทับข้อความเดิมโดยไม่มีประวัติและไม่มีคอลัมน์ actor

**Storage bucket**: `insert into storage.buckets (id, name, public) values ('required-documents', …)`
— **การ insert นี้ต้องใช้ service role ในบางโปรเจ็กต์ Supabase ถ้ามันล้มเหลว ให้สร้าง bucket
ด้วยมือ** (Storage → New bucket, id `required-documents`, **ไม่** public) แล้วรันใหม่ ทุกอย่างที่
เหลือในไฟล์เป็นอิสระจากมัน

path ของเอกสารคีย์ด้วย **ชื่อพนักงาน + docId + นามสกุล และ ไม่ใช่ ชื่อไฟล์ที่อัปโหลด**: เมื่อมี
ชื่อไฟล์อยู่ใน path การอัปโหลดไฟล์ชื่อต่างกันสำหรับข้อกำหนดเดียวกันสร้าง object **ที่สอง** แทน
ที่จะแทนที่อันแรก และไม่มีใครบอกได้ว่าอันไหนเป็นปัจจุบัน

#### ฟังก์ชันที่ถูกทิ้ง — และห้ามกลับมา

`check_admin_password()`, `admin_save_checklist_item()` และ `admin_delete_checklist_item()`
ถูก drop (ตามลำดับ dependency เพราะตัวหลังเรียกตัวหน้า) และ **ต้องไม่กลับมา**

มันคือ **ประตูหลังด้วยรหัสผ่านที่ใช้ร่วมกัน**: ฟังก์ชัน security-definer ที่เทียบสตริงที่ผู้เรียก
ส่งมากับ Postgres setting แล้วถ้าตรงก็เขียนตารางแทนผู้เรียก — **ข้ามข้อเท็จจริงที่ว่าตารางนั้น
ไม่มี write policy** และถูก grant ให้ `anon` **โดยการออกแบบ** เพราะประเด็นทั้งหมดคือให้เบราว์เซอร์
ที่ไม่ได้ยืนยันตัวตนเขียนได้

สามเหตุผลที่มันเป็นช่องโหว่ที่ยังมีชีวิต ไม่ใช่แค่ของล้าสมัย:

1. **รหัสผ่านเดียวที่ admin ทุกคนใช้ร่วมกัน ไม่มีตัวตนผูกอยู่** คำถาม "ใครแก้อันนี้" จึงไม่มี
   คำตอบแม้แต่ในหลักการ
2. `current_setting('app.admin_password', true)` **คืน NULL เมื่อ setting ไม่เคยถูกตั้ง** และ
   ค่า fallback ของฟังก์ชันเอง (`'__unset__'`) เป็น literal ที่ใครก็ตามที่อ่านไฟล์นี้ส่งไปได้
3. **ฟังก์ชัน security-definer ที่ grant ให้ anon คือข้อเสนอที่ยืนอยู่ตลอดเวลา** — มันรันในฐานะ
   เจ้าของ ดังนั้นอะไรก็ตามที่ผิดพลาดในการตรวจสอบคือสิทธิ์เขียนเต็มรูปแบบลงในเนื้อหาที่ใช้ร่วมกัน
   ซึ่งเรนเดอร์ลงหน้าของพนักงานทุกคน

**สิ่งที่มาแทน**: `requireAuth + requireRole('portal','admin')` บน `PUT/DELETE
/api/onboarding/checklist` — ประตูเดียวกัน แต่เป็นคนที่มีชื่อจริง และ audit trail เป็นไปได้

### 4.9 `008_access.sql` — การบริหารสิทธิ์รวมศูนย์

#### ทำไมมันมีอยู่

สิทธิ์ปัจจุบันอยู่ใน **6 ตารางที่มี 6 รูปร่างต่างกัน**: `hr.users` มีคอลัมน์ role,
`credit.managers` เป็น membership ล้วน, `minutes` มี admins กับ editors แยกกัน, `sop` มี
`sop_editors`, `portal` มี `portal_admins` — `resolveRoles()` รัน 6 คิวรีแล้ว normalize เป็น
object เดียว

**มันใช้ได้สำหรับการ อ่าน บทบาทของคนคนหนึ่ง แต่ไร้ประโยชน์สำหรับการ บริหาร มัน**: ไม่มีตารางเดียว
ที่หน้าจอ admin จะ list ได้, ไม่มีคลังคำศัพท์ว่าแอปหนึ่ง ๆ มีบทบาทอะไรบ้าง และการเพิ่มแอปหนึ่งตัว
หมายถึงการเขียนตารางเฉพาะกิจอีกตารางและอีกหนึ่งสาขาใน `resolveRoles()`

| ตาราง | คีย์ | หน้าที่ |
|---|---|---|
| `portal.app_roles` | `(app_key, role)` | **คลังคำศัพท์**: บทบาทใดมีอยู่ ต่อแอป และแต่ละตัวหมายถึงอะไร (`label`, `label_th`, `description`, `rank`) |
| `portal.access_grants` | `(email, app_key)` | ใครมีบทบาทอะไรในแอปไหน |
| `portal.access_audit` | `id` (identity) | ทุกการเปลี่ยนแปลงสิทธิ์ เก็บตลอดไป |

**`app_roles` เป็นเชิงพรรณนา ไม่ใช่เชิงบังคับ**: seed จากสิ่งที่ route **ตรวจอยู่แล้ว** ตารางนี้
จึงเป็นคำอธิบายของระบบที่กำลังรันอยู่ ไม่ใช่ความมุ่งหวัง **`api/src/routes/*.js` คือแหล่งความจริง
ของชื่อเหล่านี้ การเพิ่มแถวที่นี่ไม่ได้สร้างบทบาท มันบันทึกบทบาทที่โค้ดเข้าใจอยู่แล้ว**

**`access_grants.email` มี `check (email = lower(email))` ไม่ใช่แค่ convention**: primary key
อยู่บนคอลัมน์ดิบ ดังนั้นแถวที่สคริปต์ครั้งเดียว insert เป็น `Somchai@vcb-con.com` จะ **ไม่** ชนกับ
`somchai@vcb-con.com` และคนคนนั้นจะจบลงด้วยสองแถวสำหรับหนึ่งแอป — ซึ่งรูปทรง "หนึ่งบทบาทต่อแอป"
ข้างต้นแสดงออกไม่ได้ API lowercase อยู่แล้ว CHECK นี้ทำให้ทำผิดจากที่อื่นไม่ได้

**หนึ่งบทบาทต่อคนต่อแอป** — ตรงกับรูปทรงของ JWT (`roles = { hr: 'admin' }` ไม่ใช่
`{ hr: ['admin','staff'] }`) ถ้าแอปใดต้องการหลายบทบาทพร้อมกัน นั่นคือการเปลี่ยนสคีมา **และ**
การเปลี่ยน token การทำโดยบังเอิญด้วยการ insert แถวที่สองจะให้แถวที่เรียงมาก่อนอย่างเงียบ ๆ

**`access_audit` ไม่มี foreign key กลับไปที่ `access_grants` โดยเจตนา** — มันต้องรอดจากการที่แถว
grant ถูกลบ และมันแยกจาก `hr.audit_log` เพราะตัวนั้นบันทึกการแก้ไข work entry และจำกัดขอบเขต
ที่ HR ส่วนตัวนี้บันทึกว่าใครให้ใครเข้าถึงอะไร ซึ่งเป็นคำถามที่ถูกถามหลังเกิดเหตุ

#### Trigger `access_grants_audit`

`portal.log_access_change()` (`after insert or update or delete`) มีสองรายละเอียดที่บันทึกบั๊กไว้:

1. **แตกสาขาด้วย `TG_OP` ไม่ใช่ `coalesce(new.x, old.x)`**: ใน PL/pgSQL การแตะ `NEW` ระหว่าง
   `DELETE` **raise "record new is not assigned yet" — มันไม่ได้ประเมินเป็น null** ถ้าเขียนแบบ
   coalesce **การถอนสิทธิ์ทุกครั้งจะ throw และสิทธิ์จะให้ได้แต่ถอนไม่ได้**
2. **UPDATE ที่เปลี่ยนแค่ `note` ไม่ใช่การเปลี่ยนสิทธิ์** — ถูกข้ามเพื่อให้ log ยังเป็นบันทึกของ
   ว่าใครเข้าถึงอะไรได้

actor มาจาก `nullif(current_setting('app.actor_email', true), '')` ซึ่ง `tx()` ใน `api/src/db.js`
เป็นผู้ตั้ง — **`null` จาก psql session โดยตรง ซึ่งเป็นสิ่งที่ควรเห็นใน log อยู่แล้ว**
(AFTER trigger คืนค่าถูกเพิกเฉย แต่ DELETE ต้องไม่คืน `NEW` จึงมี `if TG_OP = 'DELETE' then
return old; end if;`)

#### การ seed `portal.apps`

**`portal.apps` ส่งมาว่างเปล่าจาก `002` — มันถูกเติมตอนรันไทม์ผ่านหน้าจอ admin ของพอร์ทัล**
การ seed บทบาทให้แอปที่ยังไม่มีอยู่จะทำให้ migration นี้ล้มเหลวที่ foreign key `app_key` และ
บล็อกการ deploy ไฟล์นี้จึง **ลงทะเบียนทั้งแปดโมดูลก่อน** (ไม่ใช่แค่ตัวที่มีบทบาท — หน้าจอ admin
list ทุกแอปและแสดง "เปิดให้ทุกคน" สำหรับตัวที่ไม่มี) ด้วย `on conflict (key) do nothing` เพื่อ
ไม่ให้แถวจริงที่เพิ่มทีหลังผ่าน UI ถูกทับตอนรันซ้ำ

**`url` ถูกตั้งเป็นสตริงว่าง** — มันจำเป็นแต่ไม่รู้ค่าตอน migration หน้าจอ admin ตั้งค่าจริงต่อ
environment **สตริงว่างซื่อสัตย์กับเรื่องนี้ ในขณะที่ URL localhost ที่เดาเอาจะดูเหมือนถูกตั้งค่า
แล้วและผิดใน production**

แปดโมดูลที่ลงทะเบียน: `ememo`, `minutes`, `sop`, `sysmap`, `hr`, `credit`, `onboarding`, `portal`

บทบาทที่ seed:

| app_key | role | rank | อธิบาย |
|---|---|---|---|
| `hr` | `staff` / `manager` / `admin` | 10 / 20 / 30 | พนักงาน / ผู้จัดการ / ผู้ดูแลระบบ |
| `credit` | `viewer` / `manager` | 10 / 20 | ผู้ดูข้อมูล / ผู้จัดการ |
| `minutes` | `editor` / `admin` | 20 / 30 | ผู้แก้ไข / ผู้ดูแลระบบ |
| `sop` | `editor` | 20 | ผู้แก้ไข |
| `portal` | `admin` | 30 | ผู้ดูแลระบบ |

**`ememo`, `sysmap` และ `onboarding` ไม่มีบทบาทโดยเจตนา** — แอปที่ไม่มีแถวที่นี่จะไม่แสดงอะไรให้
กำหนดในหน้าจอ admin ซึ่งเป็นการเรนเดอร์ที่ถูกต้องของ "ทุกคนที่ล็อกอินได้ใช้มันได้"

> **Discrepancy ที่ต้องระวัง**: `008_access.sql` seed บทบาท `credit.viewer` ไว้ แต่
> `api/src/routes/credit.js` **ยังไม่บังคับใช้มัน** — คอมเมนต์ในไฟล์นั้น (บรรทัด ~30) ระบุว่า
> การเปลี่ยน `router.use(requireAuth)` เป็น `requireRole('credit','manager','viewer')` เป็น
> "การเปลี่ยนแปลงบรรทัดเดียว" ที่ยังไม่ได้ทำ ปัจจุบัน **ทุกคนที่ล็อกอินได้อ่านข้อมูล Credit
> Facility ได้ทั้งหมด** ไม่ว่าจะมีแถวใน `credit.managers` หรือไม่

> **สถานะการบังคับใช้โดยรวมของ 008**: migration นี้ **ไม่ gate อะไรเลย** ไม่มี route ไหนเริ่ม
> ปฏิเสธใครเพราะ migration นี้ การบังคับใช้ถูกทิ้งไว้ให้การเปลี่ยนแปลงแยกต่างหากในภายหลังโดย
> เจตนา เพื่อให้โครงสร้างลงจอด ถูกตรวจสอบ และถูกเติมข้อมูล **ก่อนที่มันจะมีอำนาจล็อกใครออกจาก
> พอร์ทัลของตัวเอง**

### 4.10 `009_app_names.sql` — แก้ชื่อไทยของสองแอป

migration เล็กและ idempotent (match ที่ `key`, รันซ้ำได้ผลเดิม):

- **SOP**: `'ระเบียบปฏิบัติมาตรฐาน ERP'` → `'ระเบียบปฏิบัติงานมาตรฐาน'` — SOP ไม่ได้ผูกขาดกับ ERP
  การใส่ชื่อระบบหนึ่งลงในป้ายทำให้ระเบียบปฏิบัติอื่น ๆ ดูอยู่นอกขอบเขต
- **E-Memo**: `'ระบบบันทึกข้อความอิเล็กทรอนิกส์'` → `'ระบบอีเมโม'` — ชื่อเดิมยาวพอที่จะถูกตัดใน
  แถบข้างของพอร์ทัล โดยเรนเดอร์เป็น `"ระบบบันทึกข้อความอิเล็กทรอ…"` และบอกผู้อ่านไม่มากไปกว่า
  รูปสั้น

> **Discrepancy**: `008_access.sql` seed `name_th` ของ `sop` เป็น `'มาตรฐานการใช้งานระบบ'`
> และของ `ememo` เป็น `'อีเมโม'` แต่ `009` อัปเดตทับเป็น `'ระเบียบปฏิบัติงานมาตรฐาน'` และ
> `'ระบบอีเมโม'` **ค่าจาก 009 คือค่าสุดท้ายที่ถูกต้อง** — ต้องรัน `009` หลัง `008` เสมอ

---

## 5. ตัวแปรสภาพแวดล้อม (Environment Variables)

เทมเพลตอยู่ที่ `api/.env.example` (ไฟล์ `.env` จริงอยู่ใน gitignore และ **ต้องไม่ถูก commit**)

**API เป็นผู้ถือ credential ของฐานข้อมูลเพียงผู้เดียว** เบราว์เซอร์คุยกับ API และไม่คุยกับอย่างอื่น
ค่าเหล่านี้จึงไม่มีตัวไหนไปถึง client bundle

### 5.1 ตัวแปรที่ต้องมีเพื่อบูต (บังคับ)

| ตัวแปร | ถ้าไม่มีจะเกิดอะไร |
|---|---|
| `DATABASE_URL` | **`db.js` throw ตอน import → process ตาย** ข้อความ error ระบุให้ใช้ **connection string ของ pooler พอร์ต 6543** ไม่ใช่การเชื่อมต่อตรงพอร์ต 5432 (Render ต่อออก IPv4 เท่านั้น, host ตรงของ Supabase เป็น IPv6 เท่านั้น → `ENETUNREACH`) |
| `JWT_SECRET` | **`auth.js` throw ตอน import → process ตาย** ต้องยาว ≥32 ตัวอักษร ข้อความ error ให้คำสั่งสร้าง: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| ฟอนต์ `Sarabun-Regular.ttf` + `Sarabun-Bold.ttf` ใน `api/assets/fonts/` | **`assertFontsPresent()` throw → `process.exit(1)`** เว้นแต่ตั้ง `PDF_FONTS_OPTIONAL=1` (ซึ่งจะ warn แล้วบูตต่อ แต่ route ที่สร้าง PDF จะพัง) |

> **สถานะปัจจุบันใน repo**: ไม่มีไฟล์ `.ttf` — ดูข้อสังเกตในหัวข้อ 2.1

### 5.2 ตัวแปรที่จำเป็นตามฟีเจอร์

| ตัวแปร | ค่าเริ่มต้น | ถ้าไม่มีจะเกิดอะไร |
|---|---|---|
| `JWT_TTL` | `'12h'` | เซสชันอายุ 12 ชั่วโมง **บทบาทและขอบเขต site ถูกอบใน token ตอนเข้าสู่ระบบ การเปลี่ยนบทบาทจึงไม่มีผลจนกว่า token จะหมดอายุ** |
| `GOOGLE_CLIENT_ID` | — | `googleClient` เป็น `null` → `POST /api/auth/google` throw `'GOOGLE_CLIENT_ID is not configured'` **Google Sign-In ปิดตัวเอง แต่ login ด้วยรหัสผ่านยังทำงาน** (ใส่เฉพาะ client ID เท่านั้น — มันสาธารณะโดยการออกแบบ **client SECRET ไม่ถูกใช้โดย API นี้**) |
| `CORS_ORIGINS` | `''` (ว่าง) | allowlist ว่าง → **ทุกคำขอที่มี header `Origin` ถูกปฏิเสธ** = SPA ทุกตัวเรียก API ไม่ได้ (แต่ `curl` และ health check ยังผ่าน เพราะไม่มี Origin) ต้องระบุ Vercel URL ของทุก SPA บวก localhost ตอน dev **ไม่มี wildcard ไม่มี trailing slash** |
| `SUPABASE_S3_ENDPOINT` | — | S3Client ไม่มี endpoint → การ presign ทั้งหมดพัง (ไฟล์แนบใช้ไม่ได้) |
| `SUPABASE_S3_REGION` | `'ap-southeast-1'` | — |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY` | `''` | ลายเซ็นไม่ถูกต้อง → Supabase Storage ปฏิเสธ |
| `BREVO_API_KEY` | — | `sendEmail()` `console.warn` แล้วคืน `{ ok: false, error: 'NOT_CONFIGURED' }` **ไม่ throw — การกระทำที่พ่วงอีเมลอยู่ยังสำเร็จ อีเมลแค่ไม่ถูกส่ง** |
| `BREVO_SENDER_NAME` | `'VCB Connect'` | — |
| `BREVO_SENDER_EMAIL` | `''` | Brevo อาจปฏิเสธการส่ง (`BREVO_<status>`) |
| `PORT` | `3000` | Render ตั้งเอง — ค่านี้มีไว้สำหรับรันในเครื่อง (`.env.example` แนะนำ `8080`) |
| `PDF_FONTS_OPTIONAL` | — | ตั้งเป็น `'1'` เพื่อข้ามการตรวจฟอนต์ **ใช้เฉพาะ deployment ที่ไม่ออก PDF จริง ๆ** |

### 5.3 ตัวแปรฝั่งหน้าบ้าน (Vite)

| ตัวแปร | ใช้ที่ไหน | ถ้าไม่มีจะเกิดอะไร |
|---|---|---|
| `VITE_API_URL` | `shared/src/api.js` → `resolveBaseUrl()` | base URL เป็น `''` → ทุกคำขอไปที่ origin ของตัวเอง (ทำงานได้ก็ต่อเมื่อมี proxy หรืออยู่โดเมนเดียวกัน) |
| `VITE_PORTAL_URL` | `shared/src/AppBar.jsx` | ค่าเริ่มต้น `'/'` — ถูกต้องเมื่อทุกอย่างเสิร์ฟจากโดเมนเดียว (ดู `docs/ONE_DOMAIN.md`) |

---

## 6. สรุปข้อค้นพบ — จุดที่โค้ดกับเอกสาร/เอกสารกับเอกสารไม่ตรงกัน

รวบรวมข้อขัดแย้งทั้งหมดที่พบระหว่างการอ่านโค้ด เพื่อให้ทีมติดตั้งเห็นในที่เดียว:

| # | ที่ | สิ่งที่พบ | ผลกระทบ |
|---|---|---|---|
| 1 | `api/assets/fonts/` | มีแต่ `README.md` **ไม่มีไฟล์ `.ttf`** ทั้งที่ `index.js` `process.exit(1)` เมื่อไม่มี | **API บูตไม่ขึ้นจาก repo สด** — ต้องดาวน์โหลด Sarabun ก่อน deploy ครั้งแรก |
| 2 | `api/package.json` vs. โครงสร้างไฟล์ | ประกาศ `"migrate": "node scripts/migrate.js"` แต่ **ไม่มีไดเรกทอรี `api/scripts/`** | `npm run migrate` พังทันที ต้องรัน SQL 9 ไฟล์ด้วยมือตามลำดับ |
| 3 | `api/src/auth.js` JSDoc ของ `resolveRoles()` | ระบุ `hr: 'admin' \| 'manager' \| 'user' \| null` | **คอมเมนต์ผิด** — CHECK constraint จริงใน `004_hr.sql` คือ `('admin','manager','staff')` และ `008_access.sql` ก็ seed `staff` |
| 4 | `api/src/middleware/auth.js` | `allowAnonymous` สร้าง `req.user` **โดยไม่มี `hrSites`** ต่างจาก `requireAuth` | ยังไม่มี route ไหนต่อ `allowAnonymous` เข้ากับ `requireHrSite()` แต่ถ้าทำ ผู้ที่ไม่ใช่ admin จะได้ 403 `SITE_SCOPE_UNKNOWN` เสมอ |
| 5 | `008_access.sql` vs. `api/src/routes/credit.js` | seed บทบาท `credit.viewer` ไว้ แต่ route ใช้แค่ `router.use(requireAuth)` | **ทุกคนที่ล็อกอินได้อ่านข้อมูล Credit Facility ทั้งหมด** ไม่ว่าจะอยู่ใน `credit.managers` หรือไม่ (คอมเมนต์ในไฟล์รับทราบเรื่องนี้เป็น "การเปลี่ยนบรรทัดเดียว" ที่ยังไม่ทำ) |
| 6 | `008_access.sql` vs. `009_app_names.sql` | `name_th` ของ `sop`/`ememo` ต่างกันระหว่างสอง migration | **ต้องรัน 009 หลัง 008 เสมอ** ค่าจาก 009 คือค่าที่ถูกต้อง |
| 7 | `shared/src/access.js` (ทั้งไฟล์) | หน้าจอบริหารสิทธิ์เขียนลง `portal.access_grants` แต่ **`resolveRoles()` ยังอ่านตารางรายโมดูล** | **สิทธิ์ที่ให้ผ่านหน้าจอนี้ไม่มีผลต่อสิ่งที่ใครเปิดได้จริง** — เป็นสถานะที่ตั้งใจ ไม่ใช่บั๊ก แต่ต้องรู้ |
| 8 | `shared/src/auth.jsx`, `i18n.jsx`, `theme.jsx` | คอมเมนต์พูดว่า "seven SPAs" | `008_access.sql` ลงทะเบียน **แปด** แอป (`ememo`, `minutes`, `sop`, `sysmap`, `hr`, `credit`, `onboarding`, `portal`) — E-Memo เป็นแอป TypeScript แยกที่อยู่นอก `@vcb/shared` จำนวนที่ใช้ `@vcb/shared` จริงจึงเป็น 7 **คอมเมนต์ถูกในบริบทของมัน แต่อ่านสับสนได้** |

---

## 7. รายการอ้างอิงไฟล์ (สำหรับการนำทางโค้ด)

### หลังบ้าน — `FOR DEPLOYMENT TEAM/api/`

| ไฟล์ | สิ่งที่มี |
|---|---|
| `src/index.js` | bootstrap, ลำดับ middleware, CORS allowlist, การ mount router, `assertFontsPresent()` |
| `src/auth.js` | `hashPassword` `verifyPassword` `issueToken` `verifyToken` `verifyGoogleIdToken` `resolveRoles` `hrSitesFor` `randomToken` + assertion ของ `JWT_SECRET` |
| `src/db.js` | `query` `rows` `one` `tx` `close` + assertion ของ `DATABASE_URL` + pool config |
| `src/middleware/auth.js` | `requireAuth` `allowAnonymous` `requireRole` `requireHrSite` `requireAnyRole` |
| `src/middleware/error.js` | `asyncRoute` `notFound` `errorHandler` |
| `src/lib/storage.js` | `presignUpload` `presignDownload` `deleteObject` `statObject` `safeKey` |
| `src/lib/pdf.js` | `assertFontsPresent` `createDocument` `toBuffer` `mergePdfs` `drawTable` |
| `src/lib/excel.js` | `beToGregorian` `gregorianToBe` `parseMonthTab` `toWorkbook` `fromWorkbook` |
| `src/lib/email.js` | `sendEmail` `wrapHtml` `escapeHtml` |
| `src/routes/auth.js` | `POST /google` `POST /login` `GET /me` + `sessionFor()` |
| `src/routes/{hr,credit,minutes,sop,onboarding,portal}.js` | route ของแต่ละโมดูล — ดูเอกสารของโมดูลนั้น |
| `.env.example` | เทมเพลตตัวแปรสภาพแวดล้อมพร้อมคำอธิบายเหตุผล |
| `assets/fonts/README.md` | วิธีติดตั้งฟอนต์ Sarabun และเหตุผลที่ API ปฏิเสธการเริ่มโดยไม่มีมัน |

### หน้าบ้าน — `FOR DEPLOYMENT TEAM/shared/`

| ไฟล์ | สิ่งที่มี |
|---|---|
| `src/index.js` | barrel export ทั้งหมด + **ลำดับ provider ที่ถูกต้อง** |
| `src/api.js` | `createApi` `api` `ApiError` `TOKEN_KEY` `readStoredToken` `writeStoredToken` `clearStoredToken` |
| `src/auth.jsx` | `AuthProvider` `useAuth` `useAuthOptional` `RequireRole` |
| `src/i18n.jsx` | `I18nProvider` `useI18n` `useT` `createDictionary` `mergeDictionaries` `commonDictionary` `translate` + `LANGS` `LANG_KEY` `MONTHS` `WEEKDAYS` |
| `src/theme.jsx` | `ThemeProvider` `useTheme` `applyStoredThemeEarly` `resolveTheme` `THEMES` `THEME_KEY` `DEFAULT_THEME` |
| `src/access.js` | `getAccessRoles` `getAccessGrants` `getPersonAccess` `setAccessGrant` `getAccessAudit` |
| `src/AppBar.jsx` | `AppBar` (default) + `AppSettings` |
| `tailwind.preset.js` | preset ของ Tailwind ที่ทุกโมดูลใช้ร่วม |

### ฐานข้อมูล — `FOR DEPLOYMENT TEAM/supabase/migrations/`

| ไฟล์ | schema/ตารางที่สร้าง |
|---|---|
| `001_schemas.sql` | 6 schema + `hr.actor_email()` `hr.actor_role()` |
| `002_portal.sql` | `portal.portal_admins` `portal.apps` `portal.announcement` + trigger `announcement_bump` |
| `003_credit.sql` | `credit.*` 10 ตาราง + view `credit.facility_used` + seed projects/facility types |
| `004_hr.sql` | `hr.*` 12 ตาราง + view `hr.mandays` + trigger กรอบเวลา/site/audit |
| `005_minutes.sql` | `minutes.*` 7 ตาราง + seed inbox 2 โครงการ |
| `006_sop.sql` | `sop.sop_editors` `sop.sop_document` `sop.sop_versions` + trigger `sop_snapshot` |
| `007_onboarding.sql` | `onboarding.*` 3 ตาราง + storage bucket + **การ drop ประตูหลัง** |
| `008_access.sql` | `portal.app_roles` `portal.access_grants` `portal.access_audit` + trigger audit + seed 8 แอป/9 บทบาท |
| `009_app_names.sql` | แก้ `name_th` ของ `sop` และ `ememo` |

### เอกสารที่เกี่ยวข้อง

| ไฟล์ | เนื้อหา |
|---|---|
| `docs/ACCESS_MODEL.md` | แบบจำลองสิทธิ์ |
| `docs/ONE_DOMAIN.md` | แผนการรวมทุกโมดูลไว้บนโดเมนเดียว |
| `docs/CHROME.md` | chrome/AppBar ที่ใช้ร่วมกัน |
| `docs/functional-spec/*.md` | เอกสารข้อกำหนดฟังก์ชันรายโมดูล (8 ฉบับ) |
