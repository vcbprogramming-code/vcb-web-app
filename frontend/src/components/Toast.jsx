import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

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
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, variant = 'info', ttl = 3500) => {
    // no Date.now()/random needed — a monotonically increasing counter is enough
    const id = `${message}-${Math.floor(performance.now() * 1000)}`;
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
        {toasts.map((t) => {
          const v = VARIANTS[t.variant] || VARIANTS.info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 pl-0 shadow-lg ring-1 ${v.ring}`}
              role={t.variant === 'error' ? 'alert' : 'status'}
            >
              <span className={`h-full w-1 self-stretch ${v.bar}`} />
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${v.iconBg}`}>
                <Icon name={v.icon} className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <p className="flex-1 py-0.5 pr-1 text-sm text-slate-700">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="ปิด">
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
