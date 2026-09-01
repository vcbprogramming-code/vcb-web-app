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
