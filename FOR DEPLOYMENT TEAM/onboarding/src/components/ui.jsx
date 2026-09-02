import { Link } from 'react-router-dom';

// The handful of shapes every page repeats: a page wrapper, a card section, an
// eyebrow, a CTA, and the error banner. Written once here so a page reads as
// its content rather than as a wall of identical utility strings, and so the
// card treatment changes in one place.
//
// These are plain functions over Tailwind classes, not a component library —
// TECH_STACK.md rules out UI kits, and nothing here is generic enough to be
// one anyway.

export function Page({ children, className = '' }) {
  // min-w-0 on the children, not just the column. A flex item defaults to
  // min-width:auto, so it refuses to shrink below its content: anything with
  // an internal horizontal scroller - the Track Record row, the org chart -
  // widens the whole page instead of clipping, and the page itself scrolls
  // sideways on a tablet. The overflow-x-auto container cannot clip until its
  // parent is allowed to be narrower than what it holds.
  return <div className={`flex min-w-0 flex-col gap-6 [&>*]:min-w-0 ${className}`}>{children}</div>;
}

export function PageTitle({ children }) {
  return <h1 className="text-3xl font-extrabold tracking-tight">{children}</h1>;
}

export function Eyebrow({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.06em] text-accent dark:text-accent-dark">
      {children}
    </p>
  );
}

export function Section({ title, children, className = '' }) {
  return (
    <section
      className={`rounded-card border border-line bg-surface-card p-5 shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark ${className}`}
    >
      {title && <h2 className="mb-3 text-xl font-bold">{title}</h2>}
      {children}
    </section>
  );
}

const ctaBase =
  'inline-block rounded-pill px-6 py-3 text-center font-bold transition-opacity';
const ctaEnabled =
  'bg-accent text-white hover:opacity-90 dark:bg-accent-dark dark:text-surface-dark';
const ctaDisabled =
  'pointer-events-none cursor-not-allowed bg-line text-ink-muted dark:bg-line-dark dark:text-ink-dark-muted';

/** A link styled as the page's primary action. `disabled` blocks navigation. */
export function CtaLink({ to, disabled = false, className = '', children, ...rest }) {
  return (
    <Link
      to={to}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={`${ctaBase} ${disabled ? ctaDisabled : ctaEnabled} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function CtaButton({ onClick, variant = 'primary', className = '', children, ...rest }) {
  const look =
    variant === 'secondary'
      ? 'border border-line bg-transparent text-ink hover:bg-surface-sunken dark:border-line-dark dark:text-ink-dark dark:hover:bg-surface-dark-sunken'
      : ctaEnabled;
  return (
    <button type="button" onClick={onClick} className={`${ctaBase} ${look} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * A dismissible failure message.
 *
 * Always rendered with role="alert" — these appear after an action the person
 * just took (a save that failed, an upload that was rejected), so a screen
 * reader must announce them without the focus having to move.
 */
export function ErrorBanner({ children, onDismiss, dismissLabel }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border border-danger/30 bg-danger-bg px-4 py-3 text-danger-fg dark:border-danger-dark/40 dark:bg-danger-dark/10 dark:text-danger-dark"
    >
      <span className="flex-1 text-sm">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-sm font-semibold underline underline-offset-2"
        >
          {dismissLabel}
        </button>
      )}
    </div>
  );
}

export function Notice({ children }) {
  return (
    <p className="rounded-card border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn-fg dark:border-warn-dark/40 dark:bg-warn-dark/10 dark:text-warn-dark">
      {children}
    </p>
  );
}
