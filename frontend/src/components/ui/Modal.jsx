import { useEffect, useRef } from 'react';
import Icon from '../Icon.jsx';

const SIZES = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Centered modal shell (BTS style): dark backdrop, white rounded panel with a
 * sticky header + close button. Pass the body as children and a footer slot.
 * Handles Escape-to-close, backdrop-click-to-close, body scroll lock and a basic
 * focus trap so keyboard users can't tab into the page behind it.
 */
export default function Modal({ title, onClose, size = 'lg', footer, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // lock background scroll
    panelRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) { onClose(); return; }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      // close only on a click that starts AND is on the backdrop itself
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${SIZES[size] || SIZES.lg} overflow-auto rounded-2xl bg-white shadow-xl outline-none`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h3 className="font-bold text-slate-800">{title}</h3>
          {onClose && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="ปิด">
              <Icon name="x" className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="space-y-4 p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
