import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useI18n, useTheme } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage, isNotFound } from '../lib/errors';
import { copyLink, isAiSourced, isDocImport, meetingLink } from '../lib/minutes';
import { buildMeetingSrcdoc, buildMeetingSrcdocForPrint } from '../lib/docCss';
import { fmtDate, fmtThaiDate, pdfDateSuffix, timeSuffix } from '../lib/dates';
import { Button, Dot, Empty, Loading } from '../ui';
import AttachmentsBar from './AttachmentsBar';
import ActivityPanel from './ActivityPanel';
import TagPickerModal from './TagPickerModal';
import VersionPreviewModal from './VersionPreviewModal';

/**
 * One meeting: the action bar, the attendee chips, the A4 render, and the
 * attachments appendix.
 */
export default function MeetingDetail({ id, onEdit, onToast, onBusy }) {
  const { t, lang } = useI18n();
  const { isDark } = useTheme();
  const { hasRole } = useAuth();
  const { projectsById, getCached, setCached, fetchMeeting, refetchMeeting, refresh } =
    useMinutesData();

  const [meeting, setMeeting] = useState(() => getCached(id) || null);
  const [loading, setLoading] = useState(() => !getCached(id));
  const [error, setError] = useState('');

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [previewSeq, setPreviewSeq] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const frameRef = useRef(null);

  const isAdmin = hasRole('minutes', 'admin');
  const canEdit = hasRole('minutes', 'admin', 'editor');

  useEffect(() => {
    let alive = true;
    const cached = getCached(id);
    if (cached) {
      setMeeting(cached);
      setLoading(false);
      setError('');
      return undefined;
    }
    setLoading(true);
    setError('');
    setMeeting(null);

    const ac = new AbortController();
    fetchMeeting(id, { signal: ac.signal })
      .then((full) => {
        if (!alive) return;
        setMeeting(full);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive || err?.name === 'AbortError') return;
        // The API answers 404 for a meeting the caller may not read — the id
        // itself is not something a locked project should confirm. So this
        // cannot distinguish "deleted" from "not yours", and must not try.
        setError(isNotFound(err) ? t('error.NOT_FOUND') : errorMessage(err, t));
        setLoading(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [id, getCached, fetchMeeting, t]);

  /** Write a mutation's result through to the cache and this component. */
  function applyUpdate(next) {
    setCached(next.id, next);
    setMeeting(next);
  }

  /**
   * Size the preview iframe to its content once Paged.js has FINISHED laying
   * the document out.
   *
   * Waiting for the page count to SETTLE, not merely to become non-zero: Paged
   * adds pages progressively, and reading at the first sight of a page reported
   * 2 pages for a document that actually had 7. The frame stays hidden until
   * then, or the un-paginated document paints as a blank pane and jumps to full
   * size a moment later.
   */
  function onFrameLoad() {
    const frame = frameRef.current;
    if (!frame) return;

    let revealed = false;
    const fit = () => {
      try {
        const d = frame.contentWindow.document;
        // Sized EXACTLY. An extra pad used to be added as clipping insurance,
        // but the document already ends with .pagedjs_pages' own bottom
        // padding, so the pad rendered as a bare white strip between the last
        // sheet and the attachments card.
        frame.style.height = `${d.body.scrollHeight}px`;
        if (!revealed) {
          revealed = true;
          frame.closest('[data-frame-wrap]')?.classList.add('frame-ready');
        }
      } catch {
        /* cross-origin or torn down mid-poll */
      }
    };

    let tries = 0;
    let lastCount = -1;
    let stable = 0;
    const poll = window.setInterval(() => {
      let d = null;
      try {
        d = frame.contentWindow.document;
      } catch {
        /* not ready */
      }
      if (!d || ++tries > 80) {
        window.clearInterval(poll);
        fit();
        return;
      }
      const count = d.querySelectorAll('.pagedjs_page').length;
      if (count > 0 && count === lastCount) {
        if (++stable >= 3) {
          window.clearInterval(poll);
          fit();
        }
      } else {
        stable = 0;
        lastCount = count;
      }
    }, 100);
  }

  async function togglePin() {
    onBusy(t('meeting.updating'));
    try {
      const { pinned } = await minutesApi.togglePin(meeting.id);
      applyUpdate({ ...meeting, pinned });
      await refresh();
      onToast(pinned ? t('meeting.pinnedToast') : t('meeting.unpinnedToast'));
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function toggleVisibility() {
    const next = !meeting.visible;
    onBusy(next ? t('meeting.publishing') : t('meeting.hiding'));
    try {
      const { visible } = await minutesApi.setMeetingVisible(meeting.id, next);
      applyUpdate({ ...meeting, visible });
      await refresh();
      onToast(visible ? t('meeting.nowVisible') : t('meeting.nowHidden'));
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  /**
   * Re-fetch before opening the editor rather than trusting the cache.
   *
   * The cache is populated when a meeting is first opened and never invalidated
   * afterwards. If a Fathom/Transkriptor ingest, or anyone else's edit, landed
   * on the server AFTER this pane loaded, editing from the stale copy would
   * show old content and silently overwrite the newer version on save.
   */
  async function openEditFresh() {
    onBusy(t('meeting.loadingLatest'));
    try {
      const fresh = await refetchMeeting(meeting.id);
      onEdit(fresh || meeting);
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function untagOne(projectId) {
    const target = projectsById[projectId];
    const name = target?.name || projectId;
    onBusy(t('meeting.removingFrom', { name }));
    try {
      const { taggedProjectIds } = await minutesApi.untagMeeting(meeting.id, projectId);
      applyUpdate({ ...meeting, taggedProjectIds });
      await refresh();
      onToast(t('meeting.removedFrom', { name }));
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function onTagged(projectName) {
    // Re-fetch so taggedProjectIds is the server's authoritative list.
    const fresh = await refetchMeeting(meeting.id).catch(() => null);
    if (fresh) setMeeting(fresh);
    await refresh();
    onToast(t('meeting.nowShowingIn', { name: projectName }));
  }

  function share() {
    copyLink(
      meetingLink(meeting.id),
      () => onToast(t('meeting.shareCopied')),
      t('meeting.sharePrompt')
    );
  }

  if (loading) return <Loading />;
  if (error) return <Empty glyph="📄">{error}</Empty>;
  if (!meeting) return <Empty glyph="📄">{t('meeting.selectOne')}</Empty>;

  const project = projectsById[meeting.projectId];
  const aiSourced = isAiSourced(meeting.source);

  const srcdocOpts = {
    isDark,
    aiDisclaimer: aiSourced,
    t,
    pdfTitle: meeting.title,
    pdfDate: pdfDateSuffix(meeting),
    shareLink: meetingLink(meeting.id),
  };
  const thaiDate = fmtThaiDate(meeting);
  const srcdoc = buildMeetingSrcdoc(meeting.html, meeting.css, thaiDate, srcdocOpts);

  /**
   * Print from a HIDDEN iframe holding the untouched srcdoc, never from the
   * preview: Paged.js has already split that document into page elements, so
   * handing it to the print engine would paginate an already-paginated
   * document. This is byte-for-byte what produced the PDF before Paged.js
   * existed, so exports are unchanged.
   */
  function print() {
    try {
      document.getElementById('vcb-print-frame')?.remove();
      const pf = document.createElement('iframe');
      pf.id = 'vcb-print-frame';
      pf.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
      pf.srcdoc = buildMeetingSrcdocForPrint(meeting.html, meeting.css, thaiDate, srcdocOpts);
      pf.onload = () => {
        try {
          pf.contentWindow.focus();
          pf.contentWindow.print();
        } catch {
          window.print();
        }
      };
      document.body.appendChild(pf);
    } catch {
      window.print();
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 dark:border-line-dark">
        <h2 className="m-0 min-w-[200px] flex-1 text-base font-semibold text-ink dark:text-ink-dark">
          {meeting.title}
        </h2>

        {isAdmin ? (
          <Button variant={meeting.visible ? 'default' : 'danger'} onClick={toggleVisibility}>
            {meeting.visible ? t('meeting.visibleToStaff') : t('meeting.hidden')}
          </Button>
        ) : null}

        {isAdmin ? (
          <Button onClick={togglePin} title={t('meeting.pin')}>
            {meeting.pinned ? `★ ${t('meeting.pinned')}` : `☆ ${t('meeting.pin')}`}
          </Button>
        ) : null}

        {canEdit && aiSourced ? (
          <Button
            variant="primary"
            onClick={() => setTagPickerOpen(true)}
            title={t('meeting.fileIntoProjectHint')}
          >
            {t('meeting.fileIntoProject')}
          </Button>
        ) : null}

        {meeting.fathomUrl ? (
          <a
            href={meeting.fathomUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface-card px-[11px] py-[7px] text-[12.5px] font-medium text-ink no-underline hover:bg-surface-sunken dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark dark:hover:bg-surface-dark-sunken"
          >
            {t('meeting.recording')}
          </a>
        ) : null}

        {/* A doc-import is never editable: its content is a one-way import and
            the Doc it came from stopped being authoritative on 2026-07-19, so
            there is nothing coherent to save back into. For everything else the
            button is shown to editors and admins; the API is the real gate. */}
        {canEdit && !isDocImport(meeting.source) ? (
          <Button variant="primary" onClick={openEditFresh}>
            {t('meeting.editHere')}
          </Button>
        ) : null}

        <Button
          onClick={() => setActivityOpen((v) => !v)}
          className={activityOpen ? 'ring-2 ring-brand-600/30' : ''}
          title={t('meeting.activityHint')}
        >
          🕘 {t('meeting.activity')}
          {meeting.comments?.length ? ` (${meeting.comments.length})` : ''}
        </Button>

        <Button onClick={share} title={t('meeting.shareLink')}>
          🔗 {t('meeting.shareLink')}
        </Button>

        <Button onClick={print}>{t('meeting.print')}</Button>

        <div className="mt-0.5 flex w-full items-center gap-1.5 text-xs text-ink-muted dark:text-ink-dark-muted">
          {project ? <Dot color={project.color} size={8} /> : null}
          <span>
            {project?.name || ''} · {fmtDate(meeting, lang, t)}
            {timeSuffix(meeting)}
          </span>
        </div>
      </div>

      {meeting.attendees?.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-alt px-4 py-3 dark:border-line-dark dark:bg-surface-dark-sunken">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-[.07em] text-ink-muted dark:text-ink-dark-muted">
            {t('meeting.attendees', { n: meeting.attendees.length })}
          </span>
          {meeting.attendees.map((email) => {
            const name = email.split('@')[0].replace(/[._]/g, ' ');
            return (
              <a
                key={email}
                href={`mailto:${email}`}
                title={email}
                className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface-card py-[3px] pl-[3px] pr-3 text-ink no-underline hover:border-brand-600 hover:shadow-card dark:border-line-dark dark:bg-surface-dark-card dark:text-ink-dark"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-900 text-[11px] font-bold text-white">
                  {email.charAt(0).toUpperCase()}
                </span>
                <span className="flex flex-col leading-tight">
                  <b className="text-xs font-semibold capitalize">{name}</b>
                  <small className="text-[10.5px] text-ink-muted dark:text-ink-dark-muted">
                    {email}
                  </small>
                </span>
              </a>
            );
          })}
        </div>
      ) : null}

      {/* Tag chips: which OTHER projects this inbox recording also shows under.
          Each removes just its own tag — never a single ambiguous "untag
          everything", and never a way out of the inbox itself. */}
      {canEdit && aiSourced && meeting.taggedProjectIds?.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-alt px-4 py-3 dark:border-line-dark dark:bg-surface-dark-sunken">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-[.07em] text-ink-muted dark:text-ink-dark-muted">
            {t('meeting.alsoTaggedInto')}
          </span>
          {meeting.taggedProjectIds.map((pid) => {
            const tp = projectsById[pid];
            const name = tp?.name || pid;
            return (
              <span
                key={pid}
                style={{ borderLeftColor: tp?.color || '#888' }}
                className="inline-flex items-center gap-1.5 rounded-pill border border-l-[3px] border-line bg-surface-card py-[3px] pl-3 pr-1.5 dark:border-line-dark dark:bg-surface-dark-card"
              >
                <b className="text-xs font-semibold text-ink dark:text-ink-dark">{name}</b>
                <button
                  type="button"
                  onClick={() => untagOne(pid)}
                  title={t('meeting.removeFrom', { name })}
                  aria-label={t('meeting.removeFrom', { name })}
                  className="rounded-full px-1.5 py-[5px] text-xs leading-none text-ink-muted hover:bg-danger-bg hover:text-danger dark:text-ink-dark-muted dark:hover:bg-danger/20 dark:hover:text-danger-dark"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div data-frame-wrap className="min-h-0 flex-1 overflow-auto bg-surface-sunken p-[22px] dark:bg-surface-dark-alt">
        <div className="mx-auto max-w-paper">
          <iframe
            ref={frameRef}
            // Keyed on the theme so a theme toggle rebuilds the srcdoc. The
            // iframe is a separate document that inherits nothing from the
            // outer page's class, so without this a meeting opened in dark mode
            // stayed dark forever after switching back to light.
            key={`${meeting.id}:${isDark ? 'dark' : 'light'}:${lang}`}
            title={meeting.title}
            srcDoc={srcdoc}
            onLoad={onFrameLoad}
            className="render-frame"
          />
        </div>

        <AttachmentsBar
          meeting={meeting}
          canEdit={canEdit}
          onUpdated={applyUpdate}
          onToast={onToast}
          onBusy={onBusy}
        />
      </div>

      <TagPickerModal
        open={tagPickerOpen}
        meeting={meeting}
        onClose={() => setTagPickerOpen(false)}
        onTagged={onTagged}
        onToast={onToast}
        onBusy={onBusy}
      />

      <VersionPreviewModal
        seq={previewSeq}
        meeting={meeting}
        projectName={project?.name || ''}
        onClose={() => setPreviewSeq(null)}
      />

      {activityOpen ? (
        <ActivityPanel
          meeting={meeting}
          onClose={() => setActivityOpen(false)}
          onUpdated={applyUpdate}
          onToast={onToast}
          onBusy={onBusy}
          onViewVersion={setPreviewSeq}
        />
      ) : null}
    </>
  );
}

