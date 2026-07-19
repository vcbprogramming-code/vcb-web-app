# PORT_NOTES — GAS → React mirror

This folder lives **inside** the Google Apps Script (GAS) project root
(`Meeting Minute Web App/meeting-minutes-react`) and is a **live mirror** of it. The
GAS project is **canonical**: build/demo there first, then re-sync here. After ANY
change to the GAS source, diff it against this folder and update only what changed
(components, logic, and the verbatim CSS).

> **Deploy safety:** the GAS root's `.claspignore` excludes `meeting-minutes-react/**`,
> `node_modules`, and `dist`, so `clasp push` never sends this app to the live Apps
> Script deployment. Verify anytime with `clasp status` (run in the GAS root) — only
> the 7 `.gs`/`.html`/`.json` source files should appear under *Tracked files*.

## Last synced
- **GAS source:** `Code.js`, `Auth.js`, `Config.js`, `Index.html`, `JavaScript.html`, `Stylesheet.html`
- **Synced at:** 2026-07-19
- **Live deployment referenced:** `@60` (per `PROJECT_SUMMARY.md`); the React build
  does not call it (see *Data layer* below).
- **What changed 2026-07-18 sync:** Fathom Inbox (webhook/backfill intake, permanent
  archive, never in "All meetings"), multi-project tagging (a recording can be
  tagged into more than one project, each independently removable — never a
  single ambiguous untag action), a keyword-based project suggestion in the tag
  picker (weighted so a project's own id/name beats generic English words —
  fixes an ERP-meeting-suggests-FIN false positive), full-content search
  (title/date/attendees instant + debounced whole-body search), and self-serve
  "+ New project" (creates a project at runtime, no code change needed).
- **What changed 2026-07-19 sync:**
  - **"+ New project" no longer creates a Google Doc.** It's a tag-only
    bucket (docId/docUrl are always `''`) — an earlier version always made a
    Doc, matching the original 5 projects, which produced an unwanted Doc +
    a stale placeholder "Tab 1" row when an admin used it purely as a Fathom
    tag bucket. Do not reintroduce Doc creation without a deliberate opt-in.
  - **Project rename** (`renameProject` / `RenameProjectModal.tsx`) — works
    for any project, including the original 5, via an overrides layer
    (`projectOverrides` map in `mock.ts`) rather than mutating the base
    definitions. Pencil icon on hover, admin-only, on every sidebar tile
    except ALL and Fathom Inbox.
  - Fathom webhook duplicate-row bug (multiple deliveries for one recording
    each inserting a new row) — GAS-only fix (`doPost`/`ingestFathomPayload_`
    dedup by `recording_id`), no React-side equivalent since the mock has no
    webhook endpoint.

## CSS
`src/styles.css` is the **verbatim** contents of the `<style>…</style>` block in
`Stylesheet.html` (tags stripped, nothing else changed). **Never hand-edit it** —
re-extract on every sync:

```bash
# run from this folder (Meeting Minute Web App/meeting-minutes-react)
sed '1d;$d' "../Stylesheet.html" > src/styles.css
```

The pre-paint theme/lang/mobile bootstrap from `Index.html`'s `<head>` script is
reproduced verbatim in this folder's `index.html`.

## Data layer (mock by default — and why)
The GAS server functions are reachable **only** through `google.script.run` inside
the GAS-served iframe. `doGet` serves HTML (plus `?diag`/`?seed`); there is **no
CORS JSON endpoint** on the `/exec` URL. A standalone Vercel SPA therefore cannot
call them over HTTP. So the data layer is a **typed mock** that mirrors the GAS API
contracts exactly. To wire a real backend you would add an Apps Script JSON API
(or a separate server) and swap `src/api/client.ts` — the rest of the app is
contract-typed against `src/types.ts` and unaffected.

## Server API mapping (GAS → mock)
Implemented in `src/api/mock.ts`, typed in `src/types.ts` (`ServerApi`):

| GAS function (Code.js / Auth.js) | React mock | Return type |
|---|---|---|
| `getSessionState` | `mockApi.getSessionState` | `SessionState` |
| `listMeetings` | `mockApi.listMeetings` | `MeetingListItem[]` |
| `getMeeting` | `mockApi.getMeeting` | `MeetingFull \| null` |
| `autoSync` | `mockApi.autoSync` | `SyncResult` |
| `togglePin` | `mockApi.togglePin` | `boolean` |
| `setVisibility` | `mockApi.setVisibility` | `boolean` |
| `saveMeeting` | `mockApi.saveMeeting` | `string` (id) |
| `deleteMeeting` | `mockApi.deleteMeeting` | `boolean` |
| `saveEdit` | `mockApi.saveEdit` | `SaveEditResult` |
| `getProjectAccess` | `mockApi.getProjectAccess` | `ProjectAccess[]` |
| `setProjectDomain` | `mockApi.setProjectDomain` | `ProjectAccess[]` |
| `addProjectViewer` | `mockApi.addProjectViewer` | `ProjectAccess[]` |
| `removeProjectViewer` | `mockApi.removeProjectViewer` | `ProjectAccess[]` |
| `setFathomTag` | `mockApi.setFathomTag` | `ProjectId[]` (full tag list) |
| `untagFathomMeeting` | `mockApi.untagFathomMeeting` | `ProjectId[]` (full tag list) |
| `searchMeetings` | `mockApi.searchMeetings` | `string[]` (matching ids) |
| `createProject` | `mockApi.createProject` | `CreatedProject` (docId/docUrl always `''` — tag-only) |
| `renameProject` | `mockApi.renameProject` | `Project` |

Not ported (server-only, no client-facing equivalent needed): `doPost` webhook
intake, `ingestFathomPayload_`, `backfillFathomMeetings`/`refreshFathomMeetings`,
`registerFathomWebhook`, `diagFathomRaw_`/`diagFathomDupes_`/`diagExtraProjects_`,
`detachProjectDoc`, `autoCleanupErpDoc_` — these populate/repair the row store
that `listMeetings`/`getMeeting` read from; the mock's Fathom seed rows in
`seed.ts` stand in for what a real backfill/webhook delivery would have produced.

## Component mapping (GAS → React)
| GAS (Index.html / JavaScript.html) | React component |
|---|---|
| topbar + `initHeader()` | `components/Topbar.tsx` |
| sidebar `renderProjects()` / `projRow()` | `components/Sidebar.tsx` |
| `renderMobileLatest()` | `components/MobileLatest.tsx` |
| list `renderList()` + range filter | `components/MeetingList.tsx` |
| ALL dashboard `renderDashboard()` | `components/Dashboard.tsx` |
| project dashboard `renderProjectDashboard()` + `loadSummary()` | `components/ProjectDashboard.tsx` |
| detail `openMeeting()` / `renderDetail()` | `components/MeetingDetail.tsx` |
| New/Edit modal `openModal()` | `components/MeetingModal.tsx` |
| in-app editor `openEditor()` | `components/EditorModal.tsx` |
| project access `openAccess()` | `components/AccessModal.tsx` |
| settings sheet `openSettings()` | `components/SettingsModal.tsx` |
| busy / toast | `components/Overlays.tsx` |
| `I18N`, `fmtDate`/`fmtTime`/`fmtThaiDate` | `lib/i18n.ts` |
| `OVERRIDE_CSS`, section extraction, bullets | `lib/docRender.ts` |
| mobile panes, range math, theme/lang apply, `applyMobileScale` | `lib/ui.ts` |
| `S.contentCache`, `prefetchLatest()` | `api/contentCache.ts` |
| tag picker `openTagPicker()` / `suggestProjectFor_()` | `components/TagPickerModal.tsx` |
| per-chip untag ✕ in `renderDetail()` | inline in `components/MeetingDetail.tsx` |
| "New project" modal + `createProject` | `components/NewProjectModal.tsx` |
| rename project (pencil icon) + `renameProject` | `components/RenameProjectModal.tsx` |

## Fathom Inbox (added 2026-07-18)
Fathom recordings (via webhook or backfill) land in a permanent, admin-only
pseudo-project — `FATHOM_INBOX_ID` in `types.ts`. Key rules, mirrored exactly
from the GAS source:
- **The row never moves.** `projectId` stays `FATHOM_INBOX` forever;
  `taggedProjectIds` is a separate list of projects it ALSO shows under.
  `listMeetings`/`mockApi.listMeetings` emit one list entry per tag PLUS the
  permanent inbox entry — same `id` each time (see `toListItems` in `mock.ts`).
- **Tagging is additive and reversible per-project.** `setFathomTag` adds one
  project to the list; `untagFathomMeeting` removes just one — never a single
  action that clears everything. This was a deliberate fix after tagging was
  first built as a single-value field that a status button could accidentally
  clear on click.
- **Fathom Inbox is excluded from "All meetings"** everywhere it's aggregated:
  `Sidebar.tsx` (ALL count), `MeetingList.tsx` (ALL list + range counts),
  `Dashboard.tsx` (latest-per-project cards), `MobileLatest.tsx` (latest strip).
- **The tag-picker suggestion is a hint, never an auto-pick** — admin always
  clicks explicitly, because auto-assigning by keyword match risks leaking a
  confidential meeting's content into the wrong project's visibility scope
  (this was an explicit product decision, not a technical shortcut).

## Admin simulation
The live web app is `ANYONE_ANONYMOUS`, so `isAdmin` is only ever true when an admin
email is in the Google session (see `PROJECT_SUMMARY.md`). To make every admin
screen reachable for sign-off, the mock derives admin from a **URL flag**:

- `http://localhost:5200/?admin=1` → admin view (New meeting, pin, hide/show,
  edit-here, project access, refresh).
- `http://localhost:5200/` → public view (what real users currently get).
- `?meeting=<id>` → deep-link straight into a meeting (parity with the GAS share link).

This is a faithful entry hook, not an added feature — the GAS code already branches
on `isAdmin` everywhere.

## Known deviations (intentional)
1. **Mobile detail action lift:** the GAS client physically *moves* the Pin/Share/
   Open-in-Docs buttons onto the mobile back-bar via DOM ops. Here they stay in the
   detail bar (CSS still orders/hides them on mobile). Desktop is identical; this is
   a minor mobile-only placement nuance.
2. **Doc reskin / importer / Drive-chip generation** are server-only GAS concerns
   (they shape the stored HTML). The mock ships already-rendered sample HTML, so the
   render path is identical; the import-time transforms are out of scope for the SPA.
3. **Magic-link sign-in** is retired/vestigial in the GAS source and not reproduced.
