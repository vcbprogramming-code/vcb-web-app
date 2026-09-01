# Layout checks

Three standalone Node scripts that guard the responsive reading pane. No
dependencies, no build — run them from the **project root**:

```sh
node tools/layout-checks/device-widths.js     # is the sheet readable on every device?
node tools/layout-checks/css-audit.js         # GAS: CSS scoping + cascade, and the classes JS toggles
node tools/layout-checks/css-audit-react.js   # the same audit for the React mirror
node tools/layout-checks/scaler.test.js       # does fitScaleToPane do the right arithmetic?
```

Each exits non-zero on failure, so they can be chained.

## Why these exist

The document is authored at a fixed 860px page box containing a 210mm (~794px)
A4 sheet. The app's three-column grid subtracts fixed chrome from the window,
and whatever is left is the reading pane. When that pane is narrower than the
page box the sheet is **CSS-scaled down**, never clipped — clipping is what the
2026-08-29 iPad bug was, and it was unrecoverable because the pane scrolls only
vertically.

These scripts encode the three things that broke, or nearly broke, while fixing
that:

**`device-widths.js`** — mirrors the media queries and prints the resulting
scale for nine real device widths. Catches a breakpoint that starves the pane.
Fails under 0.55 scale. It caught iPad Air *landscape* (1180px) scoring worse
than the same device in portrait, which moved the 1100px band to 1200px.

**`css-audit.js`** — parses `Stylesheet.html` and asserts that:
- every band that sets `.body` also restates `.body.timeline-mode` (which is
  `(0,2,0)` and would otherwise outrank it whatever the media query);
- no pane selector inside `@media (max-width: 900px)` is left unscoped.
  **Phones also match that query**, and the phone rules override only
  `display`/`width` — never `position`/`transform` — so an unscoped rule there
  slides the phone meeting list off-screen with no way to bring it back. This
  is the highest-value check in the file;
- overrides that fight a base rule at equal specificity come *after* it in
  source order (`.paper`, `.attach-footer`, `.dash-wrap`);
- the scrim and the list-hiding rules key off `.timeline-only` (the timeline
  *view* is showing) rather than `.timeline-mode` (the Timeline project is
  selected). Opening a meeting from a timeline dot leaves the project selected,
  so the broader class persisted on the detail view and hid both the list and
  its ☰ toggle — that screen had no way back to the list;
- the 128px indent that clears the ☰ toggle lifts when the toggle is hidden,
  or it leaves a hole that wraps the detail-bar buttons onto a second row;
- z-order stays list > scrim > peek;
- **the classes the CSS keys off are actually emitted** — by `JavaScript.html`
  for the GAS app, by `App.tsx` for the mirror. Auditing only the stylesheet
  would pass happily while the app set none of them.

`css-audit-react.js` runs the same checks against
`FOR DEPLOYMENT TEAM/src/styles.css`, minus the document-scaler rules the
mirror has no use for (it renders no Paged.js iframe).

**`scaler.test.js`** — extracts `fitScaleToPane` from `JavaScript.html` and runs
it against fake DOM nodes. Asserts it scales correctly, clears itself when the
pane grows, never overwrites the frame height while scaling (Paged.js owns it),
*does* clear a height stranded by the phone scaler when crossing the 500px
boundary mid-session, and survives detached or zero-width input.

## When to re-run

After touching any of: the `.body` grid or its breakpoints, `.list` / `.detail`
/ `.paper` / `.frame-wrap`, the `.list-peek` overlay toggle, or
`fitScaleToPane` / `applyMobileScale` / `usesContinuousDoc`.

They check structure and arithmetic, not appearance — they cannot tell you the
page *looks* right, only that the rules mean what they claim. Confirm visually
on a real tablet after a change that moves things around.
