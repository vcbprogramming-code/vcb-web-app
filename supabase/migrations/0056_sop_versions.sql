-- ═══════════════════════════════════════════════════════════════════════════
-- ประวัติเวอร์ชันของ SOP
--
-- เอกสารข้อกำหนดฟังก์ชัน §2.7/§4.5 ระบุว่าทุกครั้งที่แก้ไข ระบบจะเก็บ snapshot
-- ของเอกสารทั้งฉบับไว้ก่อนเขียนทับ และกู้คืนได้ทุกเวอร์ชัน — การกู้คืนเองก็นับ
-- เป็นการแก้ไขครั้งหนึ่ง จึงถูก snapshot ไว้ด้วย แปลว่าย้อนกลับได้เสมอ
--
-- ของเขาเก็บ SOP เป็น JSON ก้อนเดียว จึงใช้ database trigger ดักก่อน update ได้
-- ของเราแยกเป็นเจ็ดตาราง (scenarios · steps · modules · reports · flows · meta)
-- trigger รายตารางจะได้ snapshot กระจัดกระจายคนละครึ่งใบ — เก็บเป็นภาพรวมทั้ง
-- เอกสารก่อนแก้แต่ละครั้งแทน โดยมีชุดทดสอบยืนยันว่าทุกเส้นทางที่เขียนข้อมูล
-- สร้างเวอร์ชันไว้จริง ทำหน้าที่แทนสิ่งที่ trigger รับประกันให้ในแบบของเขา
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists sop_versions (
  id          bigint generated always as identity primary key,
  data        jsonb not null,               -- เอกสารทั้งฉบับก่อนการแก้ไขครั้งนี้
  note        text,                         -- ทำอะไรถึงเกิด snapshot นี้
  taken_by    uuid references profiles(id) on delete set null,
  taken_at    timestamptz not null default now()
);

create index if not exists sop_versions_taken_at_idx on sop_versions (taken_at desc);

comment on table sop_versions is
  'snapshot ของเอกสาร SOP ทั้งฉบับ เก็บก่อนการแก้ไขทุกครั้ง · กู้คืนได้และการกู้คืนก็ถูก snapshot';
