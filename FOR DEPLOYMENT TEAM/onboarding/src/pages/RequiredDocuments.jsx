import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@vcb/shared';
import { REQUIRED_DOCUMENTS } from '../data/requiredDocuments.js';
import { ALL_DEPARTMENTS } from '../data/allDepartments.js';
import { useProgress } from '../lib/useProgress.js';
import { useDocUpload } from '../lib/useDocUpload.js';
import { useContentText } from '../lib/contentText.js';
import { ErrorBanner, Page, PageTitle } from '../components/ui.jsx';
import NameModal from '../components/NameModal.jsx';

// Ported from the original app's PAGES['required-documents'] (content.html) —
// the doc list plus the Department Selection grid, which lived on one page.
//
// Document "Complete" checkboxes and "Upload" buttons both write a progress
// row with a "doc::<id>" task id, matching the original's REQUIRED_DOC_IDS
// convention: either action marks the same task done.

export default function RequiredDocuments() {
  const { isTaskDone, toggleTask, name, identify } = useProgress();
  const { t } = useI18n();
  const tc = useContentText();

  // Same pattern as PhasePage: an anonymous employee reaching this page
  // before any phase page has no way to set their name, so Complete/Upload
  // were permanently disabled here. Intercept the action, collect the name,
  // then finish what was asked for.
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [pendingUploadDocId, setPendingUploadDocId] = useState(null);

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

  function handleToggle(taskId) {
    if (!name) {
      setPendingTaskId(taskId);
      return;
    }
    toggleTask(taskId);
  }

  function handleUploadClick(docId) {
    if (!name) {
      setPendingUploadDocId(docId);
      return;
    }
    triggerUpload(docId);
  }

  async function handleNameSubmit(employeeName, departmentId) {
    await identify(employeeName, departmentId);
    if (pendingTaskId) {
      toggleTask(pendingTaskId);
      setPendingTaskId(null);
    }
    if (pendingUploadDocId) {
      triggerUpload(pendingUploadDocId);
      setPendingUploadDocId(null);
    }
  }

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
                'flex flex-col overflow-hidden rounded-card border shadow-card transition-colors dark:shadow-card-dark',
                done
                  ? 'border-ok/60 dark:border-ok-dark/60'
                  : 'border-line dark:border-line-dark',
              ].join(' ')}
            >
              <div className="flex items-start gap-3 bg-surface-card p-4 dark:bg-surface-dark-card">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="mt-0.5 h-5 w-5 shrink-0 text-accent dark:text-accent-dark"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 2.5h6.5L16 7v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 2.5V7H16" />
                </svg>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold">{tc(doc.title)}</h3>
                  <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
                    {tc(doc.desc)}
                  </p>
                </div>
                {/* The document's own action ("View Application Form", "View
                    Employment Contract" — per-document text, not a generic
                    label) as a compact arrow rather than a full sentence, so
                    the title row stays one line. The footer's Download button
                    below points at the same file. */}
                {doc.viewUrl && (
                  <a
                    href={doc.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={tc(doc.action)}
                    aria-label={tc(doc.action)}
                    className="mt-0.5 shrink-0 text-accent hover:opacity-75 dark:text-accent-dark"
                  >
                    →
                  </a>
                )}
              </div>

              <div
                className={[
                  'flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3',
                  done
                    ? 'border-ok/30 bg-ok/10 dark:border-ok-dark/30 dark:bg-ok-dark/10'
                    : 'border-line bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-sunken',
                ].join(' ')}
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => handleToggle(taskId)}
                    className="h-4 w-4 accent-ok dark:accent-ok-dark"
                  />
                  <span
                    className={done ? 'text-ok dark:text-ok-dark' : 'text-ink-muted dark:text-ink-dark-muted'}
                  >
                    {t('doc.complete')}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {doc.viewUrl && (
                    <a
                      href={doc.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-control border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:hover:bg-surface-dark-sunken"
                    >
                      {t('doc.download')}
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={uploadingDocId === doc.id}
                    onClick={() => handleUploadClick(doc.id)}
                    className="rounded-control border border-line bg-surface-card px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 dark:border-line-dark dark:bg-surface-dark-card dark:hover:bg-surface-dark-sunken"
                  >
                    {uploadingDocId === doc.id ? t('doc.uploading') : t('doc.upload')}
                  </button>
                </div>
              </div>

              {receipt && (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
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

      {(pendingTaskId || pendingUploadDocId) && (
        <NameModal
          onSubmit={handleNameSubmit}
          onCancel={() => {
            setPendingTaskId(null);
            setPendingUploadDocId(null);
          }}
        />
      )}
    </Page>
  );
}
