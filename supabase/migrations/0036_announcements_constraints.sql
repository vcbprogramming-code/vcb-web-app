-- Harden the announcements table added in 0035:
--  • keep updated_at fresh on every write (the codebase's set_updated_at trigger),
--    not just on the one route that sets it by hand
--  • constrain `level` and `title` at the DB level so non-API writers can't store
--    values the UI can't render
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_announcements_updated_at') then
    create trigger trg_announcements_updated_at
      before update on announcements
      for each row execute function set_updated_at();
  end if;
end $$;

alter table announcements drop constraint if exists announcements_level_chk;
alter table announcements add constraint announcements_level_chk
  check (level in ('info', 'warning', 'success'));

alter table announcements drop constraint if exists announcements_title_chk;
alter table announcements add constraint announcements_title_chk
  check (char_length(title) between 1 and 200);
