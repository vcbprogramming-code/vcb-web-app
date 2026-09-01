/**
 * Central app store — mirrors the imperative module-level state
 * (selectedNodeId, activeDept, activeLayer, showAiMode, fnActiveDept,
 * siteOnlyRegistry, FOCUS_ON/__focusId/FOCUS_TRAIL, direct/indirect toggle,
 * registry-open state, ...) and handler functions (selectNode, clearAll,
 * toggleFocusMode, openFocus, openRegistry, ...) from the canonical
 * Index.html <script>, re-expressed as Context + useState.
 *
 * TECH_STACK.md: state is Context + useState, no Redux.
 *
 * `lang` is deliberately NOT here any more. Language is shared state across the
 * whole portal (shared/src/i18n.jsx, one `vcb_lang` key for all modules), so
 * components read it from useI18n() rather than from this store. The old
 * toggleLang() is the shared toggleLang().
 *
 * This module stores nothing server-side: no API, no database. Everything below
 * is view state that lives for the life of the page.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { NODE_INDEX, isLaneNode } from './lib/derived.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const store = useStoreValue();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

function useStoreValue() {
  // ── filters / view state ──
  const [activeDept, setActiveDept] = useState(null);
  const [activeLayer, setActiveLayerState] = useState('all');
  const [hideDirect, setHideDirect] = useState(false);
  const [hideIndirect, setHideIndirect] = useState(false);
  const [showAiMode, setShowAiMode] = useState(false);

  // ── selection / sidebar ──
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [sbTab, setSbTabState] = useState('tasks');
  const [docTab, setDocTabState] = useState(0);

  // ── function registry overlay ──
  const [registryOpen, setRegistryOpen] = useState(false);
  const [fnActiveDept, setFnActiveDeptState] = useState('all');
  const [siteOnlyRegistry, setSiteOnlyRegistry] = useState(false);
  const [fnSearch, setFnSearchState] = useState('');
  const [fnHighlightCode, setFnHighlightCode] = useState(null);

  // ── L0 overview ──
  // NOTE: the canonical Index.html renders #ovLayer with the `ov-hidden` class
  // present in markup and nothing in the shipped UI ever calls showOverview()/
  // backToOverview() (no button is wired to either) — the L0 overview is built
  // at init (renderOverview(); setAudience('orient');) but stays hidden behind
  // the swimlane map for the lifetime of the page. Mirrored here by defaulting
  // overviewOpen to false; the screen + its handlers are still fully ported.
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [audience, setAudienceState] = useState('orient');
  const [focusedStageId, setFocusedStageId] = useState(null);

  // ── focus / linear trace ──
  const [focusArmed, setFocusArmed] = useState(false); // mirrors FOCUS_ON
  const [focusShow, setFocusShow] = useState(false); // mirrors #focusLayer.show
  const [focusId, setFocusId] = useState(null); // mirrors __focusId
  const [focusTrail, setFocusTrail] = useState([]); // mirrors FOCUS_TRAIL

  const selectedNode = useMemo(
    () => (selectedNodeId ? NODE_INDEX[selectedNodeId] || null : null),
    [selectedNodeId],
  );

  // ── selection ──
  const selectNode = useCallback((node) => {
    setSelectedNodeId(node.id);
    setSbTabState('tasks');
  }, []);

  const selectDocNode = useCallback((node) => {
    setSelectedNodeId(node.id);
    setDocTabState(0);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const setSbTab = useCallback((t) => setSbTabState(t), []);
  const setDocTab = useCallback((t) => setDocTabState(t), []);

  // ── dept filter ──
  const toggleDept = useCallback((dept) => {
    setActiveDept((cur) => (cur === dept ? null : dept));
  }, []);

  // ── layer filter ──
  const setLayer = useCallback((layer) => {
    setActiveLayerState(layer);
  }, []);

  const toggleDirect = useCallback(() => setHideDirect((v) => !v), []);
  const toggleIndirect = useCallback(() => setHideIndirect((v) => !v), []);
  const toggleAiMode = useCallback(() => setShowAiMode((v) => !v), []);

  // ── function registry ──
  const openRegistry = useCallback(() => {
    setFnActiveDeptState('all');
    setSiteOnlyRegistry(false);
    setFnSearchState('');
    setRegistryOpen(true);
  }, []);
  const closeRegistry = useCallback(() => setRegistryOpen(false), []);
  const toggleRegistry = useCallback(() => setRegistryOpen((v) => !v), []);
  const openRegistryToFunction = useCallback((code) => {
    if (!code) return;
    setFnActiveDeptState('all');
    setFnSearchState('');
    setRegistryOpen(true);
    setFnHighlightCode(code);
  }, []);
  const setFnActiveDept = useCallback((dept) => {
    setFnActiveDeptState((cur) => (cur === dept && dept !== 'all' ? 'all' : dept));
  }, []);
  const toggleSiteOnly = useCallback(() => setSiteOnlyRegistry((v) => !v), []);
  const setFnSearch = useCallback((q) => setFnSearchState(q), []);

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
  const openStage = useCallback((id) => {
    setOverviewOpen(false);
    setFocusedStageId(id);
  }, []);
  const setAudience = useCallback((a) => setAudienceState(a), []);

  // ── focus / linear trace ──
  const toggleFocusMode = useCallback(() => setFocusArmed((v) => !v), []);

  const pushTrail = useCallback((id) => {
    setFocusTrail((trail) => {
      const next = trail.filter((x) => x !== id);
      next.push(id);
      return next.length > 7 ? next.slice(-7) : next;
    });
  }, []);

  const openFocus = useCallback(
    (node) => {
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
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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
