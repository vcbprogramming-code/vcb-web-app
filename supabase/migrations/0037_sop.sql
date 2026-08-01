-- Module 5 — SOP (VCB-MANGO ERP standard operating procedures).
-- Adapted from the client's export (DATABASE_SCHEMA.sql): every table is
-- prefixed `sop_` so generic names (modules/reports) can't collide with ours,
-- their `admins` allow-list is dropped (we use the app's own role/permission
-- system instead), and `sort_order` is added so cases can be reordered without
-- rewriting their identity (`no` stays an immutable key).

create table if not exists sop_modules (
  code           text primary key,           -- 'PO', 'IC', …
  name_th_short  text not null,
  name_en_short  text not null,
  name_th        text,
  name_en        text,
  desc_th        text,
  desc_en        text,
  sort_order     integer not null default 0
);

create table if not exists sop_meta (
  id          boolean primary key default true check (id),  -- single row
  title       text not null,
  subtitle    text,
  manual      text,
  version     text,
  effective   text,
  scope       text,
  purpose     text,
  notes       text[] not null default '{}',
  updated_at  timestamptz default now()
);

-- case studies: "when X happens, do Y"
create table if not exists sop_scenarios (
  no          integer primary key,            -- stable id from the source export
  module      text not null references sop_modules(code),
  display_no  text,                           -- e.g. 'PO-3' (derived; kept for reference)
  sort_order  integer not null default 0,     -- ordering within the module (swap to reorder)
  title_th    text not null,
  title_en    text,
  problem     text not null default '',
  ref         text,
  note        text,
  date_added  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ordered solution steps; is_substep renders as an indented "»" bullet
create table if not exists sop_scenario_steps (
  scenario_no  integer not null references sop_scenarios(no) on delete cascade,
  step_order   integer not null,
  is_substep   boolean not null default false,
  text         text not null,
  primary key (scenario_no, step_order)
);

-- extra modules a case is tagged into (it still numbers from its primary module)
create table if not exists sop_scenario_modules (
  scenario_no  integer not null references sop_scenarios(no) on delete cascade,
  module       text not null references sop_modules(code),
  primary key (scenario_no, module)
);

-- "which menu do I pull this report from"
create table if not exists sop_reports (
  id             serial primary key,
  case_no        integer references sop_scenarios(no) on delete set null,
  scenario_text  text not null,
  report_path    text not null,
  sort_order     integer not null default 0
);

-- swimlane diagrams; lanes/nodes/edges are layout documents, read/written whole
create table if not exists sop_flows (
  id          text primary key,               -- e.g. 'BD-1.0'
  module      text not null references sop_modules(code),
  title_th    text not null,
  title_en    text,
  sort_order  integer not null default 0,
  lanes       jsonb not null default '[]',
  nodes       jsonb not null default '[]',
  edges       jsonb not null default '[]',
  narrative   text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

create index if not exists sop_scenarios_module_idx on sop_scenarios(module, sort_order);
create index if not exists sop_scenario_modules_module_idx on sop_scenario_modules(module);
create index if not exists sop_reports_case_idx on sop_reports(case_no);
create index if not exists sop_flows_module_idx on sop_flows(module, sort_order);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sop_scenarios_updated_at') then
    create trigger trg_sop_scenarios_updated_at before update on sop_scenarios
      for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_sop_flows_updated_at') then
    create trigger trg_sop_flows_updated_at before update on sop_flows
      for each row execute function set_updated_at();
  end if;
end $$;
