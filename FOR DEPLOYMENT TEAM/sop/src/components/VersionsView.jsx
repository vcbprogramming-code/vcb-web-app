/**
 * Version history — editor-only.
 *
 * New screen. The API has always exposed GET /versions, GET /versions/:id and
 * POST /versions/:id/restore, and the database writes a snapshot before every
 * update via the sop_snapshot trigger, so the history exists and cannot have
 * holes in it. Nothing in the old UI ever showed it: the canonical app pointed
 * people at "the Doc's version history" instead, which no longer exists after
 * the migration. Without this screen a deleted case would be genuinely
 * unrecoverable from the app.
 *
 * The list deliberately omits each version's `data` — the API does too, because
 * a version payload is a whole SOP document and fetching fifty of them to draw
 * a list would be absurd.
 */

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';

import { Icon } from '../lib/icons.jsx';
import { errorKey, listVersions } from '../lib/sopApi.js';
import { useStore } from '../store.jsx';
import { BackBar, Button, Empty, Notice, Spinner } from './ui.jsx';

export default function VersionsView() {
  const { t, formatDate } = useI18n();
  const { canEdit, hasEditorRole, restoreVersion } = useStore();

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setVersions(await listVersions(50));
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The route is reachable by URL, so guard the fetch rather than assume the
    // Settings link was the only way in. A non-editor gets a 403 otherwise.
    if (canEdit || hasEditorRole) load();
    else setLoading(false);
  }, [canEdit, hasEditorRole, load]);

  async function restore(id) {
    setRestoring(id);
    try {
      await restoreVersion(id);
      setConfirming(null);
      await load();
    } catch (e) {
      setErr(e);
    } finally {
      setRestoring(null);
    }
  }

  if (!canEdit && !hasEditorRole) {
    return (
      <div>
        <BackBar to="/cases" label={t('detail.backModules')} />
        <div className="px-4 py-8 sm:px-6">
          <Notice tone="warn">{t('versions.editorOnly')}</Notice>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackBar to="/cases" label={t('detail.backModules')} />

      <div className="px-4 py-5 sm:px-6">
        <header className="mb-4 border-b border-line pb-3.5 dark:border-line-dark">
          <h1 className="text-lg font-bold break-thai">{t('versions.title')}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted break-thai dark:text-ink-dark-muted">
            {t('versions.lead')}
          </p>
        </header>

        {err && (
          <Notice tone="danger" className="mb-3">
            {t(errorKey(err))}
          </Notice>
        )}

        {loading ? (
          <Spinner />
        ) : versions.length === 0 ? (
          <Empty>{t('versions.empty')}</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-card p-3 shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:shadow-card-dark"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-ink-muted dark:bg-surface-dark-sunken dark:text-ink-dark-muted">
                  <Icon name="calendar" className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {formatDate(v.takenAt, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                    {v.takenBy && `${t('versions.takenBy')}: ${v.takenBy}`}
                    {v.takenBy && v.note ? ' · ' : ''}
                    {v.note}
                  </div>
                </div>

                {confirming === v.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-muted break-thai dark:text-ink-dark-muted">
                      {t('versions.confirm')}
                    </span>
                    <Button
                      variant="primary"
                      onClick={() => restore(v.id)}
                      disabled={restoring === v.id}
                    >
                      {restoring === v.id ? t('versions.restoring') : t('common.confirm')}
                    </Button>
                    <Button onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
                  </span>
                ) : (
                  <Button onClick={() => setConfirming(v.id)} className="shrink-0">
                    <Icon name="refresh" className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('versions.restore')}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
