/**
 * The landing page shown when no case or flow is selected: what this document
 * is, its metadata, how to use the three panes, and any document-level notes.
 */

import { useI18n } from '@vcb/shared';

import { SOP_FLOWS } from '../data/flows.js';
import { STATUS, useStore } from '../store.jsx';
import { Spinner } from './ui.jsx';

function Stat({ children }) {
  return (
    <span className="border-r border-line px-3 py-1 last:border-r-0 dark:border-line-dark">
      {children}
    </span>
  );
}

function HowTo({ n, title, desc }) {
  return (
    <div className="rounded-card border border-line bg-surface-card p-4 shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        {n}
      </span>
      <h3 className="mt-2.5 text-sm font-bold break-thai">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted">
        {desc}
      </p>
    </div>
  );
}

export default function Welcome() {
  const { t } = useI18n();
  const { meta, scenarios, reports, status } = useStore();

  if (status === STATUS.loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold text-brand-900 break-thai dark:text-brand-200">
        {meta.title || t('welcome.heading')}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted">
        {meta.subtitle || t('welcome.lead')}
      </p>

      <div className="mt-4 flex flex-wrap items-center rounded-card border border-line bg-surface-sunken text-xs text-ink-muted dark:border-line-dark dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
        {meta.version && (
          <Stat>
            {t('welcome.version')}
            {meta.version}
          </Stat>
        )}
        {meta.effective && (
          <Stat>
            {t('welcome.effective')}
            {meta.effective}
          </Stat>
        )}
        <Stat>
          {scenarios.length}
          {t('list.casesSuffix')}
        </Stat>
        <Stat>
          {reports.length}
          {t('reports.suffix')}
        </Stat>
        <Stat>
          {SOP_FLOWS.length} {t('flows.title')}
        </Stat>
        {meta.manual && <Stat>{meta.manual}</Stat>}
      </div>

      {meta.purpose && (
        <section className="mt-5 rounded-card border border-line bg-surface-sunken p-4 dark:border-line-dark dark:bg-surface-dark-sunken">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t('welcome.purposeHdr')}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed break-thai">{meta.purpose}</p>
        </section>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HowTo n="1" title={t('welcome.ht1Title')} desc={t('welcome.ht1Desc')} />
        <HowTo n="2" title={t('welcome.ht2Title')} desc={t('welcome.ht2Desc')} />
        <HowTo n="3" title={t('welcome.ht3Title')} desc={t('welcome.ht3Desc')} />
      </div>

      {meta.notes?.length > 0 && (
        <section className="mt-5 rounded-card border-l-4 border-warn bg-warn-bg p-4 dark:border-warn-dark dark:bg-warn/15">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-warn-fg dark:text-warn-dark">
            {t('welcome.notesHdr')}
          </h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-warn-fg break-thai dark:text-warn-dark">
            {meta.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
