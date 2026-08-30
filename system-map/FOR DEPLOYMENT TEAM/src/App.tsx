/** Root of the System Operating Map React port. Holds the store and assembles
 *  the full layout — brand banner + header (TopBar), main map area (Lanes +
 *  SvgEdges + DocsLayer inside `.map-scroll`), collapsible legend, right sidebar,
 *  L0 overview layer, focus/trace layer, and the function registry overlay — a
 *  faithful mirror of the <body> structure in the canonical Index.html. `<body>`
 *  classes the CSS keys off (layer-erp/layer-manual, hide-direct/hide-indirect,
 *  ai-mode, sb-open, dept-active) are driven by an effect below, matching the
 *  imperative original's classList.toggle() calls.
 */
import { useEffect, useLayoutEffect } from 'react';
import { useStore } from './store';
import TopBar from './components/TopBar';
import Lanes from './components/Lanes';
import SvgEdges from './components/SvgEdges';
import DocsLayer from './components/DocsLayer';
import Legend from './components/Legend';
import Sidebar from './components/Sidebar';
import Overview, { StageCrumb, allStages } from './components/Overview';
import FocusTrace from './components/FocusTrace';
import FunctionRegistry from './components/FunctionRegistry';

/** Mirrors syncHeaderHeight() + its window resize listener at the tail of the
 *  original <script>: measures the actual rendered brand-banner + app-header
 *  heights (both wrap/vary with viewport width) and publishes --header-h,
 *  which the sidebar/overlays/focus layer all position against. */
function useSyncHeaderHeight() {
  useLayoutEffect(() => {
    const sync = () => {
      const banner = document.querySelector<HTMLElement>('.brand-banner');
      const header = document.querySelector<HTMLElement>('.app-header');
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

  // Mirrors the body.classList.toggle(...) calls scattered across toggleDirect/
  // toggleIndirect/layer-filter buttons/toggleAiMode/showSidebar/closeSidebar/
  // applyDeptFilter in Index.html.
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
  }, [s.hideDirect, s.hideIndirect, s.activeLayer, s.showAiMode, s.selectedNode, s.focusArmed, s.audience]);

  // Escape key: close registry if open, else close sidebar — mirrors the
  // document.addEventListener('keydown', ...) block in Index.html.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      <TopBar s={s} />

      <div className="app-body">
        <div className="map-scroll" id="mapScroll">
          <StageCrumb s={s} />
          <SvgEdges s={s} />
          <Lanes s={s} focusStageLaneIds={focusStageLaneIds} />
          <DocsLayer s={s} />
        </div>

        <Legend s={s} />
        <Sidebar s={s} />
      </div>

      <Overview s={s} />
      <FocusTrace s={s} />
      <FunctionRegistry s={s} />
    </>
  );
}
