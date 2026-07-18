import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './ui/index.js';
import Icon from './Icon.jsx';

const ConfirmContext = createContext(null);

/**
 * App-styled confirmation dialog (replaces the browser's unstyled window.confirm).
 * Usage:  const confirm = useConfirm();
 *         if (await confirm({ title, message, confirmLabel, danger })) { … }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({
      title: opts.title || 'ยืนยันการทำรายการ',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel || 'ยืนยัน',
      cancelLabel: opts.cancelLabel || 'ยกเลิก',
      danger: opts.danger !== false, // destructive styling by default
    });
  }), []);

  const close = (result) => {
    setState(null);
    if (resolver.current) { resolver.current(result); resolver.current = null; }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.title}
          onClose={() => close(false)}
          size="md"
          footer={
            <>
              <button onClick={() => close(false)} className="btn-outline">{state.cancelLabel}</button>
              <button
                onClick={() => close(true)}
                className={state.danger
                  ? 'inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700'
                  : 'btn-primary'}
              >
                {state.confirmLabel}
              </button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            {state.danger && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Icon name="warning" className="h-5 w-5" />
              </span>
            )}
            <p className="whitespace-pre-line text-sm text-slate-600">{state.message}</p>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
