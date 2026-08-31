# Content Guide

All onboarding content — checklist text, documents, department descriptions — lives in one file: [src/content.html](../src/content.html), inside the `PAGES` object. This guide covers the common edits. Read [ARCHITECTURE.md](ARCHITECTURE.md) first if you haven't — it explains *why* things are structured this way.

## The most important rule: every checklist item has a permanent ID — don't reuse or reassign one

As of August 2026, a checklist item's saved-progress ID is its own explicit, permanent `id` (e.g. `acct-p1-read-1`), set once via `it(id, text, opts)` and never derived from its position in the array. (This replaced an earlier positional scheme — `pageKey::sectionIndex::itemIndex` — specifically because that made the admin editor's reorder/insert/delete actions unsafe; see [ARCHITECTURE.md](ARCHITECTURE.md#admin-checklist-editor).) A document's ID is `doc::<id>` where `<id>` is a field you set explicitly — same rule as always.

This means:
- **Renaming or rewording a checklist item's text is always safe** — its ID is a separate field from its text.
- **Reordering items within a block, or adding/removing an item, is now also safe** — every item keeps its own ID regardless of position, so nobody's progress gets silently reattributed to a different task the way a positional scheme would.
- **Never reuse an existing item's ID for a different item, and never change an existing item's ID once employees may have completed it** — same rule documents have always followed; a checklist item's ID is now just as permanent as a document's.
- **ID scheme for hardcoded items**: `<dept>-p<phase>-<block>-<n>` where dept ∈ {acct, fin, proc, prop, eng}, phase ∈ {1,2,3}, block ∈ {read, know, out}, n = 1-based position when the item was authored. Follow this pattern for any new hardcoded item so ids stay predictable and collision-free; the admin editor generates its own `admin-<timestamp>-<random>` ids for items added through the UI, which never collide with the hardcoded scheme.
- **Reordering entire `sections` in the `PAGES[...]` array, or adding/removing a section before an existing one, still changes block *indices*** (`PHASE_BLOCK_ANCHORS`/`getPageBlockTaskIds` still assume `[Reading, Knowledge, Outputs]` at indices `[0,1,2]`) — this breaks the sidebar's Reading/Knowledge/Outputs sub-step deep-links even though individual checkbox completion state (keyed on item id, not index) survives it unharmed. Prefer appending new sections at the end.
- **Documents are unaffected by any of this** — they're keyed by an explicit `id` string you write, not position, and always have been.

**Editing without a deploy**: department task lists can now also be edited through the in-app admin editor (`?page=admin`, password-gated) instead of touching this file — see [ARCHITECTURE.md](ARCHITECTURE.md#admin-checklist-editor). Edits made there live in a Google Sheet, layered on top of whatever's hardcoded here at render time. Editing `content.html` directly is still the right approach for anything the admin editor doesn't cover (new departments, restructuring phases, non-checklist content) or when you want the change committed to source rather than living only in the Sheet.

## Editing a department's checklist phase

Each phase page (e.g. `accounting-day-1-30`) is built by `phasePage(opts)`:

```js
PAGES['accounting-day-1-30'] = phasePage({
  eyebrow: 'Accounting · Phase 1 (Day 1–30)',
  title: 'Foundation: Documentation & Recording Discipline',
  blocks: [
    { heading: 'Required Reading', items: [
      it('acct-p1-read-1', 'Chart of Accounts Structure'),
      it('acct-p1-read-2', '...'),
      it('acct-p1-read-3', sr('Senior-only item text here'))  // sr() marks an item Senior-track-only
    ] },
    { heading: 'Knowledge Requirements', items: [ it('acct-p1-know-1', 'Debit and credit logic'), /* ... */ ] },
    { heading: 'Required Outputs', items: [ it('acct-p1-out-1', '15 accurate ERP postings'), /* ... */ ] }
  ],
  nextPhase: { label: 'ACCOUNTING – DAY 31–60', page: 'accounting-day-31-60' }
});
```

Standing convention (per the client's explicit spec): **exactly 3 blocks per phase** — Required Reading, Knowledge Requirements, Required Outputs — each with **4–5 items max**. Don't add a 4th block or blow past ~5 items without checking with the client; the whole checklist redesign was specifically to keep these short.

- `blocks[].items` — each item is `it('<permanent-id>', 'text')` (or `it('<permanent-id>', sr('text'))` for a Senior-only item) — see the ID rule above for the `<dept>-p<phase>-<block>-<n>` naming pattern. Never write a bare string here anymore; `it()` is what gives the item its permanent id.
- `nextPhase` — only phases before the last one have this; it both renders the "Next" link and (via `getPrevPhaseMap()` in `progress.html`) locks the *next* phase until this one's tasks are all done. **Only the last phase (Day 61–90) omits `nextPhase` and instead sets `closing`.**
- `closing` (last phase only) — a plain string, rendered as the phase's closing message. Once `isEmployeeOnboardingComplete()` is genuinely true, `renderPage` (app.html) also adds a "Continue to Completion" link beneath it, pointing at the real `PAGES['completion']` page — see [ARCHITECTURE.md](ARCHITECTURE.md#the-completion-page-meet-our-team--life-on-site--return-to-portal). `phasePage` no longer appends `homeFeatureGridSection()` here directly (that was the old in-place gated reveal, removed).

## Adding a whole new department

There is no dedicated "add department" helper — it's manual, and touches three files:

1. **`content.html`**: add `PAGES['<slug>-team']` via `deptLanding({...})`, plus `PAGES['<slug>-day-1-30']`, `-31-60`, `-61-90` via `phasePage({...})` (last one needs `closing` as described above). Add an entry to the top-level `NAV` array and to the `deptgrid` section's `depts` array in `PAGES['home']` (needs `deptId`, `label`, `page`, `icon` — pick an existing icon from `icons.html` or add a new one, and a one-line `desc`).
2. **`progress.html`**: add the department to the `DEPARTMENTS` array (`{ id, label, shortLabel, prefix }` — `prefix` must exactly match the page-key prefix you used in step 1, e.g. `'newdept-'`).
3. **`translations.html`**: add Thai translations for every new English string you introduced (headings, item text, `desc`, `shortLabel`, etc.) — anything not in `TH_DICT` just falls back to English, so this can be done incrementally, but don't ship a department with zero Thai coverage if the others have it.

Then verify `getDepartmentPhaseChain` picks up the new department correctly — it filters `PAGES` keys by `prefix` + containing `-day-`, so as long as your phase page keys follow the `<prefix>day-1-30` etc. pattern, no code change is needed there.

## Editing Required Documents

The doc list is the `doclist` section in `PAGES['home']`:

```js
{ id: 'employment-contract', title: 'Employment Contract', action: 'Sign Employment Contract' }
```

- `id` — stable, explicit, used as `doc::<id>` for progress tracking. See the safety notes above.
- If you add or remove a document, **update `REQUIRED_DOC_IDS` in `progress.html` to match** — that array is what `areRequiredDocsComplete()` checks against, and it is not derived automatically from `content.html`'s doc list (a manual sync point to be aware of).
- Each doc renders as a card whose link opens a real URL when one is attached (`doc.viewUrl`/`doc.downloadUrl`/`docLink`'s `url` param — see `matchAndLinkRequiredDocuments()` in Code.gs, a one-time dev utility that matches real files in a shared Drive folder by filename prefix and prints ready-to-paste Drive view URLs), a manual "Complete" checkbox, and an "Upload" button that saves to Drive via `Code.gs`'s `uploadRequiredDocument`. A doc entry with no URL attached still falls back to the old placeholder `alert()` (`docCard()`/`docLink()` in content.html) rather than a dead link — so the fallback still exists, it's just no longer the only path. Either the link/upload flow or the manual checkbox marks the same task done — that was an explicit client requirement ("either upload or checkbox marks a doc complete").
- Each card also carries an empty `[data-doc-uploaded]` slot, filled in by `updateDocCardUI` (progress.html) with a "You uploaded: &lt;file&gt;" link once this employee has an upload on record. It stays hidden (`.doc-uploaded:empty`) otherwise, so an untouched card looks exactly as before. **Keep that element if you restructure `docCard()`** — without it an employee gets no confirmation of what was actually received. See [ARCHITECTURE.md](ARCHITECTURE.md#required-document-uploads) for the upload rules (10MB cap, extension allowlist, re-upload replaces rather than duplicates).

## Editing Department Selection cards

The `deptgrid` section in `PAGES['home']`. Each entry needs `deptId` (must match `DEPARTMENTS` in `progress.html`), `label`, `page` (the department landing page key), `icon` (a key from `icons.html`'s `ICONS` object), and `desc` (one-liner shown on the card — client asked for these to make the section feel "grander" and more considered, not just a bare label).

## Adding new copy / translations

Any string you write that should be shown to the user must be wrapped in `t(...)` wherever it's rendered (most of `app.html`'s section renderers already do this for you — you usually only need to touch `translations.html`, not `app.html`). To add a Thai translation, add a line to `TH_DICT` in `translations.html`:

```js
'Your new English string': 'ข้อความภาษาไทยของคุณ',
```

Missing keys are not an error — `t()` just returns the English string unchanged — so it's safe to ship new English copy before its Thai translation exists, but don't leave it that way long-term.

## Section types quick reference

(Full behavior lives in `app.html`'s `renderSectionContent` switch — this is just what fields each expects.)

| `type` | Used for | Key fields |
|---|---|---|
| `text` | Prose blocks, supervisor intro, ERP workflow description | `heading`, `body` (array of paragraphs), `bullets`, `image`, `footer`, `link` |
| `quote` | CEO welcome message | `quote`, `attribution` |
| `values` | Culture & Values tiles | `values: [{ icon, title, body }]` |
| `trackrecord` | "Our Track Record" carousel | `slides: [{ image, caption }]` |
| `feature` | Single feature callout | `title`, `body`, `image`, `link` |
| `featuregrid` | Meet Our Team / Life on Site grid (+ optional `externalCta` button) | `features: [{ title, body, image?, link?, bodyId? }]`, `externalCta: { label, url }` |
| `list` | Simple bullet list | `heading`, `items` |
| `checklist` | Department phase tasks | `heading`, `sub`, `items` |
| `doclist` | Required Documents grid | `heading`, `intro`, `docs: [{ id, title, action }]` |
| `deptgrid` | Department Selection cards | `heading`, `eyebrow`, `intro`, `depts: [{ deptId, label, page, icon, desc }]` |
| `phaselinks` | "Onboarding Phases" cards on a department landing page | `heading`, `phases: [{ label, page }]` |
| `teamgroup` | Meet Our Team page groupings | (see `PAGES['meet-our-team']` for shape) |
| `gallery` | Life on Site image gallery | (see `PAGES['life-on-site']` for shape) |
| `orgchart` | Org Chart / Group Structure tree on Home | `chart` (Org Chart tree data), `groupStructure`, `groupSubheading` — see `PAGES['home']` and [ARCHITECTURE.md](ARCHITECTURE.md#org-chart--group-structure) |

`featuregrid` per-feature fields, precisely: `title`, `body` (plain text, or wrap with an explicit `bodyId` if a later client-side script needs to hydrate/target that paragraph), `image` (optional — a data-URI `<img>` via `img()`; when omitted, `app.html`'s renderer falls back to an icon badge instead, via `f.icon`), `link` (optional — `{ label, page }`; omit it entirely for a card with no "Learn more" affordance).

**`featuregrid` today is used exactly once** — inside `PAGES['completion']`, built by `homeFeatureGridSection()` (content.html), with exactly two cards (Meet Our Team, Check Out Life on Site) plus an `externalCta` ("Return to VCB Portal"). It is not a general-purpose gated panel anymore — see [ARCHITECTURE.md's Completion page section](ARCHITECTURE.md#the-completion-page-meet-our-team--life-on-site--return-to-portal) for the gating (it lives on `PAGES['completion']` itself, not on this section type). A third card (a "Your Documents" card, and separately a "What's Next" card naming the receiving department head) was tried and explicitly rejected by the client twice — this page is a lightweight orientation aid, not the primary onboarding record. Don't re-add a third card without checking first; `.feature-grid`'s CSS (`max-width: 920px`, styles.html) is deliberately sized for exactly 2 cards.

## Editing the Org Chart / Group Structure tree

The `groupStructure` object (inside the `orgchart` section in `PAGES['home']`) drives the Group Structure view — see [ARCHITECTURE.md](ARCHITECTURE.md#org-chart--group-structure) for how it renders. Content-only edits you're likely to make:

- **Company descriptions** (VCB's own `parent.sub`, or any `subsidiaries[]`/`familyCompanies[]` entry's `sub`) — plain text, wrapped in `t()` at render time same as everywhere else, so add a Thai translation in `translations.html` alongside any new/changed English text. VCB's own description is always shown in full; Subsidiaries (CVE, CVN) show inline; `familyCompanies[]` (VPO, Chavananand Holding) show as a hover-only tooltip — keep that in mind when writing their text, since it's not visible until the card is hovered.
- **Adding a new subsidiary or joint venture** — add an entry to `groupStructure.subsidiaries[]` or the joint-ventures array (see existing CVE/CVN/VK/V&K/VN/VC entries for shape); no code change needed, the branch-bar/drop lines are computed from however many cards actually render.
- **Adding a new family-owned (non-affiliated) company** — add an entry to `groupStructure.familyCompanies[]` (`{ id, label, sub }`). Currently supports exactly two (one on each side of VCB) by construction in `renderGroupStructureHtml` (app.html) — adding a third needs that function's layout logic extended, not just a new array entry. Never write these with real-sounding "family drama" framing or anything an employee-facing screen shouldn't carry — this was explicitly rejected once already (a caption explaining the non-affiliation was tried and removed for being unprofessional); keep it to the same plain factual register as every other company description.
- **Any DOM-structure change to a card that participates in these connector lines** (adding/removing a wrapper element, changing which element is the "stable" always-visible anchor) requires updating `renderGroupStructureTrunk`'s corresponding `querySelector` in `app.html` — see the Known Issues entry on this, it has broken silently more than once.

### Editing Project Sites' departments (Site Operations / Site Administration)

Each of the 5 projects under Project Sites (`projectManagers.projects` inside the `orgchart` section, content.html) shares one department template, applied via `.map()` — editing `opsDepartments` or `adminDepartments` there changes every project at once, since no real per-project staffing data exists in this app. See [ARCHITECTURE.md's Project card layout section](ARCHITECTURE.md#project-card-layout--one-layout-always-side-by-side-settled-august-2026) for how this renders.

- **A department**: `{ label, lead: { name, role }, staff: [{ name, role }, ...], hqDept? }`. `staff` is optional — omit it for a lead-only department (none currently are). `hqDept` (Administration departments only) must match an id in `sec.departments` (the Head Office department list a few lines above `projectManagers` in the same file) — it drives the "Reports to X" tag, not a description of the person.
- **The Project Manager's description is shared** — `PM_ROLE`, a top-level `var` defined right above `PAGES['home']`, referenced by every `projects[].lead.role`. Edit it once to change what every PM's role description says; don't give individual projects their own PM description text again (tried once, reverted — every PM does the same job).
- **Adding a 6th project**: add an entry to the `projects` array before the `.map()` call (`{ id, label, lead: { name } }` — `lead.role` should reference `PM_ROLE`, not a new string) — the department template, connector-line math, and row-wrapping all adapt automatically to however many projects actually render.

## Images

Prefer `EMBEDDED_IMAGES` (in `images.html`, base64 data URIs baked into the deploy) for anything that must always render regardless of external network access. `IMAGES` (in `content.html`, `lh3.googleusercontent.com` URLs pulled from the original published Google Site) is used for a few legacy images — fine to leave as-is, but don't add *new* external URLs there without a reason; embedding is the established pattern for anything added during this rebuild.
