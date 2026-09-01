# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead — so
nobody spends a day rediscovering why.

## Where this port differs, and why

**PIN hashing is not ported.** The mock keeps editor PINs in plain text. The
live app salts and hashes them server-side, which a browser cannot do without
giving away the algorithm. Do **not** treat the mock's version as a security
model — it exists so the sign-in flow can be exercised, nothing more.

**Google Sign-In is not ported.** It needs a real OAuth client id and a
server-side token check. The mock simulates a signed-in session instead.

**The editor's hidden-iframe measuring pass is not ported.** The live app
measures rendered content in an off-screen iframe to decide page breaks — a
Google Docs technique with no browser equivalent.

**Print geometry differs.** The `.ed-area` page rules (`210mm`,
`2.7cm 17mm 2cm`) apply only in the live app, where they make the on-screen page
and the exported PDF break identically.

**Backend.** Everything else routes through a typed mock (`src/api/mock.ts`)
mirroring the real API's shapes. Apps Script functions are reachable only via
`google.script.run` inside Google's iframe. See `supabase/` for the real
replacement.

## One rule

Do not reintroduce Google Doc creation or importing. It was deliberately
retired on 2026-07-19 — meetings are written in the app now, and re-enabling
the import would overwrite real edits with stale Doc content.
