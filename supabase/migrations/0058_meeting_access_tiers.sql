-- ═══════════════════════════════════════════════════════════════════════════
-- สิทธิ์การเข้าถึงรายงานการประชุมสามระดับ
--
-- เอกสารข้อกำหนดฟังก์ชัน §3.9: แต่ละกลุ่มการประชุมมีระดับการมองเห็น
--   public (🔓) เปิดให้อ่านได้
--   locked (🔒) อ่านได้เฉพาะผู้ดูแล ผู้แก้ไข และอีเมลที่ถูกระบุชื่อไว้
--   guest       ผู้อ่านที่ถูกระบุชื่อในกลุ่ม locked หนึ่งกลุ่ม อ่านได้เฉพาะกลุ่มนั้น
--
-- กลุ่มที่ล็อกต้อง "หายไปจากรายการ" ของคนที่ไม่มีสิทธิ์ ไม่ใช่แสดงชื่อแล้วกดไม่ได้
-- — การโชว์ชื่อกลุ่มที่เปิดไม่ได้ก็คือการรั่วอยู่แล้ว
--
-- ต่างจากระบบของลูกค้าหนึ่งข้อโดยตั้งใจ: ของเขาอ่านกลุ่ม public ได้โดยไม่ต้อง
-- ลงชื่อเข้าใช้ เพราะ Apps Script ระบุตัวผู้ใช้ไม่ได้เลย ระบบเราทุกโมดูลอยู่หลัง
-- บัญชีเดียวกันอยู่แล้ว "public" จึงหมายถึง "ผู้ใช้ที่ลงชื่อเข้าใช้แล้วทุกคน"
-- การเปิดให้อ่านโดยไม่ล็อกอินจะเป็นการถอยหลังด้านความปลอดภัยของทั้งระบบ
-- ═══════════════════════════════════════════════════════════════════════════

alter table mtg_groups add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'locked'));

create table if not exists mtg_group_guests (
  group_id   uuid not null references mtg_groups(id) on delete cascade,
  email      text not null,
  added_by   uuid references profiles(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (group_id, email)
);

-- ค้นด้วยอีเมลบ่อยกว่าค้นด้วยกลุ่ม เพราะทุกคำขออ่านต้องถามว่า "ฉันเข้าอะไรได้บ้าง"
create index if not exists mtg_group_guests_email_idx on mtg_group_guests (lower(email));

comment on column mtg_groups.visibility is
  'public = ผู้ใช้ที่ลงชื่อเข้าใช้แล้วอ่านได้ · locked = เฉพาะผู้ดูแล ผู้แก้ไข และผู้ที่ถูกระบุชื่อใน mtg_group_guests';
