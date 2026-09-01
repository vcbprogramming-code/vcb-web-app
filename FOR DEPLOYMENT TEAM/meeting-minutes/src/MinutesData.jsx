// The module's data layer: projects, the meeting list, and the cache of full
// meeting records.
//
// App.tsx held all of this in one 358-line component alongside routing, mobile
// pane state, six modal flags and the search debounce. Lifting the data out
// means the components that read it can be pure — and, more usefully, that the
// refresh-after-mutation path exists once instead of in every modal's onSaved.
//
// Context + useState only; TECH_STACK.md rules out Redux, and there is nothing
// here a reducer would make clearer.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@vcb/shared';
import * as minutesApi from './lib/minutesApi';
import { latestInProject } from './lib/minutes';

const MinutesDataContext = createContext(null);

/**
 * The meeting list, cached in localStorage so a reload paints instantly rather
 * than showing an empty column while the first fetch runs.
 *
 * Metadata only — never body HTML. The full record cache below is in memory on
 * purpose: minutes of a locked project must not sit in localStorage where they
 * outlive the session and are readable by anyone who later uses the machine.
 */
const LIST_CACHE_KEY = 'vcb_mm_meetings_cache';

function readListCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIST_CACHE_KEY) || 'null');
    return Array.isArray(raw) ? raw : [];
  } catch {
    // Blocked storage, or a cache written by an older shape. Neither is worth
    // failing over — the fetch below replaces it either way.
    return [];
  }
}

function writeListCache(meetings) {
  try {
    localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(meetings || []));
  } catch {
    /* storage blocked or full — the app just loses its instant first paint */
  }
}

function clearListCache() {
  try {
    localStorage.removeItem(LIST_CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}

export function MinutesDataProvider({ children }) {
  const { user, signedIn } = useAuth();

  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState(() => readListCache());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Full meeting records, keyed by id. A ref rather than state: the detail pane
  // and the project summary both read it, and re-rendering every consumer each
  // time one record warms would repaint the whole app during the prefetch.
  // Components that need to know a record landed take `cacheVersion` instead.
  const cacheRef = useRef(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const getCached = useCallback((id) => cacheRef.current.get(id), []);

  const setCached = useCallback((id, full) => {
    cacheRef.current.set(id, full);
    setCacheVersion((v) => v + 1);
  }, []);

  /**
   * The full record, from cache or the server.
   *
   * Not memoised across a signed-in/out change on purpose — see the effect
   * below that empties the cache when identity changes.
   */
  const fetchMeeting = useCallback(
    async (id, opts) => {
      const hit = cacheRef.current.get(id);
      if (hit) return hit;
      const full = await minutesApi.getMeeting(id, opts);
      if (full) {
        cacheRef.current.set(id, full);
        setCacheVersion((v) => v + 1);
      }
      return full;
    },
    []
  );

  /** Bypass the cache. Used before opening the editor — see below. */
  const refetchMeeting = useCallback(async (id, opts) => {
    const full = await minutesApi.getMeeting(id, opts);
    if (full) {
      cacheRef.current.set(id, full);
      setCacheVersion((v) => v + 1);
    }
    return full;
  }, []);

  const invalidate = useCallback((id) => {
    if (id) cacheRef.current.delete(id);
    else cacheRef.current.clear();
    setCacheVersion((v) => v + 1);
  }, []);

  /** Projects and meetings together — every mutation ends here. */
  const refresh = useCallback(async ({ signal } = {}) => {
    const [p, m] = await Promise.all([
      minutesApi.listProjects({ signal }),
      minutesApi.listMeetings({ signal }),
    ]);
    setProjects(p || []);
    setMeetings(m || []);
    writeListCache(m || []);
    setLoaded(true);
    setError(null);
    return { projects: p || [], meetings: m || [] };
  }, []);

  /**
   * Warm the latest meeting of each project so a project tab opens without a
   * second round-trip.
   *
   * Deliberately fire-and-forget and deliberately silent: a prefetch that fails
   * costs nothing (the real open will fetch again and report properly), and
   * surfacing an error for a request the user never asked for would be noise.
   */
  const prefetchLatest = useCallback((projectList, meetingList) => {
    for (const p of projectList || []) {
      const first = latestInProject(meetingList || [], p.id);
      if (!first || cacheRef.current.has(first.id)) continue;
      minutesApi
        .getMeeting(first.id)
        .then((full) => {
          if (full) {
            cacheRef.current.set(full.id, full);
            setCacheVersion((v) => v + 1);
          }
        })
        .catch(() => {
          /* silent by design — see above */
        });
    }
  }, []);

  // Boot, and re-boot whenever identity changes.
  //
  // Identity changes what the API returns: a locked project is ABSENT from an
  // anonymous response, and a hidden meeting is absent from a non-editor's. So
  // signing in or out must refetch, and must first drop every cached record —
  // otherwise a meeting read while signed in would still be sitting in memory,
  // and in the localStorage list, after signing out.
  const identity = signedIn ? user?.email || '' : '';
  useEffect(() => {
    cacheRef.current.clear();
    setCacheVersion((v) => v + 1);

    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const { projects: p, meetings: m } = await refresh({ signal: ac.signal });
        if (cancelled) return;
        prefetchLatest(p, m);
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        // Reads are anonymous-friendly, so a failure here is a real outage, not
        // a missing session. Keep whatever the list cache painted and say so.
        setError(err);
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [identity, refresh, prefetchLatest]);

  // Signing out must not leave the previous person's meeting titles in
  // localStorage on a shared machine.
  useEffect(() => {
    if (!signedIn) clearListCache();
  }, [signedIn]);

  const projectsById = useMemo(() => {
    const map = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const value = useMemo(
    () => ({
      projects,
      projectsById,
      meetings,
      loaded,
      error,
      refresh,
      getCached,
      setCached,
      fetchMeeting,
      refetchMeeting,
      invalidate,
      cacheVersion,
    }),
    [
      projects,
      projectsById,
      meetings,
      loaded,
      error,
      refresh,
      getCached,
      setCached,
      fetchMeeting,
      refetchMeeting,
      invalidate,
      cacheVersion,
    ]
  );

  return <MinutesDataContext.Provider value={value}>{children}</MinutesDataContext.Provider>;
}

export function useMinutesData() {
  const ctx = useContext(MinutesDataContext);
  if (!ctx) throw new Error('useMinutesData must be used inside <MinutesDataProvider>');
  return ctx;
}
