# Port notes — credit-facility

Converted to the VCB Connect stack (TECH_STACK.md): React 18, Vite 5, Tailwind 3,
React Router 6, JavaScript only, talking to the single Express API at `api/`.

`npm run build` succeeds with no TypeScript step.

## What the previous version actually was

Worth knowing before reading the diff. The old `src/` was **not** a React app.
It was a 35-line React shell that injected the Apps Script UI verbatim:

- `src/app/body.html` (249 lines) mounted through `dangerouslySetInnerHTML`,
  preserving every `id` and inline `onclick`;
- `src/app/legacy.js` (3,189 lines) appended as a **classic `<script>`** so its
  top-level functions landed on `window` and those inline handlers resolved;
- `src/gas.ts`, a `google.script.run` Proxy shim pointing at a 464-line
  in-memory mock backend.

So there was one React component in the whole module and no components to
convert — the UI had to be rebuilt as React. That is what this change is.

## Files

| | before | after |
|---|---|---|
| TypeScript | 9 files, ~800 lines | 0 |
| Injected HTML + classic JS | 3,438 lines | 0 |
| Mock backend | 475 lines | 0 |
| Hand-written CSS | 460 lines | 0 (48-line Tailwind entry) |
| React (`.jsx`) | 1 file, 35 lines | 21 files, ~3,900 lines |
| Plain `.js` | 0 | 6 files, ~1,300 lines |

Deleted: `tsconfig.json`, `vite.config.ts`, `src/App.tsx`, `src/main.tsx`,
`src/gas.ts`, `src/types.ts`, `src/vite-env.d.ts`, `src/styles.css`,
`src/lib/supabaseClient.ts`, `src/mock/`, `src/app/`, the stale
`package-lock.json`, and the committed `dist/`.

`typescript`, `@types/*` and `@supabase/supabase-js` are out of `package.json`.
Added: `@vcb/shared`, `react-router-dom`, `tailwindcss`, `postcss`,
`autoprefixer`. React stays 18 and Vite stays 5.

## Data layer

The browser no longer talks to Supabase — there is no Supabase client left in
the module. Everything goes through `createApi` from `@vcb/shared` to the
Express API. `SEED_PROJECTS` / `SEED_FAC_TYPES` are gone; those are now the real
`credit.projects` and `credit.facility_types` tables.

Endpoints wired, all under `/api/credit`:

| | |
|---|---|
| `GET /data` | the whole module in one payload |
| `GET /transactions`, `GET /requests` | filtered lists |
| `GET /cost-categories`, `GET /cash-plan`, `GET /audit` | |
| `POST /requests` · `PATCH /requests/:id` · `DELETE /requests/:id` | |
| `POST /requests/:id/decide` | approve / reject |
| `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id` | |
| `POST /transactions/:id/settle` · `POST /transactions/:id/status` | |
| `PUT /limits` · `PUT /limits/used-override` | |
| `PUT /category-caps` · `PUT /cost-categories` | |
| `PUT /cash-plan` · `DELETE /cash-plan/:id` | |

### Mismatches resolved

**Requests could never be approved.** In `src/mock/api.ts`, `addRequest()`
called `insertTxn()` and pushed onto the **transactions** array, while
`decideRequest()` searched a separate **requests** array that nothing ever wrote
to. A request created in the UI was therefore unfindable and undecidable. There
are two real tables now; request creation points at `POST /requests`, and
approval goes through `POST /requests/:id/decide` — which also writes the linked
drawdown transaction in the same database transaction, so an approved request
cannot exist without its ledger row.

**`due` vs `maturity`.** The DB has only `due_date`; the route's
`toTransaction()` maps it to both names. The client reads `due` on transactions
and `maturity` on requests, matching what each endpoint actually returns.

**Response shapes** are taken from `credit.js`, not from the mock. Notably
`GET /data` returns `me`, `facilities`, `costCategories`, `categoryCaps`,
`transactions`, `requests` — and *not* `projects` / `facTypes`, which the mock's
`AppData` did include.

**`credit.facilities.interest` is TEXT** — free-form Thai such as `MLR ต่อปี` or
`1.25 % ต่อปีเรียกเก็บทุก 3 เดือน`. It is displayed verbatim and never coerced.
Overdue-interest estimates parse a leading percentage and return `null` when
there is not one, so the UI shows `ระบุอัตราไม่ได้` rather than a fabricated 0.

## What the API does not provide but the UI needs

**`GET /api/credit/projects` and `GET /api/credit/facility-types` do not exist.**
Both tables are real and seeded in `003_credit.sql`, but no route exposes them
and `GET /data` omits them. The UI needs them for:

- project dropdowns and the Thai project name in every table (`credit.projects
  .name_th`);
- the **company** filter and the company auto-filled on a request
  (`credit.projects.company`) — with no route, that filter has nothing to list;
- facility-type dropdowns and the `BG` / `T/L` / `B/E` document pills
  (`facility_types.name_th`, `.kind`, `.doc_kind`).

`src/lib/api.js` requests both and treats a **404 as "not implemented yet"**,
falling back to project codes derived from the data and to the `KIND_SHORT` map
in `src/lib/domain.js`. The app stays usable, but until the routes land it shows
codes (`BT1`) instead of names (`บางเตย ตอน 1`) and the company filter is empty.

Two small routes would close this — both are plain selects over seeded tables
and need no new schema:

```js
router.get('/projects', asyncRoute(async (_req, res) => {
  const list = await rows(
    'select code, name_th, company, sort_order from credit.projects where active order by sort_order nulls last, code'
  );
  res.json(list.map((p) => ({
    code: p.code, nameTh: p.name_th, company: p.company, sortOrder: p.sort_order,
  })));
}));

router.get('/facility-types', asyncRoute(async (_req, res) => {
  const list = await rows(
    'select no, code, name_th, name_en, kind, doc_kind from credit.facility_types order by no'
  );
  res.json(list.map((t) => ({
    no: t.no, code: t.code, nameTh: t.name_th, nameEn: t.name_en,
    kind: t.kind, docKind: t.doc_kind,
  })));
}));
```

The client already accepts both `nameTh` and `name_th`, so either casing works.

Also missing, lower priority:

- **No `PATCH /facilities`.** Limits are editable through `PUT /limits`, but a
  facility's `type`, `interest` and `notes` are read-only in the UI — there is
  no route to change them.
- **Cash-plan editing is coarse.** `PUT /cash-plan` replaces a whole period.
  The Apps Script UI edited individual income and deduction lines in place with
  a debounced per-cell save; this version renders the T-bar and creates and
  deletes sections, and per-line editing would want either a finer endpoint or a
  local-draft-then-save flow.
- **`exportXlsx` has no server route.** The export is built client-side with
  SheetJS from the filtered data (`src/lib/exportExcel.js`), lazy-loaded so it
  stays out of the initial bundle. `TECH_STACK.md` names ExcelJS for
  *server-side* generation; if the export should move to the API, that is the
  library to use there.

## Bilingual

`src/lib/i18n.js` is a `createDictionary()` of ~250 stable dot keys with
`{ th, en }` values, merged over `commonDictionary` by `I18nProvider`. Thai is
the default.

The old app had **no keys**: it rendered Thai into the DOM and then, on
switching to English, walked the tree with a `MutationObserver` swapping Thai
text nodes via a longest-match-first table (`I18N_DICT` / `I18N_EXTRA`). The
Thai string *was* the key, so any copy edit silently broke the English.

Every `th` value here is that app's exact Thai, carried across character for
character — spacing, `…`, `—` and all. Every `en` value is the English that
table already supplied. Neither side was retranslated.

Status values are a deliberate exception: `คำขอใหม่`, `อนุมัติ`, `ไม่อนุมัติ`
and friends are **stored in the database** and validated by the Zod enums in
`credit.js`, so they live in `src/lib/domain.js` as data. Translating one would
change what gets written. The `status.*` keys are only the labels shown for them.

## Styling

Tailwind 3 via `presets: [require('../shared/tailwind.preset.js')]`, with
`content` covering `./src/**/*.{js,jsx}` **and** `../shared/src/**/*.{js,jsx}`
so shared classes are not purged. Verified in the built CSS: the preset's brand
palette, the Sarabun-first font stack and the `dark:` variants all emit.

Theme is the shared convention — `class="dark"` on `<html>`, key `vcb_theme`.
The old `html.dark` + private `:root` custom properties are gone, as is
`localStorage['vcb-dark']`. `index.html` carries the pre-paint theme script from
`shared/src/theme.jsx` so dark mode does not flash white on load.

## Auth

Apps Script gave identity free via `Session.getActiveUser().getEmail()`, so the
app had no login. As a SPA there is none — identity is the JWT the API issues,
and `src/components/SignIn.jsx` is where it is obtained. `me.isManager` from
`GET /data` only hides controls; `requireRole('credit','manager')` in the API is
the actual gate.

## Constraints

No TypeScript · no Redux (Context + `useState`) · no UI kit (primitives are
hand-written in `src/components/ui.jsx`) · no chart library (the dashboard
meters are CSS, the variance bars are inline SVG).

## Build

```
dist/index.html      1.63 kB │ gzip:   0.89 kB
dist/assets/*.css   23.34 kB │ gzip:   5.11 kB
dist/assets/*.js   272.10 kB │ gzip:  84.85 kB
dist/assets/xlsx*  429.03 kB │ gzip: 143.08 kB   (lazy — only on Export)
```
