import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../lib/i18n.jsx';

const ToastContext = createContext(null);

// module-level sequence → every toast id is unique. (performance.now() is clamped
// to ms in most browsers, so two same-message toasts in one tick collided → duplicate
// React keys and a shared dismiss timer removing both.) (#D7)
let toastSeq = 0;

const VARIANTS = {
  success: { icon: 'check', ring: 'ring-emerald-200', bar: 'bg-emerald-500', iconBg: 'bg-emerald-50 text-emerald-600' },
  error: { icon: 'x', ring: 'ring-red-200', bar: 'bg-red-500', iconBg: 'bg-red-50 text-red-600' },
  info: { icon: 'warning', ring: 'ring-blue-200', bar: 'bg-brand', iconBg: 'bg-brand-tint text-brand' },
};

/**
 * Minimal toast system: wrap the app in <ToastProvider> and call
 * `const toast = useToast()` then `toast.success('บันทึกแล้ว')`. Toasts stack at
 * the top-right and auto-dismiss. No dependencies.
 */
export function ToastProvider({ children }) {
  const t = useT();
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, variant = 'info', ttl = 3500) => {
    const id = `toast-${++toastSeq}`;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  const api = {
    success: (m, ttl) => push(m, 'success', ttl),
    // errors linger longer so a user who glances away doesn't miss them
    error: (m, ttl) => push(m, 'error', ttl ?? 6500),
    info: (m, ttl) => push(m, 'info', ttl),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((n) => {
          const v = VARIANTS[n.variant] || VARIANTS.info;
          return (
            <div
              key={n.id}
              className={`pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 pl-0 shadow-lg ring-1 ${v.ring}`}
              role={n.variant === 'error' ? 'alert' : 'status'}
            >
              <span className={`h-full w-1 self-stretch ${v.bar}`} />
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${v.iconBg}`}>
                <Icon name={v.icon} className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <p className="flex-1 py-0.5 pr-1 text-sm text-slate-700">{n.message}</p>
              <button onClick={() => dismiss(n.id)} className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={t('ปิด')}>
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
