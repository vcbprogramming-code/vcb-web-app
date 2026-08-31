# Port notes

The React app is a 1:1 port of `../ORIGINAL CODE/`. This file records only the
places where a 1:1 port was **not possible**, and what was done instead — so
nobody spends a day rediscovering why.

## Where this port differs, and why

**One source defect is fixed rather than mirrored.** Opening the AI-function
count while the registry is open throws a `ReferenceError` in the original.
`FunctionRegistry.tsx` computes the count properly instead. This is the only
place the port corrects rather than copies, because mirroring it would mean
shipping a guaranteed crash on a normal user action.

**`FocusDetail` is ported but unrendered.** Kept so the component exists if the
feature is wanted later; it is not reachable in the UI.

## One rule

`src/styles.css` is extracted **verbatim** from `Index.html`. Never hand-edit
it — if the source CSS changes, re-extract. Editing it directly is how the two
silently drift apart.
