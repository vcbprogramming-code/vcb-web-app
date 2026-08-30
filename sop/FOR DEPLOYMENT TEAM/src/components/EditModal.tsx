/** Admin-only "edit / create scenario" modal. Mirrors the #editBg markup +
 *  openEditModal()/openNewScenarioModal() + doSave()/doSwap()/doDelete() in
 *  index.html. Labels here are hardcoded Thai, as in the original. */
import { useState } from 'react';
import type { Store } from '../store';
import type { Attachment } from '../data/types';
import { MODULES, MODULES_EN } from '../data/config';
import { stepsFromStorage, stepsToStorage } from '../lib/steps';
import AttachmentRows, {
  attachmentsToRows,
  rowsToAttachments,
  newAttachmentRow,
  type AttachmentRow,
} from './AttachmentRows';

/** Rebuilds the "หมวดเพิ่มเติม" checkbox set, excluding `primaryMod` (checking
 * the case's own primary module would be redundant). Mirrors
 * renderExtraModuleChecks() in index.html. */
function ExtraModuleChecks({
  primaryMod,
  checked,
  onChange,
}: {
  primaryMod: string;
  checked: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const mods = Object.keys(MODULES).filter((m) => m !== primaryMod);
  return (
    <div className="chk-grid">
      {mods.map((m) => (
        <label key={m} htmlFor={'ed_xm_' + m}>
          <input
            type="checkbox"
            id={'ed_xm_' + m}
            value={m}
            checked={checked.has(m)}
            onChange={(e) => {
              const next = new Set(checked);
              if (e.target.checked) next.add(m);
              else next.delete(m);
              onChange(next);
            }}
          />
          {m}
        </label>
      ))}
    </div>
  );
}

export default function EditModal({ s }: { s: Store }) {
  if (s.editor === null) return null;
  if (s.editor === 'new') return <EditForm key="new" s={s} mode="new" no={null} initial={null} />;
  const sc = s.scenarios.find((x) => x.no === s.editor);
  if (!sc) return null;
  // Re-key on scenario no so the form re-initialises when a different row opens.
  return <EditForm key={sc.no} s={s} mode="edit" no={sc.no} initial={sc} />;
}

interface InitialScenario {
  module: string;
  titleTH: string;
  titleEN: string;
  when: string;
  steps: string[];
  note: string;
  ref: string;
  extraModules?: string[];
  displayNo?: string;
  attachments?: Attachment[];
}

function EditForm({
  s,
  mode,
  no,
  initial,
}: {
  s: Store;
  mode: 'edit' | 'new';
  no: number | null;
  initial: InitialScenario | null;
}) {
  const labels = (s.lang === 'en' ? MODULES_EN : MODULES) as Record<string, string>;
  const preferredModule =
    initial?.module || (s.nav.mod && s.nav.mod !== 'ALL' ? s.nav.mod : Object.keys(MODULES)[0]);

  const [module, setModule] = useState(preferredModule);
  const [extraModules, setExtraModules] = useState<Set<string>>(new Set(initial?.extraModules || []));
  const [titleTH, setTitleTH] = useState(initial?.titleTH || '');
  const [titleEN, setTitleEN] = useState(initial?.titleEN || '');
  const [when, setWhen] = useState(initial?.when || '');
  const [steps, setSteps] = useState(stepsFromStorage(initial?.steps));
  const [note, setNote] = useState(initial?.note || '');
  const [ref, setRef] = useState(initial?.ref || '');
  const [attRows, setAttRows] = useState<AttachmentRow[]>(() => attachmentsToRows(initial?.attachments));
  const [swapWith, setSwapWith] = useState('');
  const [saving, setSaving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Mirrors fillSwapOptions() in index.html: every other case, grouped by
   * module, with titles truncated so a long one can't widen the closed select
   * past the modal edge (full text stays on the option's tooltip). */
  const swapGroups = Object.keys(MODULES)
    .map((m) => ({
      module: m,
      items: s.scenarios
        .filter((x) => x.module === m && x.no !== no)
        .map((x) => {
          const t = (s.lang === 'en' && x.titleEN ? x.titleEN : x.titleTH) || '';
          return {
            value: String(x.displayNo || x.no),
            title: t,
            shortTitle: t.length > 42 ? t.slice(0, 42).trim() + '…' : t,
          };
        }),
    }))
    .filter((g) => g.items.length > 0);

  function onModuleChange(next: string) {
    setModule(next);
    // Re-picking the primary module clears extra tags, mirroring
    // sel.onchange = renderExtraModuleChecks(sel.value, []) in index.html.
    setExtraModules(new Set());
  }

  async function doSave() {
    if (!s.isAdmin) return;
    if (mode === 'new' && !titleTH.trim()) {
      alert('กรุณากรอกชื่อ (ไทย) / Title (Thai) is required');
      return;
    }
    setSaving(true);
    const stepsArr = stepsToStorage(steps);
    const extraModulesArr = Array.from(extraModules);
    const attachments = rowsToAttachments(attRows);
    try {
      if (mode === 'new') {
        await s.createScenario({
          module,
          titleTH: titleTH.trim(),
          titleEN: titleEN.trim(),
          when: when.trim(),
          steps: stepsArr,
          note: note.trim(),
          ref: ref.trim(),
          extraModules: extraModulesArr,
          attachments,
        });
      } else {
        await s.saveScenario({
          no: no!,
          module,
          titleTH: titleTH.trim(),
          titleEN: titleEN.trim(),
          when: when.trim(),
          steps: stepsArr,
          note: note.trim(),
          ref: ref.trim(),
          extraModules: extraModulesArr,
          attachments,
        });
      }
      // success: store closes the modal + refreshes/re-navigates
    } catch (e: any) {
      setSaving(false);
      alert('บันทึกไม่สำเร็จ / Save failed:\n' + (e && e.message ? e.message : e));
    }
  }

  async function doSwap() {
    if (!s.isAdmin || mode !== 'edit' || no === null) return;
    const target = swapWith.trim().toUpperCase();
    if (!target) {
      alert('กรุณาเลือกกรณีที่ต้องการสลับตำแหน่งจากรายการ / Choose a case from the list to swap with');
      return;
    }
    setSwapping(true);
    try {
      await s.swapScenario({ no, swapWith: target });
    } catch (e: any) {
      setSwapping(false);
      alert('สลับไม่สำเร็จ / Swap failed:\n' + (e && e.message ? e.message : e));
    }
  }

  async function doDelete() {
    if (!s.isAdmin || mode !== 'edit' || no === null) return;
    setDeleting(true);
    try {
      await s.deleteScenarioByNo(no);
    } catch (e: any) {
      setDeleting(false);
      alert('ลบไม่สำเร็จ / Delete failed:\n' + (e && e.message ? e.message : e));
    }
  }

  const title =
    mode === 'new'
      ? 'เพิ่มกรณีเฉพาะใหม่ · New case'
      : 'แก้ไขกรณีที่ ' + (initial?.displayNo || no) + ' · ' + (initial?.titleTH || '');
  const label = initial?.displayNo || no;
  const deleteTitle = s.lang === 'en' ? 'Delete this case?' : 'ยืนยันการลบ';
  const deleteMsg =
    s.lang === 'en'
      ? 'Delete case ' +
        label +
        ' — "' +
        (initial?.titleTH || '') +
        '"?\n\nThis cannot be undone from the app (only via the Doc\'s version history). Every later case in the same module will renumber up by one.'
      : 'ลบกรณี ' +
        label +
        ' — "' +
        (initial?.titleTH || '') +
        '" ใช่หรือไม่?\n\nไม่สามารถกู้คืนได้จากในแอป (ต้องใช้ประวัติเวอร์ชันของ Doc เท่านั้น) กรณีอื่นในหมวดเดียวกันที่อยู่หลังจากนี้จะเลื่อนหมายเลขขึ้นทั้งหมด';

  return (
    /* Backdrop click intentionally does nothing — this form can hold a lot of
       typed content, so only ยกเลิก/บันทึก should close it (mirrors #editBg). */
    <div className="modal-bg full open" id="editBg">
      <div className="modal modal-full">
        <h3 id="editTitle">{title}</h3>
        <div className="mf-body">
          <div className="mf-grid">
            {/* Left: the short metadata fields. Right: the long free-text ones,
                where ขั้นตอน grows into whatever height the others leave. */}
            <div className="mf-col mf-meta">

        <div className="row" id="ed_moduleRow">
          <label>หมวด (Module)</label>
          <select id="ed_module" value={module} onChange={(e) => onModuleChange(e.target.value)}>
            {Object.keys(MODULES).map((m) => (
              <option key={m} value={m}>
                {m} · {labels[m] || m}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <label>หมวดเพิ่มเติม</label>
          <div>
            <ExtraModuleChecks primaryMod={module} checked={extraModules} onChange={setExtraModules} />
            <div className="hint">
              กรณีนี้เกี่ยวข้องกับหลายหมวด · เลือกหมวดอื่นที่ต้องการให้แสดงกรณีนี้ด้วย (ไม่บังคับ)
            </div>
          </div>
        </div>

        {mode === 'edit' && (
          <div className="row" id="ed_swapRow">
            <label>สลับตำแหน่ง</label>
            <div>
              {/* flex-basis:0 + min-width:0 are required: a <select> takes its
                  intrinsic width from its longest option, so the default
                  `flex:1 1 auto` would let long titles push the สลับ button
                  off the modal edge. */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', minWidth: 0 }}>
                <select
                  id="ed_swapWith"
                  style={{ flex: '1 1 0', minWidth: 0 }}
                  value={swapWith}
                  onChange={(e) => setSwapWith(e.target.value)}
                >
                  <option value="">— {s.t('swapPick')} —</option>
                  {swapGroups.map((g) => (
                    <optgroup key={g.module} label={g.module + ' · ' + (labels[g.module] || g.module)}>
                      {g.items.map((it) => (
                        <option key={it.value} value={it.value} title={it.title}>
                          {it.value} · {it.shortTitle}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  className="btn"
                  type="button"
                  id="ed_swapBtn"
                  disabled={swapping}
                  style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                  onClick={doSwap}
                >
                  {swapping ? 'กำลังสลับ…' : '↔ สลับ'}
                </button>
              </div>
              <div className="hint">สลับเนื้อหาทั้งหมดกับกรณีที่เลือก · กรณีอื่นๆ ไม่ถูกเลื่อนตำแหน่ง</div>
            </div>
          </div>
        )}

        <div className="row">
          <label>ชื่อ (ไทย)</label>
          <input id="ed_titleTH" type="text" value={titleTH} onChange={(e) => setTitleTH(e.target.value)} />
        </div>
        <div className="row">
          <label>ชื่อ (Eng)</label>
          <input id="ed_titleEN" type="text" value={titleEN} onChange={(e) => setTitleEN(e.target.value)} />
        </div>
        <div className="row">
          <label>อ้างอิง</label>
          <input
            id="ed_ref"
            type="text"
            placeholder="ERP Manual 14.3.68 – บทที่ X"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>

        <div className="row">
          <label>ไฟล์แนบ</label>
          <div>
            <AttachmentRows rows={attRows} onChange={setAttRows} />
            <button
              className="btn att-add"
              type="button"
              onClick={() => setAttRows([...attRows, newAttachmentRow()])}
            >
              + เพิ่มไฟล์แนบ
            </button>
            <div className="hint" id="ed_attachmentsHint">
              วางลิงก์ Drive แล้วชื่อไฟล์จะเติมให้อัตโนมัติ · แก้ไขได้ · เว้นว่างจะแสดงเป็น “เอกสารแนบ”
            </div>
          </div>
        </div>

            </div>

            <div className="mf-col">
              <div className="row">
                <label>ปัญหา</label>
                <div>
                  <textarea id="ed_when" rows={3} value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
              </div>
              {/* .ta-fill: this row takes flex:1 and hands its height to the
                  textarea through grid tracks. It must stay a GRID row — making
                  it a flex column inherits align-items:start from .modal .row
                  and packs the field to its content width. See DESIGN.md. */}
              <div className="row ta-fill">
                <label>ขั้นตอน</label>
                <div>
                  <textarea id="ed_steps" rows={10} value={steps} onChange={(e) => setSteps(e.target.value)} />
                  <div className="hint">
                    ขึ้นต้นด้วยตัวเลข (เช่น <code>1.</code>) &nbsp; ขึ้นต้นด้วย <code>&gt;</code>{' '}
                    เพื่อให้เป็นหัวข้อย่อย · <code>&gt;&gt;</code> เพื่อให้เป็นหัวข้อย่อยชั้นที่ 3
                  </div>
                </div>
              </div>
              <div className="row">
                <label>หมายเหตุ</label>
                <div>
                  <textarea
                    id="ed_note"
                    rows={2}
                    placeholder="(ไม่บังคับ)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="hint">แสดงเป็นกล่องแดงเตือนใต้ขั้นตอน · เว้นว่างถ้าไม่ต้องการ</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="actions">
          {mode === 'edit' &&
            (confirmDelete ? (
              <span style={{ marginRight: 'auto', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                <span className="hint">{deleteMsg}</span>
                <button className="btn btn-danger" type="button" disabled={deleting} onClick={doDelete}>
                  {deleting ? 'กำลังลบ…' : 'ยืนยันลบ'}
                </button>
                <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                  ยกเลิก
                </button>
              </span>
            ) : (
              <button
                className="btn btn-danger"
                id="ed_deleteBtn"
                type="button"
                style={{ marginRight: 'auto' }}
                title={deleteTitle}
                onClick={() => setConfirmDelete(true)}
              >
                {s.t('deleteBtn')}
              </button>
            ))}
          <button className="btn" onClick={s.closeEdit}>
            ยกเลิก
          </button>
          <button className="btn primary" id="editSave" disabled={saving} onClick={doSave}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
