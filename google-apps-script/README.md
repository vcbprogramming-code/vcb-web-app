# google-apps-script — ระบบที่ใช้งานจริง (Production)

โค้ดในโฟลเดอร์นี้คือ **ระบบที่พนักงานใช้งานจริง** ของแอป HR Daily Work Log
(`บันทึกการทำงานรายวัน`) — เป็นสิ่งเดียวที่ `clasp push` ส่งขึ้น Google Apps Script

> คู่ของโฟลเดอร์นี้คือ [`../react-app/`](../react-app/) ซึ่งเป็น **ตัวอย่าง UI
> ด้วย React/TypeScript** ไว้อ้างอิงและส่งต่อให้นักพัฒนา — ไม่ใช่ระบบจริง

---

## ⚠️ frontend/backend อยู่ในไฟล์เดียวกัน — จุดที่เข้าใจผิดกันบ่อย

ปกติเราคาดว่าโปรเจกต์จะมีโฟลเดอร์ `frontend/` กับ `backend/` แยกกัน
**แต่ Google Apps Script ไม่ได้ทำงานแบบนั้น** — ทั้งสองส่วนอยู่ใน `Code.gs`
ไฟล์เดียว:

```
Code.gs  (~604 KB)
├── BACKEND   ฟังก์ชัน api_* , SETUP() , ตัวช่วยจัดการ Google Sheets
│             → รันบนเซิร์ฟเวอร์ของ Google
└── FRONTEND  ตัวแปร PAGE_HTML_ = `...`  (template literal ก้อนเดียว ~310,000 ตัวอักษร)
              → ข้างในมี HTML + CSS + JavaScript ของหน้าเว็บทั้งหมด
              → รันบนเบราว์เซอร์ของผู้ใช้
              → คุยกับ backend ผ่าน google.script.run
```

ดังนั้น **การไม่มีโฟลเดอร์ `frontend/` `backend/` ที่นี่ไม่ใช่ความผิดพลาด**
แต่เป็นข้อจำกัดของแพลตฟอร์ม Apps Script ที่บังคับให้เป็นแบบนี้

---

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ขนาด | คืออะไร |
|---|---|---|
| `Code.gs` | ~604 KB | **ทั้งแอป** — backend + frontend (ดูแผนภาพด้านบน) |
| `History.gs` | ~873 KB | ข้อมูลย้อนหลังแบบ static (JSON ฝังในไฟล์) สำหรับ import ครั้งเดียว |
| `appsscript.json` | 509 B | Manifest — timezone, oauthScopes, การตั้งค่า webapp |
| `.claspignore` | — | **allowlist** — บังคับให้ push เฉพาะ 3 ไฟล์ข้างบน |

`.claspignore` เป็น allowlist โดยตั้งใจ (`**/**` แล้วค่อย `!` เฉพาะที่ต้องการ)
เพื่อกันไม่ให้โฟลเดอร์แอปอื่นใน repo หลุดขึ้นไปโดยไม่ตั้งใจ

---

## วิธี Deploy

รันจาก **โฟลเดอร์แม่** (`HR Work Log Web App/`) ไม่ใช่จากในโฟลเดอร์นี้ —
`.clasp.json` อยู่ที่โฟลเดอร์แม่ และตั้ง `rootDir` ชี้มาที่ `google-apps-script/`

```
clasp push
clasp deploy -i AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA -d "รายละเอียดการแก้ไข"
```

**ต้องใส่ `-i` พร้อม deployment ID นี้เสมอ** เพราะเป็นสิ่งที่ทำให้ URL `/exec`
คงเดิม หากรัน `clasp deploy` เฉย ๆ จะได้ deployment ใหม่ (URL ใหม่)

| | |
|---|---|
| **Script ID** | `13GL834YDPhar_j-IZTT_f4mDYPUDMJELPIh2XzWHJr4VfZIybZ0gxVzu` |
| **Deployment ID** | `AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA` |
| **เวอร์ชันล่าสุด** | `@54` |

ถ้าขึ้น `invalid_grant` / `reauth related error` แปลว่า token หมดอายุ →
รัน `clasp login` ใหม่

---

## ⚠️ ก่อนแก้ `Code.gs` — 3 กับดักที่เคยทำแอปพังจริง

**1. `node --check Code.gs` เพียงอย่างเดียวเชื่อไม่ได้**

โค้ด frontend อยู่ใน template literal ดังนั้น `node --check` จะตรวจแค่ชั้นนอก
**โดยไม่เคย parse โค้ด frontend เลย** ไฟล์อาจผ่าน check แต่แอปพังทั้งตัว
ต้องตรวจครบ 3 ชั้น:

```
node --check Code.gs           # 1. ชั้นนอก
# 2. ดึง PAGE_HTML_ ออกมา แล้ว node --check เฉพาะ <script> ข้างใน
# 3. นับ { } ใน <style> ให้เท่ากัน
```

**2. Regex และ `\n` ในโค้ด frontend ต้อง escape สองชั้น**

เพราะอยู่ใน template literal — เขียน `\n` ตรง ๆ จะกลายเป็นการขึ้นบรรทัดจริง
ไม่ใช่ตัวอักษร ทำให้ไฟล์พังทั้งไฟล์

**3. ห้ามใส่งานหนักในเส้นทาง boot**

`doGet` และ `api_bootstrap` ต้องเบาที่สุด ห้ามมี seeding / เขียน Sheet /
migration เพราะผู้ใช้จะค้างที่ "กำลังโหลด…" หรือขึ้น
"หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ (api_bootstrap)" — **เคยเกิดขึ้นจริง 2 ครั้ง**

ที่สำคัญ: อะไรก็ตามที่เรียกผ่าน `call()` ถ้า timeout จะทำให้ทั้งแอปพัง
ไม่ว่าจะเรียกตอนไหนก็ตาม งานที่รันครั้งเดียวให้ทำเป็นฟังก์ชัน
**ที่ไม่มี `api_*` wrapper** แล้วรันจาก Apps Script editor เช่น
`PURGE_INDEX()` และ `REGEN_DEMO_MONTH()`

---

## เทียบกับ `../react-app/`

|  | `google-apps-script/` (นี่) | `../react-app/` |
|---|---|---|
| สถานะ | ✅ **ระบบจริงที่ใช้งานอยู่** | ตัวอย่าง UI |
| ภาษา | Google Apps Script (`.gs`) | TypeScript + React |
| ข้อมูล | Google Sheets จริง | mock data (หายเมื่อ refresh) |
| Backend | มี (ฟังก์ชัน `api_*` ใน `Code.gs`) | ไม่มี |
| Deploy | Google Apps Script | Vercel (ถ้าต้องการ) |
| แหล่งความจริง | ✅ **ตัวนี้คือต้นทาง** | ตามหลัง — sync มาจาก `Code.gs` |

**ทิศทาง:** แก้ที่ `Code.gs` ก่อนเสมอ แล้วค่อย sync ไป `react-app/`
ไม่ใช่ทางกลับกัน

---

เอกสารสถาปัตยกรรมและบันทึกการเปลี่ยนแปลง: [`../HR-WORK-LOG.md`](../HR-WORK-LOG.md)
