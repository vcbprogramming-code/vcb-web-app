// The small pieces every screen reuses: spinner, toast, busy veil, modal shell,
// badges, and the promise-returning confirm/prompt dialogs.
//
// Hand-written, per TECH_STACK.md — no UI kit. The old CSS gave these classes
// (.modal, .dbtn, .badge, .spin); the classes are gone and the styling lives on
// the elements as utilities, so a component can be read without cross-checking
// a stylesheet.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@vcb/shared';

/* --------------------------------- spinner -------------------------------- */

export function Spinner({ className = '', size = 13 }) {
  return (
    <span
      role="status"
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-line border-t-brand-900 dark:border-line-dark dark:border-t-brand-300 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** A centred "loading" block for a pane that has nothing to show yet. */
export function Loading({ label }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-10 text-center text-ink-muted dark:text-ink-dark-muted">
      <Spinner size={26} />
      <div>{label || t('state.loading')}</div>
    </div>
  );
}

/** An empty state, or a placeholder with a large glyph above it. */
export function Empty({ children, glyph, className = '' }) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-2.5 p-10 text-center text-ink-muted dark:text-ink-dark-muted ${className}`}
    >
      {glyph ? <div className="text-[40px] opacity-40">{glyph}</div> : null}
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------- busy / toast ----------------------------- */

/**
 * The blocking veil shown while a mutation runs.
 *
 * aria-live so a screen reader announces it: the visual cue is a dimmed page,
 * which conveys nothing without sight.
 */
export function Busy({ message }) {
  const t = useT();
  if (!message) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,20,28,.28)] backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl bg-[#1f2328] px-[22px] py-3.5 text-sm text-white shadow-[0_12px_40px_rgba(0,0,0,.35)]">
        <span className="inline-block h-[13px] w-[13px] animate-spin rounded-full border-2 border-white/40 border-t-white" />
        <span>{message === true ? t('state.working') : message}</span>
      </div>
    </div>
  );
}

export function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[22px] left-1/2 z-[95] -translate-x-1/2 rounded-3xl bg-[#1f2328] px-[18px] py-2.5 text-[13px] text-white transition-all duration-200 ${
        message ? 'translate-y-[-4px] opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
}

/* --------------------------------- buttons -------------------------------- */

const BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-control border px-[11px] py-[7px] text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const BTN_VARIANT = {
  default:
    'border-line bg-surface-card text-ink hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
  primary:
    'border-brand-600 bg-brand-600 text-white hover:bg-brand-700 dark:border-brand-600 dark:bg-brand-600',
  danger:
    'border-line bg-surface-card text-ink hover:border-danger/40 hover:bg-danger-bg hover:text-danger dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-danger/15 dark:hover:text-danger-dark',
  dangerSolid:
    'border-danger bg-danger text-white hover:bg-[#a5121f] hover:border-[#a5121f]',
  ghost:
    'border-transparent bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark-sunken dark:hover:text-ink-dark',
};

/** The one button in the app. `variant` picks its weight, never its own class. */
export function Button({ variant = 'default', className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`${BTN_BASE} ${BTN_VARIANT[variant] || BTN_VARIANT.default} ${className}`}
      {...rest}
    />
  );
}

/** A square icon-only button. Always needs an aria-label from the caller. */
export function IconButton({ className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-sm text-ink-muted transition-colors hover:border-line hover:bg-surface-sunken dark:text-ink-dark-muted dark:hover:border-line-dark dark:hover:bg-surface-dark-sunken ${className}`}
      {...rest}
    />
  );
}

/* --------------------------------- badges --------------------------------- */

const BADGE_TONE = {
  fathom: 'bg-pill-fathom text-pill-fathom-ink dark:bg-[#3a1d23] dark:text-[#ff7a85]',
  overview: 'bg-pill-overview text-pill-overview-ink dark:bg-[#1e2a40] dark:text-[#7aa2f7]',
  manual: 'bg-pill-manual text-pill-manual-ink dark:bg-[#1c2e23] dark:text-[#6dcf7e]',
  pin: 'bg-pill-pin text-pill-pin-ink dark:bg-[#3a2e16] dark:text-[#ffce62]',
  hidden: 'bg-pill-hidden text-pill-hidden-ink dark:bg-[#3a1d23] dark:text-[#ff7a85]',
  suggest: 'bg-pill-pin text-pill-pin-ink dark:bg-[#3a2e16] dark:text-[#ffce62]',
};

export function Badge({ tone = 'manual', className = '', children, ...rest }) {
  return (
    <span
      className={`shrink-0 rounded-pill px-[7px] py-px text-[10px] font-bold uppercase tracking-[.03em] ${
        BADGE_TONE[tone] || BADGE_TONE.manual
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

/** The project colour dot. Inline style because the colour is per-row data. */
export function Dot({ color, size = 10, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, background: color || '#888' }}
    />
  );
}

/* ---------------------------------- modal --------------------------------- */

/**
 * The modal shell.
 *
 * `onClose` fires on Escape and on a backdrop click. `dismissable={false}`
 * suppresses both — the content editor uses it, because an accidental click
 * outside must never silently discard an in-progress edit.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  width = 'max-w-[598px]',
  dismissable = true,
  bodyClassName = '',
}) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,28,.45)] p-4"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-card bg-surface-card shadow-[0_20px_60px_rgba(0,0,0,.3)] dark:bg-surface-dark-card`}
      >
        {title ? (
          <h3 className="shrink-0 border-b border-line px-5 py-4 text-base font-semibold text-ink dark:border-line-dark dark:text-ink-dark">
            {title}
          </h3>
        ) : null}
        {subtitle ? (
          <p className="shrink-0 px-5 pt-3 text-[12.5px] text-ink-muted dark:text-ink-dark-muted">
            {subtitle}
          </p>
        ) : null}
        <div className={`min-h-0 flex-1 overflow-auto px-5 py-4 ${bodyClassName}`}>{children}</div>
        {actions ? (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-5 py-3.5 dark:border-line-dark">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- form fields ------------------------------ */

const FIELD_CLASS =
  'w-full rounded-control border border-line bg-surface-card px-[11px] py-[9px] text-[13.5px] text-ink outline-none transition-shadow focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark';

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-ink-muted dark:text-ink-dark-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

// forwardRef because usePrompt focuses the field the moment its dialog opens —
// a prompt that needs a click before you can type is one people abandon.
export const TextInput = React.forwardRef(function TextInput({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`${FIELD_CLASS} ${className}`} {...rest} />;
});

export function TextArea({ className = '', ...rest }) {
  return <textarea className={`${FIELD_CLASS} min-h-[160px] resize-y ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }) {
  return <select className={`${FIELD_CLASS} ${className}`} {...rest} />;
}

/* --------------------------- confirm / prompt ----------------------------- */

/**
 * A promise-returning confirm dialog.
 *
 *   const { confirm, node } = useConfirm()
 *   if (await confirm(t('attach.removeHint'), { title: t('attach.removeTitle') })) …
 *   return <>{…}{node}</>
 *
 * Replaces window.confirm, which cannot be styled, cannot be translated, and is
 * suppressed outright by some browsers after a few uses.
 */
export function useConfirm() {
  const t = useT();
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (message, opts = {}) =>
      new Promise((resolve) => setState({ message, opts, resolve })),
    []
  );

  const settle = useCallback(
    (result) => {
      setState((s) => {
        s?.resolve(result);
        return null;
      });
    },
    []
  );

  const node = state ? (
    <Modal
      open
      onClose={() => settle(false)}
      title={state.opts.title || t('confirm.areYouSure')}
      width="max-w-[400px]"
      actions={
        <>
          <Button onClick={() => settle(false)}>{t('common.cancel')}</Button>
          <Button
            variant={state.opts.danger === false ? 'primary' : 'dangerSolid'}
            onClick={() => settle(true)}
            autoFocus
          >
            {state.opts.okLabel || t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-muted dark:text-ink-dark-muted">
        {state.message}
      </p>
    </Modal>
  ) : null;

  return { confirm, node };
}

/** The same shape, for a single free-text answer. Resolves null on cancel. */
export function usePrompt() {
  const t = useT();
  const [state, setState] = useState(null);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  const prompt = useCallback(
    (label, opts = {}) =>
      new Promise((resolve) => {
        setValue(opts.value || '');
        setState({ label, opts, resolve });
      }),
    []
  );

  const settle = useCallback((result) => {
    setState((s) => {
      s?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (state) inputRef.current?.focus();
  }, [state]);

  const node = state ? (
    <Modal
      open
      onClose={() => settle(null)}
      title={state.opts.title || t('confirm.enterValue')}
      width="max-w-[420px]"
      actions={
        <>
          <Button onClick={() => settle(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => settle(value)}>
            {state.opts.okLabel || t('common.ok')}
          </Button>
        </>
      }
    >
      <Field label={state.label}>
        <TextInput
          ref={inputRef}
          value={value}
          placeholder={state.opts.placeholder || ''}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              settle(e.currentTarget.value);
            }
          }}
        />
      </Field>
    </Modal>
  ) : null;

  return { prompt, node };
}
