# Meeting Minutes — moving off Apps Script

Status: **schema written, nothing connected.** The live app is still the Apps
Script one in `../../ORIGINAL CODE/`, backed by the "VCB Meeting Minutes —
Database" Google Sheet. Nothing here touches it.

> Do the credit-facility migration first — it is smaller and not in daily use,
> so it is where to learn the process. See
> `../../../credit-facility/FOR DEPLOYMENT TEAM/supabase/MIGRATION.md`.

## Steps

### 1. Create the Supabase project

Create a project, then in **SQL Editor** run `schema.sql` once.

### 2. Turn on real authentication

- **Authentication → Providers → Google**: enable, restricted to your workspace
  domain.
- Seed the two role tables from `../../ORIGINAL CODE/Config.js`:

```sql
insert into public.admins (email)  values ('someone@vcb-con.com');   -- ADMIN_EMAILS
insert into public.editors (email) values ('another@vcb-con.com');   -- EDITOR_EMAILS
```

The app's editor PINs (`EDITOR_CREDS`, salted+hashed in Script Properties) do
**not** migrate. These are live and current — 4-digit PINs, added 2026-08-20 at
the owner's request — so this is a real change for the people using them, not
the removal of something already dead.

They exist because of a specific Apps Script constraint: under
`ANYONE_ANONYMOUS` deployment Google hides the visitor's email from the script,
so `googleEmail_()` returns `''` for everyone but the owner. The app could not
tell who an editor was, hence its own PIN-based session. Supabase auth removes
that constraint entirely — identity comes from the signed-in user.

Tell editors before the switch: they sign in with their Google account, and the
PIN goes away. (The older magic-link sign-in was already retired; only the
`token` argument survives, for call-site compatibility.)

### 3. Seed the projects

The five built-ins come from `SOURCE_DOCS` in `Config.js`; extras were stored in
the `EXTRA_PROJECTS` script property.

```sql
insert into public.projects (id, name, name_en, cadence, color, sort_order, doc_id, builtin, visibility)
values ('FIN', 'งบการเงินทุกโครงการ', 'All-Project Financial Review',
        'Monthly', '#1f6feb', 1, '17lWoQHzihe6_zu7qw_Y5cjC3DW9QMePNZBXVZ3Y3wL0', true, 'locked');
-- …repeat for BD, BT12, BV, PN34, then any EXTRA_PROJECTS with builtin = false
```

Set `visibility` per project to match what the live app shows today (🔓 Public /
🔒 Locked), then seed `project_guests` for each locked project's named emails.

### 4. Wire the client

```sh
cp .env.example .env      # fill in from Supabase → API
npm install
npm run dev
```

### 5. Import the data

From the `Minutes` tab, in this order:

1. `projects` (step 3 above — must exist first, minutes references it)
2. `Minutes` → `minutes`
3. `Versions` → `versions`
4. `AUDIT_LOG` → `audit_log`
5. `FATHOM_RAW_LOG` → `fathom_raw_log`

Column renames to apply while importing:

| Sheet column | Table column | Note |
|---|---|---|
| `date` | `meeting_date` | ISO date; blank when the label was unparseable |
| `projectId` | `project_id` | |
| `taggedProjectId` | `tagged_project_ids` | was comma-separated; becomes a `text[]` |
| `visible` / `pinned` | same | `'TRUE'` → `true`, `''` → `false` |
| `attendees` / `attachments` / `comments` | same | already JSON strings → `jsonb` |

**The meeting body needs care.** In the sheet the content is not in the row — it
is stored separately by `saveContent_()`. In this schema it is the
`minutes.content_html` column, so the import has to fetch each meeting's content
and write it into the row. Everything else is a straight copy.

### 6. Re-point the integrations

This is the part unique to Meeting Minutes. Fathom and Transkriptor currently
feed transcripts in through Apps Script:

- `doPost` webhook — Fathom POSTs finished recordings
- `processFathomQueue_` — every 1 minute
- `pollFathomMeetings_` / `pollTranskriptorMeetings_` — hourly

None of that survives the move; Apps Script triggers do not exist on Vercel.
Each needs an equivalent — a Supabase Edge Function for the webhook, and
scheduled functions (pg_cron or an external scheduler) for the two pollers. The
API keys move from Script Properties to Supabase secrets.

**Do not switch anyone over until this works**, or recordings stop arriving
silently. Verify by making a test Fathom recording and confirming a row lands in
`minutes` with `source = 'fathom'`.

### 7. Verify before switching anyone over

- Row counts per table match the sheet.
- Open a public project while signed out — it should render.
- Open a locked project while signed out — it should not.
- Sign in as an editor and confirm hidden/pinned controls are refused
  (the `minutes_guard` trigger enforces admin-only, not the UI).
- Attachment upload works — see the storage note below.

## What is NOT done

- **The React app still runs on mock data.** `src/api/mock.ts` is untouched;
  nothing in `src/` imports the Supabase client yet.
- No data imported, no Supabase project created.
- **Attachments** still go to the Drive folder `1EPGohkA…j5zuJR`. Moving them to
  Supabase Storage is a separate job — the `attachments` jsonb column keeps the
  same shape either way, so this can be deferred.
- The Apps Script app remains the live system and the source of truth.
