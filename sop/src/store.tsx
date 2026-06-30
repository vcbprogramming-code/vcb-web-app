/**
 * Central app store — mirrors the imperative `state` object and handler
 * functions in index.html (selectModule, selectFlows, doSync, setTheme, …),
 * re-expressed as a single React hook. One <App/> calls useStore() and threads
 * the returned object down to the panes/modals.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SopData, Scenario, ScenarioEdit } from './data/types';
import { MODULES, MODULES_EN, tr, type Lang } from './data/config';
import { bootstrap, getSopDataForClient, syncFromDoc, editScenario } from './lib/api';

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

/** Build the initial nav state by applying the saved default view. */
function initialNav(mobile: boolean): NavState {
  const base: NavState = {
    view: 'sop',
    mod: 'ALL',
    flowMod: 'ALL',
    sel: null,
    selFlow: null,
    q: '',
    navCollapsed: false,
  };
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
  syncing: boolean;
  // helpers
  t: (key: string) => any;
  labels: Record<string, string>;
  getDefaultView: () => string;
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
  doSync: () => void;
  openEditModal: (no: number) => void;
  closeEdit: () => void;
  saveScenario: (payload: ScenarioEdit) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLang: (lang: Lang) => void;
  setDefaultView: (v: string) => void;
  signOut: () => void;
}

export function useStore(): Store {
  const [data, setData] = useState<SopData>(() => bootstrap());
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile());
  const [nav, setNav] = useState<NavState>(() => initialNav(detectMobile()));
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
  const [mobileView, setMobileViewState] = useState<MobileView>(() => (detectMobile() ? null : null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editNo, setEditNo] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const t = useCallback((key: string) => tr(lang, key), [lang]);
  const labels = (lang === 'en' ? MODULES_EN : MODULES) as Record<string, string>;

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

  const doSync = useCallback(async () => {
    setSettingsOpen(false);
    setSyncing(true);
    try {
      await syncFromDoc();
      await refreshClientData();
    } catch (e: any) {
      alert('Sync ล้มเหลว / Sync failed:\n' + (e && e.message ? e.message : e));
    } finally {
      setSyncing(false);
    }
  }, [refreshClientData]);

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
      syncing,
      t,
      labels,
      getDefaultView,
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
      doSync,
      openEditModal,
      closeEdit,
      saveScenario,
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
      syncing,
      t,
      labels,
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
      doSync,
      openEditModal,
      closeEdit,
      saveScenario,
      openSettings,
      closeSettings,
      setTheme,
      setLang,
      setDefaultView,
      signOut,
    ],
  );
}
