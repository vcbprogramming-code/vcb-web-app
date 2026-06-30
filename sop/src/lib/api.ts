/**
 * Typed MOCK API layer — mirrors the GAS / Express REST contract so the React
 * UI needs no changes to its data model. Backed by an in-memory clone of
 * data/sop.json (seeded below). Swap these three functions for real `fetch`
 * calls against src/server.ts to wire the standalone backend instead.
 *
 * Contract mirrored:
 *   getSopDataForClient()  ← GET  /api/data
 *   syncFromDoc()          ← POST /api/sync
 *   editScenario(payload)  ← POST /api/scenario  (admin-gated)
 */
import seed from '../data/sop.json';
import type { SopData, ScenarioEdit, Scenario } from '../data/types';

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

/** POST /api/sync — re-read the store (no Doc here, so just stamp + return counts). */
export function syncFromDoc(): Promise<{ ok: true; scenarios: number; reports: number; syncedAt: string }> {
  store.meta.updatedAt = new Date().toISOString();
  return defer({
    ok: true as const,
    scenarios: store.scenarios.length,
    reports: store.reports.length,
    syncedAt: store.meta.updatedAt,
  });
}

/** POST /api/scenario — edit one scenario in place (admin only). */
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
  const next: Scenario = {
    ...target,
    titleTH: payload.titleTH ?? target.titleTH,
    titleEN: payload.titleEN ?? target.titleEN,
    when: payload.when ?? target.when,
    steps: payload.steps ?? target.steps,
    note: payload.note ?? target.note,
    ref: payload.ref ?? target.ref,
  };
  const idx = store.scenarios.indexOf(target);
  store.scenarios[idx] = next;
  store.meta.updatedAt = new Date().toISOString();
  return defer({ ok: true as const, no: payload.no, scenarios: store.scenarios.length });
}

/** The bootstrap payload the page boots with (mirrors doGet's BOOTSTRAP). */
export function bootstrap(): SopData {
  return withSession();
}
