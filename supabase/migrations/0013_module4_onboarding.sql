-- =============================================================================
-- Migration 0013: Module 4 — Onboarding (90-day new-hire tracking)
-- =============================================================================

-- onboarding_resources — new-hire knowledge base (files in S3)
create table if not exists onboarding_resources (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  category           text not null default 'คู่มือ', -- นโยบาย|สวัสดิการ|คู่มือ|เอกสารลงนาม|สื่อแนะนำ
  description        text,
  link               text,
  storage_key        text,
  file_name          text,
  content_type       text,
  requires_signature boolean not null default false,
  sort_order         int not null default 0,
  is_active          boolean not null default true,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists onboarding_resources_cat_idx on onboarding_resources(category);

-- onboarding_plan_templates — reusable 30-60-90 task templates
create table if not exists onboarding_plan_templates (
  id          uuid primary key default gen_random_uuid(),
  phase       int not null default 30,         -- 30 | 60 | 90
  title       text not null,
  description text,
  owner       text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists onboarding_templates_phase_idx on onboarding_plan_templates(phase);

-- newhire_journeys — a new hire's 90-day journey (aggregate root)
create table if not exists newhire_journeys (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  employee_code text,
  position      text,
  unit_id       uuid references units(id) on delete set null,
  email         text,
  phone         text,
  start_date    date not null,
  status        text not null default 'active', -- active|completed|left
  -- probation review (flattened; scores as jsonb)
  review_reviewer     text,
  review_reviewed_at  timestamptz,
  review_scores       jsonb,
  review_strengths    text,
  review_improvements text,
  review_result       text,                     -- pass|extend|fail|null
  review_note         text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists newhire_journeys_unit_idx on newhire_journeys(unit_id);
create index if not exists newhire_journeys_status_idx on newhire_journeys(status);

-- newhire_journey_tasks — per-journey 30-60-90 tasks (tasks[] child table)
create table if not exists newhire_journey_tasks (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references newhire_journeys(id) on delete cascade,
  phase       int not null default 30,
  title       text not null,
  description text,
  owner       text,
  done        boolean not null default false,
  done_at     timestamptz,
  sort_order  int not null default 0
);
create index if not exists newhire_tasks_journey_idx on newhire_journey_tasks(journey_id);

create trigger trg_onboarding_resources_updated_at before update on onboarding_resources
  for each row execute function set_updated_at();
create trigger trg_onboarding_templates_updated_at before update on onboarding_plan_templates
  for each row execute function set_updated_at();
create trigger trg_newhire_journeys_updated_at before update on newhire_journeys
  for each row execute function set_updated_at();
