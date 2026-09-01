import { useState } from 'react';
import { useI18n } from '@vcb/shared';
import { DEPARTMENTS } from '../data/departments.js';
import { useContentText } from '../lib/contentText.js';

// Name + department, shown the first time a checklist task is touched.
// Ported from the original app's promptForEmployeeName (progress.html).
//
// This is the module's identity prompt, NOT a sign-in. See lib/identity.js —
// new hires reach this page before anyone has created an account for them, so
// asking them to authenticate here would lock out the people it exists for.

export default function NameModal({ onSubmit }) {
  const { t } = useI18n();
  const tc = useContentText();
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState(DEPARTMENTS[0]?.id ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-modal-title"
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
            if (!trimmed || !departmentId) return;
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

          <label className="sr-only" htmlFor="name-modal-dept">
            {t('name.selectDepartment')}
          </label>
          <select
            id="name-modal-dept"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-control border border-line bg-surface-card px-3 py-2 text-base outline-none focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {tc(d.label)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="mt-1 rounded-pill bg-accent px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 dark:bg-accent-dark dark:text-surface-dark"
          >
            {t('name.continue')}
          </button>
        </form>
      </div>
    </div>
  );
}
