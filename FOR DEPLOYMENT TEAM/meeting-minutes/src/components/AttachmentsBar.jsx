import React, { useRef } from 'react';
import { useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import {
  ATTACH_ACCEPT,
  ATTACH_MAX_BYTES,
  FILE_ICON_CLASS,
  fileIconKind,
  fmtFileSize,
} from '../lib/minutes';
import { useConfirm } from '../ui';

/**
 * The attachments appendix, rendered AFTER the document inside the same
 * scrolling region — an appendix at the end of the minutes, not a strip eating
 * scarce screen height above the summary anyone actually came to read.
 *
 * ---------------------------------------------------------------------------
 * THE FILE NEVER PASSES THROUGH THE API.
 * ---------------------------------------------------------------------------
 * The old code base64'd the file and posted it as JSON. Against this API that
 * cannot work: the body limit is 2 MB, the attachment cap is 25 MB, and base64
 * adds a third on top. The flow is: ask the API to sign a Storage URL, PUT the
 * bytes straight at Storage, then post only the metadata.
 *
 * The signing route does not exist in api/src/routes/minutes.js yet (onboarding
 * has one; minutes does not). Rather than silently falling back to something
 * that would fail at 2 MB with an opaque error, the upload reports plainly that
 * the server has no upload route — see err.uploadUnavailable.
 */
export default function AttachmentsBar({ meeting, canEdit, onUpdated, onToast, onBusy }) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const { confirm, node: confirmNode } = useConfirm();

  const attachments = meeting.attachments || [];
  if (!attachments.length && !canEdit) return null;

  async function onFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > ATTACH_MAX_BYTES) {
      onToast(t('attach.tooLarge'));
      return;
    }

    const contentType = file.type || 'application/octet-stream';
    onBusy(t('attach.uploading', { name: file.name }));
    try {
      // 1. Ask the API where to put it.
      const signed = await minutesApi.uploadUrlFor(meeting.id, { fileName: file.name });
      if (!signed?.uploadUrl || !signed?.downloadUrl) throw new Error('NO_UPLOAD_URL');

      // 2. Send the bytes straight to Storage, with the type the API SIGNED -
      //    not file.type. They differ (file.type is empty for .docx on some
      //    Windows setups) and a signature mismatch fails with an opaque 403.
      await minutesApi.putToStorage(signed.uploadUrl, file, signed.contentType || contentType);

      // 3. Record only the metadata against the meeting.
      const { attachments: next } = await minutesApi.addAttachment(meeting.id, {
        name: file.name,
        mimeType: contentType,
        url: signed.downloadUrl,
        size: file.size,
      });
      onUpdated({ ...meeting, attachments: next });
      onToast(t('attach.attached', { name: file.name }));
    } catch (err) {
      // A 404 here means the signing route is not deployed, which is a
      // different problem from a failed upload and needs a different sentence.
      onToast(err?.status === 404 ? t('err.uploadUnavailable') : errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  async function remove(fileId) {
    const ok = await confirm(t('attach.removeHint'), {
      title: t('attach.removeTitle'),
      okLabel: t('attach.remove'),
    });
    if (!ok) return;
    onBusy(t('attach.removing'));
    try {
      const { attachments: next } = await minutesApi.removeAttachment(meeting.id, fileId);
      onUpdated({ ...meeting, attachments: next });
      onToast(t('attach.removed'));
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  return (
    <div className="mx-auto mt-4 flex max-w-paper flex-wrap items-center gap-2 rounded-lg bg-surface-card px-[18px] py-3.5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
      <span className="basis-full text-[10.5px] font-bold uppercase tracking-[.07em] text-ink-muted dark:text-ink-dark-muted">
        {attachments.length
          ? t('meeting.attachmentsN', { n: attachments.length })
          : t('meeting.attachments')}
      </span>

      {attachments.map((a) => {
        const { kind, label } = fileIconKind(a.mimeType, a.name);
        return (
          <span
            key={a.fileId}
            className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface-card py-[3px] pl-[3px] pr-1.5 dark:border-line-dark dark:bg-surface-dark-sunken"
          >
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 pr-2 text-ink no-underline dark:text-ink-dark"
            >
              <span
                className={`inline-flex h-[18px] min-w-[24px] shrink-0 items-center justify-center rounded-[3px] px-[3px] text-[9px] font-bold text-white ${
                  FILE_ICON_CLASS[kind] || FILE_ICON_CLASS.gen
                }`}
              >
                {label}
              </span>
              <span className="flex flex-col leading-tight">
                <b className="text-xs font-semibold">{a.name}</b>
                <small className="text-[10.5px] text-ink-muted dark:text-ink-dark-muted">
                  {fmtFileSize(a.size)}
                </small>
              </span>
            </a>
            {canEdit ? (
              <button
                type="button"
                onClick={() => remove(a.fileId)}
                title={t('attach.removeOne')}
                aria-label={t('attach.removeOne')}
                className="rounded-full px-1.5 py-[5px] text-xs leading-none text-ink-muted hover:bg-danger-bg hover:text-danger dark:text-ink-dark-muted dark:hover:bg-danger/20 dark:hover:text-danger-dark"
              >
                ✕
              </button>
            ) : null}
          </span>
        );
      })}

      {canEdit ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-pill border border-dashed border-line px-3.5 py-[5px] text-[12.5px] text-ink-muted hover:border-brand-600 hover:text-brand-600 dark:border-line-dark dark:text-ink-dark-muted dark:hover:border-brand-300 dark:hover:text-brand-300"
          >
            {t('meeting.attachFile')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept={ATTACH_ACCEPT}
            onChange={onFilePicked}
          />
        </>
      ) : null}
      {confirmNode}
    </div>
  );
}
