# PROJECT_SUMMARY — VCB‑MANGO ERP SOP Web App

> One‑page overview of what this project is, how it works end‑to‑end, and what to do to keep it running. For end‑user instructions in Thai, see [README.md](README.md).

> **Doc map** — pick the right file for the change:
> - **[CHANGELOG.md](../CHANGELOG.md)** — *current state* (overwrite the top block) + milestones. **Start here to see where things stand.**
> - **[SETUP.md](SETUP.md)** — build/deploy/preview workflow.
> - **[DESIGN.md](DESIGN.md)** — UI conventions (icons, tokens, nav, flow-data shape).
> - **[../README.md](../README.md)** — what the app is and does.
> - **PROJECT_SUMMARY.md** (this file) — the plain‑language technical summary.
> Maintenance rule: most edits are tiny — don't log each one. Overwrite the CHANGELOG *state* block; add a milestone only when a real feature/polish pass lands; touch README/DESIGN/SUMMARY only when behavior/structure/a convention changes.

## 📁 Project location
This project lives in:
`E:\WORK\08 CLAUDE CODE\SOP Web App`

`E:` is the **Google Drive File Stream** mount (so the folder is backed up to Drive automatically). Use this folder as the working directory for local `clasp` commands and any local file operations.

> **Git:** this folder is now a **git repo** (initialized 2026‑06‑03, branch `master`). Commit at logical checkpoints — not every micro‑edit. `.gitignore` excludes OS/Drive cruft (`desktop.ini`, `*.url`, `*.gscript`) and the generated `flows-preview.html`. Google Drive's File Stream version history still backs up the folder as a second safety net.

---

> What the app is and does: see [../README.md](../README.md).
> This file is the implementation detail behind it.

## 2. Live URLs
| | |
|---|---|
| **Web app** (one URL for everyone) | <https://script.google.com/macros/s/AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg/exec> |
| **Source Google Doc** | <https://docs.google.com/document/d/1emolyExkvNIIEAp-8jWqM3laDF_H6c0v8qVuwHheJxo/edit> |
| **Apps Script editor** | <https://script.google.com/d/1oiWdc-1sqHCJ3NHeUPH3tUkrPx_JfQ0YUI68ZNL0vRvCc0uji5E8PVeY/edit> |
| **Script ID** | `1oiWdc-1sqHCJ3NHeUPH3tUkrPx_JfQ0YUI68ZNL0vRvCc0uji5E8PVeY` |

> **Two deployments exist** (`clasp list-deployments`): the `@HEAD` one auto-tracks every `clasp push` (dev/preview), while the versioned `AKfycby8…` one above is the **production URL everyone uses** and only changes when you redeploy it (see §10). `clasp push` alone updates dev — it does **not** move production.
| **Deployment ID** | `AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg` |

## 3. Access model
- **Deployment access:** `ANYONE_ANONYMOUS` (in `appsscript.json`) — **anyone with the link, no Google sign‑in required**. This is the most‑open setting; it already includes every Gmail account (and non‑Google visitors). ⚠ It also means the SOP content is effectively public to anyone who has the URL.
  - If external users still can't open it, the blocker is **not** the app config — it's the **vcb‑con.com Google Workspace policy** (external/anonymous sharing) or the deployment's per‑deployment access in **Deploy → Manage deployments → Edit → "Who has access" = Anyone**. Neither is changeable from code; a Workspace admin / the editor UI handles them.
  - To instead *require* a Google login (any account) but not be fully anonymous, set `access` to `ANYONE` and redeploy.
- **Execute as:** `USER_DEPLOYING` (`c.chavananand@vcb-con.com`) — the script reads the Doc, caches data, and writes back using the deployer's credentials. End users never grant any permissions.
- **View vs. edit:** the *same URL* serves both. Edit features appear automatically only for accounts on the admin allow‑list. Everyone else gets a read‑only experience identical to view‑only.
- **Admin allow‑list:** `ADMIN_EMAILS` in [Code.js](apps-script/Code.js) (currently just `c.chavananand@vcb-con.com`). Add an email + `clasp push && clasp create-deployment -i … ` (see §10) and that account gets edit access on next sign‑in. No password anywhere.

## 4. How content flows

**The web app is the single source of truth.** The Google Doc is a write‑only
backup copy — the app never reads it back into itself. This changed from the
original two‑way design in 2026‑07 specifically to stop the Doc from ever
silently overwriting in‑app edits.

```
                       ┌───────────────────────────────────┐
                       │  index.html — admin creates/edits/ │
                       │  swaps/deletes a case in the app   │
                       └─────────────────┬─────────────────┘
                                         │ createScenario() / editScenario() /
                                         │ swapScenarioPositions() / deleteScenario()
                                         ▼
                       ┌───────────────────────────────────┐
                       │   Google Doc  (backup copy only)  │
                       └─────────────────┬─────────────────┘
                                         │ refreshFromDoc_() — re-parses the
                                         │ Doc into the cache in the SAME
                                         │ request, right after the write above
                                         ▼
                       ┌───────────────────────────────────┐
                       │  parsed JSON  {meta, scenarios,   │
                       │   reports}                        │
                       └───────────┬─────────────┬─────────┘
                                   │             │
                       CacheService│             │ PropertiesService
                       (6 h)       │             │ (durable, chunked)
                                   ▼             ▼
                       ┌───────────────────────────────────┐
                       │  doGet() injects JSON into the    │
                       │  HTML template as BOOTSTRAP        │
                       └─────────────────┬─────────────────┘
                                         ▼
                       ┌───────────────────────────────────┐
                       │  index.html renders the 3‑pane UI │
                       └───────────────────────────────────┘
```

- **App → Doc (the only direction now):** every admin mutation
  (`createScenario`, `editScenario`, `swapScenarioPositions`,
  `deleteScenario`) writes straight to the Doc's tables, then calls
  `refreshFromDoc_()` once so the server's own cache reflects the change
  immediately — this is a read‑after‑write for *this app's own cache*, not a
  sync from independent Doc edits.
  - `Code.js`'s per‑case `no` is the stable identifier; `displayNo` (`PO‑3`)
    is recomputed fresh from row order on every parse, never stored.
- **Doc → app: fully removed, confirmed severed.** There is no time‑based
  trigger and no "⟲ Sync" button anymore, and this has been verified, not
  just assumed:
  - The live Apps Script **trigger store was checked directly** (script.google.com
    → the clock/Triggers icon) and confirmed **empty**.
  - `syncFromDoc()`, `removeSyncTrigger()`, and `installSyncTrigger()` have
    been **deleted from `Code.js` entirely** (production `@69`) — they had
    zero callers once the trigger and button were gone, so there was nothing
    to keep them as an escape hatch for. If a manual Doc→app pull is ever
    needed again, that logic would need to be rewritten from scratch; it is
    not lying around unused.
  - There is **still no real database** behind any of this — edits go to the
    app + the Doc backup copy only. See §6 for the `DATABASE_SCHEMA.sql` /
    `DATABASE_DATA.sql` export, which is a hand‑off artifact, not a live
    backend.

## 5. UI tour *(revamped — "refined corporate", inline SVG line icons, no emoji)*
- **Banner** — `VCB Group | Mango ERP Standard Operating Procedure / …`, with the search box, a **shield** Admin badge (allow‑listed signed‑in users only), and a **gear** settings button. (Sign out lives in the Settings modal, not the banner. **There is no Sync button anymore** — see §4, the app no longer reads from the Doc. There is **no** logo mark — an invented one was removed.)
- **Left sidebar — three uniform top‑level branches**, each: icon chip · name · count, and (for the first two) a chevron:
  1. **🗺 Process Flows** — root expands a **module submenu** (BD, PO, IC, OF, AP, AR, FA, GL); clicking a module filters the flow list. The root itself = "All".
  2. **📋 Case Studies** — root expands the **module submenu** (PO, IC, …); root = "All".
  3. **📊 Reports** — a leaf (no submenu); opens the reports table.
  Only the active branch's submenu is open (accordion); clicking an already‑open root collapses it. **There is no "ทั้งหมด/All" sub‑item** — the root *is* All. The active branch's icon chip fills navy. Bottom shows version (`APP_VERSION`), scope, manual.
- **Middle list** — cards. Case Studies: case cards, showing the per‑module running number (`PO‑3`) and — if the case is tagged into other modules, or if you're viewing a module the case is only tagged into rather than its primary one — a **lighter‑toned tag badge** (`.lc-badge-tag`) naming the related module. Admins see a **"+ เพิ่มกรณีใหม่ · New case"** button in the list header. Process Flows: flow cards **grouped by module subheaders**; each card shows flow id (e.g. `BD-1.0`) + module badge + title.
- **Right detail** —
  - *Case Studies:* full case (Problem, Solution steps with sub‑bullets, optional note, reference, `dateAdded`) + a **Share** button (everyone) and an **Edit** button (admins). Editing opens a modal with Module/tag/swap/delete controls (see below); the detail header itself no longer shows tag chips — those moved to the list (above).
  - *Process Flows:* the **swim‑lane diagram** (HTML grid of nodes + SVG arrow overlay, with a legend) followed by the **numbered narrative** (readable + searchable; the mobile fallback when the wide diagram scrolls), plus the same **Share** button as case studies.
  - *Reports:* the full reports table.
  - **Share links** (added 2026‑08): the Share button copies a direct URL (`?case=N` for a case, `?flow=ID` for a flow) that opens straight to that item, bypassing the app's normal landing view — see §7/§14 for how the deep link and the URL itself are built.
  - **Mobile layout:** Share/Edit live in the sticky back‑bar row (next to "← List") instead of next to the title, so a long title gets the full width instead of wrapping around fixed‑width buttons (`moveDetailActionsMobile()` relocates them after every render, mobile‑only).
- **Edit modal (admin‑only)** — **full‑screen** (`.modal-full`): sticky header + footer with one non‑scrolling body between them, split into two columns — short metadata on the left, long free‑text fields on the right. ปัญหา and หมายเหตุ are fixed heights; **ขั้นตอน absorbs the leftover height** so the page fills exactly — no dead space, no page scroll. Sized by flex/grid, never a `vh`/`calc` constant, and the growth is applied to the *grid* row rather than converting it to a flex column (that would inherit `align-items:start` from `.modal .row` and pack the field to its content width — the bug behind builds 28–30). Contents: Module select, extra‑module tag checkboxes (`หมวดเพิ่มเติม`, code‑only labels), all case fields, a **Swap with** field (swap this case's content/position with another case's, e.g. `PO‑3` ↔ `PO‑5`), and a **Delete** button (danger‑styled, in the modal footer — not a separate button in the detail header) that opens a custom in‑app confirm dialog, not the native browser `confirm()`.
- **Related Files rail (case detail)** — a case's attachments render beside the content as preview thumbnails **only above 1600px**, where there is genuinely spare width. At or below that it stacks under the content as a compact **chip strip** (filename + file glyph, one line each) so the files stay one tap away without squeezing the case text. See DESIGN.md's responsive table for the width budget — this rail was the cause of an iPad‑width regression where the reading column fell to 334px and the title wrapped one word per line.
- **Attachment rows (edit modal)** — one row per file: **name + URL + delete**, plus `+ เพิ่มไฟล์แนบ`. Replaced a textarea taking `Label | URL` pipe syntax, which was undiscoverable — files were pasted as bare links and the rail captioned them “เอกสารแนบ” (`attachmentCardsHtml()` deliberately refuses to print a raw `/file/d/<id>/view` as a caption). **Pasting a Drive link auto‑fills the name** from the Drive filename, extension stripped — only ever into an *empty* field, never overwriting a stored or typed label; a failed lookup is silent. Storage is unchanged: `setAttachmentRows()`/`readAttachmentRows()` emit the same `{label,url}` objects `writeAttachments_` already wrote.
- **Welcome page** — the rich landing (title, stats strip, Purpose & Scope, 3 how‑to cards, Notes) shown in the right pane whenever no item is selected — including the default Process‑Flows landing. **Its content comes from three different places — see §9a.**
- **Settings modal** (gear) — Account · Display (Theme sun/moon, Language TH/EN, Default view) · Actions (Sign out) · **About** (version + a changelog/"Updates" list driven by `CHANGELOG`) · **Contact** (a one‑row, **click‑to‑copy** developer email — *not* a mailto, so it never opens Outlook/Gmail). No Sync action — see §4.
- **Default view** — the app opens on **Process Flows** for new users; a per‑device "Default view" setting overrides it.
- **Print/PDF** — `Ctrl+P` / `Cmd+P` produces a readable handout.

## 6. Files in this folder
| File | Pushed to Apps Script? | Role |
|---|:---:|---|
| `Code.js` | ✅ (as `Code.js`) | Server logic: `doGet`, `parseDoc_`, cache + persistence, `createScenario`, `editScenario`, `swapScenarioPositions`, `deleteScenario`, `assignDisplayNo_`, admin check. No sync‑from‑Doc code of any kind remains (see §4). |
| `index.html` | ✅ (as `index`) | The whole UI: banner, three‑pane layout, welcome page, sidebar, list, detail, New‑case/Edit/Delete/Swap modals, search, inline editor. Uses Apps Script templating to receive `BOOTSTRAP` JSON from the server. |
| `appsscript.json` | ✅ (manifest) | Runtime + scopes (`documents`, `script.scriptapp`) + `webapp` access settings. |
| `.clasp.json`, `.claspignore` | ❌ | Local clasp config. `.clasp.json` holds the scriptId; `.claspignore` whitelists exactly the 3 files above so nothing else is ever pushed. |
| `PROJECT_SUMMARY.md`, `README.md`, `CHANGELOG.md`, `SETUP.md`, `DESIGN.md` | ❌ | Docs (this file, Thai user guide, current‑state log, deploy workflow, UI conventions). `.claspignore` excludes them. |
| `DATABASE_SCHEMA.sql`, `DATABASE_DATA.sql` | ❌ | **PostgreSQL export** of the live content — schema + a full data dump (modules, case studies/steps, reports, all 33 process flows) generated from the app's own source, for handing off to a Postgres‑backed rewrite. A point‑in‑time snapshot, not wired to anything live; regenerate if the Doc content changes materially before handing off again. |
| `flows-preview.html` | ❌ | **Dev‑only** standalone preview of the Process‑Flow diagrams (generated, for eyeballing in a browser without deploying). |
| `_gen_preview.js` | ❌ | **Dev‑only** Node generator that rebuilds `flows-preview.html` from `index.html` (so the preview can't drift). Run: `node _gen_preview.js`. |
| `SOP Web App.url` | ❌ | Windows shortcut to the live web-app URL. |
| `VCB-MANGO ERP SOP Web App.gscript` | ❌ | Auto-generated Drive pointer to the Apps Script editor — *"DO NOT EDIT"*. |
| `desktop.ini` | ❌ | Auto-generated by Google Drive File Stream (sets the folder icon). Not project-related; safe to ignore. |

> Intended inventory — **3 deployable/config files (`index.html`, `Code.js`, `appsscript.json`) + clasp config + 5 docs + 2 SQL export files + 2 dev‑only preview helpers + 3 OS/Drive helpers**.

> As of 2026‑07, `Code.js` carries real logic beyond serving parsed data: it's the write path for every admin mutation (create/edit/swap/delete), each of which writes to the Doc and then refreshes its own cache. `index.html` still carries the navigation, icon system, and all client rendering.

## 7. Apps Script entry points (in `Code.js`)
| Function | Purpose |
|---|---|
| `doGet()` | Serves `index.html` with parsed Doc JSON + the viewer's admin flag baked into the page. Also injects `meta.appUrl` (`ScriptApp.getService().getUrl()`, the deployed `/exec` URL — the client can't read this reliably itself, since Apps Script serves the page inside a sandboxed iframe) and handles two share-link query params: `?case=N` (validated against the parsed scenarios; sets `meta.initialCase`) and `?flow=ID` (unvalidated — process flows are static client-side data, so `meta.initialFlow` is passed through as-is and the client falls back gracefully if it doesn't match anything). |
| `getSopData()` | Returns the SOP object from Cache → Properties → fresh parse. Used by `doGet`. |
| `createScenario(data)` | Admin‑only. Appends a new case row, assigns `no`, builds `ref` from the target module's chapter, stamps `dateAdded`. |
| `editScenario(data)` | Admin‑only. Writes a single scenario row back to the Doc (incl. module change, `extraModules`, preserving `dateAdded`), then refreshes cache. |
| `swapScenarioPositions(data)` | Admin‑only. Swaps the full content of two cases (resolved by `no` and by `displayNo`) without touching anything in between. |
| `deleteScenario(data)` | Admin‑only. Removes a case's row entirely; later same‑module cases renumber up (`displayNo` is always derived, never stored). |
| `assignDisplayNo_(scenarios)` (private) | Computes each case's per‑module running number (`PO‑3`) fresh from row order, every read. |
| `refreshFromDoc_()` (private) | Re‑parses the Doc and refreshes the cache. Called once at the end of every admin mutation (write‑then‑reread‑your‑own‑write) and on first load. **Not** a Doc→app sync mechanism — there is no public entry point that re‑pulls independent Doc edits (see §4). |
| `getDriveFileName(url)` | Admin‑only, read‑only. Returns `{name}` — the Drive filename with its extension stripped — so the editor can pre‑fill an attachment name on paste. Returns `{name:''}` for a non‑Drive URL, a bad id, or a file the deploying user can’t read; the client treats that as “leave the field alone”, so a failed lookup never surfaces an error. Requires the `drive.readonly` scope (§8). |
| `formatDoc()` | One‑shot stylist: applies brand colors, Sarabun font, table styling, cleans markdown junk in the source Doc so it looks similar to the web app. Idempotent. |
| `parseDoc_()` (private) | Reads the Doc's three tables (header info, 4‑col scenario, 3‑col reports), plus the purpose paragraph and notes bullets, into `{meta, scenarios, reports}`; calls `assignDisplayNo_` before returning. |
| `parseSolutionCell_(cell)` (private) | Parses a solution cell's steps plus the `วันที่เพิ่ม:` (dateAdded) and `หมวดเพิ่มเติม:` (extraModules) marker lines. |
| `isAdmin_()` (private) | Compares `Session.getActiveUser().getEmail()` to `ADMIN_EMAILS`. |
| `replaceCellChildren_`, `styleScenarioTable_`, `clearCell_`, `trimLeadingEmptyParagraph_`, … | Helpers. |

## 8. One‑time setup checklist (done once after first deploy)
| Step | Done by | What it does |
|---|---|---|
| Run `formatDoc()` from the editor | Admin (optional) | Restyles the Google Doc so it looks close to the web app, useful since the Doc is now the backup copy admins might open directly. |
| Sign in to the URL once | Each viewer | Persists their Google session in‑browser; no per‑visit prompt afterwards. |

> There is no sync‑trigger setup step anymore (see §4) — the app never reads the Doc back in, so there's nothing to install.

**OAuth scopes** (`appsscript.json`): `documents` (read/write the SOP Doc), `drive.readonly` (added 2026‑08‑29 — `getDriveFileName()` reads attachment filenames; nothing else touches Drive), `script.scriptapp` (`getService().getUrl()` for share links). The web app is `executeAs: USER_DEPLOYING`, so all three run as the owner. **Adding a scope means the deployer must re‑consent** — open the Apps Script editor and run any function once (this is the usual cause of a 403 right after a deploy).

## 9. Day‑to‑day editing — one path

**Edit in the web app** *(the only supported path — the app is the source of truth)*
1. Open the web app URL while signed in as an admin.
2. Click a case, then **✏️ แก้ไข · Edit** in the detail header — or **+ เพิ่มกรณีใหม่ · New case** in the list header to create one.
3. Change any field (including Module and extra‑module tags), or use **Swap with** to trade positions/content with another case, or **Delete** (in the modal footer, with a custom confirm dialog).
4. Press **บันทึก / Save**. The change writes to the app immediately and to the Doc as a backup copy in the same request.

> Editing the Google Doc directly is **not** a supported editing path anymore — the app will never pick up a direct Doc edit (see §4). Only use the Doc as a read‑only backup/audit trail.

> Steps editor convention: one step per line. Prefix a line with `» ` to make it a sub‑bullet of the previous step.

## 9a. Editing the welcome page

The landing page has **no admin UI** — its parts come from three different places:

| Part | Source | How to change it |
|---|---|---|
| **เวอร์ชัน / มีผล / Manual** (stats strip) | The Google Doc, parsed by `parseMetaKv_` | Edit the `Key: value` line in the Doc. Matching is by keyword, so `เวอร์ชั่น:`, `มีผล:`, `ระบบอ้างอิง:` / `manual:` all work. |
| **วัตถุประสงค์และขอบเขต** (Purpose box) | The Doc — the paragraph right after that heading | Edit it in the Doc. The parser stops at the first blank line, so **keep it as one paragraph**. |
| **หมายเหตุ · NOTES** (bullets) | The Doc — lines under the `หมายเหตุ (Notes)` heading | Each bullet must start with `–` or `-`. Anything else on those lines is ignored. |
| **31 กรณีเฉพาะ / 23 รายงาน** (counts) | Computed | Nothing to edit — they are `SOP_SCENARIOS.length` / `SOP_REPORTS.length`. |
| **Title + subtitle** | `DEFAULT_META` in `Code.js` | **Code change + deploy.** Note these are defaults the Doc never overrides: `parseDoc_` reads version/effective/manual from the Doc, but never title or subtitle. |
| **The 3 numbered how‑to cards** | `ht1Title`/`ht1Desc` … `ht3` in the i18n table in `index.html` | **Code change + deploy.** Both the Thai and English tables must be edited together. |

Doc edits appear on the next load (the app re-parses on cache miss); no deploy needed.

## 10. Adding more editors
Open [Code.js](apps-script/Code.js), find the `ADMIN_EMAILS` array near the top, add the email, then run the following from the current project folder:
```bash
clasp push -f
clasp create-deployment -i AKfycby8FFhiGqjn2tSYaj8LjIPMHwBtkQk66hed7sq1q_tCFd7XhHeHef1_NTuv7qzJDIi8Dg -d "add admin"
```
The new admin gets edit access on next sign‑in. No password setup, no permission grant.

> **clasp v3 note:** the deploy command is `clasp create-deployment -i <deploymentId> -d "<msg>"` (equivalently `clasp redeploy <deploymentId> -d "<msg>"`). Always pass the **production** deployment id above with `-i`; running `clasp create-deployment` with no `-i` creates a brand-new deployment with a *different* URL instead of updating the live one. This same two-step (`push` then `create-deployment -i`) is how **any** code change — admin list, UI tweaks, bug fixes — goes live.

> **⚠ Preview gotcha (learned 2026‑06‑03):** the `@HEAD` deployment's `/exec` URL did **not** reliably serve freshly‑pushed code (it appeared unchanged after `clasp push`). To give someone a real preview *without* touching production, create a **throwaway dated deployment** and share its `/exec` URL, then delete it afterwards:
> ```bash
> clasp push -f
> clasp create-deployment -d "PREVIEW <date> — <what>"   # prints a NEW deployment id → preview URL is .../macros/s/<newId>/exec
> # …user reviews…
> clasp delete-deployment <newId>                          # clean up so only the 2 intended deployments remain
> ```
> Promote to production only after approval with `create-deployment -i <prod id>`.

## 11. Open items
- [ ] **Scenario #18 — Machine Overhaul:** the source Doc still has `xxx ล้าน` as the overhaul value threshold. Decide the real number and edit the Doc (or via the inline editor). Until then, this scenario isn't usable as binding policy.
- [ ] **Management approval** — SOP becomes binding only after management signs off. Track the approval and update the "Approved By" line in the source Doc when done.

## 12. Quick troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| Web app URL shows Google sign‑in screen | Expected — this deployment requires sign‑in (see §3). | Sign in with any Google account. |
| Page loads but no green Admin badge | You're signed in with a non‑admin email. | Sign in as an account listed in `ADMIN_EMAILS`. |
| Save fails with *"Cannot insert an empty text element"* | A field/step was emptied to a way Apps Script's Doc API doesn't accept. | Make sure no field is fully empty; the latest build also skips empty sub‑bullets defensively. If it recurs, copy the error and the scenario number. |
| I edited the Google Doc directly and the app didn't update | Expected — the app no longer reads from the Doc (see §4). | Make the edit in the web app instead; the Doc is a backup copy only now. |
| A case seems to have jumped to a different number | `displayNo` (e.g. `PO‑3`) is always recomputed from row order — not a stored fact. | Check if a case above it in the same module was deleted, swapped, or had its module changed; that's expected renumbering, not a bug. |
| New deploy returns 403 | A scope was added; deployer hasn't reauthorised. | Open the editor and run any function once; approve the consent. |
| Share button seems to freeze the page | Fixed @79 — `navigator.clipboard.writeText()` could hang inside the sandboxed iframe with no timeout. | Should self‑resolve within ~600ms on current production; if it recurs, confirm the deployed version is @79+ (`clasp deployments`). |
| A `?case=`/`?flow=` link opens the normal landing page instead of the item | The id doesn't match anything (stale link, or the case/flow was deleted/renamed) — this is the intended fallback, not a bug. | Get a fresh Share link from the current item. |

## 13. Source attributions
- All scenario text (Problem, Solution, References) and the Purpose & Scope paragraph are reproduced verbatim from the source Google Doc *VCB‑MANGO ERP Standard Operating Procedure v1.0 (Revised)* by the company's deputy MD; the web app does not paraphrase or summarise.
- The web app's banner styling mirrors the existing **VCB Meeting Minutes** internal app for visual consistency across the Group's internal tools.

## 14. Client‑side architecture (mostly `index.html`; `Code.js` now carries real write logic too)
Rendering/navigation/icons/visual system below are client‑side JS/CSS inside `index.html`. As of 2026‑07, `Code.js` is no longer just a data server — see §7 for its create/edit/swap/delete functions.

**Process Flows.**
- Data: `var SOP_FLOWS = [ … ]` — one object per flow: `{id, module, titleTH, titleEN, lanes[], nodes[], edges[], narrative[]}`. `nodes` carry `{id, lane, rank, type:'start|process|decision|end', label}`; `edges` carry `{from, to, label?, kind?}` where `kind ∈ normal|approve(blue)|yes(green)|reject(amber, loops under)`. `narrative` lines: `» ` = sub‑bullet, `! ` = red note.
- Renderer: `diagramHtml(f)` lays nodes on a CSS grid (lane = column, rank = row); `layoutFlowEdges(f)` measures node rects and draws the SVG arrow overlay (re‑run on resize / theme toggle / font load). `renderFlowList()` groups flows by module subheaders.
- **To add/edit a flow:** edit `SOP_FLOWS`, then `node _gen_preview.js` + open `flows-preview.html` to eyeball, then push/deploy. The geometry has a self‑test (see git history / the bash one‑liners used in chat): every edge must resolve to finite coords and a real node.

**Navigation.** Three branches via `state.view ∈ {flows, sop, reports}`, `state.flowMod` / `state.mod` (selected module, `'ALL'` = root), `state.navCollapsed` (accordion toggle). Roots **are** the "All" item (no All sub‑item). `selectFlows()` / `selectCaseStudies()` toggle/enter; `selectFlowModule()` / `selectModule()` filter; `selectReports()` is a leaf. `setActiveSidebar()` derives which submenu is open and which icon chip fills navy.

**Case Studies — numbering & tagging.** `s.displayNo` (e.g. `PO‑3`) is computed server‑side by `assignDisplayNo_()` on every parse — the client never invents it. `s.extraModules[]` lists additional modules a case is tagged into; `caseInModule(s, mod)` (both `index.html` and the React port) checks primary‑or‑tagged membership for list filtering. When a module list is filtered, a stable sort puts primary‑module matches first so tagged‑in cases never interleave with the "real" numbered sequence. List cards show a lighter‑toned `.lc-badge-tag` for **every entry in the case's own `extraModules`, always** — the badge no longer flips to show the case's primary module when viewed from a list it only appears in via tagging (fixed @70; previously a PO‑primary case tagged AP showed a self‑referential "PO" badge while browsing the AP list instead of "AP"). `Code.js`'s Doc parser and `editScenario`'s write path both now filter a case's own module out of `extraModules` (mirroring what `createScenario` already did), so a case can't end up tagged with itself in the first place.

**Case Studies — edit modal.** `openEditModal(no)` / `openNewScenarioModal()` populate `#ed_module` (module select) and, for edit only, `#ed_swapRow` (swap‑with input) and `#ed_deleteBtn`. `doSave()` sends `module`/`extraModules`; `doSwap()` calls `swapScenarioPositions`; `doDelete()` opens a custom `showConfirm()` dialog (never the native `confirm()`, which leaks the Apps Script iframe's raw URL in browser chrome) before calling `deleteScenario`.

**Edit‑modal layout (rewritten 2026‑08).** The modal is full‑screen: `.modal-full` is a flex column (sticky `h3`, scrolling‑disabled `.mf-body`, sticky `.actions`); `.mf-grid` splits it into a metadata column (`.mf-meta`, which scrolls on its own if a case carries many attachments) and a free‑text column. Inside the free‑text column ปัญหา/หมายเหตุ are fixed `em` heights and the ขั้นตอน row carries `.ta-fill`, taking `flex:1` so it absorbs the remainder. **`.ta-fill` keeps `display:grid`** (from `.modal .row`) and adds `grid-template-rows:auto minmax(0,1fr)` + `align-items:stretch`; the wrapper is a nested grid giving the textarea a `1fr` track above its hint. Converting the row to a *flex column* instead is the trap — it inherits `align-items:start` from `.modal .row`, which packs the field to its content width and made ขั้นตอน visibly narrower than its neighbours. Mobile reverts both grids to `display:block` and restores fixed heights, since a scrolling document has no spare height for a `1fr` track to claim.

**Attachments (rewritten 2026‑08).** `addAttachmentRow(label, url, focus)` builds a `.att-row` (name + URL + delete); `setAttachmentRows(atts)` / `readAttachmentRows()` replace the old textarea (de)serialisers and emit the same `{label,url}` shape. `maybeFillAttachmentName(row)` fires on paste/change of the URL field and calls `getDriveFileName` (§7) to pre‑fill the name. Its guards are the contract: it returns early if the row is marked `data-named` (set the moment the admin types in the name), if the name is non‑empty, or if the URL isn't a Drive link; the success handler re‑checks all of those **plus** that the URL hasn't changed mid‑flight. A row loaded with a real stored label is marked `data-named` up front, so existing attachments never auto‑fill — but a legacy row whose label was only ever the bare URL starts empty and *can* be filled.

**Share links (added 2026‑08).** `openInitialCase()` runs once at init (before `applyDefaultView()`, and skips it if it succeeds): reads `SOP_META.initialCase`/`initialFlow` (set server‑side from `?case=N`/`?flow=ID`, see §7) and jumps straight to that case (`selectModule`+`selectItem`) or flow (`selectFlowModule`+`selectFlow`). The Share buttons themselves call `shareCase(btn, no)` / `shareFlow(btn, id)`, both thin wrappers over `shareLink(btn, queryParam, value)`, which builds `SOP_META.appUrl + '?param=value'` and copies it via `copyText()`. `copyText()` races `navigator.clipboard.writeText()` against a 600ms timeout and falls back to `execCommand('copy')` — the Clipboard API can hang indefinitely (not just fail) inside Apps Script's sandboxed iframe, which without the timeout looked like the whole page freezing when Share was tapped; `copyEmail()` was retrofitted onto the same helper. On mobile, `moveDetailActionsMobile()` runs at the end of both `renderDetail()`'s case‑detail branch and `renderFlowDetail()`, relocating every `.d-edit` button (Share, Edit) from the title row (`.d-head`) into `#mbackDetailActions` — a slot in the sticky `.mback-row` back‑bar — so the title never has to wrap around them; it's a no‑op (and the slot stays empty/hidden) on desktop.

**Icon system.** `var ICONS = {…}` (Lucide‑style path data) + `svgIcon(name)` (returns inline `<svg class="ico">`) + `renderIcons(root)` (fills static `<span data-icon="name">` slots; called once at init). No CDN. To add an icon: add a path to `ICONS`, then use `svgIcon('name')` in generated HTML or `data-icon="name"` in static markup.

**Visual system.** "Refined corporate": design tokens in `:root` / `html.dark` (`--shadow*`, `--r-*` radii, `--ring`, `--ico`); a big appended "revamp" block near the end of `<style>` refines banner/sidebar/cards/detail/focus states.

**Version & changelog (in‑app).** `var APP_VERSION` and `var CHANGELOG = [{th,en}, …]` near the top of the main script drive the sidebar footer build string and the **Settings → About/Updates** list. **Bump `APP_VERSION` and prepend a `CHANGELOG` entry on every release.**

**Contact.** `copyEmail(btn)` = click‑to‑copy `DEV_EMAIL` (clipboard API → `execCommand` fallback → text‑selection fallback). No `mailto`.

## 15. Recent changes
- **2026‑08‑28/29** — **Editor overhaul + a dark‑mode contrast fix.** Production **@114**.
  - **Full‑screen case editor (@108→@112).** The 780px modal gave every long field its own thumbnail‑sized scrollbar. Now a sticky‑header/footer full‑screen layout with a two‑column body; ขั้นตอน absorbs the leftover height. Took five attempts, worth recording: sizing with `vh` (@108) and then `calc(100vh - 524px)` (@111) both hard‑coded constants that could not know the real chrome height, and converting the row to a flex column (@109/@110) inherited `align-items:start` and made the field narrower than its neighbours. The fix was to grow the **grid** row and let the browser measure (§14).
  - **Named attachments (@108) + Drive auto‑fill (@113).** One row per file (name/URL/delete) instead of `Label | URL` pipe syntax. Pasting a Drive link now pre‑fills the name via the new admin‑only `getDriveFileName()`; it only ever writes into an empty field and never overwrites a stored or typed label. Needed a new `drive.readonly` scope (§8). Storage shape unchanged, so no server rewrite and no migration.
  - **Dark mode (@114).** `html.dark` redefines `--brand-soft` but deliberately **not** `--brand`/`--brand-dark`/`--brand-2`, so any rule using one as a *text* colour needs its own override. Three lacked one: flow Start/End pills at **1.06:1** (invisible — the reported symptom), the Related‑Files heading at 1.49:1, and links at 3.57:1. Found by scripting the audit (walk every rule setting a brand var as `color`, cross‑reference `html.dark` overrides, compute WCAG ratios) rather than eyeballing — which also showed 6 apparent suspects were already covered. All now ≥ 4.5:1.
  - **This file was corrupted and is now repaired:** the entire document had been duplicated, with the first copy truncated mid‑sentence inside its §15. Removed the truncated copy; nothing was lost (the surviving copy is the complete one).
- **2026‑08‑05/06** — **Shareable direct links.** Case studies (`?case=N`) and process flows (`?flow=ID`) each got a **Share** button that copies a URL opening straight to that item. Server‑side: `doGet` now injects `meta.appUrl` (`ScriptApp.getService().getUrl()`) and validates/passes through the deep‑link query param (§7). Client‑side: `openInitialCase()` (init‑time), `shareLink()`/`shareCase()`/`shareFlow()`, `copyText()` (§14). Also fixed along the way: a clipboard‑copy hang that could freeze the entire page (Clipboard API now races a 600ms timeout, falls back to `execCommand`), and mobile share links landing on the branch‑menu sidebar instead of the shared case/flow (a leftover unconditional mobile‑init reset was stomping the deep link's own pane switch). Separately: Share/Edit buttons moved off the title row into the sticky mobile back‑bar so long titles stop wrapping (`.mback-row`, `moveDetailActionsMobile()`), and the desktop sidebar/case‑list columns were widened ~1cm each to reduce empty right‑side space. Production now **@82**. `DATABASE_SCHEMA.sql`/`DATABASE_DATA.sql`/`DATABASES.md` were also regenerated to match `Code.js`'s current multi‑depth step model (`kind`/`depth` replacing the old `is_substep` boolean) and the Drive‑backup addition — a structural catch‑up, not a fresh content pull (the live `/exec` URL requires a real logged‑in browser session and can't be scraped headlessly). **`react-preview/` was not touched this pass** — still at @70 feature parity, now missing all of the above.
) rendering as gibberish (@85); and Doc writes not being flushed before the post-save re-parse, so edits landed in the Doc but the app kept serving a stale cache (@86, plus a `/exec?recache=1` recovery endpoint at @87). Added **per-case file attachments** — link-only by design, deliberately avoiding the `drive` scope whose absence caused the save hang — rendered as Drive PDF thumbnails in a fixed-width "Related Files" rail (@88–92). Editor UX pass: swap target became a dropdown instead of free text, detail columns were pinned so they stop resizing between cases, and all 11 native `alert()` calls became in-app dialogs (@93–96). Made swapping fast by **relocating table rows** instead of deep-copying every cell child (@97). Mapped and attached **31 SOP flow-diagram PDFs** to all 31 cases (@98–101). Regenerated `data/sop.json`, `DATABASE_SCHEMA.sql` (new `scenario_attachments` table) and `DATABASE_DATA.sql` from live content, and brought `react-preview/` to parity with the attachments rail.
- **2026‑07‑27** — Fixed extra‑module list‑card badges to always show a case's own tags instead of flipping to its primary module when viewed from a tagged‑into list; hardened `Code.js`'s Doc parser + `editScenario` write path so a case can't end up tagged with its own module. Added an "Open NotebookLM" link button to the Reports view. Production now **@70**. Re‑synced `react-preview/` (this repo) to full feature parity: `displayNo`, `extraModules` badges, `dateAdded`, the NotebookLM link, and full admin CRUD (create/edit/swap/delete) ported into the React store/components; dead Sync‑from‑Doc leftovers removed; `styles.css` re‑extracted verbatim. `data/sop.json` stamped with computed `displayNo`/`dateAdded`; `extraModules` seeded empty (the real live tag data isn't reachable from this repo — see `react-preview/PORT_NOTES.md`).
- **2026‑07‑26** — Confirmed the Doc‑sync severance and finished removing dead code, production now **@69**:
  - Directly checked the live Apps Script **trigger store** (script.google.com → Triggers) — confirmed **empty**, no leftover `syncFromDoc` trigger.
  - Deleted `syncFromDoc()`, `removeSyncTrigger()`, and `installSyncTrigger()` from `Code.js` entirely (they had zero callers left once the trigger/button were gone in the prior pass) — not just disconnected, actually gone from the file.
  - Found and removed a **live "Sync from Doc" button** still present in the React mirror's Settings modal (`sop/src/components/SettingsModal.tsx`) — an earlier docs‑only sync pass had missed that it was still wired to a working `doSync()`/mock `syncFromDoc()`. Removed end‑to‑end: button, state, mock API function, i18n strings, orphaned CSS animation. Pushed to `VCB-dev`.
  - Re‑confirmed explicitly: **there is still no real database** — edits go to the app + the Doc backup copy only, nothing writes to Postgres yet.
- **2026‑07** — Large multi‑session pass, production **@66** at the time:
  - **One‑way architecture:** app is now the single source of truth; removed the 5‑min `syncFromDoc` trigger and the "⟲ Sync" button. Writes go app → Doc only (backup), never Doc → app.
  - **Case management from the app:** "+ New case" creation, per‑module running numbers (`displayNo`), multi‑module tagging (`extraModules`, shown as lighter list‑card badges rather than detail‑header chips), swap two cases' content/position, delete a case (custom confirm dialog, not native `confirm()`), `dateAdded` field.
  - Case detail header redesign for consistent top‑alignment regardless of title wrapping.
  - Fixed tagged‑in cases interleaving with real primary‑module cases in filtered lists; fixed a mobile number‑badge text‑wrap bug.
  - Added `DATABASE_SCHEMA.sql` / `DATABASE_DATA.sql` — full PostgreSQL export of the live content, for a possible future Postgres‑backed rewrite.
  - The React mirror (`sop/` in the separate `vcb-web-app` repo, `VCB-dev` branch) was kept in sync feature‑for‑feature with all of the above.
- **2026‑06‑03** — Large session, all in [index.html](apps-script/index.html), production **@43**:
  - Added **Process Flows** (33 swim‑lane diagrams, `SOP_FLOWS`) + native renderer; new **🗺 Process Flows** branch, default landing.
  - **Nav revamp:** three uniform branches (Process Flows / Case Studies accordion / Reports leaf), module submenus, root = "All" (removed redundant All sub‑item), grouped flow list, distinct section icons.
  - **Refined‑corporate UI revamp:** replaced all emoji with an inline **SVG line‑icon system**; refined tokens, banner, cards, focus rings, dark mode. Removed an invented banner logo mark.
  - **Settings:** added **About** (version + changelog) and **Contact** (one‑row **click‑to‑copy** email, no mailto).
- **2026‑05‑31** — Dark‑mode fixes: module cards render dark on mobile; low‑contrast text lifted (`.mhero-desc`, `.mhero-en`, `.lc-ex`).

---
*Last regenerated: 2026‑08‑29. Edit this file by hand to keep it current — it isn't auto‑generated. **Keep this file, [README.md](README.md), and the in‑app `APP_VERSION`/`CHANGELOG` in sync with every change.***
