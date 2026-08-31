# VCB Credit Facility

Tracks the credit lines VCB Group holds across its construction projects — how
much is available, how much has been drawn, and what is committed but not yet
paid.

Finance and management use it to see a project's remaining headroom before
approving a new drawdown.

## What it does

- **Facilities by project** — each credit line with its limit, type and terms
- **Credit ledger** — every drawdown, repayment and settlement recorded against
  its facility, so the used and remaining figures follow from the entries rather
  than being kept by hand
- **Requests and approvals** — a drawdown is requested, then approved or
  declined by a manager, with the decision and decider recorded
- **Category budgets** — a spending cap per cost category, warning when
  in-flight requests are about to exhaust one
- **Monthly cash plan** — forecast income and outgoings by period, alongside
  what actually happened
- **Audit log** — every change kept with what it was before

## Access

Everyone with access can read. Approving a request, changing a limit or editing
the ledger is restricted to **managers** — the decision and who made it are
recorded against the request.

Roles are still being rolled out, so what you see today is not the finished
access model.

## Notes

Some figures are derived rather than stored — used credit comes from the ledger
entries unless a manager deliberately pins it to a fixed number.
