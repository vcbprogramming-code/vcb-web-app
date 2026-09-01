import React, { useEffect, useRef, useState } from 'react';
import { useI18n, useTheme } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { isAiSourced } from '../lib/minutes';
import { buildVersionSrcdoc } from '../lib/docCss';
import { Button, Empty, Loading, Modal } from '../ui';

/**
 * A past version, read-only.
 *
 * The header shows the title/dateLabel/time captured WITH THE SNAPSHOT, not the
 * meeting's current ones — renaming a meeting used to make its own past-version
 * previews show the new name, which made the history look rewritten.
 *
 * A snapshot taken before the 2026-07-22 metadata-capture fix holds only html
 * and returns '' for the rest. That empty string is the documented signal to
 * fall back to the live row, and only in that case — never as a general
 * default, or the bug comes back for every version.
 *
 * Rendered in its own iframe rather than a sibling element so the Print button
 * prints just the document.
 */
export default function VersionPreviewModal({ seq, meeting, projectName, onClose }) {
  const { t } = useI18n();
  const { isDark } = useTheme();

  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const frameRef = useRef(null);

  useEffect(() => {
    if (seq == null || !meeting) {
      setContent(null);
      setError('');
      return undefined;
    }
    let alive = true;
    const ac = new AbortController();
    setContent(null);
    setError('');

    minutesApi
      .getVersion(meeting.id, seq, { signal: ac.signal })
      .then((c) => {
        if (alive) setContent(c);
      })
      .catch((err) => {
        if (!alive || err?.name === 'AbortError') return;
        setError(errorMessage(err, t));
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [seq, meeting, t]);

  if (seq == null || !meeting) return null;

  const srcDoc =
    content == null
      ? undefined
      : buildVersionSrcdoc({
          html: content.html,
          // The fallback applies ONLY to an empty captured field. See above.
          title: content.title || meeting.title || '',
          dateLabel: content.dateLabel || meeting.dateLabel || '',
          time: content.time || meeting.time || '',
          projectName,
          isDark,
          // A version carries no source of its own, so the disclaimer is gated
          // on the live meeting's — which is the row this content belongs to.
          aiDisclaimer: isAiSourced(meeting.source),
          t,
        });

  function print() {
    try {
      frameRef.current.contentWindow.focus();
      frameRef.current.contentWindow.print();
    } catch {
      window.print();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <>
          {t('version.title')}{' '}
          <span className="text-[12.5px] font-normal text-ink-muted dark:text-ink-dark-muted">
            {t('version.readOnly')}
          </span>
        </>
      }
      width="max-w-[900px] w-[92vw] h-[85vh]"
      bodyClassName="!p-0"
      actions={
        <>
          <Button className="mr-auto" onClick={print} disabled={content == null}>
            {t('meeting.print')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      {error ? (
        <Empty className="!h-auto py-10">{error}</Empty>
      ) : content == null ? (
        <Loading />
      ) : (
        <iframe
          ref={frameRef}
          title={t('version.title')}
          srcDoc={srcDoc}
          className="block h-full min-h-[60vh] w-full border-0"
        />
      )}
    </Modal>
  );
}
