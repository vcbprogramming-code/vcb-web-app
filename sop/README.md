# VCB-MANGO ERP — SOP

เว็บแอปคู่มือปฏิบัติงาน — the working manual for everyone who uses VCB Group's
MANGO ERP system.

Staff look up how a task is meant to be done: which steps, in which order, and
who is responsible at each one.

## What it does

- **Procedures by ERP module** — sales, purchasing, inventory, accounts payable
  and receivable, and the rest
- **Search and filter** across every procedure
- **Step-by-step scenarios** — each numbered, with the responsible role marked
- **Flow diagrams** attached to the procedures they illustrate
- **Print to document** — any section formats cleanly for paper
- **Editing in the app** — procedures are written and renumbered here, with
  every version kept so a change can be undone

## Access

Everyone reads. Writing a procedure — adding, rewording or renumbering — is for
**editors**.

Roles are still being rolled out, so what you see today is not the finished
access model.

## Data

No spreadsheet. The manual is one JSON document held in the app's own script
properties, with a fast cache in front of it.

The flow-diagram PDFs live in a fixed Drive folder, addressed by id. Never look
that folder up by name and never create one — an earlier version did, missed,
and left a stray duplicate that had to be cleaned up by hand.

## Notes

A copy of the manual is also written out to a Google Doc as each change is
saved, so there is always a readable version outside the app. That copy is
one-way — editing the Doc does not change what the app shows.
