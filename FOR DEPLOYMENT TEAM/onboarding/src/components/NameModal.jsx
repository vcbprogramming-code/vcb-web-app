import { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import { DEPARTMENTS } from '../data/departments.js';
import { useContentText } from '../lib/contentText.js';

// Name (+ department, when the page already knows it), shown the first time
// a checklist task is touched. Ported from the original app's
// promptForEmployeeName / promptForNameOnly (progress.html).
//
// This is the module's identity prompt, NOT a sign-in. See lib/identity.js —
// new hires reach this page before anyone has created an account for them, so
// asking them to authenticate here would lock out the people it exists for.
//
// THE DEPARTMENT FIELD IS NOT ALWAYS THERE
//
// A pre-boarding action (Required Documents, say) happens before Department
// Selection in the journey — the original's promptForNameOnly() asked for a
// name only there, "since requiring a department this early would force that
// step out of order." Once a page IS already scoped to a department (a phase
// page under /finance-day-1-30, say), the original pre-filled and locked that
// field instead of asking blind (departmentFromTaskId()) — the person is not
// choosing here, they are confirming what the page already knows.
//
// Pass knownDepartmentId for that second case. For the pre-boarding, name-
// only case, pass NEITHER prop — the department question does not belong on
// that page at all, not even as an open choice.
export default function NameModal({ onSubmit, onCancel, knownDepartmentId }) {
  const { t } = useI18n();
  const tc = useContentText();
  const [name, setName] = useState('');
  // '' when there is no known department — never DEPARTMENTS[0], which would
  // silently submit a made-up department for the name-only case below.
  const [departmentId, setDepartmentId] = useState(knownDepartmentId || '');
  // Only the phase-page case (knownDepartmentId set) shows the field at all —
  // pre-filled from route context, matching the original's
  // departmentFromTaskId() pre-fill. There is currently no caller that wants
  // an OPEN department choice at this modal; RequiredDocuments passes neither
  // prop and gets name-only, exactly as promptForNameOnly() did.
  const askDepartment = Boolean(knownDepartmentId);

  useEffect(() => {
    if (!onCancel) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-modal-title"
      onMouseDown={(e) => {
        if (onCancel && e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card">
        <h2 id="name-modal-title" className="mb-4 text-xl font-bold">
          {t('name.title')}
        </h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            if (askDepartment && !departmentId) return;
            onSubmit(trimmed, departmentId);
          }}
        >
          {/* Visually-hidden labels: a placeholder is not an accessible name,
              so without these the inputs announce as unlabelled. */}
          <label className="sr-only" htmlFor="name-modal-input">
            {t('name.fullName')}
          </label>
          <input
            id="name-modal-input"
            type="text"
            placeholder={t('name.fullName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-control border border-line bg-surface-card px-3 py-2 text-base outline-none focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken"
          />

          {askDepartment ? (
            <>
              <label className="sr-only" htmlFor="name-modal-dept">
                {t('name.selectDepartment')}
              </label>
              <select
                id="name-modal-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                // Locked, matching the original: the page already knows its
                // department (departmentFromTaskId()) — showing an editable
                // select here would read as a choice that changing it here
                // does nothing to honour.
                disabled={Boolean(knownDepartmentId)}
                className="w-full rounded-control border border-line bg-surface-card px-3 py-2 text-base outline-none focus:border-brand-600 focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-70 dark:border-line-dark dark:bg-surface-dark-sunken"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {tc(d.label)}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <button
            type="submit"
            className="mt-1 rounded-pill bg-accent px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 dark:bg-accent-dark dark:text-surface-dark"
          >
            {t('name.continue')}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-pill px-6 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
            >
              {t('name.cancel')}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
