import { useEffect } from 'react';

// The handful of controls both modals need, hand-written.
//
// TECH_STACK.md rules out UI kits, and these are small enough that a kit would
// cost more than it saves. Keeping them here rather than repeating the class
// strings in every file is what stops the buttons drifting apart.

/* --------------------------------- button --------------------------------- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-control border px-3.5 py-2 ' +
  'text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

const BTN_VARIANTS = {
  default:
    'border-line bg-surface-card text-ink hover:bg-surface-sunken ' +
    'dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken',
  primary:
    'border-transparent bg-accent text-white hover:bg-accent-light ' +
    'dark:bg-accent-dark dark:text-surface-dark dark:hover:bg-accent-glow',
  danger: 'border-transparent bg-danger text-white hover:opacity-90',
  ghostDanger:
    'border-transparent bg-transparent text-danger hover:bg-danger-bg ' +
    'dark:text-danger-dark dark:hover:bg-danger/15',
};

export function Button({ variant = 'default', className = '', ...rest }) {
  return <button className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`} {...rest} />;
}

/** A small square icon button — topbar, banner dismiss, calendar arrows. */
export function IconButton({ className = '', ...rest }) {
  return (
    <button
      className={
        'inline-grid h-9 w-9 place-items-center rounded-control border border-line ' +
        'bg-surface-card text-ink-muted transition-colors hover:text-ink ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
        'dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark-muted dark:hover:text-ink-dark ' +
        className
      }
      {...rest}
    />
  );
}

/* --------------------------------- fields --------------------------------- */

export const LABEL_CLASS =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-dark-muted';

const CONTROL_CLASS =
  'w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-muted/70 focus:border-accent focus:outline-none focus:ring-2 ' +
  'focus:ring-accent/20 dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark ' +
  'dark:placeholder:text-ink-dark-muted/70 dark:focus:border-accent-dark dark:focus:ring-accent-dark/20';

export function TextField({ label, id, className = '', ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label className={LABEL_CLASS} htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={CONTROL_CLASS} {...rest} />
    </div>
  );
}

export function TextArea({ label, id, className = '', rows = 4, ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label className={LABEL_CLASS} htmlFor={id}>
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className={`${CONTROL_CLASS} resize-y`} {...rest} />
    </div>
  );
}

export function SelectField({ label, id, className = '', children, ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label className={LABEL_CLASS} htmlFor={id}>
          {label}
        </label>
      )}
      <select id={id} className={CONTROL_CLASS} {...rest}>
        {children}
      </select>
    </div>
  );
}

/* -------------------------------- messages -------------------------------- */

/**
 * The inline status line under a form. `tone` is '' | 'ok' | 'err'.
 * Renders nothing rather than an empty box when there is no text, so the
 * layout does not jump as messages come and go.
 */
export function Message({ text, tone = '' }) {
  if (!text) return null;
  const toneClass =
    tone === 'err'
      ? 'text-danger dark:text-danger-dark'
      : tone === 'ok'
        ? 'text-ok-fg dark:text-ok-dark'
        : 'text-ink-muted dark:text-ink-dark-muted';
  return (
    <p className={`mt-3 text-sm ${toneClass}`} role={tone === 'err' ? 'alert' : 'status'}>
      {text}
    </p>
  );
}

/* --------------------------------- modal ---------------------------------- */

/**
 * A centred dialog over a scrim. Escape and a backdrop click both close it;
 * the page behind is locked from scrolling while it is open.
 *
 * Unmounts when closed rather than toggling an [open] attribute, as the old
 * CSS did — there is no exit animation to wait for here, and an unmounted
 * dialog cannot be reached by tab.
 */
export function Modal({ open, onClose, labelledBy, children, className = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind scrolling under the dialog.
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 animate-fade-in backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-line ' +
          'bg-surface-card p-6 shadow-card-hover dark:border-line-dark ' +
          'dark:bg-surface-dark-card dark:shadow-card-dark ' +
          className
        }
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ id, children }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-ink dark:text-ink-dark">
      {children}
    </h2>
  );
}

export function ModalSub({ children }) {
  return <p className="mt-1.5 text-sm text-ink-muted dark:text-ink-dark-muted">{children}</p>;
}

export function ModalActions({ children }) {
  return <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>;
}

/* ---------------------------------- card ---------------------------------- */

/** The surface every panel sits on. */
export const CARD_CLASS =
  'rounded-card border border-line bg-surface-card shadow-card ' +
  'dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark';

export function Panel({ className = '', children, ...rest }) {
  return (
    <section className={`${CARD_CLASS} p-5 ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function PanelHead({ children }) {
  return <div className="mb-3 flex items-center justify-between gap-3">{children}</div>;
}

export function PanelTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted dark:text-ink-dark-muted">
      {children}
    </h3>
  );
}
