// The หมวดค่าใช้จ่าย (cost category) field, as an easy-to-click two-column
// panel rather than a plain text input with a hidden <datalist> — the list is
// short and fixed enough (Settings-editable, ~17 entries) that scanning it
// beats typing it, and a two-column grid keeps the panel short.
//
// Still a free-typed field underneath: the column is plain text in the API,
// so typing a value the list doesn't have is kept, matching the input this
// replaces.

import React, { useEffect, useRef, useState } from 'react';
import { Input } from './ui.jsx';

export default function CostCategoryPicker({ value, onChange, categories, placeholder }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
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
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-control border border-line bg-surface-card p-1.5 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card"
        >
          <div className="grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={value === c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={
                  'truncate rounded-control px-2 py-1.5 text-left text-sm transition-colors ' +
                  (value === c
                    ? 'bg-brand-700 text-white dark:bg-accent-dark dark:text-brand-950'
                    : 'text-ink hover:bg-surface-sunken dark:text-ink-dark dark:hover:bg-surface-dark-sunken')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
