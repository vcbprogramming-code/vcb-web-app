import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@vcb/shared';

/**
 * The two-step activity picker.
 *
 *   step 1  กิจกรรม (Activity)      — the master work index
 *   step 2  หมวดงาน (Work Category) — the ERP cost code
 *
 * A `one-to-one` activity skips step 2 and takes its fixed cost; `one-to-many`
 * asks. The value stored in the cell is the composite "A-1 / 5" — the same
 * string the sheet held, and the same one the API's split_part() reads back
 * when it groups the dashboard's activity and cost mixes. Change the separator
 * here and those two lists silently go empty.
 */
export default function Picker({ anchor, activities, costs, onApply, onClose }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null);
  const boxRef = useRef(null);
  const searchRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 360, maxHeight: 460 });

  // Positioned against the cell that opened it, flipping above when there is no
  // room below and centring when there is room for neither — a 31-column grid
  // scrolls, and a popup pinned below the last row would open off-screen.
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 4;
    const w = Math.min(560, vw - 2 * margin);
    const left = Math.max(margin, Math.min(r.left, vw - w - margin));
    const below = vh - r.bottom - margin - gap;
    const above = r.top - margin - gap;
    let h;
    let top;
    if (Math.max(below, above) < 260) {
      h = Math.min(460, vh - 2 * margin);
      top = Math.max(margin, Math.round((vh - h) / 2));
    } else if (below >= above) {
      h = Math.min(460, below);
      top = r.bottom + gap;
    } else {
      h = Math.min(460, above);
      top = Math.max(margin, r.top - gap - h);
    }
    setPos({ left, top, width: w, maxHeight: h });
  }, [anchor, step]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [step]);

  // onClose is read through a ref rather than as a direct effect dependency,
  // so a caller passing an inline `() => ...` prop (a fresh reference on
  // every one of ITS OWN renders, unrelated to anything happening in here)
  // doesn't retrigger this effect and tear down/reattach the listener for no
  // reason.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // CAPTURE phase, not bubble — this is the actual fix for "the orange
  // [one-to-many] items aren't clickable/close the picker instead of
  // advancing to step 2".
  //
  // An item button's own onMouseDown calls pick(it), which for a
  // one-to-many activity calls setStep(2) — a synchronous state update
  // inside a discrete DOM event handler, which React 18 flushes
  // synchronously rather than batching. That re-render replaces step 1's
  // item list with step 2's (different data, different keys), so the
  // ORIGINAL click target node is removed from the document as part of
  // React's own bubble-phase dispatch — before a bubble-phase listener on
  // `document` ever runs. By the time this effect's bubble-phase onDown
  // used to fire, e.target was a detached node: genuinely no longer inside
  // boxRef.current (which is unchanged and still in the document), because
  // it was no longer inside ANYTHING. `.contains()` was answering honestly;
  // the question arrived too late. Capture fires on `document` on the way
  // DOWN to the target, before React's synthetic bubble-phase dispatch has
  // run at all, so it always sees the DOM as it existed when the mouse
  // actually went down.
  useEffect(() => {
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) onCloseRef.current();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // Escape at step 2 goes back a step rather than closing: losing the
      // activity you just chose because you wanted a different cost code was
      // the single most-reported annoyance in the sheet version.
      if (step === 2) {
        setStep(1);
        setQuery('');
      } else onCloseRef.current();
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [step]);

  const items = step === 1 ? activities : costs;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.name, it.desc, it.category, it.code, it.name_en].some((x) =>
        String(x || '').toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  // Grouped by category at step 1 so a 40-item index reads as five short lists.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      const key = step === 1 ? String(it.category || '').trim() || t('common.others') : t('idx.costTab');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()];
  }, [filtered, step, t]);

  function pick(it) {
    if (step === 2) {
      onApply(`${pending?.code ?? ''} / ${it.code}`);
      return;
    }
    const oneToOne = (it.mapping || 'one-to-many') === 'one-to-one';
    if (oneToOne) {
      // Z-1/Z-2/Z-3 (Standby / Leave / Resignation) are one-to-one with no
      // fixed cost, so the bare code is the whole value. Appending an empty
      // cost would write "Z-2 / " and break split_part on the dashboard.
      onApply(it.fixed_cost ? `${it.code} / ${it.fixed_cost}` : it.code);
      return;
    }
    setPending(it);
    setStep(2);
    setQuery('');
  }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={step === 1 ? t('pick.step1') : t('pick.step2')}
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-card border border-line bg-surface-card shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          if (step === 2) {
            setStep(1);
            setQuery('');
          }
        }}
        className={
          'flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold ' +
          'text-ink dark:border-line-dark dark:text-ink-dark ' +
          (step === 2 ? 'cursor-pointer hover:bg-surface-sunken dark:hover:bg-surface-dark-sunken' : '')
        }
      >
        {step === 2 && <span aria-hidden="true">‹</span>}
        <span className="rounded-pill bg-brand-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {step}/2
        </span>
        {step === 1 ? (
          t('pick.step1')
        ) : (
          <>
            {t('pick.step2')} · {t('entry.work')}: <b>{pending?.code}</b>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-line px-3 py-2 dark:border-line-dark">
        <input
          ref={searchRef}
          type="text"
          autoComplete="off"
          placeholder={t('pick.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-control border border-line bg-surface-card px-2 py-1 text-sm text-ink focus:border-brand-600 focus:outline-none dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark"
        />
        <span className="shrink-0 text-xs tabular-nums text-ink-muted dark:text-ink-dark-muted">
          {filtered.length}/{items.length}
        </span>
        {/* Clearing writes an empty value, which DELETES the slot rather than
            storing '' — a blank row would still be counted as a manday. */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onApply('');
          }}
          className="shrink-0 rounded-control border border-line px-2 py-1 text-xs text-ink-muted hover:text-danger dark:border-line-dark dark:text-ink-dark-muted"
        >
          {t('pick.clear')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-muted dark:text-ink-dark-muted">
            {t('audit.noResults')} “{query}”
          </p>
        ) : (
          groups.map(([category, list]) => (
            <div key={category}>
              <div className="sticky top-0 z-[1] bg-surface-sunken px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-subtle dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
                {category}
              </div>
              {list.map((it) => {
                const oneToOne = step === 1 && (it.mapping || 'one-to-many') === 'one-to-one';
                return (
                  <button
                    key={it.id ?? it.code}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(it);
                    }}
                    className="block w-full border-b border-line/60 px-3 py-1.5 text-left last:border-0 hover:bg-brand-50 dark:border-line-dark/60 dark:hover:bg-brand-900/30"
                  >
                    <div className="flex items-center gap-1.5 text-sm text-ink dark:text-ink-dark">
                      {it.code && (
                        <span className="shrink-0 font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                          {it.code}
                        </span>
                      )}
                      {step === 1 && it.code && (
                        <span
                          aria-hidden="true"
                          title={oneToOne ? t('pick.fixedCostHint') : t('pick.twoStepHint')}
                          className={
                            'h-1.5 w-1.5 shrink-0 rounded-full ' +
                            (oneToOne ? 'bg-ok' : 'bg-warn')
                          }
                        />
                      )}
                      <span className="truncate">{it.name}</span>
                    </div>
                    {(it.desc || it.name_en) && (
                      <div className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                        {it.desc || it.name_en}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
