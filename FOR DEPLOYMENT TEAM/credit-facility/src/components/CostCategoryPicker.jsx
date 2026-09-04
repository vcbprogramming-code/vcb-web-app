// The หมวดค่าใช้จ่าย (cost category) field, as an easy-to-click two-column
// panel rather than a plain text input with a hidden <datalist> — the list is
// short and fixed enough (Settings-editable, ~17 entries) that scanning it
// beats typing it, and a two-column grid keeps the panel short.
//
// Still a free-typed field underneath: the column is plain text in the API,
// so typing a value the list doesn't have is kept, matching the input this
// replaces.
//
// THE PANEL IS A PORTAL, NOT AN absolute CHILD
//
// It used to be position:absolute under the input, inside the request
// modal's own overflow-y-auto body. That container clips anything inside it
// once the panel's height pushes past the modal's remaining scroll room —
// so on a shorter window the panel was invisible below the fold, and the
// modal itself grew a scrollbar it never had with the panel closed. Porting
// the panel out to document.body with position:fixed, sized from the
// input's own on-screen rect, means it always renders fully on screen and
// never touches the modal's own height or scroll state — the modal stays
// exactly the size it already was.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from './ui.jsx';

// One palette, cycled by index — the list has no category-type field to key
// a semantic colour off, so a fixed per-slot colour is what makes the panel
// scannable ("ทรายถม is always the orange one") without inventing grouping
// data the API doesn't have.
const CHIP_COLORS = [
  { bg: '#FDECD8', fg: '#B25E09', dark: { bg: 'rgba(251,146,60,.18)', fg: '#FDBA74' } }, // orange
  { bg: '#E7EAEE', fg: '#4B5563', dark: { bg: 'rgba(148,163,184,.18)', fg: '#CBD5E1' } }, // grey
  { bg: '#DCFCE7', fg: '#15803D', dark: { bg: 'rgba(74,222,128,.18)', fg: '#86EFAC' } }, // green
  { bg: '#DBEAFE', fg: '#1D4ED8', dark: { bg: 'rgba(96,165,250,.18)', fg: '#93C5FD' } }, // blue
  { bg: '#F3E8FF', fg: '#7E22CE', dark: { bg: 'rgba(192,132,252,.18)', fg: '#D8B4FE' } }, // purple
  { bg: '#FCE7F3', fg: '#BE185D', dark: { bg: 'rgba(244,114,182,.18)', fg: '#F9A8D4' } }, // pink
];

function chipColor(i) {
  return CHIP_COLORS[i % CHIP_COLORS.length];
}

export default function CostCategoryPicker({ value, onChange, categories, placeholder }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  // Recompute on open and on scroll/resize while open, so the panel tracks
  // the field if the modal (or the page) scrolls under it.
  //
  // maxHeight comes from the viewport, not a fixed number: the list is
  // Settings-editable and already sits at 18 entries, so a constant like
  // max-h-64 (256px, ~8 rows of a 2-col grid) started clipping into its own
  // scrollbar well before the real list's length. Fitting to the gap between
  // the field and the bottom of the screen means the panel only ever grows a
  // scrollbar when it truly would run off-screen, and 3 columns keeps the row
  // count (and so the panel's height) down even at 18+ items.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = r.bottom + 4;
      const maxHeight = Math.max(160, window.innerHeight - top - 16);
      setPos({ left: r.left, top, width: r.width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      if (e.target.closest?.('[data-cost-cat-panel]')) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && pos
        ? createPortal(
            <div
              data-cost-cat-panel
              role="listbox"
              style={{
                position: 'fixed',
                left: pos.left,
                top: pos.top,
                width: Math.max(pos.width, 460),
                maxHeight: pos.maxHeight,
              }}
              className="z-[100] overflow-y-auto rounded-control border border-line bg-surface-card p-1.5 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
            >
              <div className="grid grid-cols-3 gap-1">
                {categories.map((c, i) => {
                  const color = chipColor(i);
                  const selected = value === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                      style={{
                        '--chip-bg': color.bg,
                        '--chip-fg': color.fg,
                        '--chip-bg-dark': color.dark.bg,
                        '--chip-fg-dark': color.dark.fg,
                      }}
                      className={
                        'cost-cat-chip truncate rounded-control px-2 py-1.5 text-left text-sm font-medium transition-transform hover:scale-[1.02] ' +
                        (selected ? 'ring-2 ring-brand-600 dark:ring-accent-dark' : '')
                      }
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
