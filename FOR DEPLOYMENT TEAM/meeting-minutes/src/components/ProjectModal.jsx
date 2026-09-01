import React, { useEffect, useState } from 'react';
import { useI18n } from '@vcb/shared';
import * as minutesApi from '../lib/minutesApi';
import { errorMessage } from '../lib/errors';
import { Button, Field, Modal, Select, TextInput } from '../ui';

const CADENCES = ['Monthly', 'Quarterly', 'As needed'];
const CADENCE_KEY = {
  Monthly: 'project.cadenceMonthly',
  Quarterly: 'project.cadenceQuarterly',
  'As needed': 'project.cadenceAsNeeded',
};

/**
 * Create or rename a project.
 *
 * One component for both: NewProjectModal and RenameProjectModal were the same
 * three fields and the same validation, differing only in which endpoint they
 * called and what the heading said. Keeping them apart meant a change to the
 * cadence list had to be made twice, and once it was not.
 *
 * `project` null means create, otherwise rename. Renaming works on the original
 * five as well as runtime-created buckets — only DELETING a builtin is refused.
 */
export default function ProjectModal({ open, project, onClose, onDone, onToast, onBusy }) {
  const { t } = useI18n();
  const editing = !!project;

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [cadence, setCadence] = useState('Monthly');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project?.name || '');
    setNameEn(project?.nameEn || '');
    setCadence(project?.cadence || 'Monthly');
  }, [open, project]);

  if (!open) return null;

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      onToast(t('project.nameRequired'));
      return;
    }
    setSaving(true);
    onBusy(editing ? t('state.saving') : t('project.creating'));
    try {
      if (editing) {
        await minutesApi.updateProject(project.id, {
          name: trimmed,
          nameEn: nameEn.trim(),
          cadence,
        });
        onToast(t('project.renamed'));
        await onDone(project);
      } else {
        const created = await minutesApi.createProject({
          name: trimmed,
          nameEn: nameEn.trim(),
          cadence,
        });
        onToast(t('project.created', { name: created.name }));
        await onDone(created);
      }
    } catch (err) {
      onToast(errorMessage(err, t));
    } finally {
      setSaving(false);
      onBusy(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('project.rename') : t('project.new')}
      // Only on create, and rewritten: the original promised a Google Doc,
      // which has not been true since 2026-07-19. A new project is a tag-only
      // bucket, and saying otherwise sends people looking for a Doc that does
      // not exist.
      subtitle={editing ? undefined : t('project.newHint')}
      width="max-w-[460px]"
      actions={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={saving} onClick={submit}>
            {editing ? t('common.save') : t('project.create')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={editing ? t('project.name') : t('project.nameHint')}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('project.namePlaceholder')}
            autoFocus
          />
        </Field>
        <Field label={editing ? t('project.nameEn') : t('project.nameEnHint')}>
          <TextInput
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('project.nameEnPlaceholder')}
          />
        </Field>
        <Field label={t('project.cadence')}>
          <Select value={cadence} onChange={(e) => setCadence(e.target.value)}>
            {CADENCES.map((c) => (
              // The VALUE stays the English token the API stores; only the
              // label is translated. Storing a Thai cadence would make the
              // column unsortable and unqueryable.
              <option key={c} value={c}>
                {t(CADENCE_KEY[c])}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
