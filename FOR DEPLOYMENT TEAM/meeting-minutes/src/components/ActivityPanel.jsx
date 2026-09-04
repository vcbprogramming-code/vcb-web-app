import React, { useEffect, useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { fmtTimestamp } from '../lib/dates';
import { Button, IconButton, Loading, TextArea, useConfirm } from '../ui';

/**
 * Activity: edits and comments, newest first, in one drawer — merging what
 * used to be two separate buttons (History / Comments). The original app
 * treats them as one story about a meeting ("edits and comments, newest
 * first"); splitting them apart was a port artifact, not a real distinction.
 *
 * Edit rows (versions + audit trail) load only for admins, since the
 * /versions and /audit endpoints are admin-only at the API — that gate is a
 * permissions matter, not something this merge changes. Comments remain
 * visible to any reader who can see the meeting, and postable by anyone
 * signed in, same as before.
 */
export default function ActivityPanel({ meeting, onClose, onUpdated, onToast, onBusy, onViewVersion }) {
  const { t, lang } = useI18n();
  const { user, signedIn, hasRole } = useAuth();
  const { confirm, node: confirmNode } = useConfirm();

  const isAdmin = hasRole('minutes', 'admin');

  const [versions, setVersions] = useState(null);
  const [audit, setAudit] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!isAdmin || !meeting) {
      setVersions(null);
      setAudit(null);
      setHistoryError('');
      return undefined;
    }
    let alive = true;
    const ac = new AbortController();
    setVersions(null);
    setAudit(null);
    setHistoryError('');

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
        setHistoryError(errorMessage(err, t));
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [isAdmin, meeting, t]);

  const comments = meeting.comments || [];

  async function post() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      const { comments: next } = await minutesApi.addComment(meeting.id, text);
      onUpdated({ ...meeting, comments: next });
      setDraft('');
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      setPosting(false);
    }
  }

  async function removeComment(commentId) {
    const ok = await confirm(t('attach.removeHint'), {
      title: t('comment.deleteTitle'),
      okLabel: t('common.delete'),
    });
    if (!ok) return;
    onBusy(t('comment.deleting'));
    try {
      const { comments: next } = await minutesApi.removeComment(meeting.id, commentId);
      onUpdated({ ...meeting, comments: next });
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  // create_* duplicates the pinned "Original" row below, which already carries
  // the real creation timestamp. Repeating it in the feed reads as if
  // something were created after a later edit.
  const editEntries = (audit || [])
    .filter((e) => !e.action.startsWith('create_'))
    .map((e) => ({ kind: 'edit', when: e.when, node: (
      <span>
        <b className="text-ink dark:text-ink-dark">{t(`audit.${e.action}`)}</b> · {e.who}
      </span>
    ) }));

  const versionByWhen = new Map((versions || []).map((v) => [v.takenAt, v]));

  const commentEntries = comments.map((c) => {
    const mine = isAdmin || c.author === user?.email;
    return {
      kind: 'comment',
      when: c.createdAt,
      node: (
        <div className="relative pr-6">
          <span>
            💬 <b className="text-ink dark:text-ink-dark">{c.author || t('comment.unknownAuthor')}</b>
          </span>
          <div className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-ink dark:text-ink-dark">
            {c.text}
          </div>
          {mine ? (
            <button
              type="button"
              onClick={() => removeComment(c.id)}
              title={t('comment.delete')}
              aria-label={t('comment.delete')}
              className="absolute right-0 top-0 px-1 py-0.5 text-xs text-ink-muted hover:text-danger dark:text-ink-dark-muted dark:hover:text-danger-dark"
            >
              ✕
            </button>
          ) : null}
        </div>
      ),
    };
  });

  // Newest first, same order the original's interleaved timeline used.
  const feed = [...editEntries, ...commentEntries].sort(
    (a, b) => new Date(b.when) - new Date(a.when)
  );

  const createdWhen = meeting.createdAt ? fmtTimestamp(meeting.createdAt, lang) : '';
  const historyLoading = isAdmin && versions === null && audit === null && !historyError;

  return (
    <>
      <div className="fixed inset-0 z-[44] bg-black/15" onClick={onClose} aria-hidden="true" />
      <aside
        role="complementary"
        aria-label={t('meeting.activity')}
        className="fixed inset-y-0 right-0 z-[45] flex w-[min(380px,100vw)] flex-col border-l border-line bg-surface-card shadow-[-8px_0_24px_rgba(0,0,0,.12)] dark:border-line-dark dark:bg-surface-dark-card"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3.5 dark:border-line-dark">
          <h3 className="m-0 text-[15px] font-semibold text-ink dark:text-ink-dark">
            {t('meeting.activity')}
          </h3>
          <IconButton onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            ✕
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {isAdmin ? (
            <div className="flex items-center justify-between gap-2.5 border-b border-line pb-3 dark:border-line-dark">
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
          ) : null}

          {historyError ? (
            <div className="text-[13px] text-danger dark:text-danger-dark">{historyError}</div>
          ) : historyLoading ? (
            <Loading />
          ) : feed.length === 0 ? (
            <div className="text-[13px] leading-relaxed text-ink-muted dark:text-ink-dark-muted">
              {t('comment.none')}
            </div>
          ) : (
            feed.map((entry, i) => {
              const version = entry.kind === 'edit' ? versionByWhen.get(entry.when) : null;
              return (
                <div
                  key={`${entry.kind}:${entry.when}:${i}`}
                  className="flex items-start justify-between gap-2.5 border-b border-line pb-3 text-[13px] last:border-b-0 dark:border-line-dark"
                >
                  <div className="min-w-0 flex-1">
                    {entry.node}
                    <div className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                      {fmtTimestamp(entry.when, lang)}
                    </div>
                  </div>
                  {version ? (
                    <Button onClick={() => onViewVersion(version.seq)} title={t('history.viewHint')}>
                      {t('history.view')}
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Commenting needs an identity the API will accept. Showing the box to
            an anonymous reader would only produce a 401 they cannot fix from
            here. */}
        {signedIn ? (
          <div className="flex shrink-0 flex-col gap-2 border-t border-line p-4 dark:border-line-dark">
            <TextArea
              rows={2}
              maxLength={4000}
              placeholder={t('comment.write')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[44px]"
            />
            <Button variant="primary" className="self-end" disabled={posting || !draft.trim()} onClick={post}>
              {t('comment.post')}
            </Button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-line p-4 text-[12.5px] text-ink-muted dark:border-line-dark dark:text-ink-dark-muted">
            {t('error.AUTH_REQUIRED')}
          </div>
        )}
      </aside>
      {confirmNode}
    </>
  );
}
