// The controls this module repeats. Hand-written: TECH_STACK.md rules out UI
// kits, and keeping the class strings here rather than inline in six files is
// what stops the buttons drifting apart.

import React from 'react';
import { useI18n } from '@vcb/shared';

/* --------------------------------- buttons -------------------------------- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-control border px-3.5 py-2 ' +
  'text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40';

const BTN_VARIANTS = {
  primary:
    'border-transparent bg-brand-700 text-white hover:bg-brand-800 ' +
    'dark:bg-brand-600 dark:hover:bg-brand-500',
  default:
    'border-line bg-surface-card text-ink hover:bg-surface-sunken ' +
    'dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
  danger:
    'border-line bg-surface-card text-danger hover:bg-danger-bg ' +
    'dark:border-line-dark dark:bg-surface-dark-card dark:text-danger-dark dark:hover:bg-danger/15',
};

export function Button({ variant = 'default', className = '', ...rest }) {
  return <button className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`} {...rest} />;
}

/* ---------------------------------- cards --------------------------------- */

export function Card({ className = '', children, style }) {
  return (
    <div
      style={style}
      className={
        // min-w-0: a Card is almost always a grid/flex item, and those default
        // to min-width:auto - they refuse to shrink below their content. A card
        // holding a wide table therefore forced the whole PAGE to scroll
        // sideways on a phone, carrying the header and nav off screen, instead
        // of letting the table own scroll container do the scrolling.
        'min-w-0 rounded-card border border-line bg-surface-card p-4 shadow-card ' +
        'dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark ' +
        className
      }
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-bold text-ink dark:text-ink-dark">{title}</h1>
        {sub && <p className="m-0 text-sm text-ink-muted dark:text-ink-dark-muted">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-end gap-3">{children}</div>}
    </Card>
  );
}

/* --------------------------------- fields --------------------------------- */

export const LABEL_CLASS =
  'mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted';

export const CONTROL_CLASS =
  'w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-muted/70 focus:border-brand-600 focus:outline-none focus:ring-2 ' +
  'focus:ring-brand-600/20 disabled:opacity-50 ' +
  'dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark ' +
  'dark:placeholder:text-ink-dark-muted/70';

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className={LABEL_CLASS}>{label}</span>}
      {children}
    </label>
  );
}

export function TextInput({ className = '', ...rest }) {
  return <input className={`${CONTROL_CLASS} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`${CONTROL_CLASS} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* -------------------------------- segmented ------------------------------- */

/**
 * A segmented control: two or three mutually exclusive choices, all visible.
 * Used wherever a <select> of three options would be more clicks than reading.
 */
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div
      className={
        'inline-flex rounded-control border border-line bg-surface-sunken p-0.5 ' +
        'dark:border-line-dark dark:bg-surface-dark-sunken ' +
        className
      }
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={
            'rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors ' +
            (value === v
              ? 'bg-surface-card text-brand-700 shadow-card dark:bg-surface-dark-card dark:text-brand-300'
              : 'text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark')
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- tabs ---------------------------------- */

export function Tabs({ value, onChange, tabs, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-1 border-b border-line dark:border-line-dark ${className}`}>
      {tabs.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-selected={value === id}
          role="tab"
          className={
            'relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
            (value === id
              ? 'border-brand-700 text-brand-700 dark:border-brand-300 dark:text-brand-300'
              : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark')
          }
        >
          {label}
          {count > 0 && (
            <span className="rounded-pill bg-surface-sunken px-1.5 text-xs font-semibold text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- pills ---------------------------------- */

/** OP / SUP beside a name — the employee's kind, at a glance in a dense grid. */
export function KindPill({ kind }) {
  const op = kind === 'operation';
  return (
    <span
      className={
        'mr-1.5 inline-block rounded-pill px-1.5 py-0.5 text-[0.65rem] font-bold leading-none ' +
        (op
          ? 'bg-info-bg text-info-fg dark:bg-info/20 dark:text-info-dark'
          : 'bg-warn-bg text-warn-fg dark:bg-warn/20 dark:text-warn-dark')
      }
    >
      {op ? 'OP' : 'SUP'}
    </span>
  );
}

/* -------------------------------- messages -------------------------------- */

/**
 * A transient message.
 *
 *   ok     it worked
 *   warn   a business rule said no — nothing is broken. The edit-window
 *          refusal (403 OUTSIDE_EDIT_WINDOW) lands here rather than in `error`,
 *          because painting a working rule red is what sends people to IT.
 *   error  an actual failure
 */
const FLASH_TONES = {
  ok: 'border-ok/30 bg-ok-bg text-ok-fg dark:bg-ok/15 dark:text-ok-dark',
  warn: 'border-warn/30 bg-warn-bg text-warn-fg dark:bg-warn/15 dark:text-warn-dark',
  error: 'border-danger/30 bg-danger-bg text-danger-fg dark:bg-danger/15 dark:text-danger-dark',
};

export function Flash({ kind = 'ok', children }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className={`rounded-control border px-3 py-2 text-sm font-medium ${FLASH_TONES[kind] ?? FLASH_TONES.ok}`}
    >
      {children}
    </div>
  );
}

export function Empty({ icon, title, children }) {
  return (
    <Card className="py-12 text-center">
      {icon && <div className="mb-2 text-4xl leading-none">{icon}</div>}
      <h2 className="m-0 text-lg font-bold text-ink dark:text-ink-dark">{title}</h2>
      {children && (
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted dark:text-ink-dark-muted">
          {children}
        </p>
      )}
    </Card>
  );
}

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-ink-muted dark:text-ink-dark-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-700 dark:border-line-dark dark:border-t-brand-300"
      />
      {label || t('common.loading')}
    </div>
  );
}

export const Hint = ({ children, className = '' }) => (
  <span className={`text-xs text-ink-muted dark:text-ink-dark-muted ${className}`}>{children}</span>
);
