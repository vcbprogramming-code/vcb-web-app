// Which dashboard cards show, per browser — not a server preference.
//
// Ported from getDashPrefs()/saveDashPrefs() in legacy.js: the original never
// routed this through google.script.run, only localStorage, and applied a
// toggle immediately (no "Save" button gates it, unlike the cost-category
// list). Kept as its own context rather than folded into FilterContext.jsx,
// which is a different concern (what the table below is scoped to, not which
// summary cards are visible).
//
// A CONTEXT, NOT A BARE HOOK
//
// This used to be a standalone useDashPrefs() called separately by both
// SettingsDialog and Dashboard. Each call created its OWN useState, so
// ticking a box in Settings updated only that instance's copy — it wrote to
// localStorage, but Dashboard's own state never learned about it, and the
// cards stayed exactly as they were until a full reload. React state is not
// shared just because two components read the same localStorage key; only
// one source of truth, held above both of them, actually is.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const DashPrefsContext = createContext(null);

const KEY = 'vcb_credit_dashprefs';

// Same defaults as legacy: M/L off (rarely used), "within 1 week" and "new
// request" off (the loudest, most alarming buckets — opt-in), everything
// else on.
const DEFAULT = {
  lines: { tl: true, bg: true, ml: false, be: true, pn: true },
  due: { week: false, this: true, next: true },
  status: { new: false, proposed: true, approved: true },
};

function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      lines: { ...DEFAULT.lines, ...parsed.lines },
      due: { ...DEFAULT.due, ...parsed.due },
      status: { ...DEFAULT.status, ...parsed.status },
    };
  } catch {
    return null;
  }
}

export function DashPrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => readStored() || DEFAULT);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* preference will not survive a reload; the dashboard still works */
    }
  }, [prefs]);

  const setGroup = useCallback((group, key, value) => {
    setPrefs((p) => ({ ...p, [group]: { ...p[group], [key]: value } }));
  }, []);

  return (
    <DashPrefsContext.Provider value={{ prefs, setGroup }}>{children}</DashPrefsContext.Provider>
  );
}

export function useDashPrefs() {
  const ctx = useContext(DashPrefsContext);
  if (!ctx) throw new Error('useDashPrefs must be used inside <DashPrefsProvider>');
  return ctx;
}
