/** Root of the System Operating Map. Assembles the full layout — brand banner +
 *  header (TopBar), main map area (Lanes + SvgEdges + DocsLayer inside the map
 *  scroller), collapsible legend, right sidebar, L0 overview layer, focus/trace
 *  layer, and the function registry overlay.
 *
 *  The `<body>` classes the CSS keys off (layer-erp/layer-manual, hide-direct/
 *  hide-indirect, ai-mode, sb-open, focus-armed, aud-*) are driven by an effect
 *  below. They stay real body classes rather than becoming props because they
 *  drive cross-tree filters (see index.css) and because the SVG router reads
 *  them back off the DOM when it decides which connectors to dim.
 */
import { useEffect, useLayoutEffect } from 'react';
import { useStore } from './store.jsx';
import TopBar from './components/TopBar.jsx';
import Lanes from './components/Lanes.jsx';
import SvgEdges from './components/SvgEdges.jsx';
import DocsLayer from './components/DocsLayer.jsx';
import Legend from './components/Legend.jsx';
import Sidebar from './components/Sidebar.jsx';
import Overview, { StageCrumb, allStages } from './components/Overview.jsx';
import FocusTrace from './components/FocusTrace.jsx';
import FunctionRegistry from './components/FunctionRegistry.jsx';

/** Measures the actual rendered brand-banner + app-header heights (both wrap
 *  and vary with viewport width) and publishes --header-h, which the sidebar,
 *  overlays and focus layer all position against. */
function useSyncHeaderHeight() {
  useLayoutEffect(() => {
    const sync = () => {
      // The bar is the shared AppBar now, which renders a plain <header> and
      // carries no .brand-banner class. Querying that class returned null and
      // --header-h came out 72px against a true 144px, so the canvas started a
      // whole bar too high and the connector lines ran up behind it.
      const banner = document.querySelector('header');
      const header = document.querySelector('.app-header');
      const h = (banner ? banner.offsetHeight : 0) + (header ? header.offsetHeight : 0);
      document.documentElement.style.setProperty('--header-h', h + 'px');
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
}

export default function App() {
  const s = useStore();
  useSyncHeaderHeight();

  useEffect(() => {
    const b = document.body;
    b.classList.toggle('hide-direct', s.hideDirect);
    b.classList.toggle('hide-indirect', s.hideIndirect);
    b.classList.toggle('layer-erp', s.activeLayer === 'erp');
    b.classList.toggle('layer-manual', s.activeLayer === 'manual');
    b.classList.toggle('ai-mode', s.showAiMode);
    b.classList.toggle('sb-open', !!s.selectedNode);
    b.classList.toggle('focus-armed', s.focusArmed);
    b.classList.toggle('aud-orient', s.audience === 'orient');
    b.classList.toggle('aud-ai', s.audience === 'ai');
    b.classList.toggle('aud-mgmt', s.audience === 'mgmt');
  }, [
    s.hideDirect,
    s.hideIndirect,
    s.activeLayer,
    s.showAiMode,
    s.selectedNode,
    s.focusArmed,
    s.audience,
  ]);

  // Escape: close the registry if open, else close the sidebar.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (s.registryOpen) s.closeRegistry();
        else s.closeSidebar();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [s.registryOpen, s]);

  const focusStageLaneIds = s.focusedStageId
    ? new Set(allStages().find((x) => x.id === s.focusedStageId)?.lanes || [])
    : null;

  return (
    <>
      <TopBar />

      <div className="block h-[calc(100vh-var(--header-h))] overflow-hidden">
        <div
          // relative: the SVG overlay inside is position:absolute and needs a
          // containing block here. Without one it positioned against <body>,
          // so its origin never lined up with lanesWrap and every arrow was
          // drawn 164px too high. The original gets this free because its
          // overlay and wrapper are adjacent siblings.
          className="map-scroll relative box-border h-full w-full overflow-auto px-6 pb-20 pt-5"
          id="mapScroll"
        >
          <StageCrumb />
          <SvgEdges />
          <Lanes focusStageLaneIds={focusStageLaneIds} />
          <DocsLayer />
        </div>

        <Legend />
        <Sidebar />
      </div>

      <Overview />
      <FocusTrace />
      <FunctionRegistry />
    </>
  );
}
