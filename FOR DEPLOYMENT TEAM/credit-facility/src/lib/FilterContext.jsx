// The filter bar's state, shared by every view and by the dashboard cards that
// drill into it.
//
// Kept in context rather than in each view because the dashboard's cards SET
// these filters — clicking "due this month" jumps to the ledger with the period
// filter applied. Persisted to localStorage as legacy.js did, so a reload keeps
// the finance team where they were.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const FilterContext = createContext(null);

const KEY = 'vcb_credit_filters';

const BLANK = { co: '', type: '', proj: '', due: '', status: '', q: '' };

function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...BLANK, ...parsed } : null;
  } catch {
    // Blocked storage or corrupt JSON. Same reasoning as shared/src/api.js:
    // degrade to "no saved filters", never throw during first render.
    return null;
  }
}

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(() => readStored() || BLANK);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(filters));
    } catch {
      /* preference will not survive a reload; the app still works */
    }
  }, [filters]);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  /** Apply several at once — what a dashboard drill-down does. */
  const applyFilters = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  /**
   * Clear the drill-down filters but keep company and project scope, matching
   * resetDrillFilters() in legacy.js: jumping from one card to another should
   * not silently keep the previous card's status or period.
   */
  const resetDrill = useCallback(() => {
    setFilters((f) => ({ ...f, type: '', due: '', status: '', q: '' }));
  }, []);

  const clearAll = useCallback(() => setFilters(BLANK), []);

  const value = useMemo(
    () => ({ filters, setFilter, applyFilters, resetDrill, clearAll }),
    [filters, setFilter, applyFilters, resetDrill, clearAll]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
