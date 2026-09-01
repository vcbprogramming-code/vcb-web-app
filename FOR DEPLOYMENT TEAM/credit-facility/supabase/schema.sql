-- VCB Credit Facility — Supabase schema
--
-- Mirrors the nine tabs of the live "VCB Credit Facility Master" Google Sheet
-- (SHEET_HEADERS in ../../ORIGINAL CODE/Code.js). Column names are snake_cased;
-- the mapping back to the sheet header is noted where it is not obvious.
--
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db push`).
--
-- SECURITY MODEL — read this before deploying.
-- The Apps Script app identifies users via Session.getActiveUser().getEmail()
-- and grants write rights to a hardcoded MANAGERS allowlist (whoAmI() in
-- Code.js). Google does that identification for free inside the /exec iframe.
-- A standalone SPA has no such thing: the anon key ships in the browser bundle,
-- so anyone who opens DevTools has it. Therefore this schema does NOT grant
-- blanket write access to anon. Writes require an authenticated Supabase user
-- whose email is present in public.managers. Set up Supabase Auth (Google
-- provider, restricted to your workspace domain) before putting real data in.

-- ---------------------------------------------------------------- identity --

-- Replaces the MANAGERS array in Code.js. Seed it with the same addresses.
create table if not exists public.managers (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.managers enable row level security;

create policy "managers list is readable by signed-in users" on public.managers
  for select to authenticated using (true);
-- No write policy: manage this list from the Supabase dashboard, not the app.

-- True when the caller is signed in AND on the managers list. Used by every
-- write policy below, so the rule lives in one place.
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.managers m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_manager() to authenticated;

-- ------------------------------------------------------------------ tables --

-- Sheet tab: Facilities — Project | FacilityNo | Type | Limit | Used | Interest | Notes
-- `used` is derived from transactions in the live app and only pinned via
-- Limits.UsedOverride, so it is deliberately NOT stored here; see the
-- facility_used view at the bottom.
create table if not exists public.facilities (
  project     text not null,
  facility_no text not null,
  type        text,
  limit_amt   numeric(18,2),           -- sheet: Limit ("limit" is reserved)
  interest    numeric(9,4),
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (project, facility_no)
);

-- Sheet tab: Transactions
create table if not exists public.transactions (
  id            text primary key,       -- sheet keeps its own ID; preserved on import
  txn_date      date,                   -- sheet: Date
  project       text not null,
  facility_no   text,
  kind          text,
  ref           text,
  description   text,
  start_date    date,
  due_date      date,
  amount        numeric(18,2),
  status        text,
  created_by    text,                   -- sheet: By
  paid_date     date,
  note          text,
  source        text,
  doc_from      text,
  doc_to        text,
  cost_category text,
  purpose       text,
  beneficiary   text,
  ref_doc_from  text,
  ref_doc_to    text,
  updated_at    timestamptz not null default now(),
  foreign key (project, facility_no) references public.facilities(project, facility_no)
);

create index if not exists transactions_project_idx  on public.transactions(project);
create index if not exists transactions_facility_idx on public.transactions(project, facility_no);
create index if not exists transactions_due_idx      on public.transactions(due_date);

-- Sheet tab: Requests
create table if not exists public.requests (
  id           text primary key,
  req_date     date,                    -- sheet: Date
  project      text not null,
  company      text,
  facility_no  text,
  amount       numeric(18,2),
  purpose      text,
  beneficiary  text,
  status       text,
  requester    text,
  decided_by   text,
  decided_at   timestamptz,
  note         text,
  maturity     date,
  linked_txn   text references public.transactions(id),
  source       text,
  doc_from     text,
  doc_to       text,
  updated_at   timestamptz not null default now()
);

create index if not exists requests_project_idx on public.requests(project);
create index if not exists requests_status_idx  on public.requests(status);

-- Sheet tab: Limits — per-facility limit, plus the optional manual Used pin.
-- used_override NULL = auto-calc from transactions (the default).
create table if not exists public.limits (
  project       text not null,
  facility_no   text not null,
  limit_amt     numeric(18,2),
  used_override numeric(18,2),
  updated_at    timestamptz not null default now(),
  primary key (project, facility_no)
);

-- Sheet tab: CategoryCaps — per-(project, category) budget cap.
create table if not exists public.category_caps (
  project       text not null,
  cost_category text not null,
  cap           numeric(18,2),
  note          text,
  updated_at    timestamptz not null default now(),
  primary key (project, cost_category)
);

-- Sheet tab: CostCategories — user-editable master list; order drives display.
create table if not exists public.cost_categories (
  name        text primary key,
  sort_order  int,                      -- sheet: Order
  updated_at  timestamptz not null default now()
);

-- Sheet tab: CashPlan — one row per (project, month, period).
-- The JSON-ish columns stay jsonb rather than being normalised, because the
-- client reads and writes them as whole values (PaidIds, IncomeBreak,
-- Deductions, ExtraRows are all JSON arrays/objects in the sheet today).
create table if not exists public.cash_plan (
  id             text primary key,
  project        text not null,
  month          text not null,
  period_idx     int  not null,
  period_label   text,
  period_date    date,
  period_type    text,
  income         numeric(18,2),
  work_ref       text,
  paid_ids       jsonb  not null default '[]'::jsonb,
  new_pn_amount  numeric(18,2),
  new_pn_note    text,
  note           text,
  deductions     jsonb  not null default '[]'::jsonb,
  income_break   jsonb  not null default '[]'::jsonb,
  aval_amount    numeric(18,2),
  show_all_due   boolean not null default false,
  -- 'plan' = forecast, 'actual' = recorded real T-bar. Blank rows in the sheet
  -- were treated as 'plan', so that is the default here.
  variant        text not null default 'plan' check (variant in ('plan','actual')),
  extra_rows     jsonb  not null default '[]'::jsonb,
  updated_at     timestamptz not null default now(),
  unique (project, month, period_idx, variant)
);

create index if not exists cash_plan_project_month_idx on public.cash_plan(project, month);

-- Sheet tab: Audit — append-only. Mirrors audit_() in Code.js.
create table if not exists public.audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),   -- sheet: Timestamp
  actor      text,                                  -- sheet: User
  action     text,
  target     text,
  target_id  text,
  changes    jsonb,
  note       text
);

create index if not exists audit_at_idx on public.audit(at desc);

-- ------------------------------------------------------------------ views ---

-- `Used` was never a stored column in practice — the live app derives it from
-- transactions unless Limits.UsedOverride pins it. Same rule, in SQL, so the
-- client cannot drift from the calculation.
create or replace view public.facility_used as
  select
    f.project,
    f.facility_no,
    f.limit_amt,
    coalesce(
      l.used_override,
      (select coalesce(sum(t.amount), 0)
         from public.transactions t
        where t.project = f.project
          and t.facility_no = f.facility_no
          and coalesce(t.status, '') <> 'Paid')
    ) as used
  from public.facilities f
  left join public.limits l
    on l.project = f.project and l.facility_no = f.facility_no;

-- ------------------------------------------------------- row level security --

alter table public.facilities      enable row level security;
alter table public.transactions    enable row level security;
alter table public.requests        enable row level security;
alter table public.limits          enable row level security;
alter table public.category_caps   enable row level security;
alter table public.cost_categories enable row level security;
alter table public.cash_plan       enable row level security;
alter table public.audit           enable row level security;

-- Reads: any signed-in user. This is company financial data — it is NOT open
-- to anon, unlike the Onboarding schema's checklist content.
do $$
declare t text;
begin
  foreach t in array array['facilities','transactions','requests','limits',
                           'category_caps','cost_categories','cash_plan','audit']
  loop
    execute format(
      'create policy "%1$s readable by signed-in users" on public.%1$I
         for select to authenticated using (true)', t);
  end loop;
end $$;

-- Writes: managers only, enforced in the database rather than the UI. The
-- Apps Script app checked MANAGERS server-side; this is the equivalent that a
-- browser client cannot skip.
do $$
declare t text;
begin
  foreach t in array array['facilities','transactions','requests','limits',
                           'category_caps','cost_categories','cash_plan']
  loop
    execute format(
      'create policy "%1$s writable by managers" on public.%1$I
         for all to authenticated
         using (public.is_manager()) with check (public.is_manager())', t);
  end loop;
end $$;

-- Audit is append-only: managers may insert, nobody may update or delete.
create policy "audit insertable by managers" on public.audit
  for insert to authenticated with check (public.is_manager());

-- ------------------------------------------------------------------ seeding --
--
-- After running this file:
--   1. insert into public.managers (email) values ('someone@vcb-con.com'), …;
--      (use the same addresses as the MANAGERS array in Code.js)
--   2. Enable Supabase Auth → Google provider, and restrict sign-ups to your
--      workspace domain.
--   3. Import the existing sheet data — see MIGRATION.md in this folder.
