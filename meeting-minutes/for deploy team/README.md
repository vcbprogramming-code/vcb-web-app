# for deploy team — สคริปต์ที่พร้อม Deploy (Meeting Minutes)

โฟลเดอร์นี้คือ **โค้ดที่รันจริงบน Google Apps Script** ของแอป VCB Meeting Minutes
(`รายงานการประชุมภายใน`) — เป็นสิ่งเดียวที่ถูกส่งขึ้น Apps Script ด้วย `clasp push`

> คู่ของโฟลเดอร์นี้คือ [`../original script/`](../original%20script/) ซึ่งเก็บ
> **โค้ดต้นฉบับ JavaScript/TypeScript (React)** ที่ใช้อ้างอิงและส่งต่อให้นักพัฒนา
> ดูความแตกต่างได้ที่ท้ายไฟล์นี้

---

## ไฟล์ในโฟลเดอร์นี้ (8 ไฟล์ที่ push จริง)

| ไฟล์ | ขนาด | คืออะไร |
|---|---|---|
| `Code.js` | ~162 KB | ฝั่ง server — ฐานข้อมูล Sheet, render, แก้ไข, audit log/version history, รับข้อมูล Fathom/Transkriptor, จัดการไฟล์แนบ |
| `Auth.js` | ~43 KB | ล็อกอิน (Google Sign-In + PIN 4 หลัก), session token, สิทธิ์ admin/editor และสิทธิ์รายโครงการ |
| `Config.js` | ~11 KB | รายชื่อโครงการ, อีเมล admin, โครงสร้างคอลัมน์ของ Sheet |
| `Index.html` | ~25 KB | โครงหน้าเว็บ + template `<?!= include(...) ?>` |
| `JavaScript.html` | ~214 KB | โค้ดฝั่ง client ทั้งหมด |
| `Stylesheet.html` | ~76 KB | CSS ของแอป (ไม่ใช่ CSS ของเอกสารที่ render — อันนั้นคือ `OVERRIDE_CSS` ใน `JavaScript.html`) |
| `QrCode.html` | ~49 KB | ตัวสร้าง QR สำหรับประทับบน PDF (กันการปลอมแปลง) |
| `appsscript.json` | 809 B | Manifest — timezone, oauthScopes, การตั้งค่า webapp |
| `.claspignore` | — | **allowlist** — กำหนดให้ `clasp push` ส่งขึ้นเฉพาะ 8 ไฟล์ข้างบนเท่านั้น |

`.claspignore` เป็นแบบ allowlist โดยตั้งใจ (`**/**` แล้วค่อย `!` เฉพาะไฟล์ที่ต้องการ)
เพื่อกันไม่ให้โฟลเดอร์แอปอื่นใน monorepo หลุดขึ้นไปโดยไม่ตั้งใจ

⚠️ **`appsscript.json` สำคัญเป็นพิเศษ** — กำหนดว่าใครเปิดแอปได้
(`ANYONE_ANONYMOUS` + `USER_DEPLOYING`) แก้ผิดคือทั้งระบบเข้าไม่ได้

---

## วิธี Deploy

```
clasp push
clasp deploy -i AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr -d "รายละเอียดการแก้ไข"
```

**ต้องใส่ `-i` พร้อม deployment ID นี้เสมอ** เพราะเป็นสิ่งที่ทำให้ URL `/exec`
คงเดิมไม่เปลี่ยน หากรัน `clasp deploy` เฉย ๆ โดยไม่มี `-i` จะได้ deployment ใหม่
(URL ใหม่) ซึ่งผู้ใช้ไม่ได้เปิด — ดูเหมือน deploy ไม่ติดทั้งที่ขึ้นไปแล้ว

| | |
|---|---|
| **Script ID** | `1Ozxm34TQ4tIdwyr4dPPImwIeuGJpj9B53Zb0hl30MnR8tdeawb7KE6vf` |
| **Deployment ID** | `AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr` |
| **เวอร์ชันล่าสุด** | `@220` |
| **URL ใช้งานจริง** | https://script.google.com/macros/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec |
| **ฐานข้อมูล** | Google Sheet ส่วนตัว (สคริปต์เข้าถึงแทนเจ้าของ) |

ถ้า `clasp push` แจ้ง `invalid_grant` / `reauth related error` แปลว่า token หมดอายุ
ให้รัน `clasp login` ใหม่ก่อน

`.clasp.json` ไม่ได้ commit ไว้ (ผูกกับเครื่องที่ล็อกอินแล้ว) ถ้ายังไม่มี ให้สร้าง
ที่โฟลเดอร์แม่ ชี้ `rootDir` มาที่โฟลเดอร์นี้:

```json
{ "scriptId": "1Ozxm34TQ4tIdwyr4dPPImwIeuGJpj9B53Zb0hl30MnR8tdeawb7KE6vf", "rootDir": "for deploy team" }
```

### ตรวจหลัง deploy

1. เปิด URL ข้างบน — ต้องเห็นรายการประชุมตามปกติ
2. เปิดการประชุมสัก 1 รายการ — เอกสาร A4 ต้องเต็มหน้า ไม่โดนตัดขอบซ้าย
3. ย่อหน้าต่างให้แคบหรือลองบนแท็บเล็ต — เอกสารต้อง**ย่อลงพอดี** ไม่ใช่ถูกตัด
4. ถ้าเป็น admin — เข้า **ตั้งค่า → 🔐 Project access** ต้องเปิดได้

### ถ้ามีปัญหา ให้ย้อนกลับ

Apps Script เก็บทุกเวอร์ชันไว้ ย้อนได้ทันทีโดยไม่ต้อง build ใหม่:
**Deploy → Manage deployments** → เลือก deployment เดิม → ✏️ → เลือก **Version**
เป็นเวอร์ชันก่อนหน้า (เช่น `@219`) → **Deploy**

---

## ⚠️ ก่อนแก้ไข — จุดที่พลาดกันบ่อย

**1. ก่อนแตะเรื่องการแสดงผล / พิมพ์ / ตัวแก้ไขเอกสาร → อ่าน [`PAGINATION.md`](PAGINATION.md) ก่อน**

การแบ่งหน้าบนจอ ใน PDF และในตัวแก้ไข **ต้องตรงกันเป๊ะ** ซึ่งกว่าจะได้แบบนี้
ลองผิดมาหลายรอบ — ในไฟล์นั้นบันทึกไว้ว่าออกแบบอย่างไร กฎอะไรห้ามผิด และวิธีไหน
ที่ลองแล้วไม่ได้ผล (จะได้ไม่ลองซ้ำ)

**2. โครงหน้าจอมีกับดัก 2 จุด**

- มือถือกับแท็บเล็ต **เข้าเงื่อนไข `@media (max-width: 900px)` เหมือนกัน** แต่มือถือ
  สลับหน้าจอด้วย `.mobile-pane-*` และไม่เคย override `position`/`transform`
  ถ้าเขียน rule ในบล็อกนั้นโดยไม่ใส่ `html:not(.is-mobile)` รายการประชุมบนมือถือ
  จะเลื่อนหายออกนอกจอโดยไม่มีทางเรียกกลับ
- แท็บเล็ตต้องใช้เส้นทาง render แบบ **desktop** (มี Paged.js) ไม่ใช่เส้นทางมือถือ
  เพราะเส้นทางมือถือข้าม Paged.js และอาศัย CSS `html.is-mobile` ในการทำให้ iframe
  มองเห็นได้ — ส่งแท็บเล็ตไปทางนั้นแล้วหน้าจอจะ**ว่างเปล่า**

ทั้งสองข้อมีสคริปต์ตรวจอัตโนมัติอยู่ที่ `tools/layout-checks/` ในโฟลเดอร์ต้นทาง
(ไม่ได้ mirror มาที่นี่)

**3. อย่าแก้ Google Sheet ตรง ๆ ถ้าไม่จำเป็น**

แอปเขียน audit log ทุกครั้งที่มีการแก้ไข การแก้ใน Sheet โดยตรงจะไม่ถูกบันทึก
และจะไม่มีประวัติย้อนกลับ

**4. โควตาเวอร์ชันมี 200 และลบไม่ได้**

ถ้าจะทดสอบบ่อย ๆ ให้ใช้ `clasp push` อย่างเดียว (ไม่ต้อง `clasp deploy`)
แล้วดูผลผ่าน URL `/dev` ซึ่งไม่กินโควตา

---

## ต่างจาก `original script/` อย่างไร

|  | `for deploy team/` (โฟลเดอร์นี้) | `original script/` |
|---|---|---|
| ภาษา | Google Apps Script (`.js` + `.html`) | TypeScript + React |
| หน้าที่ | **โค้ดที่รันจริง** — ผู้ใช้เปิดใช้งานตัวนี้ | ตัวอ้างอิง/preview สำหรับนักพัฒนา |
| ข้อมูล | Google Sheets จริง | mock data (ไม่มี backend) |
| Deploy ไปที่ | Google Apps Script | Vercel (ถ้าต้องการ) |
| แหล่งความจริง | ✅ **ตัวนี้คือต้นทาง** | ตามหลัง — sync จากโฟลเดอร์นี้ |

**ทิศทางสำคัญ:** โค้ดในโฟลเดอร์นี้คือแหล่งความจริง แก้ที่นี่ก่อนเสมอ
แล้วค่อย sync ไปที่ React mirror — ไม่ใช่ทางกลับกัน

---

## สิทธิ์การเข้าถึง

**การอ่าน** ไม่ต้องล็อกอิน แต่เห็นได้แค่ไหนขึ้นกับโครงการ:

- **🔓 Public** — ใครก็ตามที่เปิดลิงก์อ่านได้ ไม่ต้องล็อกอิน ไม่จำกัดโดเมนอีเมล
- **🔒 Locked** — อ่านได้เฉพาะ admin, editor และ **อีเมลที่ระบุไว้เฉพาะเจาะจง**
  โครงการที่ล็อกไว้ **ไม่ได้**เปิดให้พนักงาน `@vcb-con.com` ทุกคน

**การแก้ไข** ต้องล็อกอินเสมอ — Google Sign-In หรืออีเมล + PIN 4 หลัก

จัดการที่ **ตั้งค่า → 🔐 Project access** (เฉพาะ admin)
