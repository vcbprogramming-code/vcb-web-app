# DESIGN — UI conventions (VCB-MANGO ERP SOP Web App)

Record a convention here when you establish or change one. Everything below is
client-side in `index.html`.

## Visual direction
- **Refined corporate** (Linear/Stripe/Notion vibe): calm, restrained navy/blue, generous spacing, subtle layered shadows, smooth micro-transitions.
- Design tokens live in `:root` and `html.dark`: `--brand*`, `--ink/--muted/--faint`, `--line*`, `--shadow*` (xs/sm/-/lg), `--ring` (focus), `--r-*` (radii), `--ico` (icon size). Use the tokens — don't hardcode colors/radii/shadows.
- A single appended **"refined-corporate revamp"** block near the end of `<style>` refines banner/sidebar/cards/detail/focus on top of the base rules.

## Dark mode — the brand colours are surfaces, not text
`html.dark` redefines `--brand-soft` but **deliberately not** `--brand`,
`--brand-dark`, or `--brand-2` — they stay dark navy because they are used as
*surfaces* elsewhere. Consequence, and it has bitten repeatedly:

> **Any rule that uses `--brand`/`--brand-dark`/`--brand-2` as a `color` needs
> its own `html.dark` override.** Without one it renders dark navy on a dark
> panel. The established lifts are `#7fa8d6` (body-sized text, ~7:1) and
> `#cdddef` (headings/pills, ~10:1); `#9cc2ea` is also in use.

Ratios that have actually shipped broken: flow Start/End pills at **1.06:1**
(invisible), the Related-Files heading at 1.49:1, links at 3.57:1. Note that
`--brand-2` *looks* light enough and is not — it is tuned for white and lands
under 4.5:1 on the dark panel. **Check the number, don't eyeball it.** A quick
audit script (walk every rule setting a brand var as `color`, diff against the
`html.dark` overrides, compute WCAG ratios) is worth re-running after any
palette work; it also catches false positives, since several selectors that
look uncovered are already handled by a differently-worded override or win on
specificity.

## Icons — NO EMOJI in the UI
- Use the inline SVG icon system: `ICONS{}` (Lucide-style path data) + `svgIcon('name')` + `renderIcons()`.
- Static markup: `<span data-icon="name"></span>` (filled once by `renderIcons()` at init).
- Dynamic/generated HTML: embed `svgIcon('name')` directly.
- Icons inherit `currentColor`; size via the `--ico` custom property on a context.
- Add an icon = add a path to `ICONS`, then reference it. Never reintroduce emoji glyphs.

## Navigation
- Three uniform top-level branches: **Process Flows**, **Case Studies** (both roots with a module submenu) and **Reports** (leaf, no submenu).
- A **root IS the "All" item** — there is no "ทั้งหมด/All" sub-item. Clicking a root shows everything + opens its submenu; clicking the open root collapses it (accordion, one open at a time).
- Active branch: its icon chip fills navy (`.mod.active .mod-ico`). A selected module highlights the sub-item instead of the root.
- State: `state.view ∈ {flows, sop, reports}`, `state.flowMod`/`state.mod` (`'ALL'` = root), `state.navCollapsed`.

## Case Studies — numbering, tagging, and the detail/list split
- **Numbering (`displayNo`, e.g. `PO-3`) is always derived**, never stored as fact — computed fresh per module from row order (`assignDisplayNo_()` server-side). Never trust it as an identifier; the stable id is `no`.
- **Multi-module tags (`extraModules[]`)** — a case's number/color always come from its *primary* module; tags only add it to other modules' lists too. `caseInModule(s, mod)` checks primary-or-tagged membership.
- **Tag chips live on the list card, not the detail header.** An earlier version put tag chips in the case detail header (`.d-head`) — this broke alignment (4 competing flex children, uneven with wrapping titles) and cluttered the header. Tags now render as a `.lc-badge-tag` on the **list card**: lighter-toned tint of the module's `--mc` color (via `color-mix`), not the solid module color used for the primary number badge — the lighter tone signals "related, not primary." Shown in every list view except the one place it'd be redundant (viewing the module a case is *only* tagged into, where the badge instead names the case's true home module).
- **Filtered-list sort:** when a module list is filtered, cases whose primary module matches sort first (stable sort), so a tagged-in case never interleaves with the "real" `PO-1, PO-2, …` sequence.
- **Detail header (`.d-head`)** stays `align-items:flex-start` with just the number badge, title block, and Edit button — keep it that way; don't reintroduce a 4th sibling competing for vertical centering against a wrapping title.

## Process-flow diagrams
- Data shape: `SOP_FLOWS[]` = `{id, module, titleTH, titleEN, lanes[], nodes[], edges[], narrative[]}`.
- `nodes`: `{id, lane, rank, type:'start|process|decision|end', label}` (lane = column, rank = row).
- `edges`: `{from, to, label?, kind?}`, `kind ∈ normal | approve(blue) | yes(green) | reject(amber, loops under)`.
- `narrative[]`: `» ` = sub-bullet, `! ` = red note.
- Rendered natively: CSS grid for nodes + an absolutely-positioned `<svg>` arrow overlay drawn by `layoutFlowEdges()` (re-run on resize/theme/font-load).

## Content & language
- Bilingual UI chrome via `I18N.th/.en` + `t(key)`. **Keep i18n title strings emoji-free** (icons are rendered separately).
- Body content (scenarios, reports) is verbatim from the Google Doc; Process-Flow text is curated in `SOP_FLOWS`.
- Single font: **Sarabun** (covers Thai + Latin). If ever adding Inter for Latin UI, keep Sarabun for Thai content.

## Responsive — budget the reading column, don't just pick a number
The shell is three fixed columns (`sidebar + list + detail`), so the case text
gets **`viewport − sidebar − list − rail − padding`**. Any breakpoint change has
to be checked against that subtraction, not eyeballed at one window size.

Current ladder:

| Width | Sidebar + list | Attachments rail | Reading column |
|---|---|---|---|
| > 1600px | 742px | 238px, side | viewport − 1032 |
| 1441–1600px | 742px | stacked (chips) | viewport − 794 |
| 1101–1440px | 690px | stacked (chips) | viewport − 742 |
| ≤ 1100px | 646px | stacked (chips) | viewport − 698 |
| `is-mobile` (≤768px) | single pane | stacked | full width |

**The trap this ladder exists to prevent:** breakpoints set for an older layout
silently stop matching it. The rail's stacking rule was written at 1180px when
the app had fewer fixed columns; once the shell grew to 742px of chrome, an iPad
Pro at 1366px fell *above* that breakpoint and kept a 238px side rail, leaving
**334px** for the case text — the title wrapped one word per line. Worse, with a
single 1100px grid step a **1280px window got 248px, less than a 1024px one**.
A wider viewport reading worse than a narrower one is the diagnostic: it means a
breakpoint boundary is in the wrong place, not that the content is too big.

- **A side rail needs genuinely spare width, not leftover width.** 1600px is
  where the reading column still clears ~560px with the rail attached. Below
  that the rail stacks.
- **Stacked ≠ the same content turned sideways.** Stacked, the rail is a chip
  strip (filename + file glyph, one line, ellipsised) rather than a thumbnail
  grid — the files stay one tap away without spending the vertical space a
  preview grid would.
- Recompute the table above when any fixed column width changes.

## Modals — the full-screen editor
- Only the **case editor** (`#editBg`) opts into full screen, via `.modal-bg.full` + `.modal-full`. The report/confirm/settings modals stay small, centred boxes — don't widen them by reflex.
- `.modal-full` is a flex column: sticky `h3`, `.mf-body` filling the middle with `overflow:hidden`, sticky `.actions`. **The body must not scroll** — everything is meant to fit one screen.
- `.mf-grid` splits the body into a metadata column (`.mf-meta`, scrolls independently when a case has many attachments) and a free-text column.
- **Sizing rule: never a `vh` or `calc()` constant.** Both were tried and both broke — a constant cannot know the real height of the header, footer, and the fields above it, so the field ends up short (dead space) or long (page scroll). Let the browser measure: fix the short fields in `em`, give the tall one `flex:1`.
- **Grow the `grid` row; do not convert it to a flex column.** `.modal .row` sets `align-items:start`, which still applies after a `display:flex` override and packs the child to its *content width* — that is what once made ขั้นตอน visibly narrower than the fields above and below it. A grid track stretches by default. `.ta-fill` keeps `display:grid` and adds `grid-template-rows:auto minmax(0,1fr)`.
- Mobile reverts these grids to `display:block` with fixed heights — in a scrolling document there is no spare height for a `1fr` track to claim, so the field would collapse.

## Forms — structured fields beat encoded syntax
Attachments were once a textarea taking `Label | URL`, one per line. The
capability was complete and effectively unused: the syntax was invisible, so
files were pasted as bare links and rendered with a generic caption. Replaced
with one row per file (name + URL + delete). **When a field encodes structure
in a delimiter, prefer real inputs** — the parsing was never the problem, the
discoverability was. Where a value can be derived (a Drive filename), pre-fill
it, but only into an *empty* field and never over something the user typed.
