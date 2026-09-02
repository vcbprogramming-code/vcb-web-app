# Access rights — the structure

*Who may open which app, where that is decided, and what is deliberately not
wired yet.*

---

## 1. What this covers

**App access** — which *staff* can open HR, Credit Facility, SOP and so on.
Enforced by the API against a role carried in the sign-in token.

It is not repository access. Which *developers* can read the source is a GitHub
setting and has nothing to do with anything below.

---

## 2. The shape

Every signed-in person carries **one role per app**:

```js
roles = { hr: 'admin', credit: 'manager', sop: 'editor' }
```

An app missing from that object means **no access to that app**. There is no
"none" role and no empty string — absence is the signal, so a new app is
inaccessible until somebody grants it rather than open until somebody
remembers to close it.

One role per app, not a list. The token, the database primary key and the
admin screen all assume this. Supporting several simultaneous roles would be a
schema change *and* a token change; doing it accidentally by inserting a second
grant row would silently apply whichever sorted first.

### The vocabulary

Seeded in `portal.app_roles` from the `requireRole()` calls that already exist,
so the table describes the running system rather than an intention.

| App | Roles (least to most) |
|---|---|
| `hr` | `staff` → `manager` → `admin` |
| `credit` | `viewer` → `manager` |
| `minutes` | `editor` → `admin` |
| `sop` | `editor` |
| `portal` | `admin` |
| `ememo`, `sysmap`, `onboarding` | *(none defined)* |

An app with no roles is open to everyone who can sign in. That is a real
answer, not a gap — the system map is a diagram and the onboarding pages are
for new starters who have no roles yet. The admin screen shows such an app with
nothing to assign.

---

## 3. Where it is administered

The same endpoints serve two screens, on purpose.

### The portal's settings — everything

Every person, every app, one table. This answers *"what can Somchai reach?"*
and is where a new joiner is set up in one pass.

### Each app's own settings — that app only

Scoped with `?app=hr`. An HR administrator manages HR access without being
handed the credit facility. The senior role in each app carries the right to
administer that app (`adminableApps()` in `api/src/routes/portal.js`), so this
does not require a portal admin standing by.

Scope is enforced server-side. `?app=` is a client input, and *"the screen only
sends its own app"* is not a security boundary.

The alternative — a bespoke admin surface per module — is six places to fix a
bug and six chances for them to disagree about what `editor` means.

---

## 4. The endpoints

All under `/api/portal`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/access/roles?app=` | The vocabulary. Render dropdowns from this, never hard-code role names. |
| `GET` | `/access/grants?app=&email=` | Existing grants, narrowed by app or person. |
| `GET` | `/access/person/:email` | One person across every app — the per-person matrix in one call. |
| `PUT` | `/access/grants` | Grant, change, or revoke. `role: null` revokes. |
| `GET` | `/access/audit?email=&app=` | Change history. Portal admins only. |

`PUT` is idempotent: send the state you want, not a delta. The client helpers
are in `shared/src/access.js` so both screens share one shape.

---

## 5. What is stored

`supabase/migrations/008_access.sql`

| Table | Holds |
|---|---|
| `portal.app_roles` | The vocabulary: which roles each app understands. |
| `portal.access_grants` | Who holds which role in which app. One row per person per app. |
| `portal.access_audit` | Every change, forever. Written by a trigger. |

The audit is a **database trigger**, not API code, so a one-off script or a
`psql` session is recorded too. A log with gaps is not evidence. It has no
foreign key back to `access_grants` deliberately: revoking access deletes the
grant, and the record of the revocation has to outlive it.

---

## 6. What is NOT wired — read this before deploying

**Nothing above is enforced yet.**

`api/src/auth.js` `resolveRoles()` still reads the six original per-module
tables — `hr.users`, `credit.managers`, `minutes.admins`, `minutes.editors`,
`sop.sop_editors`, `portal.portal_admins`. A grant written through the new
endpoints changes what the admin screens display and **not** what anyone can
actually open.

This is deliberate. Switching `resolveRoles()` to read `portal.access_grants`
is roughly twenty lines, and it must happen *after* the new table is populated
and checked — otherwise the first deploy locks everybody out of the portal that
administers the access.

### The remaining work, in order

1. **Build the two screens** against the endpoints above.
2. **Backfill** `portal.access_grants` from the six existing tables, and diff
   the result against `resolveRoles()` for every real user until they agree.
3. **Switch `resolveRoles()`** to a single query against `access_grants`.
4. **Then** add the router-level guards. `credit.js` carries a comment marking
   exactly where its guard goes and what it should say.

Steps 1–3 change nothing about who can open what. Only step 4 does, and by then
the data has been verified.

### Also unenforced today, and correctly so

`credit.js` mounts `requireAuth` but no role check, so any signed-in person can
read the credit ledger. That is a consequence of demo mode, not an oversight —
gating it now would lock everyone out of a module whose permissions nobody can
yet grant. The one-line change is written in the comment at the top of the
router.

### Intentionally open regardless

SOP, Meeting Minutes, Onboarding and Portal reads are anonymous by design and
documented in each route file. The SOP is reference material staff open without
signing in; Meeting Minutes has genuinely public projects. Do not "fix" these.
