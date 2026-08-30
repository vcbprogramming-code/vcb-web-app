# Portal — moving off Apps Script

Status: **schema written, nothing connected.** The live portal is still the Apps
Script one in `../../ORIGINAL CODE/`. Nothing here touches it.

The portal is a launcher — a grid of app tiles plus one announcement banner. It
has no spreadsheet, so this migration is small. But it has one property none of
the others do: **it should be migrated LAST**, because it is the front door that
points at all the other apps.

## Why last

Every tile's `url` is an Apps Script `/exec` link. As each app migrates, its tile
needs re-pointing at the new URL. If the portal moves first, you are maintaining
that list in two places during the whole transition.

Migrating it last means: each app moves, you update one row, done.

## What has to persist

| Today (Apps Script) | Here |
|---|---|
| `APPS` array hardcoded in `Code.js` | `public.apps` table |
| `ANNOUNCEMENT_JSON` script property | `public.announcement` (single row) |
| `ADMIN_PASSWORD_HASH` script property | **gone** — replaced by real auth |

Making the app list a table is worth doing regardless. On 2026-08-30 the Credit
Facility tile pointed at a dead `/exec` URL and fixing it required a code edit
and a redeploy. As a row, it is an UPDATE.

## The admin password does not migrate

The Apps Script version gated its admin panel behind a SHA-256 hash in
ScriptProperties, compared server-side. That cannot work in a SPA: both the hash
and the comparison would ship in the browser bundle, so anyone could read the
hash out of DevTools or simply skip the check and call the API directly.

Real authentication replaces it. Anyone previously sharing the admin password
now needs their own Google account listed in `public.portal_admins`.

## Steps

### 1. Create the Supabase project

Create a project, then in **SQL Editor** run `schema.sql` once.

### 2. Turn on authentication

- **Authentication → Providers → Google**: enable, restricted to your workspace
  domain.

```sql
insert into public.portal_admins (email) values ('someone@vcb-con.com');
```

### 3. Seed the tiles

From the `APPS` array in `../../ORIGINAL CODE/Code.js`. **Keep the existing
`/exec` URLs** — the Apps Script apps stay live until each is migrated, so the
portal must keep pointing at them during the transition.

```sql
insert into public.apps (key, name, description, url, icon, accent, sort_order) values
  ('credit', 'Credit Facility Manager',
   'Credit limits, drawdowns, requests & approvals.',
   'https://script.google.com/macros/s/AKfycbyt…/exec', 'credit', '#fbbf24', 6);
-- …repeat for each entry in APPS
```

Then the empty announcement:

```sql
insert into public.announcement (id, show) values (1, false);
```

### 4. Wire the client

```sh
cp .env.example .env      # fill in from Supabase → API
npm install
npm run dev
```

### 5. Verify

- Load the portal **signed out** — all tiles must render. The portal is public
  by design; if it needs a login it is broken.
- Click through every tile and confirm each opens the right app.
- Sign in as an admin, publish an announcement, confirm it appears.
- Dismiss it, edit the text, reload — it should re-appear, because the
  `revision` column bumps on every update (that trigger replaces the uuid the
  Apps Script version regenerated).
- Sign in as a non-admin and confirm the admin panel is refused by the database,
  not merely hidden.

## What is NOT done

- The React app still uses `src/mockBackend.ts` (localStorage); nothing imports
  the Supabase client yet.
- No Supabase project created, no tiles seeded.
- The Apps Script portal remains live at its `/exec` URL and is what employees
  use today.
