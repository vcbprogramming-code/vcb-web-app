// Which dashboard cards show, per browser — not a server preference.
//
// Ported from getDashPrefs()/saveDashPrefs() in legacy.js: the original never
// routed this through google.script.run, only localStorage, and applied a
// toggle immediately (no "Save" button gates it, unlike the cost-category
// list). Kept as its own hook rather than folded into FilterContext.jsx,
// which is a different concern (what the table below is scoped to, not which
// summary cards are visible).

import { useCallback, useEffect, useState } from 'react';

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

export function useDashPrefs() {
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

  return { prefs, setGroup };
}
