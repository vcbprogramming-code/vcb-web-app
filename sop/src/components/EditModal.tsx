/** Admin-only "edit scenario" modal. Mirrors the #editBg markup + openEditModal()
 *  + doSave() in index.html. Labels here are hardcoded Thai, as in the original. */
import { useState } from 'react';
import type { Store } from '../store';
import { MODULES, MODULES_EN } from '../data/config';
import ExtraModuleChecks from './ExtraModuleChecks';

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
  };
}) {
  const [module, setModuleState] = useState(initial.module);
  const [titleTH, setTitleTH] = useState(initial.titleTH);
  const [titleEN, setTitleEN] = useState(initial.titleEN);
  const [when, setWhen] = useState(initial.when);
  const [steps, setSteps] = useState((initial.steps || []).join('\n'));
  const [note, setNote] = useState(initial.note || '');
  const [ref, setRef] = useState(initial.ref || '');
  const [extraModules, setExtraModules] = useState<Set<string>>(new Set(initial.extraModules || []));
  const [saving, setSaving] = useState(false);

  const labels = s.lang === 'en' ? MODULES_EN : MODULES;

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
        steps: steps
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean),
        note: note.trim(),
        ref: ref.trim(),
        extraModules: Array.from(extraModules),
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

  return (
    // Backdrop click intentionally does nothing — this form can hold a lot of
    // typed content; only ยกเลิก/Cancel or Save should close it.
    <div className="modal-bg open" id="editBg">
      <div className="modal" style={{ maxWidth: '780px' }}>
        <h3 id="editTitle">
          แก้ไขกรณีที่ {initial.displayNo || no} · {initial.titleTH}
        </h3>
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
          <label>ชื่อ (ไทย)</label>
          <input id="ed_titleTH" type="text" value={titleTH} onChange={(e) => setTitleTH(e.target.value)} />
        </div>
        <div className="row">
          <label>ชื่อ (Eng)</label>
          <input id="ed_titleEN" type="text" value={titleEN} onChange={(e) => setTitleEN(e.target.value)} />
        </div>
        <div className="row">
          <label>ปัญหา</label>
          <textarea id="ed_when" rows={3} value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="row">
          <label>ขั้นตอน</label>
          <div>
            <textarea id="ed_steps" rows={10} value={steps} onChange={(e) => setSteps(e.target.value)} />
            <div className="hint">
              1 ขั้นตอน = 1 บรรทัด · ขึ้นต้นบรรทัดด้วย <code>» </code> เพื่อให้เป็นหัวข้อย่อยใต้ขั้นตอนก่อนหน้า
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
        <div className="actions">
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
