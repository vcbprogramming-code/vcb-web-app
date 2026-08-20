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
- **Synced at:** 2026-08-20
- **Live deployment referenced:** `@216` (per `PROJECT_SUMMARY.md`); the React build
  does not call it (see *Data layer* below).

- **2026-08-20 — editor sign-in, PINs, and the shared team PIN.**

  The live app is `ANYONE_ANONYMOUS` + `USER_DEPLOYING`, so Google never tells
  the server who a visitor is (probed on the live deployment: an anonymous
  visitor yields `{"activeUser":"","effectiveUser":"<owner>"}`). `EDITOR_EMAILS`
  therefore cannot be matched against anything on its own — which is why an
  allow-listed employee saw no ✎ Edit button and had no way to discover one.

  Ported to React:
  - **`MeetingDetail.tsx`** — ✎ Edit is now shown to **everyone** (except on
    `doc-import` meetings, which nobody can edit). A visitor who is not yet an
    editor is routed to the sign-in dialog via the new `onSignIn` prop, instead
    of the button being hidden.
  - **`EditorSignInModal.tsx`** (new) — email + 4-digit PIN, including the
    forced "choose your own PIN" step when an admin created the account, so the
    admin stops knowing it.
  - **`AccessModal.tsx`** — editor rows now show whether each person can
    actually sign in (`can sign in` / `must change` / `no PIN`). Being on the
    list is only half of it, and hiding that is exactly what stranded
    employees. Plus Set/Reset PIN per person, and the optional **shared team
    PIN** with a Show/Hide toggle.
  - **`types.ts` / `mock.ts` / `client.ts`** — new `EditorAccount`,
    `EditorSession`, `SharedPinStatus`, and six server contracts mirroring
    Auth.js with the same authorization rules: 4 digits, allow-list re-checked
    at login, lockout after 5 failures, and the shared PIN is **not** a
    skeleton key (the email must still be on the list).
  - **`styles.css`** — `.modal` 560→598px and `.ac-list` 160px→`min(320px, 34vh)`,
    matching the GAS panel resize.

  **Deliberately NOT ported — the hashing.** The mock keeps PINs in plain
  memory because it is a throwaway in-memory store with no persistence and no
  real secrets; reproducing salted, iterated SHA-256 there would only obscure
  the authorization rules this mock exists to exercise. The live app hashes —
  see `hashPassword_` in Auth.js, and the measured work-factor note in
  PROJECT_SUMMARY (12000 rounds took 11.8s per login on Apps Script, hence
  1200).

  **Also GAS-only: Google Sign-In.** It needs a real OAuth client ID and a
  server that can verify the ID token with Google, neither of which a mock
  backend has. The React mirror keeps simulating identity via the `?admin=1` /
  `?editor=1` URL flags.

- **2026-08-20 — page size pinned, and dated PDF filenames.**

  `@page` had no `size`, so Paged.js (the on-screen preview) and Chrome's print
  engine chose different paper — Chrome follows the **print dialog's
  destination** — and every page break drifted. A4 is 18mm taller than US
  Letter (~68px more content per page), so items landed a page earlier in the
  PDF than on screen. `body{max-width:816px}` was a US-Letter width all along,
  contradicting the A4 the comments claimed.

  Ported to React (`src/lib/docRender.ts` — `OVERRIDE_CSS`):
  - `@page{size:A4;margin:2.7cm 17mm 2cm}` — size and **all four** margins
    explicit, so neither engine is left to default anything.
  - `body{padding:0;max-width:none;margin:0}` — **all** geometry moved to
    `@page`. Paged.js applies `body` padding *inside* its own page-margin box
    while Chrome applies it inside the page box, so identical CSS produced a
    64px narrower text column on screen and re-wrapped every paragraph.
    `padding-bottom:100px` also went: Paged.js reserved it on every page,
    Chrome applied it once after the last element.
  - `h1,h2,h3,h4{break-after:avoid;break-inside:avoid}`, `p,li{orphans:3;widows:3}`,
    `tr,img,li{break-inside:avoid}` — the engines' *defaults* differ, which is a
    second drift source independent of page size. `orphans/widows:3` because at
    the CSS default of 2 a four-line paragraph may split 2+2, which Chrome does
    and Paged.js does not.

  `OVERRIDE_CSS` is verified **byte-identical** between GAS and React (2247
  chars). The React mirror has no A4 editing surface, so the matching
  `.ed-area` geometry change (`210mm`, `2.7cm 17mm 2cm`) is GAS-only.

  Also ported: **`pdfDateSuffix()`** in `docRender.ts` + `pdfDate` on
  `SrcdocOpts`, wired from `MeetingDetail.tsx`. Exported PDFs are named
  `<title> <d.m.yy>` (`VCB Meeting Minutes 18.8.69`) — dot-separated, unpadded,
  2-digit Buddhist year, matching the convention already in the export folder.
  Undated meetings keep the plain title rather than rendering `NaN-NaN-NaN`.

  Also synced (`MeetingDetail.tsx`): the reading iframe is sized to
  `d.body.scrollHeight` exactly, dropping a `+48` pad added during the Paged.js
  work. The document already ends with `.pagedjs_pages`' own 22px bottom
  padding, so the pad rendered as a bare white strip between the last sheet and
  the attachments card. Verified across 1–4 page documents with webfonts loading
  late: nothing clips and no inner scrollbar appears without it.

- **2026-08-19 — page-accurate rendering (the big one).** The reading view, the
  PDF and the editor now break pages in identical places. **Read
  [PAGINATION.md](PAGINATION.md) before touching display, print or editor
  layout** — it records the design, the rules that must hold, and six approaches
  already tried and found not to work.

  Ported to React:
  - **`src/lib/docRender.ts`**
    - `OVERRIDE_CSS` synced with GAS: `@page` bottom margin `1.5cm → 2cm`;
      `p{margin:0;padding:4px 0}`; `ul,ol{margin:0;padding-left:26px}` with
      `li{margin:0;padding:4px 0}` (row spacing belongs to the ROW, not the
      container, or height depends on nesting depth); tick marker is now a real
      `list-style-type:'✓  '` (both `::marker{content}` and a `::before` glyph
      failed to render portably).
    - **Two `@media screen` divergences removed.** The letterhead/date were
      hidden on screen but present in print (~63px), and the screen had 48px of
      padding print lacked. Screen and print must render the *same document* or
      every page boundary after the difference shifts.
    - New `PAGED_PREVIEW_JS` / `PAGED_PREVIEW_CSS`, and `buildMeetingSrcdoc`
      split into a preview build (with Paged.js) and
      `buildMeetingSrcdocForPrint` (without). The preview CSS must load *after*
      the Paged.js script and use `!important` — Paged.js injects its own
      stylesheet at runtime and otherwise wins, silently rendering the pages as
      one continuous column.
  - **`src/components/MeetingDetail.tsx`**
    - `onFrameLoad` waits for the Paged.js page count to **settle** (three equal
      reads) rather than first appearance — reading too early reported 2 pages
      for a 7-page document — then sizes the frame and reveals it.
    - `print()` now prints from a hidden iframe built from the *un-paginated*
      srcdoc. Printing the preview would paginate an already-paginated document.
  - **`src/styles.css`**
    - `.frame-wrap` no longer scrolls (it produced a second scrollbar in the
      middle of the pane); `#detailContent` is the single scroll container.
    - `.paper` is transparent — Paged.js draws each page as its own white
      sheet, so a white panel behind them reads as a page inside a page.
    - `iframe.render` starts `visibility:hidden` with `min-height:80vh`, and
      `.attach-footer` is hidden until `.frame-wrap.ready`, so the document and
      its attachments appear together instead of painting and then jumping.

  Not ported (GAS-only, by design): the editor's hidden-iframe measuring pass
  (`measureRealPageBreaks_`), because the React mirror has no contenteditable
  page-break markers to place.
- **What changed in a follow-up 2026-08-16 audit pass** (after the editor-tier
  sync below — a full GAS-vs-React drift audit turned up two older,
  pre-existing gaps neither introduced by nor related to the editor-tier
  work; both fixed here):
  - **Attachment section placement.** GAS moved the attachments block from
    before `.frame-wrap` to *inside* it, after the `<iframe>` (2026-07-22,
    `.attach-footer` class, so it scrolls as a trailing appendix instead of
    eating screen space above the actual content — especially on mobile).
    `MeetingDetail.tsx` had never picked this up: attachments still rendered
    in the old `.attendees`-styled block before `.frame-wrap`. Moved inside
    `.frame-wrap` (after the iframe) and switched to `.attach-footer` — the
    CSS rule already existed in `styles.css` from the verbatim extract, it
    was just never referenced by any component (confirmed dead CSS via grep
    before this fix).
  - **Standalone "History" button missing from the meeting detail bar.** GAS
    has two entry points to Edit History: a standalone `d_history` button in
    `.detail-bar` (admin-only, `JavaScript.html` line ~1081/1328) for
    checking history without opening the content editor, and the in-app
    editor's own history button (editor-or-admin, since opening the editor
    itself requires that). Only the second was ported — `MeetingDetail.tsx`
    had no detail-bar history button at all, so an admin had to open the
    (editor-or-admin-gated) content editor just to check history. Added a
    `historyOpen`/`previewRequest` state pair + admin-gated `🕘 History`
    button to `MeetingDetail.tsx`, with its own `EditHistoryModal`/
    `VersionPreviewModal` instances (same pattern `EditorModal.tsx` already
    used for its own copy — GAS reuses one shared `#ehBg` DOM node for both
    entry points; React components are per-instance, so this is a second,
    independent pair rather than a shared one, with identical behavior).
- **What changed 2026-08-16 sync:**
  - **Self-service "editor" permission tier (new).** A tier between admin and
    viewer — can edit meeting content, create/delete meetings, add/remove
    attachments, and file Fathom/Transkriptor inbox recordings into projects,
    but cannot toggle hidden/pinned status, view edit history, manage access,
    or touch projects/API keys. Mirrors `EDITOR_EMAILS`/`isEditorOrAdmin_`
    (`Auth.js`) and the gate swaps on `saveMeeting`/`deleteMeeting`/
    `saveEdit`/`addAttachment`/`removeAttachment`/`setFathomTag`/
    `untagFathomMeeting` (`Code.js`). New `SessionState.isEditor` (`types.ts`),
    threaded from `mockApi.getSessionState` through `App.tsx` into
    `Sidebar.tsx` ("New meeting" button) and `MeetingDetail.tsx` ("Edit
    here", "File into project…", attachment upload/remove — all now gated on
    `isAdmin || isEditor` via a local `canEdit`, replacing bare `isAdmin`
    checks; Pin/Visibility/Edit-history stay `isAdmin`-only, unchanged).
    `resolveIdentity()` (`mock.ts`) simulates the editor identity via a new
    `?editor=1` URL flag (alongside the existing `?admin=1`), returning a new
    sample `EDITOR_EMAIL` (`seed.ts`) — admin still implies editor. New
    `getEditors`/`addEditor`/`removeEditor` `ServerApi` methods (mirrors
    `Auth.js`), backed by an in-memory `editorEmails` list in `mock.ts` and a
    matching "Editors" section added to `AccessModal.tsx` (list + add/remove,
    same `.ac-item`/`.ac-add` styling as the per-project viewer list above
    it) — admin-only to reach, same as the rest of that modal.
  - **Inbox-visibility bug fix, found during this port's own browser
    verification (not present when the GAS feature first shipped this
    session — caught before either side went stale).** Giving editors
    `setFathomTag`/`untagFathomMeeting` permission was not enough on its
    own: `getPublicBootstrap`/`getSessionState`/`listMeetings`/`getMeeting`/
    `searchMeetings` all gated the Fathom/Transkriptor Inbox tiles and rows
    on `admin` only, so an editor had no sidebar entry point to ever reach
    an inbox recording to file it. Fixed on the GAS side first (new
    `isInboxProjectId_` helper in `Config.js`; an `editor` branch added
    alongside `admin` in all five read paths), then ported here verbatim:
    `buildProjects` (`mock.ts`) now takes `(admin, editor)` instead of just
    `admin` and pushes the two inbox pseudo-projects `if (editor)`;
    `listMeetings`/`getMeeting`/`searchMeetings` each gained an `isEditor &&
    isInboxProject(r.projectId)` branch alongside their existing `isAdmin ||
    isVisible(r)` check. Verified with a scripted Playwright pass against
    the dev server (`?editor=1` sees Fathom/Transkriptor Inbox tiles, can
    open a recording, sees "File into project…"/"Edit here"/attachment
    controls, does NOT see Pin/Visibility/Settings→Project access;
    `?admin=1` still sees everything) — 12/12 checks passed after this fix
    (were 11/12 before it, the inbox-open case failing).
- **What changed 2026-08-15 sync:**
  - **Project "latest meeting" permalink (new).** A `?project=<id>` URL param
    now always resolves to that project's CURRENT latest meeting — resolved
    fresh from `listMeetings` on every load, never a stored meeting id, so the
    same pasted link keeps pointing at whatever is newest. Mirrors
    `?project=` handling in `doGet`/`startApp()` (Code.js/JavaScript.html).
    `App.tsx`'s boot effect (`queryParam('project')`) sets `activeProject`
    to the pending project id BEFORE `setActiveId` runs (same batch), so the
    sidebar highlight and list header land on the project tab immediately —
    this ordering matters because it mirrors a real bug just fixed on the GAS
    side, where `S.activeProject` was set AFTER the first `renderProjects()`/
    `renderList()` and the sidebar highlight stayed stuck on "All meetings"
    even though the correct meeting opened. React's declarative re-render
    means there's no separate "stale DOM" step to worry about here, but the
    state-ordering fix (`setActiveProject` before `setActiveId`, both in the
    same `.then()`) still needed to be applied so the two updates land in one
    render rather than flashing 'ALL' first. Falls back to resolving nothing
    (empty `ProjectDashboard` state) if the project has no meetings yet, same
    as `renderProjectDashboard()`'s empty-state branch.
  - **"Share latest-meeting link" button (new)** — `ProjectDashboard.tsx`
    gained a `shareProjectLink()` handler (mirrors `shareProjectLink()` in
    JavaScript.html) and a `🔗 Share latest-meeting link` button in the
    `.dash-head`, next to the project's exec-summary card. Needed `execUrl`
    and `onToast` threaded down as new props — `ProjectDashboard` previously
    received neither (only `MeetingDetail` had `execUrl`); `App.tsx` now
    passes `execUrl={session.execUrl} onToast={toast}` at its
    `<ProjectDashboard>` call site.
  - **GAS-side domain-scoped URL fix — verified N/A for React.**
    `getExecUrl_()` in Code.js was fixed to strip a `/a/<domain>/` Workspace
    prefix that `ScriptApp.getService().getUrl()` can return for signed-in
    Workspace accounts (it broke the `?project=`/`?meeting=` query string via
    Google's own account redirector). The mock's `execUrl`
    (`mock.ts`, `'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT_ID/exec'`)
    has no such prefix and no redirect layer, so there is nothing to strip —
    confirmed via grep, no action needed. Same "verified N/A" treatment as
    the attachment-URL note earlier in this file.
- **What changed 2026-08-09 sync:**
  - **Staff comments on meetings (new).** A new 💬 Comments button in the
    meeting detail bar (`MeetingDetail.tsx`) opens a slide-out panel — list of
    `{author, text, createdAt}` comments, a textarea + Post button, and a ✕
    delete button shown to a comment's author or an admin. New `Comment` type
    (`types.ts`) and `MeetingFull.comments: Comment[]`. New `ServerApi`
    methods `addComment`/`removeComment`, implemented in `mock.ts` (mirrors
    `addComment`/`removeComment` in Code.js: same "not signed in" / "not
    authorized" checks, same 4000-char cap) and wired through `client.ts`.
    `SeedRow` (`seed.ts`) gained an optional `comments?: Comment[]` field.
    `App.tsx` now threads a new `userEmail={session.user}` prop into
    `MeetingDetail` so the panel can tell which comments are the current
    user's own (`session.user` was already returned by `getSessionState`,
    just not consumed here before). **Note:** unlike the GAS version, this
    mock has no real anonymous-access gap to worry about — `resolveIdentity()`
    only ever returns the simulated admin or a fully empty identity (see
    *Admin simulation* below), so `addComment`/`removeComment` here just
    mirror the GAS auth rules structurally; they don't reproduce the
    real-world "anonymous visitors can't be identified" limitation described
    in `PROJECT_SUMMARY.md`'s *Known limits* — there's no non-admin identity
    in the mock to exercise that gap with.
  - **Removed the long-dead "Open in Google Docs" detail-bar button** —
    `docUrl` was computed but the button was never actually reachable in
    normal use; mirrors the same removal in `JavaScript.html`. This also
    obsoletes the "Open-in-Docs" mention in *Known deviations* #1 below (the
    button no longer exists on either side, so there is nothing left to
    deviate on for it — left the rest of that note as-is since Pin/Share
    mobile-lift placement is still a real, current deviation).
- **What changed 2026-07-26 sync:**
  - **Mobile nav-race fix on boot.** Tapping a "Latest meetings" tile (rendered
    instantly from cache on the mobile projects pane) while the initial
    `getSessionState`/`listMeetings` fetch was still in flight got silently
    reverted: the boot `.then()` unconditionally called `renderDashboard()`
    and forced the mobile pane back to `'projects'` once it resolved, even
    though the user had already navigated into a meeting. `App.tsx`'s boot
    effect now checks whether a meeting is already open (functional
    `setActiveId` read) before resetting the pane — mirrors the
    `S.activeId`/`PENDING_MEETING` guard added to `startApp()` in
    JavaScript.html.
  - **Skeleton placeholder for mobile "Latest meetings" tiles.** Before this,
    `#mobileLatest`/`<MobileLatest>` rendered nothing until data loaded, so it
    took up zero height and the project list sat flush at the top — then
    shifted downward the instant real tiles popped in, right under a user's
    thumb. `MobileLatest.tsx` now renders two inert, non-clickable
    `.ml-skeleton` tiles (same size as real `.ml-item`s) whenever `!loaded &&
    latest.length === 0`, so the reserved space never changes; `Sidebar.tsx`
    and `App.tsx` thread the existing `loaded` state through as a new prop.
    Matching `renderMobileLatestSkeleton()` + `.ml-skeleton` CSS (pulse
    animation) added to JavaScript.html/Stylesheet.html.
  - **Synced to GitHub monorepo, not just this folder.** This session's two
    fixes above were also pushed to `vcb-web-app` (`VCB-dev` branch,
    `meeting-minutes/` folder) — see that repo's commit
    `meeting-minutes: sync React mirror with mobile nav-race and
    skeleton-loader fixes`. That monorepo copy had drifted ~1 month behind
    this folder; only these two fixes' files actually differed once copied
    over (everything else was already in sync, confirmed via full-tree diff).
- **What changed 2026-07-23 sync:**
  - **6-card desktop cap on "Latest meetings"** — `Dashboard.tsx` mirrors
    `renderDashboard()`'s change in JavaScript.html.
  - **Anti-tampering QR print stamp** — `docRender.ts` gained
    `verifyQrDataUri`/`buildQrPageCss` (ported from `buildQrPageCss_`/the QR
    stamp logic added to Code.js/JavaScript.html this session), backed by a
    new `src/lib/vendor/qrcodeGenerator.ts` (`@ts-nocheck`, vendored TS port
    of the same MIT-licensed QR encoder as `QrCode.html`). Also picked up the
    `@page{margin-top:2.7cm;margin-bottom:1.5cm}` print/PDF margin fix and
    the screen-only `body` top padding fix in `OVERRIDE_CSS`.
  - **PDF filename fix** — `buildMeetingSrcdoc` (`docRender.ts`) takes new
    `pdfTitle`/`execUrl`/`meetingId` options and sets `document.title` inside
    the iframe so a browser's Print-to-PDF picks up a meaningful filename.
    Unlike the GAS version (blocked there by the IFRAME-sandbox host page
    problem), this React SPA's iframe has no such nesting issue, so the fix
    applies cleanly. `MeetingDetail.tsx` wires the new options through.
  - **Pin badge simplified** — `MeetingList.tsx`/`ProjectDashboard.tsx`:
    `★ Pinned` text badge → bare `★` with a `title="Pinned"` tooltip, mirrors
    the same GAS-side change made earlier this session.
  - **Checklist (green tick) list button** — `EditorModal.tsx` gained
    `tickList()` + a `✓ List` toolbar button, mirrors `#edTickList`/
    `el('edTickList').onclick` in JavaScript.html verbatim (reuses
    `execCommand('insertUnorderedList')` for correct `<ul>` nesting, then
    tags the resulting `<ul>` with `.tick-list`). The matching `.tick-list`
    CSS (list-style:none + green `✓` via `::before`) was ported to both
    `styles.css` (`.ed-area .tick-list`, live editor) and `docRender.ts`'s
    `OVERRIDE_CSS` (`.tick-list`, A4/print render) — this CSS was initially
    missing from both files when first reviewed and has been added to match
    `Stylesheet.html`/`JavaScript.html`'s `OVERRIDE_CSS` exactly.
  - **Plain-text paste normalization** — `handleAreaPaste` in
    `EditorModal.tsx` no longer falls through to the browser's native
    plain-text paste; plain-text clipboard content (no HTML) is now split on
    newlines into `<p>` elements (blank lines → `<br>`) and inserted via
    Range, same as the HTML branch, so pasted plain text can never inherit
    ambient formatting from the cursor's surrounding context. Mirrors the
    `#edArea` paste listener's `else` branch in JavaScript.html verbatim.
  - **Attachment URL fix (`uc?export=download` → `/view`) — verified N/A for
    React.** Code.js's `getMeeting` builds a real Drive share URL from a
    `fileId`; the React mock (`mock.ts`'s `addAttachment`/`getMeeting`) has
    no Drive host at all and stores a `data:` URL directly at upload time
    (documented, intentional deviation — see *Known deviations* #2), so
    there is no `uc?export=download` string anywhere in the React tree to
    fix. Confirmed via full-tree grep — no action needed.
- **What changed 2026-07-22 sync:**
  - **File attachments (backfilled from an earlier, previously-uncommitted
    pass).** Upload/remove attachments on a meeting, a 📎 count badge on
    cards, and an attachment list in the detail view — `Attachment` type
    (`types.ts`), `addAttachment`/`removeAttachment` (`ServerApi`/`mock.ts`/
    `client.ts`), the attachment chips + upload button + remove confirm in
    `MeetingDetail.tsx`, the 📎 badge in `MeetingList.tsx`, and the file-type
    icon/size helpers in `lib/ui.ts` (`fileIconKind`/`fmtFileSize`/
    `fileToBase64`). This existed in the working tree before this sync
    started (verified working via a real browser test) but had never been
    committed — *Known deviations* #2 is updated below to reflect that
    attachments ARE now ported (it previously said they were out of scope
    entirely).
  - **Fathom transcript pulling removed entirely** — mirrors
    `registerFathomWebhook` dropping `include_transcript` and
    `ingestFathomPayloadLocked_`/`fathomRecordToHtml_` never reading/
    rendering a transcript field in Code.js (a real payload's transcript
    turn-shape didn't match `t.text`/`t.speaker`, producing literal
    `"[object Object]:"` lines). The mock never had a transcript concept for
    Fathom rows to begin with (`SeedRow`/`MeetingFull` have no transcript
    field, and the Fathom seed content in `seed.ts` was always
    recording-link + summary + action items only) — nothing to remove,
    confirmed already correct.
  - **Fathom/Transkriptor AI-summary section headers are bold paragraphs,
    never real `<h1>`-`<h6>` tags** — mirrors `fathomMarkdownToHtml_`/
    `transkriptorMarkdownToHtml_`/`transkriptorRecordToHtml_`'s 2026-07-21
    change in Code.js (a real heading is a colored block container that
    contenteditable silently continues into on Enter, with no visible
    boundary; a bold run has a clear one). The Fathom/Transkriptor sample
    rows in `seed.ts` (`fathom-erp-po`, `fathom-bv-overview`,
    `fathom-untitled-call`, `transkriptor-bt12-siteissue`,
    `transkriptor-untagged-standup`) previously used real `<h3>`/`<h2>` tags
    for their "Key Takeaways"/"Meeting Purpose"/"Summary"/"Action items"
    section headers — converted to `<p><b>...</b></p>` to match. The 5
    Doc-import seed meetings (FIN/BD/BT12/BV/PN34) intentionally keep real
    `<h1>` tags — those model actual Google Doc content, which still uses
    real headings; only AI-generated Fathom/Transkriptor summaries changed.
  - **Editor Enter-key handling rewritten to direct Range/DOM manipulation,
    off `document.execCommand`** — `EditorModal.tsx`'s `.ed-area` (a real
    `contentEditable` div, so this ports directly) gained a
    `splitBlockAtCursor` helper + `onKeyDown` handler mirroring
    `splitBlockAtCursor_`/the `#edArea` keydown listener in JavaScript.html
    verbatim: finds the closest `li`/heading ancestor of the cursor via
    `.closest()`, and if found, manually splits it via
    `Range.cloneRange()`/`setEnd()`/`extractContents()` into a new sibling
    element — never `execCommand('insertParagraph'/'formatBlock')`, which
    browser vendors never implemented consistently for list-splitting. An
    Enter at the very start of a heading (cursor position 0) removes the
    original (now-empty) heading and keeps only the new paragraph, exactly
    like the GAS version. Toolbar buttons (Bold/Italic/lists/link) still use
    `execCommand` — only Enter-key and paste were rewritten, matching GAS.
  - **Editor paste handling rewritten, also off `execCommand`** — a new
    `onPaste` handler + `sanitizePastedNode`/`PASTE_ALLOWED_TAGS` in
    `EditorModal.tsx` mirror `sanitizePastedNode_`/the `#edArea` paste
    listener in JavaScript.html verbatim: reads `clipboardData.getData
    ('text/html')`; falls through to the browser's default plain-text paste
    if there's no HTML; otherwise parses via `DOMParser`, recursively
    sanitizes (allow-list `B,STRONG,I,EM,U,A,UL,OL,LI,BR,P` keep their tag
    with all attributes stripped except `href`+`target=_blank` on `<a>`;
    `DIV`→`<p>`; everything else unwrapped to its children), and inserts the
    sanitized fragment via `Range.insertNode()` — never
    `execCommand('insertHTML', ...)`, same root-cause reasoning as the
    Enter-key fix (execCommand's insertion logic mis-nests lists when the
    target is already inside an existing `<li>`/`<ul>`).
  - **Version history now captures title/dateLabel/time alongside body
    content** — real schema change, mirrors `getVersionsSheet_`'s 8-column
    schema / `snapshotVersion_(meetingId, html, meta)` / `saveContent_(id,
    html, skipSnapshot, preEditMeta)` in Code.js. `getOriginalContent`/
    `getVersionContent` now return `VersionContent`
    (`{ html, title, dateLabel, time }`, `types.ts`) instead of a bare HTML
    string. `mock.ts`'s in-memory `versions` store gained `title`/
    `dateLabel`/`time` fields; `snapshotVersion(meetingId, html, meta)` takes
    a 3rd `meta` param, and `saveEdit`'s call site passes the row's PRE-edit
    `{ title, dateLabel, time }` (captured before the row is overwritten a
    few lines later — same ordering constraint as Code.js's preEditMeta).
    `VersionPreviewModal.tsx` now reads title/dateLabel/time from the
    fetched `VersionContent` result for its header (falling back to the live
    `meeting` prop only when the snapshot's title is `''` — a pre-fix
    snapshot with no captured metadata, same fallback Code.js documents),
    fixing the same bug the GAS change fixed: renaming a meeting no longer
    changes what its own "Original"/past-version previews show. Note:
    `mock.ts`'s `saveMeeting` (the New/Edit meeting modal path) still does
    not call `snapshotVersion`/`logAudit` at all on its edit branch — that
    was already true before this sync (Code.js's `saveMeeting` does call
    both) and is unrelated to today's schema change; flagging it here as a
    pre-existing gap for whoever picks this up next, not something this
    sync introduced or fixed.
  - **A4 render dark-mode support (new — this pass, not carried from
    2026-07-21 as previously assumed)** — `lib/docRender.ts` gained
    `DARK_OVERRIDE_CSS` (verbatim from JavaScript.html, `@media screen`-only
    so it can never leak into Print/PDF) and `buildMeetingSrcdoc` takes a 4th
    `opts: { isDark?, aiDisclaimer? }` param. `MeetingDetail.tsx` now takes a
    `theme` prop (threaded from `App.tsx`'s `theme` state) purely so the
    component re-renders — and therefore recomputes `srcdoc` — on every
    theme toggle, not just once when a meeting first opens; mirrors
    `applyTheme`'s `renderDetail()` re-render call in JavaScript.html. Before
    this pass `docRender.ts` had no dark-mode CSS at all, so this was a real
    gap, not just a "verify" item.
  - **Company letterhead + date line hidden on-screen, kept for print only**
    — `OVERRIDE_CSS` in `docRender.ts` gained the same
    `@media screen{.vcb-letterhead,.vcb-letterdate{display:none}}` rule as
    JavaScript.html (duplicated the title+date already shown in the outer
    detail-bar header).
  - **AI-generated-summary disclaimer banner (new), display-only** —
    `docRender.ts` exports `AI_DISCLAIMER_HTML` (verbatim banner markup/copy)
    plus the `.ai-disclaimer` rule in `OVERRIDE_CSS`/`DARK_OVERRIDE_CSS`.
    `MeetingDetail.tsx` passes `aiDisclaimer: m.source === 'fathom' ||
    m.source === 'transkriptor'` into `buildMeetingSrcdoc`;
    `VersionPreviewModal.tsx` does the same gated on the live `meeting`
    prop's source (versions don't carry their own source field). Purely
    injected into the srcdoc string at render time — never written into
    `m.content`/the mock row — so it can never pollute `excerpt`
    (`stripTags(html).slice(0,200)`) or `searchMeetings`, mirroring the
    explicit "display-only" constraint in Code.js/JavaScript.html. Note:
    `.ai-disclaimer` is NOT in `Stylesheet.html`'s `<style>` block (it's
    built into the `OVERRIDE_CSS`/`DARK_OVERRIDE_CSS` JS strings instead), so
    it correctly does not appear in `src/styles.css` after re-extraction —
    verified.
  - **In-app editor always re-fetches fresh content before opening** —
    `MeetingDetail.tsx`'s "Edit here" button now calls a new `openEditFresh`
    handler that fetches `api.getMeeting(m.id, token)` fresh (with
    `onBusy('Loading…')`/`onBusy(null)` around it), updates the shared
    content cache via `setCached`, and only then calls `onEdit(fresh || m)`
    — instead of the previous `onClick={() => onEdit(m)}`, which reused
    whatever `MeetingDetail`'s own component state already held from when
    the detail view first loaded. Mirrors `d_editapp`'s onclick handler in
    JavaScript.html (fixes the same bug: a Fathom/Transkriptor force-refresh
    landing on the server while a tab already had the meeting open used to
    show stale content in the editor, risking silently overwriting the
    server's newer version on save).
  - **Fathom/Transkriptor Inbox sidebar dot color changed to neutral grey**
    — `FATHOM_INBOX_PROJECT`/`TRANSKRIPTOR_INBOX_PROJECT` in `seed.ts` both
    changed to `'#8b949e'` (was `'#57606a'` for Fathom, `'#bc4c00'` orange
    for Transkriptor), mirrors `FATHOM_INBOX_META`/`TRANSKRIPTOR_INBOX_META`
    in Config.js — an inbox is a temporary review queue, not a real
    designated project, so it shouldn't have its own distinct accent color.
  - `src/styles.css` re-extracted verbatim per the documented `sed` command;
    picked up two small unrelated dark-mode fixes already present in the
    current `Stylesheet.html` (`.date-field input` selector broadened from
    `input#m_date`, `.cal-pop` background switched to `var(--panel))`, and a
    new `html.theme-dark .paper{background:#161b22}` rule) — verbatim
    re-extraction, not something to second-guess.
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
- **What changed 2026-07-21 sync:**
  - **Timeline (new)** — `components/Timeline.tsx`, entry point is the
    `#timelineBtn` "📅 Timeline" button rendered in `Sidebar.tsx` (desktop-only —
    hidden via the existing verbatim `html.is-mobile #timelineBtn` CSS rule, no
    extra JS needed). Sets `activeProject` to the sentinel `'TIMELINE'`
    (`App.tsx`'s `TIMELINE_PROJECT`), which: (1) makes `MeetingList.tsx` render
    an empty collapsed list column (mirrors `renderList()`'s early branch —
    `listHead` becomes "Timeline", `rangeFilter`/`cards` cleared), (2) adds a
    `timeline-mode` class to the `.body` wrapper so the verbatim
    `.body.timeline-mode` CSS collapses that column's grid track to 0, and (3)
    renders `<Timeline>` in the detail pane. Both view modes (Horizontal /
    Calendar year-grid) and the inline SVG bar-chart/calendar icons are ported
    verbatim from `renderTimeline()`/`renderTimelineHorizontal()`/
    `renderTimelineCalendar()` in `JavaScript.html`. Per-project toggle chips
    use local `useState` instead of the GAS module-level `TL_HIDDEN_PROJECTS`/
    `TL_MODE`/`TL_YEAR` globals — same behavior, React-idiomatic state instead.
    Clicking a dot/day calls the same `onOpen` as everywhere else; per GAS,
    opening a meeting from Timeline does NOT clear `activeProject` back to a
    real project id, so the list column stays collapsed even while a meeting
    is open (verified against `openMeeting()`'s `renderList()` call order in
    JavaScript.html — do not "fix" this by clearing `activeProject` on open).
  - **Transkriptor Inbox (new)** — mirrors Fathom Inbox exactly. New
    `TRANSKRIPTOR_INBOX_ID` constant + `isInboxProject(id)` helper in
    `types.ts` (replaces the old direct `=== FATHOM_INBOX_ID` checks
    throughout, mirroring the `isInboxProject_` helper introduced in
    JavaScript.html) — used in `Sidebar.tsx`, `Dashboard.tsx`,
    `MobileLatest.tsx`, `MeetingList.tsx`, `TagPickerModal.tsx`. New
    `'transkriptor'` value on `MeetingSource`. `mockApi.setFathomTag` now
    accepts rows from either inbox (checks `isInboxProject(r.projectId)`
    instead of `=== FATHOM_INBOX_ID`), matching the generalized
    `setFathomTag` in Code.js. The `▤ Transkriptor` badge (vs `▶ Fathom`) and
    the "File into project…" gate now check
    `source === 'fathom' || source === 'transkriptor'` in `MeetingDetail.tsx`,
    `MeetingList.tsx`, `Dashboard.tsx`, `ProjectDashboard.tsx` (the 3 render
    spots the GAS diff called out). Seed data: `TRANSKRIPTOR_INBOX_PROJECT`
    + two sample rows (one tagged into BT12, one untagged) in `seed.ts`.
    Server-side ingestion (`backfillTranskriptorMeetings`, Transkriptor REST
    polling, hourly trigger, summary markdown parsing) is server-only — same
    "not ported" treatment as Fathom's backfill (see the table below).
  - **Delete meeting (new)** — "🗑 Delete meeting" button in `EditorModal.tsx`,
    confirms via the new `useConfirm()` dialog, then calls
    `mockApi.deleteMeeting` and returns to the dashboard/placeholder
    (`onDeleted` prop, wired to `onEditorDeleted` in `App.tsx`).
  - **Styled confirm/prompt dialogs (new)** — `components/ConfirmPrompt.tsx`
    exports `useConfirm()`/`usePrompt()` hooks (each returns a
    `{ confirm/prompt, node }` pair — render `node` once near the component
    root, call the function to get a promise) mirroring `confirmDialog()`/
    `promptDialog()` in JavaScript.html: Escape-to-cancel, Enter-to-confirm
    (prompt only), backdrop-click-to-cancel. Used in `EditorModal.tsx` for
    "Delete this meeting?" and "Discard unsaved changes?" (Cancel button now
    snapshots initial title/date/time/body state and only prompts if it
    actually changed — mirrors `editorSnapshot_()`/`ED_SNAPSHOT` in
    JavaScript.html) and for the "Add a link" URL prompt (with
    selection-range save/restore around the dialog, since it steals focus —
    mirrors `el('edLink').onclick`). Not yet wired into attachment removal
    since attachments themselves are not ported (see *Known deviations* #2 —
    out of scope, server-only Drive concern).
  - **Editable meeting date/time in the in-app editor** — `EditorModal.tsx`'s
    `.ed-meta` row now has Title/Date/Time inputs (was a read-only
    `<span id="edTitle">`); Save now sends `{ title, dateLabel, time }` as
    a 4th `meta` param to `saveEdit` (`SaveEditMeta` in `types.ts`). Mock's
    `saveEdit` applies `meta` fields when present, re-deriving `date` from
    `dateLabel` via the existing `parseDateLabel` helper.
  - **Editor toolbar simplified** — Heading/Subheading/Normal format-block
    buttons removed from `EditorModal.tsx`'s toolbar (only Bold/Italic,
    bullet/numbered list, and link/unlink remain), matching the buttons
    removed from `.ed-toolbar` in Index.html.
  - **Edit History + Version Preview (new — see note below).**
    `components/EditHistoryModal.tsx` + `components/VersionPreviewModal.tsx`,
    reachable via the "🕘 Edit history" button in `EditorModal.tsx`. Filters
    `create_*` actions out of the activity list (they'd duplicate the pinned
    "Original" row) and shows `Created <real timestamp>` when
    `meeting.createdAt` is available, else the generic fallback label —
    mirrors the exact filtering/label logic in `renderEditHistory()`. Backed
    by 3 new `ServerApi` methods (`getAuditHistory`, `getOriginalContent`,
    `getVersionContent`) and an in-memory audit-log + version-snapshot store
    in `mock.ts` (`auditLog`/`versions` arrays, `logAudit`/`snapshotVersion`
    helpers) — every mutating mock call (`saveMeeting`, `deleteMeeting`,
    `saveEdit`, `setFathomTag`, `untagFathomMeeting`, `createProject`,
    `renameProject`) now also appends an audit entry, mirroring
    `auditLog_()` calls in Code.js. **Note:** this whole feature (audit log /
    version history / edit history panel) was actually added to the GAS
    source earlier, in the audit-log/version-history/attachments commit
    that predates the 2026-07-18 sync boundary — it had been missed in an
    earlier sync and had NO React equivalent at all before this pass. It's
    included now because the 2026-07-19 GAS change (filtering `create_*` +
    the real-createdAt label) has nowhere else to live; consider this pass
    "backfilling" a previously-missed feature, not itself a 2026-07-21 GAS
    change. File attachments (also added in that same GAS commit) remain
    genuinely out of scope — see *Known deviations* #2.
  - **Removed dead "Refresh now" / autoSync** — `SettingsModal.tsx`'s
    "🔄 Refresh now" button and `App.tsx`'s `manualRefresh`/background
    `autoSync` boot call are gone; `ServerApi.autoSync`/`SyncResult` were
    removed from `types.ts`/`mock.ts`/`client.ts` entirely, and the
    `refreshNow`/`refreshing`/`alreadyUpToDate`/`updated`/`newWord`/
    `changedWord`/`refreshFailed` i18n strings were removed from
    `lib/i18n.ts`. Mirrors Code.js: Docs stopped being the source of truth
    2026-07-19, so `autoSync` had become a permanent no-op kept only for
    backward compatibility — now even that compatibility shim is deleted
    server-side, so there is nothing left to mirror.
  - **Redundant green "source" badge removed** from `MeetingList.tsx`'s card
    rendering (used to also echo `m.source` as raw text next to the red
    `▶ Fathom` badge — pure redundant noise). Kept: hidden/pin/overview/
    Fathom/Transkriptor badges.
  - `MeetingFull` gained `createdAt` (was already returned by `getMeeting` in
    Code.js, just not surfaced in `types.ts`) — needed for the Edit History
    "Original" row's real-timestamp label.

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
| `togglePin` | `mockApi.togglePin` | `boolean` |
| `setVisibility` | `mockApi.setVisibility` | `boolean` |
| `saveMeeting` | `mockApi.saveMeeting` | `string` (id) |
| `deleteMeeting` | `mockApi.deleteMeeting` | `boolean` |
| `saveEdit` (now takes optional 4th `meta` param) | `mockApi.saveEdit` | `SaveEditResult` |
| `getProjectAccess` | `mockApi.getProjectAccess` | `ProjectAccess[]` |
| `setProjectDomain` | `mockApi.setProjectDomain` | `ProjectAccess[]` |
| `addProjectViewer` | `mockApi.addProjectViewer` | `ProjectAccess[]` |
| `removeProjectViewer` | `mockApi.removeProjectViewer` | `ProjectAccess[]` |
| `getEditors` | `mockApi.getEditors` | `string[]` |
| `addEditor` | `mockApi.addEditor` | `string[]` |
| `removeEditor` | `mockApi.removeEditor` | `string[]` |
| `setFathomTag` (now accepts either inbox's rows) | `mockApi.setFathomTag` | `ProjectId[]` (full tag list) |
| `untagFathomMeeting` | `mockApi.untagFathomMeeting` | `ProjectId[]` (full tag list) |
| `searchMeetings` | `mockApi.searchMeetings` | `string[]` (matching ids) |
| `createProject` | `mockApi.createProject` | `CreatedProject` (docId/docUrl always `''` — tag-only) |
| `renameProject` | `mockApi.renameProject` | `Project` |
| `getAuditHistory` | `mockApi.getAuditHistory` | `AuditEntry[]` |
| `getOriginalContent` | `mockApi.getOriginalContent` | `VersionContent` (`{html,title,dateLabel,time}` — 2026-07-22, was a bare `string`) |
| `getVersionContent` | `mockApi.getVersionContent` | `VersionContent` (`{html,title,dateLabel,time}` — 2026-07-22, was a bare `string`) |
| `addAttachment` | `mockApi.addAttachment` | `Attachment[]` (full updated list) |
| `removeAttachment` | `mockApi.removeAttachment` | `Attachment[]` (full updated list) |
| `addComment` | `mockApi.addComment` | `Comment[]` (full updated list) |
| `removeComment` | `mockApi.removeComment` | `Comment[]` (full updated list) |

`autoSync` is no longer in this table — it was removed from Code.js entirely
2026-07-21 (had been a permanent no-op since Docs stopped being the source of
truth 2026-07-19). The React mock's `autoSync`/`SyncResult` and the
Settings-sheet "🔄 Refresh now" button were removed to match.

Not ported (server-only, no client-facing equivalent needed): `doPost` webhook
intake, `ingestFathomPayload_`, `backfillFathomMeetings`/`refreshFathomMeetings`,
`registerFathomWebhook`, `backfillTranskriptorMeetings`, the Transkriptor REST
API polling + hourly trigger + summary markdown parsing
(`transkriptorMarkdownToHtml_`/`transkriptorRecordToHtml_`), `setTranskriptorApiKey`,
`diagFathomRaw_`/`diagFathomDupes_`/`diagExtraProjects_`, `detachProjectDoc`,
`autoCleanupErpDoc_` — these populate/repair the row store that
`listMeetings`/`getMeeting` read from; the mock's Fathom/Transkriptor seed rows
in `seed.ts` stand in for what a real backfill/webhook/poll delivery would
have produced. `addAttachment`/`removeAttachment` (file attachments) ARE
ported (see the table above and *Known deviations* #2) — the underlying Drive
upload/storage plumbing they wrap in Code.js is what's out of scope, not the
client-facing feature itself.

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
| in-app editor `openEditor()`, `splitBlockAtCursor_`, `sanitizePastedNode_` (Enter/paste — off `execCommand`, direct Range/DOM) | `components/EditorModal.tsx` |
| project access `openAccess()` | `components/AccessModal.tsx` |
| settings sheet `openSettings()` | `components/SettingsModal.tsx` |
| busy / toast | `components/Overlays.tsx` |
| `I18N`, `fmtDate`/`fmtTime`/`fmtThaiDate` | `lib/i18n.ts` |
| `OVERRIDE_CSS`/`DARK_OVERRIDE_CSS`, AI disclaimer banner, section extraction, bullets | `lib/docRender.ts` |
| mobile panes, range math, theme/lang apply, `applyMobileScale` | `lib/ui.ts` |
| `S.contentCache`, `prefetchLatest()` | `api/contentCache.ts` |
| tag picker `openTagPicker()` / `suggestProjectFor_()` | `components/TagPickerModal.tsx` |
| per-chip untag ✕ in `renderDetail()` | inline in `components/MeetingDetail.tsx` |
| "New project" modal + `createProject` | `components/NewProjectModal.tsx` |
| rename project (pencil icon) + `renameProject` | `components/RenameProjectModal.tsx` |
| `#timelineBtn` + `renderTimeline()`/`renderTimelineHorizontal()`/`renderTimelineCalendar()` | `components/Timeline.tsx` |
| `confirmDialog()` / `#cfBg` | `useConfirm()` in `components/ConfirmPrompt.tsx` |
| `promptDialog()` / `#ipBg` | `usePrompt()` in `components/ConfirmPrompt.tsx` |
| edit history `openEditHistory()`/`renderEditHistory()` / `#ehBg` | `components/EditHistoryModal.tsx` |
| version preview `renderVersionPreviewHtml()` / `#vpBg` | `components/VersionPreviewModal.tsx` |
| `isInboxProject_()` | `isInboxProject()` in `types.ts` |

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

**Transkriptor Inbox (added 2026-07-21) mirrors every rule above exactly** —
`TRANSKRIPTOR_INBOX_ID` in `types.ts`, source `'transkriptor'`, same
never-moves/additive-tagging/excluded-from-ALL/hint-only-suggestion rules.
Use `isInboxProject(id)` (also in `types.ts`) rather than comparing against
either constant directly — it covers both pseudo-projects in one call and is
what every component listed in the mapping table above actually uses.

## Admin / editor simulation
The live web app requires its own magic-link sign-in (see `PROJECT_SUMMARY.md`'s
*Access model*), so `isAdmin`/`isEditor` depend on which email signed in. To make
every admin/editor screen reachable for sign-off, the mock derives identity from a
**URL flag**:

- `http://localhost:5200/?admin=1` → admin view (New meeting, pin, hide/show,
  edit-here, project access incl. Editors, Fathom/Transkriptor Inbox).
- `http://localhost:5200/?editor=1` → editor view (New meeting, edit-here, file
  into project, attachments, Fathom/Transkriptor Inbox — no pin/hide/show, no
  Settings → Project access).
- `http://localhost:5200/` → public view (what a signed-out visitor gets).
- `?meeting=<id>` → deep-link straight into a meeting (parity with the GAS share link).
- `?project=<id>` → deep-link into a project's CURRENT latest meeting, re-resolved
  on every load (parity with the GAS project permalink — see the 2026-08-15 sync
  note above). e.g. `http://localhost:5200/?project=FIN`.

This is a faithful entry hook, not an added feature — the GAS code already branches
on `isAdmin`/`isEditor` everywhere.

## Known deviations (intentional)
1. **Mobile detail action lift:** the GAS client physically *moves* the Pin/Share
   buttons onto the mobile back-bar via DOM ops (the old third button in that lift,
   "Open in Google Docs", was dead code and removed entirely 2026-08-09 — see that
   sync note above). Here they stay in the detail bar (CSS still orders/hides them
   on mobile). Desktop is identical; this is a minor mobile-only placement nuance.
2. **Doc reskin / importer / Drive-chip generation** are server-only GAS concerns
   (they shape the stored HTML). The mock ships already-rendered sample HTML, so the
   render path is identical; the import-time transforms are out of scope for the SPA.
   **File attachments** (`addAttachment`/`removeAttachment`, the 📎 count badge,
   the attachment list/upload UI in `renderDetail()`) ARE ported (2026-07-22 —
   this note previously said they were out of scope entirely, which is now
   stale) — see `types.ts`'s `Attachment`, `mock.ts`'s upload/remove handlers,
   and the attachment chips/upload button in `MeetingDetail.tsx`. The one real
   deviation: the mock has no Drive/file host, so an uploaded file is kept as
   an in-memory `data:` URL instead of a real Drive share link — good enough
   to actually open/download in the browser, which is all the UI needs to
   prove; same MIME allow-list and 25MB cap as Code.js.
3. **Magic-link sign-in** (`requestMagicLink`/session tokens in `Auth.js`) is active
   in the GAS source (corrected 2026-08-16 — this note previously said it was
   retired/vestigial, which was stale) but not reproduced here: the mock has no
   concept of an emailed one-time link or session cookie, and derives identity
   purely from the `?admin=1`/`?editor=1` URL flags described in *Admin / editor
   simulation* above. Reproducing the real flow (email send, token consume,
   session persistence) would need a mail-sending backend this static mock
   doesn't have — out of scope unless a real server is wired up (see *Data layer*).
4. **Timeline per-project toggle state / mode / year** are component-local
   `useState` in `Timeline.tsx` rather than the GAS module-level `TL_*`
   globals — resets on navigating away and back, same as any other React
   component here (e.g. `MeetingList`'s range filter). Not a behavior gap the
   user would notice; noted for anyone diffing against JavaScript.html.
