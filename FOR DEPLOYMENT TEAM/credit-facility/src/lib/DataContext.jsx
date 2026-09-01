// The module's single store: Context + useState, per TECH_STACK.md (no Redux).
//
// The Apps Script app kept one global `D` holding the whole workbook and called
// render() after every mutation. That shape is preserved deliberately — GET
// /api/credit/data still returns the whole module in one response, and the
// views read from it — but mutations now go to the API and the reload is a
// refetch rather than an in-place edit of a global.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@vcb/shared';
import * as apiCredit from './api.js';
import { COST_CATEGORY_DEFAULTS } from './domain.js';

const DataContext = createContext(null);

const EMPTY = {
  me: { email: '', isManager: false },
  facilities: [],
  costCategories: [],
  categoryCaps: [],
  transactions: [],
  requests: [],
  projects: [],
  facTypes: [],
};

export function DataProvider({ children }) {
  const { signedIn } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  const [savingCount, setSavingCount] = useState(0);

  /**
   * Load everything.
   *
   * /data, /projects and /facility-types are fetched together rather than in
   * sequence: they are independent and the screen cannot render usefully until
   * all three land. The reference calls resolve to null when the API has not
   * implemented them yet (see lib/api.js) and the UI then falls back to codes.
   */
  const reload = useCallback(async () => {
    setError(null);
    try {
      const [main, projects, facTypes] = await Promise.all([
        apiCredit.getData(),
        apiCredit.getProjects(),
        apiCredit.getFacilityTypes(),
      ]);
      setData({
        ...EMPTY,
        ...main,
        costCategories:
          main?.costCategories?.length ? main.costCategories : COST_CATEGORY_DEFAULTS,
        projects: normalizeProjects(projects, main),
        facTypes: normalizeFacTypes(facTypes),
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reload();
  }, [signedIn, reload]);

  /** Fire a toast; it clears itself, matching the 2.6s of legacy.js toast(). */
  const notify = useCallback((message) => {
    setToast(String(message ?? ''));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  /**
   * Run a write, show the saving indicator, then refetch.
   *
   * Refetching rather than patching local state is deliberate: `used`,
   * `available` and `usedOverridden` are computed by the facility_used view,
   * and approving a request creates a transaction server-side. Guessing those
   * client-side would drift from what the database actually holds.
   */
  const mutate = useCallback(
    async (fn, successMessage) => {
      setSavingCount((n) => n + 1);
      try {
        const result = await fn();
        await reload();
        if (successMessage) notify(successMessage);
        return result;
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }
    },
    [reload, notify]
  );

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      reload,
      mutate,
      toast,
      notify,
      saving: savingCount > 0,
      isManager: Boolean(data.me?.isManager),
    }),
    [data, loading, error, reload, mutate, toast, notify, savingCount]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

/* -------------------------------- fallbacks ------------------------------- */

/**
 * Reference rows come from credit.projects; when the route is missing, derive a
 * minimal list from the project codes present in the data so the filters still
 * work. Names and companies are simply unavailable in that case — the code is
 * shown instead, which is honest, rather than shipping a stale hardcoded copy
 * of a table that now lives in Postgres.
 */
function normalizeProjects(rows, main) {
  if (Array.isArray(rows) && rows.length) {
    return rows.map((p) => ({
      code: p.code,
      th: p.nameTh ?? p.name_th ?? p.th ?? p.code,
      company: p.company ?? '',
      sortOrder: p.sortOrder ?? p.sort_order ?? 0,
    }));
  }
  const codes = new Set();
  for (const list of [main?.facilities, main?.transactions, main?.requests]) {
    for (const row of list || []) if (row?.project) codes.add(row.project);
  }
  return [...codes].sort().map((code) => ({ code, th: code, company: '', sortOrder: 0 }));
}

function normalizeFacTypes(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((t) => ({
    no: Number(t.no),
    code: t.code,
    th: t.nameTh ?? t.name_th ?? t.th ?? t.code,
    en: t.nameEn ?? t.name_en ?? t.en ?? t.code,
    kind: t.kind ?? '',
    docKind: t.docKind ?? t.doc_kind ?? '',
  }));
}
