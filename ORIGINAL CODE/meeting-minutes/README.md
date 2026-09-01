# VCB Meeting Minutes

รายงานการประชุมภายใน — the internal record of company meetings for VCB Group.

Staff read minutes filed by project stream. Admins and editors write them.
Recordings made in Fathom or Transkriptor arrive on their own and wait as drafts
until someone files them into a project.

## What it does

- **Minutes by project** — each recurring meeting stream keeps its own list
- **Per-project visibility** — a project is either open to everyone, or locked
  to a named list of people
- **Automatic transcript intake** — finished recordings from Fathom and
  Transkriptor become draft entries, admin-only until tagged into a project
- **Attachments** — PDFs, slides and documents kept per meeting
- **Comments** — staff can discuss a meeting inline
- **Edit history** — every previous version of every meeting is kept, so any
  change can be reviewed or recovered
- **PDF export** — page breaks match what you see on screen

## Access

Three roles. **Admins** manage projects, visibility and who may edit.
**Editors** write and change meeting content. Everyone else reads whatever the
projects they can see allow.

Roles are still being rolled out, so what you see today is not the finished
access model.

## Data

One Google Sheet, `VCB Meeting Minutes — Database`
(`1ouYa11iXkwi3tZiL6yKMy742c9nnh7ACQf0j_tRCCfs`), found via the script property
`MINUTES_DB_SPREADSHEET_ID`. Tabs: Minutes (one row per meeting), Content
(bodies, chunked because a cell has a size limit), Versions, AUDIT_LOG,
FATHOM_RAW_LOG.

**Every edit is recoverable.** Saving snapshots the previous body into Versions
first, and nothing is ever pruned — so both imported transcripts and meetings
written in the app keep their full history.

If the stored id will not open the app fails loudly rather than creating a blank
replacement.

## Notes

A recording can belong to more than one project: it stays in its inbox and is
tagged into each project it is relevant to, rather than being moved.

Meetings are written and edited in the app. Nothing is imported from elsewhere.
