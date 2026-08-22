-- แผนผังระบบ (System Operating Map) — how the group actually works, as data.
--
-- The reference implementation carried all of this in TypeScript source files:
-- changing a lane meant a developer editing code and redeploying. The client
-- asked to maintain it themselves, so it lives in tables with an editing screen
-- over the top.
--
-- Everything here is new and self-contained (sysmap_*). No existing table is
-- touched, so E-Memo cannot be affected by any of it.
--
-- Bilingual by design: the source data already carries a Thai string for every
-- lane, node and registry row, and the map is read by people who work in Thai.
-- Rather than a translation layer, each row simply holds both texts — the *_th
-- columns fall back to the English when blank.

-- แผนก — the lanes and functions are grouped by these
create table if not exists sysmap_depts (
  key         text primary key,
  name_en     text not null,
  name_th     text not null default '',
  short       text not null default '',
  color       text not null default '#64748b',
  icon        text not null default '',
  sort_order  int  not null default 0
);

-- โมดูล ERP referenced by the nodes
create table if not exists sysmap_modules (
  code        text primary key,
  name        text not null,
  purpose     text not null default '',
  sort_order  int  not null default 0
);

-- เลน — the horizontal bands of the swimlane, in reading order
create table if not exists sysmap_lanes (
  id          text primary key,
  label_en    text not null,
  label_th    text not null default '',
  sort_order  int  not null default 0
);

-- กล่องงาน — one step of the process. `items` is the bullet list shown when the
-- box is opened; kept as jsonb because it is an ordered list of free text, not
-- a relation anyone will ever query across.
create table if not exists sysmap_nodes (
  id          text primary key,
  lane_id     text not null references sysmap_lanes(id) on delete cascade,
  node_type   text not null default 'manual',   -- erp | manual
  dept        text not null default '',
  dept2       text not null default '',
  standalone  boolean not null default false,
  at_site     boolean not null default false,   -- loc === 'site' upstream
  label_en    text not null,
  label_th    text not null default '',
  sub_en      text not null default '',
  sub_th      text not null default '',
  desc_en     text not null default '',
  desc_th     text not null default '',
  module      text not null default '',
  unverified  boolean not null default false,
  erp_style   text not null default '',
  erp_label   text not null default '',
  items_en    jsonb not null default '[]'::jsonb,
  items_th    jsonb not null default '[]'::jsonb,
  sort_order  int  not null default 0
);
create index if not exists sysmap_nodes_lane_idx on sysmap_nodes (lane_id, sort_order);

-- เส้นเชื่อม — how work moves between boxes. Both ends cascade: deleting a box
-- must not leave an edge pointing at nothing, which would draw a line to nowhere.
create table if not exists sysmap_conns (
  id          bigserial primary key,
  from_node   text not null references sysmap_nodes(id) on delete cascade,
  to_node     text not null references sysmap_nodes(id) on delete cascade,
  conn_type   text not null default 'feeds',    -- trigger | conditional | feeds | deferred
  label       text not null default '',
  feedback    boolean not null default false
);
create index if not exists sysmap_conns_from_idx on sysmap_conns (from_node);
create index if not exists sysmap_conns_to_idx   on sysmap_conns (to_node);
create unique index if not exists sysmap_conns_uniq
  on sysmap_conns (from_node, to_node, conn_type);

-- ทะเบียนฟังก์ชัน — every function a department performs, and whether the ERP
-- covers it. This is the list the client uses to argue about scope.
create table if not exists sysmap_functions (
  code        text primary key,
  dept        text not null default '',
  name_en     text not null,
  name_th     text not null default '',
  erp_type    text not null default '',
  module      text not null default '',
  notes_en    text not null default '',
  notes_th    text not null default '',
  external_entry boolean not null default false,
  sort_order  int  not null default 0
);
create index if not exists sysmap_functions_dept_idx on sysmap_functions (dept, sort_order);

-- โอกาสใช้ AI — where automation was judged to pay off, with how hard it is
create table if not exists sysmap_ai_opps (
  key         text primary key,
  title_en    text not null,
  title_th    text not null default '',
  impact      text not null default 'Medium',   -- High | Medium | Low
  effort      text not null default 'Medium',
  desc_en     text not null default '',
  desc_th     text not null default '',
  tool        text not null default '',
  sort_order  int  not null default 0
);
