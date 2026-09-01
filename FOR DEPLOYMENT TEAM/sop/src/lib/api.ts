/**
 * Typed MOCK API layer — mirrors the GAS / Express REST contract so the React
 * UI needs no changes to its data model. Backed by an in-memory clone of
 * data/sop.json (seeded below). Swap these functions for real `fetch` calls
 * against src/server.ts to wire the standalone backend instead.
 *
 * Contract mirrored (apps-script/Code.js — one-way architecture, no
 * sync-from-Doc entry point; see that file's header comment):
 *   getSopDataForClient()          ← google.script.run.getSopDataForClient()
 *   editScenario(payload)          ← google.script.run.editScenario(data)   (admin-gated)
 *   createScenario(payload)        ← google.script.run.createScenario(data) (admin-gated)
 *   swapScenarioPositions(payload) ← google.script.run.swapScenarioPositions(data) (admin-gated)
 *   deleteScenario(payload)        ← google.script.run.deleteScenario(data) (admin-gated)
 *   getDriveFileName(url)          ← google.script.run.getDriveFileName(url)  (admin-gated)
 */
import seed from '../data/sop.json';
import type { SopData, Scenario, ScenarioEdit, ScenarioCreate, ScenarioSwap, ReportCreate } from '../data/types';

/* ----- Admin / session simulation -----
 * The real backend marks the request admin via a signed cookie / allow-listed
 * email. For the mock we expose a flag the host page can flip. Default: the
 * canonical admin email is "signed in" so the Edit affordances are visible for
 * sign-off (matches the demo intent of the port). */
const ADMIN_EMAIL = 'c.chavananand@vcb-con.com';

let session = { isAdmin: true, userEmail: ADMIN_EMAIL };

/** Flip the simulated session (used by the host page if needed). */
export function setSession(isAdmin: boolean, userEmail = isAdmin ? ADMIN_EMAIL : '') {
  session = { isAdmin, userEmail };
}

/** Mutable in-memory store (deep clone of the seed so edits don't touch the import). */
const store: SopData = JSON.parse(JSON.stringify(seed));

/** Mirrors assignDisplayNo_() in Code.js — per-module running number (e.g. "PO-3"),
 * recomputed fresh from current row order every time the store is read/mutated,
 * never stored as authoritative. */
function assignDisplayNo(scenarios: Scenario[]): void {
  const counters: Record<string, number> = {};
  scenarios.forEach((s) => {
    const m = s.module || '?';
    counters[m] = (counters[m] || 0) + 1;
    s.displayNo = m + '-' + counters[m];
  });
}
assignDisplayNo(store.scenarios);

/** Mirrors formatThaiDate_() in Code.js — "D เดือน พ.ศ." (Buddhist-era year). */
function formatThaiDate(d: Date): string {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/** Attach per-request session fields, mirroring server.ts withSession(). */
function withSession(): SopData {
  return {
    ...store,
    meta: { ...store.meta, isAdmin: session.isAdmin, userEmail: session.userEmail },
    scenarios: store.scenarios,
    reports: store.reports,
  };
}

/** Small async shim so callers see the same Promise contract as the REST API. */
function defer<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function requireAdmin(): void {
  if (!session.isAdmin) throw new Error('Unauthorized — open the admin sign-in URL.');
}

/** GET /api/data — latest store for in-place client refresh. */
export function getSopDataForClient(): Promise<SopData> {
  return defer(withSession());
}

/** POST /api/scenario — edit one scenario in place (admin only). */
export function editScenario(payload: ScenarioEdit): Promise<{ ok: true; no: number; scenarios: number }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  const target = store.scenarios.find((s) => s.no === payload.no);
  if (!target) {
    return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  }
  const nextModule = payload.module ?? target.module;
  const nextExtraModules = (payload.extraModules ?? target.extraModules ?? []).filter(
    (m) => m && m !== nextModule,
  );
  const next: Scenario = {
    ...target,
    module: nextModule,
    titleTH: payload.titleTH ?? target.titleTH,
    titleEN: payload.titleEN ?? target.titleEN,
    when: payload.when ?? target.when,
    steps: payload.steps ?? target.steps,
    note: payload.note ?? target.note,
    ref: payload.ref ?? target.ref,
    extraModules: nextExtraModules,
    // Undefined means "leave alone"; an empty array means "remove them all" —
    // same contract as editScenario() in Code.js.
    attachments: payload.attachments ?? target.attachments,
  };
  const idx = store.scenarios.indexOf(target);
  store.scenarios[idx] = next;
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, no: payload.no, scenarios: store.scenarios.length });
}

/** createScenario — append a brand-new case (admin only). Mirrors Code.js: the
 * new `no` is always the next sequential row-order id (length + 1). */
export function createScenario(payload: ScenarioCreate): Promise<{ ok: true; no: number; scenarios: number }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  if (!payload || !payload.module) return Promise.reject(new Error('Missing module.'));
  if (!payload.titleTH || !payload.titleTH.trim()) return Promise.reject(new Error('Missing title.'));

  const nextNo = store.scenarios.length + 1;
  const extraModules = (payload.extraModules || []).filter((m) => m && m !== payload.module);
  const created: Scenario = {
    no: nextNo,
    module: payload.module,
    titleTH: payload.titleTH.trim(),
    titleEN: (payload.titleEN || '').trim(),
    when: (payload.when || '').trim() || '-',
    steps: payload.steps || [],
    ref: (payload.ref || '').trim(),
    note: (payload.note || '').trim(),
    extraModules,
    attachments: payload.attachments || [],
    dateAdded: formatThaiDate(new Date()),
  };
  store.scenarios.push(created);
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, no: nextNo, scenarios: store.scenarios.length });
}

/** swapScenarioPositions — trade two cases' full content (identified by `no`
 * and the target's current displayNo, e.g. "PO-5"). Row count and every other
 * case's position is unaffected — a content swap, not a row move. */
export function swapScenarioPositions(payload: ScenarioSwap): Promise<{ ok: true; scenarios: number }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  if (!payload.swapWith) return Promise.reject(new Error('Missing target case (swapWith).'));

  const a = store.scenarios.find((s) => s.no === payload.no);
  if (!a) return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  const b = store.scenarios.find((s) => s.displayNo === payload.swapWith);
  if (!b) return Promise.reject(new Error('Case "' + payload.swapWith + '" not found — check the label and try again.'));
  if (a === b) return Promise.reject(new Error('Cannot swap a case with itself.'));

  const aIdx = store.scenarios.indexOf(a);
  const bIdx = store.scenarios.indexOf(b);
  const { no: aNo, ...aRest } = a;
  const { no: bNo, ...bRest } = b;
  store.scenarios[aIdx] = { no: aNo, ...bRest };
  store.scenarios[bIdx] = { no: bNo, ...aRest };
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, scenarios: store.scenarios.length });
}

/** deleteScenario — remove one case entirely (admin only). Every later case in
 * the same module renumbers up by one (displayNo is always recomputed, never stored). */
export function deleteScenario(payload: { no: number }): Promise<{ ok: true; scenarios: number }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  const idx = store.scenarios.findIndex((s) => s.no === payload.no);
  if (idx < 0) return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  store.scenarios.splice(idx, 1);
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, scenarios: store.scenarios.length });
}

/** createReport — append a new row to the reports table (admin only). Mirrors
 * Code.js: no server-assigned id, `case` is just a label the caller supplies. */
export function createReport(payload: ReportCreate): Promise<{ ok: true; reports: number }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  if (!payload || !payload.scenario || !payload.scenario.trim()) {
    return Promise.reject(new Error('Missing scenario description.'));
  }
  if (!payload.path || !payload.path.trim()) {
    return Promise.reject(new Error('Missing menu path.'));
  }
  const caseNo = Number.isFinite(payload.case) ? payload.case : store.reports.length + 1;
  store.reports = [...store.reports, { case: caseNo, scenario: payload.scenario.trim(), path: payload.path.trim() }];
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, reports: store.reports.length });
}

/** The bootstrap payload the page boots with (mirrors doGet's BOOTSTRAP). */
export function bootstrap(): SopData {
  return withSession();
}

/* ----- Drive filename lookup -----
 * Mirrors getDriveFileName(url) in Code.js, which opens the file with
 * DriveApp and returns getName() minus its extension so the editor can
 * pre-fill an attachment's name when a link is pasted.
 *
 * THIS MOCK CANNOT ACTUALLY RESOLVE A NAME. Reading Drive metadata needs an
 * authenticated server call; this port has no server, and the browser cannot
 * fetch it directly (Drive sends no permissive CORS headers for file
 * metadata). Returning '' is the honest answer and is also the exact shape the
 * real function returns for an unresolvable file — the caller already treats
 * that as "leave the field alone", so the editor degrades to manual typing
 * with no error path of its own.
 *
 * To make this real against the Express backend, add an endpoint that proxies
 * the Drive API with a service credential and swap the body for a fetch. */
export function getDriveFileName(url: string): Promise<{ name: string }> {
  try {
    requireAdmin();
  } catch (e) {
    return Promise.reject(e);
  }
  // Both branches return the same thing here; the id check is kept so this
  // mock rejects a non-Drive URL for the same *reason* the real one does,
  // rather than by accident.
  if (!driveFileId(String(url || ''))) return defer({ name: '' });
  return defer({ name: '' });
}

/** Server-side twin of driveFileId() in DetailPane.tsx / the canonical
 * index.html. Kept here so the mock can reject a non-Drive URL the same way
 * the real function does. */
function driveFileId(u: string): string {
  const m =
    u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}
