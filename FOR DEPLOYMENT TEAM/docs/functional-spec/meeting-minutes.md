# Meeting Minutes — เอกสารข้อกำหนดฟังก์ชัน (Functional Specification)

> เอกสารนี้อธิบายการทำงานของโมดูล **Meeting Minutes** (บันทึกการประชุม) ตามที่ implement จริงใน React/Express ที่
> `FOR DEPLOYMENT TEAM/meeting-minutes/` (frontend) และ `FOR DEPLOYMENT TEAM/api/src/routes/minutes.js` (backend)
> โมดูลนี้เป็นส่วนหนึ่งของระบบ VCB Connect ซึ่งกำลังพอร์ตจาก Google Apps Script ("ORIGINAL CODE/") มาเป็น React + Express
> เอกสารอ้างอิงจาก source code จริง ไม่ใช่จากสเปกเดิมของ Apps Script — จุดที่การพอร์ตไม่ตรง 1:1 จะอ้างอิง `PORT_NOTES.md`
> และ `PAGINATION.md` กำกับไว้ทุกจุด

---

## 1. ภาพรวมของโมดูล

Meeting Minutes คือระบบเก็บ **บันทึกการประชุม** ของบริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด แบ่งบันทึกออกเป็น "โครงการ"
(projects) แต่ละโครงการมีรายการประชุมของตัวเอง เนื้อหาบันทึกเป็น rich-text (ตัวหนา/เอียง/ขีดเส้นใต้/bullet list/tick
list) ที่พิมพ์ในแอปโดยตรง ไม่ใช่ Google Doc อีกต่อไป

ส่วนประกอบหลักของภาพรวม:

- **โครงการ (Projects)** — ที่เก็บบันทึกการประชุม แต่ละโครงการมี tier การมองเห็น (public/locked), สี, cadence
  (Monthly/Quarterly/As needed) — จัดการใน `src/components/ProjectModal.jsx`, `src/components/AccessPage.jsx`
- **บันทึกการประชุม (Meetings/Minutes)** — เอกสารเดี่ยว มีหัวข้อ วันที่ (dateLabel แบบข้อความอิสระ + time) เนื้อหา
  HTML รายชื่อผู้เข้าร่วม (attendees, สกัดอัตโนมัติจากอีเมลในเนื้อหา) ไฟล์แนบ และคอมเมนต์
- **Inbox อัตโนมัติจาก Fathom/Transkriptor** — การประชุมที่บันทึกเสียง/ถอดเสียงอัตโนมัติจะเข้ามาที่โครงการพิเศษ
  `FATHOM_INBOX` และ `TRANSKRIPTOR_INBOX` (เป็นโครงการจริงในฐานข้อมูล ไม่ใช่ของปลอม) แล้วแอดมิน/บรรณาธิการ
  ต้อง "แท็ก" (tag) เข้าสู่โครงการจริงด้วยตนเอง (ไม่มีการย้ายออกจาก inbox — เป็น archive ถาวร)
- **Action items / งานที่ต้องติดตาม** — ไม่มี field แยกต่างหากสำหรับ action items ในระบบนี้ เนื้อหาการติดตามงานถูก
  เขียนอยู่ภายใน HTML ของบันทึกเอง (เช่นใน bullet/tick list) — ไม่มี entity "Action Item" ของตัวเองในฐานข้อมูล
- **ประวัติการแก้ไข (Edit History / Audit Trail)** — ทุกการแก้ไขเนื้อหาจะถูก snapshot ไว้ และทุก mutation (pin,
  visibility, tag, attachment, comment ฯลฯ) จะถูกบันทึกลง audit log — ดูเฉพาะโดยแอดมิน
- **Timeline** — มุมมองแสดงว่าโครงการไหนประชุมเมื่อไหร่ ทั้งแบบเส้นแนวนอน (lane) และปฏิทินรายเดือน

**ข้อความสำคัญที่สุดข้อหนึ่งจาก `PORT_NOTES.md`:** ระบบนี้ **ห้ามนำเข้า/สร้าง Google Doc กลับมาโดยเด็ดขาด**
Docs หยุดเป็น source of truth ตั้งแต่ 2026-07-19 ทุกบันทึกตอนนี้เขียนในแอป การนำเข้ากลับมาจะเขียนทับการแก้ไขจริงด้วย
เนื้อหา Doc เก่า `projects.doc_id`, `minutes.tab_id` และ `source = 'doc-import'` เป็น **ข้อมูลที่มาในอดีตเท่านั้น
(read-only provenance)** บันทึกที่มาจาก Doc import จะคงค่า `source = 'doc-import'` ตลอดไป แม้จะถูกแก้ไขในแอปแล้วก็ตาม
(การแก้ไขคือ "จัดระเบียบ" ไม่ใช่ "สร้างใหม่") — Database มี CHECK constraint ปฏิเสธค่า `'doc-edited'` ไว้ด้วย

---

## 2. รายการฟังก์ชันทั้งหมด และ Logic การทำงาน

### 2.1 การสร้าง/แก้ไขข้อมูลเมทาดาทาของบันทึกการประชุม — `MeetingModal.jsx`

**ทำอะไรได้:** สร้างบันทึกใหม่ หรือแก้ไข "เมทาดาทา" ของบันทึกที่มีอยู่ (โครงการ, หัวข้อ, dateLabel, time)
**ไฟล์:** `src/components/MeetingModal.jsx`

**สิ่งสำคัญ:** modal นี้ **ไม่ใช่ที่แก้เนื้อหาบันทึกหลัก** (ดูหมายเหตุใน docstring บรรทัด 9-20) — เนื้อหาหลักแก้ผ่าน
rich editor (`EditorModal.jsx`) เท่านั้น ฟิลด์ "เนื้อหา" (`TextArea` ใน MeetingModal) ใช้สำหรับ:
- ตอนสร้างบันทึกใหม่ — สามารถวางข้อความดิบ (plain text) ได้ แอปจะตรวจว่าข้อความมี HTML tag หรือไม่ (regex
  `/<[a-z][\s\S]*>/i`) ถ้าไม่มี จะ escape แล้วแยกย่อหน้าโดยแบ่งตามบรรทัดว่าง (`\n{2,}`) ครอบด้วย `<p>` แต่ละย่อหน้า
  และแปลง `\n` เดี่ยวเป็น `<br>` เพื่อไม่ให้ transcript ที่วางเข้ามากลายเป็นบรรทัดเดียวยาว ๆ

**Logic การทำงาน (`save()`):**
1. เรียก `minutesApi.saveMeeting({ id, projectId, title, dateLabel, time, html })`
2. `source` **ไม่เคยถูกส่งจาก client** — API จะ default เป็น `'manual'` เสมอ (ไม่มีค่าใดที่ client ควรเลือกได้แม่นยำกว่านี้)
3. โครงการที่เลือกได้ (`selectable`) จะกรอง inbox project ออก (`isInboxProject`) — บันทึกใหม่ที่พิมพ์มือ
   ไม่สามารถยัดเข้า inbox ได้ เพราะ inbox มีไว้สำหรับ recording ที่ ingest มาเท่านั้น

**การลบ (`remove()`):** สิทธิ์ **editor หรือ admin** เท่านั้น (`canDelete = hasRole('minutes', 'editor', 'admin')`)
— ไม่ใช่ admin-only ให้ตรงกับ guard `isEditorOrAdmin_` ของต้นฉบับ เดิมทีถ้าจำกัดแค่ admin
จะเป็นการลดสิทธิ์ของ editor ที่มีอยู่แล้วโดยไม่ตั้งใจ ต้องยืนยันผ่าน `useConfirm()` ก่อนเรียก `minutesApi.deleteMeeting(id)`

---

### 2.2 Rich-Text Editor — `EditorModal.jsx`

**ทำอะไรได้:** แก้ไขเนื้อหาเต็มของบันทึกการประชุม ด้วย toolbar: **Undo/Redo, ตัวหนา (Bold), ตัวเอียง (Italic),
ขีดเส้นใต้ (Underline), bullet list, numbered list, tick list (✓)**

**ไฟล์:** `src/components/EditorModal.jsx`

**หมายเหตุสำคัญตามที่โจทย์ระบุ — เป็นการตัดสินใจของ product โดยเจตนา:**
- **ไม่มีปุ่มลิงก์ (link)** ใน toolbar แม้ว่าโค้ด sanitizer (`sanitizePastedNode`) จะรองรับ `<A>` tag ที่วางเข้ามาก็ตาม
  (คือรับลิงก์ที่ paste เข้ามาได้ แต่ไม่มีปุ่มให้ผู้ใช้สร้างลิงก์เองจาก toolbar)
- **ไม่มีปุ่มบันทึกเสียง/recording** ใด ๆ ในตัว editor — ไม่มีการอัดเสียงหรือแนบไฟล์เสียงจากใน editor นี้เลย

**สถาปัตยกรรมสำคัญ: ทำไมไม่ใช้ `document.execCommand` สำหรับ Enter และ Paste**

ตามคอมเมนต์ในโค้ด (บรรทัด 18-28): `execCommand`'s `insertParagraph`/`formatBlock`/`insertHTML` ถูก deprecate เพราะ
เบราว์เซอร์แต่ละตัว implement การแยก list ไม่ตรงกัน (กด Enter ใน `<li>` ที่ซ้อนกันอาจทำให้ list เพี้ยน) ดังนั้น:
- **Enter และ Paste ใช้ direct Range/DOM surgery เอง** (ไม่ใช้ execCommand)
- **execCommand ยังใช้อยู่** สำหรับ bold/italic/underline/insertUnorderedList/insertOrderedList — จุดที่ execCommand
  ทำงานเสถียรและไม่มีทางเลือกมาตรฐานอื่นแทน

**ฟังก์ชัน `cmd(c)` — การจัดการคำสั่ง toolbar (บรรทัด 382-386):**
```js
const cmd = (c) => {
  pushUndo(true);              // บันทึก undo snapshot ก่อนสั่งคำสั่งเสมอ (immediate = true)
  document.execCommand(c, false);
  focusArea();                 // คืน focus กลับไปที่พื้นที่แก้ไข
};
```
ปุ่ม Bold/Italic/Underline/Bullet/Numbered เรียก `cmd()` โดยส่งชื่อคำสั่ง execCommand ตรง ๆ (`'bold'`, `'italic'`,
`'underline'`, `'insertUnorderedList'`, `'insertOrderedList'`) ทุกปุ่มมี `onMouseDown={(e) => e.preventDefault()}`
เพื่อป้องกันปุ่มแย่ง focus ไปจากพื้นที่แก้ไข (ถ้าไม่ป้องกันจะทำให้ selection ที่คำสั่งจะกระทำหายไปก่อน)

**Tick list (`tickList()`, บรรทัด 394-407):** ไม่มี execCommand สำหรับ tick list โดยตรง จึงใช้เทคนิคพิเศษ:
เรียก `insertUnorderedList` ก่อน (เพื่อให้ได้ `<ul>` ที่ nest ถูกต้อง — จุดเดียวที่ execCommand ทำ list ได้แม่นยำ)
แล้วค่อยเพิ่ม class `tick-list` ให้ `<ul>` และ `<li>` ทุกตัวภายใน CSS จะ render เครื่องหมาย ✓ ผ่าน
`list-style-type: '✓  '` (marker จริง ไม่ใช่ `::before` เพราะ pseudo-element ไม่ repaint แน่นอนใน contentEditable —
ดู `PAGINATION.md` ส่วน "Known-bad approaches")

**Undo/Redo — stack ของตัวเอง ไม่ใช้ของเบราว์เซอร์:**
เหตุผล: Enter/Paste/tick list แก้ไข DOM ตรง ๆ ไม่ผ่าน execCommand ดังนั้น undo stack ของเบราว์เซอร์ไม่เห็นการเปลี่ยนแปลง
เหล่านั้น — ถ้าใช้ `execCommand('undo')` จะข้ามการเปลี่ยนแปลงเหล่านี้ไปและคืนสถานะที่ไม่เคยมีจริง
- แต่ละ snapshot คือ `{ html, caret }` — เก็บตำแหน่ง caret ด้วย ไม่งั้น undo แล้ว cursor จะกระโดดไปตำแหน่ง 0
- **การพิมพ์ปกติ (coalescing):** กด 1 คีย์ (`e.key.length === 1`) หรือ Backspace/Delete จะ schedule push แบบหน่วง 500ms
  (`pushUndo()` ไม่ใส่ `immediate`) — ทำให้พิมพ์ทั้งประโยคนับเป็น undo step เดียว ไม่ใช่ 40 steps
- **การแก้ไขเชิงโครงสร้าง** (paste, Enter, กดปุ่ม toolbar) จะ push ทันที (`pushUndo(true)`) เพราะเป็นขั้นที่ผู้ใช้
  ต้องการ undo ทีละขั้นจริง ๆ
- Stack จำกัดที่ 200 รายการ (ป้องกันโตไม่จำกัดถ้าแก้ไขนาน 1 ชั่วโมง)
- Redo stack จะถูกล้างทุกครั้งที่มีการ push ใหม่ (การแก้ไขปกติ ไม่ใช่ undo/redo เอง)
- คีย์ลัด: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z หรือ Ctrl+Y = redo (ดักจับก่อนอะไรทั้งหมดด้วย `preventDefault`
  เพื่อไม่ให้เบราว์เซอร์รัน undo ของตัวเองทับ)

**การกด Enter (`handleKeyDown`, บรรทัด 255-289):**
- ถ้า caret อยู่ใน `<li>` (แม้ nested) → แยก li เป็นสองส่วนด้วย `splitBlockAtCursor()`
- ถ้า caret อยู่ใน heading (`h1-h6`) → บรรทัดใหม่จะเป็น `<p>` เสมอ ไม่ใช่ heading ต่อ และถ้า Enter ที่จุดเริ่มต้นของ
  heading (heading ว่างเปล่า) จะแปลง heading ทั้งก้อนเป็น paragraph แทนที่จะเหลือ heading เปล่า

**การวาง (Paste, `handlePaste`, บรรทัด 329-377) และ sanitizer (`sanitizePastedNode`, บรรทัด 305-327):**
- ล้าง style/class/font attribute ทั้งหมดที่มากับ clipboard (ป้องกันสีตัวอักษร/font แปลกปลอมจากแหล่งอื่นติดเข้ามา)
- Tag ที่รอด: `B, STRONG, I, EM, U, A, UL, OL, LI, BR, P` (ค่าคงที่ `PASTE_ALLOWED_TAGS`) — tag อื่นถูก unwrap
- `<DIV>` (มักมาจาก Word/Google Docs) แปลงเป็น `<P>` แทนที่จะ unwrap เฉย ๆ — ป้องกันหลาย DIV กลายเป็นย่อหน้าเดียวยาว
- ลิงก์ (`<A>`): รับเฉพาะ `href` ที่ขึ้นต้นด้วย `http:`, `https:`, หรือ `mailto:` เท่านั้น (ป้องกัน `javascript:` href)
  และบังคับ `target="_blank" rel="noreferrer"` เสมอ
- ถ้า clipboard ไม่มี HTML (plain text) จะแบ่งบรรทัดเป็น `<p>` เดี่ยว ๆ (บรรทัดว่าง → `<br>`) ให้ผลลัพธ์เหมือนกันไม่ว่า
  จะ paste จากแหล่งไหน

**ปุ่มอื่นใน editor:**
- **ปุ่ม "ประวัติการแก้ไข" (`editor.editHistory`)** — เปิด `EditHistoryModal` (ดูหัวข้อ 2.3)
- **ปุ่มลบบันทึก** — แสดงเฉพาะ editor/admin (`canDelete`)
- **ยกเลิก (Cancel)** — ตรวจ fingerprint การเปลี่ยนแปลงก่อนปิด (ดูด้านล่าง) ถ้ามีการแก้ไขค้างจะถามยืนยันก่อนทิ้ง
- **บันทึก (Save)** — เรียก `minutesApi.saveMeetingContent(id, html, meta)` ผ่าน `PUT /content` (ไม่ใช่
  `POST /meetings`) เพราะ route นี้จะ snapshot เนื้อหา**และ**เมทาดาทาเดิมลง version history ก่อนบันทึกทับ

**Fingerprint การเปลี่ยนแปลง (`snapshot()`, บรรทัด 61-71):**
รวม `title, dateLabel, time, innerHTML` เข้าด้วยกันโดยใช้ตัวคั่นพิเศษ `SNAPSHOT_SEP` (U+001F, ASCII unit separator)
เหตุผลที่ใช้ตัวคั่นแทนการต่อ string ตรง ๆ: ถ้าไม่มีตัวคั่น การย้ายตัวอักษรจากท้าย title ไปต้น dateLabel จะได้ string
เดียวกัน ทำให้ปุ่ม Cancel ไม่ถามยืนยันทั้งที่มีการเปลี่ยนแปลงจริง — ตรวจ snapshot นี้ทุกครั้งก่อนปิด modal (ไม่มีการปิดด้วย
การคลิกนอก backdrop หรือกด Escape โดยเจตนา — ต้องผ่านปุ่ม Cancel ที่ถามยืนยันเท่านั้น)

---

### 2.3 ประวัติการแก้ไข / Audit Trail — `EditHistoryModal.jsx`

**ทำอะไรได้:** แสดง "ใครแก้บันทึกนี้เมื่อไหร่ และเนื้อหาก่อนหน้าเป็นอย่างไร" — **เฉพาะแอดมินเท่านั้น** (ทั้ง UI
และ API gate ด้วย `requireRole('minutes', 'admin')`)

**ไฟล์:** `src/components/EditHistoryModal.jsx`, backend: `api/src/routes/minutes.js` (versions/audit routes)

**สถาปัตยกรรม — สอง endpoint แยกกันโดยเจตนา (ตามคอมเมนต์บรรทัด 11-25):**
1. **`GET /meetings/:id/versions`** — content snapshot เท่านั้น เป็นแถวเดียวที่ **ดูตัวอย่าง (Preview)** ได้จริง
2. **`GET /meetings/:id/audit`** — ทุก action รวมถึงที่ไม่เปลี่ยนเนื้อหา (pin, visibility, tag, attachment, comment)

UI เดิม (Apps Script) พยายามอ่าน field `details.versionSeq` จาก audit log อย่างเดียวเพื่อสร้างปุ่ม "View" แต่ API ใหม่
ไม่เคย emit field นี้ (`changes` column เก็บแค่สิ่งที่แต่ละ route เลือกบันทึก) ปุ่ม View จึงไม่มีทางปรากฏถ้าทำแบบเดิม
วิธีแก้คืออ่าน `/versions` ตรง ๆ — "version row หนึ่งแถวคือหนึ่งเวอร์ชันที่ดูได้จริง" ถูกต้องและง่ายกว่า

**Logic การทำงาน:**
- โหลดทั้งสอง endpoint พร้อมกันด้วย `Promise.all` เมื่อ modal เปิด
- `activity` = audit entries ที่กรอง `create_*` ออก (การสร้างจะซ้ำกับแถว "Original" ที่ pin ไว้ด้านบนอยู่แล้ว ซึ่งมี
  timestamp การสร้างจริงอยู่แล้ว การแสดงซ้ำในรายการ activity จะทำให้ดูเหมือนมีอะไรถูกสร้างขึ้นหลังการแก้ไขครั้งหลัง)
- **แถว "Original" (ต้นฉบับ)** แสดงเสมอ ปุ่ม "ดูต้นฉบับ" เรียก `onViewVersion('original')` — resolve ฝั่ง server
  เป็น snapshot **เก่าที่สุด** เสมอ หรือถ้าไม่เคยแก้ไขเลยจะ fallback เป็นแถวสด (current) เพราะถือว่าปัจจุบันคือต้นฉบับ
- แต่ละ version แสดงปุ่ม "View" (`onViewVersion(v.seq)`) เปิด `VersionPreviewModal`
- **แอดมินเท่านั้น** ที่มีปุ่มลบรายการเดี่ยว (`deleteEntry`/`deleteVersion`) และปุ่ม "ล้างทั้งหมด" (`clearAll`)
  ซึ่งลบทั้ง audit log และ versions ของบันทึกนั้นทิ้งทั้งหมด — มีประโยชน์เพราะ "แอดมินที่แก้ไขบันทึกของตัวเองอาจสร้าง
  20 รายการในหนึ่งบ่ายและอยากให้ noise หายไปอย่างชอบธรรม" (คอมเมนต์ใน `minutesApi.js`)
- ป้ายชื่อ action ใช้ machine token จาก API (เช่น `edit_content`, `toggle_pin`) แล้วแปลผ่าน `t('audit.' + action)`
  — ถ้า action ใหม่ยังไม่มี entry ใน dictionary จะ fallback เป็น key ดิบ (เผยปัญหาแทนที่จะซ่อน)

**Logic ฝั่ง server ในการบันทึกประวัติ (`api/src/routes/minutes.js`):**
- ทุก mutation ที่เปลี่ยนแปลงข้อมูลจะเรียกฟังก์ชัน `audit(client, actor, action, target, targetId, changes, note)`
  (บรรทัด 90-96) ซึ่ง insert ลงตาราง `minutes.audit_log` แบบ **append-only**
- **การ snapshot เนื้อหาเก่าก่อนแก้ไข** เกิดขึ้นทั้งใน `POST /meetings` (เมื่อ `body.id` มีอยู่แล้ว = เป็นการแก้ไข)
  และ `PUT /meetings/:id/content` — ทั้งสอง route จะ `insert into minutes.versions (minute_id, snapshot, taken_by)`
  โดย snapshot เก็บ **html + title + dateLabel + time ณ ขณะนั้น** (ไม่ใช่แค่ html) เหตุผล: ถ้า versioning เฉพาะ body
  การ "ดูต้นฉบับ" (View Original) จะแสดงชื่อ**ปัจจุบัน**ของบันทึกหลังเปลี่ยนชื่อ ซึ่งเป็นบั๊กที่ยืนยันแล้วเมื่อ
  2026-07-22
- Snapshot จะถูกสร้างก็ต่อเมื่อมี `prev.content_html` อยู่ก่อนแล้ว (ไม่ snapshot ครั้งแรกที่สร้าง เพราะยังไม่มี "ก่อนหน้า")
- `GET /meetings/:id/versions/:seq` รองรับค่า `seq` พิเศษ: `'current'` (แถวสด) และ `'original'` (snapshot เก่าสุด
  เรียงตาม `taken_at asc` หรือแถวสดถ้าไม่มี snapshot เลย) หรือเลข sequence จริง
- **หมายเหตุ backward-compat:** snapshot ที่ถ่ายก่อนวันที่ 2026-07-22 (ก่อนแก้บั๊ก) จะมีแค่ `html` ฟิลด์อื่นจะเป็น
  string ว่าง `''` — ค่าว่างนี้คือสัญญาณให้ client fallback ไปใช้ค่าจากแถวสด (**เฉพาะกรณีนี้เท่านั้น** ไม่ใช่ default
  ทั่วไป มิเช่นนั้นบั๊กเดิมจะกลับมาทุกเวอร์ชัน) — ดู `fromSnapshot()` ในฝั่ง server และคอมเมนต์ใน
  `VersionPreviewModal.jsx` บรรทัด 16-19
- การลบ audit entry เดี่ยว/version เดี่ยว/ล้างทั้งหมด เป็น **admin only** ทั้งหมด — เมื่อลบ version ผ่าน
  `DELETE /versions/:seq` จะลบเฉพาะ snapshot นั้น ไม่ cascade อะไรอื่น (schema ใหม่ไม่ผูก version กับ audit log
  เหมือนต้นฉบับเดิม)

---

### 2.4 Activity Panel (ประวัติ + คอมเมนต์รวมในที่เดียว) — `ActivityPanel.jsx`

**ทำอะไรได้:** panel เลื่อนออกจากขวา (drawer) แสดง "การแก้ไข + คอมเมนต์" เรียงตามเวลาล่าสุดก่อน รวมเป็นฟีดเดียว

**ไฟล์:** `src/components/ActivityPanel.jsx`

**ทำไมรวมเป็น panel เดียว:** ตามคอมเมนต์ (บรรทัด 8-19) แอปต้นฉบับปฏิบัติต่อ "การแก้ไข + คอมเมนต์" เป็นเรื่องเดียวกัน
("edits and comments, newest first") การแยกเป็นสองปุ่ม (History / Comments) ในระหว่างพอร์ตเป็นความผิดเพี้ยนจากการพอร์ต
ไม่ใช่การออกแบบใหม่ที่ตั้งใจ จึงรวมกลับเป็น panel เดียว

**Logic การทำงาน:**
- แถวประวัติการแก้ไข (versions + audit) โหลด **เฉพาะแอดมิน** เพราะ endpoint `/versions` และ `/audit` เป็น admin-only
  ที่ API — เป็นเรื่องสิทธิ์ ไม่ใช่สิ่งที่การรวม panel เปลี่ยนแปลง
- คอมเมนต์มองเห็นได้โดยผู้อ่านทุกคนที่มองเห็นบันทึกนี้ และโพสต์ได้โดยทุกคนที่ signed-in (เหมือนเดิม)
- **ผสมฟีด (`feed`):** รวม `editEntries` (ทำเครื่องหมาย `kind: 'edit'`) กับ `commentEntries` (`kind: 'comment'`)
  แล้วเรียงจากใหม่ไปเก่าด้วย `new Date(b.when) - new Date(a.when)`
- คอมเมนต์แสดงผู้เขียน ข้อความ (`whitespace-pre-wrap`) และปุ่มลบ (✕) เฉพาะเจ้าของคอมเมนต์หรือแอดมิน
  (`mine = isAdmin || c.author === user?.email`)
- การแก้ไข (edit entry) ที่จับคู่กับ version ได้ (`versionByWhen` map จาก `takenAt`) จะมีปุ่ม "View" ให้แอดมินดู
  version นั้นได้ทันทีจากฟีด และปุ่มลบที่ลบทั้ง audit entry **และ** version พร้อมกัน (`deleteEntry` +
  `deleteVersion`)
- แถวคอมเมนต์แสดงไอคอน 💬 หน้าอีเมล/ชื่อผู้เขียน แถวการแก้ไขแสดงข้อความ action ที่แปลแล้ว (`audit.<action>`) ตามด้วย
  ผู้กระทำ
- ถ้าไม่ signed-in จะไม่แสดงกล่องพิมพ์คอมเมนต์ (แสดงข้อความ `error.AUTH_REQUIRED` แทน) เพราะ POST comment ต้อง
  auth และแสดงกล่องให้คนที่ไม่ signed-in จะได้แค่ 401 ที่แก้ไขเองไม่ได้

**การโพสต์คอมเมนต์ (`post()`):** เรียก `minutesApi.addComment(id, text)` → `POST /meetings/:id/comments` — trim
ข้อความ, จำกัดความยาว 4000 ตัวอักษร (`maxLength` ที่ TextArea และ zod schema `commentSchema` ฝั่ง server ก็จำกัด
4000 เช่นกัน)

**Logic ฝั่ง server สำหรับคอมเมนต์:**
- `POST /meetings/:id/comments` ต้อง `requireAuth` และตรวจซ้ำว่าอ่านบันทึกนี้ได้จริงหรือไม่ (`canReadProject`) —
  แค่ signed-in ไม่พอถ้าเป็นโครงการ locked ที่ผู้ใช้ไม่มีสิทธิ์ (คอมเมนต์บรรทัด 1153-1157)
- `DELETE /comments/:commentId` — ผู้เขียนคอมเมนต์เอง (`target.author === req.user.email`) หรือแอดมินเท่านั้น
  ที่ลบได้ (403 FORBIDDEN สำหรับคนอื่น)

---

### 2.5 หน้าจอรายละเอียดบันทึกการประชุม — `MeetingDetail.jsx`

**ทำอะไรได้:** แสดงบันทึกการประชุมแบบ A4 page-accurate (เหมือนพิมพ์จริง) พร้อม action bar: pin, แท็กเข้าโครงการอื่น
(สำหรับ AI-sourced), แก้ไข, Activity, แชร์ลิงก์, พิมพ์ (Print/PDF)

**ไฟล์:** `src/components/MeetingDetail.jsx`

**Logic สำคัญ:**
- **Cache-first + re-fetch สด:** เปิดบันทึกจาก cache ก่อน (`getCached`) ถ้าไม่มีจึงเรียก `fetchMeeting` แต่ก่อนเปิด
  editor จะ **บังคับ re-fetch เสมอ** (`openEditFresh` → `refetchMeeting`) เพื่อป้องกันแก้ไขจากข้อมูลเก่าที่ Fathom
  ingest หรือคนอื่นแก้ไขไปแล้วหลัง pane นี้โหลดครั้งแรก — ถ้าไม่ทำแบบนี้จะเขียนทับเวอร์ชันใหม่กว่าโดยไม่รู้ตัว
- **404 แทน 403 สำหรับบันทึกที่มองไม่เห็น:** API ตอบ 404 เสมอสำหรับบันทึกในโครงการที่อ่านไม่ได้ ไม่ตอบ 403
  เพราะ id เองไม่ควรถูกยืนยันการมีอยู่โดยโครงการ locked — UI จึงแยกไม่ออกและไม่ควรพยายามแยก "ลบไปแล้ว" กับ
  "ไม่ใช่ของคุณ" — ทั้งสองแสดงเป็น "ไม่พบ" เหมือนกัน (ดู `isNotFound()` ใน `lib/errors.js`)
- **ปุ่ม Pin (⭐)** — เฉพาะแอดมิน เรียก `PUT /meetings/:id/pin` (toggle) แล้ว `refresh()` รายการทั้งหมดเพื่ออัปเดต
  ลำดับ (pinned ขึ้นก่อนเสมอ)
- **ปุ่ม "จัดเข้าโครงการ" (File into project)** — แสดงเฉพาะเมื่อบันทึกเป็น AI-sourced (`isAiSourced`, คือ source
  เป็น fathom หรือ transkriptor) และผู้ใช้มีสิทธิ์แก้ไข — เปิด `TagPickerModal`
- **ปุ่ม "แก้ไขที่นี่" (Edit Here)** — **ไม่แสดงเลย** ถ้าบันทึกเป็น `doc-import` (`isDocImport`) เพราะเนื้อหานำเข้า
  มาทางเดียว (one-way) และ Doc ต้นทางไม่ authoritative แล้ว ไม่มีอะไรให้เขียนย้อนกลับไปได้อย่างสอดคล้อง
- **แท็ก (chips) ของโครงการอื่นที่ถูก tag เข้าไป** — แสดงเฉพาะบันทึก AI-sourced ที่มี `taggedProjectIds` แต่ละ chip
  มีปุ่มลบแท็กเดี่ยว (`untagOne`) — ไม่มีปุ่ม "ลบทุกแท็กพร้อมกัน" และไม่มีทางออกจาก inbox เดิม (inbox project_id
  เป็นค่าถาวร)
- **แชร์ลิงก์ (`share()`):** คัดลอกลิงก์แบบถาวรไปยังบันทึกนี้ (`meetingLink(id)`) ไปยัง clipboard หรือ fallback
  เป็น `window.prompt` ถ้า clipboard API ใช้ไม่ได้
- **การพิมพ์ (`print()`):** สร้าง iframe ที่ซ่อนอยู่ (`vcb-print-frame`) ด้วย `srcdoc` เวอร์ชันสำหรับพิมพ์
  (`buildMeetingSrcdocForPrint`) **ไม่ใช้ iframe preview เดิม** เพราะ Paged.js แบ่งหน้าเอกสาร preview ไปแล้ว
  ถ้าส่งให้เครื่องพิมพ์จะกลายเป็นการแบ่งหน้าเอกสารที่แบ่งหน้าไปแล้วซ้ำอีกชั้น (ดูรายละเอียดในหัวข้อ 3)

**การ render เอกสารแบบ Page-accurate (Paged.js):** ดูหัวข้อ 3 ด้านล่างสำหรับสถาปัตยกรรมแบบละเอียด — สรุปสั้น ๆ คือ
มี iframe สอง `srcdoc`: หนึ่งสำหรับดูบนจอ (มี Paged.js ทำ pagination จริง) และหนึ่งสำหรับพิมพ์ (ไม่มี Paged.js) —
`onFrameLoad()` จะ poll จำนวนหน้า `.pagedjs_page` จนนิ่ง (เท่าเดิม 3 ครั้งติด) ก่อนปรับความสูง iframe และเผยหน้าจอ
(ป้องกันเห็นเอกสารตอนยังแบ่งหน้าไม่เสร็จ)

---

### 2.6 ไฟล์แนบ — `AttachmentsBar.jsx`

**ทำอะไรได้:** แนบไฟล์ (PDF, Word, Excel, PowerPoint, รูปภาพ, text/CSV) เข้ากับบันทึกการประชุม แสดงเป็น chip
ต่อท้ายเอกสาร (เป็นภาคผนวก ไม่ใช่แถบเหนือเนื้อหาที่กินพื้นที่จอ)

**ไฟล์:** `src/components/AttachmentsBar.jsx`

**Logic การอัปโหลด 3 ขั้นตอน:**
1. ขอ URL สำหรับอัปโหลดจาก API (`uploadUrlFor`)
2. ส่งไบต์ไฟล์ตรงไปยัง Storage ด้วย presigned URL (`putToStorage`) — ใช้ `fetch` ตรง ๆ ไม่ผ่าน shared API client
   เพราะ presigned URL ต้อง**ไม่มี** Authorization header ติดไปด้วย
3. บันทึกเฉพาะ**เมทาดาทา** (ชื่อ, mime type, ขนาด, URL) กลับไปที่ API (`addAttachment`)

**⚠️ ข้อจำกัดสำคัญ (ตาม `PORT_NOTES.md` ข้อ 1):** **ยังไม่มี route สำหรับ presign upload ใน backend จริง**
`minutesApi.js` เขียน client ไว้พร้อมแล้ว (`uploadUrlFor`, `putToStorage`) และ `AttachmentsBar` เรียกใช้แล้ว แต่
`api/src/routes/minutes.js` มี route `GET /meetings/:id/attachments/upload-url` (บรรทัด 1051-1084 ของไฟล์ backend)
ซึ่ง**มีอยู่แล้วจริง**ในโค้ดปัจจุบัน (ใช้ `presignUpload`/`presignDownload` จาก `lib/storage.js`) — ดังนั้นในทางเทคนิค
gap ที่ระบุใน `PORT_NOTES.md` **ได้รับการแก้ไขแล้ว** ในซอร์สปัจจุบันที่ตรวจสอบ (route นี้มีครบ พร้อม MIME allow-list,
ขนาดสูงสุด, และ error handling `STORAGE_UNAVAILABLE` เมื่อ presign ไม่สำเร็จ) — ควรตรวจสอบกับทีม deploy
ว่า `PORT_NOTES.md` เป็นบันทึกสถานะ ณ เวลาที่เขียน ไม่ใช่สถานะปัจจุบันเสมอไป

**Logic ฝั่ง server:**
- MIME allow-list (`ATTACHMENT_ALLOWED_MIME` regex): PDF, Office Open XML (docx/xlsx/pptx), MS Office เก่า
  (doc/xls/ppt), รูปภาพ (png/jpg/jpeg/gif/webp), text/plain, text/csv
- ขนาดสูงสุด: **25 MB** (`ATTACHMENT_MAX_BYTES`)
- Object key เป็น **ค่าสุ่ม** ไม่ใช่มาจากชื่อไฟล์ (เพราะชื่อไฟล์ภาษาไทยเป็นเรื่องปกติ และการ sanitize ชุดอักขระ
  ไม่จำกัดให้ปลอดภัยพอสำหรับ path เป็นเกมที่แพ้แน่ — ชื่อไฟล์เดิมเก็บใน database เป็น data แทน)
- `contentType` ที่ signed เข้า URL **ต้อง**ตรงกับที่ PUT จริง (ไม่ใช้ `file.type` ของเบราว์เซอร์ เพราะบางระบบ Windows
  จะรายงาน `.docx` เป็นค่าว่าง) — ความไม่ตรงกันทำให้ signature mismatch (403 ที่เข้าใจยาก)
- ลบไฟล์แนบ (`DELETE /attachments/:fileId`) — ลบเฉพาะ metadata record เท่านั้น (jsonb array filter)
- สิทธิ์: editor หรือ admin สำหรับเพิ่ม/ลบไฟล์แนบทั้งหมด

---

### 2.7 การแท็กบันทึก AI-sourced เข้าโครงการ — `TagPickerModal.jsx`

**ทำอะไรได้:** เมื่อบันทึกมาจาก Fathom/Transkriptor (อยู่ใน inbox) แอดมิน/บรรณาธิการเลือกโครงการจริงที่จะ "แท็ก"
เข้าไป โดย **ไม่ย้ายออกจาก inbox** — เป็นการเพิ่มเท่านั้น (`taggedProjectIds`)

**ไฟล์:** `src/components/TagPickerModal.jsx`

**Logic การแนะนำโครงการอัตโนมัติ (`suggestProjectFor`)** — เป็นแค่ **คำแนะนำ ไม่เคย auto-apply**:
- ให้คะแนนความเข้ากันของแต่ละโครงการกับเนื้อหาบันทึก (title + เนื้อหา HTML ที่ strip tag แล้ว) โดยเทียบเป็น
  lowercase:
  - **สัญญาณแรง (+5 คะแนน)** — project id เอง (ยาว ≥2 ตัวอักษร), alias ในวงเล็บของ nameEn (เช่น
    "Bang Toey Sections 1+2 (BT)" → "BT" ซึ่งเป็นตัวย่อที่ Fathom title จริงมักใช้), หรือชื่อเต็ม (name/nameEn)
    ที่ปรากฏเป็นวลีเต็ม
  - **สัญญาณอ่อน (+1 คะแนนต่อคำ)** — คำแต่ละคำจากชื่อโครงการ ยาว ≥3 ตัวอักษร และไม่อยู่ใน `WEAK_WORDS`
    (ชุดคำทั่วไปเช่น "review", "business", "financial", "monthly" ที่พบได้ในทุก transcript ธุรกิจ ไม่บ่งชี้โครงการ)
  - ต้องได้คะแนนรวม **≥ 2** จึงจะถือเป็นคำแนะนำ (สัญญาณอ่อนตัวเดียวไม่พอ) — ออกแบบมาเพื่อป้องกันปัญหาที่เคยเกิด:
    คำว่า "Financial" ตัวเดียวเคยทำให้ระบบแนะนำ FIN (โครงการการเงิน) ผิด ๆ สำหรับการประชุมที่จริงเป็นเรื่อง
    ERP/PO/PR
- โครงการที่ถูกแนะนำจะไฮไลต์เป็นสีเหลือง badge "แนะนำ" ในรายการให้เลือก — ผู้ใช้ยังต้องคลิกเลือกเองเสมอ (เหตุผล:
  เนื้อหาโครงการอาจ sensitive และการแท็กผิดโครงการจะเปิดเผยให้ผู้ดูของโครงการนั้นเห็น)
- ตัวเลือกที่แสดง: กรอง inbox ออก และกรองโครงการที่แท็กไปแล้วออก (`already`)
- เลือกแล้วเรียก `minutesApi.tagMeeting(id, projectId)` → `POST /meetings/:id/tags`

**Logic ฝั่ง server (การแท็ก):**
- ปฏิเสธด้วย `CANNOT_TAG_INBOX` ถ้าเป้าหมายเป็น inbox เอง
- ปฏิเสธด้วย `NOT_AN_INBOX_ROW` ถ้าบันทึกต้นทางไม่ใช่แถวจาก inbox (`project_id` ไม่ใช่ FATHOM_INBOX/TRANSKRIPTOR_INBOX)
- ใช้ `array_append` แบบ idempotent (เช็คว่ามีอยู่แล้วหรือยังก่อน append)
- การลบแท็ก (`DELETE /tags/:projectId`) ใช้ `array_remove` — ลบเฉพาะแท็กเดียว แท็กอื่นไม่กระทบ

---

### 2.8 ตัวอย่างเวอร์ชันย้อนหลัง — `VersionPreviewModal.jsx`

**ทำอะไรได้:** แสดง snapshot เวอร์ชันเก่าแบบอ่านอย่างเดียว (read-only) ใน iframe ของตัวเอง (แยกจาก DOM หลัก
เพื่อให้ปุ่มพิมพ์พิมพ์เฉพาะเอกสารเวอร์ชันนั้น)

**ไฟล์:** `src/components/VersionPreviewModal.jsx`

**Logic สำคัญ:** หัวเรื่องแสดง **title/dateLabel/time ที่บันทึกไว้พร้อม snapshot ณ ขณะนั้น** ไม่ใช่ค่าปัจจุบันของ
บันทึก — ก่อนหน้านี้เคยมีบั๊กที่การเปลี่ยนชื่อบันทึกทำให้ preview เวอร์ชันเก่าแสดงชื่อใหม่ไปด้วย ทำให้ประวัติดูเหมือน
"ถูกเขียนใหม่" — ค่าว่างจาก field ที่ capture ไม่ได้ (snapshot เก่าก่อน 2026-07-22) เท่านั้นที่ fallback ไปใช้ค่า
ปัจจุบันของบันทึก (`content.title || meeting.title || ''`)

---

### 2.9 ระบบสิทธิ์การเข้าถึงแบบ 3 ระดับ (Three-Tier Access Model)

**ไฟล์หลัก:** `api/src/routes/minutes.js` (บรรทัด 1-24, ฟังก์ชัน `readableProjectIds`/`canReadProject`),
`src/components/AccessPage.jsx`

ระบบสามระดับ อ้างอิงโดยตรงจาก RLS policy เดิมใน `supabase/schema.sql` ที่ **ไม่ได้รันจริงแล้ว** เพราะเบราว์เซอร์
เดิมต่อ Supabase ตรง ตอนนี้ API server เดียวต่อ database ด้วย 1 user เท่านั้น ทุก request หน้าตาเหมือนกันหมดสำหรับ
Postgres — ฟังก์ชัน `can_read_project()` / `is_editor()` / `is_admin()` เดิมจึงเป็น dead code ในฐานข้อมูล และ logic
มาอยู่ที่ backend (Express) แทน:

| Tier | คำอธิบาย | สัญลักษณ์ |
|---|---|---|
| **public** (เปิดสาธารณะ) | อ่านได้โดยทุกคน ไม่ต้อง sign-in เลย | 🔓 |
| **locked** (ล็อก) | อ่านได้เฉพาะ admin, editor, และอีเมลที่อยู่ใน `minutes.project_guests` | 🔒 |
| **guest** (ผู้เยี่ยมชมที่ระบุชื่อ) | ผู้อ่านที่ถูกเพิ่มชื่อไว้ในโครงการ locked หนึ่งโครงการ — อ่านได้อย่างเดียว เฉพาะโครงการนั้น | — |

**Logic การตรวจสอบสิทธิ์การอ่าน (`readableProjectIds`, `canReadProject`):**
```sql
-- โครงการอ่านได้ = public OR (ผู้เรียกลงชื่อแล้วและมีอีเมลอยู่ใน project_guests ของโครงการนั้น)
select p.id from minutes.projects p
 where p.visibility = 'public'
    or ($1 <> '' and exists (select 1 from minutes.project_guests g
                              where g.project_id = p.id and lower(g.email) = $1))
```
Editor/Admin ไม่ผ่าน logic นี้ — จุดเรียกจะ short-circuit ด้วย `isEditor(req)`/`isAdmin(req)` ก่อนเสมอ เพราะ
"ทุกโครงการ" แสดงเป็น boolean ถูกกว่าแสดงเป็นลิสต์

**หลักการสำคัญ: การอ่านยังคง anonymous ได้เสมอ**
> "Reading stays anonymous. There is no RequireRole around the routes and there must not be one — a sign-in wall
> would be a regression." (`PORT_NOTES.md`)

แอปเดิมถูก deploy แบบ `ANYONE_ANONYMOUS` ผู้เยี่ยมชมที่ไม่มี session ถือเป็นผู้เรียกปกติ route การอ่านทั้งหมดจึงใช้
`allowAnonymous` middleware และกรองตาม tier แทนที่จะ `requireAuth` — 401 บน route อ่านจะถือเป็นการถดถอย (regression)
**โครงการ locked จะหายไปจากรายการของผู้เรียก anonymous ไปเลย ไม่ใช่แสดงแต่กดไม่ได้** — นี่คือสิ่งที่ tier 🔒
ป้องกันอยู่ (การโชว์ชื่อโครงการที่เปิดไม่ได้คือ leak)

**Logic การจัดการโดยแอดมิน — `AccessPage.jsx`:**
- หน้าเต็มจอ (ไม่ใช่ dialog) เพราะจำนวนโครงการ × จำนวนอีเมลอาจเยอะเกินกว่าจะใส่ modal ได้พอดี
- โหลด guest list **ทีละโครงการแบบขนาน** (`Promise.all`) เพราะ API ยังไม่มี bulk endpoint (`PORT_NOTES.md` ข้อ 6)
  — โครงการเดียวที่อ่านไม่ได้จะไม่ทำให้ทั้งหน้าจอว่างเปล่า (catch แล้วแสดง emails ว่างแทน)
- **ปุ่ม Public/Locked (`togglePublic`)** — ก่อนเปลี่ยนเป็น public จะถามยืนยันก่อนเสมอ เพราะ **ไม่สมมาตร (asymmetric)
  โดยเจตนา**: การปลดล็อก (unlock) จะเผยแพร่ (publish) ทุกบันทึกที่มีอยู่แล้วในโครงการนั้นทันที ในขณะที่การล็อกกลับ
  (lock) มีผลแค่หยุดค่า default ในอนาคต **ไม่ได้ซ่อนบันทึกที่เผยแพร่ไปแล้วกลับคืน** — ต้อง UI บอกความไม่สมมาตรนี้
  ให้ชัดเจน
- **การเพิ่ม guest (`addGuests`)** — รับได้ทั้งอีเมลเดี่ยวหรือวางหลายรายการพร้อมกัน (แยกด้วย comma/semicolon/
  whitespace) ฝั่ง server จะ**ปฏิเสธทั้ง batch**ถ้ามีอีเมลผิดพลาดแม้แค่ตัวเดียว (`INVALID_EMAIL` พร้อมรายชื่อ
  ที่ผิดใน `err.body.emails`) เพื่อไม่ให้บันทึกครึ่ง ๆ กลาง ๆ
- **แจ้งเตือน "bare" project** — โครงการที่ locked แต่ไม่มีใครถูกระบุชื่อเลย (`!p.isPublic && !p.emails?.length`)
  จะแสดง banner เตือน เพราะแม้จะถูกต้องตามกฎ (หมายถึง admin/editor เท่านั้นที่เข้าถึงได้) แต่มักเกิดขึ้นโดยไม่ตั้งใจ
  และวินิจฉัยยากจากภายนอก

**ฟีเจอร์ที่หายไปจากต้นฉบับ (ตาม `PORT_NOTES.md`) และเหตุผล:**
- **"อนุญาตทั้งโดเมน @vcb-con.com"** (`ProjectAccess.domain`) — schema ที่พอร์ตแล้วไม่มีคอลัมน์นี้ ห้าม**จำลอง**
  ด้วยการเพิ่มอีเมลพนักงานทุกคนเข้า guest list ทีละคน เพราะจะดูเหมือนกันในหน้าจอ แต่จะ**ไม่ตามพนักงานใหม่**
  โดยอัตโนมัติ และการลบพนักงานคนหนึ่งจะต่างจากที่แอดมินตั้งใจไว้อย่างเงียบ ๆ
- **"คัดลอก guest list ไปโครงการอื่น"** (`copyProjectViewers`) — ยังไม่มี route รองรับ — เป็นสิ่งที่ควรเพิ่มกลับ
  เพราะหลายโครงการมักมีผู้ชมกลุ่มเดียวกัน (เป็นแค่ endpoint เดียวเหนือ guest table ที่มีอยู่แล้ว)
- **ระบบยืนยันตัวตนแบบ PIN ทั้งหมด** — `EditorSignInModal`, PIN 4 หลักต่อคน, shared team PIN, บังคับเปลี่ยน PIN
  ครั้งแรก — ทั้งหมดถูกแทนที่ด้วย JWT + role ที่จัดการจากส่วนกลาง (`api/src/auth.js`) เพราะแอปเดิมไม่มีทาง identify
  ผู้ใช้จาก Google เอง (deployed ANYONE_ANONYMOUS) จึงต้องสร้างระบบ credential ของตัวเอง ตอนนี้ portal
  มี identity แล้วจึงไม่จำเป็น

---

## 3. Data Flow — API Endpoints ทั้งหมด

อ้างอิงจาก `src/lib/minutesApi.js` (comment บรรทัด 9-39) และยืนยันตรงกับ route จริงใน
`api/src/routes/minutes.js`:

| Method | Endpoint | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| GET | `/api/minutes/projects` | anon | รายการโครงการ + จำนวนบันทึกที่ผู้เรียกเห็นได้ (`count`) |
| POST | `/api/minutes/projects` | admin | สร้างโครงการใหม่ (tag-only bucket ไม่มี Doc) |
| PATCH | `/api/minutes/projects/:id` | admin | เปลี่ยนชื่อ/สี/cadence โครงการ |
| DELETE | `/api/minutes/projects/:id` | admin | ลบโครงการ (ปฏิเสธถ้าเป็น builtin หรือยังมีบันทึกอยู่) |
| GET | `/api/minutes/projects/:id/access` | editor\|admin | guest list ของโครงการ |
| PUT | `/api/minutes/projects/:id/visibility` | admin | เปิด/ล็อกโครงการ (unlock จะ publish ทุกบันทึกในนั้น) |
| POST | `/api/minutes/projects/:id/guests` | admin | เพิ่มผู้เยี่ยมชม (รองรับวางหลายรายการ) |
| DELETE | `/api/minutes/projects/:id/guests/:email` | admin | ลบผู้เยี่ยมชม |
| GET | `/api/minutes/meetings[?projectId=]` | anon | รายการบันทึก (กรองตาม tier อัตโนมัติ) |
| GET | `/api/minutes/meetings/search?q=` | anon | ค้นหาเนื้อหาเต็ม คืนเฉพาะ id ที่ตรง |
| GET | `/api/minutes/meetings/:id` | anon | บันทึกเต็ม รวม HTML/ไฟล์แนบ/คอมเมนต์ |
| POST | `/api/minutes/meetings` | editor\|admin | สร้าง/แก้ไขบันทึก (สร้าง version snapshot ถ้าเป็นการแก้ไข) |
| PUT | `/api/minutes/meetings/:id/content` | editor\|admin | แก้ไขเนื้อหา (จาก rich editor) พร้อม snapshot ก่อนแก้ |
| PUT | `/api/minutes/meetings/:id/pin` | admin | toggle การ pin |
| PUT | `/api/minutes/meetings/:id/visibility` | admin | เผยแพร่/ซ่อนบันทึก |
| DELETE | `/api/minutes/meetings/:id` | editor\|admin | ลบบันทึก |
| POST | `/api/minutes/meetings/:id/tags` | editor\|admin | แท็ก inbox recording เข้าโครงการ |
| DELETE | `/api/minutes/meetings/:id/tags/:projectId` | editor\|admin | ลบแท็กเดียว |
| GET | `/api/minutes/meetings/:id/attachments/upload-url` | editor\|admin | ขอ presigned URL อัปโหลด |
| POST | `/api/minutes/meetings/:id/attachments` | editor\|admin | บันทึก metadata ไฟล์แนบ |
| DELETE | `/api/minutes/meetings/:id/attachments/:fileId` | editor\|admin | ลบไฟล์แนบ |
| POST | `/api/minutes/meetings/:id/comments` | signed-in + อ่านได้ | โพสต์คอมเมนต์ |
| DELETE | `/api/minutes/meetings/:id/comments/:commentId` | เจ้าของ\|admin | ลบคอมเมนต์ |
| GET | `/api/minutes/meetings/:id/versions` | admin | รายการ snapshot |
| GET | `/api/minutes/meetings/:id/versions/:seq` | admin | เนื้อหาเวอร์ชันหนึ่ง (`current`/`original`/เลข) |
| DELETE | `/api/minutes/meetings/:id/versions/:seq` | admin | ลบ snapshot เดี่ยว |
| GET | `/api/minutes/meetings/:id/audit` | admin | audit log ของบันทึกนี้ |
| DELETE | `/api/minutes/meetings/:id/audit/:entryId` | admin | ลบ audit entry เดี่ยว |
| DELETE | `/api/minutes/meetings/:id/audit` | admin | ล้าง audit log ทั้งหมดของบันทึกนี้ |
| GET | `/api/minutes/audit[?limit=]` | admin | audit log ทั้งระบบ (**ยังไม่มี UI เรียกใช้**) |
| GET | `/api/minutes/fathom-raw-log[?limit&recordingId]` | admin | payload ดิบจาก Fathom webhook (debug เท่านั้น) |

**หมายเหตุ:** ไม่มี endpoint สำหรับ "นำเข้า" (import) ใด ๆ ในระบบนี้โดยเจตนา — ตามกฎข้อแรกของ `PORT_NOTES.md`

**รูปร่างข้อมูลสำคัญที่ endpoint คืนกลับ:**
- **รายการโครงการ:** `{ id, name, nameEn, cadence, color, count, canSee, builtin, isPublic, docId }` —
  `docId` ไม่ว่างเฉพาะแอดมินเท่านั้น และเฉพาะแถวยุค Doc
- **บันทึกเต็ม:** `{ id, projectId, projectName, title, kind, date, dateLabel, time, pinned, visible,
  taggedProjectIds, fathomUrl, source, attendees, html, css, docUrl (ว่างเสมอ), createdAt, updatedAt,
  attachments, comments }`
- **หนึ่ง version:** `{ html, title, dateLabel, time }` — ตามที่เป็น ณ ขณะ snapshot
- **รายการ version:** `[{ seq, takenAt, takenBy }]` เรียงใหม่ก่อน

**การแคชฝั่ง client (`MinutesData.jsx`):**
- รายการบันทึก (metadata เท่านั้น ไม่มี body HTML) แคชใน `localStorage` (`vcb_mm_meetings_cache`) เพื่อให้ reload
  แล้ว paint ได้ทันที — **ล้างทิ้งทุกครั้งที่ sign-out** (บันทึกของโครงการ locked ต้องไม่ค้างอยู่บนเครื่องที่ใช้ร่วมกัน)
- บันทึกเต็ม (พร้อม HTML) แคชใน **memory เท่านั้น** (ผ่าน `useRef`) ไม่เก็บลง localStorage เลย เหตุผลเดียวกัน —
  ล้าง cache ทุกครั้งที่ identity เปลี่ยน (sign-in/out) เพราะ API คืนผลลัพธ์ต่างกันตาม identity
- **Prefetch:** เมื่อ boot จะ prefetch บันทึกล่าสุดของแต่ละโครงการแบบเงียบ ๆ (fire-and-forget) เพื่อให้เปิด
  project tab ครั้งแรกไม่ต้อง round-trip ที่สอง — ความล้มเหลวจะไม่แสดง error เพราะเป็น request ที่ผู้ใช้ไม่ได้ขอเอง

---

## 4. การ Render เอกสารแบบ Page-Accurate (Paged.js) — สรุปจาก `PAGINATION.md`

หมายเหตุ: ส่วนนี้เป็นสถาปัตยกรรมของแอป **Google Apps Script ต้นฉบับ** เป็นหลัก — คัดลอกมาไว้เพื่อให้กฎเรื่อง
geometry เดินทางไปกับ React mirror นี้ด้วย **React mirror ปัจจุบันไม่ได้ render Paged.js iframe** ส่วนที่ runtime
จริง (scroll container, สอง document mode, scaler) อธิบายเฉพาะแอป GAS เท่านั้น — สิ่งที่ **ใช้จริงกับ React app นี้
คือ page geometry และ responsive column band**

**ปัญหาหลัก:** เบราว์เซอร์แบ่งหน้าเอกสารเฉพาะตอน**พิมพ์**เท่านั้น (CSS Paged Media engine) ผลลัพธ์ไม่ expose ให้
JavaScript เห็น — คำนวณ page break เองด้วยความสูงอย่างเดียวจะผิด เพราะไม่นับ `orphans`/`widows`/
`break-after: avoid` (เช่น heading ที่ไม่ควรอยู่ท้ายหน้าโดดเดี่ยว)

**ทางแก้:** ใช้ **Paged.js** (polyfill ของ CSS Paged Media spec) รันจริงในเบราว์เซอร์ที่หน้าจอ preview เพื่อให้ขอบเขต
หน้าที่เห็นบนจอ**ตรงกับ**ขอบเขตที่ PDF จะมี

**Geometry ปัจจุบัน (ตายตัว ห้ามเปลี่ยนแบบสุ่ม):**

| รายการ | ค่า | อยู่ที่ |
|---|---|---|
| ขนาดกระดาษ | A4, 210×297mm = 794×1123px | `@page{size:A4}` ใน `OVERRIDE_CSS` |
| ระยะขอบหน้า | บน 2.7cm, ข้าง 17mm, ล่าง 2cm | `@page{margin:2.7cm 17mm 2cm}` |
| คอลัมน์ข้อความ | 665px | คำนวณจาก `@page` เท่านั้น ไม่ใช่ `body` |
| ความสูงใช้งานได้ | 945px/หน้า | |
| ตัวอักษรเนื้อหา | 15px / line-height 1.55 ฟอนต์ Sarabun | `OVERRIDE_CSS` |
| กล่องหน้า (page box) | 860px | `.paper`, `DOC_VIRTUAL_W` |

**กฎที่ห้ามฝ่าฝืน (สรุปสั้น):**
1. **`@page` ต้องประกาศ `size` และ margin ทั้งสี่ด้านชัดเจนเสมอ** — ถ้าไม่ระบุ `size` เอ็นจิ้นสองตัว (Paged.js
   บนจอ vs. Chrome ตอนพิมพ์) จะเลือกขนาดกระดาษต่างกัน (บั๊กจริงเมื่อ 2026-08-19: หน้า PDF จุเนื้อหาได้มากกว่าหน้าจอ
   ~68px ทำให้ item เลื่อนไปหน้าก่อนหน้า)
2. **Geometry (padding, margin ของหน้า) ต้องอยู่บน `@page` เท่านั้น ห้ามอยู่บน `body`** — เพราะ Paged.js กับ Chrome
   apply padding ของ `body` คนละตำแหน่งกัน (ในกล่อง page-margin vs. ในกล่อง page) ทำให้คอลัมน์ข้อความกว้างไม่เท่ากัน
3. หน้าจอ (screen) และหน้าพิมพ์ (print) **ต้อง render เอกสารเดียวกันทุกประการ** — ความต่างใด ๆ จะเลื่อน page break
   ทุกจุดหลังจากนั้น
4. Editor คำนวณ page break จาก**เอ็นจิ้นเดียวกับที่ผลิต PDF จริง** (paginate เอกสารเดียวกันใน hidden iframe แล้ว
   ถาม Paged.js ว่า block ไหนเริ่มแต่ละหน้า) — editor เอง**ไม่คำนวณอะไรเลย** เพียงสะท้อนการตัดสินใจของเอ็นจิ้นเท่านั้น
5. `orphans`/`widows` ตั้งที่ **3** ไม่ใช่ค่า default ของ CSS (2) เพราะที่ 2 ย่อหน้า 4 บรรทัดอาจถูกแบ่ง 2+2 ได้ และ
   Chrome เลือกตัวเลือกนั้นในขณะที่ Paged.js ไม่เลือก

**ข้อจำกัดที่ทราบอยู่แล้วและยอมรับ:** ความแม่นยำอยู่ที่ ~99.7% (1077/1080 block จาก 24 เอกสารทดสอบ) — block ที่ความสูง
อยู่ใกล้ขอบหน้าพอดีอาจต่างกันได้เล็กน้อยเพราะ rounding ภายในเอ็นจิ้น ไม่ใช่ปัญหาจาก stylesheet — ได้ลองปรับ margin/
line-height/break-inside/content-box sizing มาแล้ว 4 วิธีแต่ไม่สำเร็จ **ไม่ควรพยายามไล่แก้ปัญหานี้ด้วยการปรับตัวเลข**

---

## 5. ข้อจำกัดหรือสิ่งที่ยังไม่รองรับ (สรุปจาก `PORT_NOTES.md`)

1. **ไม่มี presigned-upload route สำหรับไฟล์แนบ** — ตาม `PORT_NOTES.md` ระบุว่าเป็น gap สำคัญที่สุด แต่จากการตรวจ
   source ปัจจุบัน (`api/src/routes/minutes.js` บรรทัด 1051-1084) พบว่า route `GET
   /meetings/:id/attachment-url` ได้ถูกเพิ่มเข้ามาแล้วในชื่อ `GET /meetings/:id/attachments/upload-url` — ควร
   ยืนยันกับทีมพัฒนาว่าเอกสารนี้ตามทันสถานะจริงหรือไม่ก่อนถือเป็นข้อจำกัด
2. **ไม่มีปุ่ม "อนุญาตทั้งโดเมน @vcb-con.com"** สำหรับโครงการ — schema ใหม่ไม่มีคอลัมน์รองรับ ห้ามจำลองด้วยการเพิ่ม
   อีเมลพนักงานทุกคนทีละคน (จะไม่ตามพนักงานใหม่ และผิดเจตนาของแอดมินอย่างเงียบ ๆ)
3. **ไม่มีปุ่ม "คัดลอก guest list ไปโครงการอื่น"** (`copyProjectViewers`) — ควรเพิ่มกลับเพราะเป็น endpoint เดียว
   เหนือ guest table ที่มีอยู่แล้ว
4. **การดึง project access เป็นแบบต่อโครงการเท่านั้น** — ยังไม่มี bulk endpoint ปัจจุบันเรียกแบบขนานทีละโครงการ
   ใช้ได้ที่จำนวนโครงการระดับหนึ่ง แต่จะต้องมี list endpoint ก่อนจำนวนโครงการขึ้นถึงหลักสิบ
5. **audit log ไม่มี field `versionSeq`** — ปุ่ม "View" ใน Edit History เดิมพยายามอ่านจาก field นี้ แต่ API ใหม่
   ไม่เคย emit ค่านี้ ดังนั้นจึงอ่าน `/versions` โดยตรงแทน (แก้ไขแล้ว ไม่ใช่ปัญหาเปิดอยู่)
6. **ไม่มีระบบ Editor sign-in/PIN ของโมดูลเอง** — ทั้งหมดถูกแทนที่ด้วยระบบ identity ของ portal กลาง
   (`api/src/auth.js`) — ตัวเลือก sign-in, PIN รายบุคคล, shared PIN, บังคับเปลี่ยน PIN ครั้งแรก ถูกลบออกทั้งหมด
7. **การอ่านต้องคง anonymous เสมอ** — ห้ามเพิ่ม `RequireRole` รอบ read route โดยเด็ดขาด มิเช่นนั้นจะเป็นการถดถอย
   (regression) จากพฤติกรรมเดิมที่ deploy แบบ `ANYONE_ANONYMOUS`
8. **ไม่มี Google Doc import/export ใด ๆ** — เป็นกฎข้อแรกสุดของการพอร์ต ห้ามเพิ่มกลับมาโดยเด็ดขาด
9. **การพิมพ์แบบ hidden-iframe measuring pass ของ editor เดิม** — ถูกแทนที่ด้วย Paged.js อย่างถูกต้องแล้ว (ไม่ใช่
   ข้อจำกัดที่เหลืออยู่ แต่ระบุไว้ใน `PORT_NOTES.md` ว่ายังไม่ได้พอร์ต 1:1 ในความหมายเดิม)
10. **ไม่มี entity "Action Item" แยกต่างหาก** — งานที่ต้องติดตามอยู่ในเนื้อหา HTML ของบันทึกเอง (bullet/tick list)
    ไม่มีตาราง/API แยกสำหรับติดตามสถานะ action item เป็นรายการอิสระ
11. **หน้าจอ Site-wide audit log** (`GET /api/minutes/audit`) และ **Fathom raw log** (`GET
    /api/minutes/fathom-raw-log`) **มี wrapper client พร้อมแล้วแต่ยังไม่มี UI เรียกใช้** — เป็น debugging surface
    สำหรับแอดมินที่ต้องเรียกจาก console เท่านั้น
