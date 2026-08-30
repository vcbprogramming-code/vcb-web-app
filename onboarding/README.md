# VCB 90-Day Onboarding Portal

A web app that walks new hires at **Vichitbhan Construction Co., Ltd.** through a 90-day onboarding journey: required documents, department selection, and three 30-day checklist phases, ending in a completion celebration.

There are **two separate codebases** here. They are two implementations of the same product, not two layers of one system — each is a complete app with its own frontend and its own backend.

| Folder | What it is | Status |
|---|---|---|
| [ORIGINAL CODE/](ORIGINAL%20CODE/) | **Google Apps Script** — vanilla JavaScript, HTML Service pages, Google Sheets + Drive as the backend. | **This is the live app.** Currently deployed and in use. |
| [FOR DEPLOYMENT TEAM/](FOR%20DEPLOYMENT%20TEAM/) | **React + TypeScript** — Vite, React Router, Supabase (Postgres + Storage) as the backend. Has its own git repo, ready for GitHub. | A complete port, but **not deployed anywhere** and not yet verified against a real Supabase project. |

## Which one do I touch?

- **Fixing or changing the app people actually use today** → `ORIGINAL CODE/`. Start with its [README](ORIGINAL%20CODE/README.md), then [docs/ARCHITECTURE.md](ORIGINAL%20CODE/docs/ARCHITECTURE.md).
- **Working on the React/TypeScript version for deployment** → `FOR DEPLOYMENT TEAM/`. Start with its [README](FOR%20DEPLOYMENT%20TEAM/README.md).

## Keeping the two in step

As of 2026-08-30 the React port has been brought up to parity with the Apps Script app's v183→v188 fixes — server-side admin authorization, department-switch cleanup, load/save failure surfacing, name correction, upload validation, the phase-complete celebration, and the accessibility work. Its README carries a table of where each one lives.

They are still two codebases, so a change made in one does not appear in the other. `ORIGINAL CODE/` remains the source of truth for behavior, because it is the version actually in production and the only one verified against a real backend. When you change one, decide explicitly whether the other needs the same change — that decision is the whole maintenance cost of keeping both.

## Product framing

This is deliberately a **lightweight orientation aid, not an HR-monitored system**: the 90-day process is short, every employee prints a completion form at the end regardless, and there is no admin/HR progress-tracking dashboard or aggregate rollup across employees — an explicit, considered decision (read the raw Google Sheet directly if you need to know who's engaged), not a missing feature. Notification emails were surveyed and explicitly deferred. See [the product framing section](ORIGINAL%20CODE/docs/ARCHITECTURE.md#product-framing-a-lightweight-orientation-aid-not-an-hr-monitored-system) before proposing either.

## Quick facts

- **Live deployment**: Google Apps Script web app — script ID and deployment ID are in [ORIGINAL CODE/docs/DEPLOYMENT.md](ORIGINAL%20CODE/docs/DEPLOYMENT.md).
- **Departments**: Accounting, Finance, Procurement, Property & Asset Management, Engineering — an employee belongs to exactly one at a time.
- **Languages**: English / Thai, switchable in-app.
- **Design system**: ported from the sibling "VCB Connect" web app (dark navy sidebar, electric blue accent, Orbitron/Inter fonts, card-based light/dark theme).
