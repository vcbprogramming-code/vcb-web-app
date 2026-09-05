-- ═══════════════════════════════════════════════════════════════════════════
-- ปฐมนิเทศพนักงานใหม่ 90 วัน — ตามโปรแกรมจริงของลูกค้า
--
-- ของเดิมในระบบเราเป็นเครื่องมือฝั่ง HR (คลังเอกสาร · แม่แบบแผน · การติดตาม)
-- ส่วนของลูกค้าเป็น "โปรแกรมที่พนักงานใหม่เดินเอง" — คนละผลิตภัณฑ์กัน ไม่ใช่
-- ส่วนที่ขาดไปของอันเดิม เอกสารข้อกำหนดฟังก์ชันบรรยายไว้ทั้งฉบับ:
--   5 แผนก × 3 เฟส (วันที่ 1-30 / 31-60 / 61-90) × 3 บล็อก = 180 รายการ
--   เอกสารที่ต้องส่งก่อนวันแรกทำงาน 8 รายการ
--
-- ต่างจากของลูกค้าหนึ่งข้อตามที่ตกลงกัน: ของเขาเปิดให้พนักงานใหม่ที่ยังไม่มี
-- บัญชีเข้าใช้โดยไม่ต้องล็อกอิน ของเราทุกหน้าอยู่หลังบัญชีเดียวกัน พนักงานใหม่
-- จึงต้องมีบัญชีก่อน (สร้างล่วงหน้าให้ได้จากหน้าผู้ใช้เดิม)
--
-- id ของรายการเช็กลิสต์เป็นข้อความถาวรที่ตั้งไว้ตอนเขียนเนื้อหา (เช่น
-- 'acct-p1-read-1') ไม่ใช่ลำดับในอาเรย์ — ความคืบหน้าของพนักงานผูกกับ id นี้
-- การสลับลำดับ แทรก หรือลบรายการในหน้าผู้ดูแลจึงย้ายเครื่องหมายถูกของใครไม่ได้
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ob_departments (
  slug       text primary key,
  name       text not null,
  name_th    text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

create table if not exists ob_phases (
  id         text primary key,             -- 'accounting-day-1-30'
  dept_slug  text not null references ob_departments(slug) on delete cascade,
  day_range  text not null,                -- '1-30'
  eyebrow    text,
  title      text not null,
  closing    text,                         -- ข้อความปิดท้ายของเฟสสุดท้าย
  next_phase text,                         -- id ของเฟสถัดไป ถ้ามี
  sort_order int not null default 0
);

create table if not exists ob_blocks (
  id         bigint generated always as identity primary key,
  phase_id   text not null references ob_phases(id) on delete cascade,
  heading    text not null,                -- Required Reading / Knowledge / Outputs
  sort_order int not null default 0,
  unique (phase_id, sort_order)
);

create table if not exists ob_items (
  id         text primary key,             -- id ถาวรจากต้นฉบับ ห้ามนำกลับมาใช้ซ้ำ
  block_id   bigint not null references ob_blocks(id) on delete cascade,
  text       text not null,
  level      text not null default 'junior' check (level in ('junior', 'senior')),
  sort_order int not null default 0,
  is_active  boolean not null default true -- ผู้ดูแลปิดรายการได้ แต่ไม่ลบ เพราะมีคนติ๊กไว้แล้ว
);
create index if not exists ob_items_block_idx on ob_items (block_id, sort_order);

create table if not exists ob_documents (
  id         text primary key,
  title      text not null,
  descr      text,
  action     text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

-- ── ผู้เข้าโปรแกรมและความคืบหน้า ──────────────────────────────────────────
-- ผูกกับบัญชีผู้ใช้จริง ไม่ใช่ชื่อที่พิมพ์เอง เพราะระบบเราอยู่หลังล็อกอินอยู่แล้ว
create table if not exists ob_enrollments (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  dept_slug   text references ob_departments(slug) on delete set null,
  track       text not null default 'junior' check (track in ('junior', 'senior')),
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists ob_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  item_id    text not null references ob_items(id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (profile_id, item_id)
);

create table if not exists ob_doc_submissions (
  profile_id  uuid not null references profiles(id) on delete cascade,
  doc_id      text not null references ob_documents(id) on delete cascade,
  file_name   text,
  storage_key text,
  note        text,
  submitted_at timestamptz not null default now(),
  primary key (profile_id, doc_id)
);

comment on table ob_items is
  'รายการเช็กลิสต์ · id เป็นข้อความถาวรจากเนื้อหาต้นฉบับ ความคืบหน้าผูกกับ id นี้ ห้ามนำ id กลับมาใช้ซ้ำ';
