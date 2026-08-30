# PORT_NOTES — GAS ↔ React sync ledger

This React subfolder is a **live mirror** of the Google Apps Script (GAS) project at
the repo root. The GAS source is canonical. After any change to the GAS code, diff it
against this folder and update only what changed; re-extract the `<style>` block
**verbatim** (never hand-edit `src/index.css`). Record the sync below.

## Last synced

- **GAS deployed version:** v15 (per root `CHANGELOG.md` "Current state")
- **Synced source files:** `Code.js`, `index.html`, `appsscript.json`
- **Date:** 2026-06-29
- **Parity:** full — every screen, mode, toggle, dialog, flow, i18n, theme, reveal,
  and responsive behavior below is mirrored.

## File mapping (GAS → React)

| GAS source | React file(s) | Notes |
| --- | --- | --- |
| `index.html` `<style>` block | `src/index.css` | Extracted **verbatim** via regex; never hand-edited. |
| `index.html` markup (topbar, hero, banner, grid, footer) | `src/App.tsx` | Scriptlets (`<? ?>`) → JSX; `apps.forEach` → `APPS.map`. |
| `index.html` admin modal markup + `(function(){…})()` admin IIFE | `src/AdminModal.tsx` | Step machine (`unlock`/`editor`), token cache, inline clear-confirm. |
| `index.html` globe markup | `src/Globe.tsx` | `--i` stagger var preserved per line. |
| `index.html` inline SVGs | `src/icons.tsx` | One component per icon; `AppIcon` switch mirrors the scriptlet `if/else` incl. generic fallback. |
| `index.html` `I18N` + `Code.js` `APPS` | `src/data.ts` | EN/TH dict + app list copied verbatim. |
| `Code.js` server functions | `src/mockBackend.ts` | Typed mirror; localStorage-backed (no REST `/exec` for portal data). |
| (shapes of the above) | `src/types.ts` | `AppEntry`, `Announcement`, `AnnouncementInput`, `Lang`, `Dict`, etc. |
| `index.html` reveal IIFE, lang toggle, greeting, banner dismiss | `src/App.tsx` (effects) | Same timings (0/70ms early, 1200/90ms late), same `prefers-reduced-motion` gate. |
| `doGet()` template bootstrap (`apps`, `announcement`, `adminInitialized`) | `src/App.tsx` initial state + `src/mockBackend.ts` | `getAnnouncement()` / `isAdminInitialized()` read at mount instead of server-render. |

## GAS API contract → mock (signatures are the contract)

| `Code.js` function | Mock in `mockBackend.ts` | Return / throws |
| --- | --- | --- |
| `getActiveUserEmail()` | `getActiveUserEmail(): Promise<string>` | email or `''`; mock `DEMO_EMAIL` (default `''` = Guest). |
| `getAnnouncement()` | `getAnnouncement(): Announcement \| null` | only when `show:true`. |
| `isAdminInitialized()` | `isAdminInitialized(): boolean` | password-hash present. |
| `unlockAdmin(password)` | `unlockAdmin(pw): Promise<string>` | token; throws `"Password must be at least 6 characters."` / `"Incorrect password."` |
| `saveAnnouncement(token, payload)` | `saveAnnouncement(token, payload \| null): Promise<Announcement \| null>` | throws `"Your admin session expired…"` / `"Add at least a title or a message."` |
| `getAnnouncementForEdit(token)` | `getAnnouncementForEdit(token): Promise<Announcement \| null>` | ignores `show`; throws on expired token. |

### Storage key mapping (GAS → mock)

| GAS (server/browser) | Mock (browser `localStorage`) |
| --- | --- |
| `ANNOUNCEMENT_JSON` (ScriptProperties) | `vcb_mock_announcement` |
| `ADMIN_PASSWORD_HASH` (ScriptProperties, SHA-256) | `vcb_mock_admin_hash` (SHA-256 via Web Crypto) |
| `ADMIN_TOK_<uuid>` (CacheService, 30 min) | `vcb_mock_tok_<uuid>` (expiry timestamp, 30 min) |
| `vcb_connect_ann_dismissed` (localStorage) | `vcb_connect_ann_dismissed` (unchanged) |
| `vcb_connect_admin_token` (localStorage) | `vcb_connect_admin_token` (unchanged) |
| `vcb_connect_lang` (localStorage) | `vcb_connect_lang` (unchanged) |

## Parity checklist (all verified)

- Topbar: brand mark; EN/TH globe toggle + language badge; user chip (Connecting… → name / Guest); admin gear hidden unless `?admin=1`.
- Announcement banner: initial render from storage; title/body with preserved line breaks (`white-space: pre-wrap`); per-device dismiss keyed by `id`; re-shows on new `id`.
- Hero: welcome + glow text; description; 3 status pills (`SYSTEM ONLINE`, `N APPS`, `VCB-CON.COM`).
- Globe: 6 meridians, 5 parallels, 2 orbit rings, radar sweep, power-up boot sequence, 2 energy pulses.
- Apps grid: 5 cards, per-app accent var, icon, name, desc, `Launch →`; open in new tab (`rel="noopener noreferrer"`).
- Admin modal: first-time-setup vs unlock copy; editor; cached-token fast path; **inline themed clear-confirm** (not native `confirm()`); Save/Clear/Close; msg err/ok states; Esc + backdrop close.
- i18n: full EN/TH incl. per-app name/desc; a real name overrides the toggle; persisted.
- Reveal animation + `prefers-reduced-motion`.
- Responsive: 860px and 480px breakpoints (from verbatim CSS).
- Footer: `VCB Group · Internal Use Only` / `v1.1 · <year>` (matches the GAS hardcoded `v1.1`).

## Known intentional differences (documented, not parity gaps)

- **Backend:** GAS server functions are replaced by a browser-side typed mock
  (localStorage). No deployed REST endpoint exists for the portal's own data, so this
  is the default per the porting brief. Swap `src/mockBackend.ts` to wire a real API.
- **User identity:** `DEMO_EMAIL` defaults to `''` (Guest), the canonical
  `ANYONE_ANONYMOUS` state. Flip it to a real address to demo the signed-in name path.
- **Footer version:** kept as `v1.1` to match the GAS source exactly (the GAS footer is
  itself out of sync with deploy v15 — noted in root `CHANGELOG.md`).
