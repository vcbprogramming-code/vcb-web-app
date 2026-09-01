/**
 * Shown when GET /api/sop answers 404 NOT_SEEDED.
 *
 * Migration 006 deliberately does NOT seed the document row: an empty `{}` row
 * would let editors start authoring into a document the real content import
 * then overwrites. So "not seeded" is a normal state before launch, and it gets
 * an onboarding screen rather than an error page — nothing is broken, the
 * content has simply not been loaded yet.
 *
 * Process Flows still work here (they ship with the app), so this screen says
 * so and links to them rather than leaving the person at a dead end.
 */

import { Link } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { SOP_FLOWS } from '../data/flows.js';
import { useStore } from '../store.jsx';
import { Button, Notice } from './ui.jsx';

export default function NotSeeded() {
  const { t } = useI18n();
  const { canEdit, refresh } = useStore();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Icon name="book" className="h-7 w-7" />
      </span>

      <h1 className="mt-4 text-xl font-extrabold text-brand-900 break-thai dark:text-brand-200">
        {t('seed.title')}
      </h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted">
        {t('seed.lead')}
      </p>

      <Notice tone="info" className="mt-6 text-left">
        {t('seed.flowsStillWork')}
      </Notice>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link to="/flows">
          <Button variant="primary">
            <Icon name="workflow" className="h-4 w-4" />
            {t('seed.viewFlows')} ({SOP_FLOWS.length})
          </Button>
        </Link>
        <Button onClick={refresh}>
          <Icon name="refresh" className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* An editor is the person who can act on this, so they get the specific
          reason rather than the general reassurance. */}
      {canEdit && (
        <Notice tone="warn" className="mt-6 text-left">
          {t('error.NOT_SEEDED')}
        </Notice>
      )}
    </div>
  );
}
