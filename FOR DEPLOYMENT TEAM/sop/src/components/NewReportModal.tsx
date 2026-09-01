/** Admin-only "add new report row" modal. Mirrors #reportBg + openNewReportModal()
 *  + doSaveReport() in the canonical apps-script/index.html. Small and separate
 *  from EditModal — a report row is just (case #, description, menu path), not
 *  a full scenario. */
import { useState } from 'react';
import type { Store } from '../store';

export default function NewReportModal({ s }: { s: Store }) {
  const [caseNo, setCaseNo] = useState(() => (s.reports.length ? s.reports[s.reports.length - 1].case + 1 : 1));
  const [scenario, setScenario] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);

  async function doSave() {
    if (!s.isAdmin) return;
    const scenarioText = scenario.trim();
    const pathText = path.trim();
    if (!scenarioText || !pathText) {
      alert(s.t('reportRequiredMsg'));
      return;
    }
    setSaving(true);
    try {
      await s.createNewReport({ case: caseNo, scenario: scenarioText, path: pathText });
      // success: store closes the modal + refreshes data
    } catch (e: any) {
      setSaving(false);
      alert('บันทึกไม่สำเร็จ / Save failed:\n' + (e && e.message ? e.message : e));
    }
  }

  return (
    <div
      className="modal-bg open"
      id="reportBg"
      onClick={(e) => {
        if (e.target === e.currentTarget) s.closeNewReport();
      }}
    >
      <div className="modal" style={{ maxWidth: '560px' }}>
        <h3>{s.t('newReportTitle')}</h3>
        <div className="row">
          <label>เลขกรณี · Case #</label>
          <input
            type="number"
            min={1}
            placeholder="เช่น 32"
            value={caseNo}
            onChange={(e) => setCaseNo(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="row">
          <label>ต้องการตรวจสอบอะไร</label>
          <textarea rows={2} value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </div>
        <div className="row">
          <label>เมนูที่ใช้ · Menu Path</label>
          <input
            type="text"
            placeholder="เช่น AP -> Report -> 5.1.2 (Cheque Register Report)"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </div>
        <div className="actions">
          <button className="btn" onClick={s.closeNewReport}>
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
