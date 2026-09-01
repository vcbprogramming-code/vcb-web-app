// Display preferences that belong to THIS module only.
//
// Language and theme are gone from here — they live in @vcb/shared now
// (I18nProvider / ThemeProvider) under one key each, so a person's choice
// follows them across every VCB Connect app instead of being set again in
// every module. What is left is the handful of prefs that mean nothing outside
// the work log:
//
//   yearFmt    show the month picker's year as 2569 (พ.ศ.) or 2026 (ค.ศ.)
//   cellNames  render a filled cell as its code (A-1 / 5) or the activity name
//   dashView   which dashboard view opens by default
//   hidden     sites this DEVICE hides from the dashboard
//
// `hidden` is deliberately per-device and not per-account: it is a decluttering
// preference, not access control. Closing a project for everyone is a different
// thing entirely and lives on the server (PATCH /api/hr/sites/:key).

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useI18n } from '@vcb/shared';

const KEYS = {
  yearFmt: 'hr_yearfmt',
  cellNames: 'hr_cellnames',
  dashView: 'hr_dashview',
  hidden: 'hr_hidden',
};

export const YEAR_FORMATS = ['be', 'ce'];
export const CELL_NAMES = ['code', 'name'];
export const DASH_VIEWS = ['progress', 'topact', 'topcost'];

/**
 * localStorage throws rather than merely returning null in a private window and
 * wherever site data is blocked. An uncaught throw here happens during the
 * first render and blanks the app, so every access is guarded — losing a
 * display preference is a fair trade for the page rendering at all.
 */
function read(key, fallback, allowed) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return !allowed || allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference will not survive a reload; the app still works */
  }
}

function readHidden() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS.hidden) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [yearFmt, setYearFmtState] = useState(() => read(KEYS.yearFmt, 'be', YEAR_FORMATS));
  const [cellNames, setCellNamesState] = useState(() => read(KEYS.cellNames, 'code', CELL_NAMES));
  const [dashView, setDashViewState] = useState(() => read(KEYS.dashView, 'progress', DASH_VIEWS));
  const [hidden, setHidden] = useState(readHidden);

  const setYearFmt = useCallback((v) => {
    write(KEYS.yearFmt, v);
    setYearFmtState(v);
  }, []);
  const setCellNames = useCallback((v) => {
    write(KEYS.cellNames, v);
    setCellNamesState(v);
  }, []);
  const setDashView = useCallback((v) => {
    write(KEYS.dashView, v);
    setDashViewState(v);
  }, []);

  const toggleHidden = useCallback((key, hide) => {
    setHidden((prev) => {
      const next = hide ? [...new Set([...prev, key])] : prev.filter((k) => k !== key);
      write(KEYS.hidden, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      yearFmt,
      setYearFmt,
      cellNames,
      setCellNames,
      dashView,
      setDashView,
      hidden,
      toggleHidden,
      isHidden: (key) => hidden.includes(key),
    }),
    [yearFmt, setYearFmt, cellNames, setCellNames, dashView, setDashView, hidden, toggleHidden]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return ctx;
}

/**
 * The year as this module shows it.
 *
 * shared/src/i18n.jsx has displayYear(), but it keys off LANGUAGE — Thai gets
 * พ.ศ., English gets ค.ศ.. The work log has always let the two be set
 * independently, because HR staff read Thai menus while reconciling against
 * Gregorian-dated ERP exports. So the pref wins here.
 */
export function useYear() {
  const { yearFmt } = usePrefs();
  return useCallback((year) => (yearFmt === 'be' ? year + 543 : year), [yearFmt]);
}

/** The month name in the current language — a thin pass-through to shared i18n. */
export function useMonthName() {
  const { monthName } = useI18n();
  // Callers pass a 1-based month, the way every date in this app is written;
  // shared/src/i18n.jsx indexes from 0.
  return useCallback((m) => monthName(m - 1), [monthName]);
}
