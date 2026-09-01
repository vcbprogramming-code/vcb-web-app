import React, { useEffect, useState } from 'react';
import { useAuth, useI18n } from '@vcb/shared';
import { useMinutesData } from '../MinutesData';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { esc, isInboxProject } from '../lib/minutes';
import { Button, Field, Modal, Select, TextArea, TextInput, useConfirm } from '../ui';

/**
 * Create a meeting, or fix its metadata.
 *
 * Deliberately NOT where a meeting's body is written — that is the rich editor.
 * This accepts pasted HTML or plain text, and wraps plain text in paragraphs so
 * a pasted transcript does not arrive as one unbroken line.
 *
 * `source` is never sent: the API defaults it to 'manual', and there is no
 * value a client is allowed to choose that would be more accurate. An existing
 * row's source is pinned server-side anyway — an imported meeting stays
 * 'doc-import' forever, however often it is edited here.
 */
export default function MeetingModal({ open, meeting, onClose, onSaved, onDeleted, onToast, onBusy }) {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const { projects } = useMinutesData();
  const { confirm, node: confirmNode } = useConfirm();

  const isAdmin = hasRole('minutes', 'admin');

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [time, setTime] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  // A new meeting cannot be filed into an inbox: those hold ingested
  // recordings, and a hand-written row in one would never be reviewed.
  const selectable = projects.filter((p) => !isInboxProject(p.id));

  useEffect(() => {
    if (!open) return;
    setProjectId(meeting ? meeting.projectId : selectable[0]?.id || '');
    setTitle(meeting ? meeting.title : '');
    setDateLabel(meeting ? meeting.dateLabel || '' : '');
    setTime(meeting ? meeting.time || '' : '');
    setHtml(meeting ? meeting.html || '' : '');
    // selectable is derived from projects; depending on it would reset the form
    // every time the list refreshed behind an open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting]);

  if (!open) return null;

  async function save() {
    const raw = html.trim();
    // Already markup? Leave it alone. Otherwise turn blank-line-separated text
    // into paragraphs, escaping first so a stray "<" in a transcript cannot
    // inject markup.
    const built = /<[a-z][\s\S]*>/i.test(raw)
      ? raw
      : raw
          .split(/\n{2,}/)
          .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
          .join('');

    setSaving(true);
    onBusy(t('state.saving'));
    try {
      const { id } = await minutesApi.saveMeeting({
        id: meeting?.id,
        projectId,
        title: title.trim() || t('modal.untitled'),
        dateLabel: dateLabel.trim(),
        time: time.trim(),
        html: built,
      });
      onToast(t('state.saved'));
      await onSaved(id);
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      setSaving(false);
      onBusy(null);
    }
  }

  async function remove() {
    if (!meeting) return;
    const ok = await confirm(t('attach.removeHint'), {
      title: t('modal.deleteMeetingTitle'),
      okLabel: t('common.delete'),
    });
    if (!ok) return;
    onBusy(t('modal.deleting'));
    try {
      await minutesApi.deleteMeeting(meeting.id);
      onToast(t('modal.deleted'));
      await onDeleted();
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      onBusy(null);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={meeting ? t('modal.editMeeting') : t('modal.newMeeting')}
        actions={
          <>
            {/* Delete is admin-only in the API; showing it to an editor would
                only produce a 403 they cannot act on. */}
            {meeting && isAdmin ? (
              <Button variant="danger" className="mr-auto" onClick={remove}>
                {t('common.delete')}
              </Button>
            ) : null}
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={saving} onClick={save}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label={t('modal.project')}>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('modal.title')}>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('modal.titlePlaceholder')}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('modal.dateLabel')}>
              <TextInput
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder={t('modal.datePlaceholder')}
              />
            </Field>
            <Field label={t('modal.time')}>
              <TextInput
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={t('modal.timePlaceholder')}
              />
            </Field>
          </div>

          <Field label={t('modal.content')}>
            <TextArea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={t('modal.contentPlaceholder')}
            />
          </Field>
        </div>
      </Modal>
      {confirmNode}
    </>
  );
}
