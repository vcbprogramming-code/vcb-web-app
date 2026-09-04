import React, { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { fmtTimestamp } from '../lib/dates';
import { Button, Empty, IconButton, Loading, Modal, useConfirm } from '../ui';

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
export default function EditHistoryModal({ open, meeting, onClose, onViewVersion, isAdmin, onBusy, onToast }) {
  const { t, lang } = useI18n();
  const { confirm, node: confirmNode } = useConfirm();

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

  async function deleteEntry(e) {
    const ok = await confirm(t('history.deleteEntryTitle'), { okLabel: t('common.delete') });
    if (!ok) return;
    onBusy?.(t('comment.deleting'));
    try {
      await minutesApi.deleteAuditEntry(meeting.id, e.id);
      setAudit((prev) => (prev || []).filter((x) => x.id !== e.id));
    } catch (err) {
      onToast?.(errorMessage(err, t));
    } finally {
      onBusy?.(null);
    }
  }

  async function deleteVersion(seq) {
    const ok = await confirm(t('history.deleteVersionTitle'), { okLabel: t('common.delete') });
    if (!ok) return;
    onBusy?.(t('comment.deleting'));
    try {
      await minutesApi.deleteVersion(meeting.id, seq);
      setVersions((prev) => (prev || []).filter((v) => v.seq !== seq));
    } catch (err) {
      onToast?.(errorMessage(err, t));
    } finally {
      onBusy?.(null);
    }
  }

  async function clearAll() {
    const ok = await confirm(`${t('history.clearAllTitle')} ${t('history.clearAllHint')}`, {
      title: t('history.clearAll'),
      okLabel: t('common.delete'),
    });
    if (!ok) return;
    onBusy?.(t('comment.deleting'));
    try {
      await minutesApi.clearMeetingAudit(meeting.id);
      setAudit([]);
      setVersions([]);
    } catch (err) {
      onToast?.(errorMessage(err, t));
    } finally {
      onBusy?.(null);
    }
  }

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

          {isAdmin && (versions?.length || activity.length) ? (
            <button
              type="button"
              onClick={clearAll}
              className="mb-2 self-end text-[11.5px] font-medium text-ink-muted underline-offset-2 hover:text-danger hover:underline dark:text-ink-dark-muted dark:hover:text-danger-dark"
            >
              {t('history.clearAll')}
            </button>
          ) : null}

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
                  <div className="flex items-center gap-1.5">
                    <Button onClick={() => onViewVersion(v.seq)} title={t('history.viewHint')}>
                      {t('history.view')}
                    </Button>
                    {isAdmin ? (
                      <IconButton
                        onClick={() => deleteVersion(v.seq)}
                        title={t('history.deleteVersion')}
                        aria-label={t('history.deleteVersion')}
                        className="text-ink-muted hover:text-danger dark:text-ink-dark-muted dark:hover:text-danger-dark"
                      >
                        ✕
                      </IconButton>
                    ) : null}
                  </div>
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
                {isAdmin ? (
                  <IconButton
                    onClick={() => deleteEntry(e)}
                    title={t('history.deleteEntry')}
                    aria-label={t('history.deleteEntry')}
                    className="text-ink-muted hover:text-danger dark:text-ink-dark-muted dark:hover:text-danger-dark"
                  >
                    ✕
                  </IconButton>
                ) : null}
              </div>
            ))
          ) : versions?.length ? null : (
            <div className="py-3 text-center text-ink-muted dark:text-ink-dark-muted">
              {t('history.none')}
            </div>
          )}
        </>
      )}
      {confirmNode}
    </Modal>
  );
}
