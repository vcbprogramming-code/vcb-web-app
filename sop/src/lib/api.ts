/**
 * Typed MOCK API layer — mirrors the canonical app's write contract so the
 * React UI needs no changes to its data model. Backed by an in-memory clone
 * of data/sop.json (seeded below). Swap these functions for real `fetch`
 * calls to wire a real backend instead.
 *
 * Contract mirrored (all write paths — the canonical app is one-way, app →
 * Doc backup only; there is no sync-from-Doc endpoint to mirror):
 *   getSopDataForClient()          ← current data, refreshed after any write
 *   editScenario(payload)          ← admin-gated
 *   createScenario(payload)        ← admin-gated
 *   swapScenarioPositions(payload) ← admin-gated
 *   deleteScenario(payload)        ← admin-gated
 */
import seed from '../data/sop.json';
import type { SopData, ScenarioEdit, ScenarioCreate, ScenarioSwap, ScenarioDelete, Scenario } from '../data/types';

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

/**
 * Assigns each scenario a per-module display label ("PO-1", "IC-3", …) —
 * restarts at 1 within each module, in store order. Mirrors assignDisplayNo_()
 * in Code.js. `no` stays the unique identity used for lookups/selection/edits;
 * `displayNo` is purely a derived label, recomputed whenever the store changes.
 */
function assignDisplayNo(scenarios: Scenario[]): void {
  const counters: Record<string, number> = {};
  scenarios.forEach((s) => {
    const m = s.module || '?';
    counters[m] = (counters[m] || 0) + 1;
    s.displayNo = `${m}-${counters[m]}`;
  });
}

/** Module code → SOP manual chapter number, mirrors MODULE_CHAPTER in Code.js. */
const MODULE_CHAPTER: Record<string, string> = {
  SE: '1', BD: '2', OF: '3', PO: '4', IC: '5',
  AP: '6', AR: '7', PM: '8', FA: '9', GL: '10',
};

/** Mutable in-memory store (deep clone of the seed so edits don't touch the import). */
const store: SopData = JSON.parse(JSON.stringify(seed));
assignDisplayNo(store.scenarios);

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

/** GET /api/data — latest store for in-place client refresh. */
export function getSopDataForClient(): Promise<SopData> {
  return defer(withSession());
}

/** Edit one scenario in place (admin only). */
export function editScenario(payload: ScenarioEdit): Promise<{ ok: true; no: number; scenarios: number }> {
  if (!session.isAdmin) {
    return Promise.reject(new Error('Unauthorized — open the admin sign-in URL.'));
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  const target = store.scenarios.find((s) => s.no === payload.no);
  if (!target) {
    return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  }
  let ref = payload.ref ?? target.ref;
  // Module changed (case moved to a different module, e.g. PO → IC)? Swap
  // ONLY the "บทที่ N (MOD)" chapter+label pair in the ref, mirroring
  // editScenario()'s ref surgery in Code.js — leaves any other chapter
  // references or custom wording in the ref text untouched.
  if (payload.module && payload.module !== target.module) {
    const newChapter = MODULE_CHAPTER[payload.module] || '';
    if (newChapter) {
      const oldChapterPattern = /บทที่\s*\d+(\s*\([^)]*\))?/;
      const newChapterText = `บทที่ ${newChapter} (${payload.module})`;
      ref = oldChapterPattern.test(ref) ? ref.replace(oldChapterPattern, newChapterText) : (ref ? ref + ' | ' : '') + newChapterText;
    }
  }
  const next: Scenario = {
    ...target,
    module: payload.module ?? target.module,
    titleTH: payload.titleTH ?? target.titleTH,
    titleEN: payload.titleEN ?? target.titleEN,
    when: payload.when ?? target.when,
    steps: payload.steps ?? target.steps,
    note: payload.note ?? target.note,
    ref,
    // Undefined = leave existing tags untouched; an array (even []) replaces
    // them wholesale, mirroring editScenario()'s extraModules handling in Code.js.
    extraModules: payload.extraModules !== undefined ? payload.extraModules : target.extraModules,
  };
  // Replace with a NEW array (not mutate in place) — React's useMemo in
  // Sidebar.tsx keys off array identity to recompute per-module counts, so an
  // in-place store.scenarios[idx] = next left counts stale after an edit.
  store.scenarios = store.scenarios.map((s) => (s.no === payload.no ? next : s));
  // A module change shifts this case's position within its (old and new)
  // module counters — displayNo must be recomputed, same as after a create.
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, no: payload.no, scenarios: store.scenarios.length });
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** Format a Date as "D เดือน พ.ศ." (Thai Buddhist-era month name + year),
 * mirrors formatThaiDate_() in Code.js. */
function formatThaiDate(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** POST /api/scenario/new — create a new scenario (admin only). Mirrors
 * createScenario() in Code.js: server assigns `no` (max existing + 1) and
 * stamps dateAdded with today's date. */
export function createScenario(payload: ScenarioCreate): Promise<{ ok: true; no: number; scenarios: number }> {
  if (!session.isAdmin) {
    return Promise.reject(new Error('Unauthorized — open the admin sign-in URL.'));
  }
  if (!payload || !payload.module) {
    return Promise.reject(new Error('Missing module.'));
  }
  if (!payload.titleTH || !payload.titleTH.trim()) {
    return Promise.reject(new Error('Missing title.'));
  }
  const nextNo = store.scenarios.reduce((max, s) => Math.max(max, s.no), 0) + 1;
  const chapter = MODULE_CHAPTER[payload.module] || '';
  let ref = (payload.ref && payload.ref.trim()) || (chapter ? `ERP Manual 14.3.68 – บทที่ ${chapter}` : '');
  if (chapter && ref.indexOf(`บทที่ ${chapter}`) < 0) {
    ref += (ref ? ' | ' : '') + `บทที่ ${chapter}`;
  }
  const scenario: Scenario = {
    no: nextNo,
    module: payload.module,
    titleTH: payload.titleTH.trim(),
    titleEN: (payload.titleEN || '').trim(),
    when: (payload.when || '').trim() || '-',
    steps: (payload.steps || []).map((s) => s.trim()).filter(Boolean),
    ref,
    note: (payload.note || '').trim(),
    dateAdded: formatThaiDate(new Date()),
    extraModules: (payload.extraModules || []).filter((m) => m && m !== payload.module),
  };
  store.scenarios = [...store.scenarios, scenario];
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, no: nextNo, scenarios: store.scenarios.length });
}

/** POST /api/scenario/swap — trade the ENTIRE content of two cases (e.g.
 * PO-3 ↔ PO-5); every other case's position is unaffected. Mirrors
 * swapScenarioPositions() in Code.js. `no` (the real identity) and the
 * derived `displayNo` are NOT swapped — only the content fields are, which
 * is what makes the two cases appear to have traded places. */
export function swapScenarioPositions(payload: ScenarioSwap): Promise<{ ok: true; scenarios: number }> {
  if (!session.isAdmin) {
    return Promise.reject(new Error('Unauthorized — open the admin sign-in URL.'));
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  if (!payload.swapWith) {
    return Promise.reject(new Error('Missing target case (swapWith).'));
  }
  const a = store.scenarios.find((s) => s.no === payload.no);
  if (!a) {
    return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  }
  const target = payload.swapWith.trim().toUpperCase();
  const b = store.scenarios.find((s) => s.displayNo === target);
  if (!b) {
    return Promise.reject(new Error(`Case "${payload.swapWith}" not found — check the label and try again.`));
  }
  if (a === b) {
    return Promise.reject(new Error('Cannot swap a case with itself.'));
  }
  const CONTENT_FIELDS: (keyof Scenario)[] = [
    'module', 'titleTH', 'titleEN', 'when', 'steps', 'ref', 'note', 'dateAdded', 'extraModules',
  ];
  const aContent: Partial<Scenario> = {};
  const bContent: Partial<Scenario> = {};
  CONTENT_FIELDS.forEach((k) => {
    (aContent as any)[k] = a[k];
    (bContent as any)[k] = b[k];
  });
  store.scenarios = store.scenarios.map((s) => {
    if (s === a) return { ...s, ...bContent };
    if (s === b) return { ...s, ...aContent };
    return s;
  });
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, scenarios: store.scenarios.length });
}

/** POST /api/scenario/delete — remove a case entirely. Every later case in
 * the same module renumbers up by one (displayNo is recomputed from array
 * order, same as everywhere else). Mirrors deleteScenario() in Code.js. */
export function deleteScenario(payload: ScenarioDelete): Promise<{ ok: true; scenarios: number }> {
  if (!session.isAdmin) {
    return Promise.reject(new Error('Unauthorized — open the admin sign-in URL.'));
  }
  if (!payload || !payload.no || payload.no < 1) {
    return Promise.reject(new Error('Missing scenario number.'));
  }
  const exists = store.scenarios.some((s) => s.no === payload.no);
  if (!exists) {
    return Promise.reject(new Error('Scenario #' + payload.no + ' not found.'));
  }
  store.scenarios = store.scenarios.filter((s) => s.no !== payload.no);
  assignDisplayNo(store.scenarios);
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, scenarios: store.scenarios.length });
}

/** The bootstrap payload the page boots with (mirrors doGet's BOOTSTRAP). */
export function bootstrap(): SopData {
  return withSession();
}
