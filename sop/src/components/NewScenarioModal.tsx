/** Admin-only "add new scenario" modal. Mirrors #editBg in "new" mode +
 *  openNewScenarioModal() + doSave() in the canonical index.html/apps-script
 *  port. Structurally close to EditModal.tsx but adds the module picker and
 *  starts every field blank. */
import { useState } from 'react';
import type { Store } from '../store';
import { MODULES, MODULES_EN } from '../data/config';

export default function NewScenarioModal({ s }: { s: Store }) {
  const labels = s.lang === 'en' ? MODULES_EN : MODULES;
  const preferred = s.nav.mod !== 'ALL' ? s.nav.mod : Object.keys(MODULES)[0];

  const [module, setModule] = useState(preferred);
  const [titleTH, setTitleTH] = useState('');
  const [titleEN, setTitleEN] = useState('');
  const [when, setWhen] = useState('');
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);

  async function doSave() {
    if (!s.isAdmin) return;
    const th = titleTH.trim();
    if (!th) {
      alert('กรุณากรอกชื่อ (ไทย) / Title (Thai) is required');
      return;
    }
    setSaving(true);
    try {
      const no = await s.createNewScenario({
        module,
        titleTH: th,
        titleEN: titleEN.trim(),
        when: when.trim(),
        steps: steps
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean),
        note: note.trim(),
        ref: ref.trim(),
      });
      s.selectModule(module);
      s.selectItem(no);
      // success: store closes the modal + refreshes data
    } catch (e: any) {
      setSaving(false);
      alert('บันทึกไม่สำเร็จ / Save failed:\n' + (e && e.message ? e.message : e));
    }
  }

  return (
    // Backdrop click intentionally does nothing — see EditModal.tsx.
    <div className="modal-bg open" id="newScenarioBg">
      <div className="modal" style={{ maxWidth: '780px' }}>
        <h3>เพิ่มกรณีศึกษาใหม่ · New case</h3>
        <div className="row">
          <label>หมวด (Module)</label>
          <select value={module} onChange={(e) => setModule(e.target.value)}>
            {Object.keys(MODULES).map((m) => (
              <option key={m} value={m}>
                {m} · {(labels as Record<string, string>)[m] || m}
              </option>
            ))}
          </select>
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
          <button className="btn" onClick={s.closeNewScenario}>
            ยกเลิก
          </button>
          <button className="btn primary" disabled={saving} onClick={doSave}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
