-- Which functions are performed AT THE SITE rather than at head office.
--
-- The upstream data carries this as a separate set of function codes, and the
-- registry both badges those rows and offers a "site only" filter over them.
-- The first import dropped it; without the column the filter has nothing to
-- work from.
alter table sysmap_functions
  add column if not exists at_site boolean not null default false;
create index if not exists sysmap_functions_site_idx on sysmap_functions (at_site) where at_site;
