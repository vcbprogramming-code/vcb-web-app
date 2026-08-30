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

## Decide deliberately: the Google Doc

`SOP_DOC_ID` stays upstream of the live app — the Doc is where content is
authored, and the app re-parses it. After migration you have two choices:

1. **Keep the Doc as the source.** Someone still edits in Google Docs, and an
   import step refreshes `sop_document`. Familiar for authors; two places to
   look.
2. **Cut the link.** The database becomes the only source, edited through the
   app. Cleaner, but authors lose Google Docs.

The schema supports either. Choose before switching anyone over, because doing
it accidentally means edits in one place silently do not appear in the other.

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
