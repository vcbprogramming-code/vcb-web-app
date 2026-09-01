import { useState } from 'react';

// A single collapsible node in the org tree.
//
// Layout is Tailwind; the CONNECTOR GUIDES are not. Drawing them needs
// ::before pseudo-elements on three different selectors (a stem down from the
// parent, a shared horizontal bar across the row, a drop into each child), and
// `.tree-row > *::before` styles children this component does not render. No
// utility class can express either, so those rules live in index.css under
// .tree-children / .tree-row — the short list of things Tailwind genuinely
// cannot do.
//
// This is deliberately NOT the original app's technique. That measured the DOM
// with getBoundingClientRect() after every state change to position connector
// divs, which was the single most fragile part of the app (five-plus rounds of
// bugs by its own KNOWN_ISSUES.md) and does not fit React's render model.
// Border-drawn guides reflow for free on every re-render with no JS at all.

export function TreeNode({ label, meta, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        aria-expanded={hasChildren ? open : undefined}
        disabled={!hasChildren}
        className={[
          'flex min-w-[9rem] flex-col items-center gap-0.5 rounded-card border border-line bg-surface-card px-4 py-2.5 text-center shadow-card transition-colors dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark',
          hasChildren
            ? 'cursor-pointer hover:border-accent hover:text-accent dark:hover:border-accent-dark dark:hover:text-accent-dark'
            : 'cursor-default',
        ].join(' ')}
      >
        <span className="text-sm font-bold">{label}</span>
        {meta && (
          <span className="text-xs text-ink-muted dark:text-ink-dark-muted">{meta}</span>
        )}
      </button>
      {hasChildren && open && <div className="tree-children">{children}</div>}
    </div>
  );
}

export function TreeRow({ children }) {
  return <div className="tree-row">{children}</div>;
}

export function PersonCard({ person }) {
  const [open, setOpen] = useState(false);
  const initials = person.name
    .replace(/^(Mr\.|Mrs\.|Ms\.)\s*/, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => person.role && setOpen((v) => !v)}
        aria-expanded={person.role ? open : undefined}
        className={[
          'flex items-center gap-2 rounded-control border border-line bg-surface-sunken px-2 py-1.5 text-left dark:border-line-dark dark:bg-surface-dark-sunken',
          person.role ? 'cursor-pointer hover:border-accent dark:hover:border-accent-dark' : 'cursor-default',
        ].join(' ')}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[0.65rem] font-bold text-white">
          {initials}
        </span>
        <span className="text-xs leading-tight">{person.name}</span>
      </button>
      {open && person.role && (
        <div className="mt-1 rounded-control bg-surface-sunken px-2 py-1 text-[0.7rem] text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
          {person.role}
        </div>
      )}
    </div>
  );
}

/** The repeated "a grid of people" block. */
export function PersonGrid({ children }) {
  return (
    <div className="mt-2 grid max-w-[500px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {children}
    </div>
  );
}
