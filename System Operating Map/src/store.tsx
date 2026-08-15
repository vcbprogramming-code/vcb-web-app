/**
 * Central app store — mirrors the imperative module-level `let`/`const` state
 * (selectedNodeId, activeDept, activeLayer, showAiMode, lang, fnActiveDept,
 * siteOnlyRegistry, FOCUS_ON/__focusId/FOCUS_TRAIL, direct/indirect toggle,
 * registry-open state, ...) and handler functions (selectNode, clearAll,
 * toggleLang, toggleFocusMode, openFocus, openRegistry, ...) from the canonical
 * Index.html <script>, re-expressed as a single React hook. <App/> calls useStore()
 * and threads the returned object down to the components.
 */
import { useCallback, useMemo, useState } from 'react';
import { NODE_INDEX } from './lib/derived';
import type { AnyNode } from './lib/derived';
import { isLaneNode } from './lib/derived';

export type Lang = 'en' | 'th';
export type SbTab = 'tasks' | 'conns' | 'ai';
export type DocTab = 0 | 1 | 2;
export type Audience = 'orient' | 'ai' | 'mgmt';

export interface Store {
  // ── filters / view state ──
  activeDept: string | null;
  activeLayer: 'all' | 'erp' | 'manual';
  hideDirect: boolean;
  hideIndirect: boolean;
  showAiMode: boolean;
  lang: Lang;

  // ── selection / sidebar ──
  selectedNodeId: string | null;
  selectedNode: AnyNode | null;
  sbTab: SbTab;
  docTab: DocTab;

  // ── function registry overlay ──
  registryOpen: boolean;
  fnActiveDept: string;
  siteOnlyRegistry: boolean;
  fnSearch: string;
  fnHighlightCode: string | null;

  // ── L0 overview ──
  // NOTE: the canonical Index.html renders #ovLayer with the `ov-hidden` class
  // present in markup and nothing in the shipped UI ever calls showOverview()/
  // backToOverview() (no button is wired to either) — the L0 overview is built
  // at init (renderOverview(); setAudience('orient');) but stays hidden behind
  // the swimlane map for the lifetime of the page. Mirrored here by defaulting
  // overviewOpen to false; the screen + its handlers are still fully ported.
  overviewOpen: boolean;
  audience: Audience;
  focusedStageId: string | null;

  // ── focus / linear trace ──
  focusArmed: boolean; // mirrors FOCUS_ON — "click any node to trace it" mode
  focusShow: boolean; // mirrors #focusLayer.show — the trace overlay is open
  focusId: string | null; // mirrors __focusId
  focusTrail: string[]; // mirrors FOCUS_TRAIL

  // ── actions ──
  selectNode: (node: AnyNode) => void;
  selectDocNode: (node: AnyNode) => void;
  closeSidebar: () => void;
  setSbTab: (t: SbTab) => void;
  setDocTab: (t: DocTab) => void;

  toggleDept: (dept: string) => void;
  setLayer: (layer: 'all' | 'erp' | 'manual') => void;
  toggleDirect: () => void;
  toggleIndirect: () => void;
  toggleAiMode: () => void;
  toggleLang: () => void;
  clearAll: () => void;

  openRegistry: () => void;
  closeRegistry: () => void;
  toggleRegistry: () => void;
  openRegistryToFunction: (code: string) => void;
  setFnActiveDept: (dept: string) => void;
  toggleSiteOnly: () => void;
  setFnSearch: (q: string) => void;

  showOverview: () => void;
  backToOverview: () => void;
  openStage: (id: string) => void;
  clearFocusStage: () => void;
  setAudience: (a: Audience) => void;

  toggleFocusMode: () => void;
  traceCurrent: () => void;
  openFocus: (node: AnyNode) => void;
  closeFocus: () => void;
  showOnBigMap: () => void;
}

export function useStore(): Store {
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [activeLayer, setActiveLayerState] = useState<'all' | 'erp' | 'manual'>('all');
  const [hideDirect, setHideDirect] = useState(false);
  const [hideIndirect, setHideIndirect] = useState(false);
  const [showAiMode, setShowAiMode] = useState(false);
  const [lang, setLang] = useState<Lang>('en');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sbTab, setSbTabState] = useState<SbTab>('tasks');
  const [docTab, setDocTabState] = useState<DocTab>(0);

  const [registryOpen, setRegistryOpen] = useState(false);
  const [fnActiveDept, setFnActiveDeptState] = useState('all');
  const [siteOnlyRegistry, setSiteOnlyRegistry] = useState(false);
  const [fnSearch, setFnSearchState] = useState('');
  const [fnHighlightCode, setFnHighlightCode] = useState<string | null>(null);

  const [overviewOpen, setOverviewOpen] = useState(false);
  const [audience, setAudienceState] = useState<Audience>('orient');
  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);

  const [focusArmed, setFocusArmed] = useState(false);
  const [focusShow, setFocusShow] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusTrail, setFocusTrail] = useState<string[]>([]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? NODE_INDEX[selectedNodeId] || null : null),
    [selectedNodeId],
  );

  // ── selection ──
  const selectNode = useCallback((node: AnyNode) => {
    setSelectedNodeId(node.id);
    setSbTabState('tasks');
  }, []);

  const selectDocNode = useCallback((node: AnyNode) => {
    setSelectedNodeId(node.id);
    setDocTabState(0);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const setSbTab = useCallback((t: SbTab) => setSbTabState(t), []);
  const setDocTab = useCallback((t: DocTab) => setDocTabState(t), []);

  // ── dept filter ──
  const toggleDept = useCallback((dept: string) => {
    setActiveDept((cur) => (cur === dept ? null : dept));
  }, []);

  // ── layer filter ──
  const setLayer = useCallback((layer: 'all' | 'erp' | 'manual') => {
    setActiveLayerState(layer);
  }, []);

  const toggleDirect = useCallback(() => setHideDirect((v) => !v), []);
  const toggleIndirect = useCallback(() => setHideIndirect((v) => !v), []);
  const toggleAiMode = useCallback(() => setShowAiMode((v) => !v), []);
  const toggleLang = useCallback(() => setLang((v) => (v === 'en' ? 'th' : 'en')), []);

  // ── function registry ──
  const openRegistry = useCallback(() => {
    setFnActiveDeptState('all');
    setSiteOnlyRegistry(false);
    setFnSearchState('');
    setRegistryOpen(true);
  }, []);
  const closeRegistry = useCallback(() => setRegistryOpen(false), []);
  const toggleRegistry = useCallback(() => setRegistryOpen((v) => !v), []);
  const openRegistryToFunction = useCallback((code: string) => {
    if (!code) return;
    setFnActiveDeptState('all');
    setFnSearchState('');
    setRegistryOpen(true);
    setFnHighlightCode(code);
  }, []);
  const setFnActiveDept = useCallback((dept: string) => {
    setFnActiveDeptState((cur) => (cur === dept && dept !== 'all' ? 'all' : dept));
  }, []);
  const toggleSiteOnly = useCallback(() => setSiteOnlyRegistry((v) => !v), []);
  const setFnSearch = useCallback((q: string) => setFnSearchState(q), []);

  // ── L0 overview ──
  const clearFocusStage = useCallback(() => {
    setFocusedStageId(null);
  }, []);
  const showOverview = useCallback(() => {
    clearFocusStage();
    setOverviewOpen(true);
    setSelectedNodeId(null);
  }, [clearFocusStage]);
  const backToOverview = useCallback(() => showOverview(), [showOverview]);
  const openStage = useCallback((id: string) => {
    setOverviewOpen(false);
    setFocusedStageId(id);
  }, []);
  const setAudience = useCallback((a: Audience) => setAudienceState(a), []);

  // ── focus / linear trace ──
  const toggleFocusMode = useCallback(() => setFocusArmed((v) => !v), []);

  const pushTrail = useCallback((id: string) => {
    setFocusTrail((trail) => {
      const next = trail.filter((x) => x !== id);
      next.push(id);
      return next.length > 7 ? next.slice(-7) : next;
    });
  }, []);

  const openFocus = useCallback(
    (node: AnyNode) => {
      setFocusId(node.id);
      setFocusShow(true);
      setSelectedNodeId(node.id);
      pushTrail(node.id);
    },
    [pushTrail],
  );

  const traceCurrent = useCallback(() => {
    if (focusShow) {
      setFocusShow(false);
      setFocusTrail([]);
      setFocusId(null);
      return;
    }
    if (selectedNodeId) {
      const n = NODE_INDEX[selectedNodeId];
      if (n) openFocus(n);
    }
  }, [focusShow, selectedNodeId, openFocus]);

  const closeFocus = useCallback(() => {
    setFocusShow(false);
    setFocusTrail([]);
    setFocusId(null);
  }, []);

  const showOnBigMap = useCallback(() => {
    const id = focusId;
    closeFocus();
    if (id && NODE_INDEX[id]) {
      setSelectedNodeId(id);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      });
    }
  }, [focusId, closeFocus]);

  // ── universal reset (clearAll) ──
  const clearAll = useCallback(() => {
    setRegistryOpen(false);
    setFocusShow(false);
    setFocusTrail([]);
    setFocusId(null);
    setFocusedStageId(null);
    setSelectedNodeId(null);
    setActiveDept(null);
    setActiveLayerState('all');
    setHideDirect(false);
    setHideIndirect(false);
    setShowAiMode(false);
  }, []);

  return {
    activeDept,
    activeLayer,
    hideDirect,
    hideIndirect,
    showAiMode,
    lang,
    selectedNodeId,
    selectedNode,
    sbTab,
    docTab,
    registryOpen,
    fnActiveDept,
    siteOnlyRegistry,
    fnSearch,
    fnHighlightCode,
    overviewOpen,
    audience,
    focusedStageId,
    focusArmed,
    focusShow,
    focusId,
    focusTrail,

    selectNode,
    selectDocNode,
    closeSidebar,
    setSbTab,
    setDocTab,
    toggleDept,
    setLayer,
    toggleDirect,
    toggleIndirect,
    toggleAiMode,
    toggleLang,
    clearAll,
    openRegistry,
    closeRegistry,
    toggleRegistry,
    openRegistryToFunction,
    setFnActiveDept,
    toggleSiteOnly,
    setFnSearch,
    showOverview,
    backToOverview,
    openStage,
    clearFocusStage,
    setAudience,
    toggleFocusMode,
    traceCurrent,
    openFocus,
    closeFocus,
    showOnBigMap,
  };
}

export { isLaneNode };
