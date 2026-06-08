import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/ememo.js';
import Icon from '../../components/Icon.jsx';

export default function LetterheadTab() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi.listProjects().then((r) => {
      setProjects(r.data);
      if (r.data[0]) setProjectId(r.data[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setForm(null);
    setSaved(false);
    adminApi.getLetterhead(projectId).then((r) => {
      const d = r.data || {};
      setForm({
        companyName: d.company_name || '',
        companyNameEn: d.company_name_en || '',
        address: d.address || '',
        phone: d.phone || '',
        telex: d.telex || '',
        fax: d.fax || '',
        signatoryName: d.signatory_name || '',
        signatoryTitle: d.signatory_title || '',
        closingLine: d.closing_line || '',
        defaultRecipient: d.default_recipient || '',
        logoUrl: d.logo_url || '',
      });
    }).catch((e) => setError(e.message));
  }, [projectId]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.saveLetterhead(projectId, form);
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const field = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">เลือกโครงการ</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {form && (
        <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <p className="text-sm text-slate-500">ข้อมูลนี้จะถูกใช้ตอนสร้าง PDF หนังสือของโครงการนี้</p>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อบริษัท / หน่วยงาน (ไทย)</label>
            <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อบริษัท (อังกฤษ)</label>
            <input value={form.companyNameEn} onChange={(e) => set('companyNameEn', e.target.value)} placeholder="Vichitbhan Construction Co., Ltd." className={field} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">โทรศัพท์</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">เทเล็กซ์</label>
              <input value={form.telex} onChange={(e) => set('telex', e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">โทรสาร</label>
              <input value={form.fax} onChange={(e) => set('fax', e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ที่อยู่</label>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อผู้ลงนาม</label>
              <input value={form.signatoryName} onChange={(e) => set('signatoryName', e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ตำแหน่งผู้ลงนาม</label>
              <input value={form.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">คำลงท้าย</label>
              <input value={form.closingLine} onChange={(e) => set('closingLine', e.target.value)} placeholder="ขอแสดงความนับถือ" className={field} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ผู้รับเริ่มต้น (เรียน)</label>
              <input value={form.defaultRecipient} onChange={(e) => set('defaultRecipient', e.target.value)} className={field} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                <Icon name="check" className="h-4 w-4" /> บันทึกแล้ว
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
