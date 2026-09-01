# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead — so
nobody spends a day rediscovering why.

## Where this port differs, and why

**Backend.** The Apps Script server functions are replaced by a typed mock
backed by `localStorage` (`src/mockBackend.ts`). Apps Script exposes its
functions only through `google.script.run`, which works inside Google's own
iframe — a standalone app cannot call them over HTTP. See `supabase/` for the
real replacement.

**User identity.** `DEMO_EMAIL` defaults to `''` (Guest), matching how the live
app behaves for a visitor Google does not identify. Set it to a real address to
exercise the signed-in path.

**Footer version.** Left at `v1.1` to match the Apps Script source exactly. That
source is itself behind its deployed version — a discrepancy in the original,
deliberately not "fixed" here.
