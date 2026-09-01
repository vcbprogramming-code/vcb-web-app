import React, { useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { fmtTimestamp } from '../lib/dates';
import { Button, IconButton, TextArea, useConfirm } from '../ui';

/**
 * The comment drawer.
 *
 * Any signed-in person who can READ the meeting may comment — the API re-checks
 * readability, so being signed in is not on its own enough on a locked project.
 * Delete is the author's or an admin's; the button is hidden otherwise, and the
 * API refuses it regardless.
 */
export default function CommentsPanel({ meeting, onClose, onUpdated, onToast, onBusy }) {
  const { t, lang } = useI18n();
  const { user, signedIn, hasRole } = useAuth();
  const { confirm, node: confirmNode } = useConfirm();

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const isAdmin = hasRole('minutes', 'admin');
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

  async function remove(commentId) {
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

  return (
    <>
      <div
        className="fixed inset-0 z-[44] bg-black/15"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label={t('meeting.comments')}
        className="fixed inset-y-0 right-0 z-[45] flex w-[min(360px,100vw)] flex-col border-l border-line bg-surface-card shadow-[-8px_0_24px_rgba(0,0,0,.12)] dark:border-line-dark dark:bg-surface-dark-card"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3.5 dark:border-line-dark">
          <h3 className="m-0 text-[15px] font-semibold text-ink dark:text-ink-dark">
            {t('meeting.comments')}
          </h3>
          <IconButton onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            ✕
          </IconButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {comments.length === 0 ? (
            <div className="text-[13px] leading-relaxed text-ink-muted dark:text-ink-dark-muted">
              {t('comment.none')}
            </div>
          ) : (
            comments.map((c) => {
              const mine = isAdmin || c.author === user?.email;
              return (
                <div key={c.id} className="relative pr-6">
                  <div className="mb-1 flex items-baseline gap-2">
                    <b className="text-[12.5px] text-ink dark:text-ink-dark">
                      {c.author || t('comment.unknownAuthor')}
                    </b>
                    <span className="text-[11px] text-ink-muted dark:text-ink-dark-muted">
                      {fmtTimestamp(c.createdAt, lang)}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-snug text-ink dark:text-ink-dark">
                    {c.text}
                  </div>
                  {mine ? (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      title={t('comment.delete')}
                      aria-label={t('comment.delete')}
                      className="absolute right-0 top-0 px-1 py-0.5 text-xs text-ink-muted hover:text-danger dark:text-ink-dark-muted dark:hover:text-danger-dark"
                    >
                      ✕
                    </button>
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
            <Button
              variant="primary"
              className="self-end"
              disabled={posting || !draft.trim()}
              onClick={post}
            >
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
