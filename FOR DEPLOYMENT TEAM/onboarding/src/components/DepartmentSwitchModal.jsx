import { useI18n } from '@vcb/shared';
import { DEPARTMENTS } from '../data/departments.js';
import { useContentText } from '../lib/contentText.js';

// Ported from promptDepartmentSwitchConfirm() in progress.html — an employee
// can only be onboarding in one department at a time, so switching to a new
// one permanently deletes whatever progress they made in the old one. This
// asks first, every time, rather than doing it silently.
export default function DepartmentSwitchModal({ fromDeptId, toDeptId, onConfirm, onCancel }) {
  const { t } = useI18n();
  const tc = useContentText();
  const fromLabel = DEPARTMENTS.find((d) => d.id === fromDeptId)?.label || fromDeptId;
  const toLabel = DEPARTMENTS.find((d) => d.id === toDeptId)?.label || toDeptId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dept-switch-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card">
        <h2 id="dept-switch-title" className="mb-2 text-xl font-bold">
          {t('dept.switchTitle')}
        </h2>
        <p className="mb-4 text-sm text-ink-subtle dark:text-ink-dark-muted">
          {t('dept.switchBody', { from: tc(fromLabel), to: tc(toLabel) })}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-pill bg-danger px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 dark:bg-danger-dark"
          >
            {t('dept.switchConfirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill px-6 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
          >
            {t('dept.switchCancel', { from: tc(fromLabel) })}
          </button>
        </div>
      </div>
    </div>
  );
}
