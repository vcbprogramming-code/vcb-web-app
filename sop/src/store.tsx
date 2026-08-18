/**
 * Central app store — mirrors the imperative `state` object and handler
 * functions in index.html (selectModule, selectFlows, setTheme, …),
 * re-expressed as a single React hook. One <App/> calls useStore() and threads
 * the returned object down to the panes/modals.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SopData, Scenario, ScenarioEdit, ScenarioCreate, ScenarioSwap, ReportCreate } from './data/types';
import { MODULES, MODULES_EN, tr, type Lang } from './data/config';
import { SOP_FLOWS } from './data/flows';
import {
  bootstrap,
  getSopDataForClient,
  editScenario,
  createScenario,
  swapScenarioPositions,
  deleteScenario,
  createReport,
} from './lib/api';

export type View = 'sop' | 'flows' | 'reports';
export type MobileView = 'list' | 'detail' | null;

/* ----- mobile detection (same heuristic as index.html <head>) ----- */
function detectMobile(): boolean {
  const ua = navigator.userAgent || '';
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  const sw = (window.screen && window.screen.width) || 0;
  const minDim = sw && w ? Math.min(w, sw) : sw || w;
  const isPhone = /iPhone|iPod|Android.+Mobile|Mobile.+Firefox|IEMobile|Opera Mini/i.test(ua);
  return isPhone || minDim <= 768;
}

/* ----- default-view preference (localStorage 'sop-default-view') ----- */
function getDefaultView(): string {
  try {
    const v = localStorage.getItem('sop-default-view');
    if (v === 'reports' || v === 'flows' || v === 'ALL') return v;
    if (v && (MODULES as Record<string, string>)[v]) return v;
  } catch {
    /* ignore */
  }
  return 'flows'; // Process Flows is the headline branch — land here by default
}

interface NavState {
  view: View;
  mod: string;
  flowMod: string;
  sel: number | null;
  selFlow: string | null;
  q: string;
  navCollapsed: boolean;
}

/**
 * Deep-link target resolved from `?case=N` / `?flow=ID` in the current URL —
 * mirrors SOP_META.initialCase/initialFlow, which the canonical server
 * validates (case) or passes through (flow) in doGet. This mock has no real
 * backend distinction to preserve, so both are resolved/validated client-side
 * here: `?case=N` must match a real scenario, `?flow=ID` falls back gracefully
 * (via the caller returning null) if it doesn't match anything, same intent
 * as the canonical client's openInitialCase().
 */
type InitialTarget = { kind: 'case'; module: string; no: number } | { kind: 'flow'; module: string; id: string };

function resolveInitialTarget(scenarios: Scenario[]): InitialTarget | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
  const caseParam = params.get('case');
  if (caseParam != null) {
    const no = parseInt(caseParam, 10);
    const s = !isNaN(no) ? scenarios.find((x) => x.no === no) : undefined;
    if (s) return { kind: 'case', module: s.module, no: s.no };
  }
  const flowParam = params.get('flow');
  if (flowParam != null) {
    const f = SOP_FLOWS.find((x) => x.id === flowParam);
    if (f) return { kind: 'flow', module: f.module, id: f.id };
  }
  return null;
}

/** Build the initial nav state by applying the saved default view — unless a
 * `?case=N`/`?flow=ID` deep link resolves, in which case it takes priority
 * (someone opening a shared link wants that exact case/flow, not their own
 * last-used tab), mirroring `if (!openedFromShareLink) applyDefaultView()`. */
function initialNav(mobile: boolean, initial: InitialTarget | null): NavState {
  const base: NavState = {
    view: 'sop',
    mod: 'ALL',
    flowMod: 'ALL',
    sel: null,
    selFlow: null,
    q: '',
    navCollapsed: false,
  };
  if (initial) {
    if (initial.kind === 'case') {
      base.view = 'sop';
      base.mod = initial.module;
      base.sel = initial.no;
    } else {
      base.view = 'flows';
      base.flowMod = initial.module;
      base.selFlow = initial.id;
    }
    // Phones normally open to the HOME menu collapsed — except a share link
    // opened a specific item, which should jump straight to its detail pane
    // instead of stranding the user on the branch menu.
    return base;
  }
  const dv = getDefaultView();
  if (dv === 'reports') base.view = 'reports';
  else if (dv === 'flows') {
    base.view = 'flows';
    base.flowMod = 'ALL';
  } else {
    base.view = 'sop';
    base.mod = dv; // 'ALL' or a module code
  }
  // Phones open to the HOME menu with the active branch collapsed.
  if (mobile) base.navCollapsed = true;
  return base;
}

export interface Store {
  // data
  meta: SopData['meta'];
  scenarios: Scenario[];
  reports: SopData['reports'];
  isAdmin: boolean;
  userEmail: string;
  // nav
  nav: NavState;
  // ui
  lang: Lang;
  dark: boolean;
  isMobile: boolean;
  mobileView: MobileView;
  settingsOpen: boolean;
  editNo: number | null;
  newScenarioOpen: boolean;
  newReportOpen: boolean;
  // helpers
  t: (key: string) => any;
  labels: Record<string, string>;
  getDefaultView: () => string;
  /** Builds a shareable deep link (current origin+path + `?case=N`/`?flow=ID`).
   * Mirrors shareLink()'s URL construction in the canonical app, using
   * window.location instead of a server-injected SOP_META.appUrl since this
   * mock has no backend to inject one from. */
  buildShareUrl: (queryParam: 'case' | 'flow', value: string | number) => string;
  // actions
  selectModule: (m: string) => void;
  selectReports: () => void;
  selectItem: (no: number) => void;
  selectFlowModule: (m: string) => void;
  selectFlows: () => void;
  selectCaseStudies: () => void;
  selectFlow: (id: string) => void;
  onSearch: (value: string) => void;
  setMobileView: (v: MobileView) => void;
  mobileBack: () => void;
  openEditModal: (no: number) => void;
  closeEdit: () => void;
  saveScenario: (payload: ScenarioEdit) => Promise<void>;
  swapScenario: (payload: ScenarioSwap) => Promise<void>;
  deleteScenario: (no: number) => Promise<void>;
  openNewScenarioModal: () => void;
  closeNewScenario: () => void;
  createNewScenario: (payload: ScenarioCreate) => Promise<number>;
  openNewReportModal: () => void;
  closeNewReport: () => void;
  createNewReport: (payload: ReportCreate) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLang: (lang: Lang) => void;
  setDefaultView: (v: string) => void;
  signOut: () => void;
}

export function useStore(): Store {
  // bootstrap() + the deep-link resolution are read together once at mount so
  // both the data and the initial nav/mobile-view states agree on the same
  // snapshot (mirrors doGet baking SOP_META.initialCase/initialFlow into the
  // same payload the client boots with).
  const [boot] = useState(() => {
    const bootData = bootstrap();
    const initialTarget = resolveInitialTarget(bootData.scenarios);
    return { data: bootData, initialTarget };
  });
  const [data, setData] = useState<SopData>(() => boot.data);
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile());
  const [nav, setNav] = useState<NavState>(() => initialNav(detectMobile(), boot.initialTarget));
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const sl = localStorage.getItem('sop-lang');
      if (sl === 'th' || sl === 'en') return sl;
    } catch {
      /* ignore */
    }
    return 'th';
  });
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
  const [mobileView, setMobileViewState] = useState<MobileView>(() =>
    boot.initialTarget && detectMobile() ? 'detail' : null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editNo, setEditNo] = useState<number | null>(null);
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [newReportOpen, setNewReportOpen] = useState(false);

  const t = useCallback((key: string) => tr(lang, key), [lang]);
  const labels = (lang === 'en' ? MODULES_EN : MODULES) as Record<string, string>;

  const buildShareUrl = useCallback((queryParam: 'case' | 'flow', value: string | number) => {
    const base = window.location.origin + window.location.pathname;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + queryParam + '=' + encodeURIComponent(value);
  }, []);

  /* ----- side effects: reflect state onto <html>/<body> classes ----- */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-mobile', isMobile);
  }, [isMobile]);

  useEffect(() => {
    document.body.classList.toggle('reports-mode', nav.view === 'reports');
  }, [nav.view]);

  useEffect(() => {
    document.body.classList.toggle('m-list', mobileView === 'list');
    document.body.classList.toggle('m-detail', mobileView === 'detail');
  }, [mobileView]);

  /* keep isMobile in sync with viewport (mirrors the <head> resize listener) */
  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  /* Esc closes the settings modal (mirrors document keydown handler). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ----- actions ----- */
  const setMobileView = useCallback((v: MobileView) => setMobileViewState(v), []);

  const selectModule = useCallback((m: string) => {
    setNav((n) => ({ ...n, view: 'sop', mod: m, sel: null, navCollapsed: false }));
    setMobileViewState('list');
  }, []);

  const selectReports = useCallback(() => {
    setNav((n) => ({ ...n, view: 'reports', sel: null, navCollapsed: false }));
    setMobileViewState('detail');
  }, []);

  const selectItem = useCallback((no: number) => {
    setNav((n) => ({ ...n, sel: no }));
    setMobileViewState('detail');
  }, []);

  const selectFlowModule = useCallback((m: string) => {
    setNav((n) => ({ ...n, view: 'flows', flowMod: m, selFlow: null, navCollapsed: false }));
    setMobileViewState('list');
  }, []);

  const selectFlows = useCallback(() => {
    // Root header doubles as "All": clicking it while already showing All (open)
    // collapses the submenu; otherwise it opens the branch to All.
    const closing = nav.view === 'flows' && nav.flowMod === 'ALL' && !nav.navCollapsed;
    if (closing) {
      setNav((n) => ({ ...n, navCollapsed: true }));
      return;
    }
    setNav((n) => ({ ...n, view: 'flows', flowMod: 'ALL', selFlow: null, navCollapsed: false }));
    setMobileViewState('list');
  }, [nav]);

  const selectCaseStudies = useCallback(() => {
    const closing = nav.view === 'sop' && nav.mod === 'ALL' && !nav.navCollapsed;
    if (closing) {
      setNav((n) => ({ ...n, navCollapsed: true }));
      return;
    }
    setNav((n) => ({ ...n, view: 'sop', mod: 'ALL', sel: null, navCollapsed: false }));
    setMobileViewState('list');
  }, [nav]);

  const selectFlow = useCallback((id: string) => {
    // setMobileView first: detail pane is display:none until shown; edge routing
    // measures node rects (zero-sized while hidden).
    setMobileViewState('detail');
    setNav((n) => ({ ...n, selFlow: id }));
  }, []);

  const onSearch = useCallback(
    (value: string) => {
      setNav((n) => ({ ...n, q: value.trim() }));
      if (value.trim() && isMobile) {
        setMobileViewState(nav.view === 'reports' ? 'detail' : 'list');
      }
    },
    [isMobile, nav.view],
  );

  const mobileBack = useCallback(() => {
    setMobileViewState((mv) => {
      if (mv === 'detail') return nav.view === 'reports' ? null : 'list';
      if (mv === 'list') return null;
      return mv;
    });
    document.querySelectorAll('.sidebar,.list,.detail').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [nav.view]);

  const refreshClientData = useCallback(async () => {
    const newData = await getSopDataForClient();
    setData(newData);
  }, []);

  const openEditModal = useCallback(
    (no: number) => {
      if (!data.meta.isAdmin) return;
      setEditNo(no);
    },
    [data.meta.isAdmin],
  );
  const closeEdit = useCallback(() => setEditNo(null), []);

  const saveScenario = useCallback(
    async (payload: ScenarioEdit) => {
      await editScenario(payload);
      setEditNo(null);
      await refreshClientData();
    },
    [refreshClientData],
  );

  const swapScenario = useCallback(
    async (payload: ScenarioSwap) => {
      await swapScenarioPositions(payload);
      setEditNo(null);
      await refreshClientData();
    },
    [refreshClientData],
  );

  const deleteScenarioAction = useCallback(
    async (no: number) => {
      await deleteScenario({ no });
      setEditNo(null);
      setNav((n) => (n.sel === no ? { ...n, sel: null } : n));
      await refreshClientData();
    },
    [refreshClientData],
  );

  const openNewScenarioModal = useCallback(() => {
    if (!data.meta.isAdmin) return;
    setNewScenarioOpen(true);
  }, [data.meta.isAdmin]);
  const closeNewScenario = useCallback(() => setNewScenarioOpen(false), []);

  const createNewScenario = useCallback(
    async (payload: ScenarioCreate) => {
      const result = await createScenario(payload);
      setNewScenarioOpen(false);
      await refreshClientData();
      return result.no;
    },
    [refreshClientData],
  );

  const openNewReportModal = useCallback(() => {
    if (!data.meta.isAdmin) return;
    setNewReportOpen(true);
  }, [data.meta.isAdmin]);
  const closeNewReport = useCallback(() => setNewReportOpen(false), []);

  const createNewReport = useCallback(
    async (payload: ReportCreate) => {
      await createReport(payload);
      setNewReportOpen(false);
      await refreshClientData();
    },
    [refreshClientData],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    const isDark = theme === 'dark';
    setDark(isDark);
    try {
      localStorage.setItem('sop-night', isDark ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      if (lang === next) return;
      setLangState(next);
      try {
        localStorage.setItem('sop-lang', next);
      } catch {
        /* ignore */
      }
    },
    [lang],
  );

  const setDefaultView = useCallback(
    (v: string) => {
      try {
        localStorage.setItem('sop-default-view', v);
      } catch {
        /* ignore */
      }
      // Apply right away (mirrors setDefaultView in index.html).
      if (v === 'reports') selectReports();
      else if (v === 'flows') selectFlows();
      else selectModule(v);
      if (isMobile) {
        if (v === 'reports') setMobileViewState('detail');
        else if (v !== 'ALL') setMobileViewState('list');
        else setMobileViewState(null);
      }
    },
    [isMobile, selectReports, selectFlows, selectModule],
  );

  const signOut = useCallback(() => {
    const msg =
      lang === 'en'
        ? 'Sign out of Google? You can sign back in any time.'
        : 'ออกจากระบบ Google? คุณสามารถเข้าสู่ระบบใหม่ได้ภายหลัง';
    if (!confirm(msg)) return;
    const w = window.open('https://accounts.google.com/Logout', '_blank', 'noopener');
    if (!w) {
      try {
        window.top!.location.href = 'https://accounts.google.com/Logout';
      } catch {
        location.href = 'https://accounts.google.com/Logout';
      }
    }
  }, [lang]);

  return useMemo<Store>(
    () => ({
      meta: data.meta,
      scenarios: data.scenarios,
      reports: data.reports,
      isAdmin: !!data.meta.isAdmin,
      userEmail: data.meta.userEmail || '',
      nav,
      lang,
      dark,
      isMobile,
      mobileView,
      settingsOpen,
      editNo,
      newScenarioOpen,
      newReportOpen,
      t,
      labels,
      getDefaultView,
      buildShareUrl,
      selectModule,
      selectReports,
      selectItem,
      selectFlowModule,
      selectFlows,
      selectCaseStudies,
      selectFlow,
      onSearch,
      setMobileView,
      mobileBack,
      openEditModal,
      closeEdit,
      saveScenario,
      swapScenario,
      deleteScenario: deleteScenarioAction,
      openNewScenarioModal,
      closeNewScenario,
      createNewScenario,
      openNewReportModal,
      closeNewReport,
      createNewReport,
      openSettings,
      closeSettings,
      setTheme,
      setLang,
      setDefaultView,
      signOut,
    }),
    [
      data,
      nav,
      lang,
      dark,
      isMobile,
      mobileView,
      settingsOpen,
      editNo,
      newScenarioOpen,
      newReportOpen,
      t,
      labels,
      buildShareUrl,
      selectModule,
      selectReports,
      selectItem,
      selectFlowModule,
      selectFlows,
      selectCaseStudies,
      selectFlow,
      onSearch,
      setMobileView,
      mobileBack,
      openEditModal,
      closeEdit,
      saveScenario,
      swapScenario,
      deleteScenarioAction,
      openNewScenarioModal,
      closeNewScenario,
      createNewScenario,
      openNewReportModal,
      closeNewReport,
      createNewReport,
      openSettings,
      closeSettings,
      setTheme,
      setLang,
      setDefaultView,
      signOut,
    ],
  );
}
