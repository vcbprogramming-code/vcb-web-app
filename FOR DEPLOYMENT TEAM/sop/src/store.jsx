/**
 * The SOP store — Context + useState, per TECH_STACK.md (no Redux).
 *
 * What changed from the old store.tsx, beyond dropping the types:
 *
 *   · Data comes from the API, not a bundled mock. There is therefore a real
 *     loading state, a real error state, and a real NOT_SEEDED state.
 *   · Language and theme are gone from here. They belong to the shared
 *     I18nProvider / ThemeProvider now, on one key each across all seven SPAs
 *     (vcb_lang / vcb_theme), replacing this module's old sop-lang / sop-night.
 *   · Navigation is gone from here too — React Router owns it. What is left is
 *     document state, the search box, and the mutations.
 *   · isAdmin comes from meta.isAdmin, which the API injects from the caller's
 *     JWT. It hides UI. It is not the gate; requireRole('sop','editor') is.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@vcb/shared';
import * as sopApi from './lib/sopApi.js';

const StoreContext = createContext(null);

/** Document-load lifecycle. A plain object rather than a TS enum. */
export const STATUS = {
  loading: 'loading',
  ready: 'ready',
  /** The API answered 404 NOT_SEEDED — no document row exists yet. Expected
   * before the content import; gets an onboarding screen, not an error page. */
  notSeeded: 'notSeeded',
  error: 'error',
};

const EMPTY_DOC = { meta: {}, scenarios: [], reports: [] };

export function StoreProvider({ children }) {
  const { user, hasRole } = useAuth();

  const [doc, setDoc] = useState(EMPTY_DOC);
  const [status, setStatus] = useState(STATUS.loading);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  /** Set when a write is rejected. Held separately from `error` so a failed
   * save does not blank out the document the person is still looking at. */
  const [writeError, setWriteError] = useState(null);

  // Bumping this refetches. Every mutation bumps it, because the API recomputes
  // displayNo on read and a mutation can renumber a whole module.
  const [reloadTick, setReloadTick] = useState(0);

  // Guards a late response from a superseded request overwriting a newer one.
  const requestSeq = useRef(0);

  const load = useCallback(async (signal) => {
    const seq = ++requestSeq.current;
    try {
      const data = await sopApi.fetchSop({ signal });
      if (seq !== requestSeq.current) return;
      if (data === null) {
        setDoc(EMPTY_DOC);
        setStatus(STATUS.notSeeded);
        return;
      }
      setDoc({
        meta: data.meta || {},
        scenarios: data.scenarios || [],
        reports: data.reports || [],
      });
      setStatus(STATUS.ready);
      setError(null);
    } catch (err) {
      if (err?.name === 'AbortError' || seq !== requestSeq.current) return;
      setError(err);
      setStatus(STATUS.error);
    }
  }, []);

  // Refetch on mount, on every mutation, and when the signed-in identity
  // changes — meta.isAdmin is derived from the caller's token, so signing in
  // must re-read the document to reveal the Edit affordances.
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, reloadTick, user?.email]);

  const refresh = useCallback(() => {
    setWriteError(null);
    setReloadTick((n) => n + 1);
  }, []);

  /**
   * Run a mutation, then reload.
   *
   * Every write on this API is a read-modify-write of the whole document under
   * `select … for update`. The client cannot assume it wins: a rejected write
   * means the person's typing was NOT saved. So a failure is recorded in
   * writeError (which the calling form surfaces) and RE-THROWN, so no caller
   * mistakes a rejection for a success and closes its modal.
   */
  const mutate = useCallback(async (fn) => {
    setWriteError(null);
    try {
      const result = await fn();
      setReloadTick((n) => n + 1);
      return result;
    } catch (err) {
      setWriteError(err);
      throw err;
    }
  }, []);

  /* ------------------------------- mutations ------------------------------ */

  const createScenario = useCallback(
    (payload) => mutate(() => sopApi.createScenario(payload)),
    [mutate]
  );

  const saveScenario = useCallback(
    (no, patch) => mutate(() => sopApi.editScenario(no, patch)),
    [mutate]
  );

  const swapScenario = useCallback(
    (no, swapWith) => mutate(() => sopApi.swapScenario(no, swapWith)),
    [mutate]
  );

  const deleteScenario = useCallback(
    (no) => mutate(() => sopApi.deleteScenario(no)),
    [mutate]
  );

  const createReport = useCallback(
    (payload) => mutate(() => sopApi.createReport(payload)),
    [mutate]
  );

  const deleteReport = useCallback(
    (caseNo) => mutate(() => sopApi.deleteReport(caseNo)),
    [mutate]
  );

  const patchMeta = useCallback(
    (patch) => mutate(() => sopApi.patchMeta(patch)),
    [mutate]
  );

  const restoreVersion = useCallback(
    (id) => mutate(() => sopApi.restoreVersion(id)),
    [mutate]
  );

  /* --------------------------------- derived ------------------------------ */

  // Two independent signals, deliberately kept apart:
  //   canEdit    the API's own answer (meta.isAdmin), derived from the JWT it
  //              saw. This is what the Edit buttons key off.
  //   hasEditor  what this client believes from its own token. Used only to
  //              explain WHY editing is unavailable — "you are not an editor"
  //              versus "you are not signed in".
  // Defaults OPEN when meta has not arrived: doc.meta is {} before the first
  // successful load and whenever the API is unreachable, and Boolean({}.isAdmin)
  // is false - which hid every Edit control behind a backend outage.
  const canEdit = doc.meta?.isAdmin !== false;
  const hasEditorRole = hasRole('sop', 'editor');

  const value = useMemo(
    () => ({
      meta: doc.meta,
      scenarios: doc.scenarios,
      reports: doc.reports,
      status,
      error,
      writeError,
      clearWriteError: () => setWriteError(null),
      canEdit,
      hasEditorRole,
      userEmail: doc.meta?.userEmail || user?.email || '',
      query,
      setQuery,
      refresh,
      createScenario,
      saveScenario,
      swapScenario,
      deleteScenario,
      createReport,
      deleteReport,
      patchMeta,
      restoreVersion,
    }),
    [
      doc,
      status,
      error,
      writeError,
      canEdit,
      hasEditorRole,
      user?.email,
      query,
      refresh,
      createScenario,
      saveScenario,
      swapScenario,
      deleteScenario,
      createReport,
      deleteReport,
      patchMeta,
      restoreVersion,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/* --------------------------- default-view preference ---------------------- */
//
// Which branch the app opens on. Module-specific (the other SPAs have no such
// notion), so it keeps its own key rather than joining the shared ones.

const DEFAULT_VIEW_KEY = 'sop-default-view';

export function getDefaultView() {
  try {
    return localStorage.getItem(DEFAULT_VIEW_KEY) || 'flows';
  } catch {
    // Blocked storage — same reasoning as shared/src/api.js: degrade to the
    // default, never throw during render.
    return 'flows';
  }
}

export function setDefaultView(v) {
  try {
    localStorage.setItem(DEFAULT_VIEW_KEY, v);
  } catch {
    /* preference will not survive a reload; the app still works */
  }
}

/** The route the saved preference corresponds to. 'flows' is the headline
 * branch and stays the fallback, as in the canonical app. */
export function defaultViewPath() {
  const v = getDefaultView();
  if (v === 'reports') return '/reports';
  if (v === 'flows') return '/flows';
  if (v === 'ALL') return '/cases';
  return `/cases/module/${v}`;
}
