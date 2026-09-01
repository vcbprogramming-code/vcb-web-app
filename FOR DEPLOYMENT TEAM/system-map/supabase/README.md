# System Map — no database needed

There is deliberately no `schema.sql` here.

System Map stores nothing. Its Apps Script side is 13 lines whose only job is to
serve a self-contained HTML page (`doGet` → `Index.html`); there is no
`SpreadsheetApp`, no `PropertiesService`, no `DriveApp` anywhere in it. The map
content lives in the React source under `src/data/` and is compiled into the
bundle at build time.

So migrating this app off Apps Script needs no Supabase project, no auth and no
data import. It is a static site:

```sh
npm install
npm run build      # produces dist/
```

Deploy `dist/` to Vercel (or any static host) and point the portal tile at the
new URL. That is the whole migration.

If the map ever needs to be editable in the browser rather than in code, that is
the point to add a schema — one `jsonb` document plus an editors table would be
enough, the same shape as `../../../sop/FOR DEPLOYMENT TEAM/supabase/schema.sql`.
Until then, adding a database would be cost with no benefit.
