# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead — so
nobody spends a day rediscovering why.

## Where this port differs, and why

**Backend.** The live app reads and writes a Google Sheet. A browser app cannot
call Apps Script's server functions, so data comes from a typed mock
(`src/mock.ts`) using the **same return shapes** as the real API
(`src/types.ts`). Keep those contracts whatever backend replaces the mock — see
`supabase/`.

**"Today" is pinned** to 2026-05-18 (`TODAY` in `src/App.tsx`) so the sample
month shows a realistic mix of locked, editable and future days. The live app
uses the real date.

**The printed leave slip is not ported.** The live version opens a print window
and writes a standalone A4 document into it. Its layout rules — a single 10.5pt
type scale, a 34mm/1fr field grid, nowrap labels, mm/pt units — exist only in
`../ORIGINAL CODE/Code.gs`. Rebuild from there if the slip is needed.
