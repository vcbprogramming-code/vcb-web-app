# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/apps-script/`. This file
records only the places where a 1:1 port was **not possible**, and what was done
instead — so nobody spends a day rediscovering why.

## Where this port differs, and why

**Content is bundled, not fetched.** The live app parses its content from a
Google Doc and caches it. The port compiles the same content into `src/data/`,
because a browser app cannot read that Doc. See `supabase/` for the real
replacement.

**Drive filename lookup is not mirrored.** In the live app this genuinely
resolves attachment filenames from Drive; there is no browser equivalent, and no
client-visible behaviour depends on it.

**Dead code left out.** `flowPlaceholder()` in the original is never called —
`renderFlowDetail` uses `placeholder()` instead. Not ported, no behaviour change.

## One rule

Server-only helpers with no client-visible effect are not mirrored. If you find
something in `Code.js` missing here, check whether it produces anything the user
can see before rebuilding it.
