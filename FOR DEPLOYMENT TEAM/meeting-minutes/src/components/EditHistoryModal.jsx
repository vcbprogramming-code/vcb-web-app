import React, { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { fmtTimestamp } from '../lib/dates';
import { Button, Empty, Loading, Modal } from '../ui';

/**
 * Who changed this meeting, when, and what it looked like before.
 *
 * Two lists from two endpoints, deliberately:
 *
 *   /versions  the content snapshots — the only rows that can be PREVIEWED
 *   /audit     every action, including ones that changed no content (pin,
 *              visibility, tagging, attachments, comments)
 *
 * The old UI tried to get both from the audit log alone, by reading a
 * `details.versionSeq` field. This API does not emit that field — its audit
 * `changes` column holds whatever the route chose to record — so a "View"
 * button driven by it would never appear. Reading the snapshots directly is
 * both correct and simpler: a version row IS a viewable version.
 *
 * Admin only, at the API. The panel is opened from an admin-only button, but
 * both requests would 403 for anyone else regardless.
 */
export default function EditHistoryModal({ open, meeting, onClose, onViewVersion }) {
  const { t, lang } = useI18n();

  const [versions, setVersions] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !meeting) {
      setVersions(null);
      setAudit(null);
      setError('');
      return undefined;
    }
    let alive = true;
    const ac = new AbortController();
    setVersions(null);
    setAudit(null);
    setError('');

    Promise.all([
      minutesApi.listVersions(meeting.id, { signal: ac.signal }),
      minutesApi.getMeetingAudit(meeting.id, { signal: ac.signal }),
    ])
      .then(([v, a]) => {
        if (!alive) return;
        setVersions(v || []);
        setAudit(a || []);
      })
      .catch((err) => {
        if (!alive || err?.name === 'AbortError') return;
        setError(errorMessage(err, t));
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [open, meeting, t]);

  if (!open || !meeting) return null;

  // create_* duplicates the pinned "Original" row below, which already carries
  // the real creation timestamp. Repeating it in the activity list reads as if
  // something were created after a later edit.
  const activity = (audit || []).filter((e) => !e.action.startsWith('create_'));
  const createdWhen = meeting.createdAt ? fmtTimestamp(meeting.createdAt, lang) : '';
  const loading = versions === null && audit === null && !error;

  const rowClass =
    'flex items-center justify-between gap-2.5 border-b border-line py-2.5 text-[13px] last:border-b-0 dark:border-line-dark';

  return (
    <Modal
      open
      onClose={onClose}
      title={t('history.title')}
      width="max-w-[520px]"
      actions={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      {error ? (
        <Empty className="!h-auto py-6">{error}</Empty>
      ) : loading ? (
        <Loading />
      ) : (
        <>
          {/* Always offered, and resolved server-side to the OLDEST snapshot —
              or to the live row when the meeting has never been edited, in
              which case current genuinely is the original. */}
          <div className="flex items-center justify-between gap-2.5 border-b-2 border-line pb-3 pt-2 dark:border-line-dark">
            <span className="text-[13px]">
              <b className="text-ink dark:text-ink-dark">{t('history.original')}</b>
              <br />
              <span className="text-[11.5px] text-ink-muted dark:text-ink-dark-muted">
                {createdWhen ? t('history.createdAt', { when: createdWhen }) : t('history.firstVersion')}
              </span>
            </span>
            <Button variant="primary" onClick={() => onViewVersion('original')}>
              {t('history.viewOriginal')}
            </Button>
          </div>

          {versions?.length ? (
            <div className="mb-2">
              {versions.map((v) => (
                <div key={v.seq} className={rowClass}>
                  <span>
                    <b className="text-ink dark:text-ink-dark">{t('audit.edit_content')}</b>{' '}
                    {v.takenBy ? `${t('history.by')} ${v.takenBy}` : ''}
                    <br />
                    <span className="text-[11.5px] text-ink-muted dark:text-ink-dark-muted">
                      {fmtTimestamp(v.takenAt, lang)}
                    </span>
                  </span>
                  <Button onClick={() => onViewVersion(v.seq)} title={t('history.viewHint')}>
                    {t('history.view')}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {activity.length ? (
            activity.map((e, i) => (
              <div key={`${e.when}:${i}`} className={rowClass}>
                <span>
                  {/* The API returns machine tokens (edit_content, toggle_pin).
                      translate() falls back to the key itself when a new action
                      has no entry yet, which surfaces the gap instead of hiding
                      it — but every action the routes emit today is mapped. */}
                  <b className="text-ink dark:text-ink-dark">{t(`audit.${e.action}`)}</b> · {e.who}
                  <br />
                  <span className="text-[11.5px] text-ink-muted dark:text-ink-dark-muted">
                    {fmtTimestamp(e.when, lang)}
                  </span>
                </span>
              </div>
            ))
          ) : versions?.length ? null : (
            <div className="py-3 text-center text-ink-muted dark:text-ink-dark-muted">
              {t('history.none')}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
