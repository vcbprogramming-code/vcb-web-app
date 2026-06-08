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
 */
export default function Modal({ title, onClose, size = 'lg', footer, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`max-h-[90vh] w-full ${SIZES[size] || SIZES.lg} overflow-auto rounded-2xl bg-white shadow-xl`}>
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
