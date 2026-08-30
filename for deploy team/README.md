# for deploy team — สคริปต์ที่พร้อม Deploy (HR Work Log)

โฟลเดอร์นี้คือ **โค้ดที่รันจริงบน Google Apps Script** ของแอป HR Daily Work Log
(`บันทึกการทำงานรายวัน`) — เป็นสิ่งเดียวที่ถูกส่งขึ้น Apps Script ด้วย `clasp push`

> คู่ของโฟลเดอร์นี้คือ [`../original script/`](../original%20script/) ซึ่งเก็บ
> **โค้ดต้นฉบับ JavaScript/TypeScript (React)** ที่ใช้อ้างอิงและส่งต่อให้นักพัฒนา
> ดูความแตกต่างได้ที่ท้ายไฟล์นี้

---

## ไฟล์ในโฟลเดอร์นี้ (มีแค่ 3 ไฟล์ที่ push จริง)

| ไฟล์ | ขนาด | คืออะไร |
|---|---|---|
| `Code.gs` | ~604 KB | **ทั้งแอปอยู่ในไฟล์นี้ไฟล์เดียว** — ทั้งฝั่ง server (`api_*`, `SETUP()`, ตัวช่วยจัดการ Sheet) และฝั่ง client ทั้งหมด (HTML + CSS + JavaScript) ที่ฝังอยู่ใน template literal ชื่อ `PAGE_HTML_` |
| `History.gs` | ~873 KB | ข้อมูลย้อนหลังแบบ static (JSON ฝังในไฟล์) สำหรับ import ครั้งเดียว |
| `appsscript.json` | 509 B | Manifest — timezone, oauthScopes, และการตั้งค่า webapp |
| `.claspignore` | — | **allowlist** — กำหนดให้ `clasp push` ส่งขึ้นเฉพาะ 3 ไฟล์ข้างบนเท่านั้น |

`.claspignore` เป็นแบบ allowlist โดยตั้งใจ (`**/**` แล้วค่อย `!` เฉพาะไฟล์ที่ต้องการ)
เพื่อกันไม่ให้โฟลเดอร์แอปอื่นใน monorepo หลุดขึ้นไปโดยไม่ตั้งใจ

---

## วิธี Deploy

รันจาก **โฟลเดอร์แม่** (`HR Work Log Web App/`) ไม่ใช่จากในโฟลเดอร์นี้ —
`.clasp.json` อยู่ที่โฟลเดอร์แม่ และชี้ `rootDir` มาที่ `for deploy team/`

```
clasp push
clasp deploy -i AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA -d "รายละเอียดการแก้ไข"
```

**ต้องใส่ `-i` พร้อม deployment ID นี้เสมอ** เพราะเป็นสิ่งที่ทำให้ URL `/exec`
คงเดิมไม่เปลี่ยน หากรัน `clasp deploy` เฉย ๆ โดยไม่มี `-i` จะได้ deployment ใหม่
(URL ใหม่) ซึ่งไม่ใช่สิ่งที่ต้องการ

| | |
|---|---|
| **Script ID** | `13GL834YDPhar_j-IZTT_f4mDYPUDMJELPIh2XzWHJr4VfZIybZ0gxVzu` |
| **Deployment ID** | `AKfycbzEg5Sn0tNnciRkWmwnsEM9cmq0NVmy6weblTLPqlAOccsDKkh9m6dmLMRVBpqspBblUA` |
| **เวอร์ชันล่าสุด** | `@54` |

ถ้า `clasp push` แจ้ง `invalid_grant` / `reauth related error` แปลว่า token หมดอายุ
ให้รัน `clasp login` ใหม่ก่อน

---

## ⚠️ ก่อนแก้ `Code.gs` — จุดที่พลาดกันบ่อย

**1. `node --check Code.gs` เพียงอย่างเดียวเชื่อไม่ได้**

โค้ดฝั่ง client ทั้งหมดอยู่ใน template literal (`PAGE_HTML_`) ดังนั้น `node --check`
จะตรวจแค่ไฟล์ชั้นนอก **โดยไม่เคย parse โค้ด client เลย** ไฟล์อาจผ่าน check
แต่แอปพังทั้งตัวได้ ต้องตรวจ 3 ชั้น:

```
# 1. ชั้นนอก
node --check Code.gs

# 2. ดึง PAGE_HTML_ ออกมา แล้วตรวจ <script> ข้างใน
# 3. นับวงเล็บปีกกาใน <style> ให้เท่ากัน
```

**2. Regex และ `\n` ใน client ต้อง escape สองชั้น**

เพราะอยู่ใน template literal — เขียน `\n` ตรง ๆ จะกลายเป็นขึ้นบรรทัดใหม่จริง
ไม่ใช่ตัวอักษร ทำให้แอปพังทั้งไฟล์

**3. ห้ามใส่งานหนักในเส้นทาง boot**

`doGet` และ `api_bootstrap` ต้องเบาที่สุด ห้ามมี seeding / เขียน Sheet /
migration ใด ๆ เพราะจะทำให้ผู้ใช้ค้างที่หน้า "กำลังโหลด…" หรือขึ้น
"หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ (api_bootstrap)" — เคยเกิดขึ้นจริงมาแล้ว 2 ครั้ง

งานที่ต้องรันครั้งเดียว ให้ทำเป็นฟังก์ชันที่ **ไม่มี `api_*` wrapper**
แล้วรันจาก Apps Script editor แทน เช่น `PURGE_INDEX()` และ `REGEN_DEMO_MONTH()`

---

## ต่างจาก `original script/` อย่างไร

|  | `for deploy team/` (โฟลเดอร์นี้) | `original script/` |
|---|---|---|
| ภาษา | Google Apps Script (`.gs`) | TypeScript + React |
| หน้าที่ | **โค้ดที่รันจริง** — ผู้ใช้เปิดใช้งานตัวนี้ | ตัวอ้างอิง/preview สำหรับนักพัฒนา |
| ข้อมูล | Google Sheets จริง | mock data (ไม่มี backend) |
| Deploy ไปที่ | Google Apps Script | Vercel (ถ้าต้องการ) |
| แหล่งความจริง | ✅ **ตัวนี้คือต้นทาง** | ตามหลัง — sync จาก `Code.gs` |

**ทิศทางสำคัญ:** `Code.gs` คือแหล่งความจริง แก้ที่นี่ก่อนเสมอ แล้วค่อย sync
ไปที่ React mirror — ไม่ใช่ทางกลับกัน

---

เอกสารสถาปัตยกรรมและบันทึกการเปลี่ยนแปลงทั้งหมด: [`../HR-WORK-LOG.md`](../HR-WORK-LOG.md)
