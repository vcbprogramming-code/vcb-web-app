-- §1 five named roles, and §11 evidence attached to a day's work.
--
-- The criteria name five levels: site recorder, project verifier, HR centre,
-- executive (view only) and system admin. Three existed. The two new ones are
-- real roles rather than permission presets so an administrator can see at a
-- glance who is what — the finer control stays in the per-user permissions.
alter type user_role add value if not exists 'recorder';
alter type user_role add value if not exists 'verifier';

-- §11 a photo of the work, or the note the foreman was handed. Stored in the
-- same object store as everything else; the row here is what makes it findable.
create table if not exists work_log_attachments (
  id          uuid primary key default gen_random_uuid(),
  work_log_id uuid references work_logs(id) on delete cascade,
  unit_id     uuid references units(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  ymd         date,
  file_name   text not null,
  content_type text,
  size_bytes  bigint,
  storage_key text not null,
  uploaded_by uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists work_log_att_scope_idx on work_log_attachments (unit_id, ymd);
create index if not exists work_log_att_log_idx on work_log_attachments (work_log_id);
