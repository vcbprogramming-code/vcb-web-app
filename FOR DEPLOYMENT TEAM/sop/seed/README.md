# Seed payload for `sop.sop_document`

`sop-document.json` is the SOP tree — `{ meta, scenarios, reports }`, 31 cases
and 23 report rows — carried over from the React port's bundled data, which was
itself extracted from the live Apps Script app.

It is **not imported by the app any more.** The SPA reads everything from
`GET /api/sop`. This file exists solely because migration `006_sop.sql`
deliberately leaves the document row unseeded, and until somebody inserts it
every read answers `404 NOT_SEEDED`.

To seed:

```sql
insert into sop.sop_document (id, data)
values (1, '<contents of sop-document.json>'::jsonb)
on conflict (id) do nothing;
```

Two things to check before trusting it as the import:

1. **It may be stale.** It is a snapshot taken when the React port was built.
   If the live Apps Script app has been edited since, re-export instead:
   open `<exec-url>?diag=sopdata` and use that JSON.
2. **Strip nothing by hand.** `displayNo` may appear on some scenarios; the API
   recomputes it from row order on every read and never trusts a stored value,
   so leaving it in is harmless. `meta.isAdmin` / `meta.userEmail` must NOT be
   present — they are per-request session fields, and the mutation routes
   delete them on every write.
