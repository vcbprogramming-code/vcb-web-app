# VCB Onboarding Portal — React/TypeScript port

A full React + TypeScript + Supabase port of the original app, which lives alongside this folder at `../ORIGINAL CODE/src/` as a Google Apps Script web app. Built with Vite (`react-ts` template) + React Router + `@supabase/supabase-js`.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own Supabase project's URL + anon key
```

Then, in your Supabase project's SQL Editor, run `supabase/schema.sql` once — it creates the `employees`, `progress`, and `checklist_overrides` tables, the `required-documents` Storage bucket, and the `check_admin_password` function. Read its comments before running in a shared/production project — a couple of pieces (the admin password RPC, and the Storage bucket's public flag) have tradeoffs called out inline.

```bash
npm run dev      # start the dev server
npm run build    # typecheck + production build
```

## What's ported

This is a complete, department-by-department, feature-by-feature port — every page, all 5 departments' real checklist content, the full org chart, the admin editor, and the completion certificate all exist and render. Specifically:

- **All 5 departments, fully** (`src/data/{accounting,finance,procurement,property,engineering}.ts`) — landing pages (supervisor, overview, workflow) and all 3 phases each (Day 1–30/31–60/61–90), every checklist item's real text and permanent id transcribed verbatim from the original app's `content.html`, Junior/Senior track filtering, and phase-locking (can't start phase 2 until phase 1 is complete).
- **Home** (`src/pages/Home.tsx`) — hero, CEO welcome quote, Culture & Values (4 tiles), Our Track Record. Photos are placeholders — see "Images" below.
- **Required Documents** — all 8 real documents with real Drive view/download links, a "Complete" checkbox, and a working **Upload** button that saves to Supabase Storage (replacing the original's Drive-upload flow).
- **Department Selection** grid, linking to all 5 departments.
- **Completion page** — gated exactly like the original (`isEmployeeOnboardingComplete` ported as a plain check across every phase in the employee's department), showing the Meet Our Team / Life on Site cards and a **Print Completion Form** button that renders a full printable certificate (`src/components/CompletionCertificate.tsx`) — letterhead, per-phase rating tables (Knowledge Requirements + Required Outputs, Required Reading excluded per the original's own reasoning), a page-2 Attitude & Working Relationships section, and signature blocks.
- **Company Structure / Org Chart** (`src/components/orgchart/`, `src/data/orgChart.ts`) — the full 4-level Leadership hierarchy, all 7 Head Office departments (including Asset Management's two-branch split), all 5 Project Sites with their 9-department matrix structure (Site Operations/Site Administration, PM header, "Reports to X" tags), and the Group Structure view (shareholders, VCB, 2 family-owned sibling companies, 2 subsidiaries, 4 joint ventures) — all real data, transcribed verbatim.
- **Admin checklist editor** (`src/pages/AdminPage.tsx`) — password-gated (via a Postgres RPC, see "Auth/security notes" below), department/phase/block navigation, edit/delete existing items, with overrides layered onto the hardcoded content at render time (`src/lib/applyOverrides.ts`) exactly like the original's `applyChecklistOverrides`.
- **EN/TH translations** (`src/lib/translations.ts`) — all 481 entries from the original's `TH_DICT`, wired through a `LangContext` (`src/lib/LangContext.tsx`) so any component can call `t(str)`.
- **Light/dark theme** (`src/lib/useTheme.ts`) — same tokens, same `localStorage` key, as the original.
- **Save-failure handling** — one automatic retry, then reverts the checkbox on a second failure, ported from the original's `syncTaskDone` (`src/lib/useProgress.ts`).

## What's deliberately different from the original

- **Org chart connector lines are plain CSS**, not hand-measured DOM positions. The original's `renderOrgConnectors`/`getBoundingClientRect()` technique was its own docs' "second most fragile part of this app" (five-plus real rounds of bugs) — this port uses CSS Grid/flexbox + border-based tree guides instead (`src/components/orgchart/orgchart.css`), which reflow correctly on every React re-render with no imperative measurement step. Visually similar, not pixel-identical to the original's exact line geometry.
- **Identity is still name-only**, not real Supabase auth — a deliberate scope decision (see below), not an oversight.
- **Department/level are now stored server-side** (`employees` table) — the original only ever kept these in `localStorage`, with no durable server-side record of who's in which department at all.

## Images

The original app embeds ~7MB of base64 images directly in its HTML (`images.html`). None of that binary data is ported here — Home's Track Record slides and the org chart's avatars use CSS placeholders/initials instead. Migrating the real photos is a separate task: extract them from the original's `images.html`, upload to Supabase Storage or another CDN, and swap in real `<img>` tags where this port currently has placeholders.

## Auth / security notes — read before treating this as production-ready

- **Employee identity is still just a typed name** (`localStorage`, matched by name against Supabase rows), exactly like the original app. This was an explicit, considered scope decision — the point of this port was matching the original app's behavior, not redesigning its identity model in the same pass. If you want real per-employee accounts, that's a separate, larger decision.
- **RLS policies are wide open** (`using (true)`) on `employees`, `progress`, and `checklist_overrides` — matching the original app's own complete lack of access control (anyone who could open the web app URL could read/write the Sheet). This is not a regression, but it's also not hardened.
- **Admin writes are verified server-side.** `check_admin_password` keeps the real password in Postgres rather than the JS bundle, and — as of 2026-08-30 — `checklist_overrides` no longer has an open write policy. It has **no** insert/update/delete policy, so the anon key cannot write it directly; all writes go through the `admin_save_checklist_item` / `admin_delete_checklist_item` security-definer functions, which verify the password *inside the same call* that performs the write. This closes the gap where the password gated only the UI and anyone with the anon key (it ships in the browser bundle) could rewrite any checklist. Same guarantee as the original app's `requireAdmin_`.

## Data model

| Original (Google Sheet / Drive) | Here (Supabase) |
|---|---|
| "Onboarding Progress" sheet (`Employee \| TaskId \| Completed \| Timestamp`) | `progress` table |
| Department/level (only ever in the employee's own `localStorage`) | `employees` table — a deliberate improvement, not just a port |
| "Checklist Content" sheet (admin overrides) | `checklist_overrides` table |
| Per-employee Drive subfolder (document uploads) | `required-documents` Storage bucket, keyed by `<employeeName>/<docId>-<filename>` |

Task IDs use the same convention as the original: a checklist item's own permanent id (e.g. `fin-p1-read-1`), and a document's completion is tracked as `doc::<id>` — same scheme as the original's `REQUIRED_DOC_IDS`.

## Adding a 6th department, or editing content

1. Read the department's real content from `../ORIGINAL CODE/src/content.html`.
2. Create `src/data/<dept>.ts` following the exact shape of `src/data/finance.ts`.
3. Add an entry to `ALL_DEPARTMENTS` in `src/data/allDepartments.ts` — nothing else needs to change; routing, phase-locking, the admin editor, and the Completion page gate are all department-agnostic already.

## Parity with the Apps Script app (brought up to date 2026-08-30)

This port is now caught up with the Apps Script app's v183→v188 fixes. What was ported, and where:

| Fix | Where it lives here |
|---|---|
| **Admin writes verified server-side** | `checklist_overrides` has no insert/update/delete policy at all; writes go through the `admin_save_checklist_item` / `admin_delete_checklist_item` security-definer RPCs, which check the password inside the same call that performs the write (`supabase/schema.sql`). The password is threaded to every write in `useChecklistOverrides.ts` / `AdminPage.tsx`. |
| **Failed progress load no longer reads as "nothing completed"** | `useProgress.ts` leaves `loaded` false on error and exposes `loadError`; `PhasePage.tsx` renders it instead of an empty checklist. |
| **Save failures are visible** | `saveError` from `useProgress.ts`, rendered as a `role="alert"` banner on `PhasePage.tsx` after the existing retry-then-revert. |
| **Name correction** | `renameEmployee()` in `useProgress.ts` — moves the employee's rows to the new name, unioning with any rows already under it, and only deletes the old rows once the new ones are written. |
| **Department switch clears old progress** | `switchDepartment()` in `useProgress.ts`. Takes the old department's task ids explicitly, so there is no prefix string to get wrong — the exact bug the original hit. |
| **Upload validation** | `useDocUpload.ts`: 10MB cap, extension allowlist, empty-file check, real error messages. |
| **Re-upload replaces rather than duplicating** | Storage path is now `<employee>/<docId>.<ext>` — the user's filename is no longer in the key, so a differently-named file for the same requirement overwrites instead of creating a second object. |
| **Upload receipt** | `RequiredDocuments.tsx` shows "You uploaded: &lt;file&gt;" with a link, remembered per employee in `localStorage`. |
| **Phase-complete celebration + "Next up"** | `PhasePage.tsx` — fires on the false→true transition only, suppressed on the final phase (the Completion page owns that), with a text "Next up" badge on the next-phase link. |
| **Accessibility** | `<html lang>` follows the language toggle (`useLang.ts`); modal inputs have `sr-only` labels and the dialog has an accessible name (`NameModal.tsx`); error banners use `role="alert"`. |

Two differences from the original are deliberate, not gaps:

- **No `LockService` equivalent.** The original needed it because Sheet writes were read-scan-then-append with no atomicity. Postgres upserts with a proper conflict target are atomic already.
- **Mobile drawer fixes don't transfer.** That was Apps-Script-specific CSS (an entry animation overriding `translateX`, a `height: 100%` scroll trap). This port's layout is different — but it has **not** been verified on a real phone, so treat that as untested rather than fixed.


## Known gaps / honesty check

- Verified by rendering the whole app with Playwright during development (all 5 departments' landing + phase pages, the org chart's full tree + Group Structure view, the admin gate, the Completion page's gating, the language/theme toggles) — but only against a placeholder Supabase project. The actual Supabase read/write path (progress saves, document uploads, admin overrides, the password RPC) has NOT been verified against a real database. Test that before treating this as more than a structurally-complete port.
- No automated test suite, matching the original app's own lack of one. The mechanical checks are `npm run build` (which runs `tsc -b`) and `npx oxlint`. **Do not use bare `npx tsc --noEmit`** — the root `tsconfig.json` is only a project-references stub, so that command type-checks nothing and exits 0 even with real errors in `src/`. It silently passed over four Rules-of-Hooks violations during this port's last update; `oxlint` is what caught them, and only `tsc -b` reports genuine type errors.
- Not yet deployed anywhere — no GitHub Actions workflow, no Vercel/Netlify config.
- Real photos are not ported (see "Images" above).
- The sidebar's journey stepper (done/current/locked states per step) is a plain static nav list here, not the original's stateful stepper.
