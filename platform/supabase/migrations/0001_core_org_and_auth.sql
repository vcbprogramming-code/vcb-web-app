-- =============================================================================
-- Migration 0001: Core organization model + auth profiles
-- HR Operations, E-Approval & Onboarding System — วิจิตรภัณฑ์ก่อสร้าง
--
-- Establishes the shared foundation all 4 modules depend on:
--   units (หน่วยงาน) -> departments (แผนก) -> positions (ตำแหน่ง) -> employees
--   profiles: links a Supabase auth user to a role + a business unit
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Roles
-- admin     : ผู้ดูแลระบบ — full access
-- executive : ผู้บริหาร — read-only overview across all units
-- hr        : HR รายหน่วยงาน — manage data within their own unit only
-- -----------------------------------------------------------------------------
create type user_role as enum ('admin', 'executive', 'hr');

-- -----------------------------------------------------------------------------
-- units — หน่วยงาน (5 business units)
-- -----------------------------------------------------------------------------
create table units (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- departments — แผนก (each belongs to one unit)
-- -----------------------------------------------------------------------------
create table departments (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (unit_id, name)
);

-- -----------------------------------------------------------------------------
-- positions — ตำแหน่ง (job titles, optionally scoped to a department)
-- -----------------------------------------------------------------------------
create table positions (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete set null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- employees — พนักงานรายบุคคล
-- An employee record may or may not have a login account (profile).
-- -----------------------------------------------------------------------------
create table employees (
  id            uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name     text not null,
  unit_id       uuid references units(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  position_id   uuid references positions(id) on delete set null,
  email         text,
  phone         text,
  start_date    date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index employees_unit_idx on employees(unit_id);
create index employees_department_idx on employees(department_id);

-- -----------------------------------------------------------------------------
-- profiles — links a Supabase auth.users row to an app role + unit.
-- One row per login account. unit_id is required for role 'hr'.
-- -----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'hr',
  unit_id     uuid references units(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_unit_idx on profiles(unit_id);

-- -----------------------------------------------------------------------------
-- updated_at auto-touch trigger
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['units','departments','positions','employees','profiles']
  loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s
         for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Helper functions for RLS — read the caller's role/unit from their profile.
-- SECURITY DEFINER so policies can call them without recursive RLS checks.
-- -----------------------------------------------------------------------------
create or replace function current_role_name()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_unit_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select unit_id from profiles where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- The Node.js API uses the service_role key and bypasses RLS, but we still
-- enable RLS so any direct client access stays safe (defence in depth).
-- -----------------------------------------------------------------------------
alter table units       enable row level security;
alter table departments enable row level security;
alter table positions   enable row level security;
alter table employees   enable row level security;
alter table profiles    enable row level security;

-- Everyone authenticated can read the org structure.
create policy "read units" on units for select to authenticated using (true);
create policy "read departments" on departments for select to authenticated using (true);
create policy "read positions" on positions for select to authenticated using (true);

-- Employees: admin/executive see all; hr sees only their own unit.
create policy "read employees" on employees for select to authenticated
  using (
    current_role_name() in ('admin','executive')
    or unit_id = current_unit_id()
  );

-- Profiles: a user can always read their own; admins read all.
create policy "read own profile" on profiles for select to authenticated
  using (id = auth.uid() or current_role_name() = 'admin');

-- Writes from clients are blocked by default (no insert/update/delete policies);
-- the API performs writes via the service_role key. Per-module write policies
-- can be added later if direct-client writes are ever needed.
