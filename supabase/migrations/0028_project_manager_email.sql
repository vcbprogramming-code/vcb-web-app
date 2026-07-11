-- #3: bind a project's manager to a real system account (email) so approval can
-- be auto-routed to that person. signatory_name stays the printed name; this is
-- the login/email used for the approval step.
alter table project_letterhead add column if not exists manager_email text;
