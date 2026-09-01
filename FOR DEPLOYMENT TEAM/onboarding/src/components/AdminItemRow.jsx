import { useState } from 'react';
import { useI18n } from '@vcb/shared';

// One editable checklist item in the admin editor.
//
// No password prop any more — see the header of pages/AdminPage.jsx. The
// caller's JWT authorises the write and the API enforces the role, so this
// component only needs to know what to save.
//
// Draft text is local state, committed on Save. The parent gives each row a
// key that includes the page key, so switching department or phase remounts
// the row and the draft resets to the new item rather than carrying the
// previous one's text over.

export default function AdminItemRow({
  itemId,
  text,
  isSenior,
  pageKey,
  blockIndex,
  onSave,
  onDelete,
}) {
  const { t } = useI18n();
  const [draftText, setDraftText] = useState(text);
  const [draftSenior, setDraftSenior] = useState(isSenior);
  // 'saving' | 'saved' | 'failed' | null — a state, not a prose string, so it
  // renders in the reader's language.
  const [status, setStatus] = useState(null);

  async function handleSave() {
    setStatus('saving');
    try {
      await onSave(itemId, {
        pageKey,
        blockIndex,
        text: draftText,
        level: draftSenior ? 'senior' : 'junior',
      });
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
    setTimeout(() => setStatus(null), 2500);
  }

  async function handleDelete() {
    if (!confirm(t('admin.deleteConfirm'))) return;
    try {
      await onDelete(itemId);
    } catch {
      setStatus('failed');
      setTimeout(() => setStatus(null), 2500);
    }
  }

  const statusText =
    status === 'saving'
      ? t('common.saving')
      : status === 'saved'
        ? t('common.saved')
        : status === 'failed'
          ? t('admin.saveFailed')
          : null;

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface-card p-4 shadow-card dark:border-line-dark dark:bg-surface-dark-card md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-2">
        <textarea
          rows={2}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          aria-label={itemId}
          className="w-full resize-y rounded-control border border-line bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600 focus:shadow-focus dark:border-line-dark dark:bg-surface-dark-sunken"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draftSenior}
            onChange={(e) => setDraftSenior(e.target.checked)}
            className="h-4 w-4 accent-accent dark:accent-accent-dark"
          />
          {t('admin.seniorOnly')}
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving'}
          className="rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-accent-dark dark:text-surface-dark"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-control border border-danger/40 px-3 py-1.5 text-sm font-semibold text-danger dark:border-danger-dark/40 dark:text-danger-dark"
        >
          {t('common.delete')}
        </button>
        {statusText && (
          <span
            role="status"
            className={[
              'text-xs',
              status === 'failed'
                ? 'text-danger dark:text-danger-dark'
                : 'text-ink-muted dark:text-ink-dark-muted',
            ].join(' ')}
          >
            {statusText}
          </span>
        )}
      </div>
    </li>
  );
}
