/**
 * The handful of controls this module repeats. Hand-written, per TECH_STACK.md
 * (no UI kit) — they exist so the same button does not get restyled slightly
 * differently in six files, not to become a component library.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';

/* --------------------------------- button --------------------------------- */

const VARIANTS = {
  default:
    'border-line bg-surface-card text-ink hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
  primary:
    'border-brand-700 bg-brand-700 text-white hover:bg-brand-800 dark:border-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700',
  danger:
    'border-danger bg-surface-card text-danger hover:bg-danger-bg dark:border-danger-dark dark:bg-surface-dark-card dark:text-danger-dark dark:hover:bg-danger/20',
};

export function Button({ variant = 'default', className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

/* ---------------------------------- modal --------------------------------- */

/**
 * Backdrop + panel.
 *
 * `dismissable` is false for the case editor: that form can hold a lot of typed
 * content, and a stray backdrop click throwing it away was worth guarding
 * against in the canonical app too. Escape still closes a dismissable one.
 */
export function Modal({ title, onClose, dismissable = true, size = 'md', children, footer }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!dismissable) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissable, onClose]);

  const width = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    full: 'max-w-6xl',
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 animate-fade-in sm:p-6"
      onClick={dismissable ? (e) => e.target === e.currentTarget && onClose() : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`my-auto flex w-full ${width} max-h-[92vh] flex-col rounded-card bg-surface-card shadow-card-hover dark:bg-surface-dark-card dark:shadow-card-dark`}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-3.5 dark:border-line-dark">
          <h3 className="flex-1 text-base font-bold text-brand-900 dark:text-brand-200">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-1 shrink-0 rounded p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark"
          >
            <span aria-hidden="true" className="block h-5 w-5 text-lg leading-5">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 dark:border-line-dark">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- fields -------------------------------- */

/** Label above its control, which is the layout that survives Thai labels —
 * they run long and a side label forces an awkward column width. */
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-muted dark:text-ink-dark-muted">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark dark:placeholder:text-ink-dark-muted';

export function TextInput({ className = '', ...rest }) {
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }) {
  return <textarea className={`${CONTROL} resize-y ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }) {
  return <select className={`${CONTROL} ${className}`} {...rest} />;
}

/* --------------------------------- messages ------------------------------- */

/** A non-blocking notice. `tone` picks the palette; the shared status colours
 * are used rather than stock Tailwind red/green, per the preset's note. */
export function Notice({ tone = 'info', children, className = '' }) {
  const tones = {
    info: 'border-info bg-info-bg text-info-fg dark:border-info-dark/40 dark:bg-info/15 dark:text-info-dark',
    warn: 'border-warn bg-warn-bg text-warn-fg dark:border-warn-dark/40 dark:bg-warn/15 dark:text-warn-dark',
    danger:
      'border-danger bg-danger-bg text-danger-fg dark:border-danger-dark/40 dark:bg-danger/15 dark:text-danger-dark',
    ok: 'border-ok bg-ok-bg text-ok-fg dark:border-ok-dark/40 dark:bg-ok/15 dark:text-ok-dark',
  };
  return (
    <div className={`rounded-card border-l-4 px-3.5 py-2.5 text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

/** "Nothing here" — a state, not a failure, so it stays quiet. */
export function Empty({ children }) {
  const { t } = useI18n();
  return (
    <div className="px-4 py-10 text-center text-sm text-ink-muted dark:text-ink-dark-muted">
      {children || t('common.empty')}
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-ink-muted dark:text-ink-dark-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-600 dark:border-line-dark dark:border-t-brand-300" />
      {label || t('common.loading')}
    </div>
  );
}

/* --------------------------------- back bar ------------------------------- */

/** Narrow-screen "back to the previous pane". Hidden on lg, where all three
 * panes are on screen at once and there is nothing to go back to. */
export function BackBar({ to, label }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-line bg-surface-alt/95 px-3 py-2.5 text-sm font-semibold text-brand-700 backdrop-blur lg:hidden dark:border-line-dark dark:bg-surface-dark-alt/95 dark:text-brand-300"
    >
      <Icon name="arrowleft" className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </button>
  );
}
