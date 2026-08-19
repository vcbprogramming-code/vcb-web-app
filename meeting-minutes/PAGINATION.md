# Page-accurate rendering — architecture

*Written 2026-08-19, live @200.*

> **This is a copy of the GAS project's PAGINATION.md.** The React mirror
> implements the same design: `src/lib/docRender.ts` holds `OVERRIDE_CSS`,
> `PAGED_PREVIEW_JS` / `PAGED_PREVIEW_CSS` and the preview/print srcdoc split,
> and `src/components/MeetingDetail.tsx` holds the settle-and-reveal load logic.
> Keep both in step: a change to one is a change to the other.

**Read this before changing anything about how meetings are displayed, printed,
or edited.** Getting the reading view to break pages exactly where the PDF
breaks them took many failed attempts. This document records what the design is,
why it is that way, and which specific approaches are known not to work — so
nobody (human or AI) has to rediscover it the hard way.

---

## The requirement

A meeting must look the same in three places:

| View | What it is |
|---|---|
| **Reading view** | The default screen — an iframe on the meeting detail pane |
| **Print / PDF** | What `window.print()` produces |
| **Editor** | "Edit here" — the contenteditable surface |

"The same" means *pixel-accurate*: the same text column, the same fonts, and —
critically — **the same page boundaries**. If a heading falls on page 2 in the
PDF, it must fall on page 2 on screen. Otherwise you are editing blind and have
to keep exporting a PDF to check where things landed.

---

## The hard part, and why

A browser only splits a document into pages **while printing**. That work is done
by its CSS Paged Media engine, and **the result is not exposed to JavaScript**.
There is no API for "where would page 2 begin?".

That engine does more than measure heights. It also applies:

- `orphans` / `widows` — never strand one line of a paragraph across a page
- `break-after: avoid` — never leave a heading at the foot of a page, separated
  from the text it introduces
- `break-inside` heuristics for tables, figures and images

**This is why hand-computing page breaks in JavaScript does not work.** A
height-only calculation says "this heading fits at the bottom of page 1", while
the real engine moves it to page 2. That exact case — heading `2. ความคืบหน้า
โครงการ BR/PN` — is what exposed the flaw.

---

## The solution: Paged.js

The reading view loads [Paged.js](https://pagedjs.org/), a polyfill that
implements the CSS Paged Media spec **in the browser, at runtime**. It reads the
same `@page` rules the printer uses and lays the document out into real page
elements, so the boundaries shown on screen are the boundaries the PDF will have.

The breaks are not replicated. They are computed by a proper implementation of
the same specification.

### How it is wired

In `JavaScript.html`, `renderDetail()` builds **two versions** of the document:

```
srcdocHead        shared <head>: fonts, OVERRIDE_CSS, dark mode, QR @page CSS

srcdocForPrint  = srcdocHead + <body>content</body>
                  → NO Paged.js. Used only by the Print button.

srcdoc          = srcdocHead + <body>content + PAGED_PREVIEW_JS
                                             + PAGED_PREVIEW_CSS</body>
                  → the on-screen preview.
```

**Printing deliberately does not use the preview iframe.** Paged.js has already
split that document into page elements; handing it to the print engine would
paginate an already-paginated document. The Print button instead creates a
hidden iframe from `srcdocForPrint` — byte-for-byte the document that produced
PDFs before Paged.js existed — so **exports are completely unaffected**.

---

## Rules that must not be broken

### 1. Preview CSS loads AFTER Paged.js, with `!important`

`PAGED_PREVIEW_CSS` is appended at the **end of `<body>`**, after the Paged.js
script tag, and every rule uses `html` for extra specificity plus `!important`.

This is not defensive over-styling. Paged.js **injects its own stylesheet at
runtime**, after page load. A `<style>` in `<head>` loses on source order, and
the symptom is silent: the pages render as one continuous white column with no
visible separation, exactly as if pagination never ran. Verified in a real
browser — without these, computed styles come back as transparent backgrounds,
`display: block` instead of `flex`, and no gaps.

### 2. The reading pane has exactly ONE scroll container

```
.detail          overflow: hidden
  #detailContent overflow: auto     ← the single scroll container
    .frame-wrap  (no overflow)      ← must NOT scroll
      .paper     transparent, no sheet styling
        iframe   height set by JS to the full paginated height
```

The iframe is sized to its **entire** paginated height (several thousand pixels).
If `.frame-wrap` also scrolls, it stays clamped to the pane height and produces a
**second scrollbar floating in the middle of the pane**, beside the sheet,
instead of one scrollbar at the window edge.

`.paper` must stay transparent with no background or shadow: Paged.js draws each
page as its own white sheet, so a white panel behind them reads as a page inside
a page.

*(Mobile is different on purpose — `html.is-mobile .frame-wrap` scrolls and uses
`applyMobileScale`. Leave it alone.)*

### 3. The iframe height is set AFTER pagination finishes

Paged.js works asynchronously. Measuring on `load` sizes the frame to the
*pre-pagination* document. The code polls for `.pagedjs_pages` (up to ~4s) and
re-measures once it appears, falling back to a plain measurement if Paged.js
never runs — so a blocked CDN degrades to a normal continuous document rather
than a broken view.

### 4. Screen and print must render the SAME document

Any content in one and not the other shifts every page boundary after it. Two
divergences were found and removed:

- The letterhead and date were hidden on screen (`@media screen{…display:none}`)
  but present in print — **~63px** of content the printed page had and the screen
  did not.
- The screen had `body{padding-top:48px}` that print did not have.

`OVERRIDE_CSS` now has **zero `@media screen` blocks**. The only print-specific
rule left suppresses printed link URLs, which does not affect layout. Breathing
room above the sheet comes from `.frame-wrap` padding, *outside* the iframe,
where it cannot shift anything.

### 5. The editor gets its break points FROM the print engine

The editor is a `contenteditable` surface, so Paged.js cannot run on it directly
— it would rebuild the DOM under the caret and destroy the selection.

Instead `paginate_()` → `measureRealPageBreaks_()` paginates the **same document
in a hidden iframe** (identical stylesheet, identical width), asks Paged.js which
block begins each page, and `applyRealPageBreaks_()` places `.ed-pagebreak`
markers before exactly those blocks.

The editor therefore computes nothing. It mirrors the decisions of the engine
that produces the PDF. Verified in a real browser on a 7-page document: **every
page starts with the identical block in both**.

Both this and the reading view must wait for the page count to **settle**, not
merely become non-zero. Paged.js builds pages progressively; reading at first
sight of a page reported 2 pages for a document that actually had 7. The polls
require three consecutive equal counts before trusting the result.

### 6. The editor derives its typography from the print stylesheet

`buildEditorPageCss_()` takes `OVERRIDE_CSS` — the exact string the print iframe
uses — strips the rules that describe the sheet rather than the text (`@page`,
`html/body` framing, body padding), rescopes every selector to `.ed-area`, and
injects it.

**Do not hand-copy print values into `Stylesheet.html`.** That is what the
editor used to do, and every copy drifted: the font stack, `h4`, the letterhead,
body padding. Each drift moved every page break below it. `Stylesheet.html` now
describes only the *sheet* — width, page margins, background, shadow.

---

## Known-bad approaches — do not retry these

| Approach | Why it failed |
|---|---|
| Compute breaks by block height in JS | Ignores widows/orphans and `break-after: avoid`. Disagreed with the PDF on headings. Used in the editor until @200. |
| Reading the page count at first sight of `.pagedjs_page` | Paged.js paginates progressively — reported 2 pages for a 7-page document. Wait for the count to settle. |
| Painted background stripes every 297mm | CSS positioned the stripes, the browser positioned the text; they drifted ~102px per page and the band cut through paragraphs. |
| Mirrored clone sheets offset by CSS | Produced overlapping slices — a blank gap then text resuming mid-band. |
| CSS multi-column, cloned per page | Right engine, wrong plumbing: produced nested sheets with text overflowing. |
| `::marker { content: '✓' }` for the tick | Not portably supported; silently fell back to a plain black disc. |
| `::before` for the tick | The class lands in the DOM, but inside `contenteditable` the pseudo-element is not reliably repainted on class toggle. |

The tick marker is now `list-style-type: '✓  '` — a **real** marker box, painted
by the same code path as a bullet, so it cannot fail to repaint or drift.

---

## Testing this

**Verify in a real browser. Do not reason about CSS from source.**

Several of these bugs were invisible in code review and obvious in a screenshot —
the "one continuous white column" in particular looked completely correct in the
source. Use Puppeteer, build the harness from the **actual** `Index.html` /
`Stylesheet.html` markup (a guessed structure passed while the real one failed),
and assert on computed styles:

```js
// what to assert
sheets > 1                                   // Paged.js ran
getComputedStyle(sheet).backgroundColor      // === white
getComputedStyle(wrap).display               // === 'flex'
frameWrap.scrollHeight <= clientHeight + 2   // no middle scrollbar
iframe.height >= innerDoc.body.scrollHeight  // no inner scrollbar
```

---

## Current geometry

| | value | where |
|---|---|---|
| Sheet | A4, 210×297mm | `@page` in `OVERRIDE_CSS` |
| Page margins | 2.7cm top, 2cm bottom | `@page` |
| Text column | **688px** (816 − 64×2) | `body{max-width:816px;padding:0 64px}` |
| Usable height | **945px** per page | 1123 − 102 − 76 |
| Body type | 15px / 1.55 Sarabun | `OVERRIDE_CSS` |

These three views share every one of those numbers. Change them in
`OVERRIDE_CSS` and the editor follows automatically; change them anywhere else
and the views drift apart.
