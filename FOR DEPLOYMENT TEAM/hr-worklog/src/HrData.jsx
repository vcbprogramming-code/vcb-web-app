// The two things every screen needs, fetched once instead of per route.
//
//   bootstrap  who the caller is, which sites they may see, the edit window
//   index      the picker's vocabularies (activities + cost codes)
//
// Both are small, both are read by three or more screens, and neither changes
// during a session — so refetching them on every navigation would be pure waste
// and would make the grid flash on each route change.
//
// Note what is NOT cached here: the month grid and the leave lists. Those are
// live records other people are editing at the same time, and serving them from
// a stale cache is how two managers overwrite each other.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@vcb/shared';
import { getBootstrap, getIndex } from './lib/hrApi';

const HrDataContext = createContext(null);

export function HrDataProvider({ children }) {
  const { signedIn, loading: authLoading } = useAuth();

  const [boot, setBoot] = useState(null);
  const [index, setIndex] = useState({ activities: [], costs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    // Wait for the session to settle. Firing while AuthProvider is still
    // verifying the stored token sends the request unsigned and earns a 401
    // that signs the person out of a session that was perfectly valid.
    if (authLoading) return undefined;
    if (!signedIn) {
      setBoot(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      getBootstrap({ signal: controller.signal }),
      getIndex({ signal: controller.signal }),
    ])
      .then(([b, ix]) => {
        setBoot(b);
        setIndex({
          activities: Array.isArray(ix?.activities) ? ix.activities : [],
          costs: Array.isArray(ix?.costs) ? ix.costs : [],
        });
        setError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // A 401 is already handled by AuthProvider's listener, which drops the
        // session and shows sign-in. Anything else is a real failure and the
        // app says so rather than rendering as if the person had no sites.
        if (err?.status !== 401) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authLoading, signedIn, reloadKey]);

  const value = useMemo(() => {
    const sites = boot?.sites ?? [];
    const activities = index.activities;
    const costs = index.costs;

    return {
      loading,
      error,
      reload,

      boot,
      email: boot?.email ?? '',
      role: boot?.role ?? '',
      isAdmin: Boolean(boot?.isAdmin),
      canEntry: Boolean(boot?.canEntry),
      lockDays: Number(boot?.lockDays ?? 3),

      sites,
      /** Closed projects accept no NEW work but keep their dashboard history. */
      openSites: sites.filter((s) => s.active !== false),
      siteByKey: (key) => sites.find((s) => s.key === key) || null,
      siteName: (key) => sites.find((s) => s.key === key)?.name || key || '',

      activities,
      costs,
      activityByCode: (code) => activities.find((a) => a.code === code) || null,
      costByCode: (code) => costs.find((c) => c.code === code) || null,
    };
  }, [boot, index, loading, error, reload]);

  return <HrDataContext.Provider value={value}>{children}</HrDataContext.Provider>;
}

export function useHrData() {
  const ctx = useContext(HrDataContext);
  if (!ctx) throw new Error('useHrData must be used inside <HrDataProvider>');
  return ctx;
}

/* -------------------------------- site colour ----------------------------- */

// Each project gets a stable accent so a card is recognisable at a glance in a
// grid of them. The five original keys keep the exact hues the live app used;
// anything else is hashed into the same palette, so a project added today gets
// a colour without anyone picking one.
const SITE_COLORS = {
  bangtoei: '#0D9488',
  bangwua: '#E76F51',
  phutthamonthon: '#2563EB',
  sai5: '#D97706',
  suphanburi: '#7C3AED',
};
const PALETTE = ['#0D9488', '#E76F51', '#2563EB', '#D97706', '#7C3AED', '#0369A1', '#BE185D'];

export function siteColor(key) {
  if (!key) return '#1D4E89';
  if (SITE_COLORS[key]) return SITE_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
