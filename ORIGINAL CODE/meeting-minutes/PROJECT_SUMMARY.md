# VCB Meeting Minutes — Project Summary

*Current as of 2026-08-16.*

---

> What the app is and does: see [../README.md](../README.md).
> This file is the implementation detail behind it.

## Architecture

```
Google Sheet (the database)   →   web app
  (edited only in-app)              (what readers see)
```

- **Source of truth:** a private Google Sheet (`PROP_DB_ID` in `Config.js`) the
  script auto-created in Drive. It is the **only** database — there is no
  background Doc-sync anymore.
- **How rows get created/edited:** admins use "＋ New meeting" or "✎ Edit here"
  in-app. Every content-changing mutation is appended to an `AUDIT_LOG` sheet
  with a full pre-edit snapshot in a `Versions` sheet, surfaced via the in-app
  "Edit history" panel.
- **Automated ingestion:** Fathom recordings arrive via webhook into a
  **Fathom Inbox** pseudo-project; Transkriptor recordings arrive the same way
  into a **Transkriptor Inbox**. Both sit outside the 5 tracked projects and
  outside "All meetings" until an admin explicitly tags/files them into a real
  project (additive, reversible, never auto-assigned).
- **Web app:** the Apps Script web deployment readers open in their browser.

> **Retired (2026-07-19):** Docs-as-source-of-truth (`autoSync`/`importAllDocs`,
> the `?seed=`/`?seed=full` Doc-import flow, and the Doc "reskin" step below) is
> disabled — `doGet` throws if you try to trigger it. The Sheet is authoritative;
> Google Docs are no longer read from at all in normal operation.

## Access model

The deployment manifest is `ANYONE_ANONYMOUS` (no Google-account gate at the
door — it runs as the owner via `executeAs: USER_DEPLOYING` so it can read/
write the private Sheet DB and Drive folder), and the app layers its **own**
sign-in on top. Reading a **🔓 Public** project is open to anyone with the
link, no sign-in; a **🔒 Locked** project is readable only by admins, editors
and the specific emails named on it (see *Project visibility* below).
Editing always requires signing in.

Because the manifest is `ANYONE_ANONYMOUS`, Google never tells the script who a
visitor is (`Session.getActiveUser().getEmail()` is empty for everyone but the
deploying owner), so the app establishes identity itself. Probed on the live
deployment: an anonymous visitor yields `{"activeUser":"","effectiveUser":"<owner>"}`
— Apps Script exposes no visitor identity whatsoever.

**Google Sign-In is the primary route** (`googleEditorLogin`). Google Identity
Services runs in the BROWSER — outside Apps Script's blind session — and returns
a signed ID token. The server verifies it against Google's `tokeninfo` endpoint,
checks `aud` matches our client ID (otherwise a token minted for another site
would be accepted here), confirms the address is verified, and only then matches
it against `EDITOR_EMAILS`. **Never decode-and-trust the token locally** — a JWT
is only base64, so anyone could hand the app `{"email":"boss@vcb-con.com"}`.
Enable by setting the `GOOGLE_CLIENT_ID` Script Property (it is public by
design, not a secret); until then the button stays hidden.

The **email + 4-digit PIN login** (`editorLogin`) remains as a fallback, for anyone
without a Google account or when Google's library cannot load, so sign-in is
never a dead end. Each editor has their own account: an admin creates it in
Settings → 🔐 Project access → *Editors* → **Set password**, hands the password
over directly, and the employee is forced to choose their own PIN on first sign-in
(`mustChange`), so the admin does not go on knowing it.

An optional **shared team PIN** (`EDITOR_SHARED_*`) lets several trusted people
use one number instead of each having an account — set it in the same panel. It
is a convenience, **not a skeleton key**: the email must still be on the editor
list, so knowing the PIN alone grants nothing and removing someone still locks
them out immediately. The trade-offs are real, which is why per-person PINs stay
the default: everyone using it looks the same in the edit history beyond the
email they typed, and it cannot be revoked for one person — changing it changes
it for all of them.

**Only the shared PIN can be revealed.** It is stored recoverably (alongside its
hash) precisely because its purpose is to be told to people, so an admin who
forgets it can look it up rather than reset it and break everyone at once — the
panel has a Show/Hide toggle, and the value is only sent to the browser while
actually being shown. A **personal** PIN can never be revealed, to anyone,
including an admin: it is one-way hashed, so the app genuinely cannot read it
back. Helping someone who forgot theirs means setting them a new one.

Passwords are stored **salted and iteratively hashed** in the `EDITOR_CREDS`
Script Property — never in plaintext (`ADMIN_PASSWORD`, by contrast, is still a
plaintext property; it predates this). Wrong email and wrong password give the
same error, so the form cannot be used to discover who has edit access, and 8
failures locks that email for 15 minutes.

| Tier | Granted via | Can do |
|---|---|---|
| **Admin** | `ADMIN_EMAILS` in `Config.js`, proven by the **Google account** or `ADMIN_PASSWORD` — never by an editor password | Everything: edit/create/delete meetings, hidden/pinned status, edit history, manage per-project access + editors, create/rename projects, API keys |
| **Editor** | Listed in Settings → 🔐 Project access → *Editors*. Signs in **with Google** (preferred), or with a password an admin sets there as a fallback | Edit meeting content, create/delete meetings, add/remove attachments, file Fathom/Transkriptor inbox recordings into projects |
| **Viewer** | Settings → 🔐 Project access, per project — named by email on a 🔒 Locked project | Read that project. A 🔓 Public project needs no grant and no sign-in at all |
| Anonymous / not signed in | — | Reads every visible meeting. Sees the ✎ Edit button too — clicking it opens the editor login above |

A signed-in email only ever sees the projects it's allowed for — access is
per-project, not all-or-nothing (except admins, who see everything).
Editors are a flat, global list — not scoped per project.

### Project visibility

Every project is one of two things, toggled in Settings → 🔐 Project access:

- **🔓 Public** — every meeting in it is readable by anyone who opens the app
  link. Any email domain, no sign-in. Unlocking also publishes any meeting
  added to the project later.
- **🔒 Locked** — readable only by admins, editors, and the exact addresses
  named on that project. A locked project is **not** open to the whole
  `@vcb-con.com` domain: that is the point, so a project can be shared with
  three colleagues without being shared with every staff address. A locked
  project with nobody named is admin/editor-only, and the panel warns while
  any project is in that state.

The rule lives in `canSeeProject_` (Auth.js) and is enforced on **every** read
path — `listMeetings`, `searchMeetings`, `getMeeting`, `addComment`, and both
bootstrap builders' sidebar counts. Each is a two-gate check: the per-meeting
`visible` flag **and** the project guest list. `getMeeting` is gated too, or a
locked project would stay one shared link away from anybody. Projects a viewer
cannot see are omitted from the sidebar rather than sent disabled, which would
advertise the exact set of projects they are being kept out of.

Two traps worth knowing before touching this:

- These paths must identify the caller with `identify_(token)`, **not**
  `googleEmail_()`. The latter is `''` for every visitor under
  `ANYONE_ANONYMOUS`, so gating on it hides locked projects from the very
  people named on them.
- `emailHasAnyAccess_` (which decides who gets a sign-in link) deliberately
  does **not** reuse `canSeeProject_`. That returns true for a public project
  whoever is asking, which would make every address on earth "have access"
  and turn the sign-in form into an open mail relay.

`rule.domain` still exists as an explicit "allow all @vcb-con.com" opt-in per
project, but it is off unless deliberately set and has no UI — the guest list
is the intended mechanism.

## Projects

| Code | Project name | Cadence |
|---|---|---|
| FIN | งบการเงินทุกโครงการ (all-project financial review) | Monthly |
| BD | Business Development | Quarterly |
| BT12 | โครงการบางเตย ตอน 1+2 | Monthly |
| BV | โครงการบางวัว ตอน 6 | Monthly |
| PN34 | โครงการบรม ตอน 3+4 | Monthly |

Adding / renaming projects = edit `SOURCE_DOCS` in `Config.js` and redeploy.
Fathom Inbox and Transkriptor Inbox are separate always-present pseudo-projects
(not in `SOURCE_DOCS`), each a standalone review queue for auto-ingested
recordings pending admin filing.

## Files in this folder

**Code (this folder IS the source of truth — edit and push from here):**
- `Auth.js` — editor login (Google Sign-In, with email + password fallback), session tokens, admin/editor checks, per-project ACL
- `Code.js` — Sheet DB layer, render, edit, audit log/version history, Fathom/Transkriptor ingestion, Drive-URL → chip, QR print stamp
- `Config.js` — project list, admin emails, column schema
- `Index.html` — app shell
- `JavaScript.html` — client logic
- `Stylesheet.html` — app CSS (not the rendered-meeting CSS — that lives in `JavaScript.html` as `OVERRIDE_CSS`)
- `QrCode.html` — vendored QR encoder used for the anti-tampering print/PDF stamp
- `appsscript.json` — manifest (scopes, web-app access)
- `PAGINATION.md` — **how the reading view, PDF and editor stay page-identical. Read before changing any display/print/editor layout.**
- `tools/layout-checks/` — three dependency-free Node scripts guarding the responsive reading pane (device widths, CSS scoping/cascade, the document scaler). Run from the project root after touching the `.body` grid, `.list`/`.detail`/`.paper`/`.frame-wrap`, the `.list-peek` toggle, or the scalers. Excluded from `clasp push`; see its own `README.md`.
- `Diagnose.js` — one-off read-only survey of how much heading structure the meeting docs actually carry, to decide whether an "action plan" view would have enough to show. Run `diagnoseActionItems()` by hand from the Apps Script editor. Excluded from `clasp push`; delete once the question is settled.
- `../FOR DEPLOYMENT TEAM/` — React 18 + TypeScript reference implementation, kept in parity with this app (see its `PORT_NOTES.md`). Synced 2026-08-19 with the page-accurate rendering work.
- `.clasp.json` — clasp config (Script ID)

**React mirror (reference implementation, not deployed from here — see its own `STATUS.md`/`PORT_NOTES.md`):**
- `../FOR DEPLOYMENT TEAM/` — kept in sync with the GAS source above; excluded from `clasp push` via `.claspignore`. Also mirrored out to the `vcb-web-app` GitHub monorepo (`VCB-dev` branch, `meeting-minutes/` folder) for the eventual real backend build.

**Docs:**
- `README.md` — quick overview
- `PROJECT_SUMMARY.md` — this file
- `CHANGELOG.md` — current state + dated history of real feature/polish passes
- Sheet DB details are in [../README.md](../README.md)

**Shortcut:**
- `VCB Meeting Minutes — Open App.url` — opens the live app

## Deployment

- **Script ID:** `1Ozxm34TQ4tIdwyr4dPPImwIeuGJpj9B53Zb0hl30MnR8tdeawb7KE6vf` *(rebuilt 2026-05-23 — the original script project was accidentally deleted; previous ID `15ZnMKOc…` no longer resolves)*
- **Live web-app deployment ID:** `AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr` *(currently @216 — the `/exec` URL staff use)*
- **Preview (HEAD) deployment ID:** `AKfycbxuubGQSN09vXHJ6Qd3hsvuny3N0UbbITdrH8_VFkQ` — the `/dev` URL. Auto-tracks the latest pushed code, consumes no versions. See *Two URLs* below.
- **Apps Script editor:** open `VCB Meeting Minutes` from script.google.com, or directly at https://script.google.com/d/1Ozxm34TQ4tIdwyr4dPPImwIeuGJpj9B53Zb0hl30MnR8tdeawb7KE6vf/edit
- **Web-app access:** manifest is `ANYONE_ANONYMOUS` (no Google-account gate at the deployment level), reading needs no sign-in; **editing** requires signing in with Google (or the password fallback) — see *Access model* above. Runs as the script owner so it can read/write the private Sheet DB.

### Post-recreation checklist (one-time, after this rebuild)

1. **Open the editor once and run `doGet` (or any function)** so Google prompts you to authorize the OAuth scopes for the *new* script project. Until you do this, the web app will fail with an auth error on first load.
2. **Cache Sheet:** the script will auto-create a fresh `Minutes` cache Sheet on first page-load and store its ID in `PROP_DB_ID` — the old cache Sheet (if it still exists in Drive) is orphaned and can be trashed.
3. **Sign-in:** readers need none; editors sign in with Google (set `GOOGLE_CLIENT_ID`), or with a password an admin sets for them (no migration needed — sessions are just Script Property tokens).
4. **Bookmarks:** the old URL is permanently dead. Anyone with the old `AKfycbwAN6Ob…` link bookmarked needs the new URL.

### Two URLs: `/dev` for iterating, `/exec` for everyone else

| | Preview (`/dev`) | Live (`/exec`) |
|---|---|---|
| URL | `https://script.google.com/a/macros/vcb-con.com/s/AKfycbxuubGQSN09vXHJ6Qd3hsvuny3N0UbbITdrH8_VFkQ/dev` | `https://script.google.com/a/macros/vcb-con.com/s/AKfycbxJN7ol…D19rUnr/exec` |
| Serves | whatever was last pushed | the last **promoted version** |
| Updates | instantly, on `clasp push` | only on an explicit deploy |
| Versions consumed | **none** | one per deploy |
| Who can open it | **only accounts with edit access to the script** | anyone, per the access model above |
| Rollback | none — always latest | any earlier version |

**Use `/dev` for micro-changes.** Push, refresh the tab, see the result — no
version consumed, no deploy round trip. This is the normal loop while iterating.

**Promote to `/exec` only when a change is settled.** That is the URL staff use,
and every promotion consumes one of the project's 200 versions.

> `/dev` requires script edit access, so it cannot be shared with staff — it is a
> preview for the developer only. It can also serve slightly stale code for a few
> seconds after a push (Apps Script caches it); a hard refresh settles it.

### The 200-version limit

Apps Script caps a project at **200 versions**, and neither `clasp` nor the Apps
Script API can delete them — the limit was hit on 2026-08-19 and had to be
cleared by hand. To prune: open the script editor → **Project history** (clock
icon in the left sidebar) → delete the oldest versions.

Two must never be deleted: **the version the live deployment points at**, and
**`@3` ("API Executable")**, which a separate deployment still uses.

Using `/dev` for iteration is what keeps this from recurring: versions are spent
only on real promotions, not on every experiment.


### How to push / deploy (from THIS folder)

This folder (`E:\WORK\08 CLAUDE CODE\Meeting Minute Web App`) is the **authoritative working copy** and is directly pushable — edit here, then:

1. **Push code** → `clasp push -f` (updates the script and the `/dev` preview URL immediately). **For most changes this is the only step** — check the result on `/dev` and stop here.
2. **Cut a version** → `clasp version "what changed"` (prints the new version number, e.g. 27).
3. **Promote to live** → `clasp redeploy AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr -V <version> -d "what changed"` (points the live deployment at the new version; this is what real users get).

> Steps 2-3 promote a change to the `/exec` URL staff use, and each one consumes a version (200 max — see above). Do them when a change is settled, not for every edit. Deployment is automated by Claude end-to-end — the developer does not deploy manually. Tested on clasp 3.3.0; note clasp 3.x uses `redeploy`, not the old `create-deployment -i`.

> **History note:** there used to be duplicate `.gs` copies of `Auth`/`Code`/`Config` here, which made `clasp push` fail with "Conflicting files" and forced pushes through a `.js`-only clone at `C:\Users\Yoon-Home\Documents\vcb-meeting-minutes`. Those `.gs` duplicates were deleted on 2026-05-31 so this folder pushes cleanly on its own. **Do not re-add `.gs` files** — keep one extension (`.js`) per code file.

- **Current live version:** `@216` (2026-08-20 — Google Sign-In for editors, 4-digit PIN fallback, optional shared team PIN; see [CHANGELOG.md](CHANGELOG.md) for the full history since @42).

## Known limits

- **Pagination is browser-driven, not Docs-driven.** "Print / PDF" uses the browser's own paginator (with the anti-tampering QR stamp in the page margin), not a Google Docs page layout. The reading view shows the same page breaks via Paged.js, and the editor mirrors them — see [PAGINATION.md](PAGINATION.md). The editor is necessarily a single continuous sheet with page gutters drawn in, not separate page elements: a caret cannot span two elements, so text cannot flow between real pages there.
- **The page is pinned to A4 and cannot follow the printer's paper.** `@page{size:A4}` is deliberate: without it Chrome paginates to whatever the print dialog's destination is set to while Paged.js uses its own default, so screen and PDF drift apart (and the same document paginates differently on differently-configured machines). Printing to a non-A4 paper will scale the page rather than re-flow it. Changing the paper means changing `@page` **and** `.ed-area` in `Stylesheet.html` together — see [PAGINATION.md](PAGINATION.md).
- **The reading pane scales the sheet rather than reflowing it.** The document is authored at a fixed 860px page box holding a 210mm (~794px) A4 sheet, so a pane narrower than that gets the whole thing CSS-scaled down (`fitScaleToPane`), never clipped — clipping is unrecoverable, since the pane scrolls only vertically. On tablets the fixed columns narrow first (1200/1040px bands) and in portrait the meeting list becomes an overlay, because three columns at 820px scale the page to ~43%: visible, but not readable. Two traps: **phones also match `@media (max-width: 900px)`**, and the phone rules override only `display`/`width` — never `position`/`transform` — so every pane selector in that block must be scoped `html:not(.is-mobile)` or the phone meeting list slides off-screen with no way back; and tablets must take the **desktop** render path, since the phone branch skips Paged.js and relies on `html.is-mobile` CSS to reveal the iframe (routing tablets through it leaves the pane blank). `tools/layout-checks/` guards all of this.
- **PDF filenames come from the document `<title>`, which the browser only *suggests*.** Exports are named `<meeting title> <d.m.yy>` (e.g. `VCB Meeting Minutes 18.8.69` — dot-separated, unpadded, 2-digit Buddhist year, matching the existing export-folder convention). Chrome may reuse a previously-typed filename when re-saving the same document; that is the browser remembering, not the app. A meeting with no parseable date simply keeps the plain title.
- **The app cannot see who a visitor is, so editors need their own login.** The deployment is `ANYONE_ANONYMOUS` + `USER_DEPLOYING`, which means `Session.getActiveUser().getEmail()` returns `''` for everyone except the deploying owner. `EDITOR_EMAILS` therefore cannot be matched against anything on its own — that is why an allow-listed employee used to see no ✎ Edit button at all. Identity comes from the app's own session token instead: email + password, verified by the app. Do not "simplify" this back to a Google-email check; it silently grants nobody access.
- **An editor password never confers admin.** `isAdmin_` is deliberately stricter than `identify_` — Google session or `ADMIN_PASSWORD` only. Wiring admin to `identify_` would let an editor account on an `ADMIN_EMAILS` address bypass `ADMIN_PASSWORD` entirely.
- **Password hashing is weaker than a real KDF, by platform limit.** Apps Script has no bcrypt/argon2 and no PBKDF2, so `hashPassword_` iterates `Utilities.computeDigest` (SHA-256). That call costs ~1ms, **measured on the live deployment** — 12000 rounds took 11.8 seconds per login, so the work factor is 1200 (~0.85s). Unique per-user salts and the 8-try lockout carry most of the weight; hashing is defence-in-depth if `EDITOR_CREDS` ever leaks, not a reason to treat that property as non-secret. Re-measure before raising it.
- **Editors are a flat, global list, not per-project — and they can read everything.** `canSeeProject_` returns true for any editor on **every** project, locked ones included, because someone who may edit a meeting must be able to read it. So adding an editor grants read access to every locked project at once; it is not bounded by the per-project guest list. If per-project scoping is ever needed, `EDITOR_EMAILS` (`Auth.js`) would need to become a per-project map like `PROJECT_ACCESS`.
