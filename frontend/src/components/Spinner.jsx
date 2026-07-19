/**
 * A spinning loading indicator (CSS animation, currentColor). Pair with a label
 * so "loading" never looks like a frozen screen.
 *
 * tone: 'muted' (default) → text-slate-400, for standalone/inline-on-light use.
 *       'inherit'         → inherits the parent's text color, e.g. white inside
 *                           a .btn-primary so the spinner matches the label.
 */
export default function Spinner({ className = 'h-5 w-5', label, tone = 'muted' }) {
  const wrap = tone === 'inherit' ? 'inline-flex items-center gap-2' : 'inline-flex items-center gap-2 text-slate-400';
  return (
    <span className={wrap}>
      <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

/**
 * Inline busy swap for buttons/links: renders `children` normally, and while
 * `busy` swaps to a small spinner (inherits the button's text color) + `busyText`.
 * Keeps the click target's color/size, so it works on both .btn-* and text links.
 */
export function BusyLabel({ busy, busyText, children, className = 'h-3.5 w-3.5' }) {
  if (!busy) return children;
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {busyText}
    </span>
  );
}
