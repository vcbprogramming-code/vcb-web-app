# VCB Meeting Minutes

A web app for the VCB / CVE construction projects that stores meeting minutes
in one searchable, access-controlled place.

## Open the app

**🔗 Live URL**
https://script.google.com/macros/s/AKfycbxJN7olKBYqGHlaWXiVOI41fh8oZJ9lRstXZAj1DFVeiynyvfBf48xaKX5p4D19rUnr/exec

*(Use this exact form, not the `/a/vcb-con.com/` Workspace-scoped variant — that form routes through Google's own account redirector, which can drop query-string params like `?meeting=` or `?project=` and land on the homepage instead. See [CHANGELOG.md](CHANGELOG.md)'s 2026-08-15 entry.)*

(also available as the shortcut **`VCB Meeting Minutes — Open App.url`** in this folder.)

## Who can use it

**Reading** needs no sign-in, but what is readable depends on the project:

- **🔓 Public projects** — anyone who opens the link reads every visible
  meeting in them. Any email address, any domain, no account needed.
- **🔒 Locked projects** — readable only by admins, editors, and the specific
  email addresses named on that project. A locked project is *not* open to
  all `@vcb-con.com` staff; it is a named guest list.

**Editing** always needs a sign-in — Google Sign-In, or an email + 4-digit
PIN as a fallback. Editors can edit content in any project; only admins
manage access, projects, and hidden/pinned status.

Both are managed in **Settings → 🔐 Project access** (admins only). See
[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for the full access model.

## How content gets in

Admins and editors add/edit meetings directly in-app ("＋ New meeting" / "✎ Edit here"). A private Google Sheet is the app's own database — **the Sheet is the single source of truth** (Google Docs are no longer read from). Fathom and Transkriptor recordings can also arrive automatically via webhook into their own inbox queues, for an admin to file into a project.

## Devices

Desktop, tablet and phone. The meeting document is a real A4 sheet, so on a
narrower screen it is scaled to fit rather than cropped; on a tablet in
portrait the meeting list moves behind a ☰ toggle to leave the page room to
be read.

## More detail

See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for architecture, deployment notes, and how to maintain it.
Before changing anything about how the document is displayed, printed or
edited, read [PAGINATION.md](PAGINATION.md).
