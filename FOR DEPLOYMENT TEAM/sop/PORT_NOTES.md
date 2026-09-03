# Port notes — sop

Status: **converted to the VCB Connect stack.** React 18 · Vite 5 · Tailwind 3 ·
React Router 6 · JavaScript only. No TypeScript, no Redux, no UI kit, no chart
library. See `../../TECH_STACK.md`, which is the binding contract.

This file records only the places where a straight port was **not** possible, and
what was done instead — so nobody spends a day rediscovering why.

## The three structural changes

**1. Data comes from the API, not a bundle.**
The old port shipped `src/data/sop.json` and served it from an in-memory mock in
`lib/api.ts`. Everything now goes through `GET /api/sop` and friends
(`src/lib/sopApi.js`). `lib/supabaseClient.ts` is deleted outright: the browser
must never reach Supabase directly — Express is the only thing holding database
credentials, and the only thing enforcing who may write.

The old bundled content survives as `seed/sop-document.json`, which is the
payload for seeding `sop.sop_document`. It is not app code. See `seed/README.md`.

**2. Navigation is React Router, not a `nav` object.**
The old store faked routing with `{ view, mod, sel, selFlow }` and drove the
mobile panes by toggling `body` classes (`m-list` / `m-detail` / `reports-mode`).
Routes replace all of it, which is also what makes cases genuinely shareable.
The canonical app's `?case=N` / `?flow=ID` share links still resolve —
`LegacyQueryRedirect` in `App.jsx` translates them once — so links already pasted
into chats and emails do not break.

**3. Theme and language moved to the shared providers.**
`sop-night` and `sop-lang` are gone. Theme is `vcb_theme` on `class="dark"`, and
language is `vcb_lang`, both shared across all seven SPAs, so a choice made here
follows the person through the portal. Theme also gained `auto` (follow the OS),
which the old two-way switch could not express.

## Where a 1:1 port was not possible

**The Drive filename lookup is gone, not stubbed.**
The canonical Apps Script app auto-filled an attachment's name via
`DriveApp.getFileById(...).getName()`. The old port kept the call shape but
always returned `''`. Under this stack it is not merely unimplemented, it is not
implementable from the browser: Drive sends no permissive CORS headers for file
metadata, and the Express API has no Drive endpoint. Carrying forward a call
that always fails silently is worse than not having it, so the field is simply
typed by hand; left blank it renders as "เอกสารแนบ", which is what the failed
auto-fill produced anyway. **If this is wanted back, it needs an API endpoint
that proxies the Drive API with a service credential.**

**The Google Doc mirror is not reimplemented.**
`SOP_DOC_ID` was a live one-way mirror: every save wrote into a Doc, but editing
the Doc never flowed back. `sop_document` holds the content now. Whether to keep
writing that mirror is a deliberate decision for the deployment team — see the
note at the bottom of `supabase/migrations/006_sop.sql`. If it silently stops it
goes stale while still looking authoritative, which is the worst of both.

**Sign-in is the portal's job.**
There is no sign-in form in this module. Reading the SOP is anonymous
(`allowAnonymous`, matching the old "readable by anyone" RLS policy), and editing
needs the `sop` editor role, which comes from the shared JWT. Settings links to
the portal rather than growing a seventh login screen.

## Two things the API does that the UI must respect

**`displayNo` is server-side only.** The per-module label ("PO-3") is recomputed
from row order on every read and never persisted. The client never sends it — it
would be stale the moment anything is reordered or deleted. The one place a
`displayNo` travels to the server is `swapWith`, because that is the label on the
card the editor actually picked.

**A rejected write must not look like a save.** Every mutation is a
read-modify-write of the whole document under `select … for update`. The client
cannot assume it wins. So `mutate()` in `store.jsx` re-throws on failure, and
every form stays OPEN with the typing intact and the reason shown. Closing on
failure would tell someone their work was saved when it was not, and the text is
gone by the time they find out. A 409 is surfaced specifically as
`error.CONFLICT` — "someone else edited this, refresh and redo" — not as a
generic failure nobody can act on.

## What was added

**Version history** (`/versions`, editor-only). The API has always exposed
`GET /versions`, `GET /versions/:id` and `POST /versions/:id/restore`, and the
`sop_snapshot` trigger writes a snapshot before every update, so the history
exists and cannot have holes. Nothing in the old UI ever showed it — the
canonical app pointed people at "the Doc's version history", which does not exist
after the migration. Without this screen a deleted case would be genuinely
unrecoverable from the app.

**Report row deletion.** `DELETE /api/sop/reports/:case` has always existed; the
canonical UI only ever added rows, so a mistyped one could not be removed.

**A NOT_SEEDED screen.** `GET /api/sop` answers `404 NOT_SEEDED` until the
document row exists. That is a normal pre-launch state, not a failure, so it gets
an onboarding screen — which also points out that Process Flows still work, since
those ship with the app rather than living in the database.

## One rule, unchanged

Server-only helpers with no client-visible effect are not mirrored. If you find
something in `Code.js` missing here, check whether it produces anything the user
can see before rebuilding it.

## `app.title` was missing

`TopBar.jsx` passed the same key to `AppBar`'s `title` and `subtitle` props,
because `app.title` did not exist — only `app.subtitle` and a separate
`app.subtitleTH`, both holding one fixed string regardless of the selected
language. An English reader got the Thai name twice.

There is now one `app.title` (the module name, shown uppercase beside the
brand) and one `app.subtitle` (what the module does), each resolved by
language like every other key in the dictionary. See `docs/CHROME.md`.
