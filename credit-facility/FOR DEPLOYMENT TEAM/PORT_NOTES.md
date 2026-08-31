# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead — so
nobody spends a day rediscovering why.

## Where this port differs, and why

**Identity.** `whoAmI()` returns `c.chavananand@vcb-con.com`, a manager, so
attribution and manager-only paths can be exercised. In the live app this is
whoever is signed in with Google — a browser app has no equivalent until real
authentication is wired up.

**Persistence.** In memory only; a hard refresh resets everything. The live app
writes to the master Google Sheet. See `supabase/` for the real replacement.

**Excel export.** Built client-side with SheetJS to the same sheets, columns and
filters as `Code.js#exportXlsx`. The live app builds it via a temporary Sheet
plus a Drive export, which a browser cannot do. Output is identical.
