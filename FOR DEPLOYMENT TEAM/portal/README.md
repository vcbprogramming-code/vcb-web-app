# Portal

The front door of VCB Connect: sign-in for the whole suite, the app-tile
launcher, company announcements, and the holiday calendar.

## Stack

React 18 · Vite 5 · Tailwind 3 · React Router 6 · JavaScript only.
Shared auth, i18n, theme and API client come from `@vcb/shared` (aliased to
`../shared/src`, not installed). See `../../TECH_STACK.md` for what is
deliberately excluded.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173 (Vite takes the next free port if busy)
```

The API must be running too — see `../api/README.md`. The browser holds no
database credentials; every request goes through `api/src/routes/portal.js`,
wrapped by `src/lib/portalApi.js`.

## What to read next

| File | For |
|---|---|
| `../docs/functional-spec/portal.md` | Every screen and function, and the logic behind them |
| `PORT_NOTES.md` | Where the port could not match the Apps Script original, and why |
| `../docs/functional-spec/platform-shared.md` | The API, `@vcb/shared`, and the database schema |
| `../docs/ONE_DOMAIN.md` | Deployment topology (why all modules share one origin) |
