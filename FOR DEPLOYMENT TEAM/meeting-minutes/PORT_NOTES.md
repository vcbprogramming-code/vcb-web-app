# Port notes

This file records only the places where a 1:1 port was **not** possible, and
what was done instead — so nobody spends a day rediscovering why.

The React app is now on the VCB Connect stack: React 18 + Vite 5 + Tailwind 3 +
React Router 6, JavaScript only, talking to `api/src/routes/minutes.js` through
`@vcb/shared`. There is no TypeScript, no Supabase client, and no mock layer.

## The one rule

Do not reintroduce Google Doc creation or importing. It was retired on
2026-07-19 — meetings are written in the app now, and re-enabling the import
would overwrite real edits with stale Doc content. `projects.doc_id`,
`minutes.tab_id` and `source = 'doc-import'` are **read-only provenance**.

An imported meeting keeps `source = 'doc-import'` **forever**, including after
it is edited here. That is deliberate: an edit is a tidy-up, not a new
creation, and knowing a document's true origin matters more than knowing it was
touched. The API pins the value on update and the database CHECK constraint
refuses `'doc-edited'`. Never display an edited import as anything but
imported.

## What the backend does not provide, and the UI needs

**1. There is no presigned-upload route for attachments.** This is the one gap
that stops a feature working end to end.

`POST /api/minutes/meetings/:id/attachments` records **metadata only** — name,
mime type, size, and a URL. The bytes are supposed to go straight from the
browser to Supabase Storage via a presigned URL, because the JSON body limit is
2 MB and the attachment cap is 25 MB (base64 would add a third on top of that).
But `minutes.js` never signs one. `onboarding.js` does, at
`GET /api/onboarding/documents/:name/path`, returning
`{ bucket, path, uploadUrl, downloadUrl }` from `api/src/lib/storage.js`.

The client half is written and waiting in `src/lib/minutesApi.js`
(`uploadUrlFor`, `putToStorage`), and `AttachmentsBar` calls it. Until the route
exists, picking a file reports `err.uploadUnavailable` — "the server has no
upload route" — rather than failing with something opaque. **Suggested route:**

```
GET /api/minutes/meetings/:id/attachment-url?name=<file>&contentType=<mime>
    -> { uploadUrl, downloadUrl }
```

editor|admin, MIME checked against the same `ATTACHMENT_ALLOWED_MIME` the POST
already uses, key scoped under the meeting id via `safeKey`.

**2. `getBootstrap` is gone, and nothing replaced `appTitle`/`subtitle`.** The
old `sessionState` carried the app's display title and Thai subtitle from
server config. Those are interface copy, so they are dictionary entries now
(`app.title`, `app.subtitle`) — which also fixes a Thai reader having been shown
the English one.

**3. `execUrl` is gone.** Share links were built from the Apps Script
deployment's `/exec` URL, handed down from the server. A Vercel-hosted SPA knows
its own origin, so `lib/minutes.js` reads `window.location` instead.

**4. `ProjectAccess.domain` has no column and no route.** The old screen had an
"allow every @vcb-con.com address" toggle. The ported schema has no such flag,
so the control is gone. It must **not** be faked by adding every staff address
to the guest list: that looks identical in the UI but would not follow new
hires, and removing one person would silently differ from what an admin meant.

**5. `copyProjectViewers` has no route.** The "copy this guest list to other
projects" button is gone with it. Several projects usually share an audience, so
this is worth adding back — it is one endpoint over the existing guest table.

**6. `getProjectAccess` is per-project only.** There is no bulk endpoint, so the
access screen issues one request per project in parallel. Fine at today's
handful of projects; it will want a list endpoint before it is dozens.

**7. The audit log carries no `versionSeq`.** The old Edit History tried to
derive its "View" buttons from `details.versionSeq` inside each audit row. This
API's `changes` column holds whatever each route chose to record, and never that
field — so those buttons could never have appeared. The panel now reads
`GET /meetings/:id/versions` directly, which is both correct and simpler: a
version row *is* a viewable version. The audit log is shown alongside it for the
actions that changed no content (pin, visibility, tagging, attachments,
comments).

## Authentication: what disappeared, and why

The Apps Script app was deployed ANYONE_ANONYMOUS, so Google never told the
server who a visitor was. `EDITOR_EMAILS` could not be matched against anything,
so the app grew a credential system of its own: an editor allow-list, per-person
4-digit PINs, an optional shared team PIN, and a forced PIN change on first
sign-in. All of it was a workaround for having no identity.

Identity is a JWT now, and roles live in one place for all seven modules
(`api/src/auth.js`). So these are **gone, not ported**:

- `EditorSignInModal` — sign-in is the portal's, shared across modules
- the Editors tab, `getEditors` / `addEditor` / `removeEditor`
- `getEditorAccounts`, `setEditorPassword`, `editorLogin`
- `getSharedPinStatus`, `setSharedEditorPin`, `clearSharedEditorPin`

Roles are granted in the portal. `hasRole('minutes', …)` hides UI here; the API
is the only real gate.

**Reading stays anonymous.** There is no `RequireRole` around the routes and
there must not be one — a sign-in wall would be a regression. The API filters
every response by tier, and a locked project is simply absent from an anonymous
caller's project list rather than present-but-disabled.

## Bilingual: what the old app actually shipped

`lib/i18n.ts` held **28 keys** — the sidebar, the topbar, and the Settings
sheet. Everything else was hardcoded English JSX: every modal title, every
button, every toast, every empty state, every error, every placeholder, the
whole Project access screen, the whole editor, the whole timeline. Switching to
Thai changed the sidebar and nothing else.

The new `src/i18n.js` has **248 keys**, all of them reached by a `t()` call
(verified: 0 missing, 0 unused).

**Thai shown to English readers.** hr-worklog's port found 34 of these; the same
class of fault is here, in two forms.

*Form one — the `en` side of the dictionary literally held Thai.* Nine of the
28 keys had a Thai value in `I18N.en`, so an English reader got Thai no matter
what they selected:

| Key in `I18N.en` | Value it served to English readers |
|---|---|
| `allMeetingsSub` | `ทุกการประชุม` |
| `display` | `การแสดงผล / DISPLAY` |
| `theme` | `โหมดสี / Theme` |
| `language` | `ภาษา / Language` |
| `about` | `เกี่ยวกับ / ABOUT` |
| `readingSize` | `ขนาดตัวอักษร / Reading size` |
| `sizeSmall` | `เล็ก Small` |
| `sizeNormal` | `ปกติ Normal` |
| `sizeLarge` | `ใหญ่ Large` |

`allMeetingsSub` is intentional and kept — the sidebar's ALL tile shows a name
with its counterpart underneath, so the pair is the mirror image of
`allMeetings`. The four `display`/`theme`/`language`/`about` headings were
bilingual-by-design section labels and are kept verbatim in both languages, now
explicitly commented as such rather than looking like an oversight.

The four `readingSize`/`size*` keys are **dropped**: they were translated but
wired to nothing — no control in the app ever read them. A dead control is worse
than no control.

*Form two — Thai hardcoded in JSX with no dictionary entry at all*, so no
language toggle could reach it:

| Where | Thai an English reader was shown |
|---|---|
| `docRender.ts` → project tab | `📌 บทสรุปผู้บริหาร · Executive Summary` — the summary section label, emitted into every project card |
| `SettingsModal.tsx` | `☀ สว่าง Light`, `🌙 มืด Dark` — the theme segment labels |
| `seed.ts` → topbar | `APP_SUBTITLE`: `กลุ่มวิจิตรภัณฑ์ก่อสร้าง · รายงานการประชุมภายใน` |
| `NewProjectModal.tsx`, `RenameProjectModal.tsx` | `เช่น โครงการหลวงพระบาง` — the project-name placeholder |

All of these are `{ th, en }` pairs now.

The reverse fault, the larger one, was ~190 strings of hardcoded English shown
to Thai readers. Those are all keyed now.

**Two Thai strings are deliberately NOT translated**, and are commented as such:

- `COMPANY_NAME` (`บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด`) — a registered legal
  entity name, printed on the letterhead
- `fmtThaiDate` — the letterhead date line. It sits above Thai body text on a
  Thai company letterhead; an English date there would read as a mistake on the
  document, not as a translation.

The `น.` time suffix is likewise kept in both languages: it is how the source
rows are written and how the printed minutes read.

**Thai is now the default.** The old `index.html` did
`localStorage.getItem('vcb_mm_lang'); l === 'th' ? 'th' : 'en'` — i.e. English
unless Thai was explicitly stored. Nearly every user of this app is
Thai-speaking. The shared provider defaults to Thai.

## Storage keys

`vcb_mm_theme` and `vcb_mm_lang` are gone, replaced by the shared `vcb_theme`
and `vcb_lang`, so a choice made here follows the person across the portal. The
theme selector is `class="dark"` on `<html>`, not `theme-dark`.

`vcb_mm_meetings_cache` is kept — it paints the list instantly on reload. It
holds **metadata only, never body HTML**, and is cleared on sign-out: minutes of
a locked project must not outlive the session on a shared machine. Full records
are cached in memory only, and that cache is emptied whenever identity changes.

## Routing

The URL is the source of truth now (`/`, `/p/:projectId`, `/m/:meetingId`,
`/timeline`). The old app read `?meeting=` / `?project=` once at boot and kept
the selection in `useState`, so the back button did nothing and a reload lost
the meeting. Those query parameters are still honoured and redirect onto the
real routes — every link already pasted into a chat uses them. A `?project=`
link still resolves to whatever is **currently** latest, never a stored id.

## Still not ported (unchanged from the previous notes)

**The editor's hidden-iframe measuring pass.** The live app measured rendered
content off-screen to decide page breaks — a Google Docs technique. Paged.js
does this properly now; see `PAGINATION.md`.

**Print geometry.** `@page { size: A4; margin: 2.7cm 17mm 2cm }` lives in
`src/lib/docCss.js` and is the reason the on-screen page and the exported PDF
break identically. Those values are byte-for-byte what every archived export was
produced with. Do not restate them as Tailwind utilities.

## CSS

`styles.css` was 1,155 lines. What survives as hand-written CSS is 169 lines in
`src/index.css`, and only where a utility genuinely cannot reach:

- `.doc-body` — descendant rules for server HTML injected with
  `dangerouslySetInnerHTML`. Tailwind cannot see markup that only exists at
  runtime, and `@tailwindcss/typography` is ruled out by TECH_STACK.md.
- `.ed-area` — the `contentEditable` surface. Its children are created at
  runtime by `execCommand` and by the paste sanitizer, so no `className` can
  ever be attached to them. The tick-list `::before` has no element at all.
- `.hatch-hidden` — a `repeating-linear-gradient`, which has no utility.
- `.render-frame` / `.frame-ready` — the document iframe reports its own height
  through JS and must start hidden, or an un-paginated first paint flashes.

`src/lib/docCss.js` is a separate matter: it is the **printed page**, a whole
second document inside an iframe with no link to this app's stylesheet. It stays
literal CSS.

## Verification

- `npx vite build` succeeds
- all 28 `.js`/`.jsx` files parse standalone (esbuild)
- 0 TypeScript syntax, 0 `.ts`/`.tsx` files, no `tsconfig*.json`
- no import resolves to a deleted file
- 248/248 dictionary keys used; 0 `t()` calls unresolved
- all 17 audit action tokens the API emits have `audit.*` entries
- 26 of 29 API wrappers are called from the UI; the other three are documented
  at their definitions
