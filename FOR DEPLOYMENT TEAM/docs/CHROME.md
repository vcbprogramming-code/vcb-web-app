# The chrome every module wears

The bar across the top of each module, and the rules that keep the eight
applications reading as one product rather than eight.

`shared/src/AppBar.jsx` is the single implementation. A module that renders its
own bar drifts — that is not a prediction, it is what happened: before this,
six modules had four different filenames for the same component, two had no way
back to the portal at all, and the brand text was 17px, 18px or 20px depending
on which file you opened.

E-Memo is the reference the rest were standardised against. It is a standalone
TypeScript app that cannot import `@vcb/shared`, so it carries its own copy of
these numbers in `ememo/src/styles.css`. Any change here has to be made there
too.

---

## The measurements

Everything below is verified by measuring the rendered element, not by reading
the stylesheet. Those two disagree more often than seems possible — see
**Measuring** at the end.

| | Value | Where |
|---|---|---|
| Bar height | 72px | `py-4` + content |
| Bar padding | 28px | `px-7` |
| Brand "VCB Group" | 24px / 800 | `text-[24px] font-extrabold` |
| Brand ↔ divider gap | 16px | `gap-4` on the brand row |
| Divider | 1px × 40px, `white/45` | `h-10 w-px` |
| Module title | 12.5px / 700, uppercase, 2.5px tracking | |
| Subtitle | 13px / 500, `leading-[1.35]` | |
| Gear | 40 × 40, 9px radius, 18px icon | `h-10 w-10 rounded-[9px]` |
| Gear inset from right | 28px | matches bar padding |
| Identity | 13px / 500 | |

Two of these have a reason that is not obvious:

**The subtitle's `leading-[1.35]`, not `leading-none`.** A 13px line box for a
13px face leaves no room for descenders. Sarabun needs about 14px of ink, so
`leading-none` inside an `overflow-hidden` parent sliced the tail off every
`g` — visible in "meeting" and "Log".

**The gear is a square, not a padded chip.** Set `height` without `width` and
side padding decides the width: E-Memo's 13px padding made it 43px against
everyone else's 40, a rounded rectangle beside a square.

---

## Typeface

Sarabun, loaded at `wght@400;500;600;700;800` in every module's `index.html`.

Sarabun leads the stack because it covers Thai and Latin in one face, so a
mixed line does not change weight mid-string.

**Load all five weights.** The brand is 800. A module that requests up to 700
gets a browser-synthesised fake bold, which is narrower than the real cut: the
same string at the same size rendered 118.2px with a fake 800 and 119.8px with
the real one. A module that loads no font at all fell back to a local face and
rendered 125.8px. All three looked "24px bold" in the stylesheet.

---

## What each module supplies

```jsx
<AppBar
  title={t('app.title')}         // the module name, set in uppercase
  subtitle={t('app.subtitle')}   // what the module does
  identityNote={role}            // optional, shown after the email
>
  {/* a search box, a nav — whatever belongs in the bar */}
</AppBar>
```

**Both keys resolve by language.** `{ th: 'ไทย', en: 'English' }`, each
language holding its own words. Two ways this has gone wrong:

- System Map's `app.subtitle` held the *opposite* language to `app.title`, so
  Thai mode read the English name and English mode read the Thai one.
- SOP had no `app.title` at all and both its subtitle keys held one fixed
  string for both languages, so an English reader got Thai.

**Modules do not pass the company name.** The bar supplies it from
`app.company` in the shared dictionary, in the reader's language. When each
module carried its own copy there were four variants in use, including
`Vichitphan` with a p — a misspelling that reached the Credit Facility banner
and stayed there. A subtitle arriving in the old `<company> · <descriptor>`
shape has the company half stripped, but only when that half actually names the
company.

---

## The gear, and what goes behind it

Appearance and language live behind the gear, never as their own buttons. They
are set once and then forgotten; a button spends the rest of its life competing
for attention with controls people actually came to use.

`settingsExtra` is where a module adds what only it has — SOP's default view,
Meeting Minutes' project access. Appearance and language are there for
everyone and are not a module's business to reproduce.

The sheet is `z-[1000]`. It has to outrank whatever the module stacks beneath
it: at `z-50` it opened *behind* System Map's trace overlay (`z-65`) and detail
sidebar (`z-200`), so pressing the gear in trace mode appeared to do nothing.

---

## Identity

The signed-in email sits after the gear, and reads **"Sign in"** when nobody
is. Rendering nothing leaves a person unable to tell "not signed in" from "the
bar has no room for it".

It is visible at every width. It used to carry `hidden lg:inline-flex`, so
below 1024px the bar showed nothing at all — and every screenshot that looked
correct had been taken at 1600px with a token injected, which hid both halves
of the problem. It truncates now instead of vanishing.

AppBar reads auth through `useAuthOptional()`, which returns `null` rather than
throwing. System Map has no `AuthProvider` by design — it is a static renderer
with nothing to protect — and `useAuth()` blanked the whole page. The bar must
not be the thing that forces a login wall onto a module that needs none.
`useAuth()` keeps its throw: a missing provider there is a wiring bug.

Portal and Onboarding are sidebars, not topbars. Both show the account; neither
can sit at the same coordinates as a bar module.

---

## Getting home

The brand is the way back to the portal, as it is on most sites, and it carries
the current theme and language so the portal does not flip appearance when
someone returns.

`VITE_PORTAL_URL` says where the portal is, defaulting to `/` because on one
domain the portal **is** the root (see `ONE_DOMAIN.md`).

**On localhost that default is wrong.** Each module runs on its own port, so
`/` is the module's own home and the brand link reloads the page you are on.
Local development needs a `.env.local` per module:

```
VITE_PORTAL_URL=http://localhost:5180
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` matters for the same reason and is easier to miss: it is empty
in production because a relative `/api/...` resolves on one domain, but on
localhost the API is a separate origin. Without it every request goes to the
module's own port, 404s, and the page renders its shell with no data —
"Failed to load data" with an otherwise perfect-looking bar.

---

## Theme and language, across origins

`localStorage` is per-origin. On localhost a module on port 5185 cannot read
what the portal wrote on 5180, and in production the same is true of any
deployment that is not one domain.

That is what `?theme=` and `?lang=` on module links are for. Every module
reading the shared providers honours them already. E-Memo has its own store and
did not, so arriving from a light portal it fell back to whatever it had — it
now reads both in its pre-paint bootstrap and persists them before first paint.

`vcb_theme` holds `light | dark | auto`, and `auto` follows the OS. **Write it
only when someone picks a theme.** Writing on mount collapses `auto` into a
hard `light` or `dark`, which pins that module to one theme and then hands the
wrong value to the portal on the way back.

---

## Measuring

The recurring failure in all of this is checking the source instead of the
result. Three cases, all of which passed a source read:

- The gear's stylesheet said 40px and 9px radius, matching. Rendered, it was
  43px wide with a text glyph where everything else had an SVG.
- The lane arrows in System Map had identical markup, size, weight and colour,
  and rendered a quarter of the ink — the original sets Segoe UI, where that
  character is a solid arrowhead; this port uses Sarabun, where it is a thin
  chevron.
- The brand was `24px/800` in all eight modules and rendered four different
  widths.

An element can also exist, carry the right classes, and still be unseeable:
hidden below a breakpoint, or pushed 1,700px below the fold. A presence check
passes on both.

Measure the rendered element. `getComputedStyle` for values,
`getBoundingClientRect` for geometry, `document.fonts.check()` for which face
actually loaded — the computed `fontFamily` only echoes the stack back.
