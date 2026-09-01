import { useCallback, useEffect, useRef, useState } from 'react';

// Custom hover tooltip for app cards + sidebar nav items — ported from the
// #app-tooltip IIFE in index.html. A single reusable floating element,
// repositioned per hover instead of the native title attribute, so it
// appears immediately and matches the app's own look rather than the
// browser's slow, unstyled tooltip.
//
// Mimics typical intranet-portal tooltip behavior: a short pause before it
// appears (so it doesn't flash while the pointer is just passing through), a
// gentle fade in, and a slightly quicker fade out.
//
// The fade itself is the one piece still in index.css (.app-tooltip[data-open]
// / [data-closing]) — it has to animate on the way out, which means the element
// must stay mounted, which no utility class can express on its own.

const SHOW_DELAY = 220; // pause before the first tooltip of a hover appears
const SWAP_DELAY = 60; // pause before showing a *new* target after the pointer moves directly between items — lets the fade-out actually play
const HIDE_DELAY = 60; // pause before starting the fade-out once the pointer truly leaves
const FADE_OUT_MS = 160; // must match .app-tooltip[data-closing] transition-duration

export function useTooltip() {
  const [state, setState] = useState({
    content: null,
    target: null,
    open: false,
    closing: false,
  });
  const isTouchRef = useRef(false);
  const currentRef = useRef(null); // key of the content currently shown/showing
  const visibleRef = useRef(false);
  const hoverKeyRef = useRef(null);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const swapTimer = useRef(null);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(hover: none), (pointer: coarse)');
      isTouchRef.current = mq.matches;
    } catch {
      isTouchRef.current = false;
    }
  }, []);

  useEffect(
    () => () => {
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    },
    []
  );

  const reveal = useCallback((el, content) => {
    if (hoverKeyRef.current !== content.key) return; // stale — a newer hover has since taken over, or the pointer already left
    currentRef.current = content.key;
    visibleRef.current = true;
    setState({ content, target: el, open: true, closing: false });
  }, []);

  const fadeOutThen = useCallback((next) => {
    visibleRef.current = false;
    currentRef.current = null;
    setState((s) => ({ ...s, open: false, closing: true }));
    // Tracked so unmounting mid-swap cannot leave a timer running against a
    // dead component.
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    swapTimer.current = window.setTimeout(next, FADE_OUT_MS);
  }, []);

  const show = useCallback(
    (el, content) => {
      if (isTouchRef.current) return;
      hoverKeyRef.current = content.key;
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (currentRef.current === content.key) return;
      if (showTimer.current !== null) window.clearTimeout(showTimer.current);

      if (visibleRef.current) {
        // a tooltip is already on screen for a different target — fade it
        // out first, then bring in the new one after a short beat.
        fadeOutThen(() => {
          showTimer.current = window.setTimeout(() => {
            if (hoverKeyRef.current === content.key) reveal(el, content);
          }, SWAP_DELAY);
        });
      } else {
        showTimer.current = window.setTimeout(() => reveal(el, content), SHOW_DELAY);
      }
    },
    [fadeOutThen, reveal]
  );

  const hide = useCallback((key) => {
    if (isTouchRef.current) return;
    if (hoverKeyRef.current === key) hoverKeyRef.current = null;
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (currentRef.current !== key) return;
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      visibleRef.current = false;
      currentRef.current = null;
      setState((s) => ({ ...s, open: false, closing: true }));
      hideTimer.current = null;
    }, HIDE_DELAY);
  }, []);

  // Hide immediately on scroll, matching index.html's capture-phase scroll listener.
  useEffect(() => {
    function onScroll() {
      if (currentRef.current !== null) {
        currentRef.current = null;
        visibleRef.current = false;
        setState((s) => (s.open ? { ...s, open: false, closing: false } : s));
      }
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  /**
   * Spread onto the hover target.
   *
   *   {...bind({ key: 'card-sop', name, desc, kind: 'card' })}
   *
   * `kind` is 'nav' (tooltip to the target's right) or 'card' (above it).
   */
  const bind = useCallback(
    (content) => ({
      onMouseEnter: (e) => show(e.currentTarget, content),
      onMouseLeave: () => hide(content.key),
      onFocus: (e) => show(e.currentTarget, content),
      onBlur: () => hide(content.key),
    }),
    [show, hide]
  );

  return { state, bind };
}

// Positions itself against state.target each time it (re)opens, mirroring
// index.html's position(target) — nav items get the tooltip to their right,
// app cards get it above (falling back to below/clamped within the viewport).
export default function Tooltip({ state }) {
  const tipRef = useRef(null);

  useEffect(() => {
    const tip = tipRef.current;
    const target = state.target;
    if (!tip || !target || !state.open) return;

    const r = target.getBoundingClientRect();
    const gap = 10;
    tip.style.visibility = 'hidden';
    tip.style.left = '-9999px';
    // measure after content is in place
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let top;
    let left;

    if (state.content?.kind === 'nav') {
      left = r.right + gap;
      top = r.top + (r.height - th) / 2;
      if (left + tw > window.innerWidth - 12) left = r.left - tw - gap;
    } else {
      left = r.left + (r.width - tw) / 2;
      top = r.top - th - gap;
      if (top < 12) top = r.bottom + gap;
    }
    left = Math.min(Math.max(12, left), window.innerWidth - tw - 12);
    top = Math.min(Math.max(12, top), window.innerHeight - th - 12);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.visibility = '';
  }, [state.open, state.target, state.content]);

  return (
    <div
      ref={tipRef}
      role="tooltip"
      className="app-tooltip fixed left-0 top-0 z-[80] flex max-w-[280px] flex-col gap-1 rounded-card border border-line bg-surface-card px-3.5 py-2.5 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
      {...(state.open ? { 'data-open': '' } : {})}
      {...(state.closing ? { 'data-closing': '' } : {})}
    >
      <span className="text-sm font-semibold text-ink dark:text-ink-dark">
        {state.content?.name ?? ''}
      </span>
      <span className="text-xs leading-relaxed text-ink-muted dark:text-ink-dark-muted">
        {state.content?.desc ?? ''}
      </span>
    </div>
  );
}
