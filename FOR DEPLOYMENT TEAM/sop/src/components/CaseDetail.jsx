/**
 * Right pane for one case: problem, procedure, note, reference, attachments.
 */

import { useState } from 'react';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { classifyStep } from '../lib/steps.js';
import { moduleColor } from '../data/config.js';
import { STATUS, useStore } from '../store.jsx';
import { BackBar, Button, Empty, Spinner } from './ui.jsx';
import ShareButton from './ShareButton.jsx';
import EditCaseModal from './EditCaseModal.jsx';

/**
 * The ordered procedure.
 *
 * Numbered lines are counted by CSS (see .steps in index.css) rather than by
 * their literal "N." prefix: the displayed number must follow the position
 * among numbered lines, so that inserting a step does not require renumbering
 * every line after it. Sub-bullets and captions sit in the same list to keep
 * document order but do not advance the counter.
 */
function Steps({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <ol className="steps">
      {steps.map((line, i) => {
        const st = classifyStep(line);
        if (st.kind === 'caption') {
          return (
            <li key={i} className="pt-1 text-[13px] font-semibold text-ink-muted break-thai dark:text-ink-dark-muted">
              {st.text}
            </li>
          );
        }
        if (st.kind === 'sub') {
          // Depth 1 and 2 indent; deeper is clamped, as the canonical app did.
          const indent = ['ml-9', 'ml-14', 'ml-[4.5rem]'][Math.min(st.depth, 3) - 1];
          return (
            <li
              key={i}
              className={`${indent} relative pl-4 text-[13px] leading-relaxed text-ink-subtle break-thai before:absolute before:left-0 before:text-ink-muted before:content-['»'] dark:text-ink-dark-muted`}
            >
              {st.text}
            </li>
          );
        }
        return (
          <li key={i} className="step-n text-sm leading-relaxed break-thai">
            {st.text}
          </li>
        );
      })}
    </ol>
  );
}

/** Drive file id out of the usual link shapes; '' for a non-Drive URL. */
function driveFileId(url) {
  const u = String(url || '');
  const m =
    u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ||
    u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : '';
}

/** Related files. Links only — the app never holds the file itself. */
function Attachments({ items }) {
  const { t } = useI18n();
  const atts = items || [];
  return (
    <aside className="rounded-card border border-line bg-surface-sunken p-3.5 dark:border-line-dark dark:bg-surface-dark-sunken">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
        {t('detail.attachments')}
      </h4>
      {atts.length === 0 ? (
        <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{t('detail.attachmentsNone')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {atts.map((a, i) => {
            const id = driveFileId(a.url);
            const label = a.label && a.label !== a.url ? a.label : t('detail.attachmentsFile');
            return (
              <li key={i}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="flex items-center gap-2 rounded-control border border-line bg-surface-card px-2.5 py-2 text-[13px] text-ink hover:border-brand-500 dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark"
                >
                  {id ? (
                    <img
                      src={`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200`}
                      alt=""
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded object-cover"
                      // A Drive thumbnail 404s for a file the reader cannot
                      // open. Hide the broken image rather than show a torn
                      // icon; the label still links.
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Icon name="link" className="h-4 w-4 shrink-0 text-ink-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate break-thai">{label}</span>
                  <Icon name="externalLink" className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function CaseDetail({ no }) {
  const { t, lang } = useI18n();
  const { scenarios, status, canEdit } = useStore();
  const [editing, setEditing] = useState(false);

  if (status === STATUS.loading) return <Spinner />;

  const sc = scenarios.find((x) => x.no === no);
  if (!sc) {
    return (
      <div>
        <BackBar label={t('detail.backList')} />
        <Empty>{t('error.NOT_FOUND')}</Empty>
      </div>
    );
  }

  const primary = lang === 'en' && sc.titleEN ? sc.titleEN : sc.titleTH;
  const secondary = lang === 'en' && sc.titleEN ? sc.titleTH : sc.titleEN || '';

  return (
    <div style={{ '--mc': moduleColor(sc.module) }}>
      <BackBar label={t('detail.backList')} />

      <article className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-start gap-3 border-b border-line pb-4 dark:border-line-dark">
          <span className="mc-bg shrink-0 rounded-control px-2.5 py-1 text-sm font-extrabold text-white">
            {sc.displayNo || sc.no}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-snug break-thai">{primary}</h1>
            {secondary && (
              <p className="mt-0.5 text-[13px] text-ink-muted break-thai dark:text-ink-dark-muted">
                {secondary}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton path={`/cases/${sc.no}`} />
            {canEdit && (
              <Button onClick={() => setEditing(true)}>
                <Icon name="edit" className="h-4 w-4" />
                <span className="hidden sm:inline">{t('detail.edit')}</span>
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0">
            <section className="mb-5">
              <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-warn-fg dark:text-warn-dark">
                {t('detail.problem')}
              </h2>
              <p className="rounded-card border border-line bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed break-thai dark:border-line-dark dark:bg-surface-dark-sunken">
                {sc.when}
              </p>
            </section>

            <section className="mb-5">
              <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                {t('detail.solution')}
              </h2>
              <Steps steps={sc.steps} />

              {sc.note && (
                <div className="mt-4 flex gap-2 rounded-card border border-danger/40 bg-danger-bg px-3.5 py-2.5 text-sm text-danger-fg dark:border-danger-dark/40 dark:bg-danger/15 dark:text-danger-dark">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="break-thai">
                    <b>{t('detail.note')}</b> {sc.note}
                  </p>
                </div>
              )}
            </section>

            <footer className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
              {sc.ref && (
                <div className="flex items-center gap-1.5">
                  <Icon name="book" className="h-3.5 w-3.5 shrink-0" />
                  <span className="break-thai">{sc.ref}</span>
                </div>
              )}
              {sc.dateAdded && (
                <div className="flex items-center gap-1.5">
                  <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t('detail.dateAdded')} {sc.dateAdded}
                  </span>
                </div>
              )}
            </footer>
          </div>

          <Attachments items={sc.attachments} />
        </div>
      </article>

      {editing && <EditCaseModal mode="edit" scenario={sc} onClose={() => setEditing(false)} />}
    </div>
  );
}
