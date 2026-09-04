import { useI18n } from '@vcb/shared';
import { useContentText } from '../lib/contentText.js';

// Blocks Department Selection until every required document is marked done.
// Ported from promptRequiredDocsIncomplete() in progress.html — same two
// exits: jump to Required Documents, or just close and stay put.
export default function RequiredDocsGateModal({ missing, onGoToDocs, onClose }) {
  const { t } = useI18n();
  const tc = useContentText();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-gate-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 shadow-card-hover dark:border-line-dark dark:bg-surface-dark-card">
        <h2 id="docs-gate-title" className="mb-2 text-xl font-bold">
          {t('doc.gateTitle')}
        </h2>
        <p className="mb-3 text-sm text-ink-subtle dark:text-ink-dark-muted">
          {t('doc.gateBody')}
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
          {missing.map((doc) => (
            <li key={doc.id}>{tc(doc.title)}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onGoToDocs}
            className="rounded-pill bg-accent px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 dark:bg-accent-dark dark:text-surface-dark"
          >
            {t('doc.gateGoTo')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-6 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
