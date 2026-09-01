// Hand-written UI primitives.
//
// TECH_STACK.md rules out MUI / Ant / shadcn / Bootstrap, so these are the
// module's own. They replace the .btn / .pill / .c / .ovl / .meter rules from
// the deleted src/styles.css, expressed as Tailwind utilities against the
// shared preset's tokens.

import React, { useEffect } from 'react';
import { useT } from '@vcb/shared';
import { KIND_PILL_CLASS } from '../lib/domain.js';

/* --------------------------------- button --------------------------------- */

const BUTTON_VARIANTS = {
  primary:
    'bg-brand-700 text-ink-invert hover:bg-brand-800 disabled:hover:bg-brand-700 shadow-card',
  ghost:
    'bg-surface-card text-ink border border-line hover:bg-surface-sunken ' +
    'dark:bg-surface-dark-card dark:text-ink-dark dark:border-line-dark dark:hover:bg-surface-dark-sunken',
  danger: 'bg-danger text-ink-invert hover:brightness-110',
  quiet:
    'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-sunken ' +
    'dark:text-ink-dark-muted dark:hover:text-ink-dark dark:hover:bg-surface-dark-sunken',
};

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={
        'focusable inline-flex items-center justify-center gap-1.5 rounded-control px-3.5 py-2 ' +
        'text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        `${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} ${className}`
      }
      {...rest}
    />
  );
}

/* ---------------------------------- pills --------------------------------- */

const STATUS_TONE = {
  new: 'bg-info-bg text-info-fg dark:bg-brand-900/50 dark:text-info-dark',
  pending: 'bg-warn-bg text-warn-fg dark:bg-warn/20 dark:text-warn-dark',
  approved: 'bg-ok-bg text-ok-fg dark:bg-ok/20 dark:text-ok-dark',
  rejected: 'bg-danger-bg text-danger-fg dark:bg-danger/20 dark:text-danger-dark',
};

const STATUS_DOT = {
  new: 'bg-info',
  pending: 'bg-warn',
  approved: 'bg-ok',
  rejected: 'bg-danger',
};

/** A status pill with its leading dot — the .pill.stp rule from styles.css. */
export function StatusPill({ tone = 'new', children }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-0.5 ' +
        `text-xs font-semibold ${STATUS_TONE[tone] || STATUS_TONE.new}`
      }
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-pill ${STATUS_DOT[tone] || STATUS_DOT.new}`} />
      {children}
    </span>
  );
}

/** The facility-kind pill (BG / T/L / B/E / P/N …). */
export function KindPill({ kind, children }) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-semibold ' +
        `${KIND_PILL_CLASS[kind] || KIND_PILL_CLASS.ML}`
      }
    >
      {children}
    </span>
  );
}

/* ---------------------------------- card ---------------------------------- */

export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={
        'rounded-card border border-line bg-surface-card shadow-card ' +
        `dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark ${className}`
      }
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------------------------------- meter --------------------------------- */

/**
 * The utilisation bar. Colour crosses to warn at 80% and to danger at 100%,
 * as the .meter i.hi / i.full rules did.
 */
export function Meter({ pct }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  const tone = value >= 100 ? 'bg-danger' : value >= 80 ? 'bg-warn' : 'bg-brand-600';
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken dark:bg-surface-dark-sunken"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-pill transition-[width] ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ---------------------------------- modal --------------------------------- */

/**
 * The overlay dialog. Escape closes it and the body scroll is locked while it
 * is open — both were global listeners in legacy.js, now scoped to the dialog
 * that owns them so two open dialogs cannot fight over the same handler.
 */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/50 p-4 animate-fade-in sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={
          'my-auto w-full rounded-card border border-line bg-surface-card shadow-card-hover ' +
          `dark:border-line-dark dark:bg-surface-dark-card ${wide ? 'max-w-4xl' : 'max-w-2xl'}`
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 dark:border-line-dark">
          <h3 className="text-base font-bold text-ink dark:text-ink-dark">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="focusable rounded-control px-2 py-1 text-lg leading-none text-ink-muted hover:bg-surface-sunken hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 dark:border-line-dark">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- confirm --------------------------------- */

export function ConfirmDialog({ open, message, okLabel, onOk, onCancel }) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('misc.confirm')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onOk}>{okLabel || t('common.ok')}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink dark:text-ink-dark">{message}</p>
    </Modal>
  );
}

/* --------------------------------- fields --------------------------------- */

export function Field({ label, required = false, hint, children, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-semibold text-ink-muted dark:text-ink-dark-muted">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
        {hint ? (
          <span className="ml-1 font-normal text-ink-muted dark:text-ink-dark-muted">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`field focusable ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`field focusable ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`field focusable resize-y ${className}`} {...rest} />;
}

/* --------------------------------- states --------------------------------- */

export function Empty({ children }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-ink-muted dark:text-ink-dark-muted">
      {children}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-ink-muted dark:text-ink-dark-muted">
      <span className="h-4 w-4 animate-spin rounded-pill border-2 border-line border-t-brand-600 dark:border-line-dark dark:border-t-accent-dark" />
      {label}
    </div>
  );
}

/** The transient confirmation message. */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-control bg-brand-900 px-4 py-2.5 text-sm font-semibold text-ink-invert shadow-card-hover animate-fade-in"
    >
      {message}
    </div>
  );
}
