# Setup & Deployment

Day-to-day workflow for editing, pushing, and verifying changes to the VCB Credit Facility Web App. If you're new here, read [../README.md](../README.md) first.

---

## Prerequisites

- **Node.js 18+** with `npm` on PATH
- **`@google/clasp`** v3.x — `npm install -g @google/clasp`
- A Google account that has **Editor** access to the Apps Script project (scriptId `183uDd0fXOiniijzMXZuz3Y7ZryuOkuULDDupa3mSfQM_oawzcL2AVIqW`) and **Editor** access to the master sheet (`1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY` — see [Master sheet status](#master-sheet-status)).
- Windows PowerShell (the provided `deploy.ps1` is PowerShell). Bash on Windows can also work with `cmd /c clasp <cmd>` — bare `clasp` may fail with `PSSecurityException` until you set an execution policy.

> Today the deploying account is `c.chavananand@vcb-con.com`. Web-app traffic runs `executeAs: USER_DEPLOYING`, so whoever last deployed is the account whose Drive holds the runtime sheet.

---

## One-time setup

1. **Authenticate clasp**
   ```powershell
   clasp login
   ```
   Sign in with the account that owns the Apps Script project.

2. **Confirm the local project is linked**
   The bundled [.clasp.json](.clasp.json) already points to the right `scriptId`. Verify with:
   ```powershell
   clasp status
   ```

3. **Confirm script properties are set on the live project**
   In the Apps Script editor → **Project Settings** → **Script properties**, there must be:
   - `MASTER_SHEET_ID` = `1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY`

   If missing, `setupMaster_()` will create a brand-new master spreadsheet on
   first run and store its id here. That is correct behaviour for a genuine
   first run and wrong in every other case, so set the property manually to
   bind to the existing sheet before opening the app.

---

## Daily workflow: making a change

```powershell
# 1. Sync remote down first if anyone might have edited via the Apps Script editor
clasp pull                                        # optional, but recommended

# 2. Make your edit to Code.js / Seed.js / index.html

# 3. Push local source to the Apps Script project
clasp push --force

# 4. Snapshot the pushed code as a versioned build
clasp create-version "short description of change"
# -> note the printed "Created version N"

# 5. Point the live deployment at that new version (URL does NOT change)
clasp redeploy AKfycbytkA07aNklbDv3gKca-iI02FPCdC1Q0i3gAtE1Ls1ry9MCoIUmG_KabhCBip8C0vn91g `
  --versionNumber N `
  --description "short description of change"
```

Then refresh the live web app. **Apps Script serves the page inside a sandbox iframe and caches HTML aggressively, so a plain F5 (and sometimes even Ctrl+F5) shows the OLD version.** Most reliable ways to see a new deploy:

1. Append a cache-buster to the `/exec` URL: `…/exec?v=<version>` (changes the URL → forces a fresh fetch).
2. Hard reload: **Ctrl+Shift+R**.
3. Or just wait ~1–2 min for Google's edge cache to expire.

**Verify** with:
```powershell
clasp deployments        # the @N number after the deployment id should match what you just pushed
```

### Why three steps instead of `clasp deploy`?
In clasp 3.x, `clasp deploy --deploymentId <id>` **silently no-ops** — it doesn't snapshot newly-pushed code. You must use `create-version` + `redeploy` to actually move the live deployment forward.

### The wrapper script
[deploy.ps1](deploy.ps1) runs the exact 3-step flow above for you: `clasp push --force` → `clasp create-version` → `clasp redeploy <live deployment>` (it reads the new version number automatically and keeps the stable `/exec` URL). Run it as `.\deploy.ps1 "short description of the change"`.

---

## Local ↔ remote drift

`clasp push` overwrites the remote — if someone edited code in the Apps Script editor between your last pull and your push, **their changes will be lost**. Before any push:

```powershell
# Safe diff: clone remote to a temp folder and compare
$tmp = Join-Path $env:TEMP "vcb_cf_check_$(Get-Random)"
mkdir $tmp; Push-Location $tmp
clasp clone 1H_qKDmB82sMFAtshDiwzC61LmXhGUKo9V5j7MbWZDRDNN3ysZy6_k8RP
Pop-Location
fc /N "$tmp\Code.js" "Code.js"
Remove-Item -Recurse -Force $tmp
```

Files that exist **only on the remote** (not in this folder) will silently be deleted by `clasp push --force`. Currently all four (`Code.js`, `Seed.js`, `index.html`, `appsscript.json`) live both here and on the remote.

---

## Master sheet status

As of the **2026-08-05 recovery** (the project from the prior 2026-05-23 recovery, `1rvARww1jMh…`, was itself deleted; this folder is now pushed into project `183uDd0fX…`), `MASTER_SHEET_ID` **is set** on the live script — bound via `bindMaster()` to the existing master sheet, so no data was lost. For reference, `getMaster_()`'s behavior on any future recovery:

- If `MASTER_SHEET_ID` = `1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY` and the deployer account can open that sheet → **reuse the existing master**, keeping all user-entered Transactions, Requests, Limits, Audit, CashPlan rows.
- If the stored sheet ID **can't be opened** → `getMaster_()` throws and says so. It does **not** create a replacement. That was the behaviour until 2026-07-01, when it orphaned a month of data onto a fresh seed; the guard has been in place since.
- If the property is **unset** → `setupMaster_()` creates a new master sheet and seeds it from `Seed.js`. That is a genuine first run. It is also why you should bind the property before first open on any recovery: an unset property looks exactly like a first run.

**On any future project recovery**, set it manually before opening the web app: Apps Script editor → Project Settings → Script properties → Add `MASTER_SHEET_ID` = `1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY` — or run `bindMaster('1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY')` once from the editor's function dropdown (a plain admin function in `Code.js`, already there for this purpose).

---

## Key IDs

| What | ID | Where it's referenced |
|------|-----|----------------------|
| Apps Script project | `183uDd0fXOiniijzMXZuz3Y7ZryuOkuULDDupa3mSfQM_oawzcL2AVIqW` | [.clasp.json](.clasp.json) |
| Master spreadsheet | `1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY` | Script property `MASTER_SHEET_ID` |
| Live deployment (Google login required) | `AKfycbytkA07aNklbDv3gKca-iI02FPCdC1Q0i3gAtE1Ls1ry9MCoIUmG_KabhCBip8C0vn91g` | The `/exec` URL in [../README.md](../README.md); access = **Anyone with Google Account** |
| **Old (deleted, 2026-05-23) Apps Script project** | `1H_qKDmB82sMFAtshDiwzC61LmXhGUKo9V5j7MbWZDRDNN3ysZy6_k8RP` | superseded — kept for audit only |
| **Old (deleted, 2026-08-05) Apps Script project** | `1rvARww1jMh5WP-5GVUKpj-hLmiR6OtvZCpUpyeqVKDm6EfrjVDGus1RM` | superseded — kept for audit only |
| **Old (dead) deployment URLs** | `AKfycbz4ZYgwTPIIOHDzhEyMEv74VmZoT-vcmJ-jsbGU1E63rKfCf10JxmOl_9sO8SR4KV22-w`, `AKfycbztWhyi0anTnTu8lOkMYVrECpRStAn0jqjlNrfxPlnnTwkk1t45XfCofWiv9wLLVEisjQ` | Anything still linking to these needs updating |

**2026-08-05 second deletion incident:** the Apps Script project from the first recovery (`1rvARww1jMh…`) was itself deleted from Drive — same failure signature (`/exec` URL showed Google Drive's "Sorry, the file you have requested does not exist" page; `clasp deployments` returned `Requested entity was not found`). Recovered by creating a brand-new standalone project (`clasp create-script --type standalone`), pushing this folder's source into it, deploying fresh, then running the existing `bindMaster('1hZtE7druGaOjjm7FeH5VQQCzyhbHKwoQ0xhIEbiuoXY')` helper (Code.js) once from the Apps Script editor to rebind `MASTER_SHEET_ID` — this preserved all existing Transactions/Requests/Limits/Audit/CashPlan data instead of reseeding blank. **Root cause of the deletions is still unknown** — worth checking Drive activity/audit log on the script file if it happens a third time.

The Drive shortcut [VCB Credit Facility Master.gsheet](../VCB%20Credit%20Facility%20Master.gsheet) (project root) opens the master sheet (still alive, unaffected by either incident). Any shortcut/bookmark pointing at the old script IDs above needs re-pointing to <https://script.google.com/d/183uDd0fXOiniijzMXZuz3Y7ZryuOkuULDDupa3mSfQM_oawzcL2AVIqW/edit>. Drive shortcuts are keyed by `doc_id`, so re-dragging the new URL into this folder is the fix.

---

## Permissions & managers

- The `MANAGERS` array in [Code.js](Code.js) lists emails allowed to approve/reject requests. To add someone, edit the array and redeploy. (Note: only `vcb-con.com` Workspace users are identified to the server — see the Access model note — so a manager email must be on that domain to be recognised.)
- The web app requires a Google sign-in to open (any Google account; `access: ANYONE`). It is **not** restricted to the `vcb-con.com` domain — see [Access model](#access-model-whole-app-requires-google-login-single-deployment).

---

## Access model: whole app requires Google login (single deployment)

The entire app requires a Google sign-in — there is **one** web-app deployment whose "Who has access" is **Anyone with Google Account** (`"access": "ANYONE"` in [appsscript.json](appsscript.json), `executeAs: USER_DEPLOYING`). Google forces the login before the app loads. There is no public/anonymous mode and no separate "Dashboard" deployment — the dashboard cards just sit on top of every tab. See [README → Access model](../README.md#access-model).

The normal **daily workflow** above already covers it (push → create-version → redeploy the one deployment). Nothing special to flip.

> Server code runs as the deployer, so the master sheet only needs to be shared with the deployer — visitors never need direct sheet access. Because access is "any Google account" (not restricted to the `vcb-con.com` domain), out-of-domain users' emails aren't visible to the server (`Session.getActiveUser().getEmail()` is empty for them) — sign-in is still enforced by the deployment. To get reliable server-side identity for everyone, restrict access to the `vcb-con.com` domain.

---

## Cold-start: rebuilding data

If you ever need to wipe and reseed:

1. Create a new spreadsheet by hand, in Drive.
2. Open the Apps Script editor and run `bindMaster('<the new sheet id>')`.
3. Run `setupMaster_()` to build the tabs from `SEED_PROJECTS`,
   `SEED_FAC_TYPES`, `SEED_FACILITIES` and `SEED_TXNS` in [Seed.js](Seed.js).

> `resetMaster()` used to do all of this in one click and was **removed on
> 2026-09-01**. It deleted `MASTER_SHEET_ID` before rebuilding, which made the
> "no id stored means genuine first run" guard pass by construction — so it
> would happily abandon a live database and point the app at a blank one. The
> data survived; the app just stopped looking at it. Rebuilding is now two
> deliberate steps, neither reachable by a mis-click from the function
> dropdown.

The facility baseline lives 100% in `Seed.js` (NOT in the sheet). The sheet only stores Transactions, Requests, Limits, Audit, and CashPlan. So to correct a facility number, edit `Seed.js` and redeploy — don't edit the sheet.

### Where the seed numbers come from

`Seed.js` is hand-extracted from monthly-snapshot xlsx files in:

```
H:\My Drive\WORK\01 FINANCE & ACCT\4. วงเงินกู้โครงการ\
```

| xlsx | Project |
|------|---------|
| `A วงเงินชวนา ปี 2565-69.xlsx` | `CVE` |
| `วงเงินกู้กิจการร่วมค้าวีเคเริ่ม2568.xlsx` | `VK2` |
| `วงเงินสินเชื่อ โครงการบางวัว-ตอน6xlsx.xlsx` | `BV` |
| `วงเงินสินเชื่อ โครงการบางเตย ตอน 1 -เริ่ม2568 .xlsx` | `BT1` |

The other 4 projects (`LPB`, `PN4`, `EP`, `V&K`) have no xlsx yet — their rows in `SEED_FACILITIES` are all-zero placeholders. When new xlsx files appear, extract the final "คงเหลือวงเงินใช้ได้" balance per facility section and update `SEED_FACILITIES` + `SEED_TXNS` accordingly, then redeploy.
