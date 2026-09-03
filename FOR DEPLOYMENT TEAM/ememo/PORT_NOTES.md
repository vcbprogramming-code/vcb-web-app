# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead.

> **This port is behind the live app.** A batch of Apps Script changes landed
> after the last sync and were never carried across. Treat the Apps Script
> version as correct wherever the two disagree, and re-check before assuming a
> feature is missing rather than simply not yet ported.

## Where this port differs, and why

**Backend.** No Gmail, Drive or Sheets access — `getDocuments`, `getReview`,
submit and decision all run in memory. Apps Script functions are reachable only
through `google.script.run` inside Google's iframe.

**Sign-in is mocked.** `mockSignIn()` issues a token (owner = manager/admin,
`staff@vcb-con.com` = staff) instead of the Google OAuth popup, so every
role-gated flow can be exercised without real OAuth.

**Attachment streaming is stubbed.** There are no real files to stream, so the
review modal renders the letter view only.

**Date inputs use the native control** on all devices. The live app adds a
custom calendar to dodge older iOS quirks; the native picker is functionally
equivalent.

## Brought onto the shared VCB Connect chrome contract

This module cannot import `@vcb/shared` — it is a standalone TypeScript app —
so it carries its own copy of the shared bar's numbers rather than the
component itself. See `docs/CHROME.md` for what those numbers are and why; kept
here is what was specific to this module's own history.

**Theme and language did not follow from the portal.** `vcb-dm` / `vcb-lang`
were private keys nobody else wrote, so switching appearance in the portal did
nothing here, and the module's own theme effect wrote `vcb_theme` on every
mount — collapsing the shared `auto` default into a hard `light`/`dark` the
moment this module loaded, then handing that wrong value back to the portal on
the way out. Both now use the shared `vcb_theme` / `vcb_lang` keys, read from
`?theme=`/`?lang=` on arrival (written before first paint, in the pre-paint
bootstrap in `index.html`), and the effect writes the key only when someone
actually picks a theme here.

**The brand went nowhere.** It was `href="#"` with `preventDefault()`. It
carries the current theme and language to the portal now, like every other
module's brand link.

**Sarabun was never loaded.** The brand said 24px/800 and fell through to
Segoe UI, rendering 131.5px wide against every other module's 119.8px at the
same nominal size. Two `body` rules both declared `'Segoe UI'` first — the
second one, further down the file, was the one actually winning, which is why
fixing only the first would not have been enough.

**The date filter's "Date" label was redundant.** An empty `<input
type="date">` already renders `mm/dd/yyyy`; the label repeated that. It now
shows the chosen date instead, and only once one is picked.
