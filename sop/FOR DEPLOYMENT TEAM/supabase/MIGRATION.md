# SOP — moving off Apps Script

Status: **schema written, nothing connected.** The live app is still the Apps
Script one in `../../ORIGINAL CODE/apps-script/`. Nothing here touches it.

This is the **simplest migration of the seven** — there is no spreadsheet, and
the whole content is a single JSON document.

## What it looks like today

- The SOP tree is parsed from a Google Doc, `SOP_DOC_ID = 1emolyEx…HheJxo`.
- The parsed result is cached into ScriptProperties **in chunks** (`sopChunks`),
  because one property has a size limit and the document exceeds it.
- Every mutation also drops a timestamped JSON snapshot into a Drive folder.

Two of those three exist only to work around Apps Script limits. In Postgres:

- the chunking disappears — one `jsonb` column holds the document
- the Drive snapshots become `sop_versions` rows, written by a **trigger**, so
  history no longer depends on the client remembering to save one

## Steps

### 1. Create the Supabase project

Create a project, then in **SQL Editor** run `schema.sql` once.

### 2. Turn on authentication

- **Authentication → Providers → Google**: enable, restricted to your workspace
  domain.
- Seed the editors:

```sql
insert into public.sop_editors (email) values ('someone@vcb-con.com');
```

Note the asymmetry, which matches the live app: **reading requires no sign-in**
(the SOP is reference material every employee opens), while writing requires an
account on that list.

### 3. Seed the document

The live app can hand you its own JSON. Open:

```
<exec-url>?diag=sopdata
```

That is `getSopData()` serialised. Copy the whole response, then:

```sql
insert into public.sop_document (id, data) values (1, '<paste the json>'::jsonb);
```

That is the entire data migration. There are no tables to pivot and no foreign
keys to order.

### 4. Wire the client

```sh
cp .env.example .env      # fill in from Supabase → API
npm install
npm run dev
```

### 5. Verify

- `select jsonb_array_length(data->'modules') from sop_document;` — or whatever
  the top-level shape is — against the module count the live app shows.
- Spot-check three procedures for identical step text and numbering.
- Sign out and confirm the SOP still renders (reads are public by design).
- Sign in as a non-editor and confirm an edit is refused.
- Make one edit, then confirm a row appeared in `sop_versions` automatically.

## The Google Doc is a live mirror, one-way

Be precise about the direction, because both halves matter:

**App → Doc: yes, and it is current.** `editScenario`, `createScenario`,
`createReport` and `swapScenarioPositions` all write into `SOP_DOC_ID` on save.
Whatever you write in the app is mirrored into the Doc, so the Doc is a working,
up-to-date copy of the SOP — not a stale artefact.

**Doc → App: no.** `Code.js` is explicit —

> "The Doc is NOT read back into the app automatically or on a schedule —
> editing the Doc directly no longer has any effect on what the app shows.
> There is no sync-from-Doc entry point anymore (removed along with the old
> auto-sync trigger)."

`refreshFromDoc_()` is only a write-then-re-read-your-own-write helper for the
admin mutation functions, not a sync path.

**What this means for the migration.** There is no "which is the source"
question to settle — the app is, and the Doc follows it. The real decision is
whether to keep writing the mirror afterwards:

- **Keep it.** Rebuild the app→Doc write against the new backend. Worth it if
  anyone reads or prints the Doc, or if you want a copy that survives the
  database entirely.
- **Drop it.** `sop_versions` snapshots every change automatically (by trigger,
  so it cannot be forgotten), which covers recovery. The Doc's remaining value
  is then only as an outside-the-system copy.

Either way, decide before switching over — if the mirror silently stops, the Doc
quietly goes stale while still looking authoritative, which is worse than not
having it.

## Also unique to SOP

`DIAGRAMS_FOLDER_ID = 1ZEG3lkQ…VBxukL` holds the flow-diagram PDFs, and
`Code.js` carries an explicit warning never to look that folder up by name —
an earlier version did, missed, and created a stray duplicate. Those PDFs are
**not** part of this migration; they stay in Drive and are still referenced by
id. Moving them to Supabase Storage would be a separate, later job.

## What is NOT done

- The React app still renders from `src/data/`; nothing imports the Supabase
  client yet.
- No Supabase project created, no document seeded.
- The Apps Script app remains the live system and the source of truth.
