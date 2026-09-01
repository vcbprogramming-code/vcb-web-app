/**
 * Editor-only create/edit modal for one case.
 *
 * Three write paths live here, matching the three routes the API exposes for a
 * scenario: save (POST or PATCH), swap, and delete.
 *
 * ---------------------------------------------------------------------------
 * A REJECTED WRITE MUST NOT LOOK LIKE A SAVE.
 * ---------------------------------------------------------------------------
 * Every mutation on this API is a read-modify-write of the whole document under
 * `select … for update`. This client cannot assume it wins. So the modal stays
 * OPEN on failure with the typing intact and the reason shown — closing it
 * would tell the person their work was saved when it was not, and the text is
 * gone by the time they find out.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@vcb/shared';

import { MODULE_ORDER, moduleLabel } from '../data/config.js';
import { stepsFromStorage, stepsToStorage } from '../lib/steps.js';
import { errorKey } from '../lib/sopApi.js';
import { useStore } from '../store.jsx';
import AttachmentRows, {
  attachmentsToRows,
  newAttachmentRow,
  rowsToAttachments,
} from './AttachmentRows.jsx';
import { Button, Field, Modal, Notice, Select, TextArea, TextInput } from './ui.jsx';

/** The "also show this case under" checkboxes. The case's own primary module is
 * excluded — tagging a case into its own module is meaningless, and the API
 * filters it out server-side anyway. */
function ExtraModules({ primary, checked, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {MODULE_ORDER.filter((m) => m !== primary).map((m) => (
        <label
          key={m}
          className="flex cursor-pointer items-center gap-1.5 rounded-control border border-line px-2 py-1.5 text-xs font-semibold hover:bg-surface-sunken dark:border-line-dark dark:hover:bg-surface-dark-sunken"
        >
          <input
            type="checkbox"
            checked={checked.includes(m)}
            onChange={(e) =>
              onChange(e.target.checked ? [...checked, m] : checked.filter((x) => x !== m))
            }
            className="h-3.5 w-3.5 accent-brand-700"
          />
          {m}
        </label>
      ))}
    </div>
  );
}

export default function EditCaseModal({ mode, scenario, onClose }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { scenarios, createScenario, saveScenario, swapScenario, deleteScenario } = useStore();

  const isNew = mode === 'new';
  const no = scenario?.no ?? null;

  const [module, setModule] = useState(scenario?.module || MODULE_ORDER[0]);
  const [extraModules, setExtraModules] = useState(scenario?.extraModules || []);
  const [titleTH, setTitleTH] = useState(scenario?.titleTH || '');
  const [titleEN, setTitleEN] = useState(scenario?.titleEN || '');
  const [when, setWhen] = useState(scenario?.when || '');
  const [steps, setSteps] = useState(stepsFromStorage(scenario?.steps));
  const [note, setNote] = useState(scenario?.note || '');
  const [ref, setRef] = useState(scenario?.ref || '');
  const [attRows, setAttRows] = useState(() => attachmentsToRows(scenario?.attachments));

  const [swapWith, setSwapWith] = useState('');
  const [busy, setBusy] = useState(null); // 'save' | 'swap' | 'delete'
  const [err, setErr] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Every OTHER case, grouped by module, for the swap picker. Titles are
   * truncated so a long one cannot widen the closed <select> past the modal
   * edge; the full text stays on the option's tooltip. */
  const swapGroups = useMemo(
    () =>
      MODULE_ORDER.map((m) => ({
        module: m,
        items: scenarios
          .filter((x) => x.module === m && x.no !== no)
          .map((x) => {
            const title = (lang === 'en' && x.titleEN ? x.titleEN : x.titleTH) || '';
            return {
              value: String(x.displayNo || x.no),
              title,
              short: title.length > 42 ? `${title.slice(0, 42).trim()}…` : title,
            };
          }),
      })).filter((g) => g.items.length > 0),
    [scenarios, no, lang]
  );

  function onModuleChange(next) {
    setModule(next);
    // Re-picking the primary module clears the extra tags, as the canonical app
    // did — the previous set was chosen relative to the old primary.
    setExtraModules([]);
  }

  async function save() {
    if (!titleTH.trim()) {
      setErr({ code: 'TITLE_REQUIRED' });
      return;
    }
    setBusy('save');
    setErr(null);

    // displayNo is deliberately NOT sent: the API recomputes it from row order
    // on every read, and a client copy would be stale the moment anything is
    // reordered. `no` is not sent either — it is the address, not a field.
    const payload = {
      module,
      titleTH: titleTH.trim(),
      titleEN: titleEN.trim(),
      when: when.trim(),
      steps: stepsToStorage(steps),
      note: note.trim(),
      ref: ref.trim(),
      extraModules,
      attachments: rowsToAttachments(attRows),
    };

    try {
      if (isNew) {
        const res = await createScenario(payload);
        onClose();
        // Follow the new case so it is not left seemingly unsaved off-screen.
        if (res?.no) navigate(`/cases/${res.no}`);
      } else {
        await saveScenario(no, payload);
        onClose();
        // An edit that changed the module would otherwise leave the case
        // apparently vanished from the list currently open.
        navigate(`/cases/${no}`);
      }
    } catch (e) {
      setErr(e);
      setBusy(null);
    }
  }

  async function doSwap() {
    const target = swapWith.trim().toUpperCase();
    if (!target) {
      setErr({ code: 'SWAP_REQUIRED' });
      return;
    }
    setBusy('swap');
    setErr(null);
    try {
      await swapScenario(no, target);
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(null);
    }
  }

  async function doDelete() {
    setBusy('delete');
    setErr(null);
    try {
      await deleteScenario(no);
      onClose();
      navigate(`/cases/module/${module}`);
    } catch (e) {
      setErr(e);
      setBusy(null);
    }
  }

  const title = isNew
    ? t('edit.newTitle')
    : t('edit.editTitle', { no: scenario?.displayNo || no, title: scenario?.titleTH || '' });

  function errorText(e) {
    if (e?.code === 'TITLE_REQUIRED') return t('edit.titleRequired');
    if (e?.code === 'SWAP_REQUIRED') return t('edit.swapRequired');
    return t(errorKey(e));
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      // Not dismissable: this form holds a lot of typed content and a stray
      // backdrop click throwing it away was worth guarding in the original too.
      dismissable={false}
      size="full"
      footer={
        <>
          {!isNew &&
            (confirmDelete ? (
              <span className="flex flex-1 flex-wrap items-center gap-2">
                <span className="text-xs text-danger-fg break-thai dark:text-danger-dark">
                  {t('edit.deleteConfirm', {
                    no: scenario?.displayNo || no,
                    title: scenario?.titleTH || '',
                  })}{' '}
                  {t('edit.deleteUndo')}
                </span>
                <Button variant="danger" onClick={doDelete} disabled={busy === 'delete'}>
                  {busy === 'delete' ? t('edit.deleting') : t('edit.deleteYes')}
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
              </span>
            ) : (
              <Button
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                title={t('edit.deleteConfirmTitle')}
              >
                {t('detail.delete')}
              </Button>
            ))}
          <Button onClick={onClose} className="ml-auto">
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy !== null}>
            {busy === 'save' ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      {err && (
        <Notice tone="danger" className="mb-4">
          {errorText(err)}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* left — short metadata fields */}
        <div className="flex flex-col gap-3.5">
          <Field label={t('edit.module')}>
            <Select value={module} onChange={(e) => onModuleChange(e.target.value)}>
              {MODULE_ORDER.map((m) => (
                <option key={m} value={m}>
                  {m} · {moduleLabel(m, lang)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('edit.extraModules')} hint={t('edit.extraModulesHint')}>
            <ExtraModules primary={module} checked={extraModules} onChange={setExtraModules} />
          </Field>

          {!isNew && (
            <Field label={t('edit.swap')} hint={t('edit.swapHint')}>
              <div className="flex items-stretch gap-2">
                {/* min-w-0 matters: a <select> takes its intrinsic width from
                    its longest option, so without it a long title pushes the
                    swap button past the modal edge. */}
                <Select
                  value={swapWith}
                  onChange={(e) => setSwapWith(e.target.value)}
                  className="min-w-0 flex-1"
                >
                  <option value="">— {t('edit.swapPick')} —</option>
                  {swapGroups.map((g) => (
                    <optgroup key={g.module} label={`${g.module} · ${moduleLabel(g.module, lang)}`}>
                      {g.items.map((it) => (
                        <option key={it.value} value={it.value} title={it.title}>
                          {it.value} · {it.short}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Button onClick={doSwap} disabled={busy !== null} className="shrink-0 whitespace-nowrap">
                  {busy === 'swap' ? t('edit.swapping') : t('edit.swapBtn')}
                </Button>
              </div>
            </Field>
          )}

          <Field label={t('edit.titleTH')}>
            <TextInput type="text" value={titleTH} onChange={(e) => setTitleTH(e.target.value)} />
          </Field>

          <Field label={t('edit.titleEN')}>
            <TextInput type="text" value={titleEN} onChange={(e) => setTitleEN(e.target.value)} />
          </Field>

          <Field label={t('edit.ref')}>
            <TextInput
              type="text"
              placeholder={t('edit.refPh')}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </Field>

          <Field label={t('edit.attachments')} hint={t('edit.attachmentsHint')}>
            <div className="flex flex-col gap-2">
              <AttachmentRows rows={attRows} onChange={setAttRows} />
              <Button
                onClick={() => setAttRows([...attRows, newAttachmentRow()])}
                className="self-start py-1 text-xs"
              >
                {t('edit.attachmentsAdd')}
              </Button>
            </div>
          </Field>
        </div>

        {/* right — the long free-text fields */}
        <div className="flex flex-col gap-3.5">
          <Field label={t('edit.when')}>
            <TextArea rows={3} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>

          <Field label={t('edit.steps')} hint={t('edit.stepsHint')}>
            <TextArea
              rows={14}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="font-mono text-[13px]"
            />
          </Field>

          <Field label={t('edit.noteField')} hint={t('edit.noteHint')}>
            <TextArea
              rows={2}
              placeholder={t('edit.notePh')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
