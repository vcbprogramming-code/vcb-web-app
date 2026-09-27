-- ═══════════════════════════════════════════════════════════════════════════
-- รายงานการประชุม — ฟิลด์ที่ระบบจริงของลูกค้ามีแต่เรายังไม่มี (2026-09-27)
--
-- เทียบกับ Config.js ของเขา (COLUMNS) แถวหนึ่งของเขามี kind / dateLabel /
-- meetingKey ซึ่งของเราไม่มีเลย ทั้งสามคอลัมน์เพิ่มแบบมีค่าตั้งต้น จึงเข้ากันได้
-- กับโค้ดเดิมทุกบรรทัด (เซิร์ฟเวอร์ dev รัน migration กับฐานข้อมูลจริง —
-- ห้ามมี ALTER ที่โค้ดรุ่นก่อนรับไม่ได้)
-- ═══════════════════════════════════════════════════════════════════════════

-- kind — 'meeting' คือบันทึกการประชุมครั้งหนึ่ง 'overview' คือหน้าภาพรวมของ
-- โครงการที่ไม่ผูกกับวันประชุมวันใด ของเขาเรียงแถว overview ไว้ท้ายรายการเสมอ
-- (visibleMeetings ใน JavaScript.html) เพราะมันไม่มีวันที่ให้เรียง
alter table mtg_meetings
  add column if not exists kind text not null default 'meeting';

-- ข้อความวันที่ตามที่ผู้ใช้พิมพ์ ("21/05/2569", "21 พ.ค. 69") เก็บไว้เพราะ
-- meeting_date เป็น date จึงเก็บสิ่งที่พิมพ์ไม่ได้ และแถวที่แปลงวันที่ไม่ออก
-- จะไม่มีอะไรให้แสดงเลยถ้าไม่เก็บของเดิมไว้
alter table mtg_meetings
  add column if not exists date_label text not null default '';

-- คีย์กันนำเข้าซ้ำ: 'manual-<ts>' สำหรับที่คนสร้างเอง 'fathom-<recordingId>' /
-- 'transkriptor-<orderId>' สำหรับที่ดึงมา ของเขาเคยได้แถวซ้ำสี่แถวจากบันทึก
-- เดียวเพราะไม่มีคีย์นี้ (Code.js dedupeFathomInbox_) — เราใส่ตั้งแต่ต้น
alter table mtg_meetings
  add column if not exists meeting_key text;

-- null ได้หลายแถว แต่คีย์ที่มีค่าต้องไม่ซ้ำ นี่คือหลักประกันระดับฐานข้อมูล
-- ที่โค้ดนำเข้าในอนาคตต้องพึ่ง
create unique index if not exists mtg_meetings_key_idx
  on mtg_meetings (meeting_key) where meeting_key is not null;

create index if not exists mtg_meetings_kind_idx on mtg_meetings (kind);

comment on column mtg_meetings.kind is
  'meeting = บันทึกการประชุมหนึ่งครั้ง · overview = หน้าภาพรวมโครงการ (เรียงท้ายรายการเสมอ)';
comment on column mtg_meetings.date_label is
  'ข้อความวันที่ตามที่ผู้ใช้พิมพ์ ใช้แสดงเมื่อแปลงเป็นวันที่จริงไม่ได้';

-- ── ประวัติการทำงาน ────────────────────────────────────────────────────────
-- แผง Activity ของเขารวม "สิ่งที่เกิดกับเอกสาร" เข้ากับความเห็นในสายเวลาเดียว
-- ของเรามี mtg_versions (การแก้เนื้อหา) และ mtg_comments อยู่แล้ว แต่การกระทำ
-- ที่ไม่แตะเนื้อหา — ปักหมุด เผยแพร่ จัดเก็บเข้าโครงการ แนบไฟล์ — ไม่เคยถูก
-- บันทึกไว้ที่ไหน จึงหายไปจากสายเวลา
create table if not exists mtg_audit (
  id          bigserial primary key,
  meeting_id  uuid not null references mtg_meetings(id) on delete cascade,
  -- pin | unpin | publish | unpublish | tag | untag | attach | detach | move
  action      text not null,
  actor_id    uuid references profiles(id) on delete set null,
  -- สิ่งที่ต้องเล่าให้ครบ เช่น ชื่อกลุ่มปลายทาง ชื่อไฟล์ที่แนบ
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists mtg_audit_meeting_idx on mtg_audit (meeting_id, created_at);
