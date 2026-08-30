/** Admin-only "edit scenario" modal. Mirrors the #editBg markup + openEditModal()
 *  + doSave() in index.html. Labels here are hardcoded Thai, as in the original. */
import { useState } from 'react';
import type { Store } from '../store';
import type { Attachment } from '../data/types';
import { MODULES, MODULES_EN } from '../data/config';
import ExtraModuleChecks from './ExtraModuleChecks';
import { stepsToStorage, stepsFromStorage } from '../lib/steps';
import AttachmentRows, {
  attachmentsToRows,
  rowsToAttachments,
  newAttachmentRow,
  type AttachmentRow,
} from './AttachmentRows';

export default function EditModal({ s }: { s: Store }) {
  const sc = s.scenarios.find((x) => x.no === s.editNo);
  // Re-key on scenario no so the form re-initialises when a different row opens.
  if (!sc) return null;
  return <EditForm key={sc.no} s={s} no={sc.no} initial={sc} />;
}

function EditForm({
  s,
  no,
  initial,
}: {
  s: Store;
  no: number;
  initial: {
    module: string;
    titleTH: string;
    titleEN: string;
    when: string;
    steps: string[];
    note: string;
    ref: string;
    displayNo?: string;
    extraModules?: string[];
    attachments?: Attachment[];
  };
}) {
  const [module, setModuleState] = useState(initial.module);
  const [titleTH, setTitleTH] = useState(initial.titleTH);
  const [titleEN, setTitleEN] = useState(initial.titleEN);
  const [when, setWhen] = useState(initial.when);
  const [steps, setSteps] = useState(stepsFromStorage(initial.steps));
  const [attRows, setAttRows] = useState<AttachmentRow[]>(() => attachmentsToRows(initial.attachments));
  const [note, setNote] = useState(initial.note || '');
  const [ref, setRef] = useState(initial.ref || '');
  const [extraModules, setExtraModules] = useState<Set<string>>(new Set(initial.extraModules || []));
  const [swapWith, setSwapWith] = useState('');
  const [saving, setSaving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const labels = s.lang === 'en' ? MODULES_EN : MODULES;

 /** Mirrors fillSwapOptions() in index.html: every other case, grouped by
   * module, titles truncated so a long one cannot widen the closed select
   * past the modal edge (full text stays on the option tooltip). */
  const swapGroups = Object.keys(MODULES)
    .map((m) => ({
      module: m,
      items: s.scenarios
        .filter((x) => x.module === m && x.no !== no)
        .map((x) => {
          const ttl = (s.lang === 'en' && x.titleEN ? x.titleEN : x.titleTH) || '';
          return {
            value: String(x.displayNo || x.no),
            title: ttl,
            shortTitle: ttl.length > 42 ? ttl.slice(0, 42).trim() + '…' : ttl,
          };
        }),
    }))
    .filter((g) => g.items.length > 0);

  function changeModule(next: string) {
    setModuleState(next);
    // Picking a new primary can't also be an extra tag — drop it if checked.
    setExtraModules((prev) => {
      if (!prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.delete(next);
      return copy;
    });
  }

  async function doSave() {
    if (!s.isAdmin) return;
    setSaving(true);
    try {
      await s.saveScenario({
        no,
        module,
        titleTH: titleTH.trim(),
        titleEN: titleEN.trim(),
        when: when.trim(),
        steps: stepsToStorage(steps),
        note: note.trim(),
        ref: ref.trim(),
        extraModules: Array.from(extraModules),
        attachments: rowsToAttachments(attRows),
      });
      if (module !== initial.module) {
        // selectModule() clears the selection (its normal sidebar-click
        // behaviour) — re-select this case so it doesn't drop back to the
        // welcome screen after moving it to a different module's list.
        s.selectModule(module);
        s.selectItem(no);
      }
      // success: store closes the modal + refreshes data
    } catch (e: any) {
      setSaving(false);
      alert('บันทึกไม่สำเร็จ / Save failed:\n' + (e && e.message ? e.message : e));
    }
  }

  async function doSwap() {
    if (!s.isAdmin) return;
    const target = swapWith.trim().toUpperCase();
    if (!target) {
      alert('กรุณาระบุกรณีที่ต้องการสลับ เช่น PO-5 / Enter a case to swap with, e.g. PO-5');
      return;
    }
    setSwapping(true);
    try {
      await s.swapScenario({ no, swapWith: target });
      // success: store closes the modal + refreshes data
    } catch (e: any) {
      setSwapping(false);
      alert('สลับไม่สำเร็จ / Swap failed:\n' + (e && e.message ? e.message : e));
    }
  }

  async function confirmDelete() {
    setConfirmDeleteOpen(false);
    setDeleting(true);
    try {
      await s.deleteScenario(no);
      // success: store closes the modal + refreshes data
    } catch (e: any) {
      setDeleting(false);
      alert('ลบไม่สำเร็จ / Delete failed:\n' + (e && e.message ? e.message : e));
    }
  }

  return (
    // Backdrop click intentionally does nothing — this form can hold a lot of
    // typed content; only ยกเลิก/Cancel or Save should close it.
    <div className="modal-bg full open" id="editBg">
      <div className="modal modal-full">
        <h3 id="editTitle">
          แก้ไขกรณีที่ {initial.displayNo || no} · {initial.titleTH}
        </h3>
        <div className="mf-body">
          <div className="mf-grid">
            {/* Left: short metadata. Right: the long free-text fields, where
                ขั้นตอน grows into whatever height the others leave. */}
            <div className="mf-col mf-meta">
        <div className="row">
          <label>หมวด (Module)</label>
          <select value={module} onChange={(e) => changeModule(e.target.value)}>
            {Object.keys(MODULES).map((m) => (
              <option key={m} value={m}>
                {m} · {(labels as Record<string, string>)[m] || m}
              </option>
            ))}
          </select>
        </div>
        <ExtraModuleChecks primaryMod={module} checked={extraModules} onChange={setExtraModules} />
        <div className="row">
          <label>สลับตำแหน่ง</label>
          <div>
            {/* flex-basis:0 + min-width:0 are required: a <select> takes its
                intrinsic width from its longest option, so the default
                `flex:1 1 auto` would let long titles push the สลับ button off
                the modal edge. */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', minWidth: 0 }}>
              <select
                style={{ flex: '1 1 0', minWidth: 0 }}
                value={swapWith}
                onChange={(e) => setSwapWith(e.target.value)}
              >
                <option value="">— {s.t('swapPick')} —</option>
                {swapGroups.map((g) => (
                  <optgroup key={g.module} label={g.module + ' · ' + ((labels as Record<string, string>)[g.module] || g.module)}>
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
                  textarea through grid tracks. It must stay a GRID row —
                  making it a flex column inherits align-items:start from
                  .modal .row and packs the field to its content width. */}
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
          <button
            className="btn btn-danger"
            type="button"
            style={{ marginRight: 'auto' }}
            disabled={deleting}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {deleting ? 'กำลังลบ…' : 'ลบกรณีนี้ · Delete'}
          </button>
          <button className="btn" onClick={s.closeEdit}>
            ยกเลิก
          </button>
          <button className="btn primary" id="editSave" disabled={saving} onClick={doSave}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
      {confirmDeleteOpen && (
        <div className="modal-bg open" onClick={(e) => e.target === e.currentTarget && setConfirmDeleteOpen(false)}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <h3>{s.lang === 'en' ? 'Delete this case?' : 'ยืนยันการลบ'}</h3>
            <p className="confirm-msg">
              {s.lang === 'en'
                ? `Delete case ${initial.displayNo || no} — "${initial.titleTH}"?\n\nThis cannot be undone from the app (only via the Doc's version history). Every later case in the same module will renumber up by one.`
                : `ลบกรณี ${initial.displayNo || no} — "${initial.titleTH}" ใช่หรือไม่?\n\nไม่สามารถกู้คืนได้จากในแอป (ต้องใช้ประวัติเวอร์ชันของ Doc เท่านั้น) กรณีอื่นในหมวดเดียวกันที่อยู่หลังจากนี้จะเลื่อนหมายเลขขึ้นทั้งหมด`}
            </p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirmDeleteOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn primary btn-danger-solid" onClick={confirmDelete}>
                ลบ · Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
