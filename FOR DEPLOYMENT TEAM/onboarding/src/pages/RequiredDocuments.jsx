import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { REQUIRED_DOCUMENTS } from '../data/requiredDocuments.js';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useProgress } from '../lib/useProgress.js';
import { useDocUpload } from '../lib/useDocUpload.js';
import { useContentText } from '../lib/contentText.js';
import { ErrorBanner, Page, PageTitle } from '../components/ui.jsx';

// Ported from the original app's PAGES['required-documents'] (content.html) —
// the doc list plus the Department Selection grid, which lived on one page.
//
// Document "Complete" checkboxes and "Upload" buttons both write a progress
// row with a "doc::<id>" task id, matching the original's REQUIRED_DOC_IDS
// convention: either action marks the same task done.

export default function RequiredDocuments() {
  const { isTaskDone, toggleTask, name } = useProgress();
  const { t } = useI18n();
  const tc = useContentText();

  // Per-employee upload receipts, localStorage only and deliberately so: the
  // authoritative copy is the object in Supabase Storage, and this only lets
  // the employee confirm what they actually sent. Keyed by name so switching
  // identity does not surface someone else's uploads.
  const receiptsKey = `vcb-uploaded-docs::${(name ?? '').trim().toLowerCase()}`;
  const [uploaded, setUploaded] = useState({});
  useEffect(() => {
    try {
      setUploaded(JSON.parse(localStorage.getItem(receiptsKey) || '{}'));
    } catch {
      setUploaded({});
    }
  }, [receiptsKey]);

  const handleUploaded = useCallback(
    (docId, info) => {
      if (!isTaskDone(`doc::${docId}`)) toggleTask(`doc::${docId}`);
      setUploaded((prev) => {
        const next = { ...prev, [docId]: info };
        try {
          localStorage.setItem(receiptsKey, JSON.stringify(next));
        } catch {
          /* storage blocked — the receipt is a convenience, not the record */
        }
        return next;
      });
    },
    [isTaskDone, toggleTask, receiptsKey]
  );

  const { triggerUpload, uploadingDocId, uploadError, dismissUploadError } = useDocUpload(
    name,
    handleUploaded
  );

  return (
    <Page>
      <PageTitle>{t('nav.requiredDocuments')}</PageTitle>
      <p className="text-ink-subtle dark:text-ink-dark-muted">{t('doc.intro')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const taskId = `doc::${doc.id}`;
          const done = isTaskDone(taskId);
          const receipt = uploaded[doc.id];
          return (
            <div
              key={doc.id}
              className={[
                'flex flex-col gap-3 rounded-card border bg-surface-card p-4 shadow-card transition-colors dark:bg-surface-dark-card dark:shadow-card-dark',
                done
                  ? 'border-ok/50 dark:border-ok-dark/50'
                  : 'border-line dark:border-line-dark',
              ].join(' ')}
            >
              <div>
                <h3 className="text-base font-bold">{tc(doc.title)}</h3>
                <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
                  {tc(doc.desc)}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3">
                {doc.viewUrl && (
                  <a
                    href={doc.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-accent underline underline-offset-2 dark:text-accent-dark"
                  >
                    {tc(doc.action)}
                  </a>
                )}
                <button
                  type="button"
                  disabled={!name || uploadingDocId === doc.id}
                  onClick={() => triggerUpload(doc.id)}
                  className="rounded-control border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 dark:border-line-dark dark:hover:bg-surface-dark-sunken"
                >
                  {uploadingDocId === doc.id ? t('doc.uploading') : t('doc.upload')}
                </button>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={!name}
                    onChange={() => toggleTask(taskId)}
                    className="h-4 w-4 accent-accent dark:accent-accent-dark"
                  />
                  {t('doc.complete')}
                </label>
              </div>

              {receipt && (
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  <span className="font-semibold">{t('doc.youUploaded')}:</span>{' '}
                  {receipt.url ? (
                    <a
                      href={receipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {receipt.fileName}
                    </a>
                  ) : (
                    receipt.fileName
                  )}{' '}
                  <span className="opacity-75">{t('doc.replaceHint')}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {uploadError && (
        <ErrorBanner onDismiss={dismissUploadError} dismissLabel={t('progress.dismiss')}>
          {t(uploadError)}
        </ErrorBanner>
      )}

      {!name && (
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{t('doc.nameFirst')}</p>
      )}

      <div>
        <h2 className="text-2xl font-bold">{t('doc.departmentSelection')}</h2>
        <p className="mt-1 text-ink-subtle dark:text-ink-dark-muted">
          {t('doc.departmentSelectionSub')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_DEPARTMENTS.map((dept) => (
          <Link
            key={dept.id}
            to={`/${dept.landingPageKey}`}
            className="rounded-card border border-line bg-surface-card p-4 font-semibold shadow-card transition-colors hover:border-accent hover:text-accent dark:border-line-dark dark:bg-surface-dark-card dark:hover:border-accent-dark dark:hover:text-accent-dark"
          >
            {tc(dept.content.title)}
          </Link>
        ))}
      </div>
    </Page>
  );
}
